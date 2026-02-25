import React from "react";
import { View, Text, StyleSheet } from "react-native";

/**
 * Placeholder root after removing WebViewScreen (old wrapper approach).
 * Step 2 will wire up Expo Router + Auth/Language providers.
 */
export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>DailyQ</Text>
      <Text style={styles.subtitle}>Step 1 – Config ready</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F6F9",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
  },
});
