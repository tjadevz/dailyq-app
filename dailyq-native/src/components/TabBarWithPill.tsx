/**
 * Custom tab bar with sliding pill indicator.
 * Container: rounded bar, absolute bottom. Pill behind active tab (no animation).
 */
import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, type LayoutChangeEvent } from "react-native";

const ACTIVE_COLOR = "#8B5CF6";
const INACTIVE_COLOR = "#9CA3AF";
const PILL_WIDTH = 56;
const PILL_HEIGHT = 56;

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

export function TabBarWithPill({ state, descriptors, navigation }: TabBarProps) {
  const [barWidth, setBarWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setBarWidth(w);
  };

  const tabWidth = barWidth / 3;
  const pillLeft = barWidth > 0
    ? state.index * tabWidth + (tabWidth - PILL_WIDTH) / 2
    : 0;

  const onTabPress = (route: { name: string; key: string }, isFocused: boolean) => {
    const event = navigation.emit({ type: "tabPress", target: route.key });
    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(route.name);
    }
  };

  return (
    <View style={styles.outer} onLayout={onLayout}>
      <View style={styles.container}>
        {/* Pill behind active tab */}
        <View
          style={[
            styles.pill,
            barWidth > 0 && { left: pillLeft },
          ]}
        />
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key] ?? {};
          const isFocused = state.index === index;
          const label = options?.tabBarLabel ?? route.name;
          const icon = options?.tabBarIcon?.({
            focused: isFocused,
            color: isFocused ? ACTIVE_COLOR : INACTIVE_COLOR,
            size: 22,
          });
          return (
            <Pressable
              key={route.key}
              style={styles.tab}
              onPress={() => onTabPress(route, isFocused)}
              accessibilityRole="button"
              accessibilityLabel={typeof label === "string" ? label : route.name}
            >
              {icon}
              <Text
                style={[
                  styles.label,
                  { color: isFocused ? ACTIVE_COLOR : INACTIVE_COLOR },
                ]}
                numberOfLines={1}
              >
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
    left: 0,
    right: 0,
    marginHorizontal: 16,
    marginBottom: 20,
    height: 72,
  },
  container: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 24,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    overflow: "hidden",
  },
  pill: {
    position: "absolute",
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    borderRadius: 16,
    backgroundColor: "rgba(243,244,246,0.8)",
    left: 0,
    top: (72 - PILL_HEIGHT) / 2,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    zIndex: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },
});
