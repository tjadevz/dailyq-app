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
import { setPendingReferralCode } from "@/src/lib/referralPending";
import { getIncompleteOnboardingHref } from "@/src/lib/onboardingProgress";
import { useTodayQuestion } from "@/src/hooks/useTodayQuestion";

function extractInviteCodeFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "invite") {
      const code = parsed.pathname.replace(/^\/+/, "").trim();
      return code.length > 0 ? code : null;
    }
  } catch {
    // fallback: look for /invite/<code> in path
  }
  const match = url.match(/\/invite\/([^/?#]+)/);
  return match?.[1]?.trim() || null;
}

export default function Index() {
  const { user, authCheckDone } = useAuth();
  const { lang } = useLanguage();
  const [initialUrlChecked, setInitialUrlChecked] = useState(false);
  const [pendingResetUrl, setPendingResetUrl] = useState<string | null>(null);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const [incompleteOnboardingHref, setIncompleteOnboardingHref] = useState<string | null>(null);
  // Track which userId the onboarding state was fetched for. The null-user branch sets
  // onboardingCompleted=true; we must not use that value when a real user has loaded.
  const [onboardingFetchedForUserId, setOnboardingFetchedForUserId] = useState<string | null>(null);
  const userId = user?.id ?? null;
  const onboardingCheckedForCurrentUser = onboardingChecked && onboardingFetchedForUserId === userId;
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
        if (cancelled || !url) return;

        if (isResetPasswordUrl(url) && hasRecoveryTokens(url)) {
          setPendingResetUrl(url);
        } else {
          // If the app launched via an invite link (dailyq://invite/<code>), save the
          // referral code so onboarding can claim it even if Expo Router routes here first.
          const inviteCode = extractInviteCodeFromUrl(url);
          if (inviteCode) {
            await setPendingReferralCode(inviteCode);
          }
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
    const currentUserId = user?.id ?? null;
    if (!currentUserId || currentUserId === "dev-user") {
      setOnboardingFetchedForUserId(currentUserId);
      setOnboardingChecked(true);
      setOnboardingCompleted(true);
      setIncompleteOnboardingHref(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("id", currentUserId)
          .maybeSingle();
        if (cancelled) return;
        const completed = data?.onboarding_completed ?? false;
        setOnboardingCompleted(completed);
        if (!completed) {
          const href = await getIncompleteOnboardingHref(currentUserId);
          if (!cancelled) setIncompleteOnboardingHref(href);
        } else {
          setIncompleteOnboardingHref(null);
        }
      } catch {
        if (cancelled) return;
        setOnboardingCompleted(false);
        const href = await getIncompleteOnboardingHref(currentUserId);
        if (!cancelled) setIncompleteOnboardingHref(href);
      } finally {
        if (!cancelled) {
          setOnboardingFetchedForUserId(currentUserId);
          setOnboardingChecked(true);
        }
      }
    })();
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
    if (!onboardingCheckedForCurrentUser) {
      return <DailyQLoadingScreen />;
    }
    if (onboardingCompleted === true) {
      // Wait for the daily question so the tab bar doesn't appear mid-loading.
      if (questionLoading) return <DailyQLoadingScreen />;
      console.log("[INDEX] Redirect → /(tabs)/today");
      return <Redirect href="/(tabs)/today" />;
    }
    if (!incompleteOnboardingHref) return <DailyQLoadingScreen />;
    console.log(`[INDEX] Redirect → ${incompleteOnboardingHref}`);
    return <Redirect href={incompleteOnboardingHref} />;
  }

  return <Redirect href="/(auth)/onboarding" />;
}
