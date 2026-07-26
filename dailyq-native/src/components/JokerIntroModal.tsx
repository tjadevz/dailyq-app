import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Animated,
  Platform,
  useWindowDimensions,
} from "react-native";
import { BlurView } from "expo-blur";
import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";
import { useLanguage } from "@/src/context/LanguageContext";
import { JOKER } from "@/src/config/constants";

interface JokerIntroModalProps {
  visible: boolean;
  dayKey: string | null;
  onClose: () => void;
}

function parseDayKey(dayKey: string | null): Date | null {
  if (!dayKey) return null;
  const date = new Date(dayKey + "T12:00:00");
  if (isNaN(date.getTime())) return null;
  return date;
}

/**
 * One-time, contextual explainer: shown the very first time a user taps a
 * missed day within the joker window, then never again (caller marks
 * profiles.joker_intro_shown before rendering this — see calendar.tsx).
 */
export default function JokerIntroModal({ visible, dayKey, onClose }: JokerIntroModalProps) {
  const { width, height } = useWindowDimensions();
  const modalWidth = width * 0.88;
  const { t, formatDate } = useLanguage();
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.9)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardY = useRef(new Animated.Value(20)).current;
  const crownScale = useRef(new Animated.Value(0)).current;

  // Keep rendering (and keep the last real dayKey) while the exit animation
  // plays, even after the parent has already cleared its own state — tapping
  // close must update the parent immediately, never wait on an animation
  // callback, so the rest of the app is never gated behind a 200ms timer.
  const [rendered, setRendered] = useState(visible);
  const [lastDayKey, setLastDayKey] = useState(dayKey);

  useEffect(() => {
    if (dayKey) setLastDayKey(dayKey);
  }, [dayKey]);

  const dateObj = useMemo(() => parseDayKey(lastDayKey), [lastDayKey]);
  const dateLabel = dateObj != null ? formatDate(dateObj, { day: "numeric", month: "long" }) : "";

  useEffect(() => {
    if (visible) {
      setRendered(true);
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(cardScale, { toValue: 1, useNativeDriver: true, tension: 120, friction: 14 }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(cardY, { toValue: 0, useNativeDriver: true, tension: 120, friction: 14 }),
      ]).start();
      crownScale.setValue(0);
      Animated.spring(crownScale, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 180 }).start();
    } else if (rendered) {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(cardScale, { toValue: 0.9, duration: 180, useNativeDriver: true }),
        Animated.timing(cardY, { toValue: 20, duration: 180, useNativeDriver: true }),
      ]).start(() => setRendered(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!rendered || !lastDayKey || dateObj == null) return null;

  return (
    <Modal transparent visible={rendered} animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={{ position: "absolute", top: 0, left: 0, width, height, opacity: backdropOpacity }}>
          <BlurView intensity={40} tint="dark" style={{ position: "absolute", top: 0, left: 0, width, height }} />
          <View
            style={{ position: "absolute", top: 0, left: 0, width, height, backgroundColor: "rgba(76, 29, 149, 0.25)" }}
            pointerEvents="none"
          />
        </Animated.View>
      </TouchableWithoutFeedback>

      <View style={[styles.centeredView, { width, height }]} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.cardWrapper,
            {
              width: modalWidth,
              opacity: cardOpacity,
              transform: [{ scale: cardScale }, { translateY: cardY }],
            },
          ]}
        >
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <Animated.View style={[styles.crownCircle, { transform: [{ scale: crownScale }] }]}>
                <LinearGradient
                  colors={["#F5CC50", JOKER.GOLD]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <MaterialCommunityIcons name="crown" size={20} color="#FFFFFF" />
              </Animated.View>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="x" size={16} color="#6B7280" strokeWidth={2.5} />
              </TouchableOpacity>
            </View>

            <Text style={styles.title}>{t("joker_intro_title", { date: dateLabel })}</Text>
            <Text style={styles.body}>{t("joker_intro_body")}</Text>

            <TouchableOpacity onPress={onClose} activeOpacity={0.88} style={styles.ctaBtn}>
              <LinearGradient
                colors={["#F5CC50", JOKER.GOLD]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.ctaText}>{t("joker_intro_cta")}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  centeredView: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cardWrapper: {
    maxWidth: 420,
    borderRadius: 32,
    overflow: "hidden",
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 32,
    padding: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.25,
    shadowRadius: 48,
    elevation: 20,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  crownCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 10,
    letterSpacing: -0.3,
    fontFamily: Platform.OS === "ios" ? "System" : "sans-serif",
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: "#6B7280",
    marginBottom: 28,
  },
  ctaBtn: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 8,
  },
  ctaText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "System" : "sans-serif-medium",
    letterSpacing: 0.1,
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
