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
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

import { COLORS } from "@/src/config/constants";
import { useLanguage } from "@/src/context/LanguageContext";
import { useAuth } from "@/src/context/AuthContext";
import { supabase } from "@/src/config/supabase";
import { getExpoPushTokenAsync } from "@/src/native/notifications";
import {
  setStoredExpoPushToken,
  getStoredExpoPushToken,
  upsertPushSubscription,
} from "@/src/lib/pushSubscription";

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

/** Ask for notification permission; call when user taps Continue on step 3 so the system dialog is shown. */
async function requestNotificationPermission(): Promise<boolean> {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

async function saveReminderTime(time: "morning" | "afternoon" | "evening") {
  await AsyncStorage.setItem(REMINDER_TIME_KEY, time);
}

export default function OnboardingScreen() {
  const { t } = useLanguage();
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
    const granted = await requestNotificationPermission();
    if (granted) {
      const token = await getExpoPushTokenAsync();
      await setStoredExpoPushToken(token);
    }
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

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
      >
        <View style={styles.card}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.column}>
              {step === "intro" && (
                <FadeInView style={styles.step}>
                  <View style={styles.contentWrapper}>
                      <View style={styles.introHeader}>
                        <View style={styles.logoCircle}>
                          <Feather
                            name="sun"
                            size={40}
                            color={COLORS.ACCENT}
                            strokeWidth={2}
                          />
                        </View>
                        <Text style={styles.introTitle}>
                          {t("onboarding_intro_title")}
                        </Text>
                        <Text style={styles.introTagline}>
                          {t("onboarding_intro_tagline")}
                        </Text>
                      </View>
                      <View style={styles.pastAnswersCard}>
                        <View style={styles.pastAnswersHeader}>
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
                        <Text style={styles.exampleQuestion}>
                          {t("onboarding_intro_example_question")}
                        </Text>
                        <View style={styles.exampleAnswers}>
                          <View style={styles.exampleRow}>
                            <Text style={styles.exampleMonth}>
                              {t("onboarding_intro_example_month_1")}
                            </Text>
                            <Text style={styles.exampleAnswer}>
                              {t("onboarding_intro_example_answer_1")}
                            </Text>
                          </View>
                          <View style={styles.exampleRow}>
                            <Text style={styles.exampleMonth}>
                              {t("onboarding_intro_example_month_2")}
                            </Text>
                            <Text style={styles.exampleAnswer}>
                              {t("onboarding_intro_example_answer_2")}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.ctaWrap}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.primaryButton,
                            pressed && styles.primaryButtonPressed,
                          ]}
                          onPress={() => goNext("jokers")}
                        >
                          <Text style={styles.primaryButtonText}>
                            {t("onboarding_continue")}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                </FadeInView>
              )}

              {step === "jokers" && (
                <FadeInView style={styles.step}>
                  <View style={styles.contentWrapper}>
                      <View style={styles.jokersHeader}>
                        <View style={[styles.logoCircle, styles.jokerCircle]}>
                          <Feather
                            name="award"
                            size={40}
                            color="#F59E0B"
                            strokeWidth={2.5}
                          />
                        </View>
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
                        <View style={styles.bulletRow}>
                          <View style={[styles.bulletIcon, styles.bulletPurple]}>
                            <Feather
                              name="users"
                              size={18}
                              color={COLORS.ACCENT}
                              strokeWidth={2}
                            />
                          </View>
                          <View style={styles.bulletText}>
                            <Text style={styles.bulletTitle}>
                              {t("onboarding_jokers_refer")}
                            </Text>
                            <Text style={styles.bulletDesc}>
                              {t("onboarding_jokers_refer_desc")}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <Pressable
                        style={({ pressed }) => [
                          styles.primaryButton,
                          styles.primaryButtonFull,
                          pressed && styles.primaryButtonPressed,
                        ]}
                        onPress={() => goNext("notifications")}
                      >
                        <Text style={styles.primaryButtonText}>
                          {t("onboarding_continue")}
                        </Text>
                      </Pressable>
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
                      <Pressable
                        style={({ pressed }) => [
                          styles.primaryButton,
                          styles.primaryButtonFull,
                          !notificationTime && styles.primaryButtonDisabled,
                          pressed &&
                            notificationTime &&
                            styles.primaryButtonPressed,
                        ]}
                        onPress={handleNotificationsContinue}
                        disabled={!notificationTime}
                      >
                        <Text style={styles.primaryButtonText}>
                          {t("onboarding_continue")}
                        </Text>
                      </Pressable>
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
                        />
                        <Pressable
                          style={({ pressed }) => [
                            styles.primaryButton,
                            styles.primaryButtonFull,
                            styles.authSubmit,
                            (submitting || !email.trim() || !password.trim()) &&
                              styles.primaryButtonDisabled,
                            pressed &&
                              !submitting &&
                              styles.primaryButtonPressed,
                          ]}
                          onPress={handleAuthSubmit}
                          disabled={
                            submitting || !email.trim() || !password.trim()
                          }
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
                        </Pressable>
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
    backgroundColor: COLORS.BACKGROUND,
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
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.15,
    shadowRadius: 40,
    elevation: 8,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
    paddingBottom: 48,
  },
  column: {
    maxWidth: 380,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: 24,
  },
  step: {
    width: "100%",
  },
  contentWrapper: {
    paddingTop: 24,
    paddingBottom: 32,
    paddingHorizontal: 0,
  },
  introHeader: {
    alignItems: "center",
    marginBottom: 32,
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
  jokerCircle: {
    backgroundColor: "rgba(245,158,11,0.2)",
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
  introTagline: {
    fontSize: 16,
    color: COLORS.TEXT_SECONDARY,
    textAlign: "center",
    lineHeight: 24,
  },
  pastAnswersCard: {
    backgroundColor: "rgba(255,255,255,0.7)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    paddingVertical: 20,
    paddingHorizontal: 24,
    marginBottom: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  pastAnswersHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  pastAnswersLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.ACCENT,
  },
  exampleQuestion: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 20,
    marginBottom: 16,
  },
  exampleAnswers: {
    gap: 12,
  },
  exampleRow: {
    backgroundColor: "rgba(243,232,255,0.5)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.15)",
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  exampleMonth: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.ACCENT,
    marginBottom: 4,
  },
  exampleAnswer: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 20,
  },
  ctaWrap: {
    alignItems: "center",
    marginTop: 8,
  },
  primaryButton: {
    minWidth: 160,
    paddingHorizontal: 40,
    paddingVertical: 18,
    minHeight: 56,
    borderRadius: 9999,
    backgroundColor: COLORS.ACCENT,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.ACCENT,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 6,
  },
  primaryButtonFull: {
    width: "100%",
    marginTop: 32,
  },
  primaryButtonDisabled: {
    backgroundColor: "#9CA3AF",
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
