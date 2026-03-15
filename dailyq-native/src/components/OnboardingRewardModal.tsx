import React, { useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Animated,
} from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

import { COLORS, MODAL, MODAL_CLOSE_MS, MODAL_ENTER_MS } from "@/src/config/constants";
import { useLanguage } from "@/src/context/LanguageContext";

export function OnboardingRewardModal({
  visible,
  onLetsGo,
}: {
  visible: boolean;
  onLetsGo: () => void;
}) {
  const { t } = useLanguage();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;

  const handleClose = useCallback(() => {
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
    ]).start(() => onLetsGo());
  }, [opacity, scale, onLetsGo]);

  useEffect(() => {
    if (visible) {
      opacity.setValue(0);
      scale.setValue(0.9);
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
      ]).start();
    }
  }, [visible, opacity, scale]);

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none">
      <Animated.View style={[styles.wrapper, { opacity }]}>
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.backdrop} />
        <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
          <View style={styles.iconWrap}>
            <MaterialCommunityIcons name="crown" size={48} color="#F59E0B" />
          </View>
          <Text style={styles.title}>{t("onboarding_reward_title")}</Text>
          <Text style={styles.subtitle}>{t("onboarding_reward_subtitle")}</Text>
          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <LinearGradient
              colors={["#FCD34D", "#F59E0B"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.buttonGradient}
            >
              <Text style={styles.buttonText}>{t("onboarding_reward_lets_go")}</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    ...MODAL.WRAPPER,
  },
  backdrop: {
    ...MODAL.BACKDROP,
  },
  card: {
    ...MODAL.CARD,
    alignItems: "center",
  },
  iconWrap: {
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 24,
    textAlign: "center",
  },
  button: {
    borderRadius: 14,
    overflow: "hidden",
    minWidth: 160,
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonGradient: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#92400E",
  },
});
