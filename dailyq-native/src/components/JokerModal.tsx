import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Modal, Pressable, Animated } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { COLORS, JOKER, MODAL, MODAL_CLOSE_MS } from "@/src/config/constants";

const JOKER_GOLD_BG = "#FDE68A";
/** Lighter gold for the joker count number (echt goud) */
const JOKER_NUMBER_GOLD = "#D97706";
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

  useEffect(() => {
    if (visible) {
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    } else {
      Animated.timing(opacity, { toValue: 0, duration: MODAL_CLOSE_MS, useNativeDriver: true }).start();
    }
  }, [visible, opacity]);

  if (!visible) return null;

  const isSingular = jokerBalance === 1;
  const before = isSingular ? t("joker_modal_body_singular_before") : t("joker_modal_body_before");
  const after = isSingular ? t("joker_modal_body_singular_after") : t("joker_modal_body_after");

  return (
    <Modal transparent visible={visible} animationType="none">
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <Pressable style={MODAL.CLOSE_BUTTON} onPress={onClose}>
            <Feather name="x" size={18} color={COLORS.TEXT_SECONDARY} strokeWidth={2.5} />
          </Pressable>
          <View style={styles.iconRow}>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons
                name="crown"
                size={24}
                color="#FFFFFF"
              />
            </View>
          </View>
          <Text style={styles.body}>
            {before}
            <Text style={styles.bodyNumber}>{jokerBalance}</Text>
            {after}
          </Text>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    ...MODAL.CARD,
    minWidth: 300,
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: JOKER_GOLD_BG,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.5)",
  },
  body: {
    fontSize: 15,
    color: JOKER_BODY_TEXT,
    lineHeight: 22,
    textAlign: "center",
  },
  bodyNumber: {
    fontWeight: "800",
    color: JOKER_NUMBER_GOLD,
  },
});
