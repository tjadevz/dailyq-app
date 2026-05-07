import React, { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
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
    const progress = recapData.totalDaysInMonth > 0
      ? Math.min(1, Math.max(0, recapData.daysAnswered / recapData.totalDaysInMonth))
      : 0;
    const monthWithYear = useMemo(() => {
      const parsed = new Date(`${recapData.previousMonthKey}T12:00:00`);
      if (!Number.isFinite(parsed.getTime())) return recapData.monthName;
      return new Intl.DateTimeFormat(lang === "nl" ? "nl-NL" : "en-US", {
        month: "long",
        year: "numeric",
      }).format(parsed);
    }, [recapData.monthName, recapData.previousMonthKey, lang]);
    const copy =
      lang === "nl"
        ? {
            header: "JOUW DAILYQ OVERZICHT",
            daysAnswered: "dagen beantwoord",
            totalAnswers: "in archief",
            wordsWritten: "woorden geschreven",
            longestStreak: "langste reeks",
            monthsActive: "actieve maanden",
            earliest: "vroegste antwoord",
            latest: "laatste antwoord",
          }
        : {
            header: "YOUR DAILYQ OVERVIEW",
            daysAnswered: "days answered",
            totalAnswers: "in archive",
            wordsWritten: "words written",
            longestStreak: "longest streak",
            monthsActive: "active months",
            earliest: "earliest answer",
            latest: "latest answer",
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
          <View style={styles.heroBlock}>
            <Text style={styles.heroEyebrow}>{copy.header}</Text>
            <Text style={styles.heroMonthName}>{monthWithYear}</Text>
          </View>

          <View style={styles.daysBlock}>
            <View style={styles.daysRow}>
              <Text style={styles.daysValue}>{recapData.daysAnswered}</Text>
              <Text style={styles.daysTotal}>/{recapData.totalDaysInMonth}</Text>
            </View>
            <Text style={styles.daysLabel}>{copy.daysAnswered}</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
          </View>

          <View style={styles.grid}>
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

            <View style={styles.tile}>
              <Text style={styles.tileValue}>{recapData.monthsActive}</Text>
              <Text style={styles.tileLabel}>{copy.monthsActive}</Text>
            </View>
          </View>

          <View style={styles.timeRow}>
            <View style={[styles.tile, styles.timeTile]}>
              <Text style={styles.tileValue}>{recapData.earliestAnswerTime}</Text>
              <Text style={styles.tileLabel}>{copy.earliest}</Text>
            </View>
            <View style={[styles.tile, styles.timeTile]}>
              <Text style={styles.tileValue}>{recapData.latestAnswerTime}</Text>
              <Text style={styles.tileLabel}>{copy.latest}</Text>
            </View>
          </View>
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
    backgroundColor: "#2A1A5E",
    paddingTop: 85,
    paddingBottom: 85,
    paddingHorizontal: 24,
  },
  heroBlock: {
    backgroundColor: "#7C3AED",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  heroEyebrow: {
    fontSize: 9,
    color: "rgba(255,255,255,0.6)",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 4,
    fontWeight: "500",
  },
  heroMonthName: {
    fontSize: 22,
    lineHeight: 22,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  daysBlock: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 6,
  },
  tile: {
    width: (375 - 48 - 6) / 2,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  timeRow: {
    flexDirection: "row",
    gap: 6,
  },
  timeTile: {
    flex: 1,
    width: undefined,
  },
  daysRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 4,
  },
  daysValue: {
    fontSize: 30,
    color: "#FFFFFF",
    fontWeight: "600",
    lineHeight: 34,
  },
  tileValue: {
    fontSize: 22,
    color: "#FFFFFF",
    fontWeight: "600",
    lineHeight: 26,
    marginBottom: 4,
  },
  daysTotal: {
    fontSize: 16,
    color: "rgba(255,255,255,0.35)",
    fontWeight: "500",
    marginLeft: 2,
  },
  daysLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.35)",
    fontWeight: "500",
  },
  progressTrack: {
    marginTop: 8,
    height: 3,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
  },
  progressFill: {
    height: 3,
    borderRadius: 999,
    backgroundColor: "#7C3AED",
  },
  tileLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.35)",
    fontWeight: "500",
  },
});
