import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  TextInput,
  Animated,
  Modal,
  ScrollView,
  PanResponder,
  Dimensions,
  Platform,
  Keyboard,
} from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";

import {
  COLORS,
  CALENDAR,
  CALENDAR_JOKER,
  JOKER,
  MODAL,
  MODAL_ENTER_MS,
  MODAL_CLOSE_MS,
} from "@/src/config/constants";

const STREAK_MILESTONES = [7, 14, 30, 60, 100, 180, 365];
import { useLanguage } from "@/src/context/LanguageContext";
import { useAuth } from "@/src/context/AuthContext";
import { useProfileContext } from "@/src/context/ProfileContext";
import {
  useCalendarAnswers,
  type CalendarAnswerEntry,
} from "@/src/context/CalendarAnswersContext";
import { getNow, getLocalDayKey } from "@/src/lib/date";
import { supabase } from "@/src/config/supabase";
import { JokerModal } from "@/src/components/JokerModal";
import JokerOfferModal from "@/src/components/JokerOfferModal";
import { JokerBadge } from "@/src/components/JokerBadge";
import { GlassCardContainer } from "@/src/components/GlassCardContainer";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { AnsweringExperience } from "@/src/components/AnsweringExperience";
import { SubmitSuccessModal } from "@/src/components/SubmitSuccessModal";
import { useStreakMilestone, getHighestMilestoneCrossed, getMilestonesCrossed, grantMilestoneJokersForCrossed } from "@/src/context/StreakMilestoneContext";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import AnimatedReanimated, {
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  Easing,
} from "react-native-reanimated";

const GRID_ROWS = 6;
const GRID_COLS = 7;
const MISSED_ANSWER_DAYS_CAP = 30;

/** Short weekday labels (Mon–Sun) in the given locale. */
function getWeekdayLabels(lang: string): string[] {
  const locale = lang === "nl" ? "nl-NL" : "en-US";
  const labels: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(2024, 11, 2 + i);
    labels.push(d.toLocaleDateString(locale, { weekday: "short" }));
  }
  return labels;
}

type CellState = "today" | "answered" | "joker" | "missed" | "future" | "before";

function getMonthLabel(yearMonth: string, lang: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString(lang === "nl" ? "nl-NL" : "en-US", {
    month: "long",
    year: "numeric",
  });
}

function getMonthNameOnly(yearMonth: string, lang: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString(lang === "nl" ? "nl-NL" : "en-US", { month: "long" });
}

function getDayKeyDisplayLabel(dayKey: string, lang: string): string {
  const [y, m, day] = dayKey.split("-").map(Number);
  const d = new Date(y, m - 1, day);
  return d.toLocaleDateString(lang === "nl" ? "nl-NL" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function isBeforeAccountStart(dayKey: string, accountCreatedAt: string | undefined): boolean {
  if (!accountCreatedAt) return false;
  const createdDate = accountCreatedAt.slice(0, 10);
  return dayKey < createdDate;
}

function getDaysInMonthGrid(yearMonth: string): { dayKey: string | null; dayNum: number }[] {
  const [y, m] = yearMonth.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const last = new Date(y, m, 0);
  const firstWeekday = (first.getDay() + 6) % 7;
  const lastDay = last.getDate();
  const cells: { dayKey: string | null; dayNum: number }[] = [];
  const total = GRID_ROWS * GRID_COLS;
  for (let i = 0; i < total; i++) {
    if (i < firstWeekday) {
      cells.push({ dayKey: null, dayNum: 0 });
    } else {
      const dayNum = i - firstWeekday + 1;
      if (dayNum > lastDay) {
        cells.push({ dayKey: null, dayNum: 0 });
      } else {
        const dayKey = `${y}-${String(m).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
        cells.push({ dayKey, dayNum });
      }
    }
  }
  return cells;
}

function getCellState(
  dayKey: string,
  todayKey: string,
  entry: CalendarAnswerEntry | undefined,
  accountCreatedAt?: string
): CellState {
  if (dayKey > todayKey) return "future";
  if (entry) return entry.isJoker ? "joker" : "answered";
  if (dayKey === todayKey) return "today";
  if (accountCreatedAt && isBeforeAccountStart(dayKey, accountCreatedAt)) return "before";
  return "missed";
}

function isWithinMissedAnswerWindow(dayKey: string, todayKey: string): boolean {
  const a = new Date(dayKey + "T12:00:00");
  const b = new Date(todayKey + "T12:00:00");
  const diff = Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
  return diff >= 0 && diff <= MISSED_ANSWER_DAYS_CAP - 1;
}

const SHEET_HEIGHT = Dimensions.get("window").height * 0.78;

// ----- ViewAnswerModal (bottom sheet) -----
function ViewAnswerModal({
  visible,
  dayKey,
  entry,
  allYearsEntries,
  allYearsLoading,
  onClose,
}: {
  visible: boolean;
  dayKey: string | null;
  entry: CalendarAnswerEntry | null;
  /** When set, show all years for this MM-DD (oldest first). */
  allYearsEntries: { year: string; answer: string }[] | null;
  allYearsLoading: boolean;
  onClose: () => void;
}) {
  const { t, lang } = useLanguage();
  const backdropOpacity = useSharedValue(0);
  const slideY = useSharedValue(SHEET_HEIGHT);
  const dragY = useSharedValue(0);

  const closeModal = useCallback(() => onClose(), [onClose]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(10)
        .onUpdate((e) => {
          if (e.translationY > 0) {
            dragY.value = e.translationY;
          }
        })
        .onEnd((e) => {
          const threshold = 120;
          const velocityThreshold = 400;
          const shouldDismiss =
            dragY.value > threshold || e.velocityY > velocityThreshold;
          if (shouldDismiss) {
            const currentY = slideY.value + dragY.value;
            slideY.value = currentY;
            dragY.value = 0;
            backdropOpacity.value = withTiming(0, { duration: 180 });
            slideY.value = withTiming(
              SHEET_HEIGHT,
              { duration: 220, easing: Easing.inOut(Easing.cubic) },
              (finished) => {
                if (finished) runOnJS(closeModal)();
              }
            );
          } else {
            dragY.value = withSpring(0, { damping: 20, stiffness: 300 });
          }
        }),
    [backdropOpacity, slideY, dragY, closeModal]
  );

  useEffect(() => {
    if (visible) {
      dragY.value = 0;
      slideY.value = SHEET_HEIGHT;
      backdropOpacity.value = 0;
      slideY.value = withSpring(0, { damping: 22, stiffness: 140, mass: 0.8 });
      backdropOpacity.value = withTiming(1, { duration: 200 });
    }
  }, [visible, slideY, backdropOpacity, dragY]);

  const handleClose = useCallback(() => {
    backdropOpacity.value = withTiming(0, { duration: MODAL_CLOSE_MS });
    slideY.value = withTiming(
      SHEET_HEIGHT,
      { duration: 250, easing: Easing.inOut(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(closeModal)();
      }
    );
  }, [closeModal, backdropOpacity, slideY]);

  const dateLabel =
    dayKey
      ? (() => {
          const [y, m, d] = dayKey.split("-").map(Number);
          return new Date(y, m - 1, d).toLocaleDateString(lang === "nl" ? "nl-NL" : "en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          });
        })()
      : "";
  const sheetData =
    dayKey && (entry || (allYearsEntries && allYearsEntries.length > 0))
      ? {
          question: entry?.questionText ?? "",
          answers:
            allYearsEntries && allYearsEntries.length > 0
              ? allYearsEntries
              : entry
                ? [{ year: dayKey.slice(0, 4), answer: entry.answerText }]
                : [],
        }
      : null;

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideY.value + dragY.value }],
  }));

  if (!visible) return null;
  return (
    <Modal transparent visible={visible} animationType="none">
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
        <AnimatedReanimated.View style={[styles.modalBackdrop, backdropStyle]}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(76, 29, 149, 0.25)" }]}
            pointerEvents="none"
          />
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
          <GestureDetector gesture={panGesture}>
          <AnimatedReanimated.View
            style={[styles.bottomSheet, sheetStyle]}
            pointerEvents="box-none"
          >
            <View style={[StyleSheet.absoluteFillObject, styles.bottomSheetBlobWrap]}>
              <View style={[styles.bottomSheetBlob, styles.bottomSheetBlobPurple]} />
              <View style={[styles.bottomSheetBlob, styles.bottomSheetBlobAmber]} />
              <View style={[styles.bottomSheetBlob, styles.bottomSheetBlobBlue]} />
            </View>

            <View style={styles.bottomSheetHandleWrap}>
              <View style={styles.bottomSheetHandle} />
            </View>

            <View style={styles.bottomSheetHeader}>
              <Pressable onPress={handleClose} style={styles.bottomSheetCloseBtn}>
                <Feather name="x" size={18} color="#7C3AED" strokeWidth={2.5} />
              </Pressable>
              <Text style={styles.bottomSheetDateLabel}>{dateLabel}</Text>
              {sheetData ? (
                <Text style={styles.bottomSheetQuestion} numberOfLines={3}>
                  {sheetData.question}
                </Text>
              ) : null}
            </View>

            <ScrollView
              style={styles.bottomSheetScroll}
              contentContainerStyle={styles.bottomSheetScrollContent}
              showsVerticalScrollIndicator={true}
            >
              {allYearsLoading ? (
                <View style={styles.bottomSheetLoadingWrap}>
                  <ActivityIndicator size="small" color={COLORS.ACCENT} />
                </View>
              ) : (
                sheetData?.answers.map((item, index) => (
                  <AnimatedReanimated.View
                    key={item.year}
                    entering={FadeInUp.delay(250 + index * 700).duration(260)}
                    style={styles.bottomSheetYearCard}
                  >
                    <Text style={styles.bottomSheetYearLabel}>{item.year}</Text>
                    <Text style={styles.bottomSheetYearAnswer}>{item.answer}</Text>
                  </AnimatedReanimated.View>
                ))
              )}
            </ScrollView>
          </AnimatedReanimated.View>
          </GestureDetector>
        </AnimatedReanimated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

// ----- MissedDayModal -----
function MissedDayModal({
  visible,
  dayKey,
  canUseJoker,
  jokerCount,
  withinWindow,
  onClose,
  onUseJoker,
}: {
  visible: boolean;
  dayKey: string | null;
  canUseJoker: boolean;
  jokerCount: number;
  withinWindow: boolean;
  onClose: () => void;
  onUseJoker: () => void;
}) {
  const { t } = useLanguage();
  const opacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    } else {
      Animated.timing(opacity, { toValue: 0, duration: MODAL_CLOSE_MS, useNativeDriver: true }).start();
    }
  }, [visible, opacity]);

  if (!visible) return null;
  return (
    <Modal transparent visible={visible} animationType="none">
      <Animated.View style={[styles.modalBackdrop, styles.missedDayBackdrop, { opacity }]}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(76, 29, 149, 0.25)" }]}
          pointerEvents="none"
        />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.modalCard}>
          <Pressable style={MODAL.CLOSE_BUTTON} onPress={onClose}>
            <Feather name="x" size={18} color={COLORS.TEXT_SECONDARY} strokeWidth={2.5} />
          </Pressable>
          <Text style={styles.modalTitle}>{t("missed_title")}</Text>
          {!withinWindow ? (
            <>
              <Text style={styles.modalBody}>{t("closed_body")}</Text>
              <Text style={styles.modalSubtitle}>{t("closed_title")}</Text>
            </>
          ) : !canUseJoker || jokerCount <= 0 ? (
            <Text style={styles.modalBody}>{t("missed_no_jokers_body")}</Text>
          ) : (
            <>
              <Text style={styles.modalBody}>{t("missed_use_joker_message")}</Text>
              <Pressable onPress={onUseJoker} style={styles.primaryBtnWrap}>
                <LinearGradient
                  colors={["#C4B5FD", "#A78BFA"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryBtn}
                >
                  <Text style={styles.primaryBtnText}>{t("missed_use_joker_btn")}</Text>
                </LinearGradient>
              </Pressable>
            </>
          )}
        </View>
      </Animated.View>
    </Modal>
  );
}

function YearPickerModal({
  visible,
  onClose,
  yearOptions,
  selectedYear,
  month,
  setYearMonth,
  accountStartYearMonth,
  t,
  styles: modalStyles,
}: {
  visible: boolean;
  onClose: () => void;
  yearOptions: number[];
  selectedYear: number;
  month: number;
  setYearMonth: (ym: string) => void;
  accountStartYearMonth: string | null;
  t: (key: string) => string;
  styles: Record<string, object>;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const handleClose = useCallback(() => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: MODAL_CLOSE_MS,
      useNativeDriver: true,
    }).start(() => onClose());
  }, [opacity, onClose]);
  useEffect(() => {
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
    <Modal transparent visible={true} animationType="none" onRequestClose={handleClose}>
      <Animated.View style={[modalStyles.yearPickerBackdrop, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <Pressable style={modalStyles.yearPickerCard} onPress={(e) => e.stopPropagation()}>
          <Pressable style={MODAL.CLOSE_BUTTON} onPress={handleClose}>
            <Feather name="x" size={18} color={COLORS.TEXT_SECONDARY} strokeWidth={2.5} />
          </Pressable>
          <Text style={modalStyles.yearPickerTitle}>{t("calendar_select_year_title")}</Text>
          <ScrollView style={modalStyles.yearPickerList} keyboardShouldPersistTaps="handled">
            {yearOptions.map((year) => (
              <Pressable
                key={year}
                style={[
                  modalStyles.yearPickerOption,
                  selectedYear === year && modalStyles.yearPickerOptionSelected,
                ]}
                onPress={() => {
                  let ym = `${year}-${String(month).padStart(2, "0")}`;
                  if (accountStartYearMonth && ym < accountStartYearMonth) {
                    ym = accountStartYearMonth;
                  }
                  setYearMonth(ym);
                  handleClose();
                }}
              >
                <Text
                  style={[
                    modalStyles.yearPickerOptionText,
                    selectedYear === year && modalStyles.yearPickerOptionTextSelected,
                  ]}
                >
                  {year}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

export default function CalendarScreen() {
  const { lang, t } = useLanguage();
  const { effectiveUser } = useAuth();
  const userId = effectiveUser?.id ?? null;
  const { profile, refetch: refetchProfile } = useProfileContext();
  const { showMilestone } = useStreakMilestone();

  const todayKey = getLocalDayKey(getNow());
  const accountStartYearMonth = effectiveUser?.created_at
    ? getLocalDayKey(new Date(effectiveUser.created_at)).slice(0, 7)
    : null;
  const [yearMonth, setYearMonth] = useState(() => todayKey.slice(0, 7));
  const prevYearMonthRef = useRef<string | null>(null);
  const slideX = useSharedValue(0);

  useEffect(() => {
    if (prevYearMonthRef.current !== null && prevYearMonthRef.current !== yearMonth) {
      const direction = yearMonth > prevYearMonthRef.current ? 1 : -1;
      slideX.value = direction * 36;
      slideX.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) });
    }
    prevYearMonthRef.current = yearMonth;
  }, [yearMonth, slideX]);

  const animatedCardContentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideX.value }],
  }));

  useEffect(() => {
    if (!accountStartYearMonth) return;
    if (yearMonth < accountStartYearMonth) {
      setYearMonth(accountStartYearMonth);
    }
  }, [accountStartYearMonth, yearMonth]);

  const { answersMap, loading, error, refetch, setAnswerForDay } = useCalendarAnswers(
    userId,
    yearMonth,
    lang
  );

  const [viewAnswerDay, setViewAnswerDay] = useState<string | null>(null);
  const [allYearsEntries, setAllYearsEntries] = useState<{ year: string; answer: string }[] | null>(null);
  const [allYearsLoading, setAllYearsLoading] = useState(false);
  const [missedDay, setMissedDay] = useState<string | null>(null);
  const [missedAnswerDay, setMissedAnswerDay] = useState<string | null>(null);
  const [missedAnswerQuestionText, setMissedAnswerQuestionText] = useState("");
  const [missedAnswerSubmitting, setMissedAnswerSubmitting] = useState(false);
  const [missedAnswerError, setMissedAnswerError] = useState<string | null>(null);
  const [showSubmitSuccess, setShowSubmitSuccess] = useState(false);
  const [jokerModalVisible, setJokerModalVisible] = useState(false);
  const [realStreak, setRealStreak] = useState(0);
  const [showYearPicker, setShowYearPicker] = useState(false);

  const fetchStreak = useCallback(async (): Promise<number> => {
    if (!userId || userId === "dev-user") {
      setRealStreak(0);
      return 0;
    }
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const { data } = await supabase.rpc("get_user_streaks", { p_user_id: userId, p_timezone: userTimezone });
    const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
    const r = row?.real_streak ?? 0;
    const v = row?.visual_streak ?? 0;
    const value = Math.max(Number(r), Number(v));
    setRealStreak(value);
    return value;
  }, [userId]);

  useEffect(() => {
    fetchStreak();
  }, [fetchStreak]);

  // Refetch streak when Calendar tab gains focus (e.g. after submitting answer on Today).
  useFocusEffect(
    useCallback(() => {
      fetchStreak();
    }, [fetchStreak])
  );

  useEffect(() => {
    if (!viewAnswerDay || !userId) {
      setAllYearsEntries(null);
      return;
    }
    setAllYearsEntries(null);
    const mmdd = viewAnswerDay.slice(5); // e.g. "03-12"
    console.log("[ViewAnswerModal all-years] mmdd:", mmdd, "viewAnswerDay:", viewAnswerDay);
    console.log("[ViewAnswerModal all-years] userId at query:", userId);
    setAllYearsLoading(true);
    (async () => {
      const { data, error } = await supabase.rpc("get_answers_for_day", {
        p_user_id: userId,
        p_mmdd: mmdd,
      });
      console.log("[ViewAnswerModal all-years] raw Supabase response:", { data, error });
      if (error || !data) {
        setAllYearsLoading(false);
        return;
      }
      const entries = data.map((row: { question_date: string; answer_text: string | null }) => ({
        year: row.question_date.slice(0, 4),
        answer: row.answer_text ?? "",
      }));
      console.log("[ViewAnswerModal all-years] final allYearsEntries before setState:", entries);
      setAllYearsEntries(entries);
      setAllYearsLoading(false);
    })();
  }, [viewAnswerDay, userId]);

  const goPrev = useCallback(() => {
    if (accountStartYearMonth && yearMonth <= accountStartYearMonth) return;
    const [y, m] = yearMonth.split("-").map(Number);
    const nextYm = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
    if (accountStartYearMonth && nextYm < accountStartYearMonth) return;
    setYearMonth(nextYm);
  }, [yearMonth, accountStartYearMonth]);

  const goNext = useCallback(() => {
    const [y, m] = yearMonth.split("-").map(Number);
    if (m === 12) setYearMonth(`${y + 1}-01`);
    else setYearMonth(`${y}-${String(m + 1).padStart(2, "0")}`);
  }, [yearMonth]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 28,
        onPanResponderRelease: (_, gestureState) => {
          const { dx, vx } = gestureState;
          if (dx > 50 || (dx > 20 && vx > 0.3)) goPrev();
          else if (dx < -50 || (dx < -20 && vx < -0.3)) goNext();
        },
      }),
    [goPrev, goNext]
  );

  const grid = getDaysInMonthGrid(yearMonth);
  const [y, m] = yearMonth.split("-").map(Number);
  const totalDaysInMonth = new Date(y, m, 0).getDate();
  let answerableDaysThisMonth = 0;
  let capturedThisMonth = 0;
  for (let d = 1; d <= totalDaysInMonth; d++) {
    const dayKey = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (dayKey <= todayKey) {
      answerableDaysThisMonth++;
      if (answersMap.has(dayKey)) capturedThisMonth++;
    }
  }
  const nextMilestone = STREAK_MILESTONES.find((mil) => mil > realStreak) ?? null;
  const daysLeft = nextMilestone != null ? nextMilestone - realStreak : 0;
  const progressPercent = nextMilestone != null ? (realStreak / nextMilestone) * 100 : 0;
  const isViewingCurrentMonth =
    y === getNow().getFullYear() && m === getNow().getMonth() + 1;
  const now = getNow();
  const yearStart = accountStartYearMonth
    ? parseInt(accountStartYearMonth.slice(0, 4), 10)
    : 2020;
  const yearOptions = Array.from(
    { length: now.getFullYear() + 2 - yearStart },
    (_, i) => yearStart + i
  );
  const isAtAccountStartMonth =
    accountStartYearMonth !== null && yearMonth === accountStartYearMonth;
  const goToToday = useCallback(() => {
    setYearMonth(todayKey.slice(0, 7));
  }, [todayKey]);

  const handleCellPress = useCallback(
    (dayKey: string | null, state: CellState) => {
      if (!dayKey) return;
      if (state === "answered" || state === "joker") {
        setViewAnswerDay(dayKey);
      } else if (state === "missed" || state === "before") {
        setMissedDay(dayKey);
      }
    },
    []
  );

  const openMissedAnswer = useCallback(
    (dayKey: string, questionText?: string) => {
      setMissedAnswerDay(dayKey);
      setMissedAnswerQuestionText(questionText ?? "");
      setMissedDay(null);
      setMissedAnswerError(null);
    },
    []
  );

  const handleMissedSaved = useCallback(
    async (previousStreak: number) => {
      if (!missedAnswerDay) return;
      refetch();
      const newStreak = await fetchStreak();
      const crossed = getMilestonesCrossed(previousStreak, newStreak);
      await grantMilestoneJokersForCrossed(supabase, userId, previousStreak, newStreak);
      if (crossed.length > 0) {
        const highest = getHighestMilestoneCrossed(previousStreak, newStreak);
        if (highest) showMilestone(highest);
      }
      // Always refetch profile so joker_balance updates after use_joker (RPC deducts in DB).
      await refetchProfile();
    },
    [missedAnswerDay, refetch, fetchStreak, refetchProfile, showMilestone, userId]
  );

  const handleJokerAnswerComplete = useCallback(
    async (answerText: string) => {
      if (!userId || userId === "dev-user" || !missedAnswerDay) return;
      const trimmed = answerText.trim();
      if (!trimmed) return;

      setMissedAnswerError(null);
      setMissedAnswerSubmitting(true);
      try {
        let previousStreak = 0;
        try {
          const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          const { data: streaks } = await supabase.rpc("get_user_streaks", {
            p_user_id: userId,
            p_timezone: userTimezone,
          });
          const row =
            Array.isArray(streaks) && streaks.length > 0 ? streaks[0] : null;
          const r = row?.real_streak ?? 0;
          const v = row?.visual_streak ?? 0;
          previousStreak = Math.max(Number(r), Number(v));
        } catch {
          // ignore
        }

        const { error: rpcErr } = await supabase.rpc("use_joker");
        if (rpcErr) throw rpcErr;

        const { error: insertErr } = await supabase.from("answers").insert({
          user_id: userId,
          question_date: missedAnswerDay,
          answer_text: trimmed,
          is_joker: true,
        });
        if (insertErr) {
          // use_joker already decremented joker_balance — compensate by restoring it.
          try {
            await supabase.rpc("restore_joker");
          } catch (compensateErr: unknown) {
            console.error("Failed to restore joker after insert failure:", compensateErr);
          }
          throw insertErr;
        }

        setAnswerForDay(missedAnswerDay, {
          questionText: missedAnswerQuestionText,
          answerText: trimmed,
          isJoker: true,
        });
        setMissedAnswerDay(null);
        setMissedAnswerQuestionText("");
        setShowSubmitSuccess(true);
        setTimeout(() => setShowSubmitSuccess(false), 1700);
        await handleMissedSaved(previousStreak);
      } catch (e: unknown) {
        setMissedAnswerError(
          (e as { message?: string })?.message ??
            t("missed_answer_error_save")
        );
      } finally {
        setMissedAnswerSubmitting(false);
      }
    },
    [
      userId,
      missedAnswerDay,
      missedAnswerQuestionText,
      setAnswerForDay,
      handleMissedSaved,
      t,
    ]
  );

  const viewEntry = viewAnswerDay ? answersMap.get(viewAnswerDay) ?? null : null;
  const missedWithinWindow = !!(
    missedDay &&
    isWithinMissedAnswerWindow(missedDay, todayKey) &&
    !isBeforeAccountStart(missedDay, effectiveUser?.created_at)
  );
  const jokerCount = profile?.joker_balance ?? 0;
  const insets = useSafeAreaInsets();

  if (error) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>{t("calendar_error_load")}</Text>
      </View>
    );
  }

  return (
    <GlassCardContainer>
      <ScrollView
        style={[styles.container, { paddingTop: insets.top }]}
        contentContainerStyle={styles.calendarScrollContent}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.calendarContentWrap}>
          <View style={styles.calendarJokerAbsolute}>
            <JokerBadge count={jokerCount} onPress={() => setJokerModalVisible(true)} />
          </View>
          <View style={styles.yearRow}>
          <View style={styles.yearRowSpacer} />
          <Pressable style={styles.yearPressable} onPress={() => setShowYearPicker(true)}>
            <Text style={styles.yearText}>{y}</Text>
          </Pressable>
          <View style={styles.yearRowSpacer} />
        </View>

        {/* Month nav: ‹ › 36x36 round buttons; small loading indicator when fetching */}
      <View style={styles.monthNav}>
        <Pressable
          style={[styles.navBtn, isAtAccountStartMonth && styles.navBtnDisabled]}
          onPress={isAtAccountStartMonth ? undefined : goPrev}
          disabled={isAtAccountStartMonth}
        >
          <Text style={[styles.navBtnText, isAtAccountStartMonth && styles.navBtnTextDisabled]}>‹</Text>
        </Pressable>
        <Pressable onPress={() => setShowYearPicker(true)} style={styles.monthLabelWrap}>
          <View style={styles.monthLabelRow}>
            <Text style={styles.monthLabel}>{getMonthNameOnly(yearMonth, lang)}</Text>
            {loading && (
              <ActivityIndicator size="small" color={COLORS.ACCENT} style={styles.monthNavSpinner} />
            )}
          </View>
        </Pressable>
        <Pressable style={styles.navBtn} onPress={goNext}>
          <Text style={styles.navBtnText}>›</Text>
        </Pressable>
      </View>

      {/* Vandaag: paars in huidige maand, lichtgrijs in andere maanden */}
      <Pressable style={styles.todayWrap} onPress={goToToday}>
        <Text
          style={[
            styles.todayText,
            !isViewingCurrentMonth && styles.todayTextOtherMonth,
          ]}
        >
          {t("calendar_today")}
        </Text>
      </Pressable>

      {/* Card: weekdays + grid + divider + stats + Next Reward */}
      <View style={styles.card} {...panResponder.panHandlers}>
        <AnimatedReanimated.View style={animatedCardContentStyle}>
        <View style={styles.weekdayRow}>
          {getWeekdayLabels(lang).map((wd) => (
            <View key={wd} style={styles.weekdayCell}>
              <Text style={styles.weekdayText}>{wd}</Text>
            </View>
          ))}
        </View>
        {Array.from({ length: GRID_ROWS }, (_, row) => (
          <View key={row} style={styles.gridRow}>
            {grid.slice(row * GRID_COLS, (row + 1) * GRID_COLS).map((cell, i) => {
              const entry = cell.dayKey ? answersMap.get(cell.dayKey) : undefined;
              const state = cell.dayKey
                ? getCellState(cell.dayKey, todayKey, entry, effectiveUser?.created_at)
                : "future";
              const isPlaceholder = !cell.dayKey;
              const isTodayNoAnswer = !isPlaceholder && state === "today" && !entry;
              const isFilled = !isPlaceholder && (state === "today" && entry || state === "answered" || state === "joker");
              return (
                <Pressable
                  key={i}
                  style={[
                    styles.cell,
                    isPlaceholder && styles.cellEmpty,
                    !isPlaceholder && isTodayNoAnswer && styles.cellTodayNoAnswer,
                    !isPlaceholder && state === "today" && entry && styles.cellTodayAnswered,
                    !isPlaceholder && state === "answered" && cell.dayKey === todayKey && styles.cellTodayAnswered,
                    !isPlaceholder && state === "answered" && cell.dayKey !== todayKey && styles.cellAnswered,
                    !isPlaceholder && state === "joker" && cell.dayKey === todayKey && styles.cellTodayJoker,
                    !isPlaceholder && state === "joker" && cell.dayKey !== todayKey && styles.cellJoker,
                    !isPlaceholder && state === "missed" && styles.cellMissed,
                    !isPlaceholder && state === "future" && styles.cellFuture,
                    !isPlaceholder && state === "before" && styles.cellBefore,
                  ]}
                  onPress={() => handleCellPress(cell.dayKey, state)}
                >
                  {cell.dayNum > 0 && (
                    <Text
                      style={[
                        styles.cellNum,
                        isFilled && styles.cellNumFilled,
                        !isFilled && !isTodayNoAnswer && styles.cellNumEmpty,
                        state === "future" && styles.cellNumFuture,
                        state === "before" && styles.cellNumBefore,
                      ]}
                    >
                      {cell.dayNum}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}
        <View style={styles.cardDivider} />
        {nextMilestone != null && (
          <View style={styles.nextRewardBlock}>
            <LinearGradient
              colors={[
                "rgba(254,243,199,0.4)",
                "rgba(253,230,138,0.3)",
                "rgba(252,211,77,0.2)",
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.nextRewardContent}>
              <View style={styles.nextRewardHeader}>
                <View style={styles.nextRewardStreakIconWrap}>
                  <Feather name="zap" size={20} color={COLORS.ACCENT} strokeWidth={2.5} />
                </View>
                <View style={styles.nextRewardTextWrap}>
                  <View style={styles.nextRewardStreakRow}>
                    <Text style={styles.nextRewardStreakValue}>{realStreak}</Text>
                    <Text style={styles.nextRewardStreakLabel}>{t("calendar_stats_day_streak")}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.nextRewardHeader}>
                <View style={styles.nextRewardCrownCircleWrap}>
                  <LinearGradient
                    colors={["#FEF3C7", "#FDE68A", "#FCD34D"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <MaterialCommunityIcons name="crown" size={20} color="#F59E0B" />
                </View>
                <View style={styles.nextRewardTextWrap}>
                  <Text style={styles.nextRewardTitle}>{t("calendar_next_reward")}</Text>
                  <Text style={styles.nextRewardMilestone}>
                    {t("calendar_next_reward_milestone", { count: nextMilestone })}
                  </Text>
                </View>
              </View>
              <View style={styles.nextRewardProgressRow}>
                <Text style={styles.nextRewardDaysLeft}>
                  {daysLeft === 1
                    ? t("calendar_next_reward_days_left_one")
                    : t("calendar_next_reward_days_left_other", { count: daysLeft })}
                </Text>
                <Text style={styles.nextRewardFraction}>
                  {realStreak}/{nextMilestone}
                </Text>
              </View>
              <View style={styles.nextRewardBarBg}>
                <View style={[styles.nextRewardBarFillWrap, { width: `${progressPercent}%` }]}>
                  <LinearGradient
                    colors={["#FDE68A", "#F59E0B"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.nextRewardBarFill}
                  />
                </View>
              </View>
            </View>
          </View>
        )}
        </AnimatedReanimated.View>
      </View>
      </View>

      {/* Year picker modal */}
      <YearPickerModal
        visible={showYearPicker}
        onClose={() => setShowYearPicker(false)}
        yearOptions={yearOptions}
        selectedYear={y}
        month={m}
        setYearMonth={setYearMonth}
        accountStartYearMonth={accountStartYearMonth}
        t={t}
        styles={styles}
      />

      <ViewAnswerModal
        visible={!!viewAnswerDay}
        dayKey={viewAnswerDay}
        entry={viewEntry}
        allYearsEntries={allYearsEntries}
        allYearsLoading={allYearsLoading}
        onClose={() => setViewAnswerDay(null)}
      />
      {missedWithinWindow ? (
        <JokerOfferModal
          visible={!!missedDay}
          dayKey={missedDay}
          jokerCount={jokerCount}
          onClose={() => setMissedDay(null)}
          onUseJoker={(dayKey, questionText) =>
            openMissedAnswer(dayKey, questionText)
          }
        />
      ) : (
        <MissedDayModal
          visible={!!missedDay}
          dayKey={missedDay}
          canUseJoker={jokerCount > 0}
          jokerCount={jokerCount}
          withinWindow={false}
          onClose={() => setMissedDay(null)}
          onUseJoker={() => missedDay && openMissedAnswer(missedDay)}
        />
      )}
      {userId && missedAnswerDay && (
        <AnsweringExperience
          isOpen={!!missedAnswerDay}
          onClose={() => {
            setMissedAnswerDay(null);
            setMissedAnswerQuestionText("");
            setMissedAnswerError(null);
          }}
          onComplete={handleJokerAnswerComplete}
          question={missedAnswerQuestionText}
          dayKey={missedAnswerDay}
          lang={lang}
          contextLabel={t("missed_answer_question_label")}
          placeholder={t("today_placeholder")}
          submitError={missedAnswerError}
          submitting={missedAnswerSubmitting}
        />
      )}
      <JokerModal
        visible={jokerModalVisible}
        onClose={() => setJokerModalVisible(false)}
        jokerBalance={jokerCount}
        t={t}
      />
      <SubmitSuccessModal visible={showSubmitSuccess} />
      </ScrollView>
    </GlassCardContainer>
  );
}

const CELL_SIZE = 36;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  calendarScrollContent: {
    flexGrow: 1,
    paddingTop: 0,
    paddingBottom: 92,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
    padding: 24,
  },
  loadingText: { fontSize: 14, color: COLORS.TEXT_SECONDARY, marginTop: 12 },
  errorText: { fontSize: 16, color: COLORS.TEXT_PRIMARY, textAlign: "center" },
  calendarContentWrap: {
    position: "relative",
  },
  calendarJokerAbsolute: {
    position: "absolute",
    top: 4,
    right: 16,
    zIndex: 10,
  },
  yearRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginTop: 24,
    minHeight: 32,
  },
  yearRowSpacer: {
    flex: 1,
  },
  yearPressable: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  yearText: {
    fontSize: 14,
    color: "#71717A",
  },
  monthNav: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginTop: -8,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  navBtnText: { fontSize: 22, fontWeight: "700", color: COLORS.TEXT_PRIMARY },
  navBtnDisabled: { opacity: 0.4 },
  navBtnTextDisabled: { color: COLORS.TEXT_MUTED },
  monthLabelWrap: { paddingVertical: 4, paddingHorizontal: 8 },
  monthLabelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  monthLabel: { fontSize: 22, fontWeight: "700", color: COLORS.TEXT_PRIMARY },
  monthNavSpinner: { marginLeft: 4 },
  todayWrap: {
    height: 28,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  todayText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.ACCENT,
  },
  todayTextOtherMonth: {
    color: COLORS.TEXT_MUTED,
  },
  card: {
    marginTop: 14,
    marginBottom: 0,
    backgroundColor: "rgba(255,254,249,0.65)",
    borderRadius: 24,
    padding: 24,
    marginHorizontal: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardDivider: {
    marginTop: 0,
    height: 1,
    backgroundColor: "rgba(229,231,235,0.4)",
  },
  weekdayRow: {
    flexDirection: "row",
    height: 28,
    alignItems: "center",
    marginBottom: 4,
  },
  weekdayCell: {
    flex: 1,
    alignItems: "center",
  },
  weekdayText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#9CA3AF",
  },
  gridRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    height: 44,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  cellEmpty: { backgroundColor: "transparent" },
  cellTodayNoAnswer: {
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#8B5CF6",
  },
  cellTodayAnswered: {
    backgroundColor: "#8B5CF6",
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  cellAnswered: {
    backgroundColor: "rgba(139,92,246,0.5)",
  },
  cellJoker: {
    backgroundColor: "rgba(251,191,36,0.45)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.18)",
  },
  cellTodayJoker: {
    backgroundColor: "#FBBF24",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.35)",
    shadowColor: "#B45309",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  cellMissed: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(156,163,175,0.3)",
  },
  cellFuture: {
    backgroundColor: "rgba(243,244,246,0.5)",
  },
  cellBefore: {
    backgroundColor: "rgba(243,244,246,0.3)",
  },
  cellNum: {
    fontSize: 13,
    fontWeight: "600",
  },
  cellNumFilled: { color: "#FFFFFF" },
  cellNumEmpty: { color: "#6B7280" },
  cellNumFuture: { color: "#D1D5DB" },
  cellNumBefore: { color: "#E5E7EB" },
  nextRewardBlock: {
    marginTop: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.2)",
    overflow: "hidden",
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 3,
  },
  nextRewardContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 16,
  },
  nextRewardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  nextRewardStreakIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(139,92,246,0.2)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.35)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.ACCENT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  nextRewardStreakRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  nextRewardStreakValue: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.ACCENT,
  },
  nextRewardStreakLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: COLORS.ACCENT,
  },
  nextRewardCrownCircleWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.3)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  nextRewardTextWrap: { flex: 1 },
  nextRewardTitle: { fontSize: 12, color: "#6B7280", marginBottom: 2, fontWeight: "500" },
  nextRewardMilestone: { fontSize: 16, fontWeight: "700", color: "#374151" },
  nextRewardProgressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  nextRewardDaysLeft: { fontSize: 12, color: "#6B7280", fontWeight: "500" },
  nextRewardFraction: { fontSize: 12, fontWeight: "700", color: "#F59E0B" },
  nextRewardBarBg: {
    height: 10,
    borderRadius: 9999,
    backgroundColor: "rgba(255,255,255,0.6)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    overflow: "hidden",
  },
  nextRewardBarFillWrap: {
    height: "100%",
    borderRadius: 9999,
    overflow: "hidden",
  },
  nextRewardBarFill: {
    height: "100%",
    borderRadius: 9999,
    minWidth: 0,
  },
  yearPickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 28,
  },
  yearPickerCard: {
    ...MODAL.CARD,
    maxHeight: "70%",
    width: "100%",
    maxWidth: 400,
  },
  yearPickerTitle: {
    fontSize: 19,
    fontWeight: "600",
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 16,
    textAlign: "center",
  },
  yearPickerList: { maxHeight: 300 },
  yearPickerOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 4,
  },
  yearPickerOptionSelected: {
    backgroundColor: "rgba(139,92,246,0.1)",
    borderWidth: 2,
    borderColor: COLORS.ACCENT,
  },
  yearPickerOptionText: { fontSize: 17, fontWeight: "500", color: COLORS.TEXT_PRIMARY },
  yearPickerOptionTextSelected: { fontWeight: "600", color: COLORS.ACCENT },
  modalBackdrop: {
    ...MODAL.WRAPPER,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  missedDayBackdrop: {
    backgroundColor: "transparent",
  },
  modalCard: {
    ...MODAL.CARD,
  },
  modalCardViewAnswer: {
    maxHeight: "78%",
    minHeight: 320,
    paddingTop: 52,
    paddingHorizontal: 32,
    paddingBottom: 28,
  },
  modalCardWide: {
    ...MODAL.CARD_WIDE,
  },
  viewAnswerDateWrap: {
    alignItems: "center",
    marginBottom: 16,
  },
  viewAnswerDateButton: {
    backgroundColor: COLORS.ACCENT,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 9999,
    shadowColor: COLORS.ACCENT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 2,
  },
  viewAnswerDateText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  viewAnswerContent: {
    flex: 1,
    minHeight: 200,
  },
  modalQuestionViewAnswer: {
    fontSize: 17,
    fontWeight: "500",
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 20,
    lineHeight: 24,
    paddingRight: 24,
    textAlign: "center",
  },
  modalAnswerLabelViewAnswer: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 10,
  },
  modalAnswerTextViewAnswer: {
    fontSize: 17,
    color: COLORS.TEXT_PRIMARY,
    lineHeight: 28,
  },
  bottomSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: SHEET_HEIGHT,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    backgroundColor: "rgba(254, 254, 254, 0.95)",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 32,
    elevation: 16,
    overflow: "hidden",
  },
  bottomSheetBlobWrap: {
    pointerEvents: "none",
    opacity: 0.35,
  },
  bottomSheetBlob: {
    position: "absolute",
    borderRadius: 9999,
    opacity: 1,
  },
  bottomSheetBlobPurple: {
    top: 0,
    left: 0,
    width: 320,
    height: 320,
    backgroundColor: "rgba(221, 214, 254, 0.25)",
  },
  bottomSheetBlobAmber: {
    bottom: 0,
    right: 0,
    width: 384,
    height: 384,
    backgroundColor: "rgba(254, 243, 199, 0.25)",
  },
  bottomSheetBlobBlue: {
    top: "33%",
    right: "25%",
    width: 288,
    height: 288,
    backgroundColor: "rgba(219, 234, 254, 0.2)",
  },
  bottomSheetHandleWrap: {
    paddingTop: 12,
    paddingBottom: 8,
    alignItems: "center",
    zIndex: 10,
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(224, 231, 255, 0.6)",
  },
  bottomSheetHeader: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(124, 58, 237, 0.08)",
    zIndex: 10,
  },
  bottomSheetCloseBtn: {
    position: "absolute",
    top: 12,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(243, 244, 246, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 11,
  },
  bottomSheetDateLabel: {
    fontSize: 18,
    fontWeight: "600",
    color: "rgba(124, 58, 237, 0.8)",
    marginBottom: 8,
  },
  bottomSheetQuestion: {
    fontSize: 22,
    fontWeight: "600",
    color: "#1F2937",
    lineHeight: 30,
    paddingRight: 40,
  },
  bottomSheetScroll: {
    flex: 1,
    zIndex: 10,
  },
  bottomSheetScrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    gap: 12,
  },
  bottomSheetLoadingWrap: {
    paddingVertical: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomSheetYearCard: {
    borderRadius: 20,
    padding: 20,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  bottomSheetYearLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(124, 58, 237, 0.7)",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  bottomSheetYearAnswer: {
    fontSize: 18,
    color: "#374151",
    lineHeight: 26,
  },
  modalTitle: { fontSize: 20, fontWeight: "600", color: COLORS.TEXT_PRIMARY, marginBottom: 12 },
  modalSubtitle: { fontSize: 14, color: COLORS.TEXT_SECONDARY, marginBottom: 8 },
  modalQuestion: { fontSize: 17, fontWeight: "500", color: COLORS.TEXT_PRIMARY, marginBottom: 16 },
  modalBody: { fontSize: 16, color: COLORS.TEXT_SECONDARY, marginBottom: 16, lineHeight: 24 },
  modalAnswerLabel: { fontSize: 13, fontWeight: "600", color: COLORS.TEXT_SECONDARY, marginBottom: 6 },
  modalAnswerText: { fontSize: 15, color: COLORS.TEXT_PRIMARY, lineHeight: 22 },
  modalInput: {
    width: "100%",
    minHeight: 100,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(229,231,235,0.9)",
    backgroundColor: "#fff",
    fontSize: 15,
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 16,
  },
  modalError: { fontSize: 14, color: "#DC2626", marginBottom: 12 },
  missedDayAnswerBarWrap: {
    position: "absolute",
    left: 0,
    right: 0,
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
  submitError: {
    fontSize: 14,
    color: "#DC2626",
    marginTop: 12,
    textAlign: "center",
  },
  primaryBtnWrap: { alignSelf: "stretch" },
  primaryBtn: {
    paddingVertical: 14,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "rgba(139,92,246,0.3)",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 4,
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
