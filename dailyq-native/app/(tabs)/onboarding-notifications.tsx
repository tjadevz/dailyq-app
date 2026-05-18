import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { BackgroundLayer } from "@/src/components/BackgroundLayer";
import {
  OnboardingNotificationsStep,
  type NotificationTime,
} from "@/src/components/OnboardingNotificationsStep";
import { useAuth } from "@/src/context/AuthContext";
import {
  getOnboardingNotificationsDone,
  setOnboardingNotificationsDone,
} from "@/src/lib/onboardingProgress";
import { upsertPushSubscription } from "@/src/lib/pushSubscription";

export default function OnboardingNotificationsScreen() {
  const router = useRouter();
  const { effectiveUser } = useAuth();
  const userId = effectiveUser?.id ?? null;
  const [continuing, setContinuing] = useState(false);

  useEffect(() => {
    if (!userId || userId === "dev-user") return;
    let cancelled = false;
    getOnboardingNotificationsDone(userId).then((done) => {
      if (!cancelled && done) {
        router.replace("/(tabs)/onboarding-questions");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [userId, router]);

  const handleContinue = useCallback(
    async (reminderTime: NotificationTime, expoPushToken: string | null) => {
      if (!userId || userId === "dev-user") {
        router.replace("/(tabs)/today");
        return;
      }
      setContinuing(true);
      try {
        const { error: upsertErr } = await upsertPushSubscription(
          userId,
          expoPushToken,
          reminderTime
        );
        if (upsertErr) {
          console.error("[onboarding-notifications] Push subscription upsert failed:", upsertErr);
        }
        await setOnboardingNotificationsDone(userId);
        router.replace("/(tabs)/onboarding-questions");
      } finally {
        setContinuing(false);
      }
    },
    [userId, router]
  );

  if (!userId || userId === "dev-user") {
    router.replace("/(tabs)/today");
    return null;
  }

  return (
    <View style={styles.container}>
      <BackgroundLayer />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <OnboardingNotificationsStep
          onContinue={handleContinue}
          continuing={continuing}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
});
