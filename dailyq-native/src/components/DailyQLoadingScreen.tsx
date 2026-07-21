import React, { useEffect } from "react";
import { Image, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { COLORS } from "@/src/config/constants";
import { BackgroundLayer } from "@/src/components/BackgroundLayer";

const LOGO_SIZE = 110;
const RING_SIZE = LOGO_SIZE + 56;
const RING_THICKNESS = 4;

function LoadingRing() {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 1100, easing: Easing.linear }),
      -1
    );
  }, [rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return <Animated.View style={[styles.ring, animatedStyle]} />;
}

export default function DailyQLoadingScreen() {
  // Fabric doesn't reliably size flex:1/absoluteFillObject (right/bottom-based)
  // full-bleed views — needs explicit numeric width/height.
  const { width, height } = useWindowDimensions();

  return (
    <View style={[styles.screen, { width, height }]}>
      <BackgroundLayer style={{ position: "absolute", top: 0, left: 0, right: undefined, bottom: undefined, width, height }} />
      <View style={[styles.center, { width, height }]}>
        <View style={styles.logoStack}>
          <LoadingRing />
          <Image
            source={require("@/assets/images/logo.nobg.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 9999,
    elevation: 9999,
    backgroundColor: "#FAFAFF",
  },
  center: {
    position: "absolute",
    top: 0,
    left: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  logoStack: {
    width: RING_SIZE,
    height: RING_SIZE,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
  ring: {
    position: "absolute",
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: RING_THICKNESS,
    borderColor: "rgba(139,92,246,0.15)",
    borderTopColor: COLORS.ACCENT,
  },
});
