import { useEffect, useState } from "react";
import type { Lang } from "../i18n/translations";
import { getNow, getLocalDayKey } from "../lib/date";
import { supabase } from "../config/supabase";

type TodayQuestionCacheEntry = { question: TodayQuestion | null; error: string | null };

// Small in-memory cache so rapid route transitions (boot -> today) don't flash a loader.
const todayQuestionCache = new Map<string, TodayQuestionCacheEntry>();

export type TodayQuestion = {
  id: string;
  text: string;
  day: string;
};

export function useTodayQuestion(
  lang: Lang,
  userId: string | null
): {
  question: TodayQuestion | null;
  loading: boolean;
  error: string | null;
} {
  const dayKey = getLocalDayKey(getNow());
  const cacheKey = userId ? `${lang}:${userId}:${dayKey}` : null;

  const cached = cacheKey ? todayQuestionCache.get(cacheKey) : undefined;

  const [question, setQuestion] = useState<TodayQuestion | null>(() => {
    if (!userId) return null;
    if (userId === "dev-user") {
      return {
        id: "dev-question-id",
        text: "Waar heb je vandaag om gelachen?",
        day: dayKey,
      };
    }
    return cached?.question ?? null;
  });
  const [loading, setLoading] = useState<boolean>(() => {
    if (!userId) return false;
    if (userId === "dev-user") return false;
    return cached ? false : true;
  });
  const [error, setError] = useState<string | null>(() => {
    if (!userId || userId === "dev-user") return null;
    return cached?.error ?? null;
  });

  useEffect(() => {
    if (!userId) {
      setQuestion(null);
      setLoading(false);
      setError(null);
      return;
    }

    if (userId === "dev-user") {
      setQuestion({
        id: "dev-question-id",
        text: "Waar heb je vandaag om gelachen?",
        day: dayKey,
      });
      setLoading(false);
      setError(null);
      return;
    }

    if (cacheKey) {
      const hit = todayQuestionCache.get(cacheKey);
      if (hit) {
        setQuestion(hit.question);
        setError(hit.error);
        setLoading(false);
        return;
      }
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const run = async () => {
      let cacheToSet: TodayQuestionCacheEntry | null = null;
      try {
        const tableName = lang === "en" ? "daily_questions_en" : "questions";
        const isEn = tableName === "daily_questions_en";
        const { data, error: err } = isEn
          ? await supabase
              .from(tableName)
              .select("id, question_text, question_date")
              .eq("question_date", dayKey)
              .maybeSingle()
          : await supabase
              .from(tableName)
              .select("id, text, day")
              .eq("day", dayKey)
              .maybeSingle();

        if (cancelled) return;
        if (err) {
          setError(err.message);
          setQuestion(null);
          cacheToSet = { question: null, error: err.message };
          return;
        }
        if (data) {
          const nextQuestion: TodayQuestion = isEn
            ? {
                id: data.id,
                text: (data as { question_text?: string }).question_text ?? "",
                day: (data as { question_date?: string }).question_date ?? dayKey,
              }
            : {
                id: data.id,
                text: (data as { text?: string }).text ?? "",
                day: (data as { day?: string }).day ?? dayKey,
              };

          setQuestion(nextQuestion);
          cacheToSet = { question: nextQuestion, error: null };
        } else {
          setQuestion(null);
          // No question today isn't necessarily an error; cache it so we don't re-fetch immediately.
          cacheToSet = { question: null, error: null };
        }
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Failed to load question";
          setError(msg);
          setQuestion(null);
          cacheToSet = { question: null, error: msg };
        }
      } finally {
        if (!cancelled) {
          if (cacheKey && cacheToSet) todayQuestionCache.set(cacheKey, cacheToSet);
          setLoading(false);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [lang, userId, dayKey, cacheKey]);

  return { question, loading, error };
}
