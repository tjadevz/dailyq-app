import React, { useCallback, useEffect, useRef } from "react";
import { ActivityIndicator, Animated, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

import { COLORS, JOKER, MODAL, MODAL_CLOSE_MS, MODAL_ENTER_MS } from "@/src/config/constants";

type WelcomeBackModalProps = {
  visible: boolean;
  title: string;
  body: string;
  ctaLabel: string;
  claiming: boolean;
  onClaim: () => void;
  onDismiss: () => void;
};

export default function WelcomeBackModal({
  visible,
  title,
  body,
  ctaLabel,
  claiming,
  onClaim,
  onDismiss,
}: WelcomeBackModalProps) {
  // Fabric doesn't reliably size flex:1/absoluteFillObject (right/bottom-based)
  // content inside <Modal> — needs explicit numeric width/height.
  const { width, height } = useWindowDimensions();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const iconScale = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    if (visible) {
      opacity.setValue(0);
      scale.setValue(0.9);
      iconScale.setValue(0.7);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: MODAL_ENTER_MS,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          damping: 14,
          stiffness: 180,
        }),
        Animated.spring(iconScale, {
          toValue: 1,
          useNativeDriver: true,
          damping: 10,
          stiffness: 210,
        }),
      ]).start();
    }
  }, [visible, opacity, scale, iconScale]);

  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: MODAL_CLOSE_MS,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.9,
        duration: MODAL_CLOSE_MS,
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss());
  }, [opacity, scale, onDismiss]);

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.backdrop, { width, height, opacity }]}>
        <BlurView
          intensity={40}
          tint="dark"
          style={{ position: "absolute", top: 0, left: 0, width, height }}
        />
        <View style={[styles.backdropOverlay, { width, height }]} />
        <Pressable style={{ position: "absolute", top: 0, left: 0, width, height }} onPress={dismiss} />
        <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
          <Pressable style={styles.closeButton} onPress={dismiss} hitSlop={12}>
            <MaterialCommunityIcons name="close" size={18} color={COLORS.TEXT_SECONDARY} />
          </Pressable>
          <View style={styles.iconRow}>
            <View style={styles.iconWrap}>
              <View style={styles.iconRing} />
              <Animated.View style={{ transform: [{ scale: iconScale }] }}>
                <LinearGradient
                  colors={["#FDE68A", "#FBBF24"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.iconCircle}
                >
                  <MaterialCommunityIcons name="crown" size={32} color="#FFFFFF" />
                </LinearGradient>
              </Animated.View>
            </View>
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
          <Pressable
            style={({ pressed }) => [styles.cta, (pressed || claiming) && styles.ctaPressed]}
            onPress={onClaim}
            disabled={claiming}
          >
            <LinearGradient
              colors={["#FCD34D", "#FBBF24"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGradient}
            >
              {claiming ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.ctaText}>{ctaLabel}</Text>
              )}
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...MODAL.WRAPPER,
    right: undefined,
    bottom: undefined,
    justifyContent: "center",
    alignItems: "center",
  },
  backdropOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    backgroundColor: "rgba(76, 29, 149, 0.25)",
  },
  card: {
    ...MODAL.CARD,
    width: "92%",
    maxWidth: 420,
    paddingTop: 30,
    paddingBottom: 30,
    paddingHorizontal: 28,
    alignItems: "center",
  },
  closeButton: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },
  iconWrap: {
    position: "relative",
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  iconRing: {
    position: "absolute",
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: JOKER.GOLD_RING,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(240,192,64,0.5)",
    shadowColor: "#B45309",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
    textAlign: "center",
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: COLORS.TEXT_SECONDARY,
    textAlign: "center",
    marginBottom: 28,
  },
  cta: {
    minWidth: 190,
    borderRadius: 9999,
    overflow: "hidden",
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 6,
  },
  ctaPressed: {
    opacity: 0.9,
  },
  ctaGradient: {
    minHeight: 56,
    paddingVertical: 16,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9999,
  },
  ctaText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
