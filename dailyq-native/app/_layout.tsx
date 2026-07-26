import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, View } from "react-native";
import { addNotificationResponseReceivedListener } from "expo-notifications";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { Slot, usePathname, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts, Inter_500Medium } from "@expo-google-fonts/inter";
import { AuthProvider } from "@/src/context/AuthContext";
import { PurchasesProvider } from "@/src/context/PurchasesContext";
import { ProfileProvider, useProfileContext } from "@/src/context/ProfileContext";
import { LanguageProvider } from "@/src/context/LanguageContext";
import { CalendarAnswersProvider } from "@/src/context/CalendarAnswersContext";
import { StreakMilestoneProvider } from "@/src/context/StreakMilestoneContext";
import { BackgroundLayer } from "@/src/components/BackgroundLayer";
import { DeepLinkProvider } from "@/src/context/DeepLinkContext";
import ReferralGivenModal from "@/src/components/modals/ReferralGivenModal";
import WelcomeBackModal from "@/src/components/modals/WelcomeBackModal";
import { useAuth } from "@/src/context/AuthContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { supabase } from "@/src/config/supabase";
import { consumeReferralGivenDevTrigger } from "@/src/lib/referralGivenDevTrigger";
import { logEvent } from "@/lib/analytics";
import * as Sentry from "@sentry/react-native";

if (!__DEV__) {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  });
}

type ReferralGivenEvent = {
  created_at: string;
  delta: number;
  reason: string;
};

let coldStartLogged = false;

function NavLogger() {
  const pathname = usePathname();
  const segments = useSegments();
  const prev = useRef<string>("");
  useEffect(() => {
    const ts = new Date().toISOString().slice(11, 23);
    console.log(`[NAV] ${ts}  ${prev.current || "(start)"} → ${pathname}  segs=${JSON.stringify(segments)}`);
    prev.current = pathname;
  }, [pathname]);
  return null;
}

function AnalyticsAppLifecycleGate() {
  const appStateRef = useRef(AppState.currentState);
  const lastForegroundRef = useRef<number>(0);
  const openedViaNotificationRef = useRef(false);
  const coldStartSentRef = useRef(false);
  const { user, authCheckDone } = useAuth();

  useEffect(() => {
    if (!coldStartLogged) {
      coldStartLogged = true;
      lastForegroundRef.current = Date.now();
    }

    const appStateSubscription = AppState.addEventListener("change", (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (next === "active" && (prev === "background" || prev === "inactive")) {
        const now = Date.now();
        if (now - lastForegroundRef.current > 30_000) {
          lastForegroundRef.current = now;
          if (openedViaNotificationRef.current) {
            openedViaNotificationRef.current = false;
            logEvent("app_open", { source: "notification" });
          } else {
            logEvent("app_open", { source: "foreground" });
          }
        }
      }
    });

    const notificationSubscription = addNotificationResponseReceivedListener(() => {
      openedViaNotificationRef.current = true;
      logEvent("notification_tapped");
    });

    return () => {
      appStateSubscription.remove();
      notificationSubscription.remove();
    };
  }, []);

  // Log cold_start only once auth is resolved and user is available.
  // This handles new users who have no session at app launch (e.g. Apple Sign-In):
  // the event would silently drop without a session, so we defer until auth is done.
  useEffect(() => {
    if (!authCheckDone || !user?.id || user.id === "dev-user") return;
    if (coldStartSentRef.current) return;
    coldStartSentRef.current = true;
    logEvent("app_open", { source: "cold_start" });
  }, [authCheckDone, user?.id]);

  return null;
}

function SyncProfileAppVersionGate() {
  const { user, authCheckDone } = useAuth();

  useEffect(() => {
    if (!authCheckDone || !user?.id || user.id === "dev-user") return;

    const version = Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? "unknown";

    supabase
      .from("profiles")
      .update({ app_version: version })
      .eq("id", user.id)
      .then(({ error }) => {
        if (error) console.error("[SyncProfileAppVersion] failed:", error);
      });
  }, [authCheckDone, user?.id]);

  return null;
}

function ReferralGivenAppOpenGate() {
  const { user, authCheckDone } = useAuth();
  const { t } = useLanguage();
  const pathname = usePathname();

  const [visible, setVisible] = useState(false);
  const [pendingSeenAt, setPendingSeenAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const checkedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!authCheckDone) return;

    const userId = user?.id ?? null;
    if (!userId || userId === "dev-user") {
      checkedUserIdRef.current = null;
      setVisible(false);
      setPendingSeenAt(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      if (__DEV__) {
        const triggered = await consumeReferralGivenDevTrigger();
        if (cancelled) return;
        if (triggered) {
          setLoading(false);
          setVisible(true);
          return;
        }
      }

      if (checkedUserIdRef.current === userId) {
        setLoading(false);
        return;
      }
      checkedUserIdRef.current = userId;

      const { data, error } = await supabase.rpc("get_unseen_referral_given_event");
      if (cancelled) return;
      setLoading(false);
      if (error) {
        console.error("[ReferralGivenGate] fetch unseen event failed:", error);
        return;
      }
      const row = (Array.isArray(data) ? data[0] : data) as ReferralGivenEvent | null;
      if (!row?.created_at) return;
      setPendingSeenAt(row.created_at);
      setVisible(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [authCheckDone, user?.id, pathname]);

  const handleClose = useCallback(async () => {
    setVisible(false);
    if (!pendingSeenAt) return;
    const seenAt = pendingSeenAt;
    setPendingSeenAt(null);
    const { error } = await supabase.rpc("mark_referral_given_seen", {
      p_seen_at: seenAt,
    });
    if (error) {
      console.error("[ReferralGivenGate] mark seen failed:", error);
    }
  }, [pendingSeenAt]);

  return (
    <ReferralGivenModal
      visible={visible && !loading}
      title={t("referral_given_modal_title")}
      body={t("referral_given_modal_body")}
      ctaLabel={t("referral_given_modal_cta")}
      onClose={() => {
        void handleClose();
      }}
    />
  );
}

type WelcomeBackOffer = {
  days_absent: number;
  absence_key: string;
};

function WelcomeBackAppOpenGate() {
  const { user, authCheckDone } = useAuth();
  const { t } = useLanguage();
  const { refetch: refetchProfile } = useProfileContext();

  const [visible, setVisible] = useState(false);
  const [offer, setOffer] = useState<WelcomeBackOffer | null>(null);
  const [claiming, setClaiming] = useState(false);
  const checkedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!authCheckDone) return;

    const userId = user?.id ?? null;
    if (!userId || userId === "dev-user") {
      checkedUserIdRef.current = null;
      setVisible(false);
      setOffer(null);
      return;
    }
    if (checkedUserIdRef.current === userId) return;
    checkedUserIdRef.current = userId;

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("get_welcome_back_offer");
      if (cancelled) return;
      if (error) {
        console.error("[WelcomeBackGate] fetch offer failed:", error);
        return;
      }
      const row = (Array.isArray(data) ? data[0] : data) as WelcomeBackOffer | null;
      if (!row?.absence_key) return;
      setOffer(row);
      setVisible(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [authCheckDone, user?.id]);

  const handleClaim = useCallback(async () => {
    if (claiming) return;
    setClaiming(true);
    const { data, error } = await supabase.rpc("claim_welcome_back_joker");
    setClaiming(false);
    if (error) {
      console.error("[WelcomeBackGate] claim failed:", error);
      return;
    }
    if (data) {
      await refetchProfile();
    }
    setVisible(false);
  }, [claiming, refetchProfile]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    const absenceKey = offer?.absence_key;
    const userId = user?.id;
    if (!absenceKey || !userId || userId === "dev-user") return;
    supabase
      .from("profiles")
      .update({ welcome_back_offer_resolved_for: absenceKey })
      .eq("id", userId)
      .then(({ error }) => {
        if (error) console.error("[WelcomeBackGate] mark dismissed failed:", error);
      });
  }, [offer?.absence_key, user?.id]);

  return (
    <WelcomeBackModal
      visible={visible}
      title={t("welcome_back_modal_title")}
      body={t("welcome_back_modal_body", { joker_count: "3" })}
      ctaLabel={t("welcome_back_modal_cta")}
      claiming={claiming}
      onClaim={() => {
        void handleClaim();
      }}
      onDismiss={handleDismiss}
    />
  );
}

function ForceUpdateGate() {
  useEffect(() => {
    if (__DEV__) return;
    (async () => {
      try {
        const result = await Updates.checkForUpdateAsync();
        if (!result.isAvailable) return;
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
      } catch (e) {
        console.error("[ForceUpdateGate] update check failed:", e);
      }
    })();
  }, []);

  return null;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Inter_500Medium });
  if (!fontsLoaded) return null;
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <PurchasesProvider>
          <DeepLinkProvider>
            <ProfileProvider>
              <LanguageProvider>
                <StreakMilestoneProvider>
                  <CalendarAnswersProvider>
                    <View style={{ flex: 1, backgroundColor: "#FAFAFF" }}>
                      <BackgroundLayer />
                      <View style={{ flex: 1, backgroundColor: "transparent" }}>
                        <Slot />
                      </View>
                      <AnalyticsAppLifecycleGate />
                      <SyncProfileAppVersionGate />
                      <ReferralGivenAppOpenGate />
                      <WelcomeBackAppOpenGate />
                      <ForceUpdateGate />
                      <NavLogger />
                    </View>
                  </CalendarAnswersProvider>
                </StreakMilestoneProvider>
              </LanguageProvider>
            </ProfileProvider>
          </DeepLinkProvider>
        </PurchasesProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
