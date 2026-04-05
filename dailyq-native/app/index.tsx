import React, { useEffect, useState } from "react";
import * as Linking from "expo-linking";
import { Redirect } from "expo-router";

import { useAuth } from "@/src/context/AuthContext";
import { useLanguage } from "@/src/context/LanguageContext";
import DailyQLoadingScreen from "@/src/components/DailyQLoadingScreen";
import {
  isResetPasswordUrl,
  hasRecoveryTokens,
} from "@/src/lib/resetPasswordLink";
import { supabase } from "@/src/config/supabase";
import { tryConsumeReferralFromClipboardOnFirstLaunch } from "@/src/lib/referralClipboard";
import { useTodayQuestion } from "@/src/hooks/useTodayQuestion";

export default function Index() {
  const { user, authCheckDone } = useAuth();
  const { lang } = useLanguage();
  const [initialUrlChecked, setInitialUrlChecked] = useState(false);
  const [pendingResetUrl, setPendingResetUrl] = useState<string | null>(null);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const userId = user?.id ?? null;
  const { loading: questionLoading } = useTodayQuestion(lang, userId);

  // Step 1: cold-start deep link + one-time clipboard referral (before routing)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [url] = await Promise.all([
          Linking.getInitialURL(),
          tryConsumeReferralFromClipboardOnFirstLaunch(),
        ]);
        if (!cancelled && url && isResetPasswordUrl(url) && hasRecoveryTokens(url)) {
          setPendingResetUrl(url);
        }
      } finally {
        if (!cancelled) setInitialUrlChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
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
    return <DailyQLoadingScreen />;
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
    return <DailyQLoadingScreen />;
  }

  if (user) {
    if (!onboardingChecked) {
      return <DailyQLoadingScreen />;
    }
    if (onboardingCompleted === true) {
      // Wait for the daily question so the tab bar doesn't appear mid-loading.
      if (questionLoading) return <DailyQLoadingScreen />;
      return <Redirect href="/(tabs)/today" />;
    }
    return <Redirect href="/(tabs)/onboarding-questions" />;
  }

  return <Redirect href="/(auth)/onboarding" />;
}
