import React from "react";
import { Modal, StyleSheet, View } from "react-native";

/**
 * Host for on-demand share image capture: mounts ShareCard on-screen briefly
 * (avoids iOS LinearGradient issues with permanently off-screen views).
 */
export default function ShareCaptureModal({
  visible: open,
  children,
}: {
  visible: boolean;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <Modal visible={open} transparent animationType="none" statusBarTranslucent>
      <View style={styles.host} collapsable={false} pointerEvents="none">
        <View style={styles.captureHidden} collapsable={false}>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  // Near-invisible wrapper: opacity 0 often yields blank view-shot PNGs on iOS.
  captureHidden: {
    opacity: 0.02,
  },
});
