import React, { useState, useEffect, useRef } from "react";
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
  Dimensions,
  ActivityIndicator,
  Pressable,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import Feather from "@expo/vector-icons/Feather";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLanguage } from "@/src/context/LanguageContext";
import { getDayOfYear } from "@/src/lib/date";
import { supabase } from "@/src/config/supabase";

const { width, height } = Dimensions.get("window");

const MAX_ANSWER_LENGTH = 280;

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
}: AnsweringExperienceProps) {
  const insets = useSafeAreaInsets();
  const { lang: contextLang, formatDate } = useLanguage();
  const [userAnswer, setUserAnswer] = useState(initialAnswer);
  const [question, setQuestion] = useState(questionProp);
  const [questionLoading, setQuestionLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const displayLang = lang ?? contextLang;
  const displayDate =
    dayKey && formatDate
      ? formatDate(new Date(dayKey + "T12:00:00"), {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "";
  const cardNumber =
    dayKey != null ? `#${String(getDayOfYear(dayKey)).padStart(3, "0")}` : "";

  const slideY = useSharedValue(height);
  const slideX = useSharedValue(enterFromRight ? width : 0);
  const buttonScale = useSharedValue(1);
  const buttonOpacity = useSharedValue(0.4);

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
      setUserAnswer(initialAnswer);
      if (enterFromRight) {
        slideY.value = 0;
        slideX.value = width;
        slideX.value = withTiming(0, {
          duration: 280,
          easing: Easing.out(Easing.cubic),
        });
      } else {
        slideX.value = 0;
        slideY.value = withSpring(0, {
          damping: 22,
          stiffness: 140,
          mass: 0.8,
        });
      }
      const focusTimer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(focusTimer);
    }
    slideY.value = withTiming(height, {
      duration: 280,
      easing: Easing.inOut(Easing.cubic),
    });
    Keyboard.dismiss();
  }, [isOpen, initialAnswer, slideY, slideX, enterFromRight, dayKey, questionProp]);

  useEffect(() => {
    const hasText =
      userAnswer.trim().length > 0 && !questionLoading && !submitting;
    buttonScale.value = withTiming(hasText ? 1 : 0.98, { duration: 200 });
    buttonOpacity.value = withTiming(hasText ? 1 : 0.4, { duration: 200 });
  }, [userAnswer, questionLoading, submitting, buttonScale, buttonOpacity]);

  const DURATION_SWIPE_MS = 280;

  const handleCloseWithAnimation = () => {
    Keyboard.dismiss();
    if (animateOnClose) {
      slideY.value = withTiming(
        height,
        { duration: DURATION_SWIPE_MS, easing: Easing.inOut(Easing.cubic) },
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
    if (onSkip != null) {
      slideX.value = withTiming(
        -width,
        { duration: DURATION_SWIPE_MS, easing: Easing.out(Easing.cubic) },
        () => runOnJS(onComplete)(answer)
      );
    } else {
      onComplete(answer);
    }
  };

  const handleSkipWithAnimation = () => {
    if (onSkip == null) return;
    slideX.value = withTiming(
      -width,
      { duration: DURATION_SWIPE_MS, easing: Easing.out(Easing.cubic) },
      () => runOnJS(onSkip)()
    );
  };

  const animatedSlideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideX.value }, { translateY: slideY.value }],
  }));

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
    opacity: buttonOpacity.value,
  }));

  if (!isOpen) return null;

  return (
    <Modal
      transparent
      visible={isOpen}
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleCloseWithAnimation}
    >
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={handleCloseWithAnimation} accessibilityRole="button" accessibilityLabel="Close">
          <View style={styles.backdropVisual} pointerEvents="none">
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.backdropOverlay} />
          </View>
        </Pressable>

        <View style={styles.keyboardContainer} pointerEvents="box-none">
          <View style={styles.bottomAnchor} pointerEvents="box-none">
            <Animated.View
              style={[styles.contentContainer, animatedSlideStyle]}
              pointerEvents="box-none"
            >
              <View
                style={[styles.header, { paddingTop: insets.top + 16 }]}
                pointerEvents="box-none"
              >
                <View style={{ width: 36 }} pointerEvents="box-none" />
                <Pressable
                  onPress={handleCloseWithAnimation}
                  style={styles.closeButton}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <Feather name="x" size={20} color="#FFFFFF" strokeWidth={2.5} />
                </Pressable>
              </View>

          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.cardWrapper}>
              <View style={styles.card}>
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
                  {cardNumber ? (
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
                    onChangeText={(text) => {
                      if (text.length <= MAX_ANSWER_LENGTH) setUserAnswer(text);
                    }}
                    placeholder={placeholder}
                    placeholderTextColor="#9CA3AF"
                    multiline
                    maxLength={MAX_ANSWER_LENGTH}
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
              </View>
            </View>
          </TouchableWithoutFeedback>
          </Animated.View>
        </View>
      </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    ...StyleSheet.absoluteFillObject,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropVisual: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(76, 29, 149, 0.25)",
  },
  keyboardContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  bottomAnchor: {
    paddingBottom: Platform.OS === "ios" ? 320 : 280,
  },
  contentContainer: {
    flexDirection: "column",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
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
