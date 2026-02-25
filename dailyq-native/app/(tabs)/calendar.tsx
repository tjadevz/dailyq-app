import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Animated,
  Modal,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";

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
  entry: CalendarAnswerEntry | undefined
): CellState {
  if (dayKey === todayKey) return "today";
  if (entry) return entry.isJoker ? "joker" : "answered";
  if (dayKey > todayKey) return "future";
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
              <Pressable style={styles.primaryBtn} onPress={onUseJoker}>
                <Text style={styles.primaryBtnText}>{t("missed_use_joker_btn")}</Text>
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
            style={[styles.primaryBtn, submitting && styles.primaryBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting || !answerText.trim()}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>{t("missed_answer_now")}</Text>
            )}
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
      } else if (state === "missed") {
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
  const missedWithinWindow = missedDay ? isWithin7Days(missedDay, todayKey) : false;
  const jokerCount = profile?.joker_balance ?? 0;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.ACCENT} />
        <Text style={styles.loadingText}>{t("loading_calendar")}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{t("calendar_error_load")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header: tap joker badge → Joker modal */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>DailyQ</Text>
          <Pressable style={styles.jokerBadge} onPress={() => setJokerModalVisible(true)}>
            <Feather name="award" size={16} color={JOKER.TEXT} strokeWidth={2} />
            <Text style={styles.jokerCount}>{jokerCount}</Text>
          </Pressable>
        </View>

        {/* Month nav + Today */}
        <View style={styles.navColumn}>
          <View style={styles.nav}>
            <Pressable style={styles.navBtn} onPress={goPrev}>
              <Feather name="chevron-left" size={24} color={COLORS.TEXT_PRIMARY} />
            </Pressable>
            <Pressable onPress={() => setShowYearPicker(true)} style={styles.monthLabelWrap}>
              <Text style={styles.monthLabel}>{getMonthLabel(yearMonth, lang)}</Text>
            </Pressable>
            <Pressable style={styles.navBtn} onPress={goNext}>
              <Feather name="chevron-right" size={24} color={COLORS.TEXT_PRIMARY} />
            </Pressable>
          </View>
          <Pressable
            style={[styles.todayButton, isViewingCurrentMonth && styles.todayButtonActive]}
            onPress={goToToday}
          >
            <Text
              style={[
                styles.todayButtonText,
                isViewingCurrentMonth && styles.todayButtonTextActive,
              ]}
            >
              {t("calendar_today")}
            </Text>
          </Pressable>
        </View>

        {/* Weekday headers */}
        <View style={styles.weekdayRow}>
          {WEEKDAYS.map((wd) => (
            <View key={wd} style={styles.weekdayCell}>
              <Text style={styles.weekdayText}>{wd}</Text>
            </View>
          ))}
        </View>

        {/* Grid: 7 columns per row */}
        <View style={styles.grid}>
          {Array.from({ length: GRID_ROWS }, (_, row) => (
            <View key={row} style={styles.gridRow}>
              {grid.slice(row * GRID_COLS, (row + 1) * GRID_COLS).map((cell, col) => {
                const i = row * GRID_COLS + col;
                const state = cell.dayKey
                  ? getCellState(cell.dayKey, todayKey, answersMap.get(cell.dayKey))
                  : "future";
                const isPlaceholder = !cell.dayKey;
                return (
                  <Pressable
                    key={i}
                    style={[
                      styles.cell,
                      isPlaceholder && styles.cellEmpty,
                      !isPlaceholder && state === "today" && styles.cellToday,
                      !isPlaceholder && state === "answered" && styles.cellAnswered,
                      !isPlaceholder && state === "joker" && styles.cellJoker,
                      !isPlaceholder && state === "missed" && styles.cellMissed,
                      !isPlaceholder && state === "future" && styles.cellFuture,
                    ]}
                    onPress={() => handleCellPress(cell.dayKey, state)}
                  >
                    {cell.dayNum > 0 && <Text style={styles.cellNum}>{cell.dayNum}</Text>}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        {/* Stats: X van Y dagen + streak */}
        <View style={styles.statsBlock}>
          <View style={styles.statsRow}>
            <Text style={styles.statsValueCaptured}>{capturedThisMonth}</Text>
            <Text style={styles.statsLabel}>
              {lang === "nl" ? "van de" : "out of"} {answerableDaysThisMonth}{" "}
              {lang === "nl" ? "dagen beantwoord" : "days answered"}
            </Text>
          </View>
          <View style={styles.statsRow}>
            <Text style={styles.statsValueStreak}>{realStreak}</Text>
            <Text style={styles.statsLabel}>
              {lang === "nl" ? "dagen streak" : "day streak"}
            </Text>
          </View>
        </View>

        {/* Next Reward */}
        {nextMilestone != null && (
          <View style={styles.nextRewardBlock}>
            <View style={styles.nextRewardHeader}>
              <View style={styles.nextRewardIconWrap}>
                <Feather name="award" size={18} color="#F59E0B" strokeWidth={2.5} />
              </View>
              <View style={styles.nextRewardTextWrap}>
                <Text style={styles.nextRewardTitle}>{t("calendar_next_reward")}</Text>
                <Text style={styles.nextRewardMilestone}>
                  {t("calendar_next_reward_milestone", { count: nextMilestone })}
                </Text>
              </View>
            </View>
            <View style={styles.nextRewardProgressWrap}>
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
              <View style={[styles.nextRewardBarFill, { width: `${progressPercent}%` }]} />
            </View>
          </View>
        )}
      </ScrollView>

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.BACKGROUND,
    padding: 24,
  },
  loadingText: { fontSize: 14, color: COLORS.TEXT_SECONDARY, marginTop: 12 },
  errorText: { fontSize: 16, color: COLORS.TEXT_PRIMARY, textAlign: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
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
  jokerCount: { fontSize: 15, fontWeight: "700", color: JOKER.TEXT },
  navColumn: {
    alignItems: "center",
    marginBottom: 16,
  },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  navBtn: { padding: 8 },
  monthLabelWrap: { paddingVertical: 4, paddingHorizontal: 8 },
  monthLabel: { fontSize: 18, fontWeight: "600", color: COLORS.TEXT_PRIMARY },
  todayButton: {
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  todayButtonActive: {},
  todayButtonText: { fontSize: 13, fontWeight: "500", color: COLORS.TEXT_SECONDARY },
  todayButtonTextActive: { color: COLORS.ACCENT },
  statsBlock: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(229,231,235,0.4)",
    gap: 6,
  },
  statsRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  statsValueCaptured: { fontSize: 16, fontWeight: "600", color: COLORS.HEADER_Q },
  statsValueStreak: { fontSize: 16, fontWeight: "600", color: COLORS.ACCENT },
  statsLabel: { fontSize: 13, color: COLORS.TEXT_SECONDARY },
  nextRewardBlock: {
    marginTop: 16,
    padding: 14,
    borderRadius: 20,
    backgroundColor: "rgba(254,243,199,0.4)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.2)",
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 2,
  },
  nextRewardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  nextRewardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(254,243,199,0.9)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  nextRewardTextWrap: { flex: 1 },
  nextRewardTitle: { fontSize: 11, fontWeight: "500", color: COLORS.TEXT_SECONDARY, marginBottom: 2 },
  nextRewardMilestone: { fontSize: 14, fontWeight: "700", color: COLORS.TEXT_PRIMARY },
  nextRewardProgressWrap: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  nextRewardDaysLeft: { fontSize: 11, fontWeight: "500", color: COLORS.TEXT_SECONDARY },
  nextRewardFraction: { fontSize: 11, fontWeight: "700", color: "#F59E0B" },
  nextRewardBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.6)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    overflow: "hidden",
  },
  nextRewardBarFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: "#FBBF24",
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
  weekdayRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  weekdayCell: {
    flex: 1,
    alignItems: "center",
  },
  weekdayText: { fontSize: 12, fontWeight: "600", color: COLORS.TEXT_SECONDARY },
  grid: {
    marginBottom: 20,
  },
  gridRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    maxHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 2,
    borderRadius: 22,
  },
  cellEmpty: { backgroundColor: "transparent" },
  cellToday: {
    backgroundColor: CALENDAR.TODAY_AND_ANSWERED_BG,
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  cellAnswered: {
    backgroundColor: CALENDAR.ANSWERED_FADED_BG,
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  cellJoker: {
    backgroundColor: CALENDAR_JOKER.BACKGROUND,
    borderWidth: 1,
    borderColor: CALENDAR_JOKER.BORDER,
  },
  cellMissed: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: CALENDAR.MISSED_COLOR,
  },
  cellFuture: {
    backgroundColor: CALENDAR.FUTURE_BG,
    borderWidth: 1,
    borderColor: "rgba(229,231,235,0.25)",
  },
  cellNum: { fontSize: 14, fontWeight: "600", color: COLORS.TEXT_PRIMARY },
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
  primaryBtn: {
    alignSelf: "stretch",
    paddingVertical: 14,
    borderRadius: 9999,
    backgroundColor: COLORS.ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { fontSize: 16, fontWeight: "600", color: "#fff" },
});
