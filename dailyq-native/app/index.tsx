import React, { useEffect, useState } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import * as Linking from "expo-linking";
import { Redirect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/context/AuthContext";
import { COLORS } from "@/src/config/constants";
import { BackgroundLayer } from "@/src/components/BackgroundLayer";
import {
  isResetPasswordUrl,
  hasRecoveryTokens,
} from "@/src/lib/resetPasswordLink";
import { supabase } from "@/src/config/supabase";

function PostLoginLoadingScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[loadingScreenStyles.screen, { paddingTop: insets.top }]}>
      <BackgroundLayer />
      <View style={loadingScreenStyles.center}>
        <ActivityIndicator size="large" color={COLORS.ACCENT} />
      </View>
    </View>
  );
}

export default function Index() {
  const { user, authCheckDone } = useAuth();
  const [initialUrlChecked, setInitialUrlChecked] = useState(false);
  const [pendingResetUrl, setPendingResetUrl] = useState<string | null>(null);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);

  // Step 1: check cold-start deep link before any auth-based routing
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url && isResetPasswordUrl(url) && hasRecoveryTokens(url)) {
        setPendingResetUrl(url);
      }
      setInitialUrlChecked(true);
    });
  }, []);

  // When user exists, fetch onboarding_completed to decide redirect
  useEffect(() => {
    if (!user?.id || user.id === "dev-user") {
      setOnboardingChecked(true);
      setOnboardingCompleted(true);
      return;
    }
    let cancelled = false;
    supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) {
          setOnboardingCompleted(data?.onboarding_completed ?? false);
          setOnboardingChecked(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOnboardingCompleted(false);
          setOnboardingChecked(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Wait for initial URL check so we don't redirect to onboarding before we know about a reset link
  if (!initialUrlChecked) {
    return <PostLoginLoadingScreen />;
  }

  // Cold-start reset-password link: redirect with full URL so reset-password can setSession
  if (pendingResetUrl) {
    return (
      <Redirect
        href={`/(auth)/reset-password?url=${encodeURIComponent(pendingResetUrl)}`}
      />
    );
  }

  if (!authCheckDone) {
    return <PostLoginLoadingScreen />;
  }

  if (user) {
    if (!onboardingChecked) {
      return <PostLoginLoadingScreen />;
    }
    if (onboardingCompleted === true) {
      return <Redirect href="/(tabs)/today" />;
    }
    return <Redirect href="/(tabs)/onboarding-questions" />;
  }

  return <Redirect href="/(auth)/onboarding" />;
}

const loadingScreenStyles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
});
