import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Animated,
  Easing,
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
  onUseJoker: () => void;
}

function parseDayKey(dayKey: string | null): { dayNum: number; monthStr: string } | null {
  if (!dayKey) return null;
  const date = new Date(dayKey + "T12:00:00");
  if (isNaN(date.getTime())) return null;
  return {
    dayNum: date.getDate(),
    monthStr: date.toLocaleString("en-US", { month: "long" }).toUpperCase(),
  };
}

export default function JokerOfferModal({
  visible,
  dayKey,
  jokerCount,
  onClose,
  onUseJoker,
}: JokerOfferModalProps) {
  const { t, lang } = useLanguage();
  const [questionText, setQuestionText] = useState("");
  const [questionLoading, setQuestionLoading] = useState(false);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.9)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardY = useRef(new Animated.Value(20)).current;
  const glowScale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.3)).current;

  const parsed = useMemo(() => parseDayKey(dayKey), [dayKey]);

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
          duration: 200,
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

      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(glowScale, {
              toValue: 1.12,
              duration: 1250,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(glowOpacity, {
              toValue: 0.6,
              duration: 1250,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(glowScale, {
              toValue: 1,
              duration: 1250,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(glowOpacity, {
              toValue: 0.3,
              duration: 1250,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
        ])
      ).start();
    } else {
      backdropOpacity.setValue(0);
      cardScale.setValue(0.9);
      cardOpacity.setValue(0);
      cardY.setValue(20);
    }
  }, [visible, backdropOpacity, cardScale, cardOpacity, cardY, glowScale, glowOpacity]);

  if (!visible || !dayKey || parsed == null) return null;

  const { dayNum, monthStr } = parsed;

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
          <BlurView
            intensity={18}
            tint="dark"
            style={[
              StyleSheet.absoluteFillObject,
              { backgroundColor: "rgba(0,0,0,0.4)" },
            ]}
          />
        </Animated.View>
      </TouchableWithoutFeedback>

      <View style={styles.centeredView} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.cardWrapper,
            {
              opacity: cardOpacity,
              transform: [{ scale: cardScale }, { translateY: cardY }],
            },
          ]}
        >
          <View style={styles.glowBorder} />
          <View style={styles.card}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="x" size={18} color="#6B7280" strokeWidth={2.5} />
            </TouchableOpacity>

            <View style={styles.badgeRow}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {monthStr} {dayNum}
                </Text>
              </View>
            </View>

            <View style={styles.iconWrapper}>
              <Animated.View
                style={[
                  styles.glowCircle,
                  { opacity: glowOpacity, transform: [{ scale: glowScale }] },
                ]}
              />
              <LinearGradient
                colors={["#FDE68A", "#FBBF24", "#F59E0B"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.iconTile}
              >
                <MaterialCommunityIcons
                  name="crown"
                  size={40}
                  color="#FFFFFF"
                />
              </LinearGradient>
            </View>

            <View style={styles.paperStack}>
              <View style={[styles.paperLayer, styles.paperLayerBack]} />
              <View style={[styles.paperLayer, styles.paperLayerMid]} />
              <View style={styles.paperLayerFront}>
                {questionLoading ? (
                  <ActivityIndicator size="small" color="#6D28D9" />
                ) : (
                  <Text style={styles.questionText}>
                    {questionText || " "}
                  </Text>
                )}
              </View>
            </View>

            <TouchableOpacity
              onPress={() => {
                if (jokerCount > 0) onUseJoker();
              }}
              activeOpacity={0.88}
              style={[styles.ctaBtn, jokerCount === 0 && styles.ctaBtnDisabled]}
            >
              <LinearGradient
                colors={["#FCD34D", "#F59E0B"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.ctaText}>{t("joker_offer_cta")}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
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
    position: "relative",
  },
  glowBorder: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: 32,
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.97)",
    borderRadius: 32,
    padding: 36,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.22,
    shadowRadius: 40,
    elevation: 20,
  },
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.05)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  badgeRow: {
    alignItems: "center",
    marginBottom: 32,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(124,58,237,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
    color: "#6D28D9",
    fontFamily: Platform.OS === "ios" ? "System" : "sans-serif-medium",
  },
  iconWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
    height: 88,
  },
  glowCircle: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(251,191,36,0.5)",
  },
  iconTile: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#B45309",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 10,
  },
  paperStack: {
    marginBottom: 40,
    position: "relative",
  },
  paperLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  paperLayerBack: {
    transform: [{ translateY: 7 }, { translateX: 5 }],
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  paperLayerMid: {
    transform: [{ translateY: 3.5 }, { translateX: 2.5 }],
    backgroundColor: "rgba(255,255,255,0.75)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  paperLayerFront: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(209,213,219,0.5)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 5,
  },
  questionText: {
    fontSize: 19,
    lineHeight: 27.5,
    color: "#1F2937",
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "System" : "sans-serif",
    fontWeight: "400",
  },
  ctaBtn: {
    width: "100%",
    paddingVertical: 18,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
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
    textShadowColor: "rgba(0,0,0,0.15)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
