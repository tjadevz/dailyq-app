/**
 * iOS 26-style bokeh glass bubbles (Figma); radial approximated with LinearGradient.
 * Base: #FAF9FF. No blur in Expo Go; LinearGradient only.
 */
import React from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const BASE_BG = "#FAF9FF";

const RADIAL_START = { x: 0.3, y: 0.3 };
const RADIAL_END = { x: 1, y: 1 };
const RADIAL_LOCATIONS: [number, number, number, number] = [0, 0.3, 0.6, 1];

export function BackgroundLayer() {
  const { width, height } = useWindowDimensions();

  return (
    <View style={styles.container} pointerEvents="none">
      <LinearGradient
        colors={[BASE_BG, "#F5F6FA"]}
        style={StyleSheet.absoluteFill}
      />

      {/* 1. Large Purple – top right: 320×320, blur 40 */}
      <View
        style={[
          styles.bubble,
          {
            top: 48,
            right: -64,
            width: 320,
            height: 320,
            borderRadius: 160,
            shadowColor: "#7C3AED",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.12,
            shadowRadius: 32,
            elevation: 4,
          },
        ]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={[
            "rgba(221,214,254,0.29)",
            "rgba(196,181,253,0.21)",
            "rgba(167,139,250,0.12)",
            "transparent",
          ]}
          start={RADIAL_START}
          end={RADIAL_END}
          locations={RADIAL_LOCATIONS}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* 2. Medium Golden – top left: 240×240, blur 35 */}
      <View
        style={[
          styles.bubble,
          {
            top: 80,
            left: -80,
            width: 240,
            height: 240,
            borderRadius: 120,
            shadowColor: "#F59E0B",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.1,
            shadowRadius: 28,
            elevation: 3,
          },
        ]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={[
            "rgba(253,230,138,0.26)",
            "rgba(252,211,77,0.19)",
            "rgba(251,191,36,0.11)",
            "transparent",
          ]}
          start={RADIAL_START}
          end={RADIAL_END}
          locations={RADIAL_LOCATIONS}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* 3. Large Blue – bottom left: 384×384, blur 45 */}
      <View
        style={[
          styles.bubble,
          {
            bottom: -96,
            left: -48,
            width: 384,
            height: 384,
            borderRadius: 192,
            shadowColor: "#3B82F6",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.08,
            shadowRadius: 36,
            elevation: 4,
          },
        ]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={[
            "rgba(199,210,254,0.26)",
            "rgba(147,197,253,0.19)",
            "rgba(96,165,250,0.11)",
            "transparent",
          ]}
          start={RADIAL_START}
          end={RADIAL_END}
          locations={RADIAL_LOCATIONS}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* 4. Medium Purple/Pink – center: 288×288, blur 38 */}
      <View
        style={[
          styles.bubble,
          {
            top: height * 0.33,
            left: width * 0.25,
            width: 288,
            height: 288,
            borderRadius: 144,
            shadowColor: "#7C3AED",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.1,
            shadowRadius: 30,
            elevation: 3,
          },
        ]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={[
            "rgba(233,213,255,0.25)",
            "rgba(216,180,254,0.18)",
            "rgba(167,139,250,0.1)",
            "transparent",
          ]}
          start={RADIAL_START}
          end={RADIAL_END}
          locations={RADIAL_LOCATIONS}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* 6. Medium Purple – bottom right: 256×256, blur 36 */}
      <View
        style={[
          styles.bubble,
          {
            bottom: -64,
            right: 32,
            width: 256,
            height: 256,
            borderRadius: 128,
            shadowColor: "#6D28D9",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.1,
            shadowRadius: 28,
            elevation: 3,
          },
        ]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={[
            "rgba(196,181,253,0.26)",
            "rgba(167,139,250,0.19)",
            "rgba(124,58,237,0.11)",
            "transparent",
          ]}
          start={RADIAL_START}
          end={RADIAL_END}
          locations={RADIAL_LOCATIONS}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* 7. Small Blue – middle right: 208×208, blur 34 */}
      <View
        style={[
          styles.bubble,
          {
            top: height * 0.5 - 104,
            right: -32,
            width: 208,
            height: 208,
            borderRadius: 104,
            shadowColor: "#3B82F6",
            shadowOffset: { width: 0, height: 5 },
            shadowOpacity: 0.09,
            shadowRadius: 26,
            elevation: 2,
          },
        ]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={[
            "rgba(191,219,254,0.26)",
            "rgba(147,197,253,0.19)",
            "rgba(59,130,246,0.1)",
            "transparent",
          ]}
          start={RADIAL_START}
          end={RADIAL_END}
          locations={RADIAL_LOCATIONS}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Ambient glow 1: E0E7FF/15 */}
      <View
        style={[
          styles.glow,
          { top: 80, right: 64, width: 224, height: 224, borderRadius: 112 },
        ]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={["rgba(224,231,255,0.075)", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Ambient glow 2: F3E8FF/12 */}
      <View
        style={[
          styles.glow,
          { bottom: -112, left: 48, width: 256, height: 256, borderRadius: 128 },
        ]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={["rgba(243,232,255,0.06)", "transparent"]}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Ambient glow 3: FAE8FF/10 */}
      <View
        style={[
          styles.glow,
          {
            top: height * 0.5 - 144,
            left: width * 0.66 - 144,
            width: 288,
            height: 288,
            borderRadius: 144,
          },
        ]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={["rgba(250,232,255,0.05)", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BASE_BG,
  },
  bubble: {
    position: "absolute",
    overflow: "hidden",
  },
  glow: {
    position: "absolute",
    overflow: "hidden",
  },
});
