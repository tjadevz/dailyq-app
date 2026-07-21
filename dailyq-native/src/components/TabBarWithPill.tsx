import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Pressable, Animated, type LayoutChangeEvent } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

const ACTIVE_COLOR = "#7C3AED";
const INACTIVE_COLOR = "#6B7280";

const BAR_HEIGHT = 72;
const PILL_VERTICAL_MARGIN = 8;
const PILL_HORIZONTAL_MARGIN = 8;
const PILL_HEIGHT = BAR_HEIGHT - PILL_VERTICAL_MARGIN * 2;

export function TabBarWithPill({ state, descriptors, navigation }: BottomTabBarProps) {
  const [barWidth, setBarWidth] = useState(0);
  const pillX = useRef(new Animated.Value(0)).current;
  const indexRef = useRef(-1);

  const visibleRoutes = state.routes.filter(
    (r) =>
      r.name !== "index" &&
      r.name !== "onboarding-notifications" &&
      r.name !== "onboarding-questions"
  );
  const currentRouteName = state.routes[state.index]?.name;
  const visibleIndex = visibleRoutes.findIndex(r => r.key === state.routes[state.index]?.key);

  const segmentWidth = barWidth / visibleRoutes.length;
  const pillWidth = barWidth > 0 ? segmentWidth - PILL_HORIZONTAL_MARGIN * 2 : 0;
  const pillLeftFor = (index: number, seg: number) => index * seg + PILL_HORIZONTAL_MARGIN;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w <= 0) return;
    setBarWidth(w);
    const seg = w / visibleRoutes.length;
    pillX.setValue(pillLeftFor(visibleIndex, seg));
    indexRef.current = visibleIndex;
  };

  useEffect(() => {
    if (barWidth <= 0) return;
    if (indexRef.current === visibleIndex) return;
    Animated.spring(pillX, {
      toValue: pillLeftFor(visibleIndex, segmentWidth),
      useNativeDriver: true,
      speed: 20,
      bounciness: 8,
    }).start();
    indexRef.current = visibleIndex;
  }, [visibleIndex, barWidth]);

  if (currentRouteName === "onboarding-notifications" || currentRouteName === "onboarding-questions") {
    return null;
  }

  return (
    <View style={styles.outer}>
      <View style={[styles.container, styles.tabBarGlass]} onLayout={onLayout}>
        {barWidth > 0 && (
          <Animated.View
            style={[
              styles.pill,
              { width: pillWidth, transform: [{ translateX: pillX }] },
            ]}
          />
        )}
        {visibleRoutes.map((route, index) => {
          const { options } = descriptors[route.key] ?? {};
          const isFocused = visibleIndex === index;
          const icon = options?.tabBarIcon?.({
            focused: isFocused,
            color: isFocused ? ACTIVE_COLOR : INACTIVE_COLOR,
            size: 24,
          });
          return (
            <Pressable
              key={route.key}
              style={({ pressed }) => [
                styles.tab,
                pressed && { transform: [{ scale: 0.85 }], opacity: 0.7 },
              ]}
              onPress={() => {
                const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              accessibilityRole="button"
            >
              {icon}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: "absolute",
    bottom: 0,
    left: 16,
    right: 16,
    marginBottom: 24,
    height: BAR_HEIGHT,
  },
  container: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BAR_HEIGHT / 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  tabBarGlass: {
    backgroundColor: "rgba(255, 255, 255, 0.88)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.72)",
  },
  pill: {
    position: "absolute",
    left: 0,
    top: PILL_VERTICAL_MARGIN,
    height: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,1)",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
});
