import React, { forwardRef } from "react";
import { StyleSheet, Text, View } from "react-native";

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
      <View style={styles.card}>
        <Text style={styles.brandText}>DAILYQ</Text>
        <View style={styles.spacer} />
        <View>
          <Text style={styles.questionText}>{question}</Text>
          <Text style={styles.answerText}>{answer}</Text>
          <Text style={styles.dateText}>{dateLabel}</Text>
        </View>
        <View style={styles.spacer} />
      </View>
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
    backgroundColor: "#251560",
    paddingHorizontal: 48,
    paddingVertical: 52,
  },

  brandText: {
    fontSize: 11,
    fontWeight: "500",
    color: "rgba(196,181,253,0.8)",
    letterSpacing: 2,
    textTransform: "uppercase",
  },

  spacer: {
    flex: 1,
  },

  questionText: {
    fontSize: 14,
    color: "rgba(196,181,253,0.75)",
    lineHeight: 21,
    fontStyle: "italic",
    marginBottom: 12,
  },

  answerText: {
    fontSize: 21,
    fontWeight: "600",
    color: "#FFFFFF",
    lineHeight: 30,
  },

  dateText: {
    fontSize: 11,
    color: "rgba(196,181,253,0.45)",
    marginTop: 28,
    marginBottom: 28,
  },
});

