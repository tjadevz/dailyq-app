/**
 * iOS-style glass tab bar with sliding pill indicator (matches PWA nav).
 * Originally used BlurView for frosted glass and Animated for the sliding pill.
 * BlurView has been removed for Expo Go compatibility; this component is no longer used.
 */
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
  Text,
  type LayoutChangeEvent,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ACTIVE_COLOR = "#7C3AED";
const INACTIVE_COLOR = "#4B5563";
const PILL_INSET = 7;
const BAR_HORIZONTAL_PADDING = 16;
const BAR_BOTTOM_PADDING = 24;

type TabBarProps = {
  state: { index: number; routes: { name: string; key: string }[] };
  descriptors: Record<
    string,
    {
      options: {
        tabBarLabel?: string;
        tabBarIcon?: (props: { focused: boolean; color: string; size: number }) => React.ReactNode;
      };
    }
  >;
  navigation: {
    emit: (args: { type: string; target: string }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
};

export function GlassTabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = useState(0);
  const pillTranslateX = useRef(new Animated.Value(0)).current;
  const indexRef = useRef(state.index);

  const visibleRoutes = state.routes.filter(r => r.name !== "index");
  const visibleIndex = visibleRoutes.findIndex(r => r.key === state.routes[state.index]?.key);

  const onBarLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w <= 0) return;
    setBarWidth(w);
    const segment = w / visibleRoutes.length;
    const left = visibleIndex * segment + 5;
    pillTranslateX.setValue(left);
    indexRef.current = visibleIndex;
  };

  useEffect(() => {
    if (barWidth <= 0) return;
    const segment = barWidth / visibleRoutes.length;
    const left = visibleIndex * segment + 5;
    if (indexRef.current !== visibleIndex) {
      Animated.spring(pillTranslateX, {
        toValue: left,
        useNativeDriver: true,
        speed: 24,
        bounciness: 10,
      }).start();
      indexRef.current = visibleIndex;
    }
  }, [state.index, barWidth, pillTranslateX, visibleRoutes.length, visibleIndex]);

  const onTabPress = (route: { name: string; key: string }, isFocused: boolean) => {
    const event = navigation.emit({ type: "tabPress", target: route.key });
    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(route.name);
    }
  };

  const bottomPadding = Math.max(PILL_INSET, insets.bottom);
  const pillW = barWidth > 0 ? barWidth / visibleRoutes.length - 10 : 80;

  const tabBarContent = (
    <View style={styles.barInner}>
      <Animated.View
        style={[
          styles.pill,
          Platform.OS !== "ios" && styles.pillFallback,
          { width: pillW, transform: [{ translateX: pillTranslateX }] },
        ]}
      />
      {visibleRoutes.map((route, index) => {
        const { options } = descriptors[route.key] ?? {};
        const isFocused = visibleRoutes[index]?.key === state.routes[state.index]?.key;
        const label = options?.tabBarLabel ?? route.name;
        const icon = options?.tabBarIcon?.({
          focused: isFocused,
          color: isFocused ? ACTIVE_COLOR : INACTIVE_COLOR,
          size: 24,
        });
        return (
          <Pressable
            key={route.key}
            style={styles.tabButton}
            onPress={() => onTabPress(route, isFocused)}
            accessibilityRole="button"
            accessibilityLabel={typeof label === "string" ? label : route.name}
          >
            {icon}
            <Text
              style={[styles.tabLabel, { color: isFocused ? ACTIVE_COLOR : INACTIVE_COLOR }]}
              numberOfLines={1}
            >
              {typeof label === "string" ? label : route.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View style={[styles.outer, { paddingBottom: BAR_BOTTOM_PADDING }]}>
      <View style={[styles.barWrap, { paddingBottom: bottomPadding }]} onLayout={onBarLayout}>
        {/* Fallback plain bar instead of BlurView to avoid Expo Go errors. */}
        <View style={styles.fallbackBar}>{tabBarContent}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    paddingHorizontal: BAR_HORIZONTAL_PADDING,
    paddingTop: 8,
    backgroundColor: "transparent",
  },
  barWrap: {
    paddingHorizontal: PILL_INSET,
    paddingTop: PILL_INSET,
    borderRadius: 9999,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 32,
    elevation: 8,
  },
  blurBar: {
    borderRadius: 9999,
    overflow: "hidden",
  },
  fallbackBar: {
    borderRadius: 9999,
    backgroundColor: "rgba(255,255,255,0.85)",
  },
  barInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    position: "relative",
    minHeight: 52,
  },
  pill: {
    position: "absolute",
    left: 5,
    top: PILL_INSET,
    bottom: PILL_INSET,
    borderRadius: 9999,
    backgroundColor: "rgba(255,255,255,0.6)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.9)",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 4,
  },
  pillFallback: {
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  tabButton: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 8,
    zIndex: 10,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "600",
  },
});
