import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  useWindowDimensions,
  ActivityIndicator,
  Pressable,
  Image,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import Feather from "@expo/vector-icons/Feather";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import {
  useSafeAreaInsets,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import { COLORS } from "@/src/config/constants";
import { useLanguage } from "@/src/context/LanguageContext";
import { getDayOfYear } from "@/src/lib/date";
import { supabase } from "@/src/config/supabase";
import { SubmitSuccessContent } from "@/src/components/SubmitSuccessContent";

export interface AnsweringExperienceProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (answer: string) => void;
  question: string;
  initialAnswer?: string;
  contextLabel?: string;
  placeholder?: string;
  /** When question is empty and dayKey+lang are set, fetch question for that day on open */
  dayKey?: string | null;
  lang?: string;
  /** Optional error message to show below input (e.g. submit failure) */
  submitError?: string | null;
  /** When true, submit button is disabled and can show loading state */
  submitting?: boolean;
  /** When set, show a small skip button that calls this (e.g. onboarding flow) */
  onSkip?: () => void;
  skipLabel?: string;
  /** When true, card enters from the right (e.g. next question in onboarding) */
  enterFromRight?: boolean;
  /** When true, close animates with card swiping down before calling onClose (e.g. onboarding) */
  animateOnClose?: boolean;
  /** When true, advance slides current card left before onComplete (onboarding questions). */
  slideOnAdvance?: boolean;
  /** When set with progressTotal, shows step indicator at top (onboarding questions). */
  progressCurrent?: number;
  progressTotal?: number;
  /** Shown above the card (e.g. onboarding first question only). */
  subtitle?: string;
  /** Onboarding intro card: same shell as question card, no input, CTA only. */
  isIntroCard?: boolean;
  introHeadline?: string;
  introBody?: string;
  introCtaLabel?: string;
  onIntroContinue?: () => void;
  /**
   * When set, shows the post-submit celebration on top of this same native
   * <Modal> instead of the parent closing this one and opening a separate
   * <Modal> for it — two back-to-back native Modals on iOS cause the first
   * one's dismissal to cascade-dismiss the second, and even sequenced
   * carefully there's a visible gap where the real screen flashes through.
   * The parent should only actually close this modal (isOpen -> false) once
   * `celebration.onDismiss` fires.
   */
  celebration?: {
    visible: boolean;
    streak: number;
    onDismiss: () => void;
  };
}

export function AnsweringExperience({
  isOpen,
  onClose,
  onComplete,
  question: questionProp,
  initialAnswer = "",
  contextLabel = "Question of the Day",
  placeholder = "Your answer...",
  dayKey,
  lang,
  submitError,
  submitting = false,
  onSkip,
  skipLabel = "Skip",
  enterFromRight = false,
  animateOnClose = false,
  slideOnAdvance = false,
  progressCurrent,
  progressTotal,
  subtitle,
  isIntroCard = false,
  introHeadline,
  introBody,
  introCtaLabel,
  onIntroContinue,
  celebration,
}: AnsweringExperienceProps) {
  const showProgress =
    !isIntroCard &&
    progressTotal != null &&
    progressTotal > 0 &&
    progressCurrent != null &&
    progressCurrent >= 1;
  const showTopChrome = showProgress || isIntroCard;
  // Fabric doesn't reliably size flex:1/absoluteFillObject content inside <Modal> —
  // the modal's own root needs an explicit numeric size (see facebook/react-native#49717).
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    initialWindowMetrics?.insets.top ?? 0
  );
  const { lang: contextLang, formatDate, t } = useLanguage();
  const [userAnswer, setUserAnswer] = useState(initialAnswer);
  const [question, setQuestion] = useState(questionProp);
  const [questionLoading, setQuestionLoading] = useState(false);
  const [rendered, setRendered] = useState(isOpen);
  const inputRef = useRef<TextInput>(null);

  // Keep the last real dayKey while the exit animation plays — the parent
  // often clears its own dayKey the instant it calls onClose, and we don't
  // want the date/card number to blank out mid-slide.
  const [lastDayKey, setLastDayKey] = useState(dayKey);
  useEffect(() => {
    if (dayKey) setLastDayKey(dayKey);
  }, [dayKey]);

  const displayLang = lang ?? contextLang;
  const displayDate =
    lastDayKey && formatDate
      ? formatDate(new Date(lastDayKey + "T12:00:00"), {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "";
  const cardNumber =
    lastDayKey != null ? `#${String(getDayOfYear(lastDayKey)).padStart(3, "0")}` : "";

  const slideY = useSharedValue(height);
  const slideX = useSharedValue(enterFromRight ? width : 0);
  const buttonScale = useSharedValue(1);
  const buttonOpacity = useSharedValue(0.4);
  const prevDayKeyRef = useRef<string | null | undefined>(undefined);

  const TRANSITION_MS = 320;
  const slideEasing = Easing.out(Easing.cubic);
  const openEasing = Easing.bezier(0.25, 0.1, 0.25, 1);

  const runSlideInFromRight = useCallback(() => {
    slideY.value = 0;
    slideX.value = width;
    requestAnimationFrame(() => {
      slideX.value = withTiming(0, {
        duration: TRANSITION_MS,
        easing: slideEasing,
      });
    });
  }, [slideX, slideY, width]);

  useEffect(() => {
    if (questionProp) {
      setQuestion(questionProp);
    }
  }, [questionProp]);

  useEffect(() => {
    if (!isOpen || !dayKey || !lang || questionProp.length > 0) {
      if (!isOpen) return;
      setQuestionLoading(false);
      return;
    }
    let cancelled = false;
    setQuestion("");
    setQuestionLoading(true);
    const tableName = lang === "en" ? "daily_questions_en" : "questions";
    const isEn = tableName === "daily_questions_en";
    const dateCol = isEn ? "question_date" : "day";
    const textCol = isEn ? "question_text" : "text";
    supabase
      .from(tableName)
      .select(textCol)
      .eq(dateCol, dayKey)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (cancelled) return;
        setQuestionLoading(false);
        if (err || !data) {
          setQuestion("");
          return;
        }
        const row = data as { question_text?: string; text?: string };
        setQuestion(
          textCol === "question_text" ? row.question_text ?? "" : row.text ?? ""
        );
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, dayKey, lang, questionProp]);

  useEffect(() => {
    if (isOpen) {
      setRendered(true);
      setUserAnswer(initialAnswer);
      if (enterFromRight) {
        runSlideInFromRight();
      } else {
        slideX.value = 0;
        slideY.value = height;
        requestAnimationFrame(() => {
          slideY.value = withTiming(0, {
            duration: TRANSITION_MS,
            easing: openEasing,
          });
        });
      }
      if (!isIntroCard) {
        const focusTimer = setTimeout(
          () => inputRef.current?.focus(),
          enterFromRight ? TRANSITION_MS + 40 : TRANSITION_MS - 60
        );
        return () => clearTimeout(focusTimer);
      }
      return;
    }
    prevDayKeyRef.current = undefined;
    slideY.value = withTiming(
      height,
      {
        duration: TRANSITION_MS,
        easing: Easing.inOut(Easing.cubic),
      },
      (finished) => {
        if (finished) runOnJS(setRendered)(false);
      }
    );
    Keyboard.dismiss();
  }, [
    isOpen,
    initialAnswer,
    slideY,
    slideX,
    enterFromRight,
    isIntroCard,
    runSlideInFromRight,
  ]);

  useEffect(() => {
    if (!isOpen || isIntroCard || !dayKey) return;
    if (prevDayKeyRef.current != null && prevDayKeyRef.current !== dayKey) {
      setUserAnswer(initialAnswer);
      runSlideInFromRight();
      const focusTimer = setTimeout(
        () => inputRef.current?.focus(),
        TRANSITION_MS + 40
      );
      prevDayKeyRef.current = dayKey;
      return () => clearTimeout(focusTimer);
    }
    prevDayKeyRef.current = dayKey;
  }, [isOpen, isIntroCard, dayKey, initialAnswer, runSlideInFromRight]);

  useEffect(() => {
    const hasText =
      userAnswer.trim().length > 0 && !questionLoading && !submitting;
    buttonScale.value = withTiming(hasText ? 1 : 0.98, { duration: 200 });
    buttonOpacity.value = withTiming(hasText ? 1 : 0.4, { duration: 200 });
  }, [userAnswer, questionLoading, submitting, buttonScale, buttonOpacity]);

  const slideOutLeft = (onDone: () => void) => {
    slideX.value = withTiming(
      -width,
      { duration: TRANSITION_MS, easing: slideEasing },
      () => runOnJS(onDone)()
    );
  };

  const handleCloseWithAnimation = () => {
    Keyboard.dismiss();
    if (animateOnClose) {
      slideY.value = withTiming(
        height,
        { duration: TRANSITION_MS, easing: Easing.inOut(Easing.cubic) },
        () => {
          runOnJS(onClose)();
        }
      );
    } else {
      onClose();
    }
  };

  const handleSubmit = () => {
    if (!userAnswer.trim()) return;
    Keyboard.dismiss();
    const answer = userAnswer;
    if (onSkip != null || slideOnAdvance) {
      slideOutLeft(() => onComplete(answer));
    } else {
      onComplete(answer);
    }
  };

  const handleSkipWithAnimation = () => {
    if (onSkip == null) return;
    slideOutLeft(onSkip);
  };

  const handleIntroContinue = () => {
    if (!onIntroContinue) return;
    Keyboard.dismiss();
    slideOutLeft(onIntroContinue);
  };

  const animatedSlideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideX.value }, { translateY: slideY.value }],
  }));

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
    opacity: buttonOpacity.value,
  }));

  if (!rendered) return null;

  return (
    <Modal
      transparent
      visible={rendered}
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleCloseWithAnimation}
    >
      <View style={[styles.modalRoot, { width, height }]}>
        <Pressable
          style={[styles.backdrop, { width, height }]}
          onPress={handleCloseWithAnimation}
          accessibilityRole="button"
          accessibilityLabel={t("common_close")}
        >
          <View style={{ position: "absolute", top: 0, left: 0, width, height, backgroundColor: "rgba(0,0,0,0.5)" }} pointerEvents="none" />
          <View style={[styles.backdropOverlay, { width, height }]} pointerEvents="none" />
        </Pressable>

        {showTopChrome ? (
          <View
            style={[styles.topOverlay, { paddingTop: topInset + 12 }]}
            pointerEvents="box-none"
          >
            <View style={styles.headerTopRow} pointerEvents="box-none">
              {showProgress ? (
                <View style={styles.progressBlock} pointerEvents="none">
                  <View style={styles.progressTrack}>
                    {Array.from({ length: progressTotal! }, (_, i) => {
                      const step = i + 1;
                      const filled = step <= progressCurrent!;
                      return (
                        <View
                          key={step}
                          style={[
                            styles.progressSegment,
                            filled && styles.progressSegmentFilled,
                          ]}
                        />
                      );
                    })}
                  </View>
                  <Text style={styles.progressLabel}>
                    {progressCurrent} / {progressTotal}
                  </Text>
                </View>
              ) : (
                <View style={styles.headerSpacer} />
              )}
              <Pressable
                onPress={handleCloseWithAnimation}
                style={styles.closeButton}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel={t("common_close")}
              >
                <Feather name="x" size={20} color="#FFFFFF" strokeWidth={2.5} />
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.keyboardContainer} pointerEvents="box-none">
          <View style={styles.bottomAnchor} pointerEvents="box-none">
            <Animated.View
              style={[styles.contentContainer, animatedSlideStyle]}
              pointerEvents="box-none"
            >
              {!showTopChrome ? (
                <View
                  style={[styles.header, { paddingTop: topInset + 12 }]}
                  pointerEvents="box-none"
                >
                  <View style={styles.headerTopRow} pointerEvents="box-none">
                    <View style={styles.headerSpacer} />
                    <Pressable
                      onPress={handleCloseWithAnimation}
                      style={styles.closeButton}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      accessibilityRole="button"
                      accessibilityLabel={t("common_close")}
                    >
                      <Feather name="x" size={20} color="#FFFFFF" strokeWidth={2.5} />
                    </Pressable>
                  </View>
                </View>
              ) : null}

          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.cardWrapper}>
              {subtitle ? (
                <Text style={styles.cardAreaSubtitle}>{subtitle}</Text>
              ) : null}
              <View style={[styles.card, isIntroCard && styles.introCard]}>
                {isIntroCard ? (
                  <>
                    <View style={styles.introLogoWrap}>
                      <Image
                        source={require("@/assets/images/logo.nobg.png")}
                        style={styles.introLogo}
                        resizeMode="contain"
                      />
                    </View>
                    <View style={styles.introTextWrap}>
                      <Text style={styles.introHeadline}>{introHeadline}</Text>
                      <Text style={styles.introBodyText}>{introBody}</Text>
                    </View>
                    <View style={styles.introFooter}>
                      <Pressable
                        onPress={handleIntroContinue}
                        style={({ pressed }) => [
                          styles.introCtaWrap,
                          pressed && styles.introCtaPressed,
                        ]}
                      >
                        <LinearGradient
                          colors={["#7C3AED", "#6D28D9"]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.introCtaGradient}
                        >
                          <Text style={styles.introCtaText}>{introCtaLabel}</Text>
                        </LinearGradient>
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.cardHeaderRow}>
                      <View style={styles.badgeContainer}>
                        <View style={styles.badge}>
                          <Feather
                            name="star"
                            size={14}
                            color="#7C3AED"
                            strokeWidth={2}
                          />
                          <Text style={styles.badgeText} numberOfLines={1}>
                            {displayDate || contextLabel}
                          </Text>
                        </View>
                      </View>
                      {cardNumber && !showProgress ? (
                        <Text style={styles.cardNumber}>{cardNumber}</Text>
                      ) : null}
                    </View>

                    {questionLoading ? (
                      <View style={styles.questionLoader}>
                        <ActivityIndicator size="small" color="#7C3AED" />
                      </View>
                    ) : (
                      <Text style={styles.questionText}>{question || " "}</Text>
                    )}

                    <View style={styles.inputContainer}>
                      <TextInput
                        ref={inputRef}
                        value={userAnswer}
                        onChangeText={setUserAnswer}
                        placeholder={placeholder}
                        placeholderTextColor="#9CA3AF"
                        multiline
                        style={styles.input}
                        selectionColor="#7C3AED"
                        textAlignVertical="top"
                        editable={!questionLoading && !submitting}
                      />
                    </View>

                    {submitError ? (
                      <Text style={styles.errorText}>{submitError}</Text>
                    ) : null}

                    <View style={styles.footer}>
                      <View style={styles.footerRow}>
                        {onSkip ? (
                          <TouchableOpacity
                            onPress={handleSkipWithAnimation}
                            disabled={submitting}
                            style={styles.skipButton}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.skipButtonText}>{skipLabel}</Text>
                          </TouchableOpacity>
                        ) : null}
                        <Animated.View
                          style={[
                            animatedButtonStyle,
                            { alignSelf: "flex-end", marginLeft: "auto" },
                          ]}
                        >
                          <TouchableOpacity
                            onPress={handleSubmit}
                            disabled={
                              !userAnswer.trim() || questionLoading || submitting
                            }
                            activeOpacity={0.8}
                            style={styles.submitButtonWrap}
                          >
                            <LinearGradient
                              colors={["#7C3AED", "#6D28D9"]}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                              style={styles.submitButton}
                            >
                              {submitting ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                              ) : (
                                <Feather
                                  name="arrow-right"
                                  size={17}
                                  color="#FFFFFF"
                                  strokeWidth={3}
                                />
                              )}
                            </LinearGradient>
                          </TouchableOpacity>
                        </Animated.View>
                      </View>
                    </View>
                  </>
                )}
              </View>
            </View>
          </TouchableWithoutFeedback>
          </Animated.View>
        </View>
      </View>
      </View>
      {celebration ? (
        <SubmitSuccessContent
          visible={celebration.visible}
          streak={celebration.streak}
          onDismiss={celebration.onDismiss}
        />
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    position: "relative",
    overflow: "hidden",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 0,
  },
  backdropOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    backgroundColor: "rgba(76, 29, 149, 0.25)",
  },
  keyboardContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  bottomAnchor: {
    paddingBottom: Platform.OS === "ios" ? 320 : 280,
  },
  contentContainer: {
    flexDirection: "column",
  },
  topOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerSpacer: {
    flex: 1,
  },
  progressBlock: {
    flex: 1,
    gap: 8,
    paddingRight: 4,
  },
  progressTrack: {
    flexDirection: "row",
    gap: 6,
    height: 4,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  progressSegmentFilled: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.9)",
    letterSpacing: 0.3,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  cardWrapper: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 28 : 20,
  },
  cardAreaSubtitle: {
    fontSize: 17,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.92)",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 14,
    paddingHorizontal: 8,
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 32,
    padding: 28,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.6)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 10,
    minHeight: 340,
    maxHeight: 420,
  },
  introCard: {
    justifyContent: "space-between",
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  badgeContainer: {
    flexDirection: "row",
    flex: 1,
    minWidth: 0,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3E8FF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(216, 180, 254, 0.5)",
    gap: 6,
    maxWidth: "100%",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#7C3AED",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  cardNumber: {
    fontSize: 10,
    fontWeight: "700",
    color: "#7C3AED",
    marginLeft: 12,
    opacity: 0.78,
  },
  introLogoWrap: {
    alignItems: "center",
    marginBottom: 20,
  },
  introLogo: {
    width: 72,
    height: 72,
  },
  introTextWrap: {
    flex: 1,
    justifyContent: "center",
    gap: 12,
    marginBottom: 20,
  },
  introHeadline: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
    letterSpacing: -0.5,
    textAlign: "center",
  },
  introBodyText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400",
    color: COLORS.TEXT_SECONDARY,
    textAlign: "center",
  },
  introFooter: {
    paddingTop: 4,
  },
  introCtaWrap: {
    width: "100%",
    borderRadius: 9999,
    overflow: "hidden",
    shadowColor: "rgba(124,58,237,0.35)",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 1,
    shadowRadius: 56,
    elevation: 8,
  },
  introCtaPressed: {
    opacity: 0.9,
  },
  introCtaGradient: {
    paddingVertical: 18,
    paddingHorizontal: 40,
    minHeight: 56,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  introCtaText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  questionText: {
    fontSize: 25,
    lineHeight: 34,
    fontWeight: "500",
    color: "#111827",
    marginBottom: 24,
    letterSpacing: -0.5,
  },
  questionLoader: {
    minHeight: 34,
    marginBottom: 24,
    justifyContent: "center",
  },
  errorText: {
    fontSize: 14,
    color: "#DC2626",
    marginTop: 8,
  },
  inputContainer: {
    minHeight: 100,
  },
  input: {
    fontSize: 18,
    color: "#374151",
    lineHeight: 28,
    minHeight: 100,
    fontFamily: Platform.OS === "ios" ? "System" : "sans-serif",
  },
  footer: {
    paddingTop: 16,
    marginTop: 8,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  skipButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  skipButtonText: {
    fontSize: 15,
    color: "#6B7280",
  },
  submitButtonWrap: {
    overflow: "hidden",
    borderRadius: 999,
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 999,
  },
});
