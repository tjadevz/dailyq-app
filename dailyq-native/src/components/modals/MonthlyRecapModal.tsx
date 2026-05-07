import React, { useCallback, useEffect, useMemo } from "react";
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import Feather from "@expo/vector-icons/Feather";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import AnimatedReanimated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
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

  const copy = lang === "nl"
    ? {
        eyebrow: "Dit was",
        daysAnswered: "dagen beantwoord",
        totalAnswers: "antwoorden in je archief",
        longestStreak: "langste reeks",
        wordsWritten: "woorden geschreven",
        earliestAnswer: "vroegste antwoord",
        latestAnswer: "laatste antwoord",
        monthsActive: "actieve maanden",
        share: "Deel je maand",
      }
    : {
        eyebrow: "This was",
        daysAnswered: "days answered",
        totalAnswers: "answers in your archive",
        longestStreak: "longest streak",
        wordsWritten: "words written",
        earliestAnswer: "earliest answer",
        latestAnswer: "latest answer",
        monthsActive: "active months",
        share: "Share your month",
      };

  const progress = useMemo(() => {
    if (recapData.totalDaysInMonth <= 0) return 0;
    return Math.min(1, Math.max(0, recapData.daysAnswered / recapData.totalDaysInMonth));
  }, [recapData.daysAnswered, recapData.totalDaysInMonth]);
  const monthsActiveLabel = useMemo(() => {
    if (lang === "nl") {
      return recapData.monthsActive === 1 ? "actieve maand" : "actieve maanden";
    }
    return recapData.monthsActive === 1 ? "active month" : "active months";
  }, [lang, recapData.monthsActive]);

  const closeModal = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    if (visible) {
      slideY.value = FULL_HEIGHT;
      backdropOpacity.value = 0;
      slideY.value = withTiming(0, { duration: 240, easing: Easing.out(Easing.cubic) });
      backdropOpacity.value = withTiming(1, { duration: 200 });
    }
  }, [backdropOpacity, slideY, visible]);

  const handleClose = useCallback(() => {
    backdropOpacity.value = withTiming(0, { duration: 180 });
    slideY.value = withTiming(
      FULL_HEIGHT,
      { duration: 220, easing: Easing.inOut(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(closeModal)();
      }
    );
  }, [backdropOpacity, closeModal, slideY]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideY.value }],
  }));

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none">
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
        <AnimatedReanimated.View style={[styles.modalBackdrop, backdropStyle]}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, styles.backdropTint]} pointerEvents="none" />
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

                  <View style={styles.heroBlock}>
                    <Text style={styles.heroEyebrow}>{copy.eyebrow}</Text>
                    <Text style={styles.heroMonthName}>{recapData.monthName}</Text>
                  </View>

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

                  <View style={styles.statsGrid}>
                    <View style={[styles.statTile, styles.halfCard]}>
                      <Text style={styles.statBig}>{recapData.totalAnswers}</Text>
                      <Text style={styles.totalAnswersLabel}>
                        {lang === "nl" ? "antwoorden in je archief" : copy.totalAnswers}
                      </Text>
                    </View>
                    <View style={[styles.statTile, styles.halfCard]}>
                      <Text style={styles.statBig}>{recapData.longestStreakThisMonth}</Text>
                      <Text style={styles.label}>
                        {lang === "nl" ? "langste streak" : copy.longestStreak}
                      </Text>
                    </View>
                    <View style={[styles.statTile, styles.halfCard]}>
                      <Text style={styles.statBig}>{recapData.wordsWrittenThisMonth}</Text>
                      <Text style={styles.label}>{copy.wordsWritten}</Text>
                    </View>
                    {recapData.monthsActive != null ? (
                      <View style={[styles.statTile, styles.halfCard]}>
                        <Text style={styles.statBig}>{recapData.monthsActive}</Text>
                        <Text style={styles.label}>{monthsActiveLabel}</Text>
                      </View>
                    ) : null}
                    <View style={[styles.statTile, styles.halfCard]}>
                      <Text style={styles.statBig}>{recapData.earliestAnswerTime}</Text>
                      <Text style={styles.label}>{copy.earliestAnswer}</Text>
                    </View>
                    <View style={[styles.statTile, styles.halfCard]}>
                      <Text style={styles.statBig}>{recapData.latestAnswerTime}</Text>
                      <Text style={styles.label}>{copy.latestAnswer}</Text>
                    </View>
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
    backgroundColor: "#2A1A5E",
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
  heroBlock: {
    backgroundColor: "#7C3AED",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  heroEyebrow: {
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  heroMonthName: {
    fontSize: 42,
    fontWeight: "600",
    color: "#FFFFFF",
    lineHeight: 42,
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
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "space-between",
    marginBottom: 12,
  },
  statTile: {
    backgroundColor: "rgba(255,255,255,0.11)",
    borderRadius: 14,
    padding: 16,
  },
  halfCard: {
    width: "48%",
  },
  statBig: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "600",
    marginBottom: 8,
  },
  totalAnswersLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
    fontWeight: "500",
    flexShrink: 1,
    flexWrap: "wrap",
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
