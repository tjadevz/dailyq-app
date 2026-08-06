import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import ArchiveMomentModal from "@/src/components/modals/ArchiveMomentModal";
import type { AccountMilestoneAnswer } from "@/src/components/modals/AccountMilestoneModal";
import { useAuth } from "@/src/context/AuthContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { useProfileContext } from "@/src/context/ProfileContext";
import { supabase } from "@/src/config/supabase";
import {
  ONBOARDING_QUESTION_COUNT,
  getOnboardingQuestionDayKeys,
} from "@/src/lib/onboardingWindow";
import { getOnboardingWidgetDone } from "@/src/lib/onboardingProgress";
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
  const [exiting, setExiting] = useState(false);
  const [modalDismissed, setModalDismissed] = useState(false);
  const [showIntroCard, setShowIntroCard] = useState(true);
  const [enterFromRight, setEnterFromRight] = useState(false);
  /** Number of questions answered (submitted) in this onboarding run. */
  const [answeredCount, setAnsweredCount] = useState(0);
  /** The 3 onboarding answers, collected as they're submitted, for the archive-preview completion moment. */
  const [collectedAnswers, setCollectedAnswers] = useState<AccountMilestoneAnswer[]>([]);
  const [showArchiveMoment, setShowArchiveMoment] = useState(false);
  /**
   * Set synchronously (before modalDismissed) the moment the 3rd answer is
   * saved — by then there's nothing left to wait on but AnsweringExperience's
   * own unmount, so a ref (not state) keeps handleExperienceClosed reading
   * the current value without an extra render/effect round-trip.
   */
  const finishingOnboardingRef = useRef(false);

  const dayKeys = useMemo(
    () => effectiveUser?.created_at
      ? getOnboardingQuestionDayKeys(new Date(effectiveUser.created_at))
      : getOnboardingQuestionDayKeys(),
    [effectiveUser?.created_at]
  );

  useEffect(() => {
    if (!userId || userId === "dev-user") return;
    let cancelled = false;
    getOnboardingWidgetDone(userId).then((widgetDone) => {
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
    async (completedAllQuestions: boolean) => {
      if (!userId || userId === "dev-user") {
        router.replace("/(tabs)/today");
        return;
      }
      if (completedAllQuestions) {
        // The 3 answers are already saved at this point — completion no
        // longer blocks the celebration transition, it just marks the
        // profile row in the background. A slow/failed RPC here shouldn't
        // stall the UI; worst case the user replays onboarding once more
        // next launch, which is recoverable (their answers aren't lost).
        logEvent("onboarding_completed");
        supabase
          .rpc("complete_onboarding_with_reward", { p_grant_joker: false })
          .then(({ error: completeErr }) => {
            if (completeErr) {
              console.error("[onboarding-questions] Failed to mark onboarding complete:", completeErr);
              return;
            }
            refetchProfile().catch((e) => {
              console.error("[onboarding-questions] Failed to refetch profile:", e);
            });
          });
        return;
      }
      setExiting(true);
      try {
        const { error: completeErr } = await supabase.rpc("complete_onboarding_with_reward", {
          p_grant_joker: false,
        });
        if (completeErr) throw completeErr;
        refetchProfile().catch((e) => {
          console.error("[onboarding-questions] Failed to refetch profile:", e);
        });
        router.replace("/(tabs)/today");
      } catch (e) {
        console.error("[onboarding-questions] Failed to update profile:", e);
        setSaveError(e instanceof Error ? e.message : "Failed to complete onboarding");
      } finally {
        setExiting(false);
      }
    },
    [userId, refetchProfile, router]
  );

  const handleExperienceClosed = useCallback(() => {
    if (finishingOnboardingRef.current) {
      finishingOnboardingRef.current = false;
      setShowArchiveMoment(true);
    }
  }, []);

  const handleArchiveMomentClose = useCallback(() => {
    setShowArchiveMoment(false);
    router.replace("/(tabs)/onboarding-notifications");
  }, [router]);

  const handleDismiss = useCallback(() => {
    logEvent("onboarding_skipped", { screen: getOnboardingScreenName() });
    setModalDismissed(true);
    setOnboardingCompletedAndGoHome(false);
  }, [setOnboardingCompletedAndGoHome, getOnboardingScreenName]);

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
        setCollectedAnswers((prev) => [
          ...prev,
          { date: q.question_date, questionText: q.question_text, answerText: trimmed },
        ]);
        const nextIndex = currentIndex + 1;
        const isLast = nextIndex >= questions.length;
        setAnsweredCount((prev) => {
          const next = prev + 1;
          if (isLast) {
            if (next === ONBOARDING_QUESTION_COUNT) {
              finishingOnboardingRef.current = true;
              setModalDismissed(true);
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
  const modalOpen = total > 0 && !modalDismissed;

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
      <BackgroundLayer />
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
        onClosed={handleExperienceClosed}
        closeDurationMs={finishingOnboardingRef.current ? 100 : undefined}
      />
      {!modalOpen && saveError ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{saveError}</Text>
          <Pressable style={styles.dismissBtn} onPress={handleDismiss} disabled={exiting}>
            <Text style={styles.dismissBtnText}>×</Text>
          </Pressable>
        </View>
      ) : null}
      <ArchiveMomentModal
        visible={showArchiveMoment}
        answers={collectedAnswers}
        onClose={handleArchiveMomentClose}
        headerText={t("onboarding_complete_archive_header")}
        subtitleText={t("onboarding_complete_archive_subtitle")}
        ctaLabel={t("onboarding_continue")}
      />
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
