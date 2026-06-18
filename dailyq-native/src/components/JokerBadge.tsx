import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
/** Joker count badge: gradient gold, white crown and count. */
export function JokerBadge({
  count,
  onPress,
  scale = 1,
}: {
  count: number;
  onPress: () => void;
  scale?: number;
}) {
  const content = (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.9, transform: [{ scale: 0.93 }] }]}>
      <LinearGradient
        colors={["#FFD84D", "#F5B800"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.badge}
      >
        <View style={styles.crownCircle}>
          <MaterialCommunityIcons
            name="crown"
            size={14}
            color="#F5B800"
            style={styles.crownIcon}
          />
        </View>
        <Text style={styles.count}>{count}</Text>
      </LinearGradient>
    </Pressable>
  );
  if (scale !== 1) {
    return <View style={{ transform: [{ scale }] }}>{content}</View>;
  }
  return content;
}

// ~10% smaller than original (20→18, 15→14, 17→15, 7→6, 14→13)
const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 13,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: "rgba(245,184,0,0.4)",
  },
  crownCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  crownIcon: {},
  count: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
