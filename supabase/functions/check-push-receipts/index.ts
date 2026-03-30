// supabase/functions/check-push-receipts/index.ts
// Runs every hour at :15. Checks Expo receipts for pending tickets
// and invalidates bad push tokens automatically.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Missing env vars" }), { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: pending, error } = await supabase
    .from("push_tickets")
    .select("id, user_id, expo_push_token, ticket_id")
    .eq("status", "pending")
    .not("ticket_id", "is", null)
    .lt("created_at", cutoff)
    .limit(100);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  if (!pending?.length) {
    return new Response(JSON.stringify({ checked: 0, message: "No pending tickets" }), { status: 200 });
  }

  const ticketIds = pending.map(t => t.ticket_id!);

  const res = await fetch(EXPO_RECEIPTS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ ids: ticketIds }),
  });
  const data = await res.json();
  const receipts = data?.data ?? {};

  const invalidTokens: string[] = [];
  const updates: { id: string; status: string; error_type: string | null }[] = [];

  for (const ticket of pending) {
    const receipt = receipts[ticket.ticket_id!];
    if (!receipt) continue;

    if (receipt.status === "ok") {
      updates.push({ id: ticket.id, status: "ok", error_type: null });
    } else if (receipt.status === "error") {
      const errorType = receipt.details?.error ?? "unknown";
      updates.push({ id: ticket.id, status: "error", error_type: errorType });
      if (errorType === "DeviceNotRegistered") {
        invalidTokens.push(ticket.expo_push_token);
      }
    }
  }

  for (const u of updates) {
    await supabase
      .from("push_tickets")
      .update({ status: u.status, error_type: u.error_type, checked_at: new Date().toISOString() })
      .eq("id", u.id);
  }

  if (invalidTokens.length > 0) {
    await supabase
      .from("push_subscriptions")
      .update({ expo_push_token: null })
      .in("expo_push_token", invalidTokens);
  }

  return new Response(
    JSON.stringify({
      checked: updates.length,
      ok: updates.filter(u => u.status === "ok").length,
      errors: updates.filter(u => u.status === "error").length,
      invalidated_tokens: invalidTokens.length,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});

