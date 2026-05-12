import React, { useCallback, useEffect, useRef, useState } from "react";
import { InteractionManager, View } from "react-native";
import Constants from "expo-constants";
import { Slot, usePathname } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts, Inter_500Medium } from "@expo-google-fonts/inter";
import { AuthProvider } from "@/src/context/AuthContext";
import { ProfileProvider } from "@/src/context/ProfileContext";
import { LanguageProvider } from "@/src/context/LanguageContext";
import { CalendarAnswersProvider } from "@/src/context/CalendarAnswersContext";
import { StreakMilestoneProvider } from "@/src/context/StreakMilestoneContext";
import { BackgroundLayer } from "@/src/components/BackgroundLayer";
import { DeepLinkProvider } from "@/src/context/DeepLinkContext";
import ReferralGivenModal from "@/src/components/modals/ReferralGivenModal";
import { useAuth } from "@/src/context/AuthContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { supabase } from "@/src/config/supabase";
import { consumeReferralGivenDevTrigger } from "@/src/lib/referralGivenDevTrigger";
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

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Inter_500Medium });
  if (!fontsLoaded) return null;
  return (
    <SafeAreaProvider>
      <AuthProvider>
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
                    <SyncProfileAppVersionGate />
                    <ReferralGivenAppOpenGate />
                  </View>
                </CalendarAnswersProvider>
              </StreakMilestoneProvider>
            </LanguageProvider>
          </ProfileProvider>
        </DeepLinkProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
