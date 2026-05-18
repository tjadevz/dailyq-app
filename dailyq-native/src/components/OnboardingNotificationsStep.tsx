import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { COLORS } from "@/src/config/constants";
import { useLanguage } from "@/src/context/LanguageContext";
import { registerForPushNotificationsAsync } from "@/src/native/notifications";
import { setStoredExpoPushToken } from "@/src/lib/pushSubscription";

const REMINDER_TIME_KEY = "dailyq-reminder-time";

export type NotificationTime = "morning" | "afternoon" | "evening";

async function saveReminderTime(time: NotificationTime) {
  await AsyncStorage.setItem(REMINDER_TIME_KEY, time);
}

function StepTransitionView({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(40)).current;
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 320,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: 0,
          duration: 320,
          useNativeDriver: true,
        }),
      ]).start();
    });
    return () => cancelAnimationFrame(id);
  }, [opacity, translateX]);
  return (
    <Animated.View style={[style, { opacity, transform: [{ translateX }] }]}>
      {children}
    </Animated.View>
  );
}

function OnboardingPrimaryButton({
  onPress,
  disabled,
  children,
}: {
  onPress: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const gradientColors = disabled ? ["#9CA3AF", "#9CA3AF"] : ["#7C3AED", "#6D28D9"];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primaryButtonWrap,
        pressed && !disabled && styles.primaryButtonPressed,
      ]}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[
          styles.primaryButtonGradient,
          disabled && styles.primaryButtonDisabled,
          !disabled && { shadowColor: "rgba(124,58,237,0.35)" },
        ]}
      >
        {children}
      </LinearGradient>
    </Pressable>
  );
}

export function OnboardingNotificationsStep({
  onContinue,
  continuing = false,
}: {
  onContinue: (time: NotificationTime, expoPushToken: string | null) => void | Promise<void>;
  continuing?: boolean;
}) {
  const { t } = useLanguage();
  const [notificationTime, setNotificationTime] = useState<NotificationTime | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleContinue = useCallback(async () => {
    if (!notificationTime || submitting) return;
    setSubmitting(true);
    try {
      await saveReminderTime(notificationTime);
      let token: string | null = null;
      try {
        token = await registerForPushNotificationsAsync();
        await setStoredExpoPushToken(token);
      } catch (e) {
        console.error("[onboarding-notifications] Push token registration failed:", e);
      }
      if (token === null && !__DEV__) {
        console.error("[onboarding-notifications] Push token is null (permission denied or unavailable)");
      }
      await onContinue(notificationTime, token);
    } finally {
      setSubmitting(false);
    }
  }, [notificationTime, onContinue, submitting]);

  const disabled = !notificationTime || submitting || continuing;

  return (
    <StepTransitionView style={styles.step}>
      <View style={styles.contentWrapper}>
        <View style={styles.notifHeader}>
          <View style={[styles.logoCircle, styles.notifCircle]}>
            <Feather name="bell" size={40} color="#3B82F6" strokeWidth={2} />
          </View>
          <Text style={styles.notifTitle}>{t("onboarding_notif_title")}</Text>
          <Text style={styles.introTagline}>{t("onboarding_notif_subtitle")}</Text>
        </View>
        <View style={styles.notifActionsWrap}>
          <View style={styles.optionList}>
            {(["morning", "afternoon", "evening"] as const).map((opt) => (
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
                    {notificationTime === opt && <View style={styles.radioInner} />}
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
          <OnboardingPrimaryButton onPress={() => void handleContinue()} disabled={disabled}>
            <Text style={styles.primaryButtonText}>
              {submitting || continuing ? "…" : t("onboarding_continue")}
            </Text>
          </OnboardingPrimaryButton>
        </View>
      </View>
    </StepTransitionView>
  );
}

const styles = StyleSheet.create({
  step: {
    flex: 1,
    width: "100%",
  },
  contentWrapper: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: "center",
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  notifCircle: {
    backgroundColor: "rgba(219,234,254,0.9)",
  },
  notifHeader: {
    alignItems: "center",
    marginBottom: 32,
  },
  notifActionsWrap: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 300,
  },
  notifTitle: {
    fontSize: 24,
    fontWeight: "600",
    color: COLORS.TEXT_PRIMARY,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 8,
  },
  introTagline: {
    fontSize: 15,
    color: COLORS.TEXT_SECONDARY,
    textAlign: "center",
    lineHeight: 22,
  },
  optionList: {
    gap: 12,
    marginBottom: 32,
  },
  optionCard: {
    width: "100%",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
    backgroundColor: "rgba(255,255,255,0.6)",
    paddingVertical: 16,
    overflow: "hidden",
  },
  optionCardSelected: {
    backgroundColor: "rgba(255,255,255,1)",
    borderColor: "rgba(124,58,237,0.2)",
    shadowColor: "rgba(124,58,237,0.1)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 30,
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
    borderColor: "#7C3AED",
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#7C3AED",
  },
  primaryButtonWrap: {
    width: "100%",
    marginTop: 0,
  },
  primaryButtonGradient: {
    paddingHorizontal: 40,
    paddingVertical: 18,
    minHeight: 56,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 1,
    shadowRadius: 56,
    elevation: 8,
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
});
