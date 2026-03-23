import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Linking, PanResponder } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import Constants from "expo-constants";

import { COLORS, APP_VERSION } from "@/src/config/constants";
import { GlassCardContainer } from "@/src/components/GlassCardContainer";
import { useLanguage } from "@/src/context/LanguageContext";

const PRIVACY_POLICY_URL = "https://tjadevz.github.io/dailyq-legal/privacy-policy";
const TERMS_OF_SERVICE_URL = "https://tjadevz.github.io/dailyq-legal/terms-of-service";

export default function OverScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useLanguage();
  const appVersion = Constants.expoConfig?.version ?? APP_VERSION;
  const swipeBackResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          gestureState.dx > 14 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2,
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx > 70 && gestureState.vx > 0.15) {
            router.replace("/(tabs)/settings");
          }
        },
      }),
    [router]
  );

  return (
    <GlassCardContainer>
      <View
        style={[styles.container, { paddingTop: insets.top }]}
        {...swipeBackResponder.panHandlers}
      >
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.replace("/(tabs)/settings")}
            hitSlop={12}
          >
            <Feather name="chevron-left" size={24} color={COLORS.TEXT_PRIMARY} strokeWidth={2.5} />
          </Pressable>
          <Text style={styles.title}>{t("settings_about")}</Text>
          <View style={styles.backButton} />
        </View>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            style={styles.card}
            onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
          >
            <View style={styles.cardIconWrap}>
              <View style={[styles.cardIcon, styles.cardIconIndigo]}>
                <Feather name="file-text" size={16} strokeWidth={2} color="#6366F1" />
              </View>
              <View style={styles.cardTextWrap}>
                <Text style={styles.cardTitle}>{t("settings_privacy_policy")}</Text>
              </View>
              <Feather name="external-link" size={20} color={COLORS.TEXT_MUTED} />
            </View>
          </Pressable>

          <Pressable
            style={styles.card}
            onPress={() => Linking.openURL(TERMS_OF_SERVICE_URL)}
          >
            <View style={styles.cardIconWrap}>
              <View style={[styles.cardIcon, styles.cardIconBlue]}>
                <Feather name="file-text" size={16} strokeWidth={2} color="#3B82F6" />
              </View>
              <View style={styles.cardTextWrap}>
                <Text style={styles.cardTitle}>{t("settings_terms_of_service")}</Text>
              </View>
              <Feather name="external-link" size={20} color={COLORS.TEXT_MUTED} />
            </View>
          </Pressable>

          <View style={styles.card}>
            <View style={styles.cardIconWrap}>
              <View style={[styles.cardIcon, styles.cardIconPurple]}>
                <Feather name="info" size={16} strokeWidth={2} color={COLORS.ACCENT} />
              </View>
              <View style={styles.cardTextWrap}>
                <Text style={styles.cardTitle}>{t("settings_version")}</Text>
                <Text style={styles.cardSubtitle}>{appVersion}</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </GlassCardContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.TEXT_PRIMARY,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
    flexGrow: 1,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "rgba(255,254,249,0.65)",
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2,
  },
  cardIconWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  cardIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cardIconPurple: { backgroundColor: "rgba(237,233,254,0.7)" },
  cardIconBlue: { backgroundColor: "rgba(219,234,254,0.7)" },
  cardIconIndigo: { backgroundColor: "rgba(224,231,255,0.7)" },
  cardTextWrap: { flex: 1, minWidth: 0 },
  cardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 1,
  },
  cardSubtitle: {
    fontSize: 13,
    color: COLORS.TEXT_SECONDARY,
  },
});
