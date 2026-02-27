import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Modal, Pressable, Animated } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { COLORS, JOKER, MODAL, MODAL_CLOSE_MS } from "@/src/config/constants";

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

  const title =
    jokerBalance === 1 ? t("joker_modal_title_one") : t("joker_modal_title");
  const body =
    jokerBalance === 1
      ? t("joker_modal_body_singular")
      : t("joker_modal_body", { joker_balance: String(jokerBalance) });

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
                size={20}
                color={JOKER.TEXT}
              />
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeLabel}>{t("joker_modal_badge_label")}</Text>
              <Text style={styles.badgeCount}>{jokerBalance}</Text>
            </View>
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
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
    marginBottom: 12,
    gap: 10,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: JOKER.BACKGROUND,
    borderWidth: 1,
    borderColor: JOKER.BORDER,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 9999,
    backgroundColor: "rgba(254,243,199,0.9)",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.5)",
  },
  badgeLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.TEXT_SECONDARY,
    marginRight: 6,
  },
  badgeCount: {
    fontSize: 14,
    fontWeight: "700",
    color: JOKER.TEXT,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 22,
  },
});
