import React, { useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Animated,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { LinearGradient } from "expo-linear-gradient";

import { COLORS, JOKER, MODAL, MODAL_CLOSE_MS, MODAL_ENTER_MS } from "@/src/config/constants";

const STREAK_MILESTONE_TYPE = [7, 30, 60, 100, 180, 365] as const;
export type StreakMilestone = (typeof STREAK_MILESTONE_TYPE)[number];

const JOKER_COUNT_BY_MILESTONE: Record<StreakMilestone, number> = {
  7: 1,
  30: 2,
  60: 2,
  100: 3,
  180: 4,
  365: 5,
};

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
  const confettiAnims = useRef<Animated.Value[]>([]).current;
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
      Animated.timing(opacity, {
        toValue: 1,
        duration: MODAL_ENTER_MS,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, milestone, opacity]);
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

  if (!visible || !milestone) return null;

  const titleKey = `streak_popup_title_${milestone}` as const;
  const subtitleKey = `streak_popup_subtitle_${milestone}` as const;
  const title = t(titleKey);
  const subtitle = t(subtitleKey);
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
        <Pressable style={streakModalStyles.card} onPress={(e) => e.stopPropagation()}>
          {/* Confetti – visible, celebratory dots */}
          <View style={streakModalStyles.confettiWrap} pointerEvents="none">
            {confettiAnims.map((anim, i) => {
              const angle = (i / 12) * 2 * Math.PI;
              const dist = 110;
              const colors = ["#FBBF24", "#FDE68A", "#EAB308"];
              return (
                <Animated.View
                  key={i}
                  style={[
                    streakModalStyles.confettiDot,
                    { backgroundColor: colors[i % 3] },
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
          <Pressable style={MODAL.CLOSE_BUTTON} onPress={handleClose}>
            <Feather name="x" size={18} color={COLORS.TEXT_SECONDARY} strokeWidth={2.5} />
          </Pressable>

          {/* Hero: milestone badge (trophy-style number) */}
          <View style={streakModalStyles.heroWrap}>
            <Feather name="award" size={28} color="#FBBF24" strokeWidth={2} style={streakModalStyles.heroIcon} />
            <LinearGradient
              colors={["#FEF3C7", "#FDE68A", "#FBBF24"]}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={streakModalStyles.milestoneBadge}
            >
              <Text style={streakModalStyles.milestoneNumber}>{milestone}</Text>
            </LinearGradient>
            <Text style={streakModalStyles.milestoneLabel}>{t("calendar_stats_day_streak")}</Text>
          </View>

          {/* Typography: title → subtitle */}
          <Text style={streakModalStyles.title}>{title}</Text>
          <Text style={streakModalStyles.subtitle}>{subtitle}</Text>

          {/* Joker reward – plain bold gold text */}
          <Text style={streakModalStyles.jokerRewardText}>{jokerRewardText}</Text>

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
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 28,
  },
  card: {
    ...MODAL.CARD,
    borderRadius: 32,
    paddingVertical: 32,
    paddingHorizontal: 28,
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
  heroWrap: {
    alignItems: "center",
    marginBottom: 20,
  },
  heroIcon: {
    marginBottom: 8,
  },
  milestoneBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(251,191,36,0.5)",
    shadowColor: "#FBBF24",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 4,
  },
  milestoneNumber: {
    fontSize: 36,
    fontWeight: "800",
    color: JOKER.TEXT,
  },
  milestoneLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.TEXT_SECONDARY,
    marginTop: 6,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 17,
    color: "#374151",
    textAlign: "center",
    lineHeight: 26,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  jokerRewardText: {
    fontSize: 19,
    fontWeight: "700",
    color: "#D97706",
    textAlign: "center",
    marginBottom: 24,
  },
  ctaWrap: { alignSelf: "stretch" },
  cta: {
    paddingVertical: 14,
    borderRadius: 9999,
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
