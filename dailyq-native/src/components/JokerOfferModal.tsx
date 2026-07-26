import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Animated,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { BlurView } from "expo-blur";
import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";
import { useLanguage } from "@/src/context/LanguageContext";
import { supabase } from "@/src/config/supabase";
import { COLORS, JOKER } from "@/src/config/constants";

interface JokerOfferModalProps {
  visible: boolean;
  dayKey: string | null;
  jokerCount: number;
  onClose: () => void;
  onUseJoker: (dayKey: string, questionText: string) => void;
  onNeedMoreJokers: () => void;
}

function parseDayKey(dayKey: string | null): Date | null {
  if (!dayKey) return null;
  const date = new Date(dayKey + "T12:00:00");
  if (isNaN(date.getTime())) return null;
  return date;
}

export default function JokerOfferModal({
  visible,
  dayKey,
  jokerCount,
  onClose,
  onUseJoker,
  onNeedMoreJokers,
}: JokerOfferModalProps) {
  // Fabric doesn't reliably size flex:1/absoluteFillObject (right/bottom-based)
  // content inside <Modal> — needs explicit numeric width/height.
  const { width, height } = useWindowDimensions();
  const modalWidth = width * 0.88;
  const { t, lang, formatDate } = useLanguage();
  const [questionText, setQuestionText] = useState("");
  const [questionLoading, setQuestionLoading] = useState(false);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.9)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardY = useRef(new Animated.Value(20)).current;
  const crownScale = useRef(new Animated.Value(0)).current;

  // Keep rendering (with the last real dayKey) while the exit animation plays,
  // even after the parent has already cleared its own state. Tapping close
  // must update the parent immediately, never wait on an animation callback,
  // so the rest of the app is never gated behind a 180ms timer.
  const [rendered, setRendered] = useState(visible);
  const [lastDayKey, setLastDayKey] = useState(dayKey);

  useEffect(() => {
    if (dayKey) setLastDayKey(dayKey);
  }, [dayKey]);

  const dateObj = useMemo(() => parseDayKey(lastDayKey), [lastDayKey]);
  const dateLabel =
    dateObj != null
      ? formatDate(dateObj, { day: "numeric", month: "long" })
      : "";

  useEffect(() => {
    // On close, dayKey goes null before the exit animation finishes — don't
    // wipe the question text, or the card would flash blank while fading out.
    if (!dayKey) return;
    let cancelled = false;
    setQuestionLoading(true);
    setQuestionText("");
    const tableName = lang === "en" ? "daily_questions_en" : "questions";
    const isEn = tableName === "daily_questions_en";
    const dateCol = isEn ? "question_date" : "day";
    const textCol = isEn ? "question_text" : "text";
    supabase
      .from(tableName)
      .select(textCol)
      .eq(dateCol, dayKey)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (cancelled) return;
        setQuestionLoading(false);
        if (err || !data) {
          setQuestionText("");
          return;
        }
        const row = data as { question_text?: string; text?: string };
        setQuestionText(
          textCol === "question_text" ? row.question_text ?? "" : row.text ?? ""
        );
      });
    return () => {
      cancelled = true;
    };
  }, [dayKey, lang]);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(cardScale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 120,
          friction: 14,
        }),
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(cardY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 120,
          friction: 14,
        }),
      ]).start();
      crownScale.setValue(0);
      Animated.spring(crownScale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 14,
        stiffness: 180,
      }).start();
    } else if (rendered) {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(cardScale, { toValue: 0.9, duration: 180, useNativeDriver: true }),
        Animated.timing(cardY, { toValue: 20, duration: 180, useNativeDriver: true }),
      ]).start(() => setRendered(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!rendered || !lastDayKey || dateObj == null) return null;

  return (
    <Modal
      transparent
      visible={rendered}
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View
          style={{ position: "absolute", top: 0, left: 0, width, height, opacity: backdropOpacity }}
        >
          <BlurView
            intensity={40}
            tint="dark"
            style={{ position: "absolute", top: 0, left: 0, width, height }}
          />
          <View
            style={{ position: "absolute", top: 0, left: 0, width, height, backgroundColor: "rgba(76, 29, 149, 0.25)" }}
            pointerEvents="none"
          />
        </Animated.View>
      </TouchableWithoutFeedback>

      <View style={[styles.centeredView, { width, height }]} pointerEvents="box-none">
        <View>
          <Animated.View
            style={[
              styles.cardWrapper,
              {
                width: modalWidth,
                opacity: cardOpacity,
                transform: [{ scale: cardScale }, { translateY: cardY }],
              },
            ]}
          >
            <View style={styles.card}>
              {/* Header: "Missed Day" badge (left) + close (right) */}
              <View style={styles.headerRow}>
                <View style={styles.badge}>
                  <Feather
                    name="star"
                    size={14}
                    color="#FFFFFF"
                    strokeWidth={2}
                  />
                  <Text style={styles.badgeText}>{t("joker_offer_badge")}</Text>
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.closeBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="x" size={16} color="#6B7280" strokeWidth={2.5} />
                </TouchableOpacity>
              </View>

              {/* Date: below badge, left-aligned */}
              <Text style={styles.dateLabel}>{dateLabel}</Text>

              {/* Question */}
              {questionLoading ? (
                <View style={styles.questionLoader}>
                  <ActivityIndicator size="small" color="#F59E0B" />
                </View>
              ) : (
                <Text style={styles.questionText}>
                  {questionText || " "}
                </Text>
              )}

              {/* CTA adapts to balance: use a joker, or go earn/buy one. */}
              <View style={styles.ctaWrap}>
                <TouchableOpacity
                  onPress={() => {
                    if (jokerCount > 0) {
                      if (lastDayKey) onUseJoker(lastDayKey, questionText);
                    } else {
                      onNeedMoreJokers();
                    }
                  }}
                  activeOpacity={0.88}
                  style={styles.ctaBtn}
                >
                  <LinearGradient
                    colors={jokerCount > 0 ? ["#F5CC50", JOKER.GOLD] : [COLORS.ACCENT_LIGHT, COLORS.ACCENT]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <Animated.View
                    style={{
                      transform: [{ scale: crownScale }],
                    }}
                  >
                    <MaterialCommunityIcons
                      name={jokerCount > 0 ? "crown" : "crown-outline"}
                      size={16}
                      color="#FFFFFF"
                    />
                  </Animated.View>
                  <Text style={styles.ctaText}>
                    {jokerCount > 0 ? t("joker_offer_unlock") : t("joker_offer_need_more")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  centeredView: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cardWrapper: {
    maxWidth: 420,
    borderRadius: 32,
    overflow: "hidden",
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 32,
    padding: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.25,
    shadowRadius: 48,
    elevation: 20,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    backgroundColor: JOKER.GOLD,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    color: "#FFFFFF",
    textTransform: "uppercase",
    fontFamily: Platform.OS === "ios" ? "System" : "sans-serif-medium",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  dateLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9CA3AF",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 12,
    alignSelf: "flex-start",
  },
  questionLoader: {
    minHeight: 32,
    marginBottom: 32,
    justifyContent: "center",
  },
  questionText: {
    fontSize: 23,
    lineHeight: 31,
    fontWeight: "500",
    color: "#111827",
    marginBottom: 32,
    letterSpacing: -0.5,
    fontFamily: Platform.OS === "ios" ? "System" : "sans-serif",
  },
  ctaWrap: {
    paddingTop: 8,
    marginTop: "auto",
  },
  ctaBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 8,
  },
  ctaText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "System" : "sans-serif-medium",
    letterSpacing: 0.1,
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
