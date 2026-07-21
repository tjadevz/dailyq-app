import React, { useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Animated,
  useWindowDimensions,
} from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

import { COLORS, JOKER, MODAL, MODAL_CLOSE_MS, MODAL_ENTER_MS } from "@/src/config/constants";
import { useLanguage } from "@/src/context/LanguageContext";

export function OnboardingRewardModal({
  visible,
  onLetsGo,
}: {
  visible: boolean;
  onLetsGo: () => void;
}) {
  // Fabric doesn't reliably size flex:1/absoluteFillObject (right/bottom-based)
  // content inside <Modal> — needs explicit numeric width/height.
  const { width, height } = useWindowDimensions();
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
      <Animated.View style={[styles.wrapper, { width, height, opacity }]}>
        <BlurView
          intensity={40}
          tint="dark"
          style={{ position: "absolute", top: 0, left: 0, width, height }}
        />
        <View style={[styles.backdrop, { width, height }]} />
        <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
          <View style={styles.iconRow}>
            <View style={styles.iconWrap}>
              <View style={styles.iconRing} />
              <LinearGradient
                colors={["#FDE68A", "#FBBF24"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.iconCircle}
              >
                <MaterialCommunityIcons name="crown" size={32} color="#FFFFFF" />
              </LinearGradient>
            </View>
          </View>
          <Text style={styles.title}>{t("onboarding_reward_title")}</Text>
          <Text style={styles.subtitle}>{t("onboarding_reward_subtitle")}</Text>
          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <LinearGradient
              colors={["#FDE68A", "#FBBF24"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
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
    right: undefined,
    bottom: undefined,
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    backgroundColor: "rgba(76, 29, 149, 0.25)",
  },
  card: {
    ...MODAL.CARD,
    alignItems: "center",
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
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
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 28,
    textAlign: "center",
  },
  button: {
    borderRadius: 9999,
    overflow: "hidden",
    minWidth: 190,
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 6,
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonGradient: {
    minHeight: 56,
    paddingVertical: 16,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9999,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
