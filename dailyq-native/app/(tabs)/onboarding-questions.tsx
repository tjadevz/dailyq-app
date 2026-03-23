import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Animated,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import { COLORS } from "@/src/config/constants";
import { BackgroundLayer } from "@/src/components/BackgroundLayer";
import { AnsweringExperience } from "@/src/components/AnsweringExperience";
import { OnboardingRewardModal } from "@/src/components/OnboardingRewardModal";
import { useAuth } from "@/src/context/AuthContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { useProfileContext } from "@/src/context/ProfileContext";
import { supabase } from "@/src/config/supabase";
import { getNow, getLocalDayKey } from "@/src/lib/date";

type OnboardingQuestion = {
  question_date: string;
  question_text: string;
};

const ONBOARDING_DAYS = 7;

const LOGO_SIZE = 110;

/** Fade in + slide up on mount (consistent with auth onboarding StepTransitionView). */
function useIntroEntrance() {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(28)).current;
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 380,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 380,
          useNativeDriver: true,
        }),
      ]).start();
    });
    return () => cancelAnimationFrame(id);
  }, [opacity, translateY]);
  return { opacity, translateY };
}

function OnboardingQuestionsIntroScreen({
  onStart,
  t,
}: {
  onStart: () => void;
  t: (key: string) => string;
}) {
  const { opacity, translateY } = useIntroEntrance();

  return (
    <View style={styles.introContent}>
      {/* Subtle background elements — soft purple circles */}
      <View style={styles.introDeco1} pointerEvents="none" />
      <View style={styles.introDeco2} pointerEvents="none" />
      <View style={styles.introDeco3} pointerEvents="none" />

      <Animated.View
        style={[
          styles.introGroup,
          {
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={styles.introLogoWrap}>
          <View style={styles.introHaloOuter} />
          <View style={styles.introHaloInner} />
          <Image
            source={require("@/assets/images/logo.nobg.png")}
            style={styles.introLogoImage}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.introTitle}>{t("onboarding_questions_intro_title")}</Text>
        <Text style={styles.introSubtitle}>{t("onboarding_questions_intro_subtitle")}</Text>
        <Pressable
          onPress={onStart}
          style={({ pressed }) => [styles.introCtaWrap, pressed && styles.introCtaPressed]}
        >
          <LinearGradient
            colors={["#7C3AED", "#6D28D9"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.introCtaGradient}
          >
            <Text style={styles.introCtaText}>{t("onboarding_questions_intro_cta")}</Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function getOnboardingDayKeys(): string[] {
  const today = getNow();
  const keys: string[] = [];
  for (let i = ONBOARDING_DAYS; i >= 1; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    keys.push(getLocalDayKey(d));
  }
  return keys;
}

export default function OnboardingQuestionsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ skipIntro?: string | string[] }>();
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
  const skipIntro = useMemo(() => {
    const raw = params.skipIntro;
    const value = Array.isArray(raw) ? raw[0] : raw;
    return value === "1";
  }, [params.skipIntro]);
  const [showIntro, setShowIntro] = useState(!skipIntro);
  const [modalDismissed, setModalDismissed] = useState(false);
  /** Number of questions answered (submitted) in this onboarding run; joker only if this is 7 when finishing. */
  const [answeredCount, setAnsweredCount] = useState(0);

  const dayKeys = useMemo(() => getOnboardingDayKeys(), []);

  useEffect(() => {
    if (skipIntro) setShowIntro(false);
  }, [skipIntro]);

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
        await refetchProfile();
        if (grantJoker) {
          setRewardModalVisible(true);
        } else {
          router.replace("/(tabs)/today");
        }
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
    setModalDismissed(true);
    setOnboardingCompletedAndGoHome(false);
  }, [setOnboardingCompletedAndGoHome]);

  const handleLetsGo = useCallback(() => {
    setRewardModalVisible(false);
    router.replace("/(tabs)/today");
  }, [router]);

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
          },
          { onConflict: "user_id,question_date" }
        );
        if (upsertErr) throw upsertErr;
        const nextIndex = currentIndex + 1;
        const isLast = nextIndex >= questions.length;
        setAnsweredCount((prev) => {
          const next = prev + 1;
          if (isLast) {
            if (next === questions.length) {
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

  const handleSkip = useCallback(() => {
    const nextIndex = currentIndex + 1;
    const isLast = nextIndex >= questions.length;
    if (isLast) {
      // Close modal first so blur disappears, then navigate to today (no joker)
      setModalDismissed(true);
      requestAnimationFrame(() => {
        setOnboardingCompletedAndGoHome(false);
      });
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }, [currentIndex, questions.length, setOnboardingCompletedAndGoHome]);

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
          <Text style={styles.errorText}>{error ?? "No questions found"}</Text>
          <Pressable style={styles.dismissBtn} onPress={handleDismiss} disabled={exiting}>
            <Text style={styles.dismissBtnText}>×</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (showIntro) {
    return (
      <View style={styles.container}>
        <BackgroundLayer />
        <SafeAreaView style={styles.introSafe} edges={["top", "bottom"]}>
          <OnboardingQuestionsIntroScreen
            onStart={() => setShowIntro(false)}
            t={t}
          />
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AnsweringExperience
        isOpen={modalOpen}
        onClose={handleDismiss}
        onComplete={handleComplete}
        question={currentQuestion.question_text}
        initialAnswer=""
        dayKey={currentQuestion.question_date}
        contextLabel={`${currentIndex + 1} of ${total}`}
        placeholder={t("onboarding_answer_placeholder")}
        lang={lang}
        submitError={saveError}
        submitting={saving}
        onSkip={handleSkip}
        skipLabel={t("onboarding_skip")}
        enterFromRight={currentIndex > 0}
        animateOnClose
      />
      <OnboardingRewardModal visible={rewardModalVisible} onLetsGo={handleLetsGo} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  introSafe: {
    flex: 1,
  },
  introContent: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  introDeco1: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(139,92,246,0.05)",
    top: "18%",
    left: -60,
  },
  introDeco2: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(167,139,250,0.06)",
    bottom: "22%",
    right: -40,
  },
  introDeco3: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(196,181,253,0.06)",
    top: "48%",
    right: "8%",
  },
  introGroup: {
    alignItems: "center",
    width: "100%",
  },
  introLogoWrap: {
    position: "relative",
    width: 160,
    height: 160,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  introHaloOuter: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(139,92,246,0.12)",
  },
  introHaloInner: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "rgba(167,139,250,0.15)",
  },
  introLogoImage: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    marginTop: 16, // ~10% of logo wrap — logo sits lower, halo unchanged
  },
  introTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
    textAlign: "center",
    marginBottom: 12,
  },
  introSubtitle: {
    fontSize: 16,
    color: COLORS.TEXT_SECONDARY,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 32,
  },
  introCtaWrap: {
    width: "100%",
    minHeight: 56,
    borderRadius: 9999,
    overflow: "hidden",
    shadowColor: "rgba(124,58,237,0.35)",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 1,
    shadowRadius: 56,
    elevation: 8,
  },
  introCtaPressed: {
    opacity: 0.9,
  },
  introCtaGradient: {
    paddingVertical: 18,
    paddingHorizontal: 40,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  introCtaText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});
