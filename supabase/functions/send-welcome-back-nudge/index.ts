// supabase/functions/send-welcome-back-nudge/index.ts
// Sends a one-time "welcome back" push + joker offer nudge to users who
// haven't answered in >= 3 days. No fixed time-of-day window (yet) — this
// function is meant to be triggered manually until a cron schedule is added
// once a send day/time is decided.
//
// Dedup is per absence period, not per day: welcome_back_nudge_sent_for
// mirrors profiles.last_answered_date at send time, so re-running this
// function never double-sends for the same gap. On a successful send we also
// stamp last_notified_date / last_evening_reminder_date with today's local
// date so the existing daily/evening reminder functions skip that user for
// the rest of the day (no double-ping).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const MIN_DAYS_ABSENT = 3;

function getLocalDateStr(timezone: string): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? "0";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function daysBetween(dateStr: string, isoDateStr: string): number {
  const a = new Date(`${dateStr}T00:00:00Z`).getTime();
  const b = new Date(`${isoDateStr}T00:00:00Z`).getTime();
  return Math.floor((a - b) / (1000 * 60 * 60 * 24));
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

  const { data: subs, error: subsErr } = await supabase
    .from("push_subscriptions")
    .select("user_id, expo_push_token, timezone, welcome_back_nudge_sent_for")
    .not("expo_push_token", "is", null);

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

  const userIds = [...new Set(subs.map(s => s.user_id))];

  const { data: profs, error: profsErr } = await supabase
    .from("profiles")
    .select("id, language, last_answered_date")
    .in("id", userIds);

  if (profsErr) {
    return new Response(
      JSON.stringify({ error: profsErr.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const profById: Record<string, { language: string | null; last_answered_date: string | null }> = {};
  for (const p of profs ?? []) profById[p.id] = p;

  type Eligible = {
    user_id: string;
    expo_push_token: string;
    dateStr: string;
    lastAnsweredDate: string;
    daysAbsent: number;
  };

  const eligible: Eligible[] = [];
  for (const sub of subs) {
    const prof = profById[sub.user_id];
    if (!prof?.last_answered_date) continue;

    const tz = sub.timezone ?? "Europe/Amsterdam";
    const dateStr = getLocalDateStr(tz);
    const daysAbsent = daysBetween(dateStr, prof.last_answered_date);
    if (daysAbsent < MIN_DAYS_ABSENT) continue;

    // Already nudged for this exact absence period.
    if (sub.welcome_back_nudge_sent_for === prof.last_answered_date) continue;

    eligible.push({
      user_id: sub.user_id,
      expo_push_token: sub.expo_push_token,
      dateStr,
      lastAnsweredDate: prof.last_answered_date,
      daysAbsent,
    });
  }

  if (!eligible.length) {
    return new Response(
      JSON.stringify({ sent: 0, message: "No eligible absent users right now" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const messages = eligible.map(e => {
    const lang = profById[e.user_id]?.language ?? "en";
    const body =
      lang === "nl"
        ? "Paar dagen gemist? Hier zijn wat extra jokers!"
        : "Missed a few days? Here are some extra jokers!";
    return { to: e.expo_push_token, title: "DailyQ", body, entry: e };
  });

  const successful: Eligible[] = [];
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
          successful.push(m.entry);
          ticketRows.push({
            user_id: m.entry.user_id,
            expo_push_token: m.entry.expo_push_token,
            ticket_id: t.id ?? null,
            status: "pending",
            error_type: null,
          });
        } else {
          ticketRows.push({
            user_id: m.entry.user_id,
            expo_push_token: m.entry.expo_push_token,
            ticket_id: null,
            status: "error",
            error_type: t?.details?.error ?? t?.message ?? "unknown",
          });
        }
      });
    } catch (e) {
      for (const m of chunk) {
        ticketRows.push({
          user_id: m.entry.user_id,
          expo_push_token: m.entry.expo_push_token,
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

  for (const e of successful) {
    await supabase
      .from("push_subscriptions")
      .update({
        welcome_back_nudge_sent_for: e.lastAnsweredDate,
        last_notified_date: e.dateStr,
        last_evening_reminder_date: e.dateStr,
      })
      .eq("user_id", e.user_id);
  }

  return new Response(
    JSON.stringify({ sent: successful.length, total: messages.length }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
