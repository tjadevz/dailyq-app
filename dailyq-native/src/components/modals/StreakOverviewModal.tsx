import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle } from "react-native-svg";

import { COLORS, JOKER, MODAL, MODAL_CLOSE_MS, MODAL_ENTER_MS } from "@/src/config/constants";
import { useLanguage } from "@/src/context/LanguageContext";
import { useAuth } from "@/src/context/AuthContext";
import { supabase } from "@/src/config/supabase";
import {
  STREAK_MILESTONES,
  JOKER_COUNT_BY_MILESTONE,
  getAlreadyGranted,
} from "@/src/context/StreakMilestoneContext";

type StreakOverviewModalProps = {
  visible: boolean;
  currentStreak: number;
  onClose: () => void;
};

const STREAK_HERO_RING_RADIUS = 20;
const STREAK_HERO_RING_CIRCUMFERENCE = 2 * Math.PI * STREAK_HERO_RING_RADIUS;

export default function StreakOverviewModal({
  visible,
  currentStreak,
  onClose,
}: StreakOverviewModalProps) {
  // Fabric doesn't reliably size flex:1/absoluteFillObject (right/bottom-based)
  // content inside <Modal> — needs explicit numeric width/height.
  const { width, height } = useWindowDimensions();
  const { t } = useLanguage();
  const { effectiveUser } = useAuth();
  const userId = effectiveUser?.id ?? null;

  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const [grantedMilestones, setGrantedMilestones] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!visible || !userId || userId === "dev-user") return;
    getAlreadyGranted(supabase, userId).then(setGrantedMilestones);
  }, [visible, userId]);

  useEffect(() => {
    if (visible) {
      opacity.setValue(0);
      scale.setValue(0.9);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: MODAL_ENTER_MS,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          damping: 14,
          stiffness: 180,
        }),
      ]).start();
    }
  }, [visible, opacity, scale]);

  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: MODAL_CLOSE_MS,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.9,
        duration: MODAL_CLOSE_MS,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  }, [opacity, scale, onClose]);

  const nextMilestone = useMemo(
    () => STREAK_MILESTONES.find((m) => m > currentStreak && !grantedMilestones.has(m)) ?? null,
    [currentStreak, grantedMilestones]
  );
  const daysLeft = nextMilestone != null ? nextMilestone - currentStreak : 0;
  const progressPercent =
    nextMilestone != null ? Math.min(100, (currentStreak / nextMilestone) * 100) : 100;
  const heroRingDashoffset = STREAK_HERO_RING_CIRCUMFERENCE * (1 - progressPercent / 100);

  /** Reached milestones (always shown) + up to the next 3 upcoming ones —
   * no point showing the 365-day reward while still on a 7-day streak. */
  const visibleMilestones = useMemo(() => {
    const reached: number[] = [];
    const upcoming: number[] = [];
    for (const m of STREAK_MILESTONES) {
      if (grantedMilestones.has(m) || currentStreak >= m) {
        reached.push(m);
      } else {
        upcoming.push(m);
      }
    }
    return [...reached, ...upcoming.slice(0, 3)];
  }, [currentStreak, grantedMilestones]);

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.backdrop, { width, height, opacity }]}>
        <BlurView
          intensity={40}
          tint="dark"
          style={{ position: "absolute", top: 0, left: 0, width, height }}
        />
        <View
          style={[styles.backdropOverlay, { width, height }]}
          pointerEvents="none"
        />
        <Pressable
          style={{ position: "absolute", top: 0, left: 0, width, height }}
          onPress={dismiss}
        />
        <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
          <Pressable style={MODAL.CLOSE_BUTTON} onPress={dismiss} hitSlop={12}>
            <Feather name="x" size={18} color={COLORS.TEXT_SECONDARY} strokeWidth={2.5} />
          </Pressable>

          <Text style={styles.eyebrow}>{t("streak_overview_title")}</Text>

          <View style={styles.heroRow}>
            <View style={styles.heroRingWrap}>
              <Svg width={48} height={48} style={styles.heroRingSvg}>
                <Circle cx={24} cy={24} r={STREAK_HERO_RING_RADIUS} stroke="rgba(239,68,68,0.15)" strokeWidth={4} fill="none" />
                <Circle
                  cx={24}
                  cy={24}
                  r={STREAK_HERO_RING_RADIUS}
                  stroke="#EF4444"
                  strokeWidth={4}
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={STREAK_HERO_RING_CIRCUMFERENCE}
                  strokeDashoffset={heroRingDashoffset}
                />
              </Svg>
              <MaterialCommunityIcons name="fire" size={22} color="#EF4444" />
            </View>
            <Text style={styles.heroNum}>{currentStreak}</Text>
          </View>
          <Text style={styles.heroLabel}>
            {t(
              currentStreak === 1 ? "calendar_stats_day_streak_one" : "calendar_stats_day_streak"
            )}
          </Text>

          {nextMilestone != null ? (
            <Text style={styles.nextText}>
              {t(
                daysLeft === 1 ? "joker_shop_streak_days_left_one" : "joker_shop_streak_days_left",
                { count: daysLeft }
              )}
            </Text>
          ) : (
            <Text style={styles.nextText}>{t("streak_overview_all_done")}</Text>
          )}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFillWrap, { width: `${progressPercent}%` }]}>
              <LinearGradient
                colors={["#FDE68A", "#FACC15"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.progressFill}
              />
            </View>
          </View>

          <Text style={styles.sectionTitle}>{t("streak_overview_milestones_title")}</Text>
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {visibleMilestones.map((milestone) => {
              const reached = grantedMilestones.has(milestone) || currentStreak >= milestone;
              const isNext = milestone === nextMilestone;
              return (
                <View key={milestone} style={[styles.row, isNext && styles.rowNext]}>
                  <View style={styles.rowLeft}>
                    {reached ? (
                      <Feather name="check-circle" size={17} color={COLORS.ACCENT} />
                    ) : (
                      <View style={styles.rowDot} />
                    )}
                    <Text style={[styles.rowDays, reached && styles.rowDaysReached]}>
                      {milestone} {t("calendar_stats_day_streak")}
                    </Text>
                  </View>
                  <View style={styles.rowRewardWrap}>
                    <Text style={styles.rowReward}>+{JOKER_COUNT_BY_MILESTONE[milestone]}</Text>
                    <MaterialCommunityIcons name="crown" size={15} color="#D4AF37" />
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...MODAL.WRAPPER,
    right: undefined,
    bottom: undefined,
    justifyContent: "center",
    alignItems: "center",
  },
  backdropOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    backgroundColor: "rgba(76, 29, 149, 0.25)",
  },
  card: {
    ...MODAL.CARD,
    width: "90%",
    maxWidth: 420,
    maxHeight: "80%",
    paddingTop: 32,
    paddingBottom: 28,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: COLORS.ACCENT,
    marginBottom: 20,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  heroRingWrap: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  heroRingSvg: {
    position: "absolute",
    top: 0,
    left: 0,
    transform: [{ rotate: "-90deg" }],
  },
  heroNum: {
    fontSize: 36,
    fontWeight: "800",
    color: COLORS.TEXT_PRIMARY,
  },
  heroLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 22,
  },
  nextText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.TEXT_SECONDARY,
    textAlign: "center",
    marginBottom: 10,
  },
  progressTrack: {
    alignSelf: "stretch",
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(139,92,246,0.12)",
    overflow: "hidden",
    marginBottom: 30,
  },
  progressFillWrap: {
    height: "100%",
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  sectionTitle: {
    alignSelf: "flex-start",
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.TEXT_MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  list: {
    alignSelf: "stretch",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  rowNext: {
    backgroundColor: "rgba(139,92,246,0.08)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.22)",
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowDot: {
    width: 17,
    height: 17,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: COLORS.TEXT_MUTED,
  },
  rowDays: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.TEXT_SECONDARY,
  },
  rowDaysReached: {
    color: COLORS.TEXT_PRIMARY,
  },
  rowRewardWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  rowReward: {
    fontSize: 15,
    fontWeight: "700",
    color: JOKER.TEXT,
  },
});
