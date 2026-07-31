import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Share, ScrollView, Animated } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";

import { COLORS, JOKER } from "@/src/config/constants";
import { JOKER_PRODUCT_IDS, JOKER_COUNT_BY_PRODUCT_ID, type JokerProductId } from "@/src/config/revenuecat";
import BottomSheetShell from "@/src/components/modals/BottomSheetShell";
import { useLanguage } from "@/src/context/LanguageContext";
import { useAuth } from "@/src/context/AuthContext";
import { useProfileContext } from "@/src/context/ProfileContext";
import { PURCHASES_SUPPORTED, usePurchases } from "@/src/context/PurchasesContext";
import { STREAK_MILESTONES, getAlreadyGranted } from "@/src/context/StreakMilestoneContext";
import { supabase } from "@/src/config/supabase";
import { logEvent } from "@/lib/analytics";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type JokerShopModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function JokerShopModal({ visible, onClose }: JokerShopModalProps) {
  const { t } = useLanguage();
  const { effectiveUser } = useAuth();
  const userId = effectiveUser?.id ?? null;
  const { profile, refetch: refetchProfile, bumpJokerBalance } = useProfileContext();
  const { products, productsLoading, purchaseJokerPack } = usePurchases();

  const jokerBalance = profile?.joker_balance ?? 0;

  const [purchasingProductId, setPurchasingProductId] = useState<string | null>(null);
  const [purchaseMessage, setPurchaseMessage] = useState<string | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState<{ count: number } | null>(null);
  const successIconScale = useRef(new Animated.Value(0.7)).current;

  const [realStreak, setRealStreak] = useState(0);
  const [grantedMilestones, setGrantedMilestones] = useState<Set<number>>(new Set());

  // Refresh streak/milestone data every time the sheet opens, not just on mount —
  // it stays mounted (hidden) between opens like any other modal in this app.
  // Retries once on failure: right after a cold app start the Supabase client's
  // session can still be attaching, so the very first RPC after launch can fail
  // silently (this effect previously had no error handling at all, so a failed
  // fetch just left the old/0 streak on screen until the modal was closed and
  // reopened, which gave the retry a second, later chance to succeed).
  useEffect(() => {
    if (!visible || !userId || userId === "dev-user") return;
    let cancelled = false;

    const fetchStreak = async (isRetry: boolean): Promise<void> => {
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const { data, error } = await supabase.rpc("get_user_streaks", {
        p_user_id: userId,
        p_timezone: userTimezone,
      });
      if (cancelled) return;
      if (error) {
        console.error("[JokerShop] get_user_streaks failed:", error);
        if (!isRetry) {
          await new Promise((resolve) => setTimeout(resolve, 900));
          if (!cancelled) await fetchStreak(true);
        }
        return;
      }
      const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
      const r = row?.real_streak ?? 0;
      const v = row?.visual_streak ?? 0;
      setRealStreak(Math.max(Number(r), Number(v)));
    };

    fetchStreak(false).catch((e) => console.error("[JokerShop] streak fetch threw:", e));
    getAlreadyGranted(supabase, userId)
      .then((granted) => {
        if (!cancelled) setGrantedMilestones(granted);
      })
      .catch((e) => console.error("[JokerShop] getAlreadyGranted failed:", e));

    return () => {
      cancelled = true;
    };
  }, [visible, userId]);

  useEffect(() => {
    if (!visible) {
      setPurchaseMessage(null);
      setPurchasingProductId(null);
      setPurchaseSuccess(null);
    }
  }, [visible]);

  // Spring the success icon in whenever a purchase completes, and auto-return to
  // the pack list after a few seconds so the sheet doesn't feel stuck.
  useEffect(() => {
    if (!purchaseSuccess) return;
    successIconScale.setValue(0.7);
    Animated.spring(successIconScale, {
      toValue: 1,
      useNativeDriver: true,
      damping: 10,
      stiffness: 210,
    }).start();
    const timer = setTimeout(() => setPurchaseSuccess(null), 3500);
    return () => clearTimeout(timer);
  }, [purchaseSuccess, successIconScale]);

  const nextMilestone = STREAK_MILESTONES.find((m) => m > realStreak && !grantedMilestones.has(m)) ?? null;
  const daysLeft = nextMilestone != null ? nextMilestone - realStreak : 0;
  const progressPercent = nextMilestone != null ? Math.min(100, (realStreak / nextMilestone) * 100) : 0;

  const handleInvite = useCallback(async () => {
    if (!profile?.referral_code) return;
    const link = `https://dailyqapp.com/invite/${profile.referral_code}`;
    try {
      await Share.share({
        message: t("today_invite_share_message", { link }),
      });
      logEvent("invite_shared");
    } catch (e) {
      console.error("[JokerShop] Share error:", e);
    }
  }, [profile?.referral_code, t]);

  // Purchase confirmation from StoreKit is instant and reliable; the server-side
  // grant (RevenueCat webhook -> grant_iap_jokers) is async and can lag by anywhere
  // from seconds to ~a minute+ (mostly in sandbox), fully outside our control. So we
  // bump the balance optimistically right away and only use this background poll to
  // quietly reconcile with the authoritative value — never to gate the success UI,
  // and never to show an error. If it never confirms within the window, we just stop
  // silently: the optimistic number already matches what the user expects, and the
  // next natural refetch (e.g. reopening the shop) will pick up the true value.
  const reconcileBalanceAfterPurchase = useCallback(
    async (targetBalance: number) => {
      const delaysMs = [2000, 4000, 8000, 15000, 30000, 30000, 30000];
      for (const delay of delaysMs) {
        await sleep(delay);
        const updated = await refetchProfile();
        if ((updated?.joker_balance ?? 0) >= targetBalance) return;
      }
    },
    [refetchProfile]
  );

  const handleBuyPack = useCallback(
    async (productId: JokerProductId) => {
      if (purchasingProductId) return;
      setPurchaseMessage(null);
      setPurchasingProductId(productId);
      try {
        const result = await purchaseJokerPack(productId);
        if (result === "purchased") {
          const count = JOKER_COUNT_BY_PRODUCT_ID[productId];
          bumpJokerBalance(count);
          setPurchaseSuccess({ count });
          reconcileBalanceAfterPurchase(jokerBalance + count);
        } else if (result === "cancelled") {
          setPurchaseMessage(t("joker_menu_buy_cancelled"));
        } else {
          setPurchaseMessage(t("joker_menu_buy_error"));
        }
      } finally {
        setPurchasingProductId(null);
      }
    },
    [purchasingProductId, purchaseJokerPack, jokerBalance, bumpJokerBalance, reconcileBalanceAfterPurchase, t]
  );

  return (
    <BottomSheetShell visible={visible} onClose={onClose} draggable={!purchasingProductId}>
      {() => (
        <View style={styles.container}>
          <View style={styles.topbar}>
            <LinearGradient
              colors={["#FFD84D", "#F5B800"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.jokerPill}
            >
              <View style={styles.jokerPillIconCircle}>
                <MaterialCommunityIcons name="crown" size={15} color="#F5B800" />
              </View>
              <Text style={styles.jokerPillCount}>{jokerBalance}</Text>
              <Text style={styles.jokerPillLabel}>
                {t(jokerBalance === 1 ? "joker_shop_jokers_label_one" : "joker_shop_jokers_label")}
              </Text>
            </LinearGradient>
          </View>

          {purchaseSuccess ? (
            <View style={styles.successWrap}>
              <Animated.View style={{ transform: [{ scale: successIconScale }] }}>
                <View style={styles.successIconRing}>
                  <LinearGradient
                    colors={["#FDE68A", "#FBBF24"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.successIconCircle}
                  >
                    <Feather name="check" size={30} color="#FFFFFF" strokeWidth={3} />
                  </LinearGradient>
                </View>
              </Animated.View>
              <Text style={styles.successTitle}>{t("joker_menu_buy_success")}</Text>
              <Text style={styles.successSubtitle}>
                {t("joker_shop_purchase_added", { count: purchaseSuccess.count })}
              </Text>
              <Pressable
                style={({ pressed }) => [styles.successCta, pressed && { opacity: 0.88 }]}
                onPress={() => setPurchaseSuccess(null)}
              >
                <Text style={styles.successCtaText}>{t("common_ok")}</Text>
              </Pressable>
            </View>
          ) : (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {!!profile?.referral_code && (
              <View style={styles.referCard}>
                <View style={styles.referTop}>
                  <View style={styles.referIcon}>
                    <Feather name="user-plus" size={16} color={JOKER.TEXT} strokeWidth={2.5} />
                  </View>
                  <Text style={styles.referTitle}>{t("joker_shop_refer_title")}</Text>
                </View>
                <Pressable onPress={handleInvite} style={({ pressed }) => [styles.referBtn, pressed && { opacity: 0.88 }]}>
                  <Text style={styles.referBtnText}>{t("joker_shop_refer_cta")}</Text>
                </Pressable>
              </View>
            )}

            {nextMilestone != null && (
              <View style={styles.streakCard}>
                <View style={styles.streakTop}>
                  <View style={styles.streakIcon}>
                    <Feather name="zap" size={15} color={JOKER.TEXT} />
                  </View>
                  <Text style={styles.streakCur}>
                    {realStreak} {t(realStreak === 1 ? "calendar_stats_day_streak_one" : "calendar_stats_day_streak")}
                  </Text>
                </View>
                <Text style={styles.streakNext}>
                  {t(daysLeft === 1 ? "joker_shop_streak_days_left_one" : "joker_shop_streak_days_left", { count: daysLeft })}
                </Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
                </View>
              </View>
            )}

            {PURCHASES_SUPPORTED && (
              <View style={styles.buySection}>
                <Text style={styles.sectionTitle}>{t("joker_shop_buy_title")}</Text>
                <View style={styles.packRows}>
                  {(Object.values(JOKER_PRODUCT_IDS) as JokerProductId[]).map((productId) => {
                    const product = products.find((p) => p.identifier === productId);
                    const isPurchasing = purchasingProductId === productId;
                    const isBestValue = productId === JOKER_PRODUCT_IDS.jokers_10;
                    const disabled = !!purchasingProductId || !product;
                    return (
                      <Pressable
                        key={productId}
                        style={({ pressed }) => [
                          styles.packRow,
                          disabled && styles.packRowDisabled,
                          !disabled && pressed && { opacity: 0.85 },
                        ]}
                        onPress={() => handleBuyPack(productId)}
                        disabled={disabled}
                      >
                        <View style={styles.packIconWrap}>
                          <MaterialCommunityIcons name="crown" size={16} color={JOKER.TEXT} />
                        </View>
                        <View style={styles.packLabelWrap}>
                          <Text style={styles.packLabel}>
                            {t("joker_menu_buy_pack_label", { count: JOKER_COUNT_BY_PRODUCT_ID[productId] })}
                          </Text>
                          {isBestValue && (
                            <View style={styles.bestValueBadge}>
                              <Text style={styles.bestValueText}>{t("joker_shop_best_value")}</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.packPriceWrap}>
                          {isPurchasing ? (
                            <ActivityIndicator size="small" color={JOKER.TEXT} />
                          ) : product ? (
                            <Text style={styles.packPrice}>{product.priceString}</Text>
                          ) : productsLoading ? (
                            <ActivityIndicator size="small" color={COLORS.TEXT_MUTED} />
                          ) : (
                            <Text style={styles.packUnavailable}>{t("joker_shop_pack_unavailable")}</Text>
                          )}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
                {purchaseMessage ? <Text style={styles.purchaseMessage}>{purchaseMessage}</Text> : null}
              </View>
            )}
          </ScrollView>
          )}
        </View>
      )}
    </BottomSheetShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  topbar: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 56,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
    flexGrow: 1,
    justifyContent: "center",
  },
  jokerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: "rgba(245,184,0,0.4)",
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 3,
  },
  jokerPillIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  jokerPillCount: {
    fontSize: 17,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  jokerPillLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.9)",
  },
  referCard: {
    backgroundColor: "rgba(255,255,255,0.6)",
    borderWidth: 1,
    borderColor: "rgba(212,168,48,0.28)",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#C08C14",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 3,
  },
  referTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  referIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(240,192,64,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  referTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
    lineHeight: 21,
  },
  referBtn: {
    width: "100%",
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: COLORS.ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  referBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  streakCard: {
    backgroundColor: "rgba(255,255,255,0.6)",
    borderWidth: 1,
    borderColor: "rgba(212,168,48,0.28)",
    borderRadius: 20,
    padding: 20,
    marginBottom: 28,
    shadowColor: "#C08C14",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 3,
  },
  streakTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  streakIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(240,192,64,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  streakCur: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
  },
  streakNext: {
    fontSize: 14,
    fontWeight: "700",
    color: JOKER.TEXT,
    marginBottom: 12,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.65)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: JOKER.GOLD,
  },
  buySection: {
    gap: 14,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.TEXT_MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    textAlign: "center",
    marginBottom: 4,
  },
  packRows: {
    gap: 8,
  },
  packRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: "rgba(240,192,64,0.08)",
    borderWidth: 1,
    borderColor: "rgba(240,192,64,0.25)",
  },
  packRowDisabled: {
    opacity: 0.5,
  },
  packIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(240,192,64,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  packLabelWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  packLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
  },
  bestValueBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: JOKER.GOLD,
  },
  bestValueText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  packPriceWrap: {
    minWidth: 64,
    alignItems: "flex-end",
  },
  packPrice: {
    fontSize: 15,
    fontWeight: "700",
    color: JOKER.TEXT,
  },
  packUnavailable: {
    fontSize: 12,
    color: COLORS.TEXT_MUTED,
  },
  purchaseMessage: {
    marginTop: 4,
    fontSize: 14,
    textAlign: "center",
    color: COLORS.TEXT_SECONDARY,
  },
  successWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 56,
  },
  successIconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: JOKER.GOLD_RING,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(240,192,64,0.5)",
    shadowColor: "#B45309",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
    textAlign: "center",
    marginBottom: 10,
  },
  successSubtitle: {
    fontSize: 15,
    color: COLORS.TEXT_SECONDARY,
    textAlign: "center",
    marginBottom: 28,
  },
  successCta: {
    minWidth: 140,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 9999,
    backgroundColor: JOKER.GOLD,
    alignItems: "center",
    justifyContent: "center",
  },
  successCtaText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
