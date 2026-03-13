import React, { useEffect, useRef } from "react";
import { View, Modal, StyleSheet, Animated } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Feather from "@expo/vector-icons/Feather";

export interface SubmitSuccessModalProps {
  visible: boolean;
}

/**
 * Fullscreen confirmation overlay: same purple blur as answer modals + yellow
 * checkmark with bouncy spring (option D). Use after submitting an answer
 * (new, edited, or with joker).
 */
const CHECK_DELAY_MS = 280;

export function SubmitSuccessModal({ visible }: SubmitSuccessModalProps) {
  const scale = useRef(new Animated.Value(0.5)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const didAnimateRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      didAnimateRef.current = false;
      return;
    }
    if (didAnimateRef.current) return;
    didAnimateRef.current = true;

    scale.setValue(0.5);
    opacity.setValue(0);
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          friction: 6,
          tension: 100,
        }),
      ]).start();
    }, CHECK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [visible, scale, opacity]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
    >
      <View style={styles.fullscreen} pointerEvents="none">
        <BlurView
          intensity={40}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[StyleSheet.absoluteFill, styles.purpleOverlay]}
        />
        <Animated.View
          style={[styles.checkWrap, { opacity, transform: [{ scale }] }]}
        >
          <LinearGradient
            colors={["#FEF3C7", "#FDE68A", "#FCD34D"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.checkCircle}
          >
            <Feather name="check" size={40} color="#fff" strokeWidth={2.5} />
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fullscreen: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  purpleOverlay: {
    backgroundColor: "rgba(76, 29, 149, 0.25)",
  },
  checkWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.4)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#B45309",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
});
