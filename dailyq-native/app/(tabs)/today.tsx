import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
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
import { useStreakMilestone, getHighestMilestoneCrossed, getMilestonesCrossed } from "@/src/context/StreakMilestoneContext";
import { useCalendarAnswersContext } from "@/src/context/CalendarAnswersContext";
import { useTodayQuestion } from "@/src/hooks/useTodayQuestion";
import { useProfileContext } from "@/src/context/ProfileContext";
import { getDayOfYear } from "@/src/lib/date";
import { supabase } from "@/src/config/supabase";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { JokerModal } from "@/src/components/JokerModal";
import { JokerBadge } from "@/src/components/JokerBadge";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { GlassCardContainer } from "@/src/components/GlassCardContainer";

const MAX_ANSWER_LENGTH = 280;

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const { lang, t } = useLanguage();
  const { effectiveUser } = useAuth();
  const userId = effectiveUser?.id ?? null;

  const { setAnswerForDay } = useCalendarAnswersContext();
  const { question, loading: questionLoading, error: questionError } = useTodayQuestion(lang, userId);
  const { profile, refetch: refetchProfile } = useProfileContext();
  const { showMilestone } = useStreakMilestone();

  const [answerText, setAnswerText] = useState("");
  const [existingAnswer, setExistingAnswer] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [isAnswering, setIsAnswering] = useState(false);
  const [showSubmitSuccess, setShowSubmitSuccess] = useState(false);
  const [jokerModalVisible, setJokerModalVisible] = useState(false);
  const [editConfirmVisible, setEditConfirmVisible] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const inputRef = useRef<TextInput>(null);
  const questionBlockOffset = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(1)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  // Force reset translateY on mount so it can't be stuck after modal/recap.
  useEffect(() => {
    questionBlockOffset.setValue(0);
  }, [questionBlockOffset]);

  useEffect(() => {
    if (isAnswering) {
      Animated.timing(questionBlockOffset, {
        toValue: -200,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(questionBlockOffset, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(({ finished }) => {
        questionBlockOffset.setValue(0);
      });
    }
  }, [isAnswering, questionBlockOffset]);

  useEffect(() => {
    if (isAnswering) {
      Animated.parallel([
        Animated.timing(buttonOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(buttonScale, {
          toValue: 0.85,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 250,
          delay: 150,
          useNativeDriver: true,
        }),
        Animated.timing(buttonScale, {
          toValue: 1,
          duration: 250,
          delay: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isAnswering, buttonOpacity, buttonScale]);

  useEffect(() => {
    if (isAnswering) {
      const t = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [isAnswering]);

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
      // Streak before submit (for milestone "crossed" check)
      let previousStreak = 0;
      try {
        const { data: streaksBefore } = await supabase.rpc("get_user_streaks", { p_user_id: userId });
        const rowBefore = Array.isArray(streaksBefore) && streaksBefore.length > 0 ? streaksBefore[0] : null;
        const vBefore = rowBefore?.visual_streak ?? 0;
        const rBefore = rowBefore?.real_streak ?? 0;
        previousStreak = Math.max(Number(vBefore), Number(rBefore));
      } catch {
        // ignore
      }

      // answers_user_date_unique (user_id, question_date). Kolomnaam in DB: question_date.
      const dayKey = question.day;
      const upsertPayload = {
        user_id: userId,
        question_date: dayKey,
        answer_text: text,
      };
      const { error } = await supabase
        .from("answers")
        .upsert(upsertPayload, { onConflict: "user_id,question_date" });
      if (error) throw error;

      setAnswerForDay(dayKey, { questionText: question.text, answerText: text });

      const wasUpdate = existingAnswer != null && existingAnswer.length > 0;
      setExistingAnswer(text);
      setIsAnswering(false);

      // Submit-success overlay (short visual feedback)
      setShowSubmitSuccess(true);
      setTimeout(() => setShowSubmitSuccess(false), 1200);

      // Edit confirm: show after changing an existing answer
      if (wasUpdate) {
        setEditConfirmVisible(true);
        setTimeout(() => setEditConfirmVisible(false), 2500);
      }

      // Streak milestone: check if we crossed any (previousStreak < m <= newStreak), grant jokers, show modal
      const { data: streaks } = await supabase.rpc("get_user_streaks", { p_user_id: userId });
      const row = Array.isArray(streaks) && streaks.length > 0 ? streaks[0] : null;
      const visual = row?.visual_streak ?? 0;
      const real = row?.real_streak ?? 0;
      const newStreak = Math.max(Number(visual), Number(real));
      const crossed = getMilestonesCrossed(previousStreak, newStreak);
      for (const m of crossed) {
        await supabase.rpc("grant_milestone_jokers", { p_user_id: userId, p_milestone: m });
      }
      if (crossed.length > 0) {
        const highest = getHighestMilestoneCrossed(previousStreak, newStreak);
        if (highest) showMilestone(highest);
      }
      // Always refetch profile so joker_balance and any profile-driven UI stay in sync.
      await refetchProfile();
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
  }, [userId, question, answerText, existingAnswer, effectiveUser?.created_at, t, setAnswerForDay, refetchProfile, showMilestone]);

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
      <TouchableWithoutFeedback
        onPress={() => {
          Keyboard.dismiss();
          if (isAnswering) {
            setIsAnswering(false);
            setAnswerText("");
          }
        }}
        accessible={false}
      >
        <View style={[styles.container, { paddingTop: insets.top }]}>
          <View style={styles.header}>
            <View style={styles.headerSpacer} />
            <View style={styles.headerRight}>
              <JokerBadge
                count={profile?.joker_balance ?? 0}
                onPress={() => setJokerModalVisible(true)}
              />
            </View>
          </View>

          <View style={styles.mainContent}>
            {showSubmitSuccess && <SubmitSuccessOverlay />}
            <Animated.View
              style={[styles.centerBlock, { transform: [{ translateY: questionBlockOffset }] }]}
            >
              {hasAnswer && !isAnswering ? (
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
                </View>
              ) : (
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
              )}
              {!isAnswering && (
                <Animated.View
                style={[
                  styles.buttonArea,
                  { opacity: buttonOpacity, transform: [{ scale: buttonScale }] },
                ]}
              >
                  {hasAnswer ? (
                    <PrimaryButton
                      onPress={() => {
                        setIsAnswering(true);
                        setAnswerText(existingAnswer ?? "");
                        requestAnimationFrame(() => {
                          setTimeout(() => inputRef.current?.focus(), 50);
                        });
                      }}
                    >
                      {t("today_edit_answer")}
                    </PrimaryButton>
                  ) : (
                    <PrimaryButton
                      fullWidth
                      onPress={() => {
                        setIsAnswering(true);
                        setAnswerText("");
                        requestAnimationFrame(() => {
                          setTimeout(() => inputRef.current?.focus(), 50);
                        });
                      }}
                    >
                      {t("today_answer_question")}
                    </PrimaryButton>
                  )}
                </Animated.View>
              )}
            </Animated.View>
          </View>

          {!isAnswering && <View style={styles.tabBarSpacer} />}

          {isAnswering === true && (
            <View
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: keyboardHeight === 0 ? 83 : keyboardHeight - 20,
              }}
            >
              <View style={styles.bottomBarKAV}>
                <View style={styles.bottomBarRow}>
                  <TextInput
                    ref={inputRef}
                    autoFocus={true}
                    style={styles.barInput}
                    placeholder={t("today_placeholder")}
                    placeholderTextColor={COLORS.TEXT_MUTED}
                    value={answerText}
                    onChangeText={(text) => {
                      if (text.length <= MAX_ANSWER_LENGTH) setAnswerText(text);
                    }}
                    maxLength={MAX_ANSWER_LENGTH}
                    multiline={true}
                    editable={!submitting}
                    autoCapitalize="sentences"
                  />
                  <PrimaryButton
                    onPress={handleSubmit}
                    disabled={!canSubmit}
                    loading={submitting}
                    style={styles.barSubmitButton}
                    textStyle={styles.barSubmitButtonText}
                  >
                    {hasAnswer ? t("today_update") : t("today_submit")}
                  </PrimaryButton>
                </View>
                {submitError && (
                  <Text style={styles.submitError}>{submitError}</Text>
                )}
              </View>
            </View>
          )}

          <JokerModal
            visible={jokerModalVisible}
            onClose={() => setJokerModalVisible(false)}
            jokerBalance={profile?.joker_balance ?? 0}
            t={t}
          />
          <EditConfirmModal visible={editConfirmVisible} message={t("today_answer_changed")} />
        </View>
      </TouchableWithoutFeedback>
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
    backgroundColor: "transparent",
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
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  centerBlock: {
    width: "100%",
    maxWidth: 480,
    alignItems: "center",
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
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    paddingHorizontal: 4,
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
    fontSize: 23,
    fontWeight: "500",
    color: "#374151",
    textAlign: "center",
    lineHeight: 32,
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
    paddingVertical: 58,
    paddingHorizontal: 16,
    minHeight: 168,
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
    fontSize: 23,
    fontWeight: "500",
    color: "#374151",
    textAlign: "center",
    lineHeight: 32,
    marginTop: 8,
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
