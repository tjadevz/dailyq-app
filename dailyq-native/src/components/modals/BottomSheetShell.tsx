import React, { useCallback, useEffect, useMemo } from "react";
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { BlurView } from "expo-blur";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import AnimatedReanimated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { GlassCardContainer } from "@/src/components/GlassCardContainer";

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Pan-to-dismiss gesture. Disable while an in-flight action (e.g. a purchase) shouldn't be interrupted by an accidental swipe. */
  draggable?: boolean;
  /** Sheet height as a fraction of window height. Matches the bottom-sheet pattern used by ViewAnswerModal in calendar.tsx. */
  heightRatio?: number;
  /** Function-as-children: call the passed handleClose (not onClose directly) so the exit animation plays before unmount. */
  children: (handleClose: () => void) => React.ReactNode;
};

export default function BottomSheetShell({
  visible,
  onClose,
  draggable = true,
  heightRatio = 0.78,
  children,
}: Props) {
  // Fabric doesn't reliably size flex:1/absoluteFillObject (right/bottom-based)
  // content inside <Modal> — needs explicit numeric width/height, and window
  // size must be read reactively (useWindowDimensions), not at module scope.
  const { width, height } = useWindowDimensions();
  const sheetHeight = height * heightRatio;
  const backdropOpacity = useSharedValue(0);
  const slideY = useSharedValue(sheetHeight);
  const dragY = useSharedValue(0);

  const closeModal = useCallback(() => onClose(), [onClose]);

  const handleClose = useCallback(() => {
    dragY.value = 0;
    backdropOpacity.value = withTiming(0, { duration: 180 });
    slideY.value = withTiming(
      sheetHeight,
      { duration: 220, easing: Easing.inOut(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(closeModal)();
      }
    );
  }, [closeModal, backdropOpacity, slideY, dragY, sheetHeight]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(draggable)
        .activeOffsetY(10)
        .onUpdate((e) => {
          if (e.translationY > 0) {
            dragY.value = e.translationY;
          }
        })
        .onEnd((e) => {
          const threshold = 120;
          const velocityThreshold = 400;
          const shouldDismiss = dragY.value > threshold || e.velocityY > velocityThreshold;
          if (shouldDismiss) {
            const currentY = slideY.value + dragY.value;
            slideY.value = currentY;
            dragY.value = 0;
            backdropOpacity.value = withTiming(0, { duration: 180 });
            slideY.value = withTiming(
              sheetHeight,
              { duration: 220, easing: Easing.inOut(Easing.cubic) },
              (finished) => {
                if (finished) runOnJS(closeModal)();
              }
            );
          } else {
            dragY.value = withSpring(0, { damping: 20, stiffness: 300 });
          }
        }),
    [draggable, backdropOpacity, slideY, dragY, closeModal, sheetHeight]
  );

  useEffect(() => {
    if (visible) {
      dragY.value = 0;
      slideY.value = sheetHeight;
      backdropOpacity.value = 0;
      slideY.value = withSpring(0, { damping: 22, stiffness: 140, mass: 0.8 });
      backdropOpacity.value = withTiming(1, { duration: 200 });
    }
  }, [visible, slideY, backdropOpacity, dragY, sheetHeight]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideY.value + dragY.value }],
  }));

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none">
      <GestureHandlerRootView style={{ width, height }}>
        <AnimatedReanimated.View style={[styles.modalBackdrop, { width, height }, backdropStyle]}>
          <BlurView
            intensity={40}
            tint="dark"
            style={{ position: "absolute", top: 0, left: 0, width, height }}
          />
          <View
            style={{ position: "absolute", top: 0, left: 0, width, height, backgroundColor: "rgba(76, 29, 149, 0.25)" }}
            pointerEvents="none"
          />
          <Pressable style={{ position: "absolute", top: 0, left: 0, width, height }} onPress={handleClose} />
          <GestureDetector gesture={panGesture}>
            <AnimatedReanimated.View
              style={[styles.sheet, sheetStyle, { width, height: sheetHeight }]}
              pointerEvents="box-none"
            >
              <GlassCardContainer>
                <View style={styles.handleWrap} pointerEvents="none">
                  <View style={styles.handle} />
                </View>
                <View style={styles.content} pointerEvents="box-none">
                  {children(handleClose)}
                </View>
              </GlassCardContainer>
            </AnimatedReanimated.View>
          </GestureDetector>
        </AnimatedReanimated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 0,
  },
  sheet: {
    position: "absolute",
    left: 0,
    bottom: 0,
    zIndex: 1,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: "hidden",
  },
  handleWrap: {
    paddingTop: 12,
    paddingBottom: 8,
    alignItems: "center",
    zIndex: 10,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "rgba(107, 114, 128, 0.35)",
  },
  content: {
    flex: 1,
  },
});
