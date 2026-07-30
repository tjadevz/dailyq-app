import React, { useCallback, useEffect, useRef } from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

import { COLORS, MODAL, MODAL_CLOSE_MS, MODAL_ENTER_MS } from "@/src/config/constants";

type MissedDayModalProps = {
  visible: boolean;
  title: string;
  body: string;
  ctaLabel: string;
  onClose: () => void;
  onAnswer: () => void;
};

export default function MissedDayModal({
  visible,
  title,
  body,
  ctaLabel,
  onClose,
  onAnswer,
}: MissedDayModalProps) {
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

  const dismiss = useCallback(
    (action: () => void) => {
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
      ]).start(() => action());
    },
    [opacity, scale]
  );

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.backdrop, { width, height, opacity }]}>
        <BlurView
          intensity={40}
          tint="dark"
          style={{ position: "absolute", top: 0, left: 0, width, height }}
        />
        <View style={[styles.backdropOverlay, { width, height }]} />
        <Pressable
          style={{ position: "absolute", top: 0, left: 0, width, height }}
          onPress={() => dismiss(onClose)}
        />
        <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
          <Pressable style={MODAL.CLOSE_BUTTON} onPress={() => dismiss(onClose)} hitSlop={12}>
            <Feather name="x" size={18} color={COLORS.TEXT_SECONDARY} strokeWidth={2.5} />
          </Pressable>
          <View style={styles.iconRow}>
            <View style={styles.iconWrap}>
              <View style={styles.iconRing} />
              <Animated.View style={{ transform: [{ scale: iconScale }] }}>
                <LinearGradient
                  colors={["#C4B5FD", "#7C3AED"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.iconCircle}
                >
                  <Feather name="edit-3" size={26} color="#FFFFFF" strokeWidth={2} />
                </LinearGradient>
              </Animated.View>
            </View>
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
          <Pressable onPress={() => dismiss(onAnswer)} style={styles.ctaWrap}>
            <LinearGradient
              colors={["#FFD84D", "#FFC700"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.cta}
            >
              <MaterialCommunityIcons name="crown" size={16} color="#FFFFFF" style={styles.ctaIcon} />
              <Text style={styles.ctaText}>{ctaLabel}</Text>
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
    width: "90%",
    maxWidth: 420,
    paddingTop: 32,
    paddingBottom: 28,
    paddingHorizontal: 28,
    alignItems: "center",
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
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
    borderColor: "rgba(196,181,253,0.4)",
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.4)",
    shadowColor: "#5B21B6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  title: {
    fontSize: 20,
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
    marginBottom: 24,
  },
  ctaWrap: {
    alignSelf: "stretch",
    borderRadius: 9999,
    overflow: "hidden",
    shadowColor: "rgba(255,199,0,0.4)",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 4,
  },
  cta: {
    flexDirection: "row",
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaIcon: {
    marginTop: -1,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
