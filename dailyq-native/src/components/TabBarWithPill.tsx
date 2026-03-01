import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Animated, type LayoutChangeEvent } from "react-native";

const ACTIVE_COLOR = "#7C3AED";
const INACTIVE_COLOR = "#6B7280";

type TabBarProps = {
  state: { index: number; routes: { name: string; key: string }[] };
  descriptors: Record<string, { options: { tabBarLabel?: string; tabBarIcon?: (props: { focused: boolean; color: string; size: number }) => React.ReactNode } }>;
  navigation: { emit: (args: { type: string; target: string }) => { defaultPrevented: boolean }; navigate: (name: string) => void };
};

export function TabBarWithPill({ state, descriptors, navigation }: TabBarProps) {
  const [barWidth, setBarWidth] = useState(0);
  const pillX = useRef(new Animated.Value(0)).current;
  const indexRef = useRef(-1);

  const visibleRoutes = state.routes.filter(r => r.name !== "index");
  const visibleIndex = visibleRoutes.findIndex(r => r.key === state.routes[state.index]?.key);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w <= 0) return;
    setBarWidth(w);
    const segW = w / visibleRoutes.length;
    pillX.setValue(visibleIndex * segW + 8);
    indexRef.current = visibleIndex;
  };

  useEffect(() => {
    if (barWidth <= 0) return;
    const segW = barWidth / visibleRoutes.length;
    const toValue = visibleIndex * segW + 8;
    if (indexRef.current !== visibleIndex) {
      Animated.spring(pillX, { toValue, useNativeDriver: true, speed: 20, bounciness: 8 }).start();
      indexRef.current = visibleIndex;
    }
  }, [visibleIndex, barWidth]);

  const pillWidth = barWidth > 0 ? barWidth / visibleRoutes.length - 16 : 80;

  return (
    <View style={styles.outer}>
      <View style={styles.container} onLayout={onLayout}>
        <Animated.View
          style={[
            styles.pill,
            { width: pillWidth, transform: [{ translateX: pillX }] },
          ]}
        />
        {visibleRoutes.map((route, index) => {
          const { options } = descriptors[route.key] ?? {};
          const isFocused = visibleIndex === index;
          const label = options?.tabBarLabel ?? route.name;
          const icon = options?.tabBarIcon?.({ focused: isFocused, color: isFocused ? ACTIVE_COLOR : INACTIVE_COLOR, size: 24 });
          return (
            <Pressable
              key={route.key}
              style={styles.tab}
              onPress={() => {
                const event = navigation.emit({ type: "tabPress", target: route.key });
                if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              accessibilityRole="button"
            >
              {icon}
              <Text style={[styles.label, { color: isFocused ? ACTIVE_COLOR : INACTIVE_COLOR, fontWeight: isFocused ? "600" : "500" }]} numberOfLines={1}>
                {typeof label === "string" ? label : route.name}
              </Text>
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
    height: 72,
  },
  container: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.55)",
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.85)",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    overflow: "hidden",
    paddingHorizontal: 0,
  },
  pill: {
    position: "absolute",
    left: 0,
    top: 8,
    bottom: 8,
    borderRadius: 9999,
    backgroundColor: "rgba(255,255,255,0.75)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.95)",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    zIndex: 1,
  },
  label: {
    fontSize: 10,
    marginTop: 3,
  },
});
