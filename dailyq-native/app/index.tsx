import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Redirect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";

import { useAuth } from "@/src/context/AuthContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { COLORS } from "@/src/config/constants";

// #region agent log
function logIndex(id: string, message: string, data: Record<string, unknown>) {
  fetch("http://127.0.0.1:7243/ingest/8b229217-1871-4da8-8258-2778d0f3e809", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "332a30" },
    body: JSON.stringify({ sessionId: "332a30", runId: "run1", hypothesisId: id, location: "index.tsx", message, data, timestamp: Date.now() }),
  }).catch(() => {});
}
// #endregion

function LoadingDots() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  const dots = [dot1, dot2, dot3];

  useEffect(() => {
    const loops = [
      Animated.loop(
        Animated.sequence([
          Animated.timing(dot1, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(dot1, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.delay(200),
          Animated.timing(dot2, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(dot2, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.delay(400),
          Animated.timing(dot3, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(dot3, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      ),
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [dot1, dot2, dot3]);

  return (
    <View style={loadingScreenStyles.dotsWrap}>
      {dots.map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            loadingScreenStyles.dot,
            {
              opacity: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.5, 1],
              }),
              transform: [
                {
                  scale: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.3],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

function PostLoginLoadingScreen() {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const scale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [opacity, scale]);

  return (
    <View style={[loadingScreenStyles.screen, { paddingTop: insets.top }]}>
      <View style={loadingScreenStyles.card}>
        <Animated.View
          style={[
            loadingScreenStyles.content,
            {
              opacity,
              transform: [{ scale }],
            },
          ]}
        >
          <View style={loadingScreenStyles.logoWrap}>
            <View style={loadingScreenStyles.logoIcon}>
              <Feather name="sun" size={44} color={COLORS.ACCENT} strokeWidth={2} />
            </View>
            <Text style={loadingScreenStyles.logoTitle}>DailyQ</Text>
            <Text style={loadingScreenStyles.tagline}>{t("loading_screen_tagline")}</Text>
          </View>
          <LoadingDots />
        </Animated.View>
      </View>
    </View>
  );
}

export default function Index() {
  const { user, authCheckDone } = useAuth();
  // #region agent log
  logIndex("H1", "Index render", { authCheckDone, hasUser: !!user });
  // #endregion

  if (!authCheckDone) {
    return <PostLoginLoadingScreen />;
  }

  if (user) {
    return <Redirect href="/(tabs)/today" />;
  }

  return <Redirect href="/(auth)/onboarding" />;
}

const loadingScreenStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "transparent",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  card: {
    flex: 1,
    borderRadius: 32,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.5)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 32,
    elevation: 4,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  content: {
    alignItems: "center",
    maxWidth: 280,
  },
  logoWrap: {
    alignItems: "center",
    marginBottom: 32,
  },
  logoIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(139,92,246,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  logoTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    color: COLORS.TEXT_MUTED,
    fontWeight: "500",
    letterSpacing: 0.25,
    textAlign: "center",
    marginTop: 12,
  },
  dotsWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "rgba(139,92,246,0.6)",
  },
});
