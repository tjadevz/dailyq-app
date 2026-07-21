import React from "react";
import { View, Text, StyleSheet } from "react-native";

import { useLanguage } from "@/src/context/LanguageContext";

/** Shared "what the widget looks like on your home screen" preview, used by the onboarding step and the Today announcement card. */
export function WidgetPreviewMockup({ size = "large" }: { size?: "large" | "compact" }) {
  const { t } = useLanguage();
  const compact = size === "compact";

  return (
    <View
      style={[
        styles.phoneFrame,
        compact ? styles.phoneFrameCompact : styles.phoneFrameLarge,
      ]}
    >
      <View style={[styles.widgetCard, compact && styles.widgetCardCompact]}>
        <Text style={[styles.widgetLabel, compact && styles.widgetLabelCompact]}>
          DAILYQ
        </Text>
        <Text
          style={[styles.widgetQuestion, compact && styles.widgetQuestionCompact]}
          numberOfLines={compact ? 2 : 3}
        >
          {t("onboarding_widget_preview_question")}
        </Text>
      </View>
      {!compact && (
        <View style={styles.homeIconsRow}>
          <View style={styles.homeIcon} />
          <View style={styles.homeIcon} />
          <View style={styles.homeIcon} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  phoneFrame: {
    borderRadius: 32,
    backgroundColor: "rgba(139,92,246,0.08)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.15)",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  phoneFrameLarge: {
    width: "100%",
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 16,
  },
  phoneFrameCompact: {
    width: "100%",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 20,
  },
  widgetCard: {
    width: "100%",
    borderRadius: 20,
    backgroundColor: "#1E1040",
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  widgetCardCompact: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  widgetLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.2,
    color: "#C4B5FD",
    marginBottom: 10,
  },
  widgetLabelCompact: {
    fontSize: 9,
    marginBottom: 6,
  },
  widgetQuestion: {
    fontSize: 16,
    color: "#fff",
    lineHeight: 22,
  },
  widgetQuestionCompact: {
    fontSize: 13,
    lineHeight: 18,
  },
  homeIconsRow: {
    flexDirection: "row",
    gap: 16,
  },
  homeIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(139,92,246,0.12)",
  },
});
