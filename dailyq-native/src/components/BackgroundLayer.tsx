/**
 * Background: base + soft glow orbs (Figma).
 * Base: #F5F3FF (or COLORS.BACKGROUND). Orbs: circles, absolute, pointerEvents none.
 */
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useWindowDimensions } from "react-native";

const BASE_BG = "#F5F3FF";

export function BackgroundLayer() {
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    console.log("BackgroundLayer rendered");
  }, []);

  // Figma: Orb 1 top-left ~200x200 gold, 45deg; Orb 2 right center ~250x250 lavender; Orb 3 bottom-left ~200x200 pink/purple
  const orb1Size = 200;
  const orb2Size = 250;
  const orb3Size = 200;

  return (
    <View style={styles.container} pointerEvents="none">
      <LinearGradient
        colors={[BASE_BG, "#EEF2F7"]}
        style={StyleSheet.absoluteFill}
      />
      {/* Orb 1: top-left, gold gradient, 45deg */}
      <View
        style={[
          styles.orb,
          {
            top: -40,
            left: -40,
            width: orb1Size,
            height: orb1Size,
            borderRadius: 9999,
            transform: [{ rotate: "45deg" }],
          },
        ]}
      >
        <LinearGradient
          colors={["rgba(254,243,199,0.3)", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      {/* Orb 2: right center, lavender/purple */}
      <View
        style={[
          styles.orb,
          {
            top: height * 0.5 - orb2Size / 2,
            right: -orb2Size / 4,
            width: orb2Size,
            height: orb2Size,
            borderRadius: 9999,
          },
        ]}
      >
        <LinearGradient
          colors={["rgba(167,139,250,0.15)", "transparent"]}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 0, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      {/* Orb 3: bottom-left, pink/purple */}
      <View
        style={[
          styles.orb,
          {
            bottom: -20,
            left: -40,
            width: orb3Size,
            height: orb3Size,
            borderRadius: 9999,
          },
        ]}
      >
        <LinearGradient
          colors={["rgba(196,181,253,0.2)", "transparent"]}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    // DEBUG: red = verify BackgroundLayer renders; then change back to BASE_BG
    backgroundColor: "red",
  },
  orb: {
    position: "absolute",
    overflow: "hidden",
  },
});
