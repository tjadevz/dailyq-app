"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
  /** Get or populate cache for this month; returns map, loading, error, refetch, and setAnswerForDay. */
  useCalendarAnswers: (
    userId: string | null,
    yearMonth: string,
    lang: Lang
  ) => {
    answersMap: Map<string, CalendarAnswerEntry>;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
    setAnswerForDay: (
      dayKey: string,
      entry: CalendarAnswerEntry
    ) => void;
  };
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

  const getCacheForMonth = useCallback((yearMonth: string) => {
    return cache[yearMonth] ?? null;
  }, [cache]);

  const useCalendarAnswers = useCallback(
    (
      userId: string | null,
      yearMonth: string,
      lang: Lang
    ): {
      answersMap: Map<string, CalendarAnswerEntry>;
      loading: boolean;
      error: string | null;
      refetch: () => Promise<void>;
      setAnswerForDay: (dayKey: string, entry: CalendarAnswerEntry) => void;
    } => {
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState<string | null>(null);
      const cached = getCacheForMonth(yearMonth);
      const [localMap, setLocalMap] = useState<Map<string, CalendarAnswerEntry>>(
        new Map()
      );
      const answersMap = cached ?? localMap;

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
          const [y, m] = yearMonth.split("-").map(Number);
          const start = new Date(y, m - 1, 1);
          const end = new Date(y, m, 0);
          const startStr = start.toISOString().slice(0, 10);
          const endStr = end.toISOString().slice(0, 10);

          // 1) Answers for month: filter by user_id and question_date range
          const { data: answersData, error: answersError } = await supabase
            .from("answers")
            .select("question_date, answer_text, is_joker")
            .eq("user_id", userId)
            .gte("question_date", startStr)
            .lte("question_date", endStr);

          if (answersError) throw answersError;

          // 2) Questions for same month from lang-specific table (match by date in frontend)
          const questionTable = lang === "en" ? "daily_questions_en" : "questions";
          const questionDateCol = lang === "en" ? "question_date" : "day";
          const questionTextCol = lang === "en" ? "question_text" : "text";

          const { data: questionsData } = await supabase
            .from(questionTable)
            .select(`${questionDateCol}, ${questionTextCol}`)
            .gte(questionDateCol, startStr)
            .lte(questionDateCol, endStr);

          const dayToText = new Map<string, string>();
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
          setLocalMap(map);
          setCacheForMonth(yearMonth, map);
        } catch (e) {
          console.error("Calendar answers fetch error:", e);
          setError("calendar_error_load");
        } finally {
          setLoading(false);
        }
      }, [userId, yearMonth, lang, setCacheForMonth]);

      useEffect(() => {
        const existing = getCacheForMonth(yearMonth);
        if (existing && existing.size > 0) {
          setLocalMap(existing);
          setLoading(false);
          return;
        }
        fetchMonth();
      }, [yearMonth, userId, lang]);

      const refetch = useCallback(() => fetchMonth(), [fetchMonth]);

      return {
        answersMap,
        loading,
        error,
        refetch,
        setAnswerForDay: setAnswerForDayInCache,
      };
    },
    [getCacheForMonth, setCacheForMonth, setAnswerForDayInCache]
  );

  const value: CalendarAnswersContextValue = {
    setAnswerForDay: setAnswerForDayInCache,
    useCalendarAnswers,
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
