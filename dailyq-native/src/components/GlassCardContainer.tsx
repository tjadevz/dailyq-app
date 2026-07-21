/**
 * Transparent card wrapper for tab screens. Content sits on top of root BackgroundLayer.
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import { BackgroundLayer } from "@/src/components/BackgroundLayer";

export function GlassCardContainer({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.card} pointerEvents="box-none">
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <BackgroundLayer style={{ position: "relative", flex: 1 }} />
      </View>
      <View style={styles.content} pointerEvents="box-none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
  },
  content: {
    flex: 1,
    zIndex: 10,
  },
});
