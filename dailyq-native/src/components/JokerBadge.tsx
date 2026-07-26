import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { JOKER } from "@/src/config/constants";
/** Joker count badge: light gold pill, matches the app's calmer light-card style. */
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
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.badge, pressed && { opacity: 0.7 }]}
    >
      <MaterialCommunityIcons name="crown" size={16} color={JOKER.TEXT} />
      <Text style={styles.count}>{count}</Text>
    </Pressable>
  );
  if (scale !== 1) {
    return <View style={{ transform: [{ scale }] }}>{content}</View>;
  }
  return content;
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "rgba(240,192,64,0.1)",
    borderWidth: 1,
    borderColor: "rgba(240,192,64,0.25)",
  },
  count: {
    fontSize: 15,
    fontWeight: "800",
    color: JOKER.TEXT,
  },
});
