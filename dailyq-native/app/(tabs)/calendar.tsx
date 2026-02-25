import React, { useCallback, useEffect, useState } from "react";
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
  MODAL_CLOSE_MS,
} from "@/src/config/constants";
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
  const captured = answersMap.size;

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

        {/* Month nav */}
        <View style={styles.nav}>
          <Pressable style={styles.navBtn} onPress={goPrev}>
            <Feather name="chevron-left" size={24} color={COLORS.TEXT_PRIMARY} />
          </Pressable>
          <Text style={styles.monthLabel}>{getMonthLabel(yearMonth, lang)}</Text>
          <Pressable style={styles.navBtn} onPress={goNext}>
            <Feather name="chevron-right" size={24} color={COLORS.TEXT_PRIMARY} />
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

        {/* Stats */}
        <Text style={styles.stats}>
          {t("calendar_answered_this_month", {
            captured: String(captured),
            total: String(totalDaysInMonth),
          })}
        </Text>
      </ScrollView>

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
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  navBtn: { padding: 8 },
  monthLabel: { fontSize: 18, fontWeight: "600", color: COLORS.TEXT_PRIMARY },
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
  stats: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    textAlign: "center",
  },
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
