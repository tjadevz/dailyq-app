import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Modal, Pressable, Animated } from "react-native";
import { BlurView } from "expo-blur";
import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { COLORS, JOKER, MODAL, MODAL_CLOSE_MS } from "@/src/config/constants";

/** Body text: slightly darker than light gray */
const JOKER_BODY_TEXT = "#4B5563";

export function JokerModal({
  visible,
  onClose,
  jokerBalance,
  t,
}: {
  visible: boolean;
  onClose: () => void;
  jokerBalance: number;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const crownScale = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    } else {
      Animated.timing(opacity, { toValue: 0, duration: MODAL_CLOSE_MS, useNativeDriver: true }).start();
    }
  }, [visible, opacity]);

  useEffect(() => {
    if (visible) {
      crownScale.setValue(0);
      Animated.spring(crownScale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 14,
        stiffness: 180,
      }).start();
    } else {
      crownScale.setValue(0);
    }
  }, [visible, crownScale]);

  useEffect(() => {
    if (!visible) return;
    ringScale.setValue(1);
    ringOpacity.setValue(0.4);
    const duration = 1750;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(ringScale, {
            toValue: 1.5,
            duration,
            useNativeDriver: true,
          }),
          Animated.timing(ringOpacity, {
            toValue: 0,
            duration,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(ringScale, {
            toValue: 1,
            duration: 50,
            useNativeDriver: true,
          }),
          Animated.timing(ringOpacity, {
            toValue: 0.4,
            duration: 50,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible, ringScale, ringOpacity]);

  if (!visible) return null;

  const isSingular = jokerBalance === 1;
  const before = isSingular ? t("joker_modal_body_singular_before") : t("joker_modal_body_before");
  const after = isSingular ? t("joker_modal_body_singular_after") : t("joker_modal_body_after");

  return (
    <Modal transparent visible={visible} animationType="none">
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(76, 29, 149, 0.25)" }]}
          pointerEvents="none"
        />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <Pressable style={MODAL.CLOSE_BUTTON} onPress={onClose}>
            <Feather name="x" size={18} color={COLORS.TEXT_SECONDARY} strokeWidth={2.5} />
          </Pressable>
          <View style={styles.iconRow}>
            <View style={styles.iconWrap}>
              <Animated.View
                style={[
                  styles.pulseRing,
                  {
                    opacity: ringOpacity,
                    transform: [{ scale: ringScale }],
                  },
                ]}
              />
              <Animated.View style={[styles.iconCircle, { transform: [{ scale: crownScale }] }]}>
                <MaterialCommunityIcons
                  name="crown"
                  size={28}
                  color="#FFFFFF"
                />
              </Animated.View>
            </View>
          </View>
          <Text style={styles.title}>
            {before}
            <Text style={styles.bodyNumber}>{jokerBalance}</Text>
            {after}
          </Text>
          <Text style={styles.subtitle}>{t("joker_modal_subtitle")}</Text>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  card: {
    ...MODAL.CARD,
    width: "92%",
    maxWidth: 480,
    paddingVertical: 36,
    paddingHorizontal: 32,
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  iconWrap: {
    position: "relative",
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseRing: {
    position: "absolute",
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: JOKER.GOLD_RING,
    backgroundColor: "transparent",
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: JOKER.GOLD,
    borderWidth: 1,
    borderColor: "rgba(240,192,64,0.5)",
  },
  title: {
    fontSize: 19,
    color: JOKER_BODY_TEXT,
    lineHeight: 26,
    textAlign: "center",
    marginBottom: 24,
  },
  subtitle: {
    fontSize: 19,
    color: JOKER_BODY_TEXT,
    lineHeight: 26,
    textAlign: "center",
    marginHorizontal: -12,
  },
  bodyNumber: {
    fontWeight: "800",
    color: JOKER.GOLD,
  },
});
