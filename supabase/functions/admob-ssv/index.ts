// supabase/functions/admob-ssv/index.ts
// Receives AdMob's Server-Side Verification (SSV) callback after a user
// finishes watching a rewarded ad, cryptographically verifies Google's ECDSA
// signature over the callback query string, and grants 1 joker server-side
// via grant_ad_reward_jokers(), idempotently. The client's on-device "ad
// watched" event is never trusted for the actual grant — only this signed
// callback is.
//
// Callback URL is registered manually in the AdMob dashboard (ad unit ->
// Server-side verification) once this function is deployed.
//
// AdMob SSV reference: https://developers.google.com/admob/android/rewarded-video-ssv
// (same callback param shape on iOS/Android)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERIFIER_KEYS_URL = "https://www.gstatic.com/admob/reward/verifier-keys.json";
const EXPECTED_AD_UNIT = "ca-app-pub-3065939958076631/2528014423";
// The DB unique constraint on transaction_id is the real replay defense; this
// is only a loose bound on how long a leaked/captured callback URL is useful.
const MAX_CALLBACK_AGE_MS = 24 * 60 * 60 * 1000;
// Google rotates verification keys roughly weekly; refresh well before that.
const KEY_CACHE_TTL_MS = 60 * 60 * 1000;

interface VerifierKey {
  keyId: number;
  pem: string;
  base64: string;
}

let cachedKeys: VerifierKey[] | null = null;
let cachedKeysFetchedAt = 0;

async function getVerifierKeys(): Promise<VerifierKey[]> {
  const isStale = Date.now() - cachedKeysFetchedAt > KEY_CACHE_TTL_MS;
  if (cachedKeys && !isStale) return cachedKeys;
  const res = await fetch(VERIFIER_KEYS_URL);
  if (!res.ok) {
    if (cachedKeys) return cachedKeys; // serve stale rather than fail outright
    throw new Error(`Failed to fetch AdMob verifier keys: ${res.status}`);
  }
  const body = await res.json();
  cachedKeys = body.keys as VerifierKey[];
  cachedKeysFetchedAt = Date.now();
  return cachedKeys;
}

function base64UrlToUint8Array(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Google's ECDSA signature arrives DER-encoded (ASN.1 SEQUENCE of two
// INTEGERs r, s); Web Crypto's ECDSA verify wants the raw IEEE-P1363 r||s
// format instead, so convert.
function derToRawEcdsaSignature(der: Uint8Array, componentLen = 32): Uint8Array {
  let offset = 0;
  if (der[offset++] !== 0x30) throw new Error("Invalid DER signature: expected SEQUENCE");

  let seqLen = der[offset++];
  if (seqLen & 0x80) {
    const numBytes = seqLen & 0x7f;
    seqLen = 0;
    for (let i = 0; i < numBytes; i++) seqLen = (seqLen << 8) | der[offset++];
  }

  const readInt = (): Uint8Array => {
    if (der[offset++] !== 0x02) throw new Error("Invalid DER signature: expected INTEGER");
    let len = der[offset++];
    if (len & 0x80) {
      const numBytes = len & 0x7f;
      len = 0;
      for (let i = 0; i < numBytes; i++) len = (len << 8) | der[offset++];
    }
    const bytes = der.slice(offset, offset + len);
    offset += len;
    return bytes;
  };

  const toFixedLength = (bytes: Uint8Array): Uint8Array => {
    const trimmed = bytes[0] === 0x00 && bytes.length > componentLen ? bytes.slice(1) : bytes;
    if (trimmed.length > componentLen) throw new Error("Invalid DER signature: integer too large");
    const out = new Uint8Array(componentLen);
    out.set(trimmed, componentLen - trimmed.length);
    return out;
  };

  const r = readInt();
  const s = readInt();

  const raw = new Uint8Array(componentLen * 2);
  raw.set(toFixedLength(r), 0);
  raw.set(toFixedLength(s), componentLen);
  return raw;
}

async function importEcdsaPublicKey(base64Spki: string): Promise<CryptoKey> {
  const der = Uint8Array.from(atob(base64Spki), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("spki", der, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
}

type VerificationResult =
  | { valid: true }
  | { valid: false; reason: string; noSignaturePresent?: boolean };

async function verifySsvSignature(url: URL): Promise<VerificationResult> {
  const keyIdParam = url.searchParams.get("key_id");
  const signatureParam = url.searchParams.get("signature");
  if (!keyIdParam || !signatureParam) {
    // Not a forged/tampered callback attempt — just a request with no
    // signature at all, e.g. AdMob's dashboard "Confirm URL" reachability
    // check when first setting up SSV, which (per Google's docs) only needs
    // an HTTP 200 to pass and doesn't exercise the crypto path. Flagged
    // separately from actually-invalid signatures so the caller can 200 this
    // without ever going near the grant RPC.
    return { valid: false, reason: "Missing key_id or signature", noSignaturePresent: true };
  }

  // The signed content is everything in the query string *before* the
  // "signature" param, exactly as it appears on the wire — per Google's SSV
  // spec, "signature" and "key_id" are always the last two params, in that order.
  const rawQuery = url.search.startsWith("?") ? url.search.slice(1) : url.search;
  const sigIndex = rawQuery.indexOf("&signature=");
  if (sigIndex === -1) {
    return { valid: false, reason: "signature not found in expected position" };
  }
  const signedContent = rawQuery.slice(0, sigIndex);

  const keys = await getVerifierKeys();
  const key = keys.find((k) => String(k.keyId) === keyIdParam);
  if (!key) {
    return { valid: false, reason: `Unknown key_id ${keyIdParam}` };
  }

  const publicKey = await importEcdsaPublicKey(key.base64);
  const signatureDer = base64UrlToUint8Array(signatureParam);
  const signatureRaw = derToRawEcdsaSignature(signatureDer);

  const valid = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    publicKey,
    signatureRaw,
    new TextEncoder().encode(signedContent)
  );

  return { valid };
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const url = new URL(req.url);

  let verification: VerificationResult;
  try {
    verification = await verifySsvSignature(url);
  } catch (e) {
    console.error("[admob-ssv] signature verification threw:", e);
    return jsonResponse({ error: "Verification failed" }, 400);
  }

  if (!verification.valid) {
    if (verification.noSignaturePresent) {
      // e.g. AdMob's own dashboard "Confirm URL" check for SSV setup — not a
      // real callback, nothing to verify or grant, just needs a 200 so the
      // dashboard considers the endpoint reachable.
      console.log("[admob-ssv] no signature/key_id present, treating as a reachability check:", url.search);
      return jsonResponse({ ignored: true, reason: "no_signature" }, 200);
    }
    // A signature WAS present but failed cryptographic verification — this is
    // the real forged/tampered-callback rejection path, unchanged.
    console.warn("[admob-ssv] invalid signature:", verification.reason, url.search);
    return jsonResponse({ error: "Invalid signature" }, 400);
  }

  const adUnit = url.searchParams.get("ad_unit");
  const transactionId = url.searchParams.get("transaction_id");
  const userId = url.searchParams.get("user_id");
  const adNetwork = url.searchParams.get("ad_network");
  const rewardItem = url.searchParams.get("reward_item");
  const rewardAmountRaw = url.searchParams.get("reward_amount");
  const timestampRaw = url.searchParams.get("timestamp");

  if (!transactionId) {
    // A validly-signed callback should always carry a transaction_id; this
    // would mean a genuinely malformed request.
    return jsonResponse({ error: "Missing transaction_id" }, 400);
  }

  if (!userId) {
    // Our own ad requests always set serverSideVerificationOptions.userId, so
    // any real callback for a joker-earning view has one. A validly-signed
    // request with no user_id is AdMob's own dashboard "Confirm URL" check
    // (confirmed via logs: it sends a genuinely Google-signed test request,
    // just with no real user to attribute) — nothing to grant, but not an
    // error either, so 200 rather than rejecting it.
    console.log("[admob-ssv] valid signature but no user_id (likely AdMob's URL confirmation test):", url.search);
    return jsonResponse({ ignored: true, reason: "no_user_id" }, 200);
  }

  if (adUnit !== EXPECTED_AD_UNIT) {
    // Validly signed by Google, but for a different ad unit than this app's
    // rewarded unit — ignore rather than grant, but still 200 so nothing retries.
    console.warn(`[admob-ssv] unexpected ad_unit=${adUnit}`);
    return jsonResponse({ ignored: true }, 200);
  }

  if (timestampRaw) {
    const timestampMs = Number(timestampRaw);
    if (Number.isFinite(timestampMs) && Date.now() - timestampMs > MAX_CALLBACK_AGE_MS) {
      console.warn(`[admob-ssv] stale callback, timestamp=${timestampRaw}`);
      return jsonResponse({ ignored: true, reason: "stale" }, 200);
    }
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { data, error } = await supabase.rpc("grant_ad_reward_jokers", {
      p_user_id: userId,
      p_transaction_id: transactionId,
      p_ad_network: adNetwork,
      p_ad_unit: adUnit,
      p_reward_item: rewardItem,
      p_reward_amount: rewardAmountRaw ? Number(rewardAmountRaw) : null,
    });

    if (error) {
      // Unexpected DB/connection failure — not the normal "duplicate
      // transaction" case, which the RPC signals by returning `false`.
      console.error(`[admob-ssv] grant_ad_reward_jokers errored for transaction_id=${transactionId}:`, error);
      return jsonResponse({ error: "Internal error" }, 500);
    }

    // `data` is `true` (granted) or `false` (duplicate/replayed callback) —
    // both expected outcomes, not failures, so always 200 here.
    return jsonResponse({ granted: data === true }, 200);
  } catch (e) {
    console.error(`[admob-ssv] unexpected error for transaction_id=${transactionId}:`, e);
    return jsonResponse({ error: "Internal error" }, 500);
  }
});
