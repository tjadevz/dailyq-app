import React, { forwardRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export interface ShareCardProps {
  question: string;
  answer: string;
  dateLabel: string; // e.g. "Apr 3, 2026"
}

/**
 * Share card for capture via react-native-view-shot. Mount on-screen (e.g. inside a
 * short-lived Modal) so gradients lay out with a valid colorspace on iOS.
 */
const ShareCard = forwardRef<View, ShareCardProps>(function ShareCard(
  { question, answer, dateLabel },
  ref
) {
  return (
    <View ref={ref} style={styles.captureRoot} pointerEvents="none" collapsable={false}>
      <LinearGradient
        colors={["#A78BFA", "#7C3AED"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {/* Top */}
        <View>
          <Text style={styles.brandText}>DailyQ</Text>
        </View>

        {/* Middle */}
        <View style={styles.middle}>
          <Text style={styles.sectionLabel}>TODAY&apos;S QUESTION</Text>
          <Text style={styles.questionText}>{question}</Text>

          <View style={styles.answerBox}>
            <Text style={styles.answerText}>{answer}</Text>
          </View>
        </View>

        {/* Bottom */}
        <View style={styles.bottomRow}>
          <Text style={styles.dateText}>{dateLabel}</Text>
          <Text style={styles.domainText}>dailyqapp.com</Text>
        </View>
      </LinearGradient>
    </View>
  );
});

export default ShareCard;

const styles = StyleSheet.create({
  captureRoot: {
    width: 375,
    height: 667,
  },
  card: {
    flex: 1,
    width: 375,
    height: 667,
    padding: 48,
    justifyContent: "space-between",
  },

  brandText: {
    fontSize: 13,
    fontWeight: "500",
    fontFamily: "Inter",
    color: "rgba(255,255,255,0.6)",
    letterSpacing: 2,
  },

  middle: {
    flexShrink: 1,
  },

  sectionLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
    fontFamily: "Inter",
    letterSpacing: 1.5,
    marginBottom: 8,
  },

  questionText: {
    fontSize: 22,
    fontWeight: "500",
    fontFamily: "Inter",
    color: "#fff",
    lineHeight: 22 * 1.4,
    marginBottom: 24,
  },

  answerBox: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 16,
    padding: 20,
  },

  answerText: {
    fontSize: 16,
    color: "rgba(255,255,255,0.9)",
    fontFamily: "Inter",
    lineHeight: 16 * 1.6,
  },

  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },

  dateText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
    fontFamily: "Inter",
  },

  domainText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
    fontFamily: "Inter",
  },
});

