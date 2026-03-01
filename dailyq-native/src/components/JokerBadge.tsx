import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { JOKER } from "@/src/config/constants";

/** Crown in 16×16 white circle; PWA match: stroke #FBBF24, fill #FDE68A */
export function JokerBadge({
  count,
  onPress,
}: {
  count: number;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.9 }]}>
      <LinearGradient
        colors={["#FEF3C7", "#FDE68A", "#FBBF24"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.badge}
      >
        <View style={styles.crownCircle}>
          <MaterialCommunityIcons
            name="crown"
            size={10}
            color="#FBBF24"
            style={styles.crownIcon}
          />
        </View>
        <Text style={styles.count}>{count}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.4)",
  },
  crownCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  crownIcon: {
    // MaterialCommunityIcons crown: use color for stroke; fill may need to be set via icon theme if supported
  },
  count: {
    fontSize: 14,
    fontWeight: "700",
    color: JOKER.TEXT,
  },
});
