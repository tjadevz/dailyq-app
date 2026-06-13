import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  TouchableOpacity,
  Keyboard,
  Platform,
  Modal,
  Animated,
  Share,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { COLORS, JOKER, MODAL, MODAL_ENTER_MS, MODAL_CLOSE_MS } from "@/src/config/constants";
import { useLanguage } from "@/src/context/LanguageContext";
import { useAuth } from "@/src/context/AuthContext";
import { useStreakMilestone, getAlreadyGranted, getHighestMilestoneCrossed, getMilestonesCrossed, grantMilestoneJokersForCrossed } from "@/src/context/StreakMilestoneContext";
import { useCalendarAnswersContext } from "@/src/context/CalendarAnswersContext";
import { useTodayQuestion } from "@/src/hooks/useTodayQuestion";
import { useProfileContext } from "@/src/context/ProfileContext";
import { daysSinceAccountCreated, resolveAccountMilestone } from "@/src/lib/accountMilestone";
import { supabase } from "@/src/config/supabase";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { JokerModalBottomSheet } from "@/src/components/JokerModalBottomSheet";
import { JokerBadge } from "@/src/components/JokerBadge";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { GlassCardContainer } from "@/src/components/GlassCardContainer";
import DailyQLoadingScreen from "@/src/components/DailyQLoadingScreen";
import { AnsweringExperience } from "@/src/components/AnsweringExperience";
import { SubmitSuccessModal } from "@/src/components/SubmitSuccessModal";
import ShareCard from "@/src/components/ShareCard";
import ShareCaptureModal from "@/src/components/ShareCaptureModal";
import AccountMilestoneModal, {
  type AccountMilestoneAnswer,
} from "@/src/components/modals/AccountMilestoneModal";
import PreviousYearModal from "@/src/components/modals/PreviousYearModal";
import MonthlyRecapModal from "@/src/components/modals/MonthlyRecapModal";
import MonthlyRecapShareCard, {
  type MonthlyRecapShareCardRef,
} from "@/src/components/MonthlyRecapShareCard";
import { useShareCard } from "@/src/hooks/useShareCard";
import { useMonthlyRecap } from "@/src/hooks/useMonthlyRecap";
import { logEvent } from "@/lib/analytics";

const TODAY_PRIMARY_GRADIENT = ["rgba(139,92,246,0.96)", "rgba(124,58,237,0.96)"] as const;
const MONTHLY_RECAP_DEV_TRIGGER_KEY = "dailyq-dev-force-monthly-recap";

/** Answers + question text for AccountMilestoneModal (same as post-submit milestone flow). */
async function fetchAccountMilestoneAnswersForModal(
  userId: string,
  lang: string
): Promise<AccountMilestoneAnswer[] | null> {
  try {
    const { data: answersData, error } = await supabase
      .from("answers")
      .select("question_date, answer_text")
      .eq("user_id", userId)
      .order("question_date", { ascending: true });
    if (error) {
      console.error("[Today] Account milestone answers fetch:", error);
      return null;
    }
    const rows =
      (answersData as { question_date: string; answer_text: string | null }[] | null) ?? [];
    const questionDates = [...new Set(rows.map((r) => r.question_date).filter(Boolean))];

    const questionTable = lang === "en" ? "daily_questions_en" : "questions";
    const questionDateCol = lang === "en" ? "question_date" : "day";
    const questionTextCol = lang === "en" ? "question_text" : "text";

    const dayToText = new Map<string, string>();
    if (questionDates.length > 0) {
      const { data: questionsData, error: qErr } = await supabase
        .from(questionTable)
        .select(`${questionDateCol}, ${questionTextCol}`)
        .in(questionDateCol, questionDates);
      if (qErr) {
        console.error("[Today] Account milestone questions lookup:", qErr);
      } else if (questionsData) {
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
    }

    return rows.map((row) => ({
      date: row.question_date,
      questionText: dayToText.get(row.question_date) ?? "",
      answerText: row.answer_text ?? "",
    }));
  } catch (e) {
    console.error("[Today] Account milestone answers fetch:", e);
    return null;
  }
}

async function markAccountMilestoneShown(userId: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ milestone_10_days_shown: true })
    .eq("id", userId);
  if (error) {
    console.error("[Today] Account milestone profile update:", error);
  }
}

const PREVIOUS_YEAR_LOOKBACK = 25;

async function fetchPreviousYearSameDayAnswers(
  userId: string,
  dayKey: string
): Promise<{ question_date: string; answer_text: string }[]> {
  const parts = dayKey.split("-").map(Number);
  if (parts.length !== 3) return [];
  const [y, m, d] = parts;
  if (!y || !m || !d) return [];
  const pad = (n: number) => String(n).padStart(2, "0");
  const dates: string[] = [];
  for (let i = 1; i <= PREVIOUS_YEAR_LOOKBACK; i++) {
    const py = y - i;
    if (py < 1970) break;
    dates.push(`${py}-${pad(m)}-${pad(d)}`);
  }
  if (dates.length === 0) return [];
  const { data, error } = await supabase
    .from("answers")
    .select("question_date, answer_text")
    .eq("user_id", userId)
    .in("question_date", dates);
  if (error) {
    console.error("[Today] Previous year answers fetch:", error);
    return [];
  }
  const rows = (data as { question_date: string; answer_text: string | null }[]) ?? [];
  return rows
    .filter((r) => r.answer_text != null && String(r.answer_text).trim().length > 0)
    .map((r) => ({ question_date: r.question_date, answer_text: String(r.answer_text).trim() }));
}

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const { lang, t } = useLanguage();
  const { effectiveUser } = useAuth();
  const userId = effectiveUser?.id ?? null;
  const { showRecap, recapData, markRecapSeen } = useMonthlyRecap();

  const { setAnswerForDay } = useCalendarAnswersContext();
  const { question, loading: questionLoading, error: questionError } = useTodayQuestion(lang, userId);
  const { profile, refetch: refetchProfile } = useProfileContext();
  const { showMilestone, open: streakCelebrationOpen } = useStreakMilestone();
  const { shareCardRefCallback, shareCard, shareCaptureVisible } = useShareCard();

  const [answerText, setAnswerText] = useState("");
  const [existingAnswer, setExistingAnswer] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [answerModalOpen, setAnswerModalOpen] = useState(false);
  const [showSubmitSuccess, setShowSubmitSuccess] = useState(false);
  const [pendingStreakMilestone, setPendingStreakMilestone] = useState<ReturnType<typeof getHighestMilestoneCrossed>>(null);
  const [pendingMilestone, setPendingMilestone] = useState<10 | null>(null);
  const [profileCreatedAtForMilestone, setProfileCreatedAtForMilestone] = useState<string | null>(
    null
  );

  const accountMilestoneDaysSinceCreation = useMemo(() => {
    const iso =
      profileCreatedAtForMilestone ?? profile?.created_at ?? effectiveUser?.created_at ?? null;
    return daysSinceAccountCreated(iso);
  }, [profileCreatedAtForMilestone, profile?.created_at, effectiveUser?.created_at]);

  const dayNumber = useMemo(() => {
    const createdAt = profile?.created_at ?? effectiveUser?.created_at ?? null;
    if (!createdAt) return null;
    const start = new Date(createdAt);
    start.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, diff + 1);
  }, [profile?.created_at, effectiveUser?.created_at]);

  const [modalQueue, setModalQueue] = useState<string[]>([]);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [milestoneAnswers, setMilestoneAnswers] = useState<AccountMilestoneAnswer[]>([]);
  const [activeAccountMilestone, setActiveAccountMilestone] = useState<10 | null>(null);
  const [jokerModalVisible, setJokerModalVisible] = useState(false);
  const [editConfirmVisible, setEditConfirmVisible] = useState(false);
  const [answerCount, setAnswerCount] = useState<number>(0);
  const [currentStreak, setCurrentStreak] = useState<number>(0);
  const [previousYearQueue, setPreviousYearQueue] = useState<{
    items: { question_date: string; answer_text: string }[];
    current: { question_date: string; answer_text: string };
    questionText: string;
  } | null>(null);
  const advanceQueue = useCallback((queue: string[]) => {
    if (queue.length > 0) {
      setActiveModal(queue[0]);
      setModalQueue((_prev) => queue.slice(1));
    } else {
      setActiveModal(null);
    }
  }, []);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const inputRef = useRef<TextInput>(null);
  const monthlyRecapShareCardRef = useRef<MonthlyRecapShareCardRef | null>(null);
  const streakQueueStateRef = useRef<"idle" | "waitingOpen" | "waitingClose">("idle");
  const questionBlockOffset = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(1)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  // Entrance animation when question is ready: slide up + fade button in
  useEffect(() => {
    if (!question) {
      questionBlockOffset.setValue(24);
      buttonOpacity.setValue(0);
      buttonScale.setValue(0.96);
      return;
    }
    // Set initial "from" values then animate so the motion is visible every time
    questionBlockOffset.setValue(24);
    buttonOpacity.setValue(0);
    buttonScale.setValue(0.96);
    const id = requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(questionBlockOffset, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.spring(buttonScale, {
          toValue: 1,
          useNativeDriver: true,
          friction: 10,
          tension: 80,
        }),
      ]).start();
    });
    return () => cancelAnimationFrame(id);
  }, [question, questionBlockOffset, buttonOpacity, buttonScale]);

  useEffect(() => {
    if (!userId || userId === "dev-user") return;
    supabase
      .from("answers")
      .select("answer_text")
      .eq("user_id", userId)
      .not("answer_text", "is", null)
      .then(({ data }) => {
        if (data != null) {
          setAnswerCount(data.filter((row) => Boolean(row.answer_text?.trim())).length);
        }
      });
  }, [userId]);

  useEffect(() => {
    if (!userId || userId === "dev-user") return;
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    supabase.rpc("get_user_streaks", { p_user_id: userId, p_timezone: userTimezone }).then(({ data }) => {
      const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
      const r = row?.real_streak ?? 0;
      const v = row?.visual_streak ?? 0;
      setCurrentStreak(Math.max(Number(r), Number(v)));
    });
  }, [userId]);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setKeyboardVisible(true)
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardVisible(false)
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardWillShow", (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hide = Keyboard.addListener("keyboardWillHide", () => {
      setKeyboardHeight(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const justSubmittedRef = useRef(false);
  useEffect(() => {
    if (showSubmitSuccess) {
      justSubmittedRef.current = true;
    }
  }, [showSubmitSuccess]);

  useEffect(() => {
    if (showSubmitSuccess || !justSubmittedRef.current) return;
    let cancelled = false;
    (async () => {
      const queue: string[] = [];

      if (previousYearQueue && previousYearQueue.items.length > 0) {
        queue.push("previousYear");
      }

      if (pendingStreakMilestone) {
        queue.push("streak");
      }

      if (pendingMilestone != null) {
        if (!userId || userId === "dev-user") {
          if (!cancelled) setPendingMilestone(null);
        } else {
          const mapped = await fetchAccountMilestoneAnswersForModal(userId, lang);
          if (cancelled) return;
          if (mapped != null) {
            setActiveAccountMilestone(pendingMilestone);
            setMilestoneAnswers(mapped);
            queue.push("milestone");
          }
          setPendingMilestone(null);
        }
      }

      if (showRecap) {
        queue.push("monthlyRecap");
      }

      if (!cancelled) {
        justSubmittedRef.current = false;
        advanceQueue(queue);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    showSubmitSuccess,
    pendingStreakMilestone,
    pendingMilestone,
    userId,
    lang,
    showRecap,
    previousYearQueue,
    advanceQueue,
  ]);

  useEffect(() => {
    if (activeModal !== "streak" || !pendingStreakMilestone) return;
    streakQueueStateRef.current = "waitingOpen";
    showMilestone(pendingStreakMilestone);
    setPendingStreakMilestone(null);
  }, [activeModal, pendingStreakMilestone, showMilestone]);

  useEffect(() => {
    if (activeModal !== "streak") return;
    if (streakQueueStateRef.current === "waitingOpen" && streakCelebrationOpen) {
      streakQueueStateRef.current = "waitingClose";
      return;
    }
    if (streakQueueStateRef.current === "waitingClose" && !streakCelebrationOpen) {
      streakQueueStateRef.current = "idle";
      advanceQueue(modalQueue);
    }
  }, [activeModal, streakCelebrationOpen, modalQueue, advanceQueue]);

  useEffect(() => {
    if (!__DEV__ || !showRecap || showSubmitSuccess || activeModal !== null) return;
    let cancelled = false;
    (async () => {
      const forced = (await AsyncStorage.getItem(MONTHLY_RECAP_DEV_TRIGGER_KEY)) === "1";
      if (!forced || cancelled) return;
      await AsyncStorage.removeItem(MONTHLY_RECAP_DEV_TRIGGER_KEY);
      if (cancelled) return;
      advanceQueue(["monthlyRecap"]);
    })();
    return () => {
      cancelled = true;
    };
  }, [showRecap, showSubmitSuccess, activeModal, advanceQueue]);

  const handlePreviousYearClose = useCallback(() => {
    setPreviousYearQueue(null);
    advanceQueue(modalQueue);
  }, [modalQueue, advanceQueue]);

  const handleMilestoneClose = useCallback(async () => {
    const m = activeAccountMilestone;
    setActiveAccountMilestone(null);
    if (userId && userId !== "dev-user" && m) {
      await markAccountMilestoneShown(userId);
      void refetchProfile();
    }
    advanceQueue(modalQueue);
  }, [userId, activeAccountMilestone, refetchProfile, modalQueue, advanceQueue]);

  const handleRecapClose = useCallback(() => {
    advanceQueue(modalQueue);
  }, [modalQueue, advanceQueue]);

  useEffect(() => {
    if (activeModal !== "monthlyRecap") return;
    if (!recapData?.previousMonthKey) return;
    logEvent("monthly_recap_viewed", { month: recapData.previousMonthKey });
    void markRecapSeen(recapData.previousMonthKey);
  }, [activeModal, recapData?.previousMonthKey, markRecapSeen]);

  // Clear leftover Monday recap keys (feature removed); they are not read anywhere.
  useEffect(() => {
    AsyncStorage.getAllKeys().then((keys) => {
      const recapKeys = keys.filter((k) => k.startsWith("dailyq_recap_"));
      if (recapKeys.length > 0) {
        AsyncStorage.multiRemove(recapKeys).catch(() => {});
      }
    });
  }, []);

  // Load existing answer when question is available
  useEffect(() => {
    if (!userId || !question || userId === "dev-user") {
      if (userId === "dev-user" && question) {
        setExistingAnswer(null);
        setAnswerText("");
      }
      return;
    }

    let cancelled = false;
    const dayKey = question.day;
    (async () => {
      const { data, error } = await supabase
        .from("answers")
        .select("answer_text")
        .eq("user_id", userId)
        .eq("question_date", dayKey)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        console.error("Failed to fetch existing answer:", error);
        return;
      }
      if (data?.answer_text != null) {
        setExistingAnswer(data.answer_text);
        setAnswerText(data.answer_text);
      } else {
        setExistingAnswer(null);
        setAnswerText("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, question?.day]);

  const submitAnswer = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!userId || !question || userId === "dev-user" || !trimmed) return;

      setSubmitError(null);
      setSubmitting(true);
      try {
        let previousStreak = 0;
        try {
          const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          const { data: streaksBefore } = await supabase.rpc("get_user_streaks", {
            p_user_id: userId,
            p_timezone: userTimezone,
          });
          const rowBefore =
            Array.isArray(streaksBefore) && streaksBefore.length > 0
              ? streaksBefore[0]
              : null;
          const vBefore = rowBefore?.visual_streak ?? 0;
          const rBefore = rowBefore?.real_streak ?? 0;
          previousStreak = Math.max(Number(vBefore), Number(rBefore));
        } catch {
          // ignore
        }

        const dayKey = question.day;
        const { error } = await supabase
          .from("answers")
          .upsert(
            {
              user_id: userId,
              question_date: dayKey,
              answer_text: trimmed,
            },
            { onConflict: "user_id,question_date" }
          );
        if (error) throw error;

        try {
          await Notifications.setBadgeCountAsync(0);
        } catch {
          // ignore – badge reset is non-critical
        }

        try {
          const { data, error: profileErr } = await supabase
            .from("profiles")
            .select(
              "created_at, milestone_10_days_shown, milestone_100_days_shown"
            )
            .eq("id", userId)
            .maybeSingle();
          if (profileErr) {
            console.error("[Today submit] Account milestone profile fetch:", profileErr);
          } else if (data) {
            const createdAtForMilestone = data.created_at ?? effectiveUser?.created_at ?? null;
            if (createdAtForMilestone) {
              setProfileCreatedAtForMilestone(createdAtForMilestone);
            }
            const milestoneToShow = resolveAccountMilestone(createdAtForMilestone, data);
            setPendingMilestone(milestoneToShow);
            // Persist the shown flag as soon as eligibility is hit so users do not get stuck
            // on false when modal close/update is interrupted.
            if (milestoneToShow === 10) {
              await markAccountMilestoneShown(userId);
              void refetchProfile();
            }
          }
        } catch (e) {
          console.error("[Today submit] Account milestone profile fetch:", e);
        }

        setAnswerForDay(dayKey, {
          questionText: question.text,
          answerText: trimmed,
        });

        const wasUpdate =
          existingAnswer != null && existingAnswer.length > 0;
        setExistingAnswer(trimmed);
        setAnswerText(trimmed);

        setAnswerModalOpen(false);
        setShowSubmitSuccess(true);
        setTimeout(() => {
          setShowSubmitSuccess(false);
        }, 2400);

        if (wasUpdate) {
          setEditConfirmVisible(true);
          setTimeout(() => setEditConfirmVisible(false), 2500);
        }
        void (async () => {
          const prior = await fetchPreviousYearSameDayAnswers(userId, dayKey);
          if (prior.length > 0) {
            logEvent("previous_year_answer_viewed", { count: prior.length });
            setPreviousYearQueue({
              items: prior,
              current: { question_date: dayKey, answer_text: trimmed },
              questionText: question.text,
            });
          }
        })();

        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const { data: streaks } = await supabase.rpc("get_user_streaks", {
          p_user_id: userId,
          p_timezone: userTimezone,
        });
        const row =
          Array.isArray(streaks) && streaks.length > 0 ? streaks[0] : null;
        const visual = row?.visual_streak ?? 0;
        const real = row?.real_streak ?? 0;
        const newStreak = Math.max(Number(visual), Number(real));
        setCurrentStreak(newStreak);
        if (!wasUpdate) setAnswerCount((c) => c + 1);
        logEvent("answer_submitted", { is_edit: wasUpdate, streak: newStreak });

        try {
          const alreadyGranted = await getAlreadyGranted(supabase, userId);
          const maxGranted = alreadyGranted.size > 0 ? Math.max(...alreadyGranted) : -1;
          const crossed = getMilestonesCrossed(previousStreak, newStreak).filter(
            (m) => m > maxGranted
          );
          const grantSuccess = await grantMilestoneJokersForCrossed(
            supabase,
            userId,
            previousStreak,
            newStreak
          );
          const milestoneToCelebrate = crossed.length > 0 ? crossed[0] : null;
          await new Promise((resolve) => setTimeout(resolve, 300));
          if (crossed.length > 0 && milestoneToCelebrate) {
            setPendingStreakMilestone(milestoneToCelebrate);
          }
          // Run refetch in background so modal can paint; awaiting here blocked the JS thread and prevented the streak popup from showing.
          if (grantSuccess) void refetchProfile();
        } catch (e) {
          console.error("[Today submit] Milestone flow error", e);
        }
      } catch (e: unknown) {
        const err = e as {
          message?: string;
          code?: string;
          details?: string;
        };
        console.error("[Today submit] Supabase error:", {
          message: err?.message,
          code: err?.code,
          details: err?.details,
          full: e,
        });
        setSubmitError(t("today_submit_error"));
      } finally {
        setSubmitting(false);
      }
    },
    [
      userId,
      question,
      existingAnswer,
      t,
      setAnswerForDay,
      refetchProfile,
      showMilestone,
      effectiveUser?.created_at,
    ]
  );

  const hasAnswer = existingAnswer != null && existingAnswer.length > 0;
  const todayDateLabel = useMemo(() => {
    if (!question?.day) return "";
    const [y, m, d] = question.day.split("-").map(Number);
    if (!y || !m || !d) return "";
    const dt = new Date(y, m - 1, d);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(dt);
  }, [question?.day]);
  const handleInvite = useCallback(async () => {
    if (!profile?.referral_code) return;
    const link = `https://dailyqapp.com/invite/${profile.referral_code}`;
    try {
      await Share.share({
        message: `Answer one question a day — and see who you were a year from now. Join me on DailyQ: ${link}`,
        url: link,
      });
      logEvent("invite_shared");
    } catch (e) {
      console.error("[Today] Share error:", e);
    }
  }, [profile?.referral_code]);

  if (questionLoading) {
    return <DailyQLoadingScreen />;
  }

  if (questionError || !question) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>
          {questionError ?? t("today_no_question")}
        </Text>
        <Text style={styles.hintText}>{t("today_come_back_tomorrow")}</Text>
      </View>
    );
  }

  return (
    <GlassCardContainer>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={[styles.container, { paddingTop: insets.top }]}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Pressable
                onPress={() => void handleInvite()}
                style={({ pressed }) => [styles.inviteIconButton, pressed && styles.inviteIconButtonPressed]}
              >
                <LinearGradient
                  colors={["rgba(139,92,246,0.96)", "rgba(124,58,237,0.96)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.inviteIconGradient}
                >
                  <MaterialCommunityIcons name="account-plus" size={20} color="#FFFFFF" />
                </LinearGradient>
              </Pressable>
            </View>
            <View style={styles.headerRight}>
              <JokerBadge
                count={profile?.joker_balance ?? 0}
                onPress={() => setJokerModalVisible(true)}
              />
            </View>
          </View>

          <View style={styles.mainContent}>
            {dayNumber !== null && (
              <View style={styles.progressSection}>
                <View style={styles.progressRow}>
                  <Text style={styles.progressLabel}>Dag {dayNumber} van 365</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.min((dayNumber / 365) * 100, 100)}%` }]} />
                </View>
                <View style={styles.statsRow}>
                  <View style={styles.statPill}>
                    <Text style={styles.statPillNumber}>{currentStreak}</Text>
                    <Text style={styles.statPillLabel}>streak</Text>
                  </View>
                  <View style={styles.statPill}>
                    <Text style={styles.statPillNumber}>{answerCount}</Text>
                    <Text style={styles.statPillLabel}>antwoorden</Text>
                  </View>
                  <View style={styles.statPill}>
                    <Text style={styles.statPillNumber}>{Math.max(0, 365 - dayNumber)}</Text>
                    <Text style={styles.statPillLabel}>dagen te gaan</Text>
                  </View>
                </View>
              </View>
            )}
            <Animated.View style={styles.centerBlock}>
              <Animated.View
                style={[{ width: "100%" }, { transform: [{ translateY: questionBlockOffset }] }]}
              >
                {hasAnswer ? (
                  <View style={styles.questionBlock}>
                    <View style={styles.questionEyebrowRow}>
                      <Text style={styles.questionEyebrow}>Vraag van vandaag</Text>
                      <TouchableOpacity
                        style={styles.shareButton}
                        onPress={() => { logEvent("answer_shared"); shareCard(); }}
                      >
                        <Feather name="upload" size={18} color="#7C3AED" />
                      </TouchableOpacity>
                    </View>
                    <Text style={[styles.questionText, styles.questionTextDone]}>{question.text}</Text>
                  </View>
                ) : (
                  <View style={styles.questionBlock}>
                    <Text style={styles.questionEyebrow}>Vraag van vandaag</Text>
                    <Text style={styles.questionText}>{question.text}</Text>
                  </View>
                )}
              </Animated.View>
              <View style={styles.questionDivider} />
              <Animated.View
                style={[
                  styles.buttonArea,
                  { opacity: buttonOpacity, transform: [{ scale: buttonScale }] },
                ]}
              >
                {hasAnswer ? (
                  <Pressable
                    onPress={() => setAnswerModalOpen(true)}
                    style={({ pressed }) => [
                      styles.editAnswerButton,
                      pressed && styles.editAnswerButtonPressed,
                    ]}
                  >
                    <Text style={styles.editAnswerButtonText}>{t("today_edit_answer")}</Text>
                  </Pressable>
                ) : (
                  <PrimaryButton
                    fullWidth
                    onPress={() => setAnswerModalOpen(true)}
                    gradientColors={TODAY_PRIMARY_GRADIENT}
                  >
                    {t("today_answer_question")}
                  </PrimaryButton>
                )}
              </Animated.View>
            </Animated.View>
          </View>

          <View style={styles.tabBarSpacer} />

          <AnsweringExperience
            isOpen={answerModalOpen}
            onClose={() => {
              setAnswerModalOpen(false);
              setSubmitError(null);
            }}
            onComplete={(answer) => submitAnswer(answer)}
            question={question.text}
            initialAnswer={existingAnswer ?? ""}
            dayKey={question.day}
            contextLabel={t("today_question_label")}
            placeholder={t("today_placeholder")}
            submitError={submitError}
            submitting={submitting}
          />

          <JokerModalBottomSheet
            visible={jokerModalVisible}
            onClose={() => setJokerModalVisible(false)}
            jokerBalance={profile?.joker_balance ?? 0}
            t={t}
          />
          <SubmitSuccessModal visible={showSubmitSuccess} />
          <AccountMilestoneModal
            visible={activeModal === "milestone"}
            daysSinceCreation={accountMilestoneDaysSinceCreation}
            answers={milestoneAnswers}
            onClose={handleMilestoneClose}
          />
          {recapData ? (
            <>
              <MonthlyRecapModal
                visible={activeModal === "monthlyRecap"}
                recapData={recapData}
                onClose={handleRecapClose}
                onShare={() => void monthlyRecapShareCardRef.current?.triggerShare()}
              />
              <View style={styles.monthlyRecapShareCapture} pointerEvents="none" collapsable={false}>
                <MonthlyRecapShareCard
                  ref={monthlyRecapShareCardRef}
                  recapData={recapData}
                  lang={lang}
                />
              </View>
            </>
          ) : null}
          <PreviousYearModal
            visible={activeModal === "previousYear"}
            items={previousYearQueue?.items ?? []}
            currentAnswer={previousYearQueue?.current ?? null}
            questionText={previousYearQueue?.questionText ?? ""}
            onClose={handlePreviousYearClose}
          />
          <EditConfirmModal visible={editConfirmVisible} message={t("today_answer_changed")} />
        </View>
      </TouchableWithoutFeedback>
      {hasAnswer ? (
        <ShareCaptureModal visible={shareCaptureVisible}>
          <ShareCard
            ref={shareCardRefCallback}
            question={question.text}
            answer={existingAnswer ?? ""}
            dateLabel={todayDateLabel}
          />
        </ShareCaptureModal>
      ) : null}
    </GlassCardContainer>
  );
}

function EditConfirmModal({ visible, message }: { visible: boolean; message: string }) {
  const opacity = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (visible) {
      opacity.setValue(0);
      Animated.timing(opacity, {
        toValue: 1,
        duration: MODAL_ENTER_MS,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, opacity]);
  if (!visible) return null;
  return (
    <Modal transparent visible animationType="none">
      <Animated.View style={[editConfirmStyles.backdrop, { opacity }]}>
        <View style={editConfirmStyles.card}>
          <Text style={editConfirmStyles.text}>{message}</Text>
        </View>
      </Animated.View>
    </Modal>
  );
}

const editConfirmStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 28,
  },
  card: {
    ...MODAL.CARD,
    alignItems: "center",
  },
  text: {
    fontSize: 17,
    color: COLORS.TEXT_PRIMARY,
    fontWeight: "500",
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  buttonArea: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
    marginTop: 16,
  },
  inviteIconButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9999,
    overflow: "hidden",
  },
  inviteIconGradient: {
    minHeight: 30,
    minWidth: 56,
    paddingVertical: 6,
    paddingHorizontal: 15,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: "rgba(109, 40, 217, 0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  inviteIconButtonPressed: {
    opacity: 0.7,
  },
  tabBarSpacer: {
    height: 92,
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  centerBlock: {
    width: "100%",
    marginTop: 40,
  },
  bottomBarKAV: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: "transparent",
  },
  bottomBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  barInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    backgroundColor: "rgba(255,255,255,0.85)",
    fontSize: 16,
    color: COLORS.TEXT_PRIMARY,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  barSubmitButton: {
    minWidth: 88,
    width: 108,
  },
  barSubmitButtonText: {
    fontSize: 12,
  },
  bottomBarMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  shareButton: {
    padding: 4,
  },
  editAnswerButton: {
    width: "100%",
    paddingVertical: 16,
    minHeight: 52,
    borderRadius: 9999,
    backgroundColor: "#E5E5EA",
    borderWidth: 1,
    borderColor: "#D1D1D6",
    alignItems: "center",
    justifyContent: "center",
  },
  editAnswerButtonPressed: {
    opacity: 0.75,
  },
  editAnswerButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6E6E73",
  },
  primaryButton: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 9999,
    backgroundColor: COLORS.ACCENT,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    shadowColor: COLORS.ACCENT,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryButtonPressed: {
    opacity: 0.9,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  cancelEditButton: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  cancelEditButtonText: {
    fontSize: 15,
    color: COLORS.TEXT_SECONDARY,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.BACKGROUND,
    padding: 24,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 12,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.TEXT_PRIMARY,
    textAlign: "center",
  },
  hintText: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 8,
    textAlign: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginTop: 4,
    minHeight: 32,
  },
  headerLeft: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
  },
  headerRight: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
  },
  jokerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(254,243,199,0.9)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.4)",
  },
  jokerCount: {
    fontSize: 15,
    fontWeight: "700",
    color: JOKER.TEXT,
  },
  questionText: {
    fontSize: 26,
    fontWeight: "600",
    color: "#1F1135",
    lineHeight: 34,
    letterSpacing: -0.4,
  },
  questionTextDone: {
    opacity: 0.45,
  },
  charCount: {
    fontSize: 12,
    color: COLORS.TEXT_MUTED,
    marginBottom: 16,
    textAlign: "right",
  },
  submitButton: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 9999,
    backgroundColor: COLORS.ACCENT,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    shadowColor: COLORS.ACCENT,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: "#9CA3AF",
    shadowOpacity: 0,
  },
  submitButtonPressed: {
    opacity: 0.9,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  submitError: {
    fontSize: 14,
    color: "#DC2626",
    marginTop: 12,
    textAlign: "center",
  },
  readyText: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.TEXT_PRIMARY,
  },
  monthlyRecapShareCapture: {
    position: "absolute",
    left: -9999,
    top: -9999,
    opacity: 0.02,
  },
  questionAreaWrapper: {
    justifyContent: "center",
    width: "100%",
  },
  questionBlock: {
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 24,
  },
  questionEyebrowRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  questionEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    color: "#7C3AED",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    opacity: 0.7,
    marginBottom: 12,
  },
  questionDivider: {
    height: 1,
    backgroundColor: "rgba(139,92,246,0.15)",
    marginBottom: 14,
  },
  progressSection: {
    position: "absolute",
    top: "10%",
    left: 0,
    right: 0,
    paddingHorizontal: 20,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6D28D9",
    letterSpacing: 0.2,
  },
  progressCount: {
    fontSize: 12,
    fontWeight: "600",
    color: "#7C3AED",
    opacity: 0.7,
  },
  progressTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(139,92,246,0.15)",
    overflow: "hidden",
    marginBottom: 12,
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#7C3AED",
  },
  statsRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 0,
  },
  statPill: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.6)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.12)",
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignItems: "center",
  },
  statPillNumber: {
    fontSize: 16,
    fontWeight: "700",
    color: "#6D28D9",
    lineHeight: 19,
  },
  statPillLabel: {
    fontSize: 8.5,
    fontWeight: "600",
    color: "#7C3AED",
    opacity: 0.65,
    letterSpacing: 0.3,
    marginTop: 2,
    textTransform: "uppercase",
  },
});
