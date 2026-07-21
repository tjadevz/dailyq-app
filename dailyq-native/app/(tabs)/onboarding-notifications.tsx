import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { BackgroundLayer } from "@/src/components/BackgroundLayer";
import {
  OnboardingNotificationsStep,
  type NotificationTime,
} from "@/src/components/OnboardingNotificationsStep";
import { useAuth } from "@/src/context/AuthContext";
import { setOnboardingNotificationsDone } from "@/src/lib/onboardingProgress";
import { upsertPushSubscription } from "@/src/lib/pushSubscription";
import { logEvent } from "@/lib/analytics";

export default function OnboardingNotificationsScreen() {
  const router = useRouter();
  const { user, authCheckDone } = useAuth();
  const userId = user?.id ?? null;
  const [continuing, setContinuing] = useState(false);
  const continueCalledRef = useRef(false);

  useEffect(() => {
    console.log(`[NOTIF] MOUNT  userId=${userId?.slice(0,8) ?? "null"}`);
    logEvent("onboarding_screen_viewed", { screen: "notifications" });
    return () => { console.log("[NOTIF] UNMOUNT"); };
  }, []);

  // Redirect to today if auth is settled and there is no real user.
  // Using useEffect (not render) avoids acting on stale auth state right
  // after login, when user may not yet be set in context.
  useEffect(() => {
    console.log(`[NOTIF] auth effect  authCheckDone=${authCheckDone}  userId=${userId?.slice(0,8) ?? "null"}`);
    if (!authCheckDone) return;
    if (!userId) {
      console.log("[NOTIF] no userId → replace to today");
      router.replace("/(tabs)/today");
    }
  }, [authCheckDone, userId, router]);

  const handleContinue = useCallback(
    async (reminderTime: NotificationTime, expoPushToken: string | null) => {
      console.log(`[NOTIF] handleContinue called  userId=${userId?.slice(0,8)}  blocked=${continueCalledRef.current}`);
      if (continueCalledRef.current) return;
      continueCalledRef.current = true;
      if (!userId) {
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
        console.log("[NOTIF] navigating to onboarding-questions");
        router.navigate("/(tabs)/onboarding-questions");
      } finally {
        setContinuing(false);
      }
    },
    [userId, router]
  );

  // Show nothing while auth is still resolving (avoids white flash).
  if (!userId) {
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
