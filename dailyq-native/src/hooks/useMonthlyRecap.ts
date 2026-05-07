import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

export type RecapData = {
  daysAnswered: number;
  totalDaysInMonth: number;
  longestStreakThisMonth: number;
  wordsWrittenThisMonth: number;
  totalAnswers: number;
  monthsActive: number;
  earliestAnswerTime: string;
  latestAnswerTime: string;
  monthName: string;
  previousMonthKey: string;
};

type MonthlyRecapHook = {
  showRecap: boolean;
  recapData: RecapData | null;
  markRecapSeen: (previousMonthKey: string) => Promise<void>;
};

type ProfileRecapRow = {
  created_at: string | null;
  last_monthly_recap_shown: string | null;
};

const MONTHLY_RECAP_DEV_TRIGGER_KEY = "dailyq-dev-force-monthly-recap";

function toDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getPreviousMonthRange(now: Date): {
  firstDayPrevMonth: Date;
  lastDayPrevMonth: Date;
  previousMonthKey: string;
  totalDaysInMonth: number;
} {
  const firstOfCurrent = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstDayPrevMonth = new Date(firstOfCurrent.getFullYear(), firstOfCurrent.getMonth() - 1, 1);
  const lastDayPrevMonth = new Date(firstOfCurrent.getFullYear(), firstOfCurrent.getMonth(), 0);

  return {
    firstDayPrevMonth,
    lastDayPrevMonth,
    previousMonthKey: `${firstDayPrevMonth.getFullYear()}-${String(
      firstDayPrevMonth.getMonth() + 1
    ).padStart(2, "0")}-01`,
    totalDaysInMonth: lastDayPrevMonth.getDate(),
  };
}

function isCreatedMoreThan30DaysAgo(createdAt: string | null, now: Date): boolean {
  if (!createdAt) return false;
  const createdDate = new Date(createdAt);
  if (!Number.isFinite(createdDate.getTime())) return false;
  const diffMs = now.getTime() - createdDate.getTime();
  return diffMs > 1 * 24 * 60 * 60 * 1000;
}

function calculateLongestStreak(questionDates: string[]): number {
  if (questionDates.length === 0) return 0;

  const uniqueSorted = Array.from(new Set(questionDates)).sort((a, b) =>
    a.localeCompare(b)
  );

  let longest = 1;
  let current = 1;

  for (let i = 1; i < uniqueSorted.length; i += 1) {
    const prev = new Date(`${uniqueSorted[i - 1]}T00:00:00`);
    const curr = new Date(`${uniqueSorted[i]}T00:00:00`);
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000));
    if (diffDays === 1) {
      current += 1;
      if (current > longest) longest = current;
    } else {
      current = 1;
    }
  }

  return longest;
}

function countWords(text: string | null): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function calculateMonthsActive(createdAt: string | null, now: Date): number {
  if (!createdAt) return 1;
  const createdDate = new Date(createdAt);
  if (!Number.isFinite(createdDate.getTime())) return 1;

  let months =
    (now.getFullYear() - createdDate.getFullYear()) * 12 +
    (now.getMonth() - createdDate.getMonth());
  if (now.getDate() < createdDate.getDate()) {
    months -= 1;
  }
  return Math.max(1, months);
}

function formatTimeHHMM(value: string): string {
  const dt = new Date(value);
  if (!Number.isFinite(dt.getTime())) return "--:--";
  const hh = String(dt.getHours()).padStart(2, "0");
  const mm = String(dt.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function useMonthlyRecap(): MonthlyRecapHook {
  const { effectiveUser } = useAuth();
  const { lang } = useLanguage();
  const userId = effectiveUser?.id ?? null;

  const [showRecap, setShowRecap] = useState(false);
  const [recapData, setRecapData] = useState<RecapData | null>(null);
  const [, setLoading] = useState(false);
  const [, setError] = useState<string | null>(null);

  const markRecapSeen = useCallback(
    async (previousMonthKey: string) => {
      if (!userId || userId === "dev-user") return;
      const { error } = await supabase
        .from("profiles")
        .update({ last_monthly_recap_shown: previousMonthKey })
        .eq("id", userId);
      if (error) {
        console.error("[MonthlyRecap] Failed to mark recap seen:", error);
        throw error;
      }
      setShowRecap(false);
    },
    [userId]
  );

  const loadRecap = useCallback(async () => {
    let cancelled = false;
    try {
      const now = new Date();
      const dayOfMonth = now.getDate();
      const isRecapWindow = dayOfMonth >= 1 && dayOfMonth <= 7;

      if (!userId || userId === "dev-user") {
        setShowRecap(false);
        setRecapData(null);
        setLoading(false);
        setError(null);
        return;
      }

      const isDevForceTrigger =
        __DEV__ && (await AsyncStorage.getItem(MONTHLY_RECAP_DEV_TRIGGER_KEY)) === "1";

      if (!isRecapWindow && !isDevForceTrigger) {
        setShowRecap(false);
        setRecapData(null);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

        const { firstDayPrevMonth, lastDayPrevMonth, previousMonthKey, totalDaysInMonth } =
          getPreviousMonthRange(now);
        const prevMonthStartKey = toDayKey(firstDayPrevMonth);
        const prevMonthEndKey = toDayKey(lastDayPrevMonth);
        const prevMonthCreatedAtStartIso = new Date(
          firstDayPrevMonth.getFullYear(),
          firstDayPrevMonth.getMonth(),
          firstDayPrevMonth.getDate(),
          0,
          0,
          0,
          0
        ).toISOString();
        const prevMonthCreatedAtEndExclusiveIso = new Date(
          lastDayPrevMonth.getFullYear(),
          lastDayPrevMonth.getMonth(),
          lastDayPrevMonth.getDate() + 1,
          0,
          0,
          0,
          0
        ).toISOString();

        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("created_at, last_monthly_recap_shown")
          .eq("id", userId)
          .maybeSingle<ProfileRecapRow>();

        if (profileError) throw profileError;

        const createdAt = profileData?.created_at ?? effectiveUser?.created_at ?? null;
        const lastShown = profileData?.last_monthly_recap_shown ?? null;

        const accountOldEnough = isCreatedMoreThan30DaysAgo(createdAt, now);
        const recapNotShownForPrevMonth = lastShown == null || lastShown !== previousMonthKey;

        const shouldShow =
          isDevForceTrigger || (accountOldEnough && recapNotShownForPrevMonth);

        if (!shouldShow) {
          setShowRecap(false);
          setRecapData(null);
          return;
        }

        const { data: monthlyAnswers, error: monthlyAnswersError } = await supabase
          .from("answers")
          .select("question_date, answer_text, created_at")
          .eq("user_id", userId)
          .eq("is_onboarding", false)
          .gte("created_at", prevMonthCreatedAtStartIso)
          .lt("created_at", prevMonthCreatedAtEndExclusiveIso);
        if (monthlyAnswersError) throw monthlyAnswersError;

        const { data: totalAnswersData, error: totalAnswersError } = await supabase
          .from("answers")
          .select("answer_text")
          .eq("user_id", userId)
          .not("answer_text", "is", null);
        if (totalAnswersError) throw totalAnswersError;
        const totalAnswersCount =
          ((totalAnswersData as { answer_text: string | null }[] | null) ?? []).filter((row) =>
            Boolean(row.answer_text?.trim())
          ).length;

        const rows =
          (monthlyAnswers as {
            question_date: string;
            answer_text: string | null;
            created_at: string | null;
          }[] | null) ?? [];
        // #region agent log
        fetch("http://127.0.0.1:7729/ingest/db237dc3-2932-4821-b603-b2959e85e2e1",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"c9dba5"},body:JSON.stringify({sessionId:"c9dba5",runId:"pre-fix",hypothesisId:"H2_H3",location:"useMonthlyRecap.ts:rows",message:"Monthly recap answer rows loaded",data:{userId,rowCount:rows.length,prevMonthStartKey,prevMonthEndKey,sample:rows.slice(0,10).map((r)=>({question_date:r.question_date,created_at:r.created_at}))},timestamp:Date.now()})}).catch(()=>{});
        // #endregion

        const daysAnswered = rows.length;
        const longestStreakThisMonth = calculateLongestStreak(rows.map((r) => r.question_date));
        const wordsWrittenThisMonth = rows.reduce(
          (sum, row) => sum + countWords(row.answer_text),
          0
        );
        const monthAnswerDates = rows
          .map((row) => row.created_at)
          .filter((value): value is string => Boolean(value))
          .map((value) => new Date(value))
          .filter((dt) => Number.isFinite(dt.getTime()));
        const minTimeOfDayDate = monthAnswerDates.reduce<Date | null>((acc, dt) => {
          const mins = dt.getHours() * 60 + dt.getMinutes();
          if (!acc) return dt;
          const accMins = acc.getHours() * 60 + acc.getMinutes();
          return mins < accMins ? dt : acc;
        }, null);
        const maxTimeOfDayDate = monthAnswerDates.reduce<Date | null>((acc, dt) => {
          const mins = dt.getHours() * 60 + dt.getMinutes();
          if (!acc) return dt;
          const accMins = acc.getHours() * 60 + acc.getMinutes();
          return mins > accMins ? dt : acc;
        }, null);
        const earliestDate = monthAnswerDates.reduce<Date | null>((acc, dt) => {
          if (!acc) return dt;
          return dt.getTime() < acc.getTime() ? dt : acc;
        }, null);
        const latestDate = monthAnswerDates.reduce<Date | null>((acc, dt) => {
          if (!acc) return dt;
          return dt.getTime() > acc.getTime() ? dt : acc;
        }, null);
        // #region agent log
        fetch("http://127.0.0.1:7729/ingest/db237dc3-2932-4821-b603-b2959e85e2e1",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"c9dba5"},body:JSON.stringify({sessionId:"c9dba5",runId:"pre-fix",hypothesisId:"H1_H4",location:"useMonthlyRecap.ts:time-comparison",message:"Compare timestamp-based vs time-of-day-based bounds",data:{timestampEarliest:earliestDate?{iso:earliestDate.toISOString(),hhmm:`${String(earliestDate.getHours()).padStart(2,"0")}:${String(earliestDate.getMinutes()).padStart(2,"0")}`}:null,timestampLatest:latestDate?{iso:latestDate.toISOString(),hhmm:`${String(latestDate.getHours()).padStart(2,"0")}:${String(latestDate.getMinutes()).padStart(2,"0")}`}:null,timeOfDayEarliest:minTimeOfDayDate?{iso:minTimeOfDayDate.toISOString(),hhmm:`${String(minTimeOfDayDate.getHours()).padStart(2,"0")}:${String(minTimeOfDayDate.getMinutes()).padStart(2,"0")}`}:null,timeOfDayLatest:maxTimeOfDayDate?{iso:maxTimeOfDayDate.toISOString(),hhmm:`${String(maxTimeOfDayDate.getHours()).padStart(2,"0")}:${String(maxTimeOfDayDate.getMinutes()).padStart(2,"0")}`}:null},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        const earliestAnswerTime = minTimeOfDayDate
          ? formatTimeHHMM(minTimeOfDayDate.toISOString())
          : "--:--";
        const latestAnswerTime = maxTimeOfDayDate
          ? formatTimeHHMM(maxTimeOfDayDate.toISOString())
          : "--:--";
        // #region agent log
        fetch("http://127.0.0.1:7729/ingest/db237dc3-2932-4821-b603-b2959e85e2e1",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"c9dba5"},body:JSON.stringify({sessionId:"c9dba5",runId:"pre-fix",hypothesisId:"H1_H2_H4",location:"useMonthlyRecap.ts:final-times",message:"Final recap times emitted",data:{earliestAnswerTime,latestAnswerTime},timestamp:Date.now()})}).catch(()=>{});
        // #endregion

        const locale = lang === "nl" ? "nl-NL" : "en-US";
        const monthName = new Intl.DateTimeFormat(locale, { month: "long" }).format(
          firstDayPrevMonth
        );

        const nextRecapData: RecapData = {
          daysAnswered,
          totalDaysInMonth,
          longestStreakThisMonth,
          wordsWrittenThisMonth,
          totalAnswers: totalAnswersCount,
          monthsActive: calculateMonthsActive(createdAt, now),
          earliestAnswerTime,
          latestAnswerTime,
          monthName,
          previousMonthKey,
        };

        setRecapData(nextRecapData);
        setShowRecap(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load monthly recap";
      console.error("[MonthlyRecap] Fetch failed:", e);
      setError(message);
      setShowRecap(false);
      setRecapData(null);
    } finally {
      if (!cancelled) {
        setLoading(false);
      }
    }
    return () => {
      cancelled = true;
    };
  }, [userId, lang, effectiveUser?.created_at]);

  useEffect(() => {
    void loadRecap();
  }, [loadRecap]);

  useFocusEffect(
    useCallback(() => {
      void loadRecap();
    }, [loadRecap])
  );

  return { showRecap, recapData, markRecapSeen };
}
