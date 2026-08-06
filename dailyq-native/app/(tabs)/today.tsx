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
  useWindowDimensions,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router/react-navigation";
import { useLocalSearchParams, useRouter } from "expo-router";

import { COLORS, JOKER, MODAL_ENTER_MS, MODAL_CLOSE_MS } from "@/src/config/constants";
import { useLanguage } from "@/src/context/LanguageContext";
import { useAuth } from "@/src/context/AuthContext";
import { useStreakMilestone, getAlreadyGranted, getHighestMilestoneCrossed, getMilestonesCrossed, grantMilestoneJokersForCrossed, STREAK_MILESTONES } from "@/src/context/StreakMilestoneContext";
import { useCalendarAnswersContext } from "@/src/context/CalendarAnswersContext";
import { useTodayQuestion } from "@/src/hooks/useTodayQuestion";
import { useProfileContext } from "@/src/context/ProfileContext";
import { daysSinceAccountCreated, resolveAccountMilestone } from "@/src/lib/accountMilestone";
import { shouldShowArchiveMoment } from "@/src/lib/archiveMoment";
import { supabase } from "@/src/config/supabase";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { JokerShopModal } from "@/src/components/JokerShopModal";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { GlassCardContainer } from "@/src/components/GlassCardContainer";
import { WidgetAnnouncementModal } from "@/src/components/modals/WidgetAnnouncementModal";
import { syncWidgetInstalledStatus } from "@/src/lib/widgetStatus";
import { reloadDailyQWidget } from "@/modules/dailyq-widget-status";
import {
  getWidgetAnnouncementDismissed,
  setWidgetAnnouncementDismissed,
} from "@/src/lib/widgetAnnouncement";
import DailyQLoadingScreen from "@/src/components/DailyQLoadingScreen";
import { AnsweringExperience } from "@/src/components/AnsweringExperience";
import { SubmitSuccessModal } from "@/src/components/SubmitSuccessModal";
import { AnswerTransitionVeil } from "@/src/components/AnswerTransitionVeil";
import ShareCard from "@/src/components/ShareCard";
import ShareCaptureModal from "@/src/components/ShareCaptureModal";
import AccountMilestoneModal, {
  type AccountMilestoneAnswer,
} from "@/src/components/modals/AccountMilestoneModal";
import ArchiveMomentModal from "@/src/components/modals/ArchiveMomentModal";
import PreviousYearModal from "@/src/components/modals/PreviousYearModal";
import MonthlyRecapModal from "@/src/components/modals/MonthlyRecapModal";
import MonthlyRecapShareCard, {
  type MonthlyRecapShareCardRef,
} from "@/src/components/MonthlyRecapShareCard";
import MissedDayModal from "@/src/components/modals/MissedDayModal";
import StreakOverviewModal from "@/src/components/modals/StreakOverviewModal";
import { useShareCard } from "@/src/hooks/useShareCard";
import { useMonthlyRecap } from "@/src/hooks/useMonthlyRecap";
import { getYesterdayDayKey } from "@/src/lib/date";
import { logEvent } from "@/lib/analytics";

const TODAY_PRIMARY_GRADIENT = ["rgba(139,92,246,0.96)", "rgba(124,58,237,0.96)"] as const;
const STREAK_RING_RADIUS = 13;
const STREAK_RING_CIRCUMFERENCE = 2 * Math.PI * STREAK_RING_RADIUS;
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

async function markArchiveMomentShown(userId: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ archive_moment_day4_shown: true })
    .eq("id", userId);
  if (error) {
    console.error("[Today] Archive moment profile update:", error);
  }
}

async function markWidgetAnnouncementShown(userId: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ widget_announcement_dismissed: true })
    .eq("id", userId);
  if (error) {
    console.error("[Today] Widget announcement profile update:", error);
    throw error;
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

/** True when the user has no answer at all (onboarding or real) for yesterday. */
async function checkMissedYesterday(userId: string): Promise<boolean> {
  const yesterdayKey = getYesterdayDayKey();
  const { data, error } = await supabase
    .from("answers")
    .select("question_date")
    .eq("user_id", userId)
    .eq("question_date", yesterdayKey)
    .maybeSingle();
  if (error) {
    console.error("[Today] Missed-yesterday check failed:", error);
    return false;
  }
  return data == null;
}

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
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
  const { openAnswer, source } = useLocalSearchParams<{ openAnswer?: string; source?: string }>();
  const openedFromWidgetRef = useRef(false);
  useEffect(() => {
    if (openAnswer === "1") {
      setAnswerModalOpen(true);
    }
    if (source === "widget") {
      openedFromWidgetRef.current = true;
      logEvent("widget_opened");
    }
  }, [openAnswer, source]);

  const [widgetAnnouncementDismissed, setWidgetAnnouncementDismissedState] = useState(true);
  useEffect(() => {
    if (!userId || userId === "dev-user") return;
    let cancelled = false;
    getWidgetAnnouncementDismissed(userId).then((dismissed) => {
      if (!cancelled) setWidgetAnnouncementDismissedState(dismissed);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);
  // Repairs profiles where the device already recorded "shown" (AsyncStorage)
  // but the DB write never persisted (e.g. dropped fire-and-forget request) —
  // without this, the flag stays false in the DB forever since the modal
  // never re-queues locally to trigger another write attempt.
  useEffect(() => {
    if (!userId || userId === "dev-user") return;
    if (!widgetAnnouncementDismissed) return;
    if (profile?.widget_announcement_dismissed === true) return;
    if (profile == null) return;
    markWidgetAnnouncementShown(userId)
      .then(() => refetchProfile())
      .catch((error) => {
        console.error("[Today] Widget announcement reconciliation failed:", error);
      });
  }, [userId, widgetAnnouncementDismissed, profile, refetchProfile]);
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      void syncWidgetInstalledStatus(userId, profile?.widget_installed).then((installed) => {
        if (installed !== null) void refetchProfile();
      });
      // Forces a widget refresh on every app open, so a widget stuck on the
      // "open DailyQ" fallback (e.g. after a failed overnight refresh) recovers
      // immediately instead of waiting for its own daily/retry schedule.
      reloadDailyQWidget();
    }, [userId, profile?.widget_installed, refetchProfile])
  );
  const shouldQueueWidgetAnnouncement =
    profile?.widget_installed !== true &&
    profile?.widget_announcement_dismissed !== true &&
    !widgetAnnouncementDismissed;
  const [showSubmitSuccess, setShowSubmitSuccess] = useState(false);
  const [transitionVeilVisible, setTransitionVeilVisible] = useState(false);
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
  const [pendingArchiveMoment, setPendingArchiveMoment] = useState(false);
  const [archiveMomentAnswers, setArchiveMomentAnswers] = useState<AccountMilestoneAnswer[]>([]);
  const [editConfirmVisible, setEditConfirmVisible] = useState(false);
  const [jokerModalVisible, setJokerModalVisible] = useState(false);
  const [streakOverviewVisible, setStreakOverviewVisible] = useState(false);
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

  const fetchCurrentStreak = useCallback(() => {
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
    fetchCurrentStreak();
  }, [fetchCurrentStreak]);

  // Refetch when Today tab gains focus (e.g. after answering a missed day
  // with a joker from the Calendar tab — that flow updates calendar's own
  // state, not Today's, so Today must re-pull on return).
  useFocusEffect(
    useCallback(() => {
      fetchCurrentStreak();
    }, [fetchCurrentStreak])
  );

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
  const pendingPostCloseActionRef = useRef<"celebrate" | "toast" | null>(null);
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

      // Checked right after streak/milestone (our strongest, most relevant
      // monetization/re-engagement moment) rather than last — queued behind
      // archiveMoment/monthlyRecap/widgetAnnouncement it used to get buried by
      // modal fatigue before the user ever saw it.
      if (userId && userId !== "dev-user") {
        const missedYesterday = await checkMissedYesterday(userId);
        if (cancelled) return;
        if (missedYesterday) {
          queue.push("missedDay");
        }
      }

      if (pendingArchiveMoment) {
        if (!userId || userId === "dev-user") {
          if (!cancelled) setPendingArchiveMoment(false);
        } else {
          const mapped = await fetchAccountMilestoneAnswersForModal(userId, lang);
          if (cancelled) return;
          if (mapped != null) {
            setArchiveMomentAnswers(mapped);
            queue.push("archiveMoment");
          }
          setPendingArchiveMoment(false);
        }
      }

      if (showRecap) {
        queue.push("monthlyRecap");
      }

      if (shouldQueueWidgetAnnouncement) {
        queue.push("widgetAnnouncement");
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
    editConfirmVisible,
    pendingStreakMilestone,
    pendingMilestone,
    pendingArchiveMoment,
    userId,
    lang,
    showRecap,
    previousYearQueue,
    shouldQueueWidgetAnnouncement,
    advanceQueue,
  ]);

  const handleWidgetAnnouncementClose = useCallback(() => {
    logEvent("widget_announcement_dismissed");
    advanceQueue(modalQueue);
  }, [modalQueue, advanceQueue]);
  useEffect(() => {
    if (activeModal !== "widgetAnnouncement") return;
    logEvent("widget_announcement_shown");
    setWidgetAnnouncementDismissedState(true);
    if (!userId || userId === "dev-user") return;
    (async () => {
      try {
        await setWidgetAnnouncementDismissed(userId);
        await markWidgetAnnouncementShown(userId);
        refetchProfile();
      } catch (error) {
        console.error("[Today] Widget announcement shown-persist failed:", error);
      }
    })();
  }, [activeModal, userId, refetchProfile]);

  useEffect(() => {
    if (activeModal === "missedDay") {
      logEvent("missed_day_modal_shown");
    }
  }, [activeModal]);

  const handleMissedDayClose = useCallback(() => {
    advanceQueue(modalQueue);
  }, [modalQueue, advanceQueue]);

  const handleMissedDayAnswer = useCallback(() => {
    logEvent("missed_day_modal_accepted");
    advanceQueue(modalQueue);
    if ((profile?.joker_balance ?? 0) > 0) {
      router.push({
        pathname: "/(tabs)/calendar",
        params: { openMissedDay: getYesterdayDayKey() },
      });
    } else {
      // At 0 jokers the CTA already reads "Buy or earn jokers" — routing to
      // Calendar would just re-show JokerOfferModal with that exact same CTA
      // again, a redundant extra tap. Open the shop directly instead.
      setJokerModalVisible(true);
    }
  }, [modalQueue, advanceQueue, router, profile?.joker_balance]);

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

  const handleArchiveMomentClose = useCallback(async () => {
    if (userId && userId !== "dev-user") {
      await markArchiveMomentShown(userId);
      void refetchProfile();
    }
    advanceQueue(modalQueue);
  }, [userId, refetchProfile, modalQueue, advanceQueue]);

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
          const freshProfile = await refetchProfile();
          if (freshProfile) {
            const createdAtForMilestone =
              freshProfile.created_at ?? effectiveUser?.created_at ?? null;
            const milestoneToShow = resolveAccountMilestone(createdAtForMilestone, {
              milestone_10_days_shown: freshProfile.milestone_10_days_shown ?? false,
            });
            setPendingMilestone(milestoneToShow);
            setPendingArchiveMoment(
              shouldShowArchiveMoment(
                createdAtForMilestone,
                freshProfile.archive_moment_day4_shown ?? false
              )
            );
            if (createdAtForMilestone) {
              setProfileCreatedAtForMilestone(createdAtForMilestone);
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
        // Deliberately NOT calling setExistingAnswer/setAnswerText yet: that
        // feeds AnsweringExperience's `initialAnswer` prop, which sits in its
        // open/close effect's dependency array. Updating it now, before the
        // streak RPC below resolves, would change it while isOpen is still
        // true — retriggering that effect's "open" branch mid-close: the
        // card resets its slide position and replays the slide-up animation
        // instead of just closing. Set together with setAnswerModalOpen(false)
        // instead, once isOpen is genuinely about to flip false.

        // Fetch the fresh streak before showing the celebration so its digit
        // roll can count up to the real number on the very first frame.
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
        logEvent("answer_submitted", {
          is_edit: wasUpdate,
          streak: newStreak,
          source: openedFromWidgetRef.current ? "widget" : "app",
        });

        setExistingAnswer(trimmed);
        setAnswerText(trimmed);
        // Editing an existing answer is a quick correction, not a fresh daily
        // submission — it gets the small "antwoord bewerkt" toast, not the
        // full streak-roll celebration. handleAnswerModalClosed (passed as
        // AnsweringExperience's onClosed) reads this once the modal has
        // actually finished closing.
        pendingPostCloseActionRef.current = wasUpdate ? "toast" : "celebrate";
        setAnswerModalOpen(false);
        // AnsweringExperience keeps its native <Modal> presented for the
        // length of its own close animation — opening another native <Modal>
        // (SubmitSuccessModal) before that finishes gets it dismissed along
        // with the closing one. handleAnswerModalClosed only fires once it's
        // genuinely gone. That wait briefly exposes the real screen once
        // AnsweringExperience's Modal actually unmounts, so cover it with a
        // plain (non-Modal) veil in the meantime.
        setTransitionVeilVisible(true);

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

        try {
          const alreadyGranted = await getAlreadyGranted(supabase, userId);
          const crossed = getMilestonesCrossed(previousStreak, newStreak).filter(
            (m) => !alreadyGranted.has(m)
          );
          const grantSuccess = await grantMilestoneJokersForCrossed(
            supabase,
            userId,
            previousStreak,
            newStreak
          );
          // Celebrate only the highest crossed-and-ungranted milestone (avoid
          // stacking modals on a rare multi-milestone jump); all of them still
          // get their joker via grantMilestoneJokersForCrossed above.
          const milestoneToCelebrate = crossed.length > 0 ? crossed[crossed.length - 1] : null;
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

  const handleAnswerModalClosed = useCallback(() => {
    const action = pendingPostCloseActionRef.current;
    pendingPostCloseActionRef.current = null;
    if (action === "toast") {
      setEditConfirmVisible(true);
      setTimeout(() => setEditConfirmVisible(false), 2500);
      justSubmittedRef.current = true;
      setTimeout(() => setTransitionVeilVisible(false), 60);
    } else if (action === "celebrate") {
      setShowSubmitSuccess(true);
      setTimeout(() => setTransitionVeilVisible(false), 60);
    }
    // action === null: mount-time fire, or a plain cancel with nothing pending — no-op.
  }, []);

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
  const nextStreakMilestone = STREAK_MILESTONES.find((m) => m > currentStreak) ?? null;
  const streakProgressPercent =
    nextStreakMilestone != null ? Math.min(100, (currentStreak / nextStreakMilestone) * 100) : 100;
  const streakRingDashoffset = STREAK_RING_CIRCUMFERENCE * (1 - streakProgressPercent / 100);
  const dayProgressPercent =
    dayNumber != null ? Math.max(4, Math.min(100, (dayNumber / 365) * 100)) : 4;

  const statusRow = dayNumber !== null ? (
    <View style={styles.statusRow}>
      <View style={styles.statusBar}>
        <Pressable
          onPress={() => router.push("/(tabs)/archive")}
          style={({ pressed }) => [styles.statusDayCell, pressed && styles.statusCellPressed]}
        >
          <Text style={styles.statusDayText}>
            {dayNumber}
            <Text style={styles.statusDaySuffix}>/365</Text>
          </Text>
          <View style={styles.statusDayTrack}>
            <View style={[styles.statusDayFill, { width: `${dayProgressPercent}%` }]} />
          </View>
        </Pressable>
        <View style={styles.statusHairline} />
        <Pressable
          onPress={() => setStreakOverviewVisible(true)}
          style={({ pressed }) => [styles.statusStreakCell, pressed && styles.statusCellPressed]}
        >
          <View style={styles.statusStreakRingWrap}>
            <Svg width={32} height={32} style={styles.statusStreakRingSvg}>
              <Circle cx={16} cy={16} r={STREAK_RING_RADIUS} stroke="rgba(239,68,68,0.15)" strokeWidth={3} fill="none" />
              <Circle
                cx={16}
                cy={16}
                r={STREAK_RING_RADIUS}
                stroke="#EF4444"
                strokeWidth={3}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={STREAK_RING_CIRCUMFERENCE}
                strokeDashoffset={streakRingDashoffset}
              />
            </Svg>
            <MaterialCommunityIcons name="fire" size={15} color="#EF4444" />
          </View>
          <Text style={styles.statusStreakNum}>{currentStreak}</Text>
        </Pressable>
        <View style={styles.statusHairline} />
        <Pressable
          onPress={() => setJokerModalVisible(true)}
          style={({ pressed }) => [styles.statusJokerCell, pressed && styles.statusCellPressed]}
        >
          <View
            style={[
              styles.statusJokerChip,
              (profile?.joker_balance ?? 0) === 0 && styles.statusJokerChipEmpty,
            ]}
          >
            <MaterialCommunityIcons
              name={(profile?.joker_balance ?? 0) === 0 ? "crown-outline" : "crown"}
              size={16}
              color={(profile?.joker_balance ?? 0) === 0 ? "#9CA3AF" : "#FFFFFF"}
            />
          </View>
          <Text
            style={[
              styles.statusJokerNum,
              (profile?.joker_balance ?? 0) === 0 && styles.statusJokerNumEmpty,
            ]}
          >
            {profile?.joker_balance ?? 0}
          </Text>
        </Pressable>
      </View>
    </View>
  ) : null;

  if (questionLoading) {
    return <DailyQLoadingScreen />;
  }

  if (questionError || !question) {
    return (
      <GlassCardContainer>
        <View style={[styles.container, { paddingTop: insets.top }]}>
          {statusRow}
          <View style={styles.centered}>
            <Text style={styles.errorText}>
              {questionError ?? t("today_no_question")}
            </Text>
            <Text style={styles.hintText}>{t("today_come_back_tomorrow")}</Text>
          </View>
        </View>
        <JokerShopModal visible={jokerModalVisible} onClose={() => setJokerModalVisible(false)} />
      </GlassCardContainer>
    );
  }

  return (
    <GlassCardContainer>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={[styles.container, { paddingTop: insets.top }]}>
          {statusRow}

          <View style={styles.mainContent}>
            <Animated.View style={styles.centerBlock}>
              <Animated.View
                style={[{ width: "100%" }, { transform: [{ translateY: questionBlockOffset }] }]}
              >
                {hasAnswer ? (
                  <View style={styles.questionBlock}>
                    <Text style={styles.questionEyebrow}>{t("today_question_label")}</Text>
                    <Text style={[styles.questionText, styles.questionTextDone]}>{question.text}</Text>
                    <TouchableOpacity
                      style={styles.shareButton}
                      onPress={() => { logEvent("answer_shared"); shareCard(); }}
                    >
                      <Feather name="upload" size={15} color="#7C3AED" />
                      <Text style={styles.shareButtonText}>{t("today_share_answer")}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.questionBlock}>
                    <Text style={styles.questionEyebrow}>{t("today_question_label")}</Text>
                    <Text style={styles.questionText}>{question.text}</Text>
                  </View>
                )}
              </Animated.View>
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
            onClosed={handleAnswerModalClosed}
          />

          <AnswerTransitionVeil visible={transitionVeilVisible} />
          <SubmitSuccessModal
            visible={showSubmitSuccess}
            streak={currentStreak}
            onDismiss={() => setShowSubmitSuccess(false)}
          />
          <JokerShopModal visible={jokerModalVisible} onClose={() => setJokerModalVisible(false)} />
          <StreakOverviewModal
            visible={streakOverviewVisible}
            currentStreak={currentStreak}
            onClose={() => setStreakOverviewVisible(false)}
          />
          <AccountMilestoneModal
            visible={activeModal === "milestone"}
            daysSinceCreation={accountMilestoneDaysSinceCreation}
            answers={milestoneAnswers}
            onClose={handleMilestoneClose}
          />
          <ArchiveMomentModal
            visible={activeModal === "archiveMoment"}
            answers={archiveMomentAnswers}
            onClose={handleArchiveMomentClose}
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
          <WidgetAnnouncementModal
            visible={activeModal === "widgetAnnouncement"}
            onClose={handleWidgetAnnouncementClose}
          />
          <MissedDayModal
            visible={activeModal === "missedDay"}
            title={t("missed_day_modal_title")}
            body={
              (profile?.joker_balance ?? 0) > 0
                ? t("missed_day_modal_body")
                : t("missed_day_modal_body_no_jokers")
            }
            ctaLabel={
              (profile?.joker_balance ?? 0) > 0
                ? t("missed_day_modal_cta")
                : t("joker_offer_need_more")
            }
            hasJokers={(profile?.joker_balance ?? 0) > 0}
            onClose={handleMissedDayClose}
            onAnswer={handleMissedDayAnswer}
          />
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

/**
 * Small non-blocking toast (not a dialog) confirming an edited answer was
 * saved. Was previously a centered <Modal> card using
 * StyleSheet.absoluteFillObject for its backdrop with no explicit width/height
 * on the Modal root — Fabric doesn't reliably size that combination inside a
 * <Modal>, so it collapsed to a thin, misplaced strip near the top instead of
 * filling the screen. Fixed by sizing the root explicitly (useWindowDimensions,
 * same pattern used everywhere else in this app's modals) and redesigned as a
 * quiet toast near the tab bar instead of a full dark-backdrop dialog, since
 * it's just a passing confirmation, not something that needs confirming.
 */
function EditConfirmModal({ visible, message }: { visible: boolean; message: string }) {
  // Fabric doesn't reliably size flex:1/absoluteFillObject (right/bottom-based)
  // content inside <Modal> — needs explicit numeric width/height.
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const opacity = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(16)).current;
  const [rendered, setRendered] = React.useState(visible);

  React.useEffect(() => {
    if (visible) {
      setRendered(true);
      opacity.setValue(0);
      translateY.setValue(16);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: MODAL_ENTER_MS,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          friction: 8,
          tension: 100,
        }),
      ]).start();
      return;
    }
    Animated.timing(opacity, {
      toValue: 0,
      duration: MODAL_CLOSE_MS,
      useNativeDriver: true,
    }).start(() => setRendered(false));
  }, [visible, opacity, translateY]);

  if (!rendered) return null;

  return (
    <Modal transparent visible={rendered} animationType="none" statusBarTranslucent>
      <View
        style={[editConfirmStyles.root, { width, height, paddingBottom: 92 + insets.bottom + 12 }]}
        pointerEvents="none"
      >
        <Animated.View
          style={[editConfirmStyles.toast, { opacity, transform: [{ translateY }] }]}
        >
          <View style={editConfirmStyles.iconCircle}>
            <Feather name="check" size={13} color="#fff" strokeWidth={3} />
          </View>
          <Text style={editConfirmStyles.text}>{message}</Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const editConfirmStyles = StyleSheet.create({
  root: {
    position: "absolute",
    top: 0,
    left: 0,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 6,
  },
  iconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontSize: 15,
    color: COLORS.TEXT_PRIMARY,
    fontWeight: "600",
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
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  shareButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#7C3AED",
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
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 2,
  },
  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.8)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(31,41,55,0.08)",
    overflow: "hidden",
  },
  statusHairline: {
    width: 1,
    alignSelf: "stretch",
    marginVertical: 11,
    backgroundColor: "rgba(31,41,55,0.1)",
  },
  statusCellPressed: {
    opacity: 0.6,
  },
  statusDayCell: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    gap: 6,
  },
  statusDayText: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.TEXT_PRIMARY,
  },
  statusDaySuffix: {
    fontSize: 17,
    fontWeight: "600",
    color: "#9CA3AF",
  },
  statusDayTrack: {
    alignSelf: "stretch",
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(139,92,246,0.15)",
    overflow: "hidden",
  },
  statusDayFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: COLORS.ACCENT,
  },
  statusStreakCell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  statusStreakRingWrap: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  statusStreakRingSvg: {
    position: "absolute",
    top: 0,
    left: 0,
    transform: [{ rotate: "-90deg" }],
  },
  statusStreakNum: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.TEXT_PRIMARY,
  },
  statusJokerCell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  statusJokerChip: {
    width: 29,
    height: 29,
    borderRadius: 14.5,
    backgroundColor: "#FFC700",
    alignItems: "center",
    justifyContent: "center",
  },
  statusJokerChipEmpty: {
    backgroundColor: "#E5E7EB",
  },
  statusJokerNumEmpty: {
    color: "#9CA3AF",
  },
  statusJokerNum: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.TEXT_PRIMARY,
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
    fontSize: 24,
    fontWeight: "600",
    color: "#1F1135",
    lineHeight: 31,
    letterSpacing: -0.4,
    textAlign: "center",
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
    alignItems: "center",
    position: "relative",
  },
  questionEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    color: "#7C3AED",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    opacity: 0.7,
    marginBottom: 12,
    textAlign: "center",
  },
});
