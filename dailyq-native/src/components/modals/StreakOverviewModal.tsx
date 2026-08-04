import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle } from "react-native-svg";

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

const SHEET_BG = "#201a3a";
const TILE_BG = "#292153";
const GOLD = "#f0c766";

const RING_SIZE = 52;
const RING_STROKE = 5;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export default function StreakOverviewModal({
  visible,
  currentStreak,
  onClose,
}: StreakOverviewModalProps) {
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
  const ringDashoffset = RING_CIRCUMFERENCE * (1 - progressPercent / 100);

  /** Only the milestones already reached, plus the single next upcoming one. */
  const visibleMilestones = useMemo(() => {
    const reached = STREAK_MILESTONES.filter((m) => grantedMilestones.has(m) || currentStreak >= m);
    const result = [...reached];
    if (nextMilestone != null) result.push(nextMilestone);
    return result;
  }, [currentStreak, grantedMilestones, nextMilestone]);

  return (
    <BottomSheetShell
      visible={visible}
      onClose={onClose}
      backgroundColor={SHEET_BG}
      handleColor="rgba(255,255,255,0.2)"
      handleSize={{ width: 36, height: 4 }}
    >
      {() => (
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Hero: streak count */}
            <LinearGradient
              colors={["#2c2452", "#211b40"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.hero}
            >
              <Text style={styles.heroKicker}>{t("streak_overview_title").toUpperCase()}</Text>
              <Text style={styles.heroCount}>{currentStreak}🔥</Text>
              <Text style={styles.heroSubtitle}>
                {t(currentStreak === 1 ? "calendar_stats_day_streak_one" : "calendar_stats_day_streak")}
              </Text>
            </LinearGradient>

            {/* Progress to next joker */}
            {nextMilestone != null && (
              <View style={styles.progressBar}>
                <View style={styles.progressRingWrap}>
                  <Svg width={RING_SIZE} height={RING_SIZE} style={styles.progressRingSvg}>
                    <Circle
                      cx={RING_SIZE / 2}
                      cy={RING_SIZE / 2}
                      r={RING_RADIUS}
                      stroke="rgba(255,255,255,0.15)"
                      strokeWidth={RING_STROKE}
                      fill="none"
                    />
                    <Circle
                      cx={RING_SIZE / 2}
                      cy={RING_SIZE / 2}
                      r={RING_RADIUS}
                      stroke={GOLD}
                      strokeWidth={RING_STROKE}
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={RING_CIRCUMFERENCE}
                      strokeDashoffset={ringDashoffset}
                    />
                  </Svg>
                  <View style={styles.progressRingCenter}>
                    <MaterialCommunityIcons name="crown" size={18} color={GOLD} />
                  </View>
                </View>
                <Text style={styles.progressBarText}>
                  {t(
                    daysLeft === 1 ? "joker_shop_streak_days_left_one" : "joker_shop_streak_days_left",
                    { count: daysLeft }
                  )}
                </Text>
              </View>
            )}

            <Text style={styles.sectionLabel}>{t("streak_overview_milestones_title")}</Text>

            <View style={styles.milestonesList}>
              {visibleMilestones.map((milestone) => {
                const reached = grantedMilestones.has(milestone) || currentStreak >= milestone;
                return (
                  <View key={milestone} style={styles.row}>
                    <View style={styles.rowLeft}>
                      {reached ? (
                        <View style={styles.rowDotFilled}>
                          <Feather name="check" size={13} color="#201a3a" strokeWidth={3} />
                        </View>
                      ) : (
                        <View style={styles.rowDot} />
                      )}
                      <Text style={styles.rowLabel}>
                        {milestone} {t("calendar_stats_day_streak")}
                      </Text>
                    </View>
                    <Text style={styles.rowReward}>
                      +{JOKER_COUNT_BY_MILESTONE[milestone]} 👑
                    </Text>
                  </View>
                );
              })}
            </View>
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
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 28,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },
  hero: {
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 24,
  },
  heroKicker: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: "#ff8a7a",
  },
  heroCount: {
    fontSize: 46,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  heroSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.55)",
  },
  progressBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: TILE_BG,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginBottom: 26,
  },
  progressRingWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  progressRingSvg: {
    position: "absolute",
    top: 0,
    left: 0,
    transform: [{ rotate: "-90deg" }],
  },
  progressRingCenter: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: TILE_BG,
    alignItems: "center",
    justifyContent: "center",
  },
  progressBarText: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: GOLD,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: "rgba(255,255,255,0.5)",
    textTransform: "uppercase",
    marginBottom: 18,
  },
  milestonesList: {
    gap: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: TILE_BG,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
  },
  rowDotFilled: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: {
    fontSize: 17,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  rowReward: {
    fontSize: 16,
    fontWeight: "700",
    color: GOLD,
  },
});
