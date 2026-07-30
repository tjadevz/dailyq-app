import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, Modal, StyleSheet, Animated, useWindowDimensions } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

import { JOKER } from "@/src/config/constants";
import { MechanicalDigitRoll } from "@/src/components/MechanicalDigitRoll";
import { JOKER_COUNT_BY_MILESTONE, type StreakMilestone } from "@/src/lib/streakMilestones";

export interface MilestoneCelebrationModalProps {
  visible: boolean;
  milestone: StreakMilestone | null;
  onClose: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

/**
 * Fullscreen streak-milestone celebration: same visual family as SubmitSuccessModal
 * (purple blur + mechanical digit roll) but heavier and, unlike the daily version,
 * does not auto-dismiss — this is rare (7/14/30/60/100/180/365 days), so the user
 * gets to read how many jokers they earned instead of it disappearing on them.
 * Tap anywhere to close.
 */
const CONTENT_DELAY_MS = 280;
const SPRING_SETTLE_MS = 450;
const ROLL_DURATION_MS = 1300;
const LAND_POP_MS = 220;
const CONFETTI_COUNT = 12;

export function MilestoneCelebrationModal({ visible, milestone, onClose, t }: MilestoneCelebrationModalProps) {
  // Fabric doesn't reliably size flex:1/absoluteFillObject (right/bottom-based)
  // content inside <Modal> — needs explicit numeric width/height.
  const { width, height } = useWindowDimensions();

  const scale = useRef(new Animated.Value(0.5)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const popScale = useRef(new Animated.Value(1)).current;
  const tagOpacity = useRef(new Animated.Value(0)).current;
  const jokerOpacity = useRef(new Animated.Value(0)).current;
  const jokerScale = useRef(new Animated.Value(0.9)).current;
  const msgOpacity = useRef(new Animated.Value(0)).current;
  const hintOpacity = useRef(new Animated.Value(0)).current;
  const confetti = useRef(
    Array.from({ length: CONFETTI_COUNT }).map(() => new Animated.Value(0))
  ).current;

  const didAnimateRef = useRef(false);
  const dismissingRef = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [rendered, setRendered] = useState(visible);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const dismissNow = () => {
    if (dismissingRef.current || !rendered) return;
    dismissingRef.current = true;
    clearTimers();
    Animated.timing(opacity, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      setRendered(false);
      scale.setValue(0.5);
      opacity.setValue(0);
      popScale.setValue(1);
      tagOpacity.setValue(0);
      jokerOpacity.setValue(0);
      jokerScale.setValue(0.9);
      msgOpacity.setValue(0);
      hintOpacity.setValue(0);
      onClose();
    });
  };

  useEffect(() => {
    if (!visible || !milestone) {
      didAnimateRef.current = false;
      return;
    }
    setRendered(true);
    if (didAnimateRef.current) return;
    didAnimateRef.current = true;
    dismissingRef.current = false;

    scale.setValue(0.5);
    opacity.setValue(0);
    popScale.setValue(1);
    tagOpacity.setValue(0);
    jokerOpacity.setValue(0);
    jokerScale.setValue(0.9);
    msgOpacity.setValue(0);
    hintOpacity.setValue(0);
    confetti.forEach((v) => v.setValue(0));

    const t1 = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 7, tension: 90 }),
      ]).start();
      Animated.timing(tagOpacity, {
        toValue: 1,
        duration: 220,
        delay: 120,
        useNativeDriver: true,
      }).start();
    }, CONTENT_DELAY_MS);
    timers.current.push(t1);
  }, [visible, milestone]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLanded = () => {
    if (dismissingRef.current) return;
    Animated.sequence([
      Animated.timing(popScale, { toValue: 1.1, duration: LAND_POP_MS / 2, useNativeDriver: true }),
      Animated.timing(popScale, { toValue: 1, duration: LAND_POP_MS / 2, useNativeDriver: true }),
    ]).start();

    confetti.forEach((anim) => {
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: 850 + Math.random() * 200,
        useNativeDriver: true,
      }).start();
    });

    const jokerTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(jokerOpacity, { toValue: 1, duration: 240, useNativeDriver: true }),
        Animated.spring(jokerScale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 120 }),
      ]).start();
      const msgTimer = setTimeout(() => {
        Animated.timing(msgOpacity, { toValue: 1, duration: 240, useNativeDriver: true }).start();
        Animated.timing(hintOpacity, { toValue: 1, duration: 300, delay: 200, useNativeDriver: true }).start();
      }, 140);
      timers.current.push(msgTimer);
    }, LAND_POP_MS - 60);
    timers.current.push(jokerTimer);
  };

  if (!milestone) return null;

  const jokerCount = JOKER_COUNT_BY_MILESTONE[milestone] ?? 1;
  const jokerRewardText =
    jokerCount === 1
      ? t("streak_popup_joker_earned_singular", { n: jokerCount })
      : t("streak_popup_joker_earned_plural", { n: jokerCount });
  const subtitle = t(`streak_popup_subtitle_${milestone}`);

  return (
    <Modal transparent visible={rendered} animationType="none" statusBarTranslucent>
      <Pressable style={[styles.fullscreen, { width, height }]} onPress={dismissNow}>
        <BlurView
          intensity={40}
          tint="dark"
          style={{ position: "absolute", top: 0, left: 0, width, height }}
        />
        <View
          style={[styles.purpleOverlay, { position: "absolute", top: 0, left: 0, width, height }]}
        />
        <Animated.View style={[styles.contentColumn, { opacity, transform: [{ scale }] }]}>
          <Animated.Text style={[styles.tag, { opacity: tagOpacity }]}>
            {t("streak_popup_tag")}
          </Animated.Text>

          <Animated.View style={{ transform: [{ scale: popScale }] }}>
            <View style={styles.confettiWrap} pointerEvents="none">
              {confetti.map((anim, i) => {
                const angle = (i / CONFETTI_COUNT) * 2 * Math.PI;
                const dist = 70;
                const colors = ["#FBBF24", "#FDE68A", "#EAB308", "#F59E0B"];
                return (
                  <Animated.View
                    key={i}
                    style={[
                      styles.confettiDot,
                      { backgroundColor: colors[i % 4] },
                      {
                        transform: [
                          { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(angle) * dist] }) },
                          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(angle) * dist] }) },
                        ],
                        opacity: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.9, 0] }),
                      },
                    ]}
                  />
                );
              })}
            </View>
            <MechanicalDigitRoll
              visible={visible}
              value={milestone}
              digitHeight={62}
              fontSize={52}
              rollDelayMs={CONTENT_DELAY_MS + SPRING_SETTLE_MS}
              rollDurationMs={ROLL_DURATION_MS}
              onLanded={handleLanded}
            />
          </Animated.View>

          <Text style={styles.numLabel}>{t("calendar_stats_day_streak")}</Text>

          <Animated.View
            style={[
              styles.jokerPill,
              { opacity: jokerOpacity, transform: [{ scale: jokerScale }] },
            ]}
          >
            <LinearGradient
              colors={["#FEF3C7", JOKER.GOLD, "#D4A830"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.jokerIconCircle}
            >
              <MaterialCommunityIcons name="crown" size={16} color="#fff" />
            </LinearGradient>
            <Text style={styles.jokerText}>{jokerRewardText}</Text>
          </Animated.View>

          <Animated.Text style={[styles.messageText, { opacity: msgOpacity }]}>
            {subtitle}
          </Animated.Text>

          <Animated.Text style={[styles.tapHint, { opacity: hintOpacity }]}>
            {t("streak_popup_tap_close")}
          </Animated.Text>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fullscreen: {
    position: "absolute",
    top: 0,
    left: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  purpleOverlay: {
    backgroundColor: "rgba(76, 29, 149, 0.25)",
  },
  contentColumn: {
    zIndex: 1,
    alignItems: "center",
    maxWidth: "88%",
  },
  tag: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#4A2E00",
    backgroundColor: JOKER.GOLD,
    paddingVertical: 3,
    paddingHorizontal: 12,
    borderRadius: 999,
    marginBottom: 14,
    overflow: "hidden",
  },
  confettiWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: -1,
  },
  confettiDot: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  numLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    marginTop: 8,
    letterSpacing: 0.2,
  },
  jokerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 18,
    backgroundColor: "rgba(255,199,0,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,199,0,0.35)",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  jokerIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  jokerText: {
    color: "#FEF3C7",
    fontSize: 14,
    fontWeight: "700",
  },
  messageText: {
    color: "#fff",
    fontSize: 15,
    marginTop: 20,
    textAlign: "center",
    lineHeight: 21,
    letterSpacing: 0.1,
    fontWeight: "500",
  },
  tapHint: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    marginTop: 20,
    letterSpacing: 0.2,
  },
});
