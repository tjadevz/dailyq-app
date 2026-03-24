import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
  Modal,
  Animated,
  Share,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { COLORS, JOKER, MODAL, MODAL_ENTER_MS, MODAL_CLOSE_MS } from "@/src/config/constants";
import { useLanguage } from "@/src/context/LanguageContext";
import { useAuth } from "@/src/context/AuthContext";
import { useStreakMilestone, getHighestMilestoneCrossed, getMilestonesCrossed, grantMilestoneJokersForCrossed } from "@/src/context/StreakMilestoneContext";
import { useCalendarAnswersContext } from "@/src/context/CalendarAnswersContext";
import { useTodayQuestion } from "@/src/hooks/useTodayQuestion";
import { useProfileContext } from "@/src/context/ProfileContext";
import { getDayOfYear } from "@/src/lib/date";
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
import AccountMilestoneModal, {
  type AccountMilestoneAnswer,
} from "@/src/components/modals/AccountMilestoneModal";

const MAX_ANSWER_LENGTH = 280;
const TODAY_PRIMARY_GRADIENT = ["rgba(139,92,246,0.96)", "rgba(124,58,237,0.96)"] as const;

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

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const { lang, t } = useLanguage();
  const { effectiveUser } = useAuth();
  const userId = effectiveUser?.id ?? null;

  const { setAnswerForDay } = useCalendarAnswersContext();
  const { question, loading: questionLoading, error: questionError } = useTodayQuestion(lang, userId);
  const { profile, refetch: refetchProfile } = useProfileContext();
  const { showMilestone, open: streakCelebrationOpen } = useStreakMilestone();

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

  const [milestoneModalVisible, setMilestoneModalVisible] = useState(false);
  const [milestoneAnswers, setMilestoneAnswers] = useState<AccountMilestoneAnswer[]>([]);
  const [activeAccountMilestone, setActiveAccountMilestone] = useState<10 | null>(null);
  const [jokerModalVisible, setJokerModalVisible] = useState(false);
  const [editConfirmVisible, setEditConfirmVisible] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const inputRef = useRef<TextInput>(null);
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

  useEffect(() => {
    if (showSubmitSuccess || !pendingStreakMilestone) return;
    showMilestone(pendingStreakMilestone);
    setPendingStreakMilestone(null);
  }, [showSubmitSuccess, pendingStreakMilestone, showMilestone]);

  useEffect(() => {
    if (
      showSubmitSuccess ||
      pendingMilestone == null ||
      pendingStreakMilestone !== null ||
      streakCelebrationOpen
    ) {
      return;
    }
    if (!userId || userId === "dev-user") {
      setPendingMilestone(null);
      return;
    }
    const milestone = pendingMilestone;
    let cancelled = false;
    (async () => {
      const mapped = await fetchAccountMilestoneAnswersForModal(userId, lang);
      if (cancelled) return;
      if (mapped == null) {
        setPendingMilestone(null);
        return;
      }
      setActiveAccountMilestone(milestone);
      setMilestoneAnswers(mapped);
      setMilestoneModalVisible(true);
      setPendingMilestone(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [showSubmitSuccess, pendingMilestone, pendingStreakMilestone, streakCelebrationOpen, userId, lang]);

  const handleMilestoneClose = useCallback(async () => {
    const m = activeAccountMilestone;
    setMilestoneModalVisible(false);
    setActiveAccountMilestone(null);
    if (!userId || userId === "dev-user" || !m) return;
    const patch = { milestone_10_days_shown: true };
    const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
    if (error) {
      console.error("[Today] Account milestone close profile update:", error);
    } else {
      void refetchProfile();
    }
  }, [userId, activeAccountMilestone, refetchProfile]);

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
          const { data, error: profileErr } = await supabase
            .from("profiles")
            .select(
              "created_at, milestone_10_days_shown, milestone_30_days_shown, milestone_100_days_shown"
            )
            .eq("id", userId)
            .maybeSingle();
          if (profileErr) {
            console.error("[Today submit] Account milestone profile fetch:", profileErr);
          } else if (data) {
            if (data.created_at) setProfileCreatedAtForMilestone(data.created_at);
            setPendingMilestone(resolveAccountMilestone(data.created_at, data));
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
        }, 1700);

        if (wasUpdate) {
          setEditConfirmVisible(true);
          setTimeout(() => setEditConfirmVisible(false), 2500);
        }

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

        try {
          const crossed = getMilestonesCrossed(previousStreak, newStreak);
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
    ]
  );

  const dayLabel = question ? `#${String(getDayOfYear(question.day)).padStart(3, "0")}` : "";
  const hasAnswer = existingAnswer != null && existingAnswer.length > 0;
  const handleInvite = useCallback(async () => {
    if (!profile?.referral_code) return;
    const link = `https://dailyqapp.com/invite/${profile.referral_code}`;
    try {
      await Share.share({
        message: `Answer one question a day — and see who you were a year from now. Join me on DailyQ: ${link}`,
        url: link,
      });
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
            <Animated.View
              style={[styles.centerBlock, { transform: [{ translateY: questionBlockOffset }] }]}
            >
              {hasAnswer ? (
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
                            colors={["#FEF3C7", "#FACC15", "#FCD34D"]}
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
              <Animated.View
                style={[
                  styles.buttonArea,
                  { opacity: buttonOpacity, transform: [{ scale: buttonScale }] },
                ]}
              >
                {hasAnswer ? (
                  <PrimaryButton
                    onPress={() => setAnswerModalOpen(true)}
                    gradientColors={TODAY_PRIMARY_GRADIENT}
                  >
                    {t("today_edit_answer")}
                  </PrimaryButton>
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
            visible={milestoneModalVisible}
            daysSinceCreation={accountMilestoneDaysSinceCreation}
            answers={milestoneAnswers}
            onClose={handleMilestoneClose}
          />
          <EditConfirmModal visible={editConfirmVisible} message={t("today_answer_changed")} />
        </View>
      </TouchableWithoutFeedback>
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
    color: "#7C3AED",
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
    color: "#7C3AED",
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
