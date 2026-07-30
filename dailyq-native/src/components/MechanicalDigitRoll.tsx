import React, { useEffect, useMemo, useRef } from "react";
import { View, Text, Animated, StyleSheet, Easing } from "react-native";

export interface MechanicalDigitRollProps {
  visible: boolean;
  value: number;
  digitHeight: number;
  fontSize: number;
  /** Delay after `visible` becomes true before the roll starts (lets the entrance spring settle first). */
  rollDelayMs: number;
  rollDurationMs: number;
  onLanded?: () => void;
}

/** How many extra 0-9 loops each digit spins through before landing, rightmost first. */
function loopsForDigit(indexFromRight: number, big: boolean): number {
  if (indexFromRight === 0) return big ? 7 : 3;
  if (indexFromRight === 1) return big ? 4 : 2;
  return big ? 2 : 1;
}

export function MechanicalDigitRoll({
  visible,
  value,
  digitHeight,
  fontSize,
  rollDelayMs,
  rollDurationMs,
  onLanded,
}: MechanicalDigitRollProps) {
  const digitsStr = String(Math.max(0, Math.round(value))).padStart(2, "0");
  const big = rollDurationMs >= 1000;

  // Rebuilt only when the digit count changes (e.g. streak 9 -> 10); reused across replays otherwise.
  const strips = useMemo(
    () => digitsStr.split("").map(() => new Animated.Value(0)),
    [digitsStr.length] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const didAnimateRef = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!visible) {
      didAnimateRef.current = false;
      timers.current.forEach(clearTimeout);
      timers.current = [];
      return;
    }
    if (didAnimateRef.current) return;
    didAnimateRef.current = true;

    strips.forEach((s) => s.setValue(0));

    const timer = setTimeout(() => {
      const digits = digitsStr.split("").map((d) => parseInt(d, 10));
      const total = digits.length;
      const anims = strips.map((strip, i) => {
        const indexFromRight = total - 1 - i;
        const loops = loopsForDigit(indexFromRight, big);
        const targetIndex = loops * 10 + digits[i];
        return Animated.timing(strip, {
          toValue: -targetIndex * digitHeight,
          duration: rollDurationMs,
          easing: Easing.bezier(0.13, 0.82, 0.16, 1),
          useNativeDriver: true,
        });
      });
      Animated.parallel(anims).start(() => {
        onLanded?.();
      });
    }, rollDelayMs);
    timers.current.push(timer);

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, digitsStr]);

  return (
    <View style={styles.row}>
      {digitsStr.split("").map((_, i) => {
        const indexFromRight = digitsStr.length - 1 - i;
        const loops = loopsForDigit(indexFromRight, big);
        const items = loops * 10 + 10;
        return (
          <View
            key={i}
            style={[styles.window, { width: fontSize * 0.62, height: digitHeight }]}
          >
            <Animated.View style={{ transform: [{ translateY: strips[i] }] }}>
              {Array.from({ length: items }).map((_v, n) => (
                <Text
                  key={n}
                  style={[
                    styles.digitText,
                    { height: digitHeight, lineHeight: digitHeight, fontSize },
                  ]}
                >
                  {n % 10}
                </Text>
              ))}
            </Animated.View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
  },
  window: {
    overflow: "hidden",
    alignItems: "center",
  },
  digitText: {
    textAlign: "center",
    fontWeight: "800",
    color: "#fff",
    fontVariant: ["tabular-nums"],
  },
});
