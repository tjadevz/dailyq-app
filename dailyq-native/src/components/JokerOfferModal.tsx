import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  ActivityIndicator,
} from "react-native";
import { BlurView } from "expo-blur";
import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";
import { useLanguage } from "@/src/context/LanguageContext";
import { supabase } from "@/src/config/supabase";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const MODAL_WIDTH = SCREEN_WIDTH * 0.88;

interface JokerOfferModalProps {
  visible: boolean;
  dayKey: string | null;
  jokerCount: number;
  onClose: () => void;
  onUseJoker: (dayKey: string, questionText: string) => void;
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
}: JokerOfferModalProps) {
  const { t, lang, formatDate } = useLanguage();
  const [questionText, setQuestionText] = useState("");
  const [questionLoading, setQuestionLoading] = useState(false);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.9)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardY = useRef(new Animated.Value(20)).current;
  const dateObj = useMemo(() => parseDayKey(dayKey), [dayKey]);
  const dateLabel =
    dateObj != null
      ? formatDate(dateObj, { day: "numeric", month: "long" })
      : "";

  useEffect(() => {
    if (!visible || !dayKey) {
      setQuestionText("");
      return;
    }
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
  }, [visible, dayKey, lang]);

  useEffect(() => {
    if (visible) {
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
    } else {
      backdropOpacity.setValue(0);
      cardScale.setValue(0.9);
      cardOpacity.setValue(0);
      cardY.setValue(20);
    }
  }, [visible, backdropOpacity, cardScale, cardOpacity, cardY]);

  if (!visible || !dayKey || dateObj == null) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View
          style={[StyleSheet.absoluteFillObject, { opacity: backdropOpacity }]}
        >
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View
            style={[
              StyleSheet.absoluteFillObject,
              { backgroundColor: "rgba(76, 29, 149, 0.25)" },
            ]}
            pointerEvents="none"
          />
        </Animated.View>
      </TouchableWithoutFeedback>

      <View style={styles.centeredView} pointerEvents="box-none">
        <View>
          <Animated.View
            style={[
              styles.cardWrapper,
              {
                opacity: cardOpacity,
                transform: [{ scale: cardScale }, { translateY: cardY }],
              },
            ]}
          >
            <View style={styles.card}>
              {/* Header: amber "Missed Day" badge (left) + close (right) */}
              <View style={styles.headerRow}>
                <View style={styles.badge}>
                  <Feather
                    name="star"
                    size={14}
                    color="#D97706"
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

              {/* Date */}
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

              {/* Unlock CTA */}
              <View style={styles.ctaWrap}>
                <TouchableOpacity
                  onPress={() => {
                    if (jokerCount > 0 && dayKey) onUseJoker(dayKey, questionText);
                  }}
                  activeOpacity={0.88}
                  style={[styles.ctaBtn, jokerCount === 0 && styles.ctaBtnDisabled]}
                >
                <LinearGradient
                  colors={["#FCD34D", "#FBBF24"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
                  <MaterialCommunityIcons
                    name="crown"
                    size={16}
                    color="#FFFFFF"
                  />
                  <Text style={styles.ctaText}>{t("joker_offer_unlock")}</Text>
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
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cardWrapper: {
    width: MODAL_WIDTH,
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
    gap: 6,
    backgroundColor: "#FDE68A",
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
    color: "#D97706",
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
  ctaBtnDisabled: {
    opacity: 0.4,
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
