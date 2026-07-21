import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, Image, StyleSheet, Animated } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { COLORS } from "@/src/config/constants";
import { useLanguage } from "@/src/context/LanguageContext";
import { WidgetPreviewMockup } from "@/src/components/WidgetPreviewMockup";

function StepTransitionView({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(40)).current;
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 320,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: 0,
          duration: 320,
          useNativeDriver: true,
        }),
      ]).start();
    });
    return () => cancelAnimationFrame(id);
  }, [opacity, translateX]);
  return (
    <Animated.View style={[style, { opacity, transform: [{ translateX }] }]}>
      {children}
    </Animated.View>
  );
}

function OnboardingPrimaryButton({
  onPress,
  disabled,
  children,
}: {
  onPress: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const gradientColors = disabled ? ["#9CA3AF", "#9CA3AF"] : ["#7C3AED", "#6D28D9"];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primaryButtonWrap,
        pressed && !disabled && styles.primaryButtonPressed,
      ]}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[
          styles.primaryButtonGradient,
          !disabled && { shadowColor: "rgba(124,58,237,0.35)" },
        ]}
      >
        {children}
      </LinearGradient>
    </Pressable>
  );
}

export function OnboardingWidgetStep({
  onAddWidget,
  continuing = false,
}: {
  onAddWidget: () => void | Promise<void>;
  continuing?: boolean;
}) {
  const { t } = useLanguage();
  const [submitting, setSubmitting] = useState(false);

  const handleAddWidget = useCallback(async () => {
    if (submitting || continuing) return;
    setSubmitting(true);
    try {
      await onAddWidget();
    } finally {
      setSubmitting(false);
    }
  }, [onAddWidget, submitting, continuing]);

  const disabled = submitting || continuing;

  return (
    <StepTransitionView style={styles.step}>
      <View style={styles.contentWrapper}>
        <View style={styles.header}>
          <Image
            source={require("@/assets/images/logo.nobg.png")}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.title}>{t("onboarding_widget_title")}</Text>
        </View>

        <WidgetPreviewMockup size="large" />

        <Text style={styles.hintText}>{t("onboarding_widget_hint")}</Text>

        <View style={styles.actionsWrap}>
          <OnboardingPrimaryButton onPress={() => void handleAddWidget()} disabled={disabled}>
            <Text style={styles.primaryButtonText}>
              {submitting || continuing ? "…" : t("onboarding_widget_add_button")}
            </Text>
          </OnboardingPrimaryButton>
        </View>
      </View>
    </StepTransitionView>
  );
}

const styles = StyleSheet.create({
  step: {
    flex: 1,
    width: "100%",
  },
  contentWrapper: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: "center",
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    gap: 32,
  },
  header: {
    alignItems: "center",
  },
  logoImage: {
    width: 80,
    height: 80,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    color: COLORS.TEXT_PRIMARY,
    textAlign: "center",
  },
  actionsWrap: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 300,
  },
  primaryButtonWrap: {
    width: "100%",
    marginTop: 0,
  },
  primaryButtonGradient: {
    paddingHorizontal: 40,
    paddingVertical: 18,
    minHeight: 56,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 1,
    shadowRadius: 56,
    elevation: 8,
  },
  primaryButtonPressed: {
    opacity: 0.9,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  hintText: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.TEXT_PRIMARY,
    textAlign: "center",
    lineHeight: 20,
  },
});
