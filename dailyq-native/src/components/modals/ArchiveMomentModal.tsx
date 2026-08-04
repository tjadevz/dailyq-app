import React, { useCallback, useEffect, useMemo } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { BlurView } from "expo-blur";
import Feather from "@expo/vector-icons/Feather";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import AnimatedReanimated, {
  FadeInUp,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { BackgroundLayer } from "@/src/components/BackgroundLayer";
import { COLORS } from "@/src/config/constants";
import { useLanguage } from "@/src/context/LanguageContext";
import { STREAK_MILESTONES } from "@/src/lib/streakMilestones";
import type { AccountMilestoneAnswer } from "@/src/components/modals/AccountMilestoneModal";

type Props = {
  visible: boolean;
  answers: AccountMilestoneAnswer[];
  currentStreak: number;
  onClose: () => void;
};

function formatCardDate(dateStr: string, lang: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  return new Date(y, m - 1, d).toLocaleDateString(lang === "nl" ? "nl-NL" : "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ArchiveMomentModal({ visible, answers, currentStreak, onClose }: Props) {
  // Fabric doesn't reliably size flex:1/absoluteFillObject (right/bottom-based)
  // content inside <Modal> — needs explicit numeric width/height, and window
  // size must be read reactively (useWindowDimensions), not at module scope.
  const { width, height } = useWindowDimensions();
  const fullHeight = height;
  const insets = useSafeAreaInsets();
  const { lang, t } = useLanguage();
  const backdropOpacity = useSharedValue(0);
  const slideY = useSharedValue(fullHeight);
  const dragY = useSharedValue(0);

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
          const shouldDismiss =
            dragY.value > threshold || e.velocityY > velocityThreshold;
          if (shouldDismiss) {
            const currentY = slideY.value + dragY.value;
            slideY.value = currentY;
            dragY.value = 0;
            backdropOpacity.value = withTiming(0, { duration: 180 });
            slideY.value = withTiming(
              fullHeight,
              { duration: 220, easing: Easing.inOut(Easing.cubic) },
              (finished) => {
                if (finished) runOnJS(closeModal)();
              }
            );
          } else {
            dragY.value = withSpring(0, { damping: 20, stiffness: 300 });
          }
        }),
    [backdropOpacity, slideY, dragY, closeModal]
  );

  useEffect(() => {
    if (visible) {
      dragY.value = 0;
      slideY.value = fullHeight;
      backdropOpacity.value = 0;
      slideY.value = withSpring(0, { damping: 22, stiffness: 140, mass: 0.8 });
      backdropOpacity.value = withTiming(1, { duration: 200 });
    }
  }, [visible, slideY, backdropOpacity, dragY]);

  /** Same motion as swipe-to-dismiss (pan onEnd): backdrop fades, panel slides down. */
  const handleClose = useCallback(() => {
    dragY.value = 0;
    backdropOpacity.value = withTiming(0, { duration: 180 });
    slideY.value = withTiming(
      fullHeight,
      { duration: 220, easing: Easing.inOut(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(closeModal)();
      }
    );
  }, [closeModal, backdropOpacity, slideY, dragY]);

  const nextMilestone = useMemo(
    () => STREAK_MILESTONES.find((m) => m > currentStreak) ?? null,
    [currentStreak]
  );
  const daysLeft = nextMilestone != null ? nextMilestone - currentStreak : 0;

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideY.value + dragY.value }],
  }));

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none">
      <GestureHandlerRootView style={{ width, height }}>
        <AnimatedReanimated.View style={[styles.modalBackdrop, { width, height }, backdropStyle]}>
          <BlurView
            intensity={40}
            tint="dark"
            style={{ position: "absolute", top: 0, left: 0, width, height }}
          />
          <View
            style={{ position: "absolute", top: 0, left: 0, width, height, backgroundColor: "rgba(76, 29, 149, 0.25)" }}
            pointerEvents="none"
          />
          <Pressable style={{ position: "absolute", top: 0, left: 0, width, height }} onPress={handleClose} />
          <GestureDetector gesture={panGesture}>
            <AnimatedReanimated.View
              style={[styles.fullPanel, sheetStyle, { width, height: fullHeight }]}
              pointerEvents="box-none"
            >
              {/* Same stack as GlassCardContainer: lavender base + BackgroundLayer (#FAFAFF + glows/silk) */}
              <View style={styles.panelRoot} pointerEvents="box-none">
                <BackgroundLayer
                  style={{ position: "absolute", top: 0, left: 0, right: undefined, bottom: undefined, width, height: fullHeight }}
                />
                <View style={styles.panelContent} pointerEvents="box-none">
                  <View style={[styles.header, { paddingTop: insets.top + 32 }]}>
                    <Pressable onPress={handleClose} style={styles.closeBtn} hitSlop={12}>
                      <Feather name="x" size={18} color="#7C3AED" strokeWidth={2.5} />
                    </Pressable>
                    <View style={styles.heroBox}>
                      <Text style={styles.heroHeader}>{t("archive_moment_day4_header")}</Text>
                      <Text style={styles.heroSubtitle}>{t("archive_moment_day4_subtitle")}</Text>
                    </View>
                  </View>

                  <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator
                  >
                    {answers.map((item, index) => {
                      const isLast = index === answers.length - 1;
                      return (
                        <View key={`${item.date}-${index}`} style={styles.row}>
                          <View style={styles.timelineCol}>
                            <View style={styles.dot} />
                            {!isLast ? <View style={styles.line} /> : null}
                          </View>
                          <AnimatedReanimated.View
                            entering={FadeInUp.delay(250 + index * 80).duration(260)}
                            style={styles.card}
                          >
                            <Text style={styles.cardDate}>{formatCardDate(item.date, lang)}</Text>
                            <Text style={styles.cardQuestion}>{item.questionText}</Text>
                            <Text style={styles.cardAnswer}>{item.answerText}</Text>
                          </AnimatedReanimated.View>
                        </View>
                      );
                    })}
                    {nextMilestone != null && (
                      <AnimatedReanimated.View
                        entering={FadeInUp.delay(250 + answers.length * 80).duration(260)}
                        style={styles.progressCard}
                      >
                        <Feather name="award" size={16} color="#7C3AED" />
                        <Text style={styles.progressText}>
                          {t(
                            daysLeft === 1
                              ? "joker_shop_streak_days_left_one"
                              : "joker_shop_streak_days_left",
                            { count: daysLeft }
                          )}
                        </Text>
                      </AnimatedReanimated.View>
                    )}
                  </ScrollView>
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
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 0,
  },
  fullPanel: {
    position: "absolute",
    left: 0,
    bottom: 0,
    zIndex: 1,
    overflow: "hidden",
  },
  panelRoot: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
    overflow: "hidden",
  },
  panelContent: {
    flex: 1,
    zIndex: 10,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  closeBtn: {
    alignSelf: "flex-end",
    padding: 8,
    marginBottom: 32,
  },
  heroBox: {
    backgroundColor: "#7C3AED",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    minHeight: 130,
    justifyContent: "center",
  },
  heroHeader: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 10,
  },
  heroSubtitle: {
    fontSize: 15,
    fontWeight: "500",
    color: "#EDE9FE",
    lineHeight: 15 * 1.4,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  timelineCol: {
    width: 24,
    alignItems: "center",
    marginRight: 12,
    paddingTop: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#7C3AED",
  },
  line: {
    width: 1.5,
    alignSelf: "center",
    height: 16,
    marginTop: 4,
    backgroundColor: "#D4BBFF",
  },
  card: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardDate: {
    fontSize: 12,
    fontWeight: "500",
    color: "#7C3AED",
    marginBottom: 6,
  },
  cardQuestion: {
    fontSize: 13,
    lineHeight: 13 * 1.4,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 8,
  },
  cardAnswer: {
    fontSize: 15,
    lineHeight: 15 * 1.5,
    color: COLORS.TEXT_PRIMARY,
  },
  progressCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F3E8FF",
    borderRadius: 12,
    padding: 16,
    marginTop: 4,
  },
  progressText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#7C3AED",
  },
});
