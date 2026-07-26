import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Share, ScrollView, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";

import { COLORS, JOKER } from "@/src/config/constants";
import { JOKER_PRODUCT_IDS, JOKER_COUNT_BY_PRODUCT_ID, type JokerProductId } from "@/src/config/revenuecat";
import { GlassCardContainer } from "@/src/components/GlassCardContainer";
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
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { effectiveUser } = useAuth();
  const userId = effectiveUser?.id ?? null;
  const { profile, refetch: refetchProfile } = useProfileContext();
  const { products, productsLoading, purchaseJokerPack } = usePurchases();

  const jokerBalance = profile?.joker_balance ?? 0;

  const [purchasingProductId, setPurchasingProductId] = useState<string | null>(null);
  const [purchaseMessage, setPurchaseMessage] = useState<string | null>(null);

  const [realStreak, setRealStreak] = useState(0);
  const [grantedMilestones, setGrantedMilestones] = useState<Set<number>>(new Set());

  // Refresh streak/milestone data every time the sheet opens, not just on mount —
  // it stays mounted (hidden) between opens like any other modal in this app.
  useEffect(() => {
    if (!visible || !userId || userId === "dev-user") return;
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    supabase
      .rpc("get_user_streaks", { p_user_id: userId, p_timezone: userTimezone })
      .then(({ data }: { data: { real_streak?: number; visual_streak?: number }[] | null }) => {
        const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
        const r = row?.real_streak ?? 0;
        const v = row?.visual_streak ?? 0;
        setRealStreak(Math.max(Number(r), Number(v)));
      });
    getAlreadyGranted(supabase, userId).then(setGrantedMilestones);
  }, [visible, userId]);

  useEffect(() => {
    if (!visible) {
      setPurchaseMessage(null);
      setPurchasingProductId(null);
    }
  }, [visible]);

  const nextMilestone = STREAK_MILESTONES.find((m) => m > realStreak && !grantedMilestones.has(m)) ?? null;
  const daysLeft = nextMilestone != null ? nextMilestone - realStreak : 0;
  const progressPercent = nextMilestone != null ? Math.min(100, (realStreak / nextMilestone) * 100) : 0;

  const handleInvite = useCallback(async () => {
    if (!profile?.referral_code) return;
    const link = `https://dailyqapp.com/invite/${profile.referral_code}`;
    try {
      await Share.share({
        message: t("today_invite_share_message", { link }),
        url: link,
      });
      logEvent("invite_shared");
    } catch (e) {
      console.error("[JokerShop] Share error:", e);
    }
  }, [profile?.referral_code, t]);

  const handleBuyPack = useCallback(
    async (productId: JokerProductId) => {
      if (purchasingProductId) return;
      setPurchaseMessage(null);
      setPurchasingProductId(productId);
      try {
        const result = await purchaseJokerPack(productId);
        if (result === "purchased") {
          setPurchaseMessage(t("joker_menu_buy_success"));
          const baseline = jokerBalance;
          for (let i = 0; i < 5; i++) {
            await sleep(1500);
            const updated = await refetchProfile();
            if ((updated?.joker_balance ?? baseline) > baseline) break;
          }
        } else if (result === "cancelled") {
          setPurchaseMessage(t("joker_menu_buy_cancelled"));
        } else {
          setPurchaseMessage(t("joker_menu_buy_error"));
        }
      } finally {
        setPurchasingProductId(null);
      }
    },
    [purchasingProductId, purchaseJokerPack, jokerBalance, refetchProfile, t]
  );

  return (
    <Modal
      visible={visible}
      presentationStyle="fullScreen"
      animationType="slide"
      onRequestClose={onClose}
    >
      <GlassCardContainer>
        <View style={[styles.container, { paddingTop: insets.top }]}>
          <View style={styles.topbar}>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={16} color={COLORS.TEXT_SECONDARY} strokeWidth={2.5} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.hero}>
              <LinearGradient colors={["#FDE68A", "#FBBF24"]} style={styles.crownBadge}>
                <MaterialCommunityIcons name="crown" size={24} color="#FFFFFF" />
              </LinearGradient>
              <Text style={styles.heroNum}>
                {jokerBalance} <Text style={styles.heroNumLabel}>{t("joker_shop_jokers_label")}</Text>
              </Text>
            </View>

            {!!profile?.referral_code && (
              <View style={styles.referCard}>
                <View style={styles.referTop}>
                  <View style={styles.referIcon}>
                    <Feather name="user-plus" size={16} color="#FFFFFF" strokeWidth={2.5} />
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
                    <Feather name="zap" size={13} color={COLORS.ACCENT} />
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
                          isBestValue && styles.packRowBest,
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
        </View>
      </GlassCardContainer>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.05)",
    alignItems: "center",
    justifyContent: "center",
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
  hero: {
    alignItems: "center",
    marginBottom: 32,
  },
  crownBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.4)",
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 4,
  },
  heroNum: {
    fontSize: 30,
    fontWeight: "800",
    fontFamily: "Inter",
    color: COLORS.TEXT_PRIMARY,
  },
  heroNumLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.TEXT_SECONDARY,
  },
  referCard: {
    backgroundColor: "rgba(139,92,246,0.1)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.22)",
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
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
    backgroundColor: COLORS.ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  referTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Inter",
    color: COLORS.TEXT_PRIMARY,
    lineHeight: 18,
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
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Inter",
    color: "#FFFFFF",
  },
  streakCard: {
    backgroundColor: "rgba(253,230,138,0.35)",
    borderWidth: 1,
    borderColor: "rgba(212,168,48,0.3)",
    borderRadius: 20,
    padding: 16,
    marginBottom: 32,
  },
  streakTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  streakIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(139,92,246,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  streakCur: {
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Inter",
    color: COLORS.TEXT_PRIMARY,
  },
  streakNext: {
    fontSize: 11.5,
    fontWeight: "700",
    fontFamily: "Inter",
    color: JOKER.TEXT,
    marginBottom: 8,
  },
  progressTrack: {
    height: 6,
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
    fontFamily: "Inter",
    color: COLORS.TEXT_MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  packRows: {
    gap: 12,
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
  packRowBest: {
    borderWidth: 1.5,
    borderColor: JOKER.GOLD,
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
    fontSize: 14.5,
    fontWeight: "700",
    fontFamily: "Inter",
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
    fontFamily: "Inter",
    color: "#FFFFFF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  packPriceWrap: {
    minWidth: 64,
    alignItems: "flex-end",
  },
  packPrice: {
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "Inter",
    color: JOKER.TEXT,
  },
  packUnavailable: {
    fontSize: 11,
    fontFamily: "Inter",
    color: COLORS.TEXT_MUTED,
  },
  purchaseMessage: {
    marginTop: 4,
    fontSize: 13,
    fontFamily: "Inter",
    textAlign: "center",
    color: COLORS.TEXT_SECONDARY,
  },
});
