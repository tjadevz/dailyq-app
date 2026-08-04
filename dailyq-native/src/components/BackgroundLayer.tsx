/**
 * Dynamic background: gold glow top-right, lavender wash bottom.
 *
 * SVG Filter/FeGaussianBlur and SVG RadialGradient are broken on RN 0.85
 * new architecture (Fabric), so everything uses expo-linear-gradient.
 * Colors matched from original pre-SDK56 implementation.
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

type BackgroundLayerProps = {
  style?: any;
  /** "bottom" mutes the top-right gold glow so containers anchored to the bottom of the
   * screen (e.g. bottom-sheet modals) read as the lower/purple half of the full-screen
   * background instead of re-rendering the yellow top glow at their own top edge. */
  variant?: "full" | "bottom";
};

export function BackgroundLayer({ style, variant = "full" }: BackgroundLayerProps = {}) {
  const topGlowMultiplier = variant === "bottom" ? 0.3 : 1;
  return (
    <View style={[styles.container, style]} pointerEvents="none">
      {/* Gold glow – diagonal from top-right */}
      <LinearGradient
        colors={[
          `rgba(253,230,138,${0.4 * topGlowMultiplier})`,
          `rgba(254,240,138,${0.2 * topGlowMultiplier})`,
          "rgba(254,240,138,0)",
        ]}
        locations={[0, 0.35, 0.7]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.2, y: 0.6 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Purple glow – diagonal from bottom-left */}
      <LinearGradient
        colors={[
          "rgba(216,180,254,0.40)",
          "rgba(233,213,255,0.30)",
          "rgba(233,213,255,0)",
        ]}
        locations={[0, 0.35, 0.7]}
        start={{ x: 0, y: 1 }}
        end={{ x: 0.8, y: 0.3 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Silk back – strong lavender wash bottom half */}
      <LinearGradient
        colors={[
          "rgba(221,214,254,0)",
          "rgba(221,214,254,0)",
          "rgba(221,214,254,0.45)",
          "rgba(196,181,253,0.10)",
        ]}
        locations={[0, 0.35, 0.7, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Silk front – soft purple top region */}
      <LinearGradient
        colors={[
          "rgba(233,213,255,0.27)",
          "rgba(221,214,254,0.07)",
          "rgba(221,214,254,0)",
        ]}
        locations={[0, 0.3, 0.5]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.8, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Top-right purple accent */}
      <LinearGradient
        colors={[
          "rgba(167,139,250,0.16)",
          "rgba(167,139,250,0)",
        ]}
        start={{ x: 0.8, y: 0 }}
        end={{ x: 0.4, y: 0.3 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Subtle overall purple tint */}
      <View
        style={[StyleSheet.absoluteFill, styles.purpleOverlay]}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#FAFAFF",
    overflow: "hidden",
  },
  purpleOverlay: {
    backgroundColor: "rgba(76, 29, 149, 0.02)",
  },
});
