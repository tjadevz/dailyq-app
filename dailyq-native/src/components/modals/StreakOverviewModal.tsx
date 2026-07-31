import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, JOKER } from "@/src/config/constants";
import { useLanguage } from "@/src/context/LanguageContext";
import { useAuth } from "@/src/context/AuthContext";
import { supabase } from "@/src/config/supabase";
import {
  STREAK_MILESTONES,
  JOKER_COUNT_BY_MILESTONE,
  getAlreadyGranted,
} from "@/src/context/StreakMilestoneContext";
import BottomSheetShell from "@/src/components/modals/BottomSheetShell";

type StreakOverviewModalProps = {
  visible: boolean;
  currentStreak: number;
  onClose: () => void;
};

const STREAK_HERO_RING_RADIUS = 54;
const STREAK_HERO_RING_CIRCUMFERENCE = 2 * Math.PI * STREAK_HERO_RING_RADIUS;

export default function StreakOverviewModal({
  visible,
  currentStreak,
  onClose,
}: StreakOverviewModalProps) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { effectiveUser } = useAuth();
  const userId = effectiveUser?.id ?? null;

  const [grantedMilestones, setGrantedMilestones] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!visible || !userId || userId === "dev-user") return;
    getAlreadyGranted(supabase, userId).then(setGrantedMilestones);
  }, [visible, userId]);

  const nextMilestone = useMemo(
    () => STREAK_MILESTONES.find((m) => m > currentStreak && !grantedMilestones.has(m)) ?? null,
    [currentStreak, grantedMilestones]
  );
  const daysLeft = nextMilestone != null ? nextMilestone - currentStreak : 0;
  const progressPercent =
    nextMilestone != null ? Math.min(100, (currentStreak / nextMilestone) * 100) : 100;
  const heroRingDashoffset = STREAK_HERO_RING_CIRCUMFERENCE * (1 - progressPercent / 100);

  /** All achieved milestones, plus only the single next upcoming one. */
  const visibleMilestones = useMemo(() => {
    const reached = STREAK_MILESTONES.filter((m) => grantedMilestones.has(m) || currentStreak >= m);
    const result = [...reached];
    if (nextMilestone != null) result.push(nextMilestone);
    return result;
  }, [currentStreak, grantedMilestones, nextMilestone]);

  return (
    <BottomSheetShell visible={visible} onClose={onClose}>
      {() => (
        <View style={styles.container}>
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32, paddingTop: 36 }]}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.eyebrow}>{t("streak_overview_title")}</Text>

            <View style={styles.heroRingWrap}>
              <Svg width={124} height={124} style={styles.heroRingSvg}>
                <Circle cx={62} cy={62} r={STREAK_HERO_RING_RADIUS} stroke="rgba(239,68,68,0.15)" strokeWidth={8} fill="none" />
                <Circle
                  cx={62}
                  cy={62}
                  r={STREAK_HERO_RING_RADIUS}
                  stroke="#EF4444"
                  strokeWidth={8}
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={STREAK_HERO_RING_CIRCUMFERENCE}
                  strokeDashoffset={heroRingDashoffset}
                />
              </Svg>
              <Text style={styles.heroNum}>{currentStreak}</Text>
            </View>
            <Text style={styles.heroLabel}>
              {t(
                currentStreak === 1 ? "calendar_stats_day_streak_one" : "calendar_stats_day_streak"
              )}
            </Text>

            <View style={styles.progressCard}>
              <Text style={styles.progressCardText}>
                {nextMilestone != null
                  ? t(
                      daysLeft === 1 ? "joker_shop_streak_days_left_one" : "joker_shop_streak_days_left",
                      { count: daysLeft }
                    )
                  : t("streak_overview_all_done")}
              </Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFillWrap, { width: `${progressPercent}%` }]}>
                  <LinearGradient
                    colors={["#F0C040", "#FBDD86"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.progressFill}
                  />
                </View>
              </View>
            </View>

            {visibleMilestones.length > 0 && (
              <View style={styles.milestonesSection}>
                <Text style={styles.sectionTitle}>{t("streak_overview_milestones_title")}</Text>
                {visibleMilestones.map((milestone) => {
                  const reached = grantedMilestones.has(milestone) || currentStreak >= milestone;
                  return (
                    <View key={milestone} style={styles.row}>
                      <View style={styles.rowLeft}>
                        {reached ? (
                          <Feather name="check-circle" size={17} color="#EF4444" />
                        ) : (
                          <View style={styles.rowDot} />
                        )}
                        <Text style={[styles.rowDays, reached && styles.rowDaysReached]}>
                          {milestone} {t("calendar_stats_day_streak")}
                        </Text>
                      </View>
                      <View style={styles.rowRewardWrap}>
                        <Text style={styles.rowReward}>+{JOKER_COUNT_BY_MILESTONE[milestone]}</Text>
                        <View style={styles.rowJokerChip}>
                          <MaterialCommunityIcons name="crown" size={12} color="#FFFFFF" />
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
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
    paddingHorizontal: 20,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
    flexGrow: 1,
    justifyContent: "flex-start",
    alignItems: "center",
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#EF4444",
    marginBottom: 24,
  },
  heroRingWrap: {
    width: 124,
    height: 124,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
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
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.TEXT_SECONDARY,
    marginTop: 12,
    marginBottom: 26,
  },
  progressCard: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.6)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.18)",
    borderRadius: 20,
    padding: 20,
    marginBottom: 28,
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.09,
    shadowRadius: 24,
    elevation: 3,
  },
  progressCardText: {
    fontSize: 14,
    fontWeight: "700",
    color: JOKER.TEXT,
    textAlign: "center",
    marginBottom: 12,
  },
  progressTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: "rgba(239,68,68,0.15)",
    overflow: "hidden",
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
  milestonesSection: {
    width: "100%",
    gap: 8,
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.5)",
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
    gap: 6,
  },
  rowReward: {
    fontSize: 15,
    fontWeight: "700",
    color: JOKER.TEXT,
  },
  rowJokerChip: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FFC700",
    alignItems: "center",
    justifyContent: "center",
  },
});
