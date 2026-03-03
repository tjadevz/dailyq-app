import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { COLORS } from "@/src/config/constants";
import { useLanguage } from "@/src/context/LanguageContext";
import { useAuth } from "@/src/context/AuthContext";
import { supabase } from "@/src/config/supabase";
import {
  getStoredExpoPushToken,
  setStoredExpoPushToken,
  upsertPushSubscription,
} from "@/src/lib/pushSubscription";
import { registerForPushNotificationsAsync } from "@/src/native/notifications";

const REMINDER_TIME_KEY = "dailyq-reminder-time";

type Step = "intro" | "jokers" | "notifications" | "auth";
type NotificationTime = "morning" | "afternoon" | "evening" | null;

/** Simple fade-in on mount using React Native Animated (Expo Go compatible). */
function FadeInView({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [opacity]);
  return (
    <Animated.View style={[style, { opacity }]}>{children}</Animated.View>
  );
}

async function saveReminderTime(time: "morning" | "afternoon" | "evening") {
  await AsyncStorage.setItem(REMINDER_TIME_KEY, time);
}

function OnboardingPrimaryButton({
  onPress,
  disabled,
  fullWidth,
  children,
  style,
}: {
  onPress: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
  style?: object;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primaryButtonWrap,
        fullWidth && styles.primaryButtonFull,
        pressed && !disabled && styles.primaryButtonPressed,
        style,
      ]}
    >
      <LinearGradient
        colors={disabled ? ["#9CA3AF", "#9CA3AF"] : ["#8B5CF6", "#7C3AED"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.primaryButtonGradient, disabled && styles.primaryButtonDisabled]}
      >
        {children}
      </LinearGradient>
    </Pressable>
  );
}

export default function OnboardingScreen() {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>("intro");
  const [notificationTime, setNotificationTime] =
    useState<NotificationTime>(null);
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const goNext = useCallback((next: Step) => {
    setStep(next);
  }, []);

  const handleNotificationsContinue = useCallback(async () => {
    if (!notificationTime) return;
    await saveReminderTime(notificationTime);
    // Request permission and store token; non-blocking — auth step proceeds regardless.
    registerForPushNotificationsAsync().then((token) => setStoredExpoPushToken(token));
    goNext("auth");
  }, [notificationTime, goNext]);

  const handleAuthSubmit = useCallback(async () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    if (!trimmedEmail || !trimmedPassword) return;
    setAuthError(null);
    setSubmitting(true);
    try {
      const { data, error } = isLoginMode
        ? await supabase.auth.signInWithPassword({
            email: trimmedEmail,
            password: trimmedPassword,
          })
        : await supabase.auth.signUp({
            email: trimmedEmail,
            password: trimmedPassword,
          });
      if (error) {
        setAuthError(error.message);
        return;
      }
      const user = data?.user;
      if (user?.id) {
        const token = await getStoredExpoPushToken();
        const stored =
          notificationTime ??
          ((await AsyncStorage.getItem(REMINDER_TIME_KEY)) as "morning" | "afternoon" | "evening" | null);
        const reminderTime =
          stored === "morning" || stored === "afternoon" || stored === "evening" ? stored : null;
        console.log("Upserting push subscription", {
          userId: user.id,
          token,
          reminderTime,
        });
        const { error: upsertErr } = await upsertPushSubscription(user.id, token, reminderTime);
        if (upsertErr) console.warn("Push subscription upsert failed:", upsertErr);
      }
      router.replace("/(tabs)/today");
    } finally {
      setSubmitting(false);
    }
  }, [email, password, isLoginMode, notificationTime, router]);

  // #region agent log
  useEffect(() => {
    fetch("http://127.0.0.1:7243/ingest/8b229217-1871-4da8-8258-2778d0f3e809", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "6dee77" },
      body: JSON.stringify({
        sessionId: "6dee77",
        runId: "run1",
        hypothesisId: "H1",
        location: "onboarding.tsx",
        message: "Onboarding mount",
        data: {
          step,
          cardBg: styles.card.backgroundColor ?? "undefined",
          pastAnswersBg: styles.pastAnswersCard.backgroundColor,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }, [step]);
  // #endregion

  return (
    <SafeAreaView
      style={styles.safe}
      edges={step === "intro" ? ["bottom"] : ["top", "bottom"]}
    >
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
      >
        <View
          style={[
            styles.card,
            { backgroundColor: "transparent" },
            styles.cardNoFrame,
          ]}
        >
          {step === "intro" && (
            <View style={styles.introBgOverlay} pointerEvents="none">
              <LinearGradient
                colors={[
                  "rgba(221,214,254,0.22)",
                  "rgba(196,181,253,0.12)",
                  "transparent",
                ]}
                locations={[0, 0.4, 1]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            </View>
          )}
          <ScrollView
            style={[styles.scrollView, styles.scrollViewFullBleed]}
            contentContainerStyle={[
              styles.scrollContent,
              styles.scrollContentFullBleed,
              step === "intro" && { paddingTop: insets.top },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[
                styles.column,
                styles.columnFullBleed,
                (step === "jokers" || step === "notifications") && styles.columnNarrow,
              ]}
            >
              {step === "intro" && (
                <FadeInView style={[styles.step, styles.introStepWrap]}>
                  <View style={[styles.contentWrapper, styles.contentWrapperIntro]}>
                      <View style={[styles.introHeader, styles.introHeaderIntro]}>
                        <View style={styles.logoCircleIntro}>
                          <Feather
                            name="sun"
                            size={48}
                            color={COLORS.ACCENT}
                            strokeWidth={2}
                          />
                        </View>
                        <Text style={[styles.introTitle, styles.introTitleIntro]}>
                          {t("onboarding_intro_title")}
                        </Text>
                        <Text style={[styles.introTagline, styles.introTaglineIntro]}>
                          {t("onboarding_intro_tagline")}
                        </Text>
                      </View>
                      <View style={[styles.pastAnswersCard, styles.pastAnswersCardIntro]}>
                        <View style={[styles.pastAnswersHeader, styles.pastAnswersHeaderIntro]}>
                          <Feather
                            name="book-open"
                            size={16}
                            color={COLORS.ACCENT}
                            strokeWidth={2}
                          />
                          <Text style={styles.pastAnswersLabel}>
                            {t("onboarding_intro_past_answers")}
                          </Text>
                        </View>
                        <View style={styles.exampleQuestionWrap}>
                          <Text style={[styles.exampleQuestion, styles.exampleQuestionIntro]}>
                            {t("onboarding_intro_example_question")}
                          </Text>
                        </View>
                        <View style={[styles.exampleAnswers, styles.exampleAnswersIntro]}>
                          <View style={[styles.exampleRow, styles.exampleRowIntro]}>
                            <Text style={styles.exampleMonthPill}>
                              {t("onboarding_intro_example_month_2")}
                            </Text>
                            <Text style={styles.exampleAnswer}>
                              {t("onboarding_intro_example_answer_2")}
                            </Text>
                          </View>
                          <View style={[styles.exampleRow, styles.exampleRowIntro]}>
                            <Text style={styles.exampleMonthPill}>
                              {t("onboarding_intro_example_month_1")}
                            </Text>
                            <Text style={styles.exampleAnswer}>
                              {t("onboarding_intro_example_answer_1")}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.ctaWrapIntro}>
                        <OnboardingPrimaryButton onPress={() => goNext("jokers")}>
                          <Text style={styles.primaryButtonText}>
                            {t("onboarding_continue")}
                          </Text>
                        </OnboardingPrimaryButton>
                      </View>
                    </View>
                </FadeInView>
              )}

              {step === "jokers" && (
                <FadeInView style={styles.step}>
                  <View style={styles.contentWrapper}>
                      <View style={styles.jokersHeader}>
                        <LinearGradient
                          colors={["#FEF3C7", "#FDE68A", "#FBBF24"]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={[styles.logoCircle, styles.jokerCircleGradient]}
                        >
                          <MaterialCommunityIcons
                            name="crown"
                            size={40}
                            color="#FFFFFF"
                          />
                        </LinearGradient>
                        <Text style={styles.introTitle}>
                          {t("onboarding_jokers_title")}
                        </Text>
                        <Text style={styles.introTagline}>
                          {t("onboarding_jokers_subtitle")}
                        </Text>
                      </View>
                      <View style={styles.bulletList}>
                        <View style={styles.bulletRow}>
                          <View style={[styles.bulletIcon, styles.bulletAmber]}>
                            <Feather
                              name="calendar"
                              size={18}
                              color="#F59E0B"
                              strokeWidth={2}
                            />
                          </View>
                          <View style={styles.bulletText}>
                            <Text style={styles.bulletTitle}>
                              {t("onboarding_jokers_answer_missed")}
                            </Text>
                            <Text style={styles.bulletDesc}>
                              {t("onboarding_jokers_answer_missed_desc")}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.bulletRow}>
                          <View style={[styles.bulletIcon, styles.bulletBlue]}>
                            <Feather
                              name="trending-up"
                              size={18}
                              color="#3B82F6"
                              strokeWidth={2}
                            />
                          </View>
                          <View style={styles.bulletText}>
                            <Text style={styles.bulletTitle}>
                              {t("onboarding_jokers_earn_streaks")}
                            </Text>
                            <Text style={styles.bulletDesc}>
                              {t("onboarding_jokers_earn_streaks_desc")}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <OnboardingPrimaryButton
                        fullWidth
                        onPress={() => goNext("notifications")}
                      >
                        <Text style={styles.primaryButtonText}>
                          {t("onboarding_continue")}
                        </Text>
                      </OnboardingPrimaryButton>
                    </View>
                </FadeInView>
              )}

              {step === "notifications" && (
                <FadeInView style={styles.step}>
                  <View style={styles.contentWrapper}>
                      <View style={styles.notifHeader}>
                        <View style={[styles.logoCircle, styles.notifCircle]}>
                          <Feather
                            name="bell"
                            size={40}
                            color={COLORS.ACCENT}
                            strokeWidth={2}
                          />
                        </View>
                        <Text style={styles.notifTitle}>
                          {t("onboarding_notif_title")}
                        </Text>
                        <Text style={styles.introTagline}>
                          {t("onboarding_notif_subtitle")}
                        </Text>
                      </View>
                      <View style={styles.optionList}>
                        {(
                          [
                            "morning",
                            "afternoon",
                            "evening",
                          ] as const
                        ).map((opt) => (
                          <Pressable
                            key={opt}
                            style={({ pressed }) => [
                              styles.optionCard,
                              notificationTime === opt && styles.optionCardSelected,
                              pressed && styles.optionCardPressed,
                            ]}
                            onPress={() => setNotificationTime(opt)}
                          >
                            <View style={styles.optionCardInner}>
                              <View>
                                <Text style={styles.optionLabel}>
                                  {t(
                                    opt === "morning"
                                      ? "onboarding_notif_morning"
                                      : opt === "afternoon"
                                        ? "onboarding_notif_afternoon"
                                        : "onboarding_notif_evening"
                                  )}
                                </Text>
                                <Text style={styles.optionTime}>
                                  {t(
                                    opt === "morning"
                                      ? "onboarding_notif_morning_time"
                                      : opt === "afternoon"
                                        ? "onboarding_notif_afternoon_time"
                                        : "onboarding_notif_evening_time"
                                  )}
                                </Text>
                              </View>
                              <View
                                style={[
                                  styles.radioOuter,
                                  notificationTime === opt && styles.radioOuterSelected,
                                ]}
                              >
                                {notificationTime === opt && (
                                  <View style={styles.radioInner} />
                                )}
                              </View>
                            </View>
                          </Pressable>
                        ))}
                      </View>
                      <OnboardingPrimaryButton
                        fullWidth
                        onPress={handleNotificationsContinue}
                        disabled={!notificationTime}
                      >
                        <Text style={styles.primaryButtonText}>
                          {t("onboarding_continue")}
                        </Text>
                      </OnboardingPrimaryButton>
                    </View>
                </FadeInView>
              )}

              {step === "auth" && (
                <FadeInView style={styles.step}>
                  <View style={styles.contentWrapper}>
                      <View style={styles.authHeader}>
                        <View style={styles.logoCircle}>
                          <Feather
                            name="mail"
                            size={40}
                            color={COLORS.ACCENT}
                            strokeWidth={2}
                          />
                        </View>
                        <Text style={styles.authTitle}>
                          {isLoginMode
                            ? t("onboarding_auth_welcome_back")
                            : t("onboarding_auth_create_account")}
                        </Text>
                      </View>
                      <View style={styles.form}>
                        <TextInput
                          style={styles.input}
                          placeholder={t("onboarding_email")}
                          placeholderTextColor={COLORS.TEXT_MUTED}
                          value={email}
                          onChangeText={setEmail}
                          editable={!submitting}
                          autoCapitalize="none"
                          autoCorrect={false}
                          keyboardType="email-address"
                          autoComplete="email"
                        />
                        <TextInput
                          style={styles.input}
                          placeholder={t("onboarding_password")}
                          placeholderTextColor={COLORS.TEXT_MUTED}
                          value={password}
                          onChangeText={setPassword}
                          editable={!submitting}
                          secureTextEntry
                          autoComplete={isLoginMode ? "password" : "new-password"}
                          autoCapitalize="none"
                        />
                        <OnboardingPrimaryButton
                          fullWidth
                          onPress={handleAuthSubmit}
                          disabled={
                            submitting || !email.trim() || !password.trim()
                          }
                          style={styles.authSubmit}
                        >
                          {submitting ? (
                            <ActivityIndicator
                              size="small"
                              color="#fff"
                            />
                          ) : (
                            <Text style={styles.primaryButtonText}>
                              {isLoginMode
                                ? t("onboarding_sign_in")
                                : t("onboarding_sign_up")}
                            </Text>
                          )}
                        </OnboardingPrimaryButton>
                      </View>
                      {authError && (
                        <Text style={styles.authError}>{authError}</Text>
                      )}
                      <Pressable
                        style={styles.toggleAuth}
                        onPress={() => {
                          setIsLoginMode((m) => !m);
                          setAuthError(null);
                        }}
                        disabled={submitting}
                      >
                        <Text style={styles.toggleAuthText}>
                          {isLoginMode
                            ? t("onboarding_toggle_sign_up")
                            : t("onboarding_toggle_sign_in")}
                        </Text>
                      </Pressable>
                    </View>
                </FadeInView>
              )}
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "transparent",
  },
  keyboard: {
    flex: 1,
  },
  card: {
    flex: 1,
    margin: 16,
    marginTop: 8,
    borderRadius: 32,
    overflow: "hidden",
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.15,
    shadowRadius: 40,
    elevation: 8,
  },
  cardNoFrame: {
    margin: 0,
    marginTop: 0,
    borderRadius: 0,
    borderWidth: 0,
    borderColor: "transparent",
    backgroundColor: "transparent",
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    overflow: "visible",
  },
  scrollView: {
    backgroundColor: "transparent",
    flex: 1,
  },
  scrollViewFullBleed: {
    zIndex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
    paddingBottom: 48,
    backgroundColor: "transparent",
  },
  scrollContentFullBleed: {
    paddingHorizontal: 0,
    paddingBottom: 48,
    backgroundColor: "transparent",
  },
  column: {
    maxWidth: 440,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: 24,
  },
  columnFullBleed: {
    maxWidth: "100%",
    paddingHorizontal: 20,
    backgroundColor: "transparent",
  },
  columnNarrow: {
    paddingHorizontal: 36,
  },
  step: {
    width: "100%",
  },
  introStepWrap: {
    position: "relative",
    backgroundColor: "transparent",
  },
  introBgOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  contentWrapper: {
    paddingTop: 24,
    paddingBottom: 32,
    paddingHorizontal: 0,
  },
  contentWrapperIntro: {
    paddingTop: 20,
    paddingBottom: 24,
  },
  introHeader: {
    alignItems: "center",
    marginBottom: 32,
  },
  introHeaderIntro: {
    marginBottom: 20,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(139,92,246,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  logoCircleIntro: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(139,92,246,0.14)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 6,
  },
  jokerCircle: {
    backgroundColor: "#FDE68A",
  },
  jokerCircleGradient: {
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.4)",
  },
  notifCircle: {
    backgroundColor: "rgba(139,92,246,0.15)",
  },
  introTitle: {
    fontSize: 28,
    fontWeight: "600",
    color: COLORS.TEXT_PRIMARY,
    textAlign: "center",
    marginBottom: 8,
  },
  introTitleIntro: {
    fontSize: 32,
    fontWeight: "700",
  },
  introTagline: {
    fontSize: 16,
    color: COLORS.TEXT_SECONDARY,
    textAlign: "center",
    lineHeight: 24,
  },
  introTaglineIntro: {
    color: "#444",
  },
  pastAnswersCard: {
    backgroundColor: "rgba(255,255,255,0.75)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.15)",
    paddingVertical: 20,
    paddingHorizontal: 24,
    marginBottom: 32,
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2,
  },
  pastAnswersCardIntro: {
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "transparent",
    shadowColor: "transparent",
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    paddingVertical: 20,
    paddingHorizontal: 18,
    marginBottom: 20,
  },
  pastAnswersHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  pastAnswersHeaderIntro: {
    marginBottom: 12,
    justifyContent: "center",
  },
  pastAnswersLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.ACCENT,
  },
  exampleQuestionWrap: {
    backgroundColor: "rgba(255,255,255,0.55)",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginBottom: 14,
    alignSelf: "stretch",
  },
  exampleQuestion: {
    fontSize: 15,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 22,
    marginBottom: 0,
    textAlign: "center",
  },
  exampleQuestionIntro: {
    marginBottom: 0,
    fontWeight: "700",
  },
  exampleAnswers: {
    gap: 12,
  },
  exampleAnswersIntro: {
    gap: 14,
  },
  exampleRow: {
    backgroundColor: "rgba(243,232,255,0.5)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.15)",
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  exampleRowIntro: {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.2)",
    paddingVertical: 14,
    paddingHorizontal: 18,
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
    width: "100%",
    alignSelf: "stretch",
  },
  exampleMonth: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.ACCENT,
    marginBottom: 4,
  },
  exampleMonthPill: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.ACCENT,
    alignSelf: "center",
    backgroundColor: "rgba(139,92,246,0.12)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 9999,
    marginBottom: 8,
    overflow: "hidden",
  },
  exampleAnswer: {
    fontSize: 15,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 22,
    textAlign: "center",
  },
  ctaWrap: {
    alignItems: "center",
    marginTop: 8,
  },
  ctaWrapIntro: {
    alignItems: "center",
    marginTop: 12,
  },
  primaryButtonWrap: {
    minWidth: 160,
  },
  primaryButtonGradient: {
    paddingHorizontal: 40,
    paddingVertical: 18,
    minHeight: 56,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "rgba(139,92,246,0.4)",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 1,
    shadowRadius: 56,
    elevation: 8,
  },
  primaryButtonFull: {
    width: "100%",
    marginTop: 32,
  },
  primaryButtonDisabled: {
    shadowOpacity: 0,
  },
  primaryButtonPressed: {
    opacity: 0.9,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  jokersHeader: {
    alignItems: "center",
    marginBottom: 32,
  },
  bulletList: {
    gap: 20,
    marginBottom: 32,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  bulletIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  bulletAmber: {
    backgroundColor: "rgba(254,243,199,0.8)",
  },
  bulletBlue: {
    backgroundColor: "rgba(219,234,254,0.8)",
  },
  bulletPurple: {
    backgroundColor: "rgba(237,233,254,0.8)",
  },
  bulletText: {
    flex: 1,
  },
  bulletTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 4,
  },
  bulletDesc: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 20,
  },
  notifHeader: {
    alignItems: "center",
    marginBottom: 32,
  },
  notifTitle: {
    fontSize: 24,
    fontWeight: "600",
    color: COLORS.TEXT_PRIMARY,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 8,
  },
  optionList: {
    gap: 12,
    marginBottom: 32,
  },
  optionCard: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
    backgroundColor: "rgba(255,255,255,0.6)",
    paddingVertical: 16,
    paddingHorizontal: 0,
    overflow: "hidden",
  },
  optionCardSelected: {
    backgroundColor: "rgba(139,92,246,0.1)",
    borderColor: COLORS.ACCENT,
    shadowColor: COLORS.ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 2,
  },
  optionCardPressed: {
    opacity: 0.9,
  },
  optionCardInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 4,
  },
  optionTime: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterSelected: {
    borderColor: COLORS.ACCENT,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.ACCENT,
  },
  authHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  authTitle: {
    fontSize: 24,
    fontWeight: "600",
    color: COLORS.TEXT_PRIMARY,
    textAlign: "center",
    marginTop: 8,
  },
  form: {
    gap: 14,
    marginBottom: 16,
  },
  input: {
    width: "100%",
    minHeight: 52,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(229,231,235,0.8)",
    backgroundColor: "#fff",
    fontSize: 15,
    color: COLORS.TEXT_PRIMARY,
  },
  authSubmit: {
    marginTop: 8,
  },
  authError: {
    fontSize: 14,
    color: "#DC2626",
    marginBottom: 8,
    textAlign: "center",
  },
  toggleAuth: {
    alignSelf: "center",
    paddingVertical: 8,
  },
  toggleAuthText: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
  },
});
