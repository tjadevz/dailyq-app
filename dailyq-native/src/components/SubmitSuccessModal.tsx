import React, { useEffect, useRef, useState } from "react";
import { View, Text, Modal, StyleSheet, Animated, useWindowDimensions } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Feather from "@expo/vector-icons/Feather";

import { useLanguage } from "@/src/context/LanguageContext";

export interface SubmitSuccessModalProps {
  visible: boolean;
}

/**
 * Fullscreen confirmation overlay: same purple blur as answer modals + yellow
 * checkmark with bouncy spring (option D). Use after submitting an answer
 * (new, edited, or with joker).
 */
const CHECK_DELAY_MS = 280;

const SAVE_MESSAGES_NL = [
  "Opgeslagen in jouw archief.",
  "Bewaard. Over een jaar lees je dit terug.",
  "Toegevoegd aan jouw archief.",
  "Klaar voor vandaag.",
  "Weer een dag van jou vastgelegd.",
  "Klaar. Morgen een nieuwe vraag.",
];

const SAVE_MESSAGES_EN = [
  "Saved to your archive.",
  "Stored. You'll read this back in a year.",
  "Added to your archive.",
  "Done for today.",
  "Another day of you, saved.",
  "Done. A new question tomorrow.",
];

export function SubmitSuccessModal({ visible }: SubmitSuccessModalProps) {
  // Fabric doesn't reliably size flex:1/absoluteFillObject (right/bottom-based)
  // content inside <Modal> — needs explicit numeric width/height.
  const { width, height } = useWindowDimensions();
  const { lang } = useLanguage();
  const [messageIndex] = useState(() =>
    Math.floor(Math.random() * SAVE_MESSAGES_NL.length)
  );
  const saveMessage =
    lang === "en"
      ? SAVE_MESSAGES_EN[messageIndex]
      : SAVE_MESSAGES_NL[messageIndex];

  const scale = useRef(new Animated.Value(0.5)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const didAnimateRef = useRef(false);
  const [rendered, setRendered] = useState(visible);

  useEffect(() => {
    if (!visible) {
      didAnimateRef.current = false;
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(() => {
        setRendered(false);
        // Reset so the next open does not paint one frame at opacity 1 / scale 1 before useEffect runs.
        scale.setValue(0.5);
        opacity.setValue(0);
      });
      return;
    }
    setRendered(true);
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
      visible={rendered}
      animationType="none"
      statusBarTranslucent
    >
      <View style={[styles.fullscreen, { width, height }]} pointerEvents="none">
        <BlurView
          intensity={40}
          tint="dark"
          style={{ position: "absolute", top: 0, left: 0, width, height }}
        />
        <View
          style={[styles.purpleOverlay, { position: "absolute", top: 0, left: 0, width, height }]}
        />
        <Animated.View
          style={[styles.contentColumn, { opacity, transform: [{ scale }] }]}
        >
          <LinearGradient
            colors={["#FEF3C7", "#FACC15", "#FCD34D"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.checkCircle}
          >
            <Feather name="check" size={40} color="#fff" strokeWidth={2.5} />
          </LinearGradient>
          <Text style={styles.messageText}>{saveMessage}</Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fullscreen: {
    position: "absolute",
    top: 0,
    left: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  purpleOverlay: {
    backgroundColor: "rgba(76, 29, 149, 0.25)",
  },
  contentColumn: {
    zIndex: 1,
    alignItems: "center",
    maxWidth: "88%",
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
  messageText: {
    color: "#fff",
    fontSize: 19,
    marginTop: 24,
    textAlign: "center",
    letterSpacing: 0.3,
    fontWeight: "500",
  },
});
