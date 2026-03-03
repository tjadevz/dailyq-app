// supabase/functions/send-daily-notifications/index.ts
// Sends daily Expo push notifications. Call with ?time_slot=morning|afternoon|evening
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const VALID_SLOTS = ["morning", "afternoon", "evening"] as const;

function getTodayEuropeAmsterdam(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Amsterdam" });
}

function getBody(lang: string | null): string {
  return lang === "nl" ? "Je DailyQ staat klaar!" : "Your DailyQ is ready!";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const timeSlot = url.searchParams.get("time_slot");
  if (!timeSlot || !VALID_SLOTS.includes(timeSlot as (typeof VALID_SLOTS)[number])) {
    return new Response(
      JSON.stringify({ error: "Missing or invalid time_slot (use morning, afternoon, or evening)" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const today = getTodayEuropeAmsterdam();

  // 1) Subscriptions with expo_push_token and reminder_time = time_slot
  const { data: subs, error: subsErr } = await supabase
    .from("push_subscriptions")
    .select("user_id, expo_push_token")
    .not("expo_push_token", "is", null)
    .eq("reminder_time", timeSlot);

  if (subsErr) {
    return new Response(
      JSON.stringify({ error: subsErr.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  if (!subs?.length) {
    return new Response(
      JSON.stringify({ sent: 0, message: "No subscriptions for this slot" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 2) Language per user from profiles
  const userIds = [...new Set(subs.map((s) => s.user_id))];
  const { data: profs } = await supabase
    .from("profiles")
    .select("id, language")
    .in("id", userIds);
  const langByUser: Record<string, string> = {};
  for (const p of profs ?? []) {
    langByUser[p.id] = p.language ?? "en";
  }

  // 3) User ids who already answered today (answers.question_date = today)
  const { data: answered } = await supabase
    .from("answers")
    .select("user_id")
    .eq("question_date", today)
    .in("user_id", userIds);
  const answeredSet = new Set((answered ?? []).map((a) => a.user_id));

  // 4) Build messages for users who have not answered
  const messages: { to: string; title: string; body: string }[] = [];
  for (const row of subs) {
    if (answeredSet.has(row.user_id)) continue;
    const token = row.expo_push_token;
    if (!token) continue;
    const lang = langByUser[row.user_id] ?? "en";
    messages.push({
      to: token,
      title: "DailyQ",
      body: getBody(lang),
    });
  }

  // 5) Send to Expo (batch up to 100 per request)
  const results: { to: string; ok: boolean; error?: string }[] = [];
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(chunk),
      });
      const data = await res.json();
      if (!res.ok) {
        for (const m of chunk) {
          results.push({ to: m.to, ok: false, error: data?.message ?? res.statusText });
        }
        continue;
      }
      // Expo returns { data: [ { status: 'ok', id: '...' }, ... ] }
      const tickets = Array.isArray(data?.data) ? data.data : [];
      chunk.forEach((m, j) => {
        const t = tickets[j];
        const ok = t?.status === "ok";
        results.push({ to: m.to, ok, error: ok ? undefined : (t?.message ?? "Unknown") });
      });
    } catch (e) {
      for (const m of chunk) {
        results.push({ to: m.to, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }
  }

  const sent = results.filter((r) => r.ok).length;
  return new Response(
    JSON.stringify({ sent, total: messages.length, results }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
