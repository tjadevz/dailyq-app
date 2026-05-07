import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";

import type { RecapData } from "@/src/hooks/useMonthlyRecap";

export type MonthlyRecapShareCardProps = {
  recapData: RecapData;
  lang: string;
};

export type MonthlyRecapShareCardRef = {
  triggerShare: () => Promise<void>;
};

const MonthlyRecapShareCard = forwardRef<MonthlyRecapShareCardRef, MonthlyRecapShareCardProps>(
  function MonthlyRecapShareCard({ recapData, lang }, ref) {
    const captureViewRef = useRef<View | null>(null);
    const copy =
      lang === "nl"
        ? {
            eyebrow: "DIT WAS",
            daysAnswered: "dagen beantwoord",
            totalAnswers: "antwoorden in totaal",
            wordsWritten: "woorden geschreven",
            longestStreak: "langste reeks",
          }
        : {
            eyebrow: "THIS WAS",
            daysAnswered: "days answered",
            totalAnswers: "answers in total",
            wordsWritten: "words written",
            longestStreak: "longest streak",
          };

    useImperativeHandle(
      ref,
      () => ({
        triggerShare: async () => {
          if (!captureViewRef.current) return;
          try {
            const uri = await captureRef(captureViewRef, {
              format: "png",
              quality: 1,
            });
            const isAvailable = await Sharing.isAvailableAsync();
            if (!isAvailable) {
              console.warn("Sharing is not available on this device.");
              return;
            }
            await Sharing.shareAsync(uri, {
              mimeType: "image/png",
              dialogTitle: lang === "nl" ? "Deel je maand" : "Share your month",
              UTI: "public.png",
            });
          } catch (e) {
            console.error("Failed to share monthly recap card:", e);
          }
        },
      }),
      [lang]
    );

    return (
      <View ref={captureViewRef} style={styles.captureRoot} pointerEvents="none" collapsable={false}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>{copy.eyebrow}</Text>
          <Text style={styles.monthName}>{recapData.monthName}</Text>

          <View style={styles.grid}>
            <View style={styles.tile}>
              <View style={styles.daysRow}>
                <Text style={styles.tileValue}>{recapData.daysAnswered}</Text>
                <Text style={styles.daysTotal}>/{recapData.totalDaysInMonth}</Text>
              </View>
              <Text style={styles.tileLabel}>{copy.daysAnswered}</Text>
            </View>

            <View style={styles.tile}>
              <Text style={styles.tileValue}>{recapData.totalAnswers}</Text>
              <Text style={styles.tileLabel}>{copy.totalAnswers}</Text>
            </View>

            <View style={styles.tile}>
              <Text style={styles.tileValue}>{recapData.wordsWrittenThisMonth}</Text>
              <Text style={styles.tileLabel}>{copy.wordsWritten}</Text>
            </View>

            <View style={styles.tile}>
              <Text style={styles.tileValue}>{recapData.longestStreakThisMonth}</Text>
              <Text style={styles.tileLabel}>{copy.longestStreak}</Text>
            </View>
          </View>

          <View style={styles.spacer} />
          <Text style={styles.brand}>DailyQ</Text>
        </View>
      </View>
    );
  }
);

export default MonthlyRecapShareCard;

const styles = StyleSheet.create({
  captureRoot: {
    width: 375,
    height: 667,
  },
  card: {
    width: 375,
    height: 667,
    backgroundColor: "#1A1033",
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  eyebrow: {
    fontSize: 10,
    color: "rgba(255,255,255,0.35)",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 8,
    fontWeight: "500",
  },
  monthName: {
    fontSize: 42,
    lineHeight: 42,
    color: "#FFFFFF",
    fontWeight: "500",
    marginBottom: 32,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tile: {
    width: (375 - 64 - 8) / 2,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  daysRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 2,
  },
  tileValue: {
    fontSize: 24,
    color: "#FFFFFF",
    fontWeight: "500",
    lineHeight: 28,
    marginBottom: 4,
  },
  daysTotal: {
    fontSize: 14,
    color: "rgba(255,255,255,0.35)",
    fontWeight: "500",
    marginLeft: 2,
  },
  tileLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.35)",
    fontWeight: "500",
  },
  spacer: {
    flex: 1,
  },
  brand: {
    fontSize: 11,
    color: "rgba(255,255,255,0.2)",
    alignSelf: "center",
    fontWeight: "500",
  },
});
