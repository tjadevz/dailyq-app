"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS } from "@/src/config/constants";
import { BackgroundLayer } from "@/src/components/BackgroundLayer";
import { useAuth } from "@/src/context/AuthContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { supabase } from "@/src/config/supabase";
import {
  clearPendingReferralCode,
  getPendingReferralCode,
} from "@/src/lib/referralPending";

const LOGO_SIZE = 110;

export default function ReferralClaimScreen() {
  const router = useRouter();
  const { user, authCheckDone } = useAuth();
  const { t } = useLanguage();

  const userId = useMemo(() => user?.id ?? null, [user?.id]);
  const didNavigateRef = useRef(false);

  const [processing, setProcessing] = useState(true);
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    if (!authCheckDone) return;
    if (!userId) {
      router.replace("/(auth)/onboarding");
      return;
    }

    let cancelled = false;
    (async () => {
      const pendingCode = await getPendingReferralCode();
      if (!pendingCode) {
        if (cancelled) return;
        setProcessing(false);
        return;
      }

      try {
        const { data, error } = await supabase.rpc("handle_referral", {
          p_referral_code: pendingCode,
          p_new_user_id: userId,
        });

        // Regardless of success/failure: clear the pending code so we don't retry.
        await clearPendingReferralCode();

        if (cancelled) return;
        if (error) {
          console.error("[ReferralClaim] handle_referral failed:", error);
        }
      } catch (e) {
        await clearPendingReferralCode();
        if (cancelled) return;
      } finally {
        if (cancelled) return;
        setProcessing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authCheckDone, userId, router]);

  const goNext = async () => {
    if (!userId || navigating || didNavigateRef.current) return;
    didNavigateRef.current = true;
    setNavigating(true);
    try {
      router.replace("/(tabs)/onboarding-notifications");
    } finally {
      setNavigating(false);
    }
  };

  if (processing) {
    return (
      <View style={styles.safe}>
        <BackgroundLayer />
        <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.ACCENT} />
            <Text style={styles.loadingText}>Claiming your free joker…</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      <BackgroundLayer />
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.introContent}>
          <View style={styles.introGroup}>
            <View style={styles.introLogoWrap}>
              <View style={styles.introHaloOuter} />
              <View style={styles.introHaloInner} />
              <View>
                <Image
                  source={require("@/assets/images/logo.nobg.png")}
                  style={styles.introLogoImage}
                  resizeMode="contain"
                />
              </View>
            </View>
            <Text style={styles.introTitle}>{t("onboarding_intro_title")}</Text>
            <Text style={styles.introSubtitle}>Je eerste 7 vragen wachten op je.</Text>
            <Pressable
              onPress={() => void goNext()}
              disabled={navigating}
              style={({ pressed }) => [styles.introCtaWrap, pressed && styles.introCtaPressed]}
            >
              <LinearGradient
                colors={navigating ? ["#9CA3AF", "#9CA3AF"] : ["#FCD34D", "#F59E0B"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.introCtaGradient, navigating && styles.introCtaDisabled]}
              >
                {navigating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.introCtaText}>{t("referral_claim_cta")}</Text>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  introContent: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  introGroup: {
    alignItems: "center",
    width: "100%",
  },
  introLogoWrap: {
    position: "relative",
    width: 160,
    height: 160,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  introHaloOuter: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(139,92,246,0.12)",
  },
  introHaloInner: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "rgba(167,139,250,0.15)",
  },
  introLogoImage: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    marginTop: 16,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 24,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.TEXT_SECONDARY,
    textAlign: "center",
  },
  introTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
    textAlign: "center",
    marginBottom: 12,
  },
  introSubtitle: {
    fontSize: 16,
    color: COLORS.TEXT_SECONDARY,
    textAlign: "center",
    lineHeight: 24,
    marginTop: 0,
    marginBottom: 32,
  },
  introCtaWrap: {
    width: "100%",
    minHeight: 56,
    borderRadius: 9999,
    overflow: "hidden",
    shadowColor: "rgba(245,158,11,0.35)",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 1,
    shadowRadius: 56,
    elevation: 8,
  },
  introCtaPressed: {
    opacity: 0.9,
  },
  introCtaGradient: {
    paddingVertical: 18,
    paddingHorizontal: 40,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  introCtaDisabled: {
    shadowOpacity: 0,
  },
  introCtaText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});

