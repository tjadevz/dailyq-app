import React, { useCallback, useEffect, useRef, useState } from "react";
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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

const STREAK_MILESTONES = [7, 30, 100];
import { useLanguage } from "@/src/context/LanguageContext";
import { useAuth } from "@/src/context/AuthContext";
import { useProfile } from "@/src/hooks/useProfile";
import { useCalendarAnswersContext } from "@/src/context/CalendarAnswersContext";
import type { CalendarAnswerEntry } from "@/src/context/CalendarAnswersContext";
import { getNow, getLocalDayKey } from "@/src/lib/date";
import { supabase } from "@/src/config/supabase";
import { JokerModal } from "@/src/components/JokerModal";
import { JokerBadge } from "@/src/components/JokerBadge";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const GRID_ROWS = 6;
const GRID_COLS = 7;

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

function isBeforeAccountStart(dayKey: string, accountCreatedAt: string | undefined): boolean {
  if (!accountCreatedAt) return false;
  const createdDate = accountCreatedAt.slice(0, 10);
  return dayKey < createdDate;
}

function getDaysInMonthGrid(yearMonth: string): { dayKey: string | null; dayNum: number }[] {
  const [y, m] = yearMonth.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const last = new Date(y, m, 0);
  const firstWeekday = first.getDay();
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

function isWithin7Days(dayKey: string, todayKey: string): boolean {
  const a = new Date(dayKey);
  const b = new Date(todayKey);
  const diff = Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
  return diff >= 0 && diff <= 6;
}

// ----- ViewAnswerModal -----
function ViewAnswerModal({
  visible,
  dayKey,
  entry,
  onClose,
}: {
  visible: boolean;
  dayKey: string | null;
  entry: CalendarAnswerEntry | null;
  onClose: () => void;
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
      <Animated.View style={[styles.modalBackdrop, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.modalCard}>
          <Pressable style={MODAL.CLOSE_BUTTON} onPress={onClose}>
            <Feather name="x" size={18} color={COLORS.TEXT_SECONDARY} strokeWidth={2.5} />
          </Pressable>
          {entry && (
            <>
              <Text style={styles.modalQuestion}>{entry.questionText}</Text>
              <Text style={styles.modalAnswerLabel}>{t("calendar_your_answer")}</Text>
              <Text style={styles.modalAnswerText}>{entry.answerText}</Text>
            </>
          )}
        </View>
      </Animated.View>
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
      <Animated.View style={[styles.modalBackdrop, { opacity }]}>
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
                  colors={["#A78BFA", "#8B5CF6"]}
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

// ----- MissedDayAnswerModal -----
function MissedDayAnswerModal({
  visible,
  dayKey,
  onClose,
  onSaved,
  userId,
  lang,
}: {
  visible: boolean;
  dayKey: string | null;
  onClose: () => void;
  onSaved: () => void;
  userId: string;
  lang: string;
}) {
  const { t } = useLanguage();
  const [questionText, setQuestionText] = useState("");
  const [answerText, setAnswerText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const opacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && dayKey) {
      setAnswerText("");
      setError(null);
      setQuestionText("");
      const questionTable = lang === "en" ? "daily_questions_en" : "questions";
      const dateCol = lang === "en" ? "question_date" : "day";
      const textCol = lang === "en" ? "question_text" : "text";
      supabase
        .from(questionTable)
        .select(textCol)
        .eq(dateCol, dayKey)
        .maybeSingle()
        .then(({ data }) => {
          const row = data as { question_text?: string; text?: string } | null;
          setQuestionText((row && (textCol === "question_text" ? row.question_text : row.text)) ?? "");
        });
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    } else {
      Animated.timing(opacity, { toValue: 0, duration: MODAL_CLOSE_MS, useNativeDriver: true }).start();
    }
  }, [visible, dayKey, lang, opacity]);

  const handleSubmit = useCallback(async () => {
    if (!dayKey || !answerText.trim() || userId === "dev-user") return;
    setError(null);
    setSubmitting(true);
    try {
      const { error: rpcErr } = await supabase.rpc("use_joker");
      if (rpcErr) throw rpcErr;

      const { error: insertErr } = await supabase.from("answers").insert({
        user_id: userId,
        question_date: dayKey,
        answer_text: answerText.trim(),
        is_joker: true,
      });
      if (insertErr) throw insertErr;
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? t("missed_answer_error_save"));
    } finally {
      setSubmitting(false);
    }
  }, [dayKey, answerText, userId, onSaved, onClose, t]);

  if (!visible) return null;
  return (
    <Modal transparent visible={visible} animationType="none">
      <Animated.View style={[styles.modalBackdrop, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.modalCard, styles.modalCardWide]}>
          <Pressable style={MODAL.CLOSE_BUTTON} onPress={onClose}>
            <Feather name="x" size={18} color={COLORS.TEXT_SECONDARY} strokeWidth={2.5} />
          </Pressable>
          <Text style={styles.modalSubtitle}>{t("missed_answer_question_label")}</Text>
          <Text style={styles.modalQuestion}>{questionText}</Text>
          <TextInput
            style={styles.modalInput}
            placeholder={t("today_placeholder")}
            placeholderTextColor={COLORS.TEXT_MUTED}
            value={answerText}
            onChangeText={setAnswerText}
            multiline
            maxLength={280}
            editable={!submitting}
          />
          {error && <Text style={styles.modalError}>{error}</Text>}
          <Pressable
            style={[styles.primaryBtnWrap, submitting && styles.primaryBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting || !answerText.trim()}
          >
            <LinearGradient
              colors={["#A78BFA", "#8B5CF6"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryBtn}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>{t("missed_answer_now")}</Text>
              )}
            </LinearGradient>
          </Pressable>
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
  t,
  styles: modalStyles,
}: {
  visible: boolean;
  onClose: () => void;
  yearOptions: number[];
  selectedYear: number;
  month: number;
  setYearMonth: (ym: string) => void;
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
                  setYearMonth(`${year}-${String(month).padStart(2, "0")}`);
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
  const { profile } = useProfile(userId);
  const { useCalendarAnswers } = useCalendarAnswersContext();

  const todayKey = getLocalDayKey(getNow());
  const [yearMonth, setYearMonth] = useState(() => todayKey.slice(0, 7));

  const { answersMap, loading, error, refetch, setAnswerForDay } = useCalendarAnswers(
    userId,
    yearMonth,
    lang
  );

  const [viewAnswerDay, setViewAnswerDay] = useState<string | null>(null);
  const [missedDay, setMissedDay] = useState<string | null>(null);
  const [missedAnswerDay, setMissedAnswerDay] = useState<string | null>(null);
  const [jokerModalVisible, setJokerModalVisible] = useState(false);
  const [realStreak, setRealStreak] = useState(0);
  const [showYearPicker, setShowYearPicker] = useState(false);

  useEffect(() => {
    if (!userId || userId === "dev-user") {
      setRealStreak(0);
      return;
    }
    let cancelled = false;
    supabase.rpc("get_user_streaks", { p_user_id: userId }).then(({ data }) => {
      if (cancelled) return;
      const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
      const r = row?.real_streak ?? 0;
      const v = row?.visual_streak ?? 0;
      setRealStreak(Math.max(Number(r), Number(v)));
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const goPrev = useCallback(() => {
    const [y, m] = yearMonth.split("-").map(Number);
    if (m === 1) setYearMonth(`${y - 1}-12`);
    else setYearMonth(`${y}-${String(m - 1).padStart(2, "0")}`);
  }, [yearMonth]);

  const goNext = useCallback(() => {
    const [y, m] = yearMonth.split("-").map(Number);
    if (m === 12) setYearMonth(`${y + 1}-01`);
    else setYearMonth(`${y}-${String(m + 1).padStart(2, "0")}`);
  }, [yearMonth]);

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
  const yearOptions = Array.from(
    { length: now.getFullYear() + 2 - 2020 },
    (_, i) => 2020 + i
  );
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

  const openMissedAnswer = useCallback((dayKey: string) => {
    setMissedAnswerDay(dayKey);
    setMissedDay(null);
  }, []);

  const handleMissedSaved = useCallback(() => {
    if (missedAnswerDay) {
      refetch();
    }
  }, [missedAnswerDay, refetch]);

  const viewEntry = viewAnswerDay ? answersMap.get(viewAnswerDay) ?? null : null;
  const missedWithinWindow = !!(
    missedDay &&
    isWithin7Days(missedDay, todayKey) &&
    !isBeforeAccountStart(missedDay, effectiveUser?.created_at)
  );
  const jokerCount = profile?.joker_balance ?? 0;
  const insets = useSafeAreaInsets();

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={COLORS.ACCENT} />
        <Text style={styles.loadingText}>{t("loading_calendar")}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>{t("calendar_error_load")}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Year centred (aligned with month); joker badge right */}
      <View style={styles.yearRow}>
        <View style={styles.yearRowSpacer} />
        <Pressable style={styles.yearPressable} onPress={() => setShowYearPicker(true)}>
          <Text style={styles.yearText}>{y}</Text>
        </Pressable>
        <View style={styles.yearRowRight}>
          <JokerBadge count={jokerCount} onPress={() => setJokerModalVisible(true)} />
        </View>
      </View>

      {/* Month nav: ‹ › 36x36 round buttons */}
      <View style={styles.monthNav}>
        <Pressable style={styles.navBtn} onPress={goPrev}>
          <Text style={styles.navBtnText}>‹</Text>
        </Pressable>
        <Pressable onPress={() => setShowYearPicker(true)} style={styles.monthLabelWrap}>
          <Text style={styles.monthLabel}>{getMonthNameOnly(yearMonth, lang)}</Text>
        </Pressable>
        <Pressable style={styles.navBtn} onPress={goNext}>
          <Text style={styles.navBtnText}>›</Text>
        </Pressable>
      </View>

      {/* Vandaag: 28px */}
      <Pressable style={styles.todayWrap} onPress={goToToday}>
        <Text style={styles.todayText}>{t("calendar_today")}</Text>
      </Pressable>

      {/* Card: weekdays + grid + divider + stats + Next Reward */}
      <View style={styles.card}>
        <View style={styles.weekdayRow}>
          {WEEKDAYS.map((wd) => (
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
                    !isPlaceholder && state === "answered" && styles.cellAnswered,
                    !isPlaceholder && state === "joker" && styles.cellJoker,
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
        <View style={styles.statsWrap}>
          <View style={styles.statsRow1}>
            <Text style={styles.statsNumCaptured}>{capturedThisMonth}</Text>
            <Text style={styles.statsLabel}>
              {lang === "nl" ? "van de" : "out of"} {answerableDaysThisMonth}{" "}
              {lang === "nl" ? "dagen beantwoord" : "days answered"}
            </Text>
          </View>
          <View style={styles.statsRow2}>
            <Text style={styles.statsNumStreak}>{realStreak}</Text>
            <Text style={styles.statsLabel}>
              {lang === "nl" ? "dagen streak" : "day streak"}
            </Text>
          </View>
        </View>
        {nextMilestone != null && (
          <View style={styles.nextRewardBlock}>
            <View style={styles.nextRewardHeader}>
              <View style={styles.nextRewardCrownCircle}>
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
                  colors={["#FDE68A", "#FBBF24"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.nextRewardBarFill}
                />
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Year picker modal */}
      <YearPickerModal
        visible={showYearPicker}
        onClose={() => setShowYearPicker(false)}
        yearOptions={yearOptions}
        selectedYear={y}
        month={m}
        setYearMonth={setYearMonth}
        t={t}
        styles={styles}
      />

      <ViewAnswerModal
        visible={!!viewAnswerDay}
        dayKey={viewAnswerDay}
        entry={viewEntry}
        onClose={() => setViewAnswerDay(null)}
      />
      <MissedDayModal
        visible={!!missedDay}
        dayKey={missedDay}
        canUseJoker={jokerCount > 0}
        jokerCount={jokerCount}
        withinWindow={missedWithinWindow}
        onClose={() => setMissedDay(null)}
        onUseJoker={() => missedDay && openMissedAnswer(missedDay)}
      />
      {userId && (
        <MissedDayAnswerModal
          visible={!!missedAnswerDay}
          dayKey={missedAnswerDay}
          onClose={() => setMissedAnswerDay(null)}
          onSaved={handleMissedSaved}
          userId={userId}
          lang={lang}
        />
      )}
      <JokerModal
        visible={jokerModalVisible}
        onClose={() => setJokerModalVisible(false)}
        jokerBalance={jokerCount}
        t={t}
      />
    </View>
  );
}

const CELL_SIZE = 36;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
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
  yearRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginTop: 4,
    minHeight: 32,
  },
  yearRowSpacer: {
    flex: 1,
  },
  yearRowRight: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
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
    marginTop: 4,
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
  monthLabelWrap: { paddingVertical: 4, paddingHorizontal: 8 },
  monthLabel: { fontSize: 22, fontWeight: "700", color: COLORS.TEXT_PRIMARY },
  todayWrap: {
    height: 28,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 6,
  },
  todayText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.ACCENT,
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
    backgroundColor: "#FBBF24",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.3)",
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
  statsWrap: { marginTop: 10 },
  statsRow1: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statsRow2: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  statsNumCaptured: {
    fontSize: 18,
    fontWeight: "600",
    color: "#F59E0B",
  },
  statsNumStreak: {
    fontSize: 18,
    fontWeight: "700",
    color: "#7C3AED",
  },
  statsLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  nextRewardBlock: {
    marginTop: 16,
    paddingBottom: 14,
    backgroundColor: "rgba(254,243,199,0.4)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.2)",
    borderRadius: 20,
    padding: 16,
  },
  nextRewardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  nextRewardCrownCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(254,243,199,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  nextRewardTextWrap: { flex: 1 },
  nextRewardTitle: { fontSize: 12, color: "#92400E", marginBottom: 2 },
  nextRewardMilestone: { fontSize: 16, fontWeight: "700", color: "#78350F" },
  nextRewardProgressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  nextRewardDaysLeft: { fontSize: 13, color: "#92400E" },
  nextRewardFraction: { fontSize: 13, fontWeight: "700", color: "#F59E0B" },
  nextRewardBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.7)",
    overflow: "hidden",
  },
  nextRewardBarFillWrap: {
    height: "100%",
    borderRadius: 3,
    overflow: "hidden",
  },
  nextRewardBarFill: {
    height: "100%",
    borderRadius: 3,
    minWidth: 0,
  },
  yearPickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  yearPickerCard: {
    ...MODAL.CARD,
    maxHeight: "70%",
    width: "100%",
    maxWidth: 320,
  },
  yearPickerTitle: {
    fontSize: 18,
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
  yearPickerOptionText: { fontSize: 16, fontWeight: "500", color: COLORS.TEXT_PRIMARY },
  yearPickerOptionTextSelected: { fontWeight: "600", color: COLORS.ACCENT },
  modalBackdrop: {
    ...MODAL.WRAPPER,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalCard: {
    ...MODAL.CARD,
    minWidth: 320,
  },
  modalCardWide: {
    ...MODAL.CARD_WIDE,
    minWidth: 320,
  },
  modalTitle: { fontSize: 18, fontWeight: "600", color: COLORS.TEXT_PRIMARY, marginBottom: 12 },
  modalSubtitle: { fontSize: 14, color: COLORS.TEXT_SECONDARY, marginBottom: 8 },
  modalQuestion: { fontSize: 16, fontWeight: "500", color: COLORS.TEXT_PRIMARY, marginBottom: 16 },
  modalBody: { fontSize: 15, color: COLORS.TEXT_SECONDARY, marginBottom: 16, lineHeight: 22 },
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
  primaryBtnText: { fontSize: 16, fontWeight: "600", color: "#fff" },
});
