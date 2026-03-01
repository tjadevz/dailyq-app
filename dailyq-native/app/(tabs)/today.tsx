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
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { COLORS, JOKER, MODAL, MODAL_ENTER_MS, MODAL_CLOSE_MS } from "@/src/config/constants";
import { useLanguage } from "@/src/context/LanguageContext";
import { useAuth } from "@/src/context/AuthContext";
import { useTodayQuestion } from "@/src/hooks/useTodayQuestion";
import { useProfile } from "@/src/hooks/useProfile";
import { getDayOfYear, getNow, getLocalDayKey, isMonday, getPreviousWeekRange, getAnswerableDaysInRange } from "@/src/lib/date";
import { supabase } from "@/src/config/supabase";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { JokerModal } from "@/src/components/JokerModal";
import { JokerBadge } from "@/src/components/JokerBadge";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { GlassCardContainer } from "@/src/components/GlassCardContainer";

const MAX_ANSWER_LENGTH = 280;
const RECAP_STORAGE_PREFIX = "dailyq_recap_";

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const { lang, t } = useLanguage();
  const { effectiveUser } = useAuth();
  const userId = effectiveUser?.id ?? null;

  const { question, loading: questionLoading, error: questionError } = useTodayQuestion(lang, userId);
  const { profile } = useProfile(userId);

  const [answerText, setAnswerText] = useState("");
  const [existingAnswer, setExistingAnswer] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [isEditMode, setIsEditMode] = useState(false);
  const [showAnswerInput, setShowAnswerInput] = useState(false);
  const [showSubmitSuccess, setShowSubmitSuccess] = useState(false);
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
      setIsEditMode(false);
      setShowAnswerInput(false);

      // Submit-success overlay (short visual feedback)
      setShowSubmitSuccess(true);
      setTimeout(() => setShowSubmitSuccess(false), 1200);

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
          const total = getAnswerableDaysInRange(start, end, effectiveUser?.created_at ?? undefined);
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
  }, [userId, question, answerText, existingAnswer, effectiveUser?.created_at, t]);

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
    <GlassCardContainer>
      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: insets.top }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {/* Joker badge top-right (same position as Calendar: yearRow + yearRowRight) */}
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <View style={styles.headerRight}>
            <JokerBadge
              count={profile?.joker_balance ?? 0}
              onPress={() => setJokerModalVisible(true)}
            />
          </View>
        </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          styles.scrollContentCentered,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Submit-success overlay */}
        {showSubmitSuccess && (
          <SubmitSuccessOverlay />
        )}

        {hasAnswer && !isEditMode ? (
          /* Answered layout: centered card with question + gold check + Edit answer */
          <View style={styles.answeredWrap}>
            <View style={styles.answeredCardOuter}>
              <View style={styles.answeredCardInnerWrap}>
                <LinearGradient
                  colors={["rgba(255,255,255,0.8)", "rgba(255,255,255,0.6)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.answeredCardInner}
                >
                  <LinearGradient
                    colors={["rgba(139,92,246,0.08)", "rgba(139,92,246,0)"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.cardCornerTL}
                  />
                  <LinearGradient
                    colors={["rgba(139,92,246,0)", "rgba(139,92,246,0.08)"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.cardCornerBR}
                  />
                  <Text style={styles.answeredDayLabel}>{dayLabel}</Text>
                  <View style={styles.answeredCheckCircleWrap}>
                    <LinearGradient
                      colors={["#FEF3C7", "#FDE68A", "#FCD34D"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.answeredCheckCircle}
                    >
                      <Feather name="check" size={24} color="#fff" strokeWidth={2.5} />
                    </LinearGradient>
                  </View>
                  <Text style={styles.answeredQuestionText}>{question.text}</Text>
                </LinearGradient>
              </View>
            </View>
            <PrimaryButton
              onPress={() => {
                setIsEditMode(true);
                setAnswerText(existingAnswer ?? "");
              }}
            >
              {t("today_edit_answer")}
            </PrimaryButton>
          </View>
        ) : (
          <>
            {/* Question card (when no answer or editing): glass outer + gradient inner + corners */}
            <View style={styles.cardOuterWrap}>
              <View style={styles.cardOuter}>
                <View style={styles.cardInnerWrap}>
                  <LinearGradient
                    colors={["rgba(255,255,255,0.8)", "rgba(255,255,255,0.6)"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.cardInner}
                  >
                    <LinearGradient
                      colors={["rgba(139,92,246,0.08)", "rgba(139,92,246,0)"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.cardCornerTL}
                    />
                    <LinearGradient
                      colors={["rgba(139,92,246,0)", "rgba(139,92,246,0.08)"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.cardCornerBR}
                    />
                    <Text style={styles.cardDayLabel}>{dayLabel}</Text>
                    <Text style={styles.questionText}>{question.text}</Text>
                  </LinearGradient>
                </View>
              </View>
            </View>

            {!showAnswerInput && !hasAnswer ? (
              <PrimaryButton
                fullWidth
                onPress={() => setShowAnswerInput(true)}
              >
                {t("today_answer_question")}
              </PrimaryButton>
            ) : (
              <>
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
                <PrimaryButton
                  fullWidth
                  onPress={handleSubmit}
                  disabled={!canSubmit}
                  loading={submitting}
                >
                  {hasAnswer ? t("today_update") : t("today_submit")}
                </PrimaryButton>
                {hasAnswer && (
                  <Pressable
                    style={({ pressed }) => [styles.cancelEditButton, pressed && { opacity: 0.8 }]}
                    onPress={() => {
                      setIsEditMode(false);
                      setAnswerText(existingAnswer ?? "");
                    }}
                  >
                    <Text style={styles.cancelEditButtonText}>{t("common_cancel")}</Text>
                  </Pressable>
                )}
              </>
            )}

            {submitError && (
              <Text style={styles.submitError}>{submitError}</Text>
            )}
          </>
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
    </GlassCardContainer>
  );
}

function SubmitSuccessOverlay() {
  const scale = React.useRef(new Animated.Value(0.5)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 8,
        tension: 80,
      }),
    ]).start();
  }, [opacity, scale]);

  return (
    <Animated.View style={[styles.submitSuccessOverlay, { opacity }]} pointerEvents="none">
      <Animated.View style={[styles.submitSuccessCircleWrap, { transform: [{ scale }] }]}>
        <LinearGradient
          colors={["#FEF3C7", "#FDE68A", "#FCD34D"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.submitSuccessCircle}
        >
          <Feather name="check" size={36} color="#fff" strokeWidth={2.5} />
        </LinearGradient>
      </Animated.View>
    </Animated.View>
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
    padding: 24,
  },
  card: {
    ...MODAL.CARD,
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
  const opacity = React.useRef(new Animated.Value(0)).current;
  const handleClose = React.useCallback(() => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: MODAL_CLOSE_MS,
      useNativeDriver: true,
    }).start(() => onClose());
  }, [opacity, onClose]);
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
      <Animated.View style={[recapModalStyles.backdrop, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <Pressable style={recapModalStyles.card} onPress={(e) => e.stopPropagation()}>
          <Pressable style={MODAL.CLOSE_BUTTON} onPress={handleClose}>
            <Feather name="x" size={18} color={COLORS.TEXT_SECONDARY} strokeWidth={2.5} />
          </Pressable>
          <Text style={recapModalStyles.title}>{t("recap_title")}</Text>
          <Text style={recapModalStyles.subtitle}>{t("recap_subtitle")}</Text>
          <Text style={recapModalStyles.body}>
            {t("recap_body", { count: String(count), total: String(total) })}
          </Text>
          <Pressable onPress={handleClose} style={recapModalStyles.ctaWrap}>
            <LinearGradient
              colors={["#A78BFA", "#8B5CF6"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={recapModalStyles.cta}
            >
              <Text style={recapModalStyles.ctaText}>{t("streak_popup_cta")}</Text>
            </LinearGradient>
          </Pressable>
        </Pressable>
      </Animated.View>
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
  ctaWrap: { alignSelf: "stretch" },
  cta: {
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
  const opacity = React.useRef(new Animated.Value(0)).current;
  const confettiAnims = useRef<Animated.Value[]>([]).current;
  if (confettiAnims.length === 0) {
    for (let i = 0; i < 12; i++) confettiAnims.push(new Animated.Value(0));
  }
  const handleClose = useCallback(() => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: MODAL_CLOSE_MS,
      useNativeDriver: true,
    }).start(() => onClose());
  }, [opacity, onClose]);
  useEffect(() => {
    if (visible && milestone) {
      opacity.setValue(0);
      Animated.timing(opacity, {
        toValue: 1,
        duration: MODAL_ENTER_MS,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, milestone, opacity]);
  useEffect(() => {
    if (!visible || !milestone) return;
    confettiAnims.forEach((v) => v.setValue(0));
    const duration = 1200;
    confettiAnims.forEach((anim) => {
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
    <Modal transparent visible animationType="none">
      <Animated.View style={[streakModalStyles.backdrop, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
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
          <Pressable style={MODAL.CLOSE_BUTTON} onPress={handleClose}>
            <Feather name="x" size={18} color={COLORS.TEXT_SECONDARY} strokeWidth={2.5} />
          </Pressable>
          <Text style={streakModalStyles.title}>{title}</Text>
          <Text style={streakModalStyles.subtitle}>{subtitle}</Text>
          <Text style={streakModalStyles.earned}>
            {earned} {jokerCount}
          </Text>
          <Text style={streakModalStyles.hint}>{hint}</Text>
          <Pressable onPress={handleClose} style={streakModalStyles.ctaWrap}>
            <LinearGradient
              colors={["#A78BFA", "#8B5CF6"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={streakModalStyles.cta}
            >
              <Text style={streakModalStyles.ctaText}>{cta}</Text>
            </LinearGradient>
          </Pressable>
        </Pressable>
      </Animated.View>
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
  ctaWrap: { alignSelf: "stretch" },
  cta: {
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
  ctaText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
    paddingBottom: 92,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 16,
    paddingBottom: 40,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
    flexGrow: 1,
  },
  scrollContentCentered: {
    justifyContent: "center",
  },
  submitSuccessOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(244,246,249,0.9)",
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  submitSuccessCircleWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  submitSuccessCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.4)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#B45309",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  answeredWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
  answeredCardOuter: {
    width: "100%",
    marginBottom: 32,
    borderRadius: 28,
    padding: 1.5,
    backgroundColor: "rgba(255,255,255,0.5)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.15)",
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 40,
    elevation: 4,
  },
  answeredCardInnerWrap: {
    borderRadius: 27,
    overflow: "hidden",
  },
  answeredCardInner: {
    borderRadius: 27,
    paddingVertical: 48,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  answeredDayLabel: {
    position: "absolute",
    top: 16,
    right: 20,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: "rgba(139,92,246,0.3)",
  },
  answeredCheckCircleWrap: {
    marginBottom: 14,
  },
  answeredCheckCircle: {
    width: 51,
    height: 51,
    borderRadius: 25.5,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.4)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#B45309",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 3,
  },
  answeredQuestionText: {
    fontSize: 20,
    fontWeight: "500",
    color: "#374151",
    textAlign: "center",
    lineHeight: 28,
  },
  editAnswerButton: {
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 9999,
    backgroundColor: COLORS.ACCENT,
    shadowColor: COLORS.ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  editAnswerButtonPressed: {
    opacity: 0.9,
  },
  editAnswerButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
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
  headerSpacer: {
    flex: 1,
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
  cardOuterWrap: {
    width: "100%",
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  cardOuter: {
    borderRadius: 28,
    padding: 1.5,
    backgroundColor: "rgba(255,255,255,0.5)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.15)",
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 40,
    elevation: 3,
  },
  cardInnerWrap: {
    borderRadius: 27,
    overflow: "hidden",
  },
  cardInner: {
    borderRadius: 27,
    paddingVertical: 48,
    paddingHorizontal: 16,
    minHeight: 140,
    justifyContent: "center",
  },
  cardCornerTL: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 48,
    height: 48,
    borderBottomRightRadius: 999,
  },
  cardCornerBR: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 48,
    height: 48,
    borderTopLeftRadius: 999,
  },
  cardDayLabel: {
    position: "absolute",
    top: 16,
    right: 20,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: "rgba(139,92,246,0.3)",
  },
  questionText: {
    fontSize: 20,
    fontWeight: "500",
    color: "#374151",
    textAlign: "center",
    lineHeight: 28,
    marginTop: 8,
  },
  input: {
    width: "100%",
    minHeight: 120,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    backgroundColor: "rgba(255,255,255,0.85)",
    fontSize: 16,
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
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
