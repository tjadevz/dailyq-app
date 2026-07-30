import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { BackgroundLayer } from "@/src/components/BackgroundLayer";
import { OnboardingWidgetStep } from "@/src/components/OnboardingWidgetStep";
import { useAuth } from "@/src/context/AuthContext";
import { setOnboardingWidgetDone } from "@/src/lib/onboardingProgress";
import { setWidgetAnnouncementDismissed } from "@/src/lib/widgetAnnouncement";
import { supabase } from "@/src/config/supabase";
import { logEvent } from "@/lib/analytics";

export default function OnboardingWidgetScreen() {
  const router = useRouter();
  const { user, authCheckDone } = useAuth();
  const userId = user?.id ?? null;
  const [continuing, setContinuing] = useState(false);
  const continueCalledRef = useRef(false);

  useEffect(() => {
    logEvent("onboarding_screen_viewed", { screen: "widget" });
  }, []);

  useEffect(() => {
    if (!authCheckDone) return;
    if (!userId) {
      router.replace("/(tabs)/today");
    }
  }, [authCheckDone, userId, router]);

  const proceed = useCallback(async () => {
    if (continueCalledRef.current) return;
    continueCalledRef.current = true;
    if (!userId) {
      router.replace("/(tabs)/today");
      return;
    }
    setContinuing(true);
    try {
      // Users who saw this dedicated step shouldn't also get the Today
      // "widget now available" announcement right after their first answer.
      // Persisted both locally (instant) and server-side (survives reinstalls/
      // device switches, unlike the AsyncStorage-only flag alone).
      await Promise.all([
        setOnboardingWidgetDone(userId),
        setWidgetAnnouncementDismissed(userId),
        supabase.from("profiles").update({ widget_announcement_dismissed: true }).eq("id", userId),
      ]);
      router.navigate("/(tabs)/onboarding-questions");
    } finally {
      setContinuing(false);
    }
  }, [userId, router]);

  const handleAddWidget = useCallback(async () => {
    logEvent("onboarding_widget_add_tapped");
    await proceed();
  }, [proceed]);

  if (!userId) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <BackgroundLayer style={{ position: "relative", flex: 1 }} />
      </View>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <OnboardingWidgetStep
          onAddWidget={handleAddWidget}
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
