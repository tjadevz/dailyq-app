"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Lang } from "../i18n/translations";
import { supabase } from "../config/supabase";

export type CalendarAnswerEntry = {
  questionText: string;
  answerText: string;
  isJoker?: boolean;
};

/** Cache key: "YYYY-MM". Value: map of day key (YYYY-MM-DD) -> entry */
type Cache = Record<string, Map<string, CalendarAnswerEntry>>;

type CalendarAnswersContextValue = {
  /** Optimistic update: set an answer for a day (e.g. after saving on Today tab). */
  setAnswerForDay: (dayKey: string, entry: CalendarAnswerEntry) => void;
  /** Clear entire cache (e.g. on account switch). */
  clearCache: () => void;
  getCacheForMonth: (yearMonth: string) => Map<string, CalendarAnswerEntry> | null;
  setCacheForMonth: (yearMonth: string, map: Map<string, CalendarAnswerEntry>) => void;
};

const CalendarAnswersContext = createContext<CalendarAnswersContextValue | null>(
  null
);

function yearMonthFromDayKey(dayKey: string): string {
  return dayKey.slice(0, 7);
}

export function CalendarAnswersProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [cache, setCache] = useState<Cache>({});

  const setAnswerForDayInCache = useCallback(
    (dayKey: string, entry: CalendarAnswerEntry) => {
      const ym = yearMonthFromDayKey(dayKey);
      setCache((prev) => {
        const next = { ...prev };
        const map = new Map(next[ym] ?? []);
        map.set(dayKey, entry);
        next[ym] = map;
        return next;
      });
    },
    []
  );

  const setCacheForMonth = useCallback((yearMonth: string, map: Map<string, CalendarAnswerEntry>) => {
    setCache((prev) => ({ ...prev, [yearMonth]: map }));
  }, []);

  const clearCache = useCallback(() => setCache({}), []);

  const getCacheForMonth = useCallback((yearMonth: string) => {
    return cache[yearMonth] ?? null;
  }, [cache]);

  const value: CalendarAnswersContextValue = {
    setAnswerForDay: setAnswerForDayInCache,
    clearCache,
    getCacheForMonth,
    setCacheForMonth,
  };

  return (
    <CalendarAnswersContext.Provider value={value}>
      {children}
    </CalendarAnswersContext.Provider>
  );
}

export function useCalendarAnswersContext(): CalendarAnswersContextValue {
  const ctx = useContext(CalendarAnswersContext);
  if (!ctx) {
    throw new Error(
      "useCalendarAnswersContext must be used within CalendarAnswersProvider"
    );
  }
  return ctx;
}

/** Top-level hook: must be used unconditionally (Rules of Hooks). Use cache for shared state; loading/error/local state live here. */
export function useCalendarAnswers(
  userId: string | null,
  yearMonth: string,
  lang: Lang
): {
  answersMap: Map<string, CalendarAnswerEntry>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  setAnswerForDay: (dayKey: string, entry: CalendarAnswerEntry) => void;
} {
  const {
    setAnswerForDay: setAnswerForDayInCache,
    clearCache,
    getCacheForMonth,
    setCacheForMonth,
  } = useCalendarAnswersContext();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevUserIdRef = useRef<string | null>(userId);
  const [localMap, setLocalMap] = useState<Map<string, CalendarAnswerEntry>>(
    () => new Map()
  );
  const cached = getCacheForMonth(yearMonth);
  const answersMap = cached ?? localMap;

  /** Fetches answers + questions for a month in parallel; returns map (does not set loading/cache). */
  const fetchMonthData = useCallback(
    async (
      uid: string,
      ym: string,
      langParam: Lang
    ): Promise<Map<string, CalendarAnswerEntry>> => {
      const [y, m] = ym.split("-").map(Number);
      const startStr = `${ym}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const endStr = `${ym}-${String(lastDay).padStart(2, "0")}`;

      const questionTable = langParam === "en" ? "daily_questions_en" : "questions";
      const questionDateCol = langParam === "en" ? "question_date" : "day";
      const questionTextCol = langParam === "en" ? "question_text" : "text";

      const [answersResult, questionsResult] = await Promise.all([
        supabase
          .from("answers")
          .select("question_date, answer_text, is_joker")
          .eq("user_id", uid)
          .gte("question_date", startStr)
          .lte("question_date", endStr),
        supabase
          .from(questionTable)
          .select(`${questionDateCol}, ${questionTextCol}`)
          .gte(questionDateCol, startStr)
          .lte(questionDateCol, endStr),
      ]);

      if (answersResult.error) throw answersResult.error;

      const dayToText = new Map<string, string>();
      const questionsData = questionsResult.data;
      if (questionsData) {
        for (const row of questionsData as {
          question_date?: string;
          day?: string;
          question_text?: string;
          text?: string;
        }[]) {
          const day = questionDateCol === "question_date" ? row.question_date : row.day;
          const text = questionTextCol === "question_text" ? row.question_text : row.text;
          if (day) dayToText.set(day, text ?? "");
        }
      }

      const map = new Map<string, CalendarAnswerEntry>();
      const answersData = answersResult.data;
      if (answersData) {
        for (const row of answersData as {
          question_date: string;
          answer_text: string | null;
          is_joker?: boolean;
        }[]) {
          const day = row.question_date;
          map.set(day, {
            questionText: dayToText.get(day) ?? "",
            answerText: row.answer_text ?? "",
            isJoker: row.is_joker === true,
          });
        }
      }
      return map;
    },
    []
  );

  const fetchMonth = useCallback(async () => {
    if (!userId || userId === "dev-user") {
      if (userId === "dev-user") {
        const mock = new Map<string, CalendarAnswerEntry>();
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const twoDaysAgo = new Date(today);
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        const format = (d: Date) => d.toISOString().slice(0, 10);
        mock.set(format(yesterday), {
          questionText: "Mock question yesterday",
          answerText: "Mock answer",
        });
        mock.set(format(twoDaysAgo), {
          questionText: "Mock question 2 days ago",
          answerText: "Joker answer",
          isJoker: true,
        });
        setLocalMap(mock);
        setCacheForMonth(yearMonth, mock);
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const map = await fetchMonthData(userId, yearMonth, lang);
      setLocalMap(map);
      setCacheForMonth(yearMonth, map);

      // Prefetch adjacent months in background (no loading state)
      const [y, m] = yearMonth.split("-").map(Number);
      const prevYm = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
      const nextYm = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
      for (const ym of [prevYm, nextYm]) {
        if (getCacheForMonth(ym) != null) continue;
        fetchMonthData(userId, ym, lang)
          .then((adjacentMap) => setCacheForMonth(ym, adjacentMap))
          .catch(() => {});
      }
    } catch (e) {
      console.error("Calendar answers fetch error:", e);
      setError("calendar_error_load");
    } finally {
      setLoading(false);
    }
  }, [userId, yearMonth, lang, setCacheForMonth, fetchMonthData, getCacheForMonth]);

  useEffect(() => {
    // Guarantee fresh fetch when userId becomes available after mount (was null/undefined).
    const prevUserId = prevUserIdRef.current;
    const userIdJustAvailable = Boolean(userId) && !prevUserId;
    if (userIdJustAvailable || prevUserId !== userId) {
      prevUserIdRef.current = userId;
      clearCache();
      fetchMonth();
      return;
    }
    const existing = getCacheForMonth(yearMonth);
    if (existing != null) {
      setLocalMap(existing);
      setLoading(false);
      return;
    }
    // Stale-while-revalidate: show empty grid for this month immediately, then fetch in background
    setLocalMap(new Map());
    fetchMonth();
  }, [yearMonth, userId, lang, clearCache, getCacheForMonth, fetchMonth]);

  const refetch = useCallback(() => fetchMonth(), [fetchMonth]);

  return {
    answersMap,
    loading,
    error,
    refetch,
    setAnswerForDay: setAnswerForDayInCache,
  };
}
