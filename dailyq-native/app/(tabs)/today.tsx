import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Animated,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { COLORS, JOKER, MODAL, MODAL_CLOSE_MS } from "@/src/config/constants";
import { useLanguage } from "@/src/context/LanguageContext";
import { useAuth } from "@/src/context/AuthContext";
import { useTodayQuestion } from "@/src/hooks/useTodayQuestion";
import { useProfile } from "@/src/hooks/useProfile";
import { getDayOfYear, getNow, getLocalDayKey, isMonday, getPreviousWeekRange, getAnswerableDaysInRange } from "@/src/lib/date";
import { supabase } from "@/src/config/supabase";
import { JokerModal } from "@/src/components/JokerModal";

const MAX_ANSWER_LENGTH = 280;
const RECAP_STORAGE_PREFIX = "dailyq_recap_";

export default function TodayScreen() {
  const { lang, t } = useLanguage();
  const { effectiveUser } = useAuth();
  const userId = effectiveUser?.id ?? null;

  const { question, loading: questionLoading, error: questionError } = useTodayQuestion(lang, userId);
  const { profile } = useProfile(userId);

  const [answerText, setAnswerText] = useState("");
  const [existingAnswer, setExistingAnswer] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [jokerModalVisible, setJokerModalVisible] = useState(false);
  const [editConfirmVisible, setEditConfirmVisible] = useState(false);
  const [recapModal, setRecapModal] = useState<{ open: boolean; count: number; total: number }>({ open: false, count: 0, total: 0 });
  const [streakModal, setStreakModal] = useState<{ open: boolean; milestone: 7 | 30 | 100 | null }>({ open: false, milestone: null });

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
      const { data } = await supabase
        .from("answers")
        .select("answer_text")
        .eq("user_id", userId)
        .eq("question_date", dayKey)
        .maybeSingle();

      if (cancelled) return;
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

  const handleSubmit = useCallback(async () => {
    if (!userId || !question || userId === "dev-user") return;
    const text = answerText.trim();
    if (!text) return;

    setSubmitError(null);
    setSubmitting(true);
    try {
      // answers_user_date_unique (user_id, question_date). Kolomnaam in DB: question_date.
      const dayKey = question.day;
      const upsertPayload = {
        user_id: userId,
        question_date: dayKey,
        answer_text: text,
      };
      // #region agent log
      fetch("http://127.0.0.1:7243/ingest/8b229217-1871-4da8-8258-2778d0f3e809", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "e1a8f0" },
        body: JSON.stringify({
          sessionId: "e1a8f0",
          location: "today.tsx:handleSubmit-upsert",
          message: "Upsert payload",
          data: { payload: upsertPayload, onConflict: "user_id,question_date" },
          timestamp: Date.now(),
          hypothesisId: "A",
        }),
      }).catch(() => {});
      // #endregion

      const { error } = await supabase
        .from("answers")
        .upsert(upsertPayload, { onConflict: "user_id,question_date" });
      if (error) throw error;

      const wasUpdate = existingAnswer != null && existingAnswer.length > 0;
      setExistingAnswer(text);

      // Edit confirm: show after changing an existing answer
      if (wasUpdate) {
        setEditConfirmVisible(true);
        setTimeout(() => setEditConfirmVisible(false), 2500);
      }

      // Monday recap: first submit on Monday → show last week X of Y
      const now = getNow();
      if (userId !== "dev-user" && isMonday(now)) {
        const dayKey = getLocalDayKey(now);
        const recapKey = RECAP_STORAGE_PREFIX + dayKey;
        const alreadyShown = await AsyncStorage.getItem(recapKey);
        if (!alreadyShown) {
          const { start, end } = getPreviousWeekRange(now);
          const { data: answers } = await supabase
            .from("answers")
            .select("question_date")
            .eq("user_id", userId)
            .gte("question_date", start)
            .lte("question_date", end);
          const count = answers?.length ?? 0;
          const total = getAnswerableDaysInRange(start, end, profile?.created_at ?? undefined);
          setRecapModal({ open: true, count, total });
          await AsyncStorage.setItem(recapKey, "1");
        }
      }

      // Streak modal: 7 / 30 / 100
      const { data: streaks } = await supabase.rpc("get_user_streaks", { p_user_id: userId });
      const row = Array.isArray(streaks) && streaks.length > 0 ? streaks[0] : null;
      const visual = row?.visual_streak ?? 0;
      const real = row?.real_streak ?? 0;
      const streak = Math.max(Number(visual), Number(real));
      if (streak === 7 || streak === 30 || streak === 100) {
        setStreakModal({ open: true, milestone: streak });
      }
    } catch (e: unknown) {
      const err = e as { message?: string; code?: string; details?: string };
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
  }, [userId, question, answerText, existingAnswer, profile?.created_at, t]);

  const dayLabel = question ? `#${String(getDayOfYear(question.day)).padStart(3, "0")}` : "";
  const hasAnswer = existingAnswer != null && existingAnswer.length > 0;
  const isUnchanged = hasAnswer && answerText.trim() === existingAnswer;
  const canSubmit = answerText.trim().length > 0 && (!hasAnswer || !isUnchanged);

  if (questionLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.ACCENT} />
        <Text style={styles.loadingText}>{t("loading_question_today")}</Text>
      </View>
    );
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {/* Header outside ScrollView so joker badge tap is always received */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>DailyQ</Text>
        <Pressable onPress={() => setJokerModalVisible(true)} style={styles.jokerBadge}>
          <Feather
            name="award"
            size={16}
            color={JOKER.TEXT}
            strokeWidth={2}
          />
          <Text style={styles.jokerCount}>
            {profile?.joker_balance ?? 0}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Question card */}
        <View style={styles.card}>
          <Text style={styles.dayLabel}>{dayLabel}</Text>
          <Text style={styles.questionText}>{question.text}</Text>
        </View>

        {/* Answer input */}
        <TextInput
          style={styles.input}
          placeholder={t("today_placeholder")}
          placeholderTextColor={COLORS.TEXT_MUTED}
          value={answerText}
          onChangeText={(text) => {
            if (text.length <= MAX_ANSWER_LENGTH) setAnswerText(text);
          }}
          maxLength={MAX_ANSWER_LENGTH}
          multiline
          numberOfLines={3}
          editable={!submitting}
          textAlignVertical="top"
        />
        <Text style={styles.charCount}>
          {answerText.length}/{MAX_ANSWER_LENGTH}
        </Text>

        {/* Submit / Update button */}
        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            !canSubmit && styles.submitButtonDisabled,
            pressed && canSubmit && styles.submitButtonPressed,
          ]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>
              {hasAnswer ? t("today_update") : t("today_submit")}
            </Text>
          )}
        </Pressable>

        {submitError && (
          <Text style={styles.submitError}>{submitError}</Text>
        )}

        {/* Beantwoord-state: gouden vinkje + "Ready for today" */}
        {hasAnswer && isUnchanged && (
          <View style={styles.readyRow}>
            <View style={styles.checkCircle}>
              <Feather
                name="check"
                size={24}
                color="#fff"
                strokeWidth={3}
              />
            </View>
            <Text style={styles.readyText}>{t("today_ready")}</Text>
          </View>
        )}
      </ScrollView>

      <JokerModal
        visible={jokerModalVisible}
        onClose={() => setJokerModalVisible(false)}
        jokerBalance={profile?.joker_balance ?? 0}
        t={t}
      />

      <EditConfirmModal visible={editConfirmVisible} message={t("today_answer_changed")} />

      <MondayRecapModal
        visible={recapModal.open}
        count={recapModal.count}
        total={recapModal.total}
        onClose={() => setRecapModal((p) => ({ ...p, open: false }))}
        t={t}
      />

      <StreakModal
        visible={streakModal.open}
        milestone={streakModal.milestone}
        onClose={() => setStreakModal({ open: false, milestone: null })}
        t={t}
      />
    </KeyboardAvoidingView>
  );
}

function EditConfirmModal({ visible, message }: { visible: boolean; message: string }) {
  if (!visible) return null;
  return (
    <Modal transparent visible animationType="fade">
      <View style={editConfirmStyles.backdrop}>
        <View style={editConfirmStyles.card}>
          <Text style={editConfirmStyles.text}>{message}</Text>
        </View>
      </View>
    </Modal>
  );
}

const editConfirmStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    minWidth: 200,
    alignItems: "center",
  },
  text: {
    fontSize: 16,
    color: COLORS.TEXT_PRIMARY,
    fontWeight: "500",
  },
});

function MondayRecapModal({
  visible,
  count,
  total,
  onClose,
  t,
}: {
  visible: boolean;
  count: number;
  total: number;
  onClose: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  if (!visible) return null;
  return (
    <Modal transparent visible animationType="fade">
      <Pressable style={recapModalStyles.backdrop} onPress={onClose}>
        <Pressable style={recapModalStyles.card} onPress={(e) => e.stopPropagation()}>
          <Pressable style={MODAL.CLOSE_BUTTON} onPress={onClose}>
            <Feather name="x" size={18} color={COLORS.TEXT_SECONDARY} strokeWidth={2.5} />
          </Pressable>
          <Text style={recapModalStyles.title}>{t("recap_title")}</Text>
          <Text style={recapModalStyles.subtitle}>{t("recap_subtitle")}</Text>
          <Text style={recapModalStyles.body}>
            {t("recap_body", { count: String(count), total: String(total) })}
          </Text>
          <Pressable style={recapModalStyles.cta} onPress={onClose}>
            <Text style={recapModalStyles.ctaText}>{t("streak_popup_cta")}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const recapModalStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    ...MODAL.CARD,
    minWidth: 300,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 16,
  },
  body: {
    fontSize: 15,
    color: COLORS.TEXT_PRIMARY,
    lineHeight: 22,
    marginBottom: 20,
  },
  cta: {
    alignSelf: "stretch",
    paddingVertical: 14,
    borderRadius: 9999,
    backgroundColor: COLORS.ACCENT,
    alignItems: "center",
  },
  ctaText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});

function StreakModal({
  visible,
  milestone,
  onClose,
  t,
}: {
  visible: boolean;
  milestone: 7 | 30 | 100 | null;
  onClose: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const confettiAnims = useRef<Animated.Value[]>([]).current;
  if (confettiAnims.length === 0) {
    for (let i = 0; i < 12; i++) confettiAnims.push(new Animated.Value(0));
  }

  useEffect(() => {
    if (!visible || !milestone) return;
    confettiAnims.forEach((v) => v.setValue(0));
    const duration = 1200;
    confettiAnims.forEach((anim, i) => {
      const angle = (i / 12) * 2 * Math.PI + Math.random() * 0.5;
      const dist = 80 + Math.random() * 60;
      Animated.timing(anim, {
        toValue: 1,
        duration: duration + Math.random() * 300,
        useNativeDriver: true,
      }).start();
    });
  }, [visible, milestone, confettiAnims]);

  if (!visible || !milestone) return null;

  const titleKey = `streak_popup_title_${milestone}` as const;
  const subtitleKey = `streak_popup_subtitle_${milestone}` as const;
  const title = t(titleKey);
  const subtitle = t(subtitleKey);
  const earned = t("streak_popup_earned");
  const jokerCount = t("streak_popup_joker_count");
  const hint = t("streak_popup_joker_hint");
  const cta = t("streak_popup_cta");

  return (
    <Modal transparent visible animationType="fade">
      <Pressable style={streakModalStyles.backdrop} onPress={onClose}>
        <Pressable style={streakModalStyles.card} onPress={(e) => e.stopPropagation()}>
          {/* Confetti-like: small circles that move out and fade */}
          <View style={streakModalStyles.confettiWrap} pointerEvents="none">
            {confettiAnims.map((anim, i) => {
              const angle = (i / 12) * 2 * Math.PI;
              const dist = 90;
              return (
                <Animated.View
                  key={i}
                  style={[
                    streakModalStyles.confettiDot,
                    {
                      transform: [
                        {
                          translateX: anim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, Math.cos(angle) * dist],
                          }),
                        },
                        {
                          translateY: anim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, Math.sin(angle) * dist],
                          }),
                        },
                      ],
                      opacity: anim.interpolate({
                        inputRange: [0, 0.6, 1],
                        outputRange: [1, 0.8, 0],
                      }),
                    },
                  ]}
                />
              );
            })}
          </View>
          <Pressable style={MODAL.CLOSE_BUTTON} onPress={onClose}>
            <Feather name="x" size={18} color={COLORS.TEXT_SECONDARY} strokeWidth={2.5} />
          </Pressable>
          <Text style={streakModalStyles.title}>{title}</Text>
          <Text style={streakModalStyles.subtitle}>{subtitle}</Text>
          <Text style={streakModalStyles.earned}>
            {earned} {jokerCount}
          </Text>
          <Text style={streakModalStyles.hint}>{hint}</Text>
          <Pressable style={streakModalStyles.cta} onPress={onClose}>
            <Text style={streakModalStyles.ctaText}>{cta}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const streakModalStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    ...MODAL.CARD,
    minWidth: 300,
  },
  confettiWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 24,
  },
  confettiDot: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EAB308",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 12,
  },
  earned: {
    fontSize: 16,
    fontWeight: "600",
    color: JOKER.TEXT,
    marginBottom: 4,
  },
  hint: {
    fontSize: 13,
    color: COLORS.TEXT_MUTED,
    marginBottom: 20,
  },
  cta: {
    alignSelf: "stretch",
    paddingVertical: 14,
    borderRadius: 9999,
    backgroundColor: COLORS.ACCENT,
    alignItems: "center",
  },
  ctaText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 16,
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
    marginBottom: 0,
    paddingHorizontal: 20,
    paddingTop: 8,
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
  card: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    padding: 24,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  dayLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.ACCENT,
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  questionText: {
    fontSize: 18,
    fontWeight: "500",
    color: COLORS.TEXT_PRIMARY,
    lineHeight: 26,
  },
  input: {
    width: "100%",
    minHeight: 120,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(229,231,235,0.9)",
    backgroundColor: "#fff",
    fontSize: 16,
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 6,
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
  readyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginTop: 24,
  },
  checkCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#EAB308",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#B45309",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  readyText: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.TEXT_PRIMARY,
  },
});
