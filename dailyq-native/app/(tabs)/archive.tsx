import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AnimatedReanimated, {
  Easing,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { BackgroundLayer } from "@/src/components/BackgroundLayer";
import { COLORS } from "@/src/config/constants";
import { supabase } from "@/src/config/supabase";
import { useAuth } from "@/src/context/AuthContext";
import { useLanguage } from "@/src/context/LanguageContext";

type AnswerRow = {
  question_date: string;
  answer_text: string | null;
};

type QuestionRowNL = {
  day: string;
  text?: string | null;
  question_text?: string | null;
  question: string | null;
};

type QuestionRowEN = {
  question_date: string;
  question_text?: string | null;
  question: string | null;
};

type ArchiveItem = {
  date: string;
  questionText: string;
  answerText: string;
};

function isValidLanguage(value: string | null | undefined): value is "nl" | "en" {
  return value === "nl" || value === "en";
}

export default function ArchiveScreen() {
  const insets = useSafeAreaInsets();
  const { effectiveUser } = useAuth();
  const { lang, formatDate } = useLanguage();
  const userId = effectiveUser?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ArchiveItem[]>([]);
  const dotPulse = useSharedValue(1);

  const fetchArchiveData = useCallback(async () => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data: profileData } = await supabase
      .from("profiles")
      .select("language")
      .eq("id", userId)
      .maybeSingle();

    const effectiveLang = isValidLanguage(profileData?.language) ? profileData.language : lang;

    const { data: answersData, error: answersError } = await supabase
      .from("answers")
      .select("question_date, answer_text")
      .eq("user_id", userId)
      .not("answer_text", "is", null)
      .order("question_date", { ascending: true });

    if (answersError) {
      console.error("[Archive] Answers fetch error:", answersError);
      setItems([]);
      setLoading(false);
      return;
    }

    const answeredRows = ((answersData as AnswerRow[] | null) ?? []).filter((row) =>
      Boolean(row.answer_text?.trim())
    );
    const uniqueDates = [...new Set(answeredRows.map((row) => row.question_date).filter(Boolean))];

    const questionByDay = new Map<string, string>();
    if (uniqueDates.length > 0) {
      if (effectiveLang === "nl") {
        const { data: questionsData, error: questionsError } = await supabase
          .from("questions")
          .select("*")
          .in("day", uniqueDates);

        if (questionsError) {
          console.error("[Archive] NL questions fetch error:", questionsError);
        } else {
          for (const row of (questionsData as QuestionRowNL[] | null) ?? []) {
            questionByDay.set(row.day, row.question ?? row.text ?? row.question_text ?? "");
          }
        }
      } else {
        const { data: questionsData, error: questionsError } = await supabase
          .from("daily_questions_en")
          .select("*")
          .in("question_date", uniqueDates);

        if (questionsError) {
          console.error("[Archive] EN questions fetch error:", questionsError);
        } else {
          for (const row of (questionsData as QuestionRowEN[] | null) ?? []) {
            questionByDay.set(row.question_date, row.question ?? row.question_text ?? "");
          }
        }
      }
    }

    const nextItems: ArchiveItem[] = answeredRows.map((row) => ({
      date: row.question_date,
      questionText: questionByDay.get(row.question_date) ?? "",
      answerText: row.answer_text?.trim() ?? "",
    }));

    setItems(nextItems);
    setLoading(false);
  }, [lang, userId]);

  useEffect(() => {
    fetchArchiveData();
  }, [fetchArchiveData]);

  useFocusEffect(
    useCallback(() => {
      fetchArchiveData();
    }, [fetchArchiveData])
  );

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`archive-answers-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "answers", filter: `user_id=eq.${userId}` },
        () => {
          fetchArchiveData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchArchiveData, userId]);

  const answerLabel = useMemo(
    () => {
      if (lang === "en") {
        return items.length === 1 ? "answer" : "answers";
      }
      return items.length === 1 ? "antwoord" : "antwoorden";
    },
    [items.length, lang]
  );
  const headerPrefix = lang === "en" ? "Your archive contains" : "Jouw archief bevat";
  const loadingText = lang === "en" ? "Loading archive..." : "Archief laden...";
  const emptyText =
    lang === "en"
      ? "No answers yet. Answer your first question."
      : "Nog geen antwoorden. Beantwoord je eerste vraag.";

  useEffect(() => {
    dotPulse.value = withRepeat(
      withSequence(
        withTiming(1.16, { duration: 850, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 850, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
  }, [dotPulse]);

  const dotPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dotPulse.value }],
    opacity: 0.78 + (dotPulse.value - 1) * 1.1,
  }));
  if (loading) {
    return (
      <View style={styles.screen}>
        <BackgroundLayer />
        <View style={[styles.content, { paddingTop: insets.top + 32 }]}>
          <View style={[styles.center, styles.centerFill]}>
            <ActivityIndicator size="small" color="#7C3AED" />
            <Text style={styles.loadingText}>{loadingText}</Text>
          </View>
        </View>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.screen}>
        <BackgroundLayer />
        <View style={[styles.content, { paddingTop: insets.top + 32 }]}>
          <View style={styles.header}>
            <View style={styles.heroCard}>
              <Text style={styles.heroLabel}>{headerPrefix}</Text>
              <Text style={styles.heroValue}>0</Text>
              <Text style={styles.heroSubLabel}>{lang === "en" ? "answers" : "antwoorden"}</Text>
            </View>
          </View>
          <View style={[styles.center, styles.centerFill]}>
            <Text style={styles.emptyText}>{emptyText}</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <BackgroundLayer />
      <View style={[styles.content, { paddingTop: insets.top + 32 }]}>
        <View style={styles.header}>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{headerPrefix}</Text>
            <Text style={styles.heroValue}>{items.length}</Text>
            <Text style={styles.heroSubLabel}>{answerLabel}</Text>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator
        >
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            return (
              <View key={`${item.date}-${index}`} style={styles.row}>
                <View style={styles.timelineCol}>
                  <AnimatedReanimated.View style={[styles.dot, dotPulseStyle]} />
                  {!isLast ? <View style={styles.line} /> : null}
                </View>

                <AnimatedReanimated.View
                  entering={FadeInUp.delay(250 + index * 80).duration(260)}
                  style={styles.card}
                >
                  <Text style={styles.cardDate}>
                    {formatDate(new Date(`${item.date}T12:00:00`), {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </Text>
                  <Text style={styles.cardQuestion}>{item.questionText}</Text>
                  <Text style={styles.cardAnswer}>{item.answerText}</Text>
                </AnimatedReanimated.View>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  content: {
    flex: 1,
    zIndex: 10,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  heroCard: {
    backgroundColor: "#7C3AED",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    minHeight: 112,
    justifyContent: "space-between",
  },
  heroLabel: {
    fontSize: 15,
    color: "#C4B5FD",
    fontWeight: "600",
  },
  heroValue: {
    fontSize: 44,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  heroSubLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#C4B5FD",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  timelineCol: {
    width: 24,
    alignItems: "center",
    marginRight: 12,
    paddingTop: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#7C3AED",
  },
  line: {
    width: 1.5,
    alignSelf: "center",
    flex: 1,
    marginTop: 4,
    marginBottom: -4,
    backgroundColor: "#D4BBFF",
  },
  card: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardDate: {
    fontSize: 12,
    fontWeight: "500",
    color: "#7C3AED",
    marginBottom: 6,
  },
  cardQuestion: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 8,
  },
  cardAnswer: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.TEXT_PRIMARY,
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  centerFill: {
    flex: 1,
  },
  loadingText: {
    marginTop: 10,
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
  },
  emptyText: {
    textAlign: "center",
    color: COLORS.TEXT_SECONDARY,
    fontSize: 16,
    lineHeight: 22,
  },
});
