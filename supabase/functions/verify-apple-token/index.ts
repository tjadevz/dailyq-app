// supabase/functions/verify-apple-token/index.ts
// Sign in with Apple: verify identity token, get or create user, return Supabase session.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTPayload,
} from "https://deno.land/x/jose@v5.2.0/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const APPLE_ISS = "https://appleid.apple.com";
const APPLE_AUD = "com.tjade.dailyq";
const APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys";

interface AppleIdTokenPayload extends JWTPayload {
  sub: string;
  email?: string;
  email_verified?: boolean | string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { identityToken?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const identityToken = body?.identityToken;
  if (!identityToken || typeof identityToken !== "string") {
    return new Response(JSON.stringify({ error: "Missing identityToken" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({
        error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  let payload: AppleIdTokenPayload;
  try {
    const JWKS = createRemoteJWKSet(new URL(APPLE_JWKS_URL));
    const { payload: p } = await jwtVerify(identityToken, JWKS, {
      issuer: APPLE_ISS,
      audience: APPLE_AUD,
      clockTolerance: 60,
    });
    payload = p as AppleIdTokenPayload;
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Invalid or expired Apple token" }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const sub = payload.sub;
  const email =
    payload.email && payload.email_verified
      ? String(payload.email)
      : `${sub}@apple.private`;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1) Try to find existing user by email (listUsers and search)
  let userExists = false;
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data: listData, error: listErr } =
      await supabase.auth.admin.listUsers({ page, perPage });
    if (listErr) {
      return new Response(JSON.stringify({ error: listErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const users = listData?.users ?? [];
    const found = users.some(
      (u) =>
        u.email?.toLowerCase() === email.toLowerCase() ||
        u.user_metadata?.provider_id === sub
    );
    if (found) {
      userExists = true;
      break;
    }
    if (users.length < perPage) break;
    page += 1;
    if (page > 50) break; // safety: stop after 50k users
  }

  // 2) If user doesn't exist, create with createUser
  if (!userExists) {
    const { error: createErr } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        provider: "apple",
        provider_id: sub,
        ...(payload.email && { full_name: payload.email }),
      },
    });
    if (createErr) {
      // User may exist (e.g. created between listUsers and createUser); continue to generateLink
      const isAlreadyRegistered =
        createErr.message?.toLowerCase().includes("already") === true;
      if (!isAlreadyRegistered) {
        return new Response(JSON.stringify({ error: createErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
  }

  // 3) Generate session for this user (existing or new) via generateLink + verifyOtp

  const { data: linkData, error: linkErr } =
    await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

  if (linkErr) {
    return new Response(JSON.stringify({ error: linkErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const hashedToken = (linkData?.properties as { hashed_token?: string })
    ?.hashed_token;
  if (!hashedToken) {
    return new Response(
      JSON.stringify({ error: "Failed to generate session link" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const { data: sessionData, error: verifyErr } =
    await supabase.auth.verifyOtp({
      token_hash: hashedToken,
      type: "magiclink",
    });

  if (verifyErr) {
    return new Response(JSON.stringify({ error: verifyErr.message }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const session = sessionData?.session;
  if (!session?.access_token || !session?.refresh_token) {
    return new Response(
      JSON.stringify({ error: "Session could not be created" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  return new Response(
    JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
