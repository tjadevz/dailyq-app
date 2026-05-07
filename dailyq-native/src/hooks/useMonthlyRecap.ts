import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
  return diffMs > 30 * 24 * 60 * 60 * 1000;
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

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const now = new Date();
      const dayOfMonth = now.getDate();
      const isRecapWindow = dayOfMonth >= 1 && dayOfMonth <= 7;

      if (!userId || userId === "dev-user") {
        if (!cancelled) {
          setShowRecap(false);
          setRecapData(null);
          setLoading(false);
          setError(null);
        }
        return;
      }

      const isDevForceTrigger =
        __DEV__ && (await AsyncStorage.getItem(MONTHLY_RECAP_DEV_TRIGGER_KEY)) === "1";

      if (!isRecapWindow && !isDevForceTrigger) {
        if (!cancelled) {
          setShowRecap(false);
          setRecapData(null);
          setLoading(false);
          setError(null);
        }
        return;
      }

      if (!cancelled) {
        setLoading(true);
        setError(null);
      }

      try {
        const { firstDayPrevMonth, lastDayPrevMonth, previousMonthKey, totalDaysInMonth } =
          getPreviousMonthRange(now);
        const prevMonthStartKey = toDayKey(firstDayPrevMonth);
        const prevMonthEndKey = toDayKey(lastDayPrevMonth);

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
          if (!cancelled) {
            setShowRecap(false);
            setRecapData(null);
          }
          return;
        }

        const { data: monthlyAnswers, error: monthlyAnswersError } = await supabase
          .from("answers")
          .select("question_date, answer_text")
          .eq("user_id", userId)
          .eq("is_onboarding", false)
          .gte("question_date", prevMonthStartKey)
          .lte("question_date", prevMonthEndKey);
        if (monthlyAnswersError) throw monthlyAnswersError;

        const { count: totalAnswersCount, error: totalAnswersError } = await supabase
          .from("answers")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("is_onboarding", false);
        if (totalAnswersError) throw totalAnswersError;

        const rows =
          (monthlyAnswers as { question_date: string; answer_text: string | null }[] | null) ?? [];

        const daysAnswered = rows.length;
        const longestStreakThisMonth = calculateLongestStreak(rows.map((r) => r.question_date));
        const wordsWrittenThisMonth = rows.reduce(
          (sum, row) => sum + countWords(row.answer_text),
          0
        );

        const locale = lang === "nl" ? "nl-NL" : "en-US";
        const monthName = new Intl.DateTimeFormat(locale, { month: "long" }).format(
          firstDayPrevMonth
        );

        const nextRecapData: RecapData = {
          daysAnswered,
          totalDaysInMonth,
          longestStreakThisMonth,
          wordsWrittenThisMonth,
          totalAnswers: totalAnswersCount ?? 0,
          monthsActive: calculateMonthsActive(createdAt, now),
          monthName,
          previousMonthKey,
        };

        if (!cancelled) {
          setRecapData(nextRecapData);
          setShowRecap(true);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to load monthly recap";
        console.error("[MonthlyRecap] Fetch failed:", e);
        if (!cancelled) {
          setError(message);
          setShowRecap(false);
          setRecapData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [userId, lang, effectiveUser?.created_at]);

  return { showRecap, recapData, markRecapSeen };
}
