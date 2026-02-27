import React from "react";
import { View, Text, Pressable, StyleSheet, ViewStyle, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const GRADIENT_COLORS = ["#A78BFA", "#8B5CF6"] as const;

export function PrimaryButton({
  onPress,
  disabled,
  loading,
  children,
  style,
  textStyle,
  fullWidth,
}: {
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  children: string;
  style?: ViewStyle;
  textStyle?: object;
  fullWidth?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        fullWidth && styles.fullWidth,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <LinearGradient
        colors={disabled ? ["#9CA3AF", "#9CA3AF"] : GRADIENT_COLORS}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.gradient, disabled && styles.gradientDisabled]}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={[styles.text, textStyle]}>{children}</Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fullWidth: {
    width: "100%",
  },
  pressed: {
    opacity: 0.9,
  },
  gradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 9999,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "rgba(139,92,246,0.3)",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 4,
  },
  gradientDisabled: {
    shadowOpacity: 0,
  },
  text: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
