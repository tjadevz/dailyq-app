import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";
import RBSheet from "react-native-raw-bottom-sheet";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import AnimatedReanimated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { COLORS } from "@/src/config/constants";
import { BackgroundLayer } from "@/src/components/BackgroundLayer";

type JokerModalBottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  jokerBalance: number;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const SHEET_HEIGHT = Math.round(Dimensions.get("window").height * 0.78);
const CONTENT_OFFSET_Y = Math.round(SHEET_HEIGHT * 0.1);

export function JokerModalBottomSheet({
  visible,
  onClose,
  t,
}: JokerModalBottomSheetProps) {
  const sheetRef = useRef<RBSheet | null>(null);
  const crownTranslateY = useRef(new Animated.Value(20)).current;
  const crownEntryScale = useRef(new Animated.Value(0.9)).current;
  const crownPulseScale = useRef(new Animated.Value(1)).current;
  const crownEntryOpacity = useRef(new Animated.Value(0)).current;
  const crownPulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const dragY = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      sheetRef.current?.open();
      dragY.value = 0;
      crownTranslateY.setValue(20);
      crownEntryScale.setValue(0.9);
      crownPulseScale.setValue(1);
      crownEntryOpacity.setValue(0);

      Animated.parallel([
        Animated.timing(crownEntryOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(crownTranslateY, {
          toValue: 0,
          damping: 12,
          stiffness: 180,
          useNativeDriver: true,
        }),
        Animated.spring(crownEntryScale, {
          toValue: 1,
          damping: 9,
          stiffness: 220,
          useNativeDriver: true,
        }),
      ]).start(() => {
        crownPulseLoopRef.current?.stop();
        crownPulseLoopRef.current = Animated.loop(
          Animated.sequence([
            Animated.timing(crownPulseScale, {
              toValue: 1.06,
              duration: 900,
              useNativeDriver: true,
            }),
            Animated.timing(crownPulseScale, {
              toValue: 1,
              duration: 900,
              useNativeDriver: true,
            }),
          ])
        );
        crownPulseLoopRef.current.start();
      });
      return;
    }
    crownPulseLoopRef.current?.stop();
    crownPulseLoopRef.current = null;
    crownPulseScale.setValue(1);
    if (sheetRef.current) {
      sheetRef.current.close();
    }
  }, [visible, crownEntryOpacity, crownEntryScale, crownPulseScale, crownTranslateY, dragY]);

  useEffect(() => {
    return () => {
      crownPulseLoopRef.current?.stop();
      crownPulseLoopRef.current = null;
    };
  }, []);

  const closeSheet = () => {
    sheetRef.current?.close();
  };

  const panGesture = Gesture.Pan()
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
        runOnJS(closeSheet)();
      } else {
        dragY.value = withSpring(0, { damping: 20, stiffness: 300 });
      }
    });

  const dragAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value }],
  }));

  return (
    <RBSheet
      ref={sheetRef}
      height={SHEET_HEIGHT}
      closeOnPressMask={true}
      closeOnPressBack={true}
      closeOnDragDown={false}
      dragFromTopOnly={true}
      animationType="slide"
      openDuration={240}
      closeDuration={200}
      onClose={() => {
        dragY.value = 0;
        onClose();
      }}
      customStyles={{
        wrapper: styles.wrapper,
        container: styles.sheetContainer,
      }}
    >
      <GestureHandlerRootView style={styles.sheetBody}>
        <GestureDetector gesture={panGesture}>
          <AnimatedReanimated.View style={[styles.draggableSurface, dragAnimatedStyle]}>
        <View style={styles.backgroundLayer} pointerEvents="none">
          <BackgroundLayer />
        </View>
        <View style={styles.topHandleWrap} pointerEvents="none">
          <View style={styles.topHandle} />
        </View>
        <View style={[styles.content, { transform: [{ translateY: CONTENT_OFFSET_Y }] }]}>
          <Animated.View
            style={[
              styles.crownAnimWrap,
              {
                opacity: crownEntryOpacity,
                transform: [
                  { translateY: crownTranslateY },
                  { scale: crownEntryScale },
                  { scale: crownPulseScale },
                ],
              },
            ]}
          >
            <LinearGradient
              colors={["#FDE68A", "#FBBF24"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.crownBadge}
            >
              <MaterialCommunityIcons name="crown" size={28} color="#FFFFFF" />
            </LinearGradient>
          </Animated.View>

          <View style={styles.jokersHeader}>
            <Text style={styles.title}>{t("onboarding_jokers_title")}</Text>
          </View>

          <View style={styles.bulletList}>
            <View style={styles.bulletRow}>
              <View style={[styles.iconWrap, styles.iconAmber]}>
                <Feather name="calendar" size={18} color="#F59E0B" strokeWidth={2.5} />
              </View>
              <View style={styles.bulletText}>
                <Text style={styles.bulletTitle}>{t("onboarding_jokers_answer_missed")}</Text>
                <Text style={styles.bulletDesc}>{t("onboarding_jokers_answer_missed_desc")}</Text>
              </View>
            </View>

            <View style={styles.bulletRow}>
              <View style={[styles.iconWrap, styles.iconRed]}>
                <MaterialCommunityIcons name="fire" size={18} color="#EF4444" />
              </View>
              <View style={styles.bulletText}>
                <Text style={styles.bulletTitle}>{t("onboarding_jokers_earn_streaks")}</Text>
                <Text style={styles.bulletDesc}>{t("onboarding_jokers_earn_streaks_desc")}</Text>
              </View>
            </View>

            <View style={styles.bulletRow}>
              <View style={[styles.iconWrap, styles.iconPurple]}>
                <Feather name="user-plus" size={18} color="#8B5CF6" strokeWidth={2.5} />
              </View>
              <View style={styles.bulletText}>
                <Text style={styles.bulletTitle}>{t("onboarding_jokers_refer")}</Text>
                <Text style={styles.bulletDesc}>{t("onboarding_jokers_refer_desc")}</Text>
              </View>
            </View>
          </View>
        </View>
          </AnimatedReanimated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </RBSheet>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: "rgba(76,29,149,0.32)",
  },
  topHandleWrap: {
    paddingTop: 10,
    paddingBottom: 10,
    alignItems: "center",
    zIndex: 2,
  },
  topHandle: {
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(156,163,175,0.7)",
  },
  sheetContainer: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    backgroundColor: "transparent",
    minHeight: 520,
    overflow: "hidden",
  },
  sheetBody: {
    flex: 1,
    paddingBottom: 0,
  },
  draggableSurface: {
    flex: 1,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: "hidden",
  },
  content: {
    paddingHorizontal: 31,
    paddingTop: 26,
    paddingBottom: 38,
    gap: 0,
    flex: 1,
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  crownBadge: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.4)",
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 4,
  },
  crownAnimWrap: {
    alignSelf: "center",
    marginTop: -17,
    marginBottom: 22,
  },
  title: {
    fontSize: 29,
    fontWeight: "600",
    fontFamily: "Inter",
    textAlign: "center",
    color: COLORS.TEXT_PRIMARY,
    marginTop: 0,
    marginBottom: 0,
  },
  jokersHeader: {
    alignItems: "center",
    marginBottom: 35,
  },
  bulletList: {
    gap: 22,
  },
  bulletRow: {
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
  },
  bulletText: {
    flex: 1,
  },
  bulletTitle: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter",
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 5,
  },
  bulletDesc: {
    fontSize: 13,
    fontFamily: "Inter",
    lineHeight: 22,
    color: COLORS.TEXT_SECONDARY,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  iconAmber: {
    backgroundColor: "rgba(254,243,199,0.9)",
  },
  iconBlue: {
    backgroundColor: "rgba(219,234,254,0.9)",
  },
  iconRed: {
    backgroundColor: "rgba(254,226,226,0.9)",
  },
  iconPurple: {
    backgroundColor: "rgba(237,233,254,0.9)",
  },
});
