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

  const [pendingSaved, setPendingSaved] = useState(false);
  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    (async () => {
      // Keep the latest referral code. Claim only happens after signup.
      await setPendingReferralCode(code);
      if (!cancelled) setPendingSaved(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  useEffect(() => {
    if (!authCheckDone) return;
    if (!pendingSaved && code) return;

    if (!code) {
      // If no code, just proceed to onboarding/today based on auth.
      router.replace(user ? "/(tabs)/today" : "/(auth)/onboarding");
      return;
    }

    if (!user) {
      router.replace(`/(auth)/onboarding?ref=${encodeURIComponent(code)}`);
      return;
    }

    const onboardingCompleted = profile?.onboarding_completed === true;
    if (onboardingCompleted) {
      router.replace("/(tabs)/today");
      return;
    }
    void getIncompleteOnboardingHref(user.id).then((href) => {
      router.replace(href);
    });
  }, [authCheckDone, pendingSaved, code, user, profile, router]);

  // While we wait for Auth/Profile to be ready, render a minimal loader.
  if (!authCheckDone || (code && !pendingSaved)) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={COLORS.ACCENT} />
        </View>
      </SafeAreaView>
    );
  }

  // For the case we ended up redirecting above, return null/Redirect-friendly.
  // (Expo Router will replace before the user sees anything.)
  return <Redirect href={user ? "/(tabs)/today" : "/(auth)/onboarding"} />;
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

