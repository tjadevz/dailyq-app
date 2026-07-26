// supabase/functions/send-day2-notification/index.ts
// One-time push sent on day 2 (the day after signup) for users who haven't
// answered yet, with copy specifically about their archive. Fires in the same
// slot window as the user's regular reminder (send-daily-notifications), and
// on success stamps push_subscriptions.last_notified_date so that function
// skips the user for the rest of the day — the day-2 push replaces that day's
// regular reminder rather than stacking a second notification in the same slot.
// Runs 5 minutes ahead of the */30 daily/evening cron ticks (see migration
// 20260726150100) so its last_notified_date write always lands first.
// ?force=true skips the time window (keeps day2/answered-today/sent-once checks).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const SLOTS: Record<string, { hour: number; minute: number }> = {
  morning:   { hour: 7,  minute: 30 },
  afternoon: { hour: 12, minute: 30 },
  evening:   { hour: 21, minute: 0  },
};

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

function toLocalDateStr(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? "0";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function daysBetween(dateStr: string, isoDateStr: string): number {
  const a = new Date(`${dateStr}T00:00:00Z`).getTime();
  const b = new Date(`${isoDateStr}T00:00:00Z`).getTime();
  return Math.floor((a - b) / (1000 * 60 * 60 * 24));
}

// Runs 5 min ahead of the daily-notifications tick, so the window is shifted
// 5 minutes earlier while staying the same 30-min width.
function isInSlotWindowEarly(localHour: number, localMinute: number, slot: { hour: number; minute: number }): boolean {
  const nowMinutes = localHour * 60 + localMinute;
  const slotMinutes = slot.hour * 60 + slot.minute;
  return nowMinutes >= slotMinutes - 5 && nowMinutes < slotMinutes + 25;
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
    .select("user_id, expo_push_token, reminder_time, timezone")
    .not("expo_push_token", "is", null)
    .not("reminder_time", "is", null);

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

  const inWindowSubs: (typeof subs[0] & { _dateStr: string })[] = [];
  for (const sub of subs) {
    const tz = sub.timezone ?? "Europe/Amsterdam";
    const slot = SLOTS[sub.reminder_time];
    if (!slot) continue;
    const { hour, minute, dateStr } = getLocalHourMinute(tz);
    if (!force && !isInSlotWindowEarly(hour, minute, slot)) continue;
    inWindowSubs.push({ ...sub, _dateStr: dateStr });
  }

  if (!inWindowSubs.length) {
    return new Response(
      JSON.stringify({ sent: 0, message: "No users in slot window right now" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const userIds = [...new Set(inWindowSubs.map(s => s.user_id))];

  const { data: profs, error: profsErr } = await supabase
    .from("profiles")
    .select("id, created_at, language, day2_notification_sent")
    .in("id", userIds);

  if (profsErr) {
    return new Response(
      JSON.stringify({ error: profsErr.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const profById: Record<string, { created_at: string | null; language: string | null; day2_notification_sent: boolean | null }> = {};
  for (const p of profs ?? []) profById[p.id] = p;

  const eligibleSubs: (typeof inWindowSubs[0])[] = [];
  for (const sub of inWindowSubs) {
    const prof = profById[sub.user_id];
    if (!prof?.created_at) continue;
    if (prof.day2_notification_sent) continue;

    const tz = sub.timezone ?? "Europe/Amsterdam";
    const createdDateStr = toLocalDateStr(new Date(prof.created_at), tz);
    if (daysBetween(sub._dateStr, createdDateStr) !== 1) continue;

    eligibleSubs.push(sub);
  }

  if (!eligibleSubs.length) {
    return new Response(
      JSON.stringify({ sent: 0, message: "No day-2 eligible users right now" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const eligibleUserIds = [...new Set(eligibleSubs.map(s => s.user_id))];
  const { data: answered } = await supabase
    .from("answers")
    .select("user_id, question_date")
    .in("user_id", eligibleUserIds);
  const answeredDates: Record<string, Set<string>> = {};
  for (const a of answered ?? []) {
    if (!answeredDates[a.user_id]) answeredDates[a.user_id] = new Set();
    answeredDates[a.user_id].add(a.question_date);
  }

  const messages: { to: string; title: string; body: string; userId: string; dateStr: string; token: string }[] = [];
  for (const sub of eligibleSubs) {
    const dateStr = sub._dateStr;
    if (answeredDates[sub.user_id]?.has(dateStr)) continue;
    const lang = profById[sub.user_id]?.language ?? "en";

    const body =
      lang === "nl"
        ? "Dag 2 van je archief. De vraag van vandaag staat klaar"
        : "Day 2 of your archive. Today's question is ready";

    messages.push({
      to: sub.expo_push_token,
      title: "DailyQ",
      body,
      userId: sub.user_id,
      dateStr,
      token: sub.expo_push_token,
    });
  }

  if (!messages.length) {
    return new Response(
      JSON.stringify({ sent: 0, message: "All day-2 eligible users already answered today" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const successful: { userId: string; dateStr: string }[] = [];
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
          successful.push({ userId: m.userId, dateStr: m.dateStr });
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

  for (const s of successful) {
    await supabase
      .from("profiles")
      .update({ day2_notification_sent: true })
      .eq("id", s.userId);
    await supabase
      .from("push_subscriptions")
      .update({ last_notified_date: s.dateStr })
      .eq("user_id", s.userId);
  }

  return new Response(
    JSON.stringify({ sent: successful.length, total: messages.length, force }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
