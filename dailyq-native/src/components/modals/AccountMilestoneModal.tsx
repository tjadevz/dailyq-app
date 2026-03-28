import React, { useCallback, useEffect, useMemo } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
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

const FULL_HEIGHT = Dimensions.get("window").height;

export type AccountMilestoneAnswer = {
  date: string;
  questionText: string;
  answerText: string;
};

type Props = {
  visible: boolean;
  daysSinceCreation: number;
  answers: AccountMilestoneAnswer[];
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

export default function AccountMilestoneModal({
  visible,
  daysSinceCreation,
  answers,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const { lang } = useLanguage();
  const backdropOpacity = useSharedValue(0);
  const slideY = useSharedValue(FULL_HEIGHT);
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
    [backdropOpacity, slideY, dragY, closeModal]
  );

  useEffect(() => {
    if (visible) {
      dragY.value = 0;
      slideY.value = FULL_HEIGHT;
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
      FULL_HEIGHT,
      { duration: 220, easing: Easing.inOut(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(closeModal)();
      }
    );
  }, [closeModal, backdropOpacity, slideY, dragY]);

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
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(76, 29, 149, 0.25)" }]}
            pointerEvents="none"
          />
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
          <GestureDetector gesture={panGesture}>
            <AnimatedReanimated.View
              style={[styles.fullPanel, sheetStyle, { height: FULL_HEIGHT }]}
              pointerEvents="box-none"
            >
              {/* Same stack as GlassCardContainer: lavender base + BackgroundLayer (#FAFAFF + glows/silk) */}
              <View style={styles.panelRoot} pointerEvents="box-none">
                <BackgroundLayer />
                <View style={styles.panelContent} pointerEvents="box-none">
                  <View style={[styles.header, { paddingTop: insets.top + 32 }]}>
                    <Pressable onPress={handleClose} style={styles.closeBtn} hitSlop={12}>
                      <Feather name="x" size={18} color="#7C3AED" strokeWidth={2.5} />
                    </Pressable>
                    <View
                      style={{
                        backgroundColor: "#7C3AED",
                        borderRadius: 16,
                        padding: 16,
                        marginBottom: 24,
                        minHeight: 130,
                        justifyContent: "space-between",
                      }}
                    >
                      <Text style={{ fontSize: 14, color: "#C4B5FD", fontWeight: "500" }}>
                        This is
                      </Text>
                      <Text
                        style={{
                          fontSize: 44,
                          fontWeight: "700",
                          color: "#FFFFFF",
                        }}
                      >
                        {daysSinceCreation}
                      </Text>
                      <Text
                        style={{
                          fontSize: 20,
                          fontWeight: "600",
                          color: "#EDE9FE",
                        }}
                      >
                        days of you.
                      </Text>
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
    ...StyleSheet.absoluteFillObject,
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
});
