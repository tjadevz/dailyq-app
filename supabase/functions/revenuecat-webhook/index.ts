// supabase/functions/revenuecat-webhook/index.ts
// Receives RevenueCat webhook events for consumable joker-pack purchases and
// grants jokers server-side, idempotently, via grant_iap_jokers().

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RevenueCatEvent {
  type: string;
  app_user_id: string;
  product_id: string;
  transaction_id: string;
  environment?: string;
  store?: string;
}

interface RevenueCatWebhookBody {
  api_version?: string;
  event: RevenueCatEvent;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const expectedSecret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
  const authHeader =
    req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!expectedSecret || authHeader !== expectedSecret) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let body: RevenueCatWebhookBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const event = body?.event;
  if (!event?.transaction_id || !event.app_user_id || !event.product_id) {
    return jsonResponse({ error: "Missing event fields" }, 400);
  }

  // Only consumable one-time purchases (jokers) grant jokers; ignore everything
  // else (subscription events, dashboard test pings, etc.) without erroring so
  // RevenueCat doesn't treat it as a delivery failure and keep retrying.
  if (event.type !== "NON_RENEWING_PURCHASE") {
    return jsonResponse({ ignored: true, type: event.type }, 200);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { data, error } = await supabase.rpc("grant_iap_jokers", {
      p_user_id: event.app_user_id,
      p_transaction_id: event.transaction_id,
      p_product_id: event.product_id,
      p_environment: event.environment ?? null,
    });

    if (error) {
      // An unexpected DB/connection failure — NOT the normal "duplicate
      // transaction" or "unknown product" case, those are signaled by the
      // function returning `false`, not by an error. Ask RevenueCat to retry.
      console.error(
        `[revenuecat-webhook] grant_iap_jokers errored for transaction_id=${event.transaction_id} product_id=${event.product_id}:`,
        error
      );
      return jsonResponse({ error: "Internal error" }, 500);
    }

    // `data` is `true` (granted) or `false` (duplicate replay / unknown product
    // id) — both are expected outcomes, not failures, so always 200 here.
    return jsonResponse({ granted: data === true }, 200);
  } catch (e) {
    console.error(
      `[revenuecat-webhook] unexpected error for transaction_id=${event.transaction_id} product_id=${event.product_id}:`,
      e
    );
    return jsonResponse({ error: "Internal error" }, 500);
  }
});
