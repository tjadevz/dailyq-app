import React, { useCallback, useEffect, useMemo } from "react";
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import Feather from "@expo/vector-icons/Feather";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import AnimatedReanimated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { useLanguage } from "@/src/context/LanguageContext";
import type { RecapData } from "@/src/hooks/useMonthlyRecap";

const FULL_HEIGHT = Dimensions.get("window").height;

type Props = {
  visible: boolean;
  recapData: RecapData;
  onClose: () => void;
  onShare: () => void;
};

export default function MonthlyRecapModal({ visible, recapData, onClose, onShare }: Props) {
  const insets = useSafeAreaInsets();
  const { lang } = useLanguage();
  const backdropOpacity = useSharedValue(0);
  const slideY = useSharedValue(FULL_HEIGHT);
  const dragY = useSharedValue(0);

  const copy = lang === "nl"
    ? {
        eyebrow: "Dit was",
        daysAnswered: "dagen beantwoord",
        totalAnswers: "antwoorden in totaal",
        longestStreak: "langste reeks",
        wordsWritten: "woorden geschreven deze maand",
        share: "Deel je maand",
      }
    : {
        eyebrow: "This was",
        daysAnswered: "days answered",
        totalAnswers: "answers in total",
        longestStreak: "longest streak",
        wordsWritten: "words written this month",
        share: "Share your month",
      };

  const progress = useMemo(() => {
    if (recapData.totalDaysInMonth <= 0) return 0;
    return Math.min(1, Math.max(0, recapData.daysAnswered / recapData.totalDaysInMonth));
  }, [recapData.daysAnswered, recapData.totalDaysInMonth]);

  const closeModal = useCallback(() => onClose(), [onClose]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(10)
        .onUpdate((e) => {
          if (e.translationY > 0) {
            dragY.value = e.translationY;
          }
        })
        .onEnd((e) => {
          const threshold = 120;
          const velocityThreshold = 400;
          const shouldDismiss = dragY.value > threshold || e.velocityY > velocityThreshold;
          if (shouldDismiss) {
            const currentY = slideY.value + dragY.value;
            slideY.value = currentY;
            dragY.value = 0;
            backdropOpacity.value = withTiming(0, { duration: 180 });
            slideY.value = withTiming(
              FULL_HEIGHT,
              { duration: 220, easing: Easing.inOut(Easing.cubic) },
              (finished) => {
                if (finished) runOnJS(closeModal)();
              }
            );
          } else {
            dragY.value = withSpring(0, { damping: 20, stiffness: 300 });
          }
        }),
    [backdropOpacity, closeModal, dragY, slideY]
  );

  useEffect(() => {
    if (visible) {
      dragY.value = 0;
      slideY.value = FULL_HEIGHT;
      backdropOpacity.value = 0;
      slideY.value = withSpring(0, { damping: 22, stiffness: 140, mass: 0.8 });
      backdropOpacity.value = withTiming(1, { duration: 200 });
    }
  }, [backdropOpacity, dragY, slideY, visible]);

  const handleClose = useCallback(() => {
    dragY.value = 0;
    backdropOpacity.value = withTiming(0, { duration: 180 });
    slideY.value = withTiming(
      FULL_HEIGHT,
      { duration: 220, easing: Easing.inOut(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(closeModal)();
      }
    );
  }, [backdropOpacity, closeModal, dragY, slideY]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideY.value + dragY.value }],
  }));

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none">
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
        <AnimatedReanimated.View style={[styles.modalBackdrop, backdropStyle]}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, styles.backdropTint]} pointerEvents="none" />
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
          <GestureDetector gesture={panGesture}>
            <AnimatedReanimated.View
              style={[styles.fullPanel, sheetStyle, { height: FULL_HEIGHT }]}
              pointerEvents="box-none"
            >
              <View style={styles.panelRoot} pointerEvents="box-none">
                <View style={styles.panelContent} pointerEvents="box-none">
                  <View style={[styles.contentWrap, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
                    <Pressable onPress={handleClose} style={styles.closeBtn} hitSlop={12}>
                      <Feather name="x" size={18} color="#FFFFFF" strokeWidth={2.5} />
                    </Pressable>

                    <Text style={styles.eyebrow}>{copy.eyebrow}</Text>
                    <Text style={styles.monthName}>{recapData.monthName}</Text>

                    <View style={styles.card}>
                      <View style={styles.daysRow}>
                        <Text style={styles.daysBig}>{recapData.daysAnswered}</Text>
                        <Text style={styles.daysSmall}>/ {recapData.totalDaysInMonth}</Text>
                      </View>
                      <Text style={styles.label}>{copy.daysAnswered}</Text>
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
                      </View>
                    </View>

                    <View style={styles.statsRow}>
                      <View style={[styles.card, styles.halfCard]}>
                        <Text style={styles.statBig}>{recapData.totalAnswers}</Text>
                        <Text style={styles.label}>{copy.totalAnswers}</Text>
                      </View>
                      <View style={[styles.card, styles.halfCard]}>
                        <Text style={styles.statBig}>{recapData.longestStreakThisMonth}</Text>
                        <Text style={styles.label}>{copy.longestStreak}</Text>
                      </View>
                    </View>

                    <View style={styles.card}>
                      <Text style={styles.statBig}>{recapData.wordsWrittenThisMonth}</Text>
                      <Text style={styles.label}>{copy.wordsWritten}</Text>
                    </View>

                    <Pressable
                      onPress={onShare}
                      style={({ pressed }) => [styles.shareButton, pressed && styles.shareButtonPressed]}
                    >
                      <Text style={styles.shareButtonText}>{copy.share}</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </AnimatedReanimated.View>
          </GestureDetector>
        </AnimatedReanimated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropTint: {
    backgroundColor: "rgba(26, 16, 51, 0.45)",
  },
  fullPanel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
  },
  panelRoot: {
    flex: 1,
    backgroundColor: "#1A1033",
    overflow: "hidden",
  },
  panelContent: {
    flex: 1,
    zIndex: 10,
  },
  contentWrap: {
    flex: 1,
    paddingHorizontal: 20,
  },
  closeBtn: {
    alignSelf: "flex-end",
    padding: 8,
    marginBottom: 8,
  },
  eyebrow: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 6,
  },
  monthName: {
    color: "#FFFFFF",
    fontSize: 38,
    fontWeight: "500",
    marginBottom: 18,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  daysRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 8,
  },
  daysBig: {
    color: "#FFFFFF",
    fontSize: 42,
    fontWeight: "600",
  },
  daysSmall: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 22,
    fontWeight: "500",
    marginLeft: 4,
  },
  label: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
    fontWeight: "500",
  },
  progressTrack: {
    marginTop: 12,
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
    borderRadius: 999,
    backgroundColor: "#7C3AED",
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  halfCard: {
    flex: 1,
  },
  statBig: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "600",
    marginBottom: 8,
  },
  shareButton: {
    marginTop: "auto",
    backgroundColor: "#7C3AED",
    borderRadius: 14,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  shareButtonPressed: {
    opacity: 0.85,
  },
  shareButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
