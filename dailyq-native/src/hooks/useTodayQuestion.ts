import { useEffect, useState } from "react";
import type { Lang } from "../i18n/translations";
import { getNow, getLocalDayKey } from "../lib/date";
import { supabase } from "../config/supabase";

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
  const [question, setQuestion] = useState<TodayQuestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setQuestion(null);
      setLoading(false);
      setError(null);
      return;
    }

    const dayKey = getLocalDayKey(getNow());

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

    let cancelled = false;
    setLoading(true);
    setError(null);

    const run = async () => {
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
          return;
        }
        if (data) {
          setQuestion(
            isEn
              ? {
                  id: data.id,
                  text: (data as { question_text?: string }).question_text ?? "",
                  day: (data as { question_date?: string }).question_date ?? dayKey,
                }
              : {
                  id: data.id,
                  text: (data as { text?: string }).text ?? "",
                  day: (data as { day?: string }).day ?? dayKey,
                }
          );
        } else {
          setQuestion(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load question");
          setQuestion(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [lang, userId]);

  return { question, loading, error };
}
