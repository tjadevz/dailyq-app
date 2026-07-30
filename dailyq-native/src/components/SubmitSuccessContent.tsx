import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Animated, useWindowDimensions } from "react-native";
import { BlurView } from "expo-blur";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

import { useLanguage } from "@/src/context/LanguageContext";
import { MechanicalDigitRoll } from "@/src/components/MechanicalDigitRoll";

export interface SubmitSuccessContentProps {
  visible: boolean;
  /** Current streak to roll up to (e.g. real_streak/visual_streak max from get_user_streaks). */
  streak: number;
  /** Called once fully dismissed (auto-hide or tap) — parent should flip `visible` to false. */
  onDismiss: () => void;
}

/**
 * Post-submit celebration content: same purple blur as the answer modal it's
 * meant to sit on top of, plus a mechanical digit-roll counting up to the
 * current streak. Not a <Modal> itself — render it inside whichever native
 * <Modal> is already open (see AnsweringExperience's `celebration` prop) so
 * there's never a second native Modal racing with the first.
 * Tap anywhere to dismiss early. Auto-dismisses after a short hold — this
 * fires every single day, so it must stay quick.
 */
const CONTENT_DELAY_MS = 280;
const SPRING_SETTLE_MS = 350;
const ROLL_DURATION_MS = 650;
const HOLD_MS = 900;
const FADE_MS = 180;

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

export function SubmitSuccessContent({ visible, streak, onDismiss }: SubmitSuccessContentProps) {
  // Fabric doesn't reliably size flex:1/absoluteFillObject (right/bottom-based)
  // content inside <Modal> — needs explicit numeric width/height.
  const { width, height } = useWindowDimensions();
  const { lang, t } = useLanguage();
  const [messageIndex, setMessageIndex] = useState(0);

  const scale = useRef(new Animated.Value(0.5)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const popScale = useRef(new Animated.Value(1)).current;
  const msgOpacity = useRef(new Animated.Value(0)).current;
  const didAnimateRef = useRef(false);
  const dismissingRef = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [rendered, setRendered] = useState(false);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const dismissNow = () => {
    if (dismissingRef.current || !rendered) return;
    dismissingRef.current = true;
    clearTimers();
    Animated.timing(opacity, {
      toValue: 0,
      duration: FADE_MS,
      useNativeDriver: true,
    }).start(() => {
      setRendered(false);
      scale.setValue(0.5);
      opacity.setValue(0);
      popScale.setValue(1);
      msgOpacity.setValue(0);
      onDismiss();
    });
  };

  useEffect(() => {
    if (!visible) {
      didAnimateRef.current = false;
      return;
    }
    setRendered(true);
    if (didAnimateRef.current) return;
    didAnimateRef.current = true;
    dismissingRef.current = false;

    setMessageIndex(Math.floor(Math.random() * SAVE_MESSAGES_NL.length));
    scale.setValue(0.5);
    opacity.setValue(0);
    popScale.setValue(1);
    msgOpacity.setValue(0);

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
    }, CONTENT_DELAY_MS);
    timers.current.push(timer);

    return () => clearTimers();
  }, [visible, scale, opacity, popScale, msgOpacity]);

  const handleLanded = () => {
    if (dismissingRef.current) return;
    Animated.sequence([
      Animated.timing(popScale, { toValue: 1.08, duration: 110, useNativeDriver: true }),
      Animated.timing(popScale, { toValue: 1, duration: 110, useNativeDriver: true }),
    ]).start();
    Animated.timing(msgOpacity, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
    const holdTimer = setTimeout(dismissNow, HOLD_MS);
    timers.current.push(holdTimer);
  };

  if (!rendered) return null;

  const saveMessage = lang === "en" ? SAVE_MESSAGES_EN[messageIndex] : SAVE_MESSAGES_NL[messageIndex];

  return (
    <Pressable style={[styles.fullscreen, { width, height }]} onPress={dismissNow}>
      <BlurView
        intensity={40}
        tint="dark"
        style={{ position: "absolute", top: 0, left: 0, width, height }}
      />
      <View
        style={[styles.purpleOverlay, { position: "absolute", top: 0, left: 0, width, height }]}
      />
      <Animated.View style={[styles.contentColumn, { opacity, transform: [{ scale }] }]}>
        <MaterialCommunityIcons name="fire" size={15} color="#EF4444" style={styles.flame} />
        <Animated.View style={{ transform: [{ scale: popScale }] }}>
          <MechanicalDigitRoll
            visible={visible}
            value={streak}
            digitHeight={48}
            fontSize={40}
            rollDelayMs={CONTENT_DELAY_MS + SPRING_SETTLE_MS}
            rollDurationMs={ROLL_DURATION_MS}
            onLanded={handleLanded}
          />
        </Animated.View>
        <Text style={styles.numLabel}>{t("calendar_stats_day_streak")}</Text>
        <Animated.Text style={[styles.messageText, { opacity: msgOpacity }]}>
          {saveMessage}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fullscreen: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 50,
    elevation: 50,
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
  flame: {
    marginBottom: 6,
  },
  numLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 11,
    marginTop: 6,
    letterSpacing: 0.2,
  },
  messageText: {
    color: "#fff",
    fontSize: 15,
    marginTop: 18,
    textAlign: "center",
    letterSpacing: 0.2,
    fontWeight: "500",
  },
});
