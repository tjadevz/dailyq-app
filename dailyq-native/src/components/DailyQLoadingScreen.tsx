import React from "react";
import { ActivityIndicator, Image, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS } from "@/src/config/constants";
import { BackgroundLayer } from "@/src/components/BackgroundLayer";

const LOGO_SIZE = 110;

export default function DailyQLoadingScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <BackgroundLayer />
      <View style={styles.center}>
        <Image
          source={require("@/assets/images/logo.nobg.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <ActivityIndicator
          size="large"
          color={COLORS.ACCENT}
          style={styles.spinner}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    elevation: 9999,
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    marginBottom: 18,
  },
  spinner: {
    marginTop: 0,
  },
});

