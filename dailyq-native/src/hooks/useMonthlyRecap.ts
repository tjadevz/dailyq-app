import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

export type RecapData = {
  daysAnswered: number;
  totalDaysInMonth: number;
  jokersUsedThisMonth: number;
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
        return;
      }

      const isDevForceTrigger =
        __DEV__ && (await AsyncStorage.getItem(MONTHLY_RECAP_DEV_TRIGGER_KEY)) === "1";

      if (!isRecapWindow && !isDevForceTrigger) {
        setShowRecap(false);
        setRecapData(null);
        return;
      }

        const { firstDayPrevMonth, lastDayPrevMonth, previousMonthKey, totalDaysInMonth } =
          getPreviousMonthRange(now);
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
          .select("question_date, answer_text, created_at, is_joker")
          .eq("user_id", userId)
          .eq("is_onboarding", false)
          .gte("created_at", prevMonthCreatedAtStartIso)
          .lt("created_at", prevMonthCreatedAtEndExclusiveIso);
        if (monthlyAnswersError) throw monthlyAnswersError;

        const { count: totalAnswersCount, error: totalAnswersError } = await supabase
          .from("answers")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .not("answer_text", "is", null)
          .neq("answer_text", "");
        if (totalAnswersError) throw totalAnswersError;

        const rows =
          (monthlyAnswers as {
            question_date: string;
            answer_text: string | null;
            created_at: string | null;
            is_joker: boolean | null;
          }[] | null) ?? [];

        const daysAnswered = rows.length;
        const jokersUsedThisMonth = rows.filter((row) => row.is_joker === true).length;
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
        const earliestAnswerTime = minTimeOfDayDate
          ? formatTimeHHMM(minTimeOfDayDate.toISOString())
          : "--:--";
        const latestAnswerTime = maxTimeOfDayDate
          ? formatTimeHHMM(maxTimeOfDayDate.toISOString())
          : "--:--";
        const locale = lang === "nl" ? "nl-NL" : "en-US";
        const monthName = new Intl.DateTimeFormat(locale, { month: "long" }).format(
          firstDayPrevMonth
        );

        const nextRecapData: RecapData = {
          daysAnswered,
          totalDaysInMonth,
          jokersUsedThisMonth,
          wordsWrittenThisMonth,
          totalAnswers: totalAnswersCount ?? 0,
          monthsActive: calculateMonthsActive(createdAt, now),
          earliestAnswerTime,
          latestAnswerTime,
          monthName,
          previousMonthKey,
        };

        setRecapData(nextRecapData);
        setShowRecap(true);
    } catch (e) {
      console.error("[MonthlyRecap] Fetch failed:", e);
      setShowRecap(false);
      setRecapData(null);
    } finally {
      // no-op: loading state removed (was never exposed to callers)
    }
    return () => {
      cancelled = true;
    };
  }, [userId, lang, effectiveUser?.created_at]);

  useFocusEffect(
    useCallback(() => {
      void loadRecap();
    }, [loadRecap])
  );

  return { showRecap, recapData, markRecapSeen };
}
