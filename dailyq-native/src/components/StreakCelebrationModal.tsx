import React, { useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Animated,
  Dimensions,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

import { COLORS, JOKER, MODAL, MODAL_CLOSE_MS, MODAL_ENTER_MS } from "@/src/config/constants";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const STREAK_MILESTONE_TYPE = [7, 14, 30, 60, 100, 180, 365] as const;
export type StreakMilestone = (typeof STREAK_MILESTONE_TYPE)[number];

const JOKER_COUNT_BY_MILESTONE: Record<StreakMilestone, number> = {
  7: 1,
  14: 1,
  30: 2,
  60: 2,
  100: 3,
  180: 4,
  365: 5,
};

const GOLD_GRADIENT = ["#FEF3C7", "#FDE68A", "#FBBF24"] as const;

export function StreakCelebrationModal({
  visible,
  milestone,
  onClose,
  t,
}: {
  visible: boolean;
  milestone: StreakMilestone | null;
  onClose: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const opacity = React.useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(0)).current;
  const confettiAnims = useRef<Animated.Value[]>([]).current;
  const aurora1 = useRef(new Animated.Value(0.5)).current;
  const aurora2 = useRef(new Animated.Value(0.4)).current;
  const aurora3 = useRef(new Animated.Value(0.3)).current;
  const sparkle1 = useRef(new Animated.Value(0)).current;
  const sparkle2 = useRef(new Animated.Value(0)).current;
  const sparkle3 = useRef(new Animated.Value(0)).current;

  if (confettiAnims.length === 0) {
    for (let i = 0; i < 12; i++) confettiAnims.push(new Animated.Value(0));
  }

  const handleClose = useCallback(() => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: MODAL_CLOSE_MS,
      useNativeDriver: true,
    }).start(() => onClose());
  }, [opacity, onClose]);

  useEffect(() => {
    if (visible && milestone) {
      opacity.setValue(0);
      badgeScale.setValue(0);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: MODAL_ENTER_MS,
          useNativeDriver: true,
        }),
        Animated.spring(badgeScale, {
          toValue: 1,
          useNativeDriver: true,
          damping: 14,
          stiffness: 180,
        }),
      ]).start();
    }
  }, [visible, milestone, opacity, badgeScale]);

  useEffect(() => {
    if (!visible || !milestone) return;
    confettiAnims.forEach((v) => v.setValue(0));
    const duration = 1200;
    confettiAnims.forEach((anim) => {
      Animated.timing(anim, {
        toValue: 1,
        duration: duration + Math.random() * 300,
        useNativeDriver: true,
      }).start();
    });
  }, [visible, milestone, confettiAnims]);

  useEffect(() => {
    if (!visible) return;
    const pulse = (anim: Animated.Value, min: number, max: number, duration: number, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: max,
            duration,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: min,
            duration,
            useNativeDriver: true,
          }),
        ])
      );
    };
    const a1 = pulse(aurora1, 0.3, 0.75, 1750, 0);
    const a2 = pulse(aurora2, 0.25, 0.65, 2000, 500);
    const a3 = pulse(aurora3, 0.2, 0.6, 1850, 250);
    a1.start();
    a2.start();
    a3.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [visible, aurora1, aurora2, aurora3]);

  useEffect(() => {
    if (!visible || !milestone) return;
    const float = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      );
    const s1 = float(sparkle1, 0);
    const s2 = float(sparkle2, 400);
    const s3 = float(sparkle3, 800);
    s1.start();
    s2.start();
    s3.start();
    return () => {
      s1.stop();
      s2.stop();
      s3.stop();
    };
  }, [visible, milestone, sparkle1, sparkle2, sparkle3]);

  if (!visible || !milestone) return null;

  const jokerCount = JOKER_COUNT_BY_MILESTONE[milestone];
  const jokerRewardText =
    jokerCount === 1
      ? t("streak_popup_joker_earned_singular", { n: jokerCount })
      : t("streak_popup_joker_earned_plural", { n: jokerCount });
  const cta = t("streak_popup_cta");

  return (
    <Modal transparent visible animationType="none">
      <Animated.View style={[streakModalStyles.backdrop, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <BlurView intensity={20} tint="dark" style={streakModalStyles.blurLayer} />
        <View style={streakModalStyles.auroraWrap} pointerEvents="none">
          <Animated.View style={[streakModalStyles.auroraOrb, streakModalStyles.aurora1, { opacity: aurora1 }]}>
            <LinearGradient
              colors={["transparent", "rgba(245,158,11,0.4)", "rgba(253,230,138,0.25)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={streakModalStyles.auroraGradient}
            />
          </Animated.View>
          <Animated.View style={[streakModalStyles.auroraOrb, streakModalStyles.aurora2, { opacity: aurora2 }]}>
            <LinearGradient
              colors={["transparent", "rgba(252,211,77,0.4)", "rgba(254,243,199,0.25)"]}
              start={{ x: 1, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={streakModalStyles.auroraGradient}
            />
          </Animated.View>
          <Animated.View style={[streakModalStyles.auroraOrb, streakModalStyles.aurora3, { opacity: aurora3 }]}>
            <LinearGradient
              colors={["rgba(245,158,11,0.25)", "rgba(253,230,138,0.2)", "transparent"]}
              start={{ x: 0.5, y: 1 }}
              end={{ x: 0.5, y: 0 }}
              style={streakModalStyles.auroraGradient}
            />
          </Animated.View>
        </View>

        <Pressable style={streakModalStyles.card} onPress={(e) => e.stopPropagation()}>
          <View style={streakModalStyles.confettiWrap} pointerEvents="none">
            {confettiAnims.map((anim, i) => {
              const angle = (i / 12) * 2 * Math.PI;
              const dist = 110;
              const colors = ["#FBBF24", "#FDE68A", "#EAB308", "#F59E0B"];
              return (
                <Animated.View
                  key={i}
                  style={[
                    streakModalStyles.confettiDot,
                    { backgroundColor: colors[i % 4] },
                    {
                      transform: [
                        {
                          translateX: anim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, Math.cos(angle) * dist],
                          }),
                        },
                        {
                          translateY: anim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, Math.sin(angle) * dist],
                          }),
                        },
                      ],
                      opacity: anim.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [1, 0.9, 0.4],
                      }),
                    },
                  ]}
                />
              );
            })}
          </View>

          <Pressable style={streakModalStyles.closeButton} onPress={handleClose}>
            <Feather name="x" size={18} color={COLORS.TEXT_SECONDARY} strokeWidth={2.5} />
          </Pressable>

          <View style={streakModalStyles.heroWrap}>
            <Animated.View style={[streakModalStyles.badgeWrap, { transform: [{ scale: badgeScale }] }]}>
              <LinearGradient
                colors={[...GOLD_GRADIENT]}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 0.8, y: 1 }}
                style={streakModalStyles.crownBadge}
              >
                <MaterialCommunityIcons name="crown" size={40} color="#FFFFFF" />
              </LinearGradient>
              <Animated.Text
                style={[
                  streakModalStyles.sparkle,
                  streakModalStyles.sparkle1,
                  {
                    opacity: sparkle1.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
                    transform: [
                      {
                        translateY: sparkle1.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }),
                      },
                    ],
                  },
                ]}
              >
                ✨
              </Animated.Text>
              <Animated.Text
                style={[
                  streakModalStyles.sparkle,
                  streakModalStyles.sparkle2,
                  {
                    opacity: sparkle2.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
                    transform: [
                      {
                        translateY: sparkle2.interpolate({ inputRange: [0, 1], outputRange: [0, -12] }),
                      },
                    ],
                  },
                ]}
              >
                ⭐
              </Animated.Text>
              <Animated.Text
                style={[
                  streakModalStyles.sparkle,
                  streakModalStyles.sparkle3,
                  {
                    opacity: sparkle3.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
                    transform: [
                      {
                        translateY: sparkle3.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }),
                      },
                    ],
                  },
                ]}
              >
                💫
              </Animated.Text>
            </Animated.View>
            <Text style={streakModalStyles.milestoneLabel}>
              {milestone} {t("calendar_stats_day_streak")}
            </Text>
          </View>

          <View style={streakModalStyles.rewardBox}>
            <LinearGradient
              colors={[...GOLD_GRADIENT]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={streakModalStyles.rewardIconCircle}
            >
              <MaterialCommunityIcons name="crown" size={20} color="#FFFFFF" />
            </LinearGradient>
            <Text style={streakModalStyles.jokerRewardText}>{jokerRewardText}</Text>
          </View>

          <Pressable onPress={handleClose} style={streakModalStyles.ctaWrap}>
            <LinearGradient
              colors={[COLORS.ACCENT_LIGHT, COLORS.ACCENT]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={streakModalStyles.cta}
            >
              <Text style={streakModalStyles.ctaText}>{cta}</Text>
            </LinearGradient>
          </Pressable>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const streakModalStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 28,
  },
  blurLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  auroraWrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  auroraOrb: {
    position: "absolute",
    borderRadius: 9999,
    overflow: "hidden",
  },
  auroraGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 9999,
  },
  aurora1: {
    top: -SCREEN_HEIGHT * 0.1,
    right: -SCREEN_WIDTH * 0.2,
    width: SCREEN_WIDTH * 1.2,
    height: SCREEN_HEIGHT * 0.5,
  },
  aurora2: {
    top: SCREEN_HEIGHT * 0.25,
    left: -SCREEN_WIDTH * 0.2,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.4,
  },
  aurora3: {
    bottom: -SCREEN_HEIGHT * 0.2,
    right: 0,
    width: SCREEN_WIDTH * 1.1,
    height: SCREEN_HEIGHT * 0.5,
  },
  card: {
    ...MODAL.CARD,
    borderRadius: 32,
    paddingVertical: 32,
    paddingHorizontal: 28,
    shadowRadius: 24,
    shadowOpacity: 0.35,
  },
  confettiWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 32,
    overflow: "hidden",
  },
  confettiDot: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  closeButton: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.05)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    elevation: 2,
  },
  heroWrap: {
    alignItems: "center",
    marginBottom: 24,
  },
  badgeWrap: {
    position: "relative",
    marginBottom: 8,
  },
  crownBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(251,191,36,0.4)",
    shadowColor: "#FBBF24",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 4,
  },
  sparkle: {
    position: "absolute",
    fontSize: 18,
  },
  sparkle1: { top: -4, right: -12 },
  sparkle2: { bottom: -4, left: -8 },
  sparkle3: { top: 32, right: -16 },
  milestoneLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.TEXT_SECONDARY,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  rewardBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "rgba(254,243,199,0.4)",
    borderWidth: 1,
    borderColor: "rgba(253,230,138,0.5)",
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  rewardIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  jokerRewardText: {
    fontSize: 15,
    fontWeight: "700",
    color: JOKER.TEXT,
  },
  ctaWrap: { alignSelf: "stretch" },
  cta: {
    paddingVertical: 16,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "rgba(139,92,246,0.35)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 4,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});
