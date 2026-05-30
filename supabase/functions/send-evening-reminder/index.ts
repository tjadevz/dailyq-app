// supabase/functions/send-evening-reminder/index.ts
// Runs every 30 min via cron. Sends an evening reminder at 21:00 local time to users
// with reminder_time morning or afternoon who have not answered today's question.
// ?force=true skips the time window (keeps answered-today and dedup checks).
// Saves Expo ticket IDs to push_tickets for receipt verification.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const EVENING_SLOT = { hour: 21, minute: 0 };

function getLocalHourMinute(timezone: string): { hour: number; minute: number; dateStr: string } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const get = (type: string) => parts.find(p => p.type === type)?.value ?? "0";
  const dateStr = `${get("year")}-${get("month")}-${get("day")}`;
  const hour = parseInt(get("hour"), 10);
  const minute = parseInt(get("minute"), 10);
  return { hour, minute, dateStr };
}

function isInSlotWindow(localHour: number, localMinute: number, slot: { hour: number; minute: number }): boolean {
  const nowMinutes = localHour * 60 + localMinute;
  const slotMinutes = slot.hour * 60 + slot.minute;
  return nowMinutes >= slotMinutes && nowMinutes < slotMinutes + 30;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: "Missing env vars" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const force = new URL(req.url).searchParams.get("force") === "true";

  const { data: subs, error: subsErr } = await supabase
    .from("push_subscriptions")
    .select("user_id, expo_push_token, reminder_time, timezone, last_evening_reminder_date")
    .not("expo_push_token", "is", null)
    .in("reminder_time", ["morning", "afternoon"]);

  if (subsErr) {
    return new Response(
      JSON.stringify({ error: subsErr.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  if (!subs?.length) {
    return new Response(
      JSON.stringify({ sent: 0, message: "No subscriptions" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const eligibleSubs: (typeof subs[0] & { _dateStr: string })[] = [];
  for (const sub of subs) {
    const tz = sub.timezone ?? "Europe/Amsterdam";
    const { hour, minute, dateStr } = getLocalHourMinute(tz);
    if (sub.last_evening_reminder_date === dateStr) continue;
    if (!force && !isInSlotWindow(hour, minute, EVENING_SLOT)) continue;
    eligibleSubs.push({ ...sub, _dateStr: dateStr });
  }

  if (!eligibleSubs.length) {
    return new Response(
      JSON.stringify({ sent: 0, message: "No users in evening reminder window right now" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const userIds = [...new Set(eligibleSubs.map(s => s.user_id))];

  const { data: profs } = await supabase
    .from("profiles")
    .select("id, language")
    .in("id", userIds);
  const langByUser: Record<string, string> = {};
  for (const p of profs ?? []) langByUser[p.id] = p.language ?? "en";

  const { data: answered } = await supabase
    .from("answers")
    .select("user_id, question_date")
    .in("user_id", userIds);
  const answeredDates: Record<string, Set<string>> = {};
  for (const a of answered ?? []) {
    if (!answeredDates[a.user_id]) answeredDates[a.user_id] = new Set();
    answeredDates[a.user_id].add(a.question_date);
  }

  const messages: { to: string; title: string; body: string; userId: string; dateStr: string; token: string }[] = [];
  for (const sub of eligibleSubs) {
    const dateStr = sub._dateStr;
    if (answeredDates[sub.user_id]?.has(dateStr)) continue;
    const lang = langByUser[sub.user_id] ?? "en";

    const body =
      lang === "nl"
        ? "De vraag van vandaag wacht nog op je."
        : "Today's question is still waiting for you.";

    messages.push({
      to: sub.expo_push_token,
      title: "DailyQ",
      body: body,
      userId: sub.user_id,
      dateStr,
      token: sub.expo_push_token,
    });
  }

  if (!messages.length) {
    return new Response(
      JSON.stringify({ sent: 0, message: "All eligible users already answered today" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const successfulUserIds: string[] = [];
  const ticketRows: { user_id: string; expo_push_token: string; ticket_id: string | null; status: string; error_type: string | null }[] = [];

  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(chunk.map(m => ({ to: m.to, title: m.title, body: m.body }))),
      });
      const data = await res.json();
      const tickets = Array.isArray(data?.data) ? data.data : [];

      chunk.forEach((m, j) => {
        const t = tickets[j];
        const ok = t?.status === "ok";
        if (ok) {
          successfulUserIds.push(m.userId);
          ticketRows.push({
            user_id: m.userId,
            expo_push_token: m.token,
            ticket_id: t.id ?? null,
            status: "pending",
            error_type: null,
          });
        } else {
          ticketRows.push({
            user_id: m.userId,
            expo_push_token: m.token,
            ticket_id: null,
            status: "error",
            error_type: t?.details?.error ?? t?.message ?? "unknown",
          });
        }
      });
    } catch (e) {
      for (const m of chunk) {
        ticketRows.push({
          user_id: m.userId,
          expo_push_token: m.token,
          ticket_id: null,
          status: "error",
          error_type: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  if (ticketRows.length > 0) {
    await supabase.from("push_tickets").insert(ticketRows);
  }

  if (successfulUserIds.length > 0) {
    const byDate: Record<string, string[]> = {};
    for (const m of messages) {
      if (successfulUserIds.includes(m.userId)) {
        if (!byDate[m.dateStr]) byDate[m.dateStr] = [];
        byDate[m.dateStr].push(m.userId);
      }
    }
    for (const [dateStr, ids] of Object.entries(byDate)) {
      await supabase
        .from("push_subscriptions")
        .update({ last_evening_reminder_date: dateStr })
        .in("user_id", ids);
    }
  }

  const sent = successfulUserIds.length;
  return new Response(
    JSON.stringify({ sent, total: messages.length, force }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
