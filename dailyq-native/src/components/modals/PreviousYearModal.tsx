import React, { useCallback, useEffect, useMemo } from "react";
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
  ScrollView,
} from "react-native-gesture-handler";
import AnimatedReanimated, {
  Easing,
  FadeInUp,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { BackgroundLayer } from "@/src/components/BackgroundLayer";
import { COLORS } from "@/src/config/constants";
import { useLanguage } from "@/src/context/LanguageContext";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SHEET_HEIGHT = Math.round(SCREEN_HEIGHT * 0.75);

export type PreviousYearAnswerItem = {
  question_date: string;
  answer_text: string;
};

type Props = {
  visible: boolean;
  items: PreviousYearAnswerItem[];
  currentAnswer: PreviousYearAnswerItem | null;
  questionText: string;
  onClose: () => void;
};

const DUTCH_MONTHS = [
  "januari",
  "februari",
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
  "oktober",
  "november",
  "december",
] as const;

function formatCardDate(dateStr: string, lang: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  if (lang === "nl") {
    const monthName = DUTCH_MONTHS[m - 1];
    if (!monthName) return dateStr;
    return `${d} ${monthName} ${y}`;
  }
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function PreviousYearModal({
  visible,
  items,
  currentAnswer,
  questionText,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const { lang, t } = useLanguage();
  const backdropOpacity = useSharedValue(0);
  const slideY = useSharedValue(SHEET_HEIGHT);
  const dragY = useSharedValue(0);

  const closeModal = useCallback(() => onClose(), [onClose]);

  const mergedRows = useMemo(() => {
    const base: PreviousYearAnswerItem[] = items.map((r) => ({ ...r }));
    if (currentAnswer) {
      base.push({ ...currentAnswer });
    }
    return base.sort((a, b) => a.question_date.localeCompare(b.question_date));
  }, [items, currentAnswer]);

  const headerTitle =
    items.length === 1 ? t("today_previous_year_header_one") : t("today_previous_year_header_many");

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
              SHEET_HEIGHT,
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
      slideY.value = SHEET_HEIGHT;
      backdropOpacity.value = 0;
      slideY.value = withSpring(0, { damping: 22, stiffness: 140, mass: 0.8 });
      backdropOpacity.value = withTiming(1, { duration: 200 });
    }
  }, [visible, slideY, backdropOpacity, dragY]);

  const handleClose = useCallback(() => {
    backdropOpacity.value = withTiming(0, { duration: 180 });
    slideY.value = withTiming(
      SHEET_HEIGHT,
      { duration: 220, easing: Easing.inOut(Easing.cubic) },
      (finished) => {
        if (finished) {
          dragY.value = 0;
          runOnJS(closeModal)();
        }
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
    <Modal transparent visible={visible} animationType="none" onRequestClose={handleClose}>
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
              style={[styles.draggableSurface, sheetStyle, { height: SHEET_HEIGHT }]}
            >
              <View style={styles.backgroundLayer} pointerEvents="none">
                <BackgroundLayer />
              </View>

              <View style={styles.topHandleWrap} pointerEvents="none">
                <View style={styles.topHandle} />
              </View>

              <View style={styles.sheetBody}>
                <View style={styles.header}>
                  <Text style={styles.headerTitle} numberOfLines={3}>
                    {headerTitle}
                  </Text>
                  <Text style={styles.questionSubheading}>{questionText}</Text>
                </View>

                <ScrollView
                  style={styles.scroll}
                  contentContainerStyle={[
                    styles.scrollContent,
                    { paddingBottom: Math.max(insets.bottom, 20) },
                  ]}
                  showsVerticalScrollIndicator
                  bounces
                  overScrollMode="always"
                >
                  {mergedRows.map((item, index) => {
                    const isLast = index === mergedRows.length - 1;
                    return (
                      <View key={`${item.question_date}-${index}`} style={styles.row}>
                        <View style={styles.timelineCol}>
                          <View style={styles.dot} />
                          {!isLast ? <View style={styles.line} /> : null}
                        </View>
                        <AnimatedReanimated.View
                          entering={FadeInUp.delay(120 + index * 60).duration(260)}
                          style={styles.card}
                        >
                          <Text style={styles.cardDate}>{formatCardDate(item.question_date, lang)}</Text>
                          <Text style={styles.cardAnswer}>{item.answer_text}</Text>
                        </AnimatedReanimated.View>
                      </View>
                    );
                  })}
                </ScrollView>
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
  draggableSurface: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
    backgroundColor: COLORS.BACKGROUND,
  },
  sheetBody: {
    flex: 1,
    minHeight: 0,
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  topHandleWrap: {
    paddingTop: 10,
    paddingBottom: 14,
    alignItems: "center",
    zIndex: 2,
  },
  topHandle: {
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(156,163,175,0.7)",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
    paddingRight: 8,
  },
  questionSubheading: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400",
    color: COLORS.TEXT_SECONDARY,
    paddingRight: 8,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 12,
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
  cardAnswer: {
    fontSize: 15,
    lineHeight: 15 * 1.5,
    color: COLORS.TEXT_PRIMARY,
  },
});
