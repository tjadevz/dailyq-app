import React from "react";
import { View, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";

/**
 * Plain (non-Modal) cover for the screen it's rendered in, same look as
 * SubmitSuccessModal's own backdrop. AnsweringExperience keeps its native
 * <Modal> presented for the length of its own close animation, so opening
 * SubmitSuccessModal's native <Modal> too early gets it dismissed along with
 * the closing one — the fix is to wait. But that wait briefly exposes the
 * real screen underneath once AnsweringExperience's Modal actually unmounts.
 * This veil is *not* a Modal (so it can't race with anything, and isn't
 * subject to Fabric's Modal-root sizing bug — no useWindowDimensions needed,
 * it just fills its parent), and is shown for that gap so the handoff
 * between the two Modals is invisible. Render it as a direct sibling of the
 * screen's own top-level content so it covers the whole screen.
 */
export function AnswerTransitionVeil({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <View style={styles.fullscreen} pointerEvents="none">
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.purpleOverlay]} />
    </View>
  );
}

const styles = StyleSheet.create({
  fullscreen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    elevation: 999,
  },
  purpleOverlay: {
    backgroundColor: "rgba(76, 29, 149, 0.25)",
  },
});
