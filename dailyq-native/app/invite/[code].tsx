import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, SafeAreaView, StyleSheet, View } from "react-native";
import { useRouter, useLocalSearchParams, Redirect } from "expo-router";

import { COLORS } from "@/src/config/constants";
import { useAuth } from "@/src/context/AuthContext";
import { useProfileContext } from "@/src/context/ProfileContext";
import { setPendingReferralCode } from "@/src/lib/referralPending";
import { getIncompleteOnboardingHref } from "@/src/lib/onboardingProgress";

function normalizeCodeParam(codeParam: unknown): string | null {
  if (!codeParam) return null;
  if (Array.isArray(codeParam)) return (codeParam[0] ?? "").trim() || null;
  return String(codeParam).trim() || null;
}

export default function InviteCodeRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const { user, authCheckDone } = useAuth();
  const { profile } = useProfileContext();

  const code = useMemo(() => normalizeCodeParam(params.code), [params.code]);

  // Save the referral code to AsyncStorage as soon as we have it.
  const [pendingSaved, setPendingSaved] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (code) {
        await setPendingReferralCode(code);
      }
      if (!cancelled) setPendingSaved(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  // For logged-in users with incomplete onboarding: navigate to the right step.
  useEffect(() => {
    if (!authCheckDone || !pendingSaved) return;
    if (!user || !code) return;
    if (profile == null) return; // wait for profile to load
    if (profile.onboarding_completed === true) return; // handled by JSX below

    let cancelled = false;
    getIncompleteOnboardingHref(user.id).then((href) => {
      if (!cancelled) router.replace(href);
    });
    return () => {
      cancelled = true;
    };
  }, [authCheckDone, pendingSaved, code, user, profile, router]);

  // Show loading until the code is saved and auth is resolved.
  if (!authCheckDone || !pendingSaved) {
    return <LoadingView />;
  }

  if (!code) {
    return <Redirect href={user ? "/(tabs)/today" : "/(auth)/onboarding"} />;
  }

  if (!user) {
    // Pass code as param AND it's already in AsyncStorage as a double-guarantee.
    return <Redirect href={`/(auth)/onboarding?ref=${encodeURIComponent(code)}`} />;
  }

  if (profile?.onboarding_completed === true) {
    return <Redirect href="/(tabs)/today" />;
  }

  // Logged-in, onboarding incomplete (or profile loading): wait for useEffect above.
  return <LoadingView />;
}

function LoadingView() {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.ACCENT} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FAFAFF",
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
