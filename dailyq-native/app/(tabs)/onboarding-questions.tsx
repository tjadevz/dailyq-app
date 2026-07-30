import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS } from "@/src/config/constants";
import { BackgroundLayer } from "@/src/components/BackgroundLayer";
import { AnsweringExperience } from "@/src/components/AnsweringExperience";
import { OnboardingRewardModal } from "@/src/components/OnboardingRewardModal";
import { useAuth } from "@/src/context/AuthContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { useProfileContext } from "@/src/context/ProfileContext";
import { supabase } from "@/src/config/supabase";
import {
  ONBOARDING_QUESTION_COUNT,
  getOnboardingQuestionDayKeys,
} from "@/src/lib/onboardingWindow";
import { getOnboardingNotificationsDone, getOnboardingWidgetDone } from "@/src/lib/onboardingProgress";
import { logEvent } from "@/lib/analytics";

type OnboardingQuestion = {
  question_date: string;
  question_text: string;
};

export default function OnboardingQuestionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { effectiveUser } = useAuth();
  const { refetch: refetchProfile } = useProfileContext();
  const { t, lang } = useLanguage();

  const userId = effectiveUser?.id ?? null;
  const [questions, setQuestions] = useState<OnboardingQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [rewardModalVisible, setRewardModalVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [modalDismissed, setModalDismissed] = useState(false);
  const [showIntroCard, setShowIntroCard] = useState(true);
  const [enterFromRight, setEnterFromRight] = useState(false);
  /** Number of questions answered (submitted) in this onboarding run; reward joker granted only if all 3 are answered. */
  const [answeredCount, setAnsweredCount] = useState(0);

  const dayKeys = useMemo(
    () => effectiveUser?.created_at
      ? getOnboardingQuestionDayKeys(new Date(effectiveUser.created_at))
      : getOnboardingQuestionDayKeys(),
    [effectiveUser?.created_at]
  );

  useEffect(() => {
    if (!userId || userId === "dev-user") return;
    let cancelled = false;
    getOnboardingNotificationsDone(userId).then(async (notificationsDone) => {
      if (cancelled) return;
      if (!notificationsDone) {
        router.replace("/(tabs)/onboarding-notifications");
        return;
      }
      const widgetDone = await getOnboardingWidgetDone(userId);
      if (!cancelled && !widgetDone) {
        router.replace("/(tabs)/onboarding-widget");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [userId, router]);

  useEffect(() => {
    if (!userId || userId === "dev-user") {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const tableName = lang === "en" ? "daily_questions_en" : "questions";
    const dateCol = lang === "en" ? "question_date" : "day";
    const textCol = lang === "en" ? "question_text" : "text";
    const start = dayKeys[0];
    const end = dayKeys[dayKeys.length - 1];

    supabase
      .from(tableName)
      .select(`${dateCol}, ${textCol}`)
      .gte(dateCol, start)
      .lte(dateCol, end)
      .order(dateCol, { ascending: true })
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) {
          setError(err.message);
          setLoading(false);
          return;
        }
        const rows = (data ?? []) as { question_date?: string; day?: string; question_text?: string; text?: string }[];
        const mapped: OnboardingQuestion[] = rows.map((row) => ({
          question_date: (dateCol === "question_date" ? row.question_date : row.day) ?? "",
          question_text: (textCol === "question_text" ? row.question_text : row.text) ?? "",
        }));
        setQuestions(mapped);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, lang, dayKeys]);

  const getOnboardingScreenName = useCallback(() => {
    if (showIntroCard) return "questions_intro";
    return `questions_${currentIndex + 1}`;
  }, [showIntroCard, currentIndex]);

  useEffect(() => {
    if (loading || questions.length === 0) return;
    const screen = showIntroCard ? "questions_intro" : `questions_${currentIndex + 1}`;
    logEvent("onboarding_screen_viewed", { screen });
  }, [loading, questions.length, showIntroCard, currentIndex]);

  const setOnboardingCompletedAndGoHome = useCallback(
    async (grantJoker: boolean) => {
      if (!userId || userId === "dev-user") {
        router.replace("/(tabs)/today");
        return;
      }
      setExiting(true);
      try {
        const { error: completeErr } = await supabase.rpc("complete_onboarding_with_reward", {
          p_grant_joker: grantJoker,
        });
        if (completeErr) throw completeErr;
        if (grantJoker) {
          logEvent("onboarding_completed");
          setRewardModalVisible(true);
        } else {
          router.replace("/(tabs)/today");
        }
        refetchProfile().catch((e) => {
          console.error("[onboarding-questions] Failed to refetch profile:", e);
        });
      } catch (e) {
        console.error("[onboarding-questions] Failed to update profile:", e);
        setSaveError(e instanceof Error ? e.message : "Failed to complete onboarding");
      } finally {
        setExiting(false);
      }
    },
    [userId, refetchProfile, router]
  );

  const handleDismiss = useCallback(() => {
    logEvent("onboarding_skipped", { screen: getOnboardingScreenName() });
    setModalDismissed(true);
    setOnboardingCompletedAndGoHome(false);
  }, [setOnboardingCompletedAndGoHome, getOnboardingScreenName]);

  const handleLetsGo = useCallback(() => {
    setRewardModalVisible(false);
    router.replace("/(tabs)/today");
  }, [router]);

  const handleIntroContinue = useCallback(() => {
    setEnterFromRight(true);
    setShowIntroCard(false);
  }, []);

  const handleComplete = useCallback(
    async (answer: string) => {
      const q = questions[currentIndex];
      if (!userId || userId === "dev-user" || !q) return;
      const trimmed = answer.trim();
      if (!trimmed) return;

      setSaveError(null);
      setSaving(true);
      try {
        const { error: upsertErr } = await supabase.from("answers").upsert(
          {
            user_id: userId,
            question_date: q.question_date,
            answer_text: trimmed,
            is_joker: false,
            is_onboarding: true,
          },
          { onConflict: "user_id,question_date" }
        );
        if (upsertErr) {
          throw upsertErr;
        }
        const nextIndex = currentIndex + 1;
        const isLast = nextIndex >= questions.length;
        setAnsweredCount((prev) => {
          const next = prev + 1;
          if (isLast) {
            if (next === ONBOARDING_QUESTION_COUNT) {
              setOnboardingCompletedAndGoHome(true);
            } else {
              setModalDismissed(true);
              requestAnimationFrame(() => setOnboardingCompletedAndGoHome(false));
            }
          }
          return next;
        });
        if (!isLast) {
          setCurrentIndex((i) => i + 1);
        }
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Failed to save");
      } finally {
        setSaving(false);
      }
    },
    [userId, currentIndex, questions, setOnboardingCompletedAndGoHome]
  );

  const currentQuestion = questions[currentIndex];
  const total = questions.length;
  const modalOpen = total > 0 && !rewardModalVisible && !modalDismissed;

  if (!userId || userId === "dev-user") {
    router.replace("/(tabs)/today");
    return null;
  }

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <BackgroundLayer />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.ACCENT} />
        </View>
      </View>
    );
  }

  if (error || total === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <BackgroundLayer />
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error ?? t("onboarding_questions_no_questions_found")}</Text>
          <Pressable style={styles.dismissBtn} onPress={handleDismiss} disabled={exiting}>
            <Text style={styles.dismissBtnText}>×</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AnsweringExperience
        key={showIntroCard ? "intro" : "questions"}
        isOpen={modalOpen}
        onClose={handleDismiss}
        onComplete={handleComplete}
        isIntroCard={showIntroCard}
        introHeadline={showIntroCard ? t("onboarding_questions_intro_card_headline") : undefined}
        introBody={showIntroCard ? t("onboarding_questions_intro_card_body") : undefined}
        introCtaLabel={showIntroCard ? t("onboarding_questions_intro_cta") : undefined}
        onIntroContinue={showIntroCard ? handleIntroContinue : undefined}
        question={showIntroCard ? "" : currentQuestion.question_text}
        initialAnswer=""
        dayKey={showIntroCard ? null : currentQuestion.question_date}
        contextLabel={`${currentIndex + 1} of ${total}`}
        progressCurrent={showIntroCard ? undefined : currentIndex + 1}
        progressTotal={showIntroCard ? undefined : total}
        placeholder={t("onboarding_answer_placeholder")}
        lang={lang}
        submitError={saveError}
        submitting={saving}
        enterFromRight={enterFromRight}
        slideOnAdvance={!showIntroCard}
        animateOnClose
      />
      <OnboardingRewardModal visible={rewardModalVisible} onLetsGo={handleLetsGo} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  dismissBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(243,244,246,0.9)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  dismissBtnText: {
    fontSize: 24,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 28,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.TEXT_SECONDARY,
    textAlign: "center",
  },
});
