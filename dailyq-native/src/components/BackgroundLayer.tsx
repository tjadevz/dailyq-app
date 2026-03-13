/**
 * Dynamic background from Figma: base glows (gold + purple), optional noise texture,
 * and flowing silk SVG waves. Base #FAFAFF.
 */
import React from "react";
import {
  StyleSheet,
  View,
  useWindowDimensions,
  Platform,
} from "react-native";
import Svg, {
  Defs,
  RadialGradient as SvgRadialGradient,
  LinearGradient as SvgLinearGradient,
  Stop,
  Rect,
  Path,
  G,
  Filter,
  FeGaussianBlur,
} from "react-native-svg";
import { BlurView } from "expo-blur";

const BASE_BG = "#FAFAFF";

const NOISE_DATA_URL =
  'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")';

export function BackgroundLayer() {
  const { width, height } = useWindowDimensions();

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Base glows – golden top-right, purple bottom-left (soft radial gradients, multiply) */}
      <View style={[styles.layer, styles.glowWrap]} pointerEvents="none">
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${width} ${height}`}
          style={StyleSheet.absoluteFill}
          preserveAspectRatio="xMidYMid slice"
        >
          <Defs>
            <SvgRadialGradient
              id="glowGold"
              cx="110%"
              cy="-10%"
              r="80%"
              fx="110%"
              fy="-10%"
            >
              <Stop offset="0%" stopColor="#FDE68A" stopOpacity="0.4" />
              <Stop offset="50%" stopColor="#FEF08A" stopOpacity="0.2" />
              <Stop offset="100%" stopColor="#FEF08A" stopOpacity="0" />
            </SvgRadialGradient>
            <SvgRadialGradient
              id="glowPurple"
              cx="-10%"
              cy="110%"
              r="80%"
              fx="-10%"
              fy="110%"
            >
              <Stop offset="0%" stopColor="#D8B4FE" stopOpacity="0.4" />
              <Stop offset="50%" stopColor="#E9D5FF" stopOpacity="0.3" />
              <Stop offset="100%" stopColor="#E9D5FF" stopOpacity="0" />
            </SvgRadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#glowGold)" />
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#glowPurple)" />
        </Svg>
      </View>

      {/* Noise texture – web only (feTurbulence via data URL) */}
      {Platform.OS === "web" && (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.noiseLayer,
            // @ts-expect-error - backgroundImage for web only
            { backgroundImage: NOISE_DATA_URL, backgroundSize: "cover" },
          ]}
          pointerEvents="none"
        />
      )}

      {/* Flowing silk vectors – three paths with heavy blur, multiply */}
      <View style={[styles.layer, styles.silkWrap]} pointerEvents="none">
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 1000 1000"
          preserveAspectRatio="xMidYMid slice"
          style={[StyleSheet.absoluteFill, styles.silkSvg]}
        >
          <Defs>
            <SvgLinearGradient
              id="silkFront"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <Stop offset="0%" stopColor="#E9D5FF" stopOpacity="0.42" />
              <Stop offset="100%" stopColor="#DDD6FE" stopOpacity="0.1" />
            </SvgLinearGradient>
            <SvgLinearGradient
              id="silkMiddle"
              x1="100%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <Stop offset="0%" stopColor="#FEF08A" stopOpacity="0.08" />
              <Stop offset="100%" stopColor="#FDE68A" stopOpacity="0" />
            </SvgLinearGradient>
            <SvgLinearGradient
              id="silkBack"
              x1="0%"
              y1="100%"
              x2="100%"
              y2="0%"
            >
              <Stop offset="0%" stopColor="#DDD6FE" stopOpacity="0.7" />
              <Stop offset="100%" stopColor="#C4B5FD" stopOpacity="0.15" />
            </SvgLinearGradient>
            <Filter id="ultraSoftBlur" x="-20%" y="-20%" width="140%" height="140%">
              <FeGaussianBlur in="SourceGraphic" stdDeviation={40} />
            </Filter>
          </Defs>
          <G filter="url(#ultraSoftBlur)">
            <Path
              d="M 0 600 C 300 400 500 800 1000 400 L 1000 1000 L 0 1000 Z"
              fill="url(#silkBack)"
            />
            <Path
              d="M -100 700 C 100 550 300 800 500 900 L -100 900 Z"
              fill="url(#silkMiddle)"
            />
            <Path
              d="M 0 300 Q 350 150 600 400 T 1000 200 L 1000 0 L 0 0 Z"
              fill="url(#silkFront)"
            />
            <Path
              d="M 400 0 C 600 50 750 -30 900 100 L 900 0 Z"
              fill="#A78BFA"
              fillOpacity={0.25}
            />
          </G>
        </Svg>
      </View>

      {/* Optional very subtle purple overlay */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <BlurView intensity={4} tint="dark" style={StyleSheet.absoluteFill} />
        <View
          style={[StyleSheet.absoluteFill, styles.purpleOverlay]}
          pointerEvents="none"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BASE_BG,
    overflow: "hidden",
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
  },
  glowWrap: {
    mixBlendMode: "multiply",
  },
  noiseLayer: {
    opacity: 0.02,
    mixBlendMode: "overlay",
    zIndex: 10,
  },
  silkWrap: {
    opacity: 0.65,
    mixBlendMode: "multiply",
  },
  silkSvg: {
    transform: [{ scale: 1.1 }],
  },
  purpleOverlay: {
    backgroundColor: "rgba(76, 29, 149, 0.02)",
  },
});
