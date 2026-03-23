"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

import { COLORS } from "@/src/config/constants";
import { useAuth } from "@/src/context/AuthContext";
import { supabase } from "@/src/config/supabase";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import {
  clearPendingReferralCode,
  getPendingReferralCode,
} from "@/src/lib/referralPending";

async function getOnboardingCompletedForUser(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", userId)
    .maybeSingle();
  return data?.onboarding_completed === true;
}

export default function ReferralClaimScreen() {
  const router = useRouter();
  const { effectiveUser, authCheckDone } = useAuth();

  const userId = useMemo(() => effectiveUser?.id ?? null, [effectiveUser?.id]);
  const didNavigateRef = useRef(false);

  const [processing, setProcessing] = useState(true);
  const [rpcSuccess, setRpcSuccess] = useState<boolean | null>(null);

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
        const success = data === true && !error;
        setRpcSuccess(success);
      } catch (e) {
        await clearPendingReferralCode();
        if (cancelled) return;
        setRpcSuccess(false);
      } finally {
        if (cancelled) return;
        setProcessing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authCheckDone, userId, router]);

  useEffect(() => {
    if (!authCheckDone || !userId) return;
    if (processing) return;
    if (didNavigateRef.current) return;

    didNavigateRef.current = true;

    const goNext = async () => {
      const onboardingCompleted = await getOnboardingCompletedForUser(userId);
      router.replace(onboardingCompleted ? "/(tabs)/today" : "/(tabs)/onboarding-questions");
    };

    if (rpcSuccess) {
      // Show success UI for exactly 1000ms.
      setTimeout(() => {
        void goNext();
      }, 1000);
      return;
    }

    // If RPC returned false (or no pending code), skip success UI and navigate immediately.
    void goNext();
  }, [authCheckDone, userId, processing, rpcSuccess, router]);

  const showSuccessUi = !processing && rpcSuccess === true;

  if (processing) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.ACCENT} />
          <Text style={styles.loadingText}>Claiming your free joker…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.center}>
        {showSuccessUi ? (
          <>
            <LinearGradient
              colors={["rgba(167,139,250,0.45)", "rgba(139,92,246,0.25)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconWrap}
            >
              <Text style={styles.iconText}>👑</Text>
            </LinearGradient>

            <Text style={styles.title}>You got a free joker! 👑</Text>
            <Text style={styles.subtitle}>One question a day — starting now.</Text>

            {/* Decorative button to match app styling; navigation is automatic. */}
            <View style={{ width: "100%", marginTop: 18 }}>
              <PrimaryButton onPress={() => {}} disabled>
                Continue
              </PrimaryButton>
            </View>
          </>
        ) : (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.ACCENT} />
            <Text style={styles.loadingText}>Loading…</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FAFAFF",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 24,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.TEXT_SECONDARY,
    textAlign: "center",
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.18)",
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.10,
    shadowRadius: 26,
    elevation: 4,
    marginBottom: 16,
  },
  iconText: {
    fontSize: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.TEXT_PRIMARY,
    textAlign: "center",
    lineHeight: 28,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.TEXT_SECONDARY,
    textAlign: "center",
    lineHeight: 22,
  },
});

