import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Share, ScrollView, Animated } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";

import { JOKER } from "@/src/config/constants";
import { ADS_SUPPORTED } from "@/src/config/admob";
import { watchAdForJoker } from "@/src/services/rewardedAd";
import {
  JOKER_PRODUCT_IDS,
  JOKER_COUNT_BY_PRODUCT_ID,
  type JokerProductId,
} from "@/src/config/revenuecat";
import BottomSheetShell from "@/src/components/modals/BottomSheetShell";
import { useLanguage } from "@/src/context/LanguageContext";
import { useAuth } from "@/src/context/AuthContext";
import { useProfileContext } from "@/src/context/ProfileContext";
import { PURCHASES_SUPPORTED, usePurchases } from "@/src/context/PurchasesContext";
import { STREAK_MILESTONES, JOKER_COUNT_BY_MILESTONE, getAlreadyGranted } from "@/src/context/StreakMilestoneContext";
import { supabase } from "@/src/config/supabase";
import { logEvent } from "@/lib/analytics";
import type { PurchasesStoreProduct } from "react-native-purchases";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const SHEET_BG = "#201a3a";
const TILE_BG = "#292153";
const INVITE_BG = "#7c5cff";
const AD_TILE_BG = "#3aa876";
const GOLD_TILE_BG = "#f0c766";
const GOLD_TEXT_ON_TILE = "#201a3a";

type JokerShopModalProps = {
  visible: boolean;
  onClose: () => void;
};

// Renders the icon/label/price stack shared by the three IAP pack tiles —
// only their colors and product id differ, so this is factored out rather
// than repeated three times with copy-pasted price/loading/unavailable states.
function PackTileContent({
  count,
  product,
  isPurchasing,
  productsLoading,
  textColor,
  mutedColor,
  boldPrice,
  unavailableLabel,
}: {
  count: number;
  product: PurchasesStoreProduct | undefined;
  isPurchasing: boolean;
  productsLoading: boolean;
  textColor: string;
  mutedColor: string;
  boldPrice?: boolean;
  unavailableLabel: string;
}) {
  return (
    <>
      <MaterialCommunityIcons name="crown" size={18} color={textColor} />
      <Text style={[styles.actionTileLabel, { color: textColor }]}>×{count}</Text>
      {isPurchasing ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : product ? (
        <Text style={[styles.actionTileSublabel, { color: mutedColor }, boldPrice && styles.actionTileSublabelBold]}>
          {product.priceString}
        </Text>
      ) : productsLoading ? (
        <ActivityIndicator size="small" color={mutedColor} />
      ) : (
        <Text style={[styles.actionTileSublabel, { color: mutedColor }]}>{unavailableLabel}</Text>
      )}
    </>
  );
}

export function JokerShopModal({ visible, onClose }: JokerShopModalProps) {
  const { t } = useLanguage();
  const { effectiveUser } = useAuth();
  const userId = effectiveUser?.id ?? null;
  const { profile, refetch: refetchProfile, bumpJokerBalance } = useProfileContext();
  const { products, productsLoading, purchaseJokerPack } = usePurchases();

  const jokerBalance = profile?.joker_balance ?? 0;

  const [purchasingProductId, setPurchasingProductId] = useState<string | null>(null);
  const [isWatchingAd, setIsWatchingAd] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState<{ count: number; titleKey: string } | null>(null);
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
      setFeedbackMessage(null);
      setPurchasingProductId(null);
      setIsWatchingAd(false);
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
  const nextMilestoneJokers = nextMilestone != null ? JOKER_COUNT_BY_MILESTONE[nextMilestone] : 0;

  const handleInvite = useCallback(async () => {
    if (!profile?.referral_code) return;
    const link = `https://dailyqapp.com/invite/${profile.referral_code}`;
    const message = t("today_invite_share_message", { link });
    try {
      // Some share targets (e.g. WhatsApp's iOS compose screen) drop the message text and
      // keep only the detected link, outside our control. Copy the full text to the clipboard
      // first so it's always recoverable with a paste, regardless of what the target app does.
      await Clipboard.setStringAsync(message);
      await Share.share({ message });
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
      setFeedbackMessage(null);
      setPurchasingProductId(productId);
      try {
        const result = await purchaseJokerPack(productId);
        if (result === "purchased") {
          const count = JOKER_COUNT_BY_PRODUCT_ID[productId];
          bumpJokerBalance(count);
          setPurchaseSuccess({ count, titleKey: "joker_menu_buy_success" });
          reconcileBalanceAfterPurchase(jokerBalance + count);
        } else if (result === "cancelled") {
          setFeedbackMessage(t("joker_menu_buy_cancelled"));
        } else {
          setFeedbackMessage(t("joker_menu_buy_error"));
        }
      } finally {
        setPurchasingProductId(null);
      }
    },
    [purchasingProductId, purchaseJokerPack, jokerBalance, bumpJokerBalance, reconcileBalanceAfterPurchase, t]
  );

  // The actual joker grant is server-side only (AdMob SSV -> grant_ad_reward_jokers),
  // same async-lag characteristics as an IAP purchase, so this mirrors handleBuyPack:
  // optimistic bump + background reconciliation, never gating the success UI on it.
  const handleWatchAd = useCallback(async () => {
    if (!userId || userId === "dev-user" || isWatchingAd || purchasingProductId) return;
    setFeedbackMessage(null);
    setIsWatchingAd(true);
    try {
      const outcome = await watchAdForJoker(userId);
      if (outcome === "earned") {
        bumpJokerBalance(1);
        setPurchaseSuccess({ count: 1, titleKey: "joker_shop_watch_ad_success_title" });
        reconcileBalanceAfterPurchase(jokerBalance + 1);
        logEvent("ad_reward_earned");
      } else if (outcome === "cancelled") {
        setFeedbackMessage(t("joker_shop_watch_ad_cancelled"));
      } else if (outcome === "consent_denied") {
        setFeedbackMessage(t("joker_shop_watch_ad_consent_denied"));
      } else {
        setFeedbackMessage(t("joker_shop_watch_ad_error"));
      }
    } finally {
      setIsWatchingAd(false);
    }
  }, [userId, isWatchingAd, purchasingProductId, bumpJokerBalance, jokerBalance, reconcileBalanceAfterPurchase, t]);

  return (
    <BottomSheetShell
      visible={visible}
      onClose={onClose}
      draggable={!purchasingProductId && !isWatchingAd}
      backgroundColor={SHEET_BG}
      handleColor="rgba(255,255,255,0.2)"
      handleSize={{ width: 36, height: 4 }}
    >
      {() => (
        <View style={styles.container}>
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
              <Text style={styles.successTitle}>{t(purchaseSuccess.titleKey)}</Text>
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
              {/* Hero: joker balance status */}
              <LinearGradient
                colors={["#2c2452", "#211b40"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.hero}
              >
                <LinearGradient
                  colors={["#ffd875", "#e8a534"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.heroIconTile}
                >
                  <MaterialCommunityIcons name="crown" size={26} color="#FFFFFF" />
                </LinearGradient>
                <View style={styles.heroTextCol}>
                  <Text style={styles.heroKicker}>{t("joker_shop_hero_kicker")}</Text>
                  <Text style={styles.heroCount}>
                    {t(jokerBalance === 1 ? "joker_shop_hero_count_one" : "joker_shop_hero_count", {
                      count: jokerBalance,
                    })}
                  </Text>
                </View>
              </LinearGradient>

              {/* Streak + progress-to-next-joker, the two numbers meant to stand out most */}
              <View style={styles.statsGrid}>
                <View style={styles.statTile}>
                  <Text style={styles.statNumber}>{realStreak}🔥</Text>
                  <Text style={styles.statLabel}>{t("joker_shop_streak_tile_label")}</Text>
                </View>
                {nextMilestone != null && (
                  <View style={styles.statTile}>
                    <Text style={[styles.statNumber, styles.statNumberAccent]}>{daysLeft}</Text>
                    <Text style={styles.statLabel}>
                      {t(daysLeft === 1 ? "joker_shop_next_tile_label_one" : "joker_shop_next_tile_label", {
                        count: daysLeft,
                        jokers: nextMilestoneJokers,
                      })}
                    </Text>
                  </View>
                )}
              </View>

              <Text style={styles.sectionLabel}>{t("joker_shop_earn_or_buy_title")}</Text>

              {!!profile?.referral_code && (
                <View style={styles.inviteBar}>
                  <Text style={styles.inviteTextBlock}>
                    <Text style={styles.inviteTitle}>{t("joker_shop_invite_title")}</Text>
                    {"\n"}
                    <Text style={styles.inviteSubtitle}>{t("joker_shop_invite_subtitle")}</Text>
                  </Text>
                  <Pressable
                    onPress={handleInvite}
                    style={({ pressed }) => [styles.inviteBtn, pressed && { opacity: 0.88 }]}
                  >
                    <Text style={styles.inviteBtnText}>{t("joker_shop_refer_cta")}</Text>
                  </Pressable>
                </View>
              )}

              <View style={styles.actionGrid}>
                {ADS_SUPPORTED && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.actionTile,
                      styles.adTile,
                      (isWatchingAd || !!purchasingProductId) && styles.actionTileDisabled,
                      !isWatchingAd && !purchasingProductId && pressed && { opacity: 0.88 },
                    ]}
                    onPress={handleWatchAd}
                    disabled={isWatchingAd || !!purchasingProductId}
                  >
                    <Feather name="play" size={18} color="#FFFFFF" />
                    <Text style={[styles.actionTileLabel, { color: "#FFFFFF" }]}>
                      {t("joker_shop_watch_ad_tile_label")}
                    </Text>
                    {isWatchingAd ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={[styles.actionTileSublabel, { color: "rgba(255,255,255,0.75)" }]}>
                        {t("joker_shop_watch_ad_tile_sublabel")}
                      </Text>
                    )}
                  </Pressable>
                )}

                {PURCHASES_SUPPORTED &&
                  (Object.values(JOKER_PRODUCT_IDS) as JokerProductId[]).map((productId) => {
                    const product = products.find((p) => p.identifier === productId);
                    const isPurchasing = purchasingProductId === productId;
                    const isBestValue = productId === JOKER_PRODUCT_IDS.jokers_10;
                    const disabled = !!purchasingProductId || !product;
                    return (
                      <Pressable
                        key={productId}
                        style={({ pressed }) => [
                          styles.actionTile,
                          isBestValue ? styles.goldTile : styles.packTile,
                          disabled && styles.actionTileDisabled,
                          !disabled && pressed && { opacity: 0.88 },
                        ]}
                        onPress={() => handleBuyPack(productId)}
                        disabled={disabled}
                      >
                        <PackTileContent
                          count={JOKER_COUNT_BY_PRODUCT_ID[productId]}
                          product={product}
                          isPurchasing={isPurchasing}
                          productsLoading={productsLoading}
                          textColor={isBestValue ? GOLD_TEXT_ON_TILE : "#FFFFFF"}
                          mutedColor={isBestValue ? GOLD_TEXT_ON_TILE : "rgba(255,255,255,0.5)"}
                          boldPrice={isBestValue}
                          unavailableLabel={t("joker_shop_pack_unavailable")}
                        />
                      </Pressable>
                    );
                  })}
              </View>
              {feedbackMessage ? <Text style={styles.feedbackMessage}>{feedbackMessage}</Text> : null}
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
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 28,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 20,
    padding: 18,
    marginBottom: 24,
  },
  heroIconTile: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTextCol: {
    flex: 1,
  },
  heroKicker: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 3,
  },
  heroCount: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  statsGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  statTile: {
    flex: 1,
    height: 78,
    backgroundColor: TILE_BG,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  statNumberAccent: {
    color: "#f0c766",
  },
  statLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.55)",
    marginTop: 3,
    textAlign: "center",
  },
  inviteBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    backgroundColor: INVITE_BG,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 26,
  },
  inviteTextBlock: {
    flex: 1,
  },
  inviteTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  inviteSubtitle: {
    fontSize: 14,
    fontWeight: "400",
    color: "rgba(255,255,255,0.8)",
  },
  inviteBtn: {
    flexShrink: 0,
    backgroundColor: "#FFFFFF",
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  inviteBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: INVITE_BG,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: "rgba(255,255,255,0.5)",
    textTransform: "uppercase",
    marginBottom: 12,
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionTile: {
    width: "48%",
    height: 84,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  actionTileDisabled: {
    opacity: 0.5,
  },
  adTile: {
    backgroundColor: AD_TILE_BG,
  },
  packTile: {
    backgroundColor: TILE_BG,
  },
  goldTile: {
    backgroundColor: GOLD_TILE_BG,
  },
  actionTileLabel: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 5,
  },
  actionTileSublabel: {
    fontSize: 13,
    marginTop: 2,
  },
  actionTileSublabelBold: {
    fontWeight: "700",
  },
  feedbackMessage: {
    marginTop: 12,
    fontSize: 13,
    textAlign: "center",
    color: "rgba(255,255,255,0.6)",
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
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 10,
  },
  successSubtitle: {
    fontSize: 15,
    color: "rgba(255,255,255,0.6)",
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
