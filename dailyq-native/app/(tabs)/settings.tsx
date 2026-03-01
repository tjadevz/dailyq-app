import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Animated,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";
import Feather from "@expo/vector-icons/Feather";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { COLORS, MODAL, MODAL_CLOSE_MS } from "@/src/config/constants";
import { GlassCardContainer } from "@/src/components/GlassCardContainer";
import { useLanguage } from "@/src/context/LanguageContext";
import { useAuth } from "@/src/context/AuthContext";
import type { Lang } from "@/src/i18n/translations";

const REMINDER_TIME_KEY = "dailyq-reminder-time";
type ReminderTime = "morning" | "afternoon" | "evening";

// ----- LanguageModal -----
function LanguageModal({
  visible,
  currentLang,
  onClose,
  onSelect,
}: {
  visible: boolean;
  currentLang: Lang;
  onClose: () => void;
  onSelect: (lang: Lang) => void;
}) {
  const { t } = useLanguage();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    } else {
      Animated.timing(opacity, { toValue: 0, duration: MODAL_CLOSE_MS, useNativeDriver: true }).start();
    }
  }, [visible, opacity]);

  if (!visible) return null;
  return (
    <Modal transparent visible={visible} animationType="none">
      <Animated.View style={[styles.modalBackdrop, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.modalCard}>
          <Pressable style={MODAL.CLOSE_BUTTON} onPress={onClose}>
            <Feather name="x" size={18} color={COLORS.TEXT_SECONDARY} strokeWidth={2.5} />
          </Pressable>
          <Text style={styles.modalTitle}>{t("settings_language")}</Text>
          <Pressable
            style={[styles.optionRow, currentLang === "en" && styles.optionRowSelected]}
            onPress={() => {
              onSelect("en");
              onClose();
            }}
          >
            <Text style={styles.optionText}>{t("settings_lang_en")}</Text>
            {currentLang === "en" && (
              <Feather name="check" size={20} color={COLORS.ACCENT} strokeWidth={2.5} />
            )}
          </Pressable>
          <Pressable
            style={[styles.optionRow, currentLang === "nl" && styles.optionRowSelected]}
            onPress={() => {
              onSelect("nl");
              onClose();
            }}
          >
            <Text style={styles.optionText}>{t("settings_lang_nl")}</Text>
            {currentLang === "nl" && (
              <Feather name="check" size={20} color={COLORS.ACCENT} strokeWidth={2.5} />
            )}
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

// ----- DeleteAccountModal -----
function DeleteAccountModal({
  visible,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const { t } = useLanguage();
  const [deleting, setDeleting] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    } else {
      Animated.timing(opacity, { toValue: 0, duration: MODAL_CLOSE_MS, useNativeDriver: true }).start();
    }
  }, [visible, opacity]);

  const handleConfirm = useCallback(async () => {
    setDeleting(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setDeleting(false);
    }
  }, [onConfirm, onClose]);

  if (!visible) return null;
  return (
    <Modal transparent visible={visible} animationType="none">
      <Animated.View style={[styles.modalBackdrop, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{t("settings_delete_account")}</Text>
          <Text style={styles.modalBody}>{t("settings_delete_confirm")}</Text>
          <View style={styles.modalActions}>
            <Pressable
              style={[styles.modalButton, styles.modalButtonSecondary]}
              onPress={onClose}
              disabled={deleting}
            >
              <Text style={styles.modalButtonSecondaryText}>{t("common_cancel")}</Text>
            </Pressable>
            <Pressable
              style={[styles.modalButton, styles.modalButtonDangerWrap]}
              onPress={handleConfirm}
              disabled={deleting}
            >
              <LinearGradient
                colors={["#DC2626", "#B91C1C"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.modalButton, styles.modalButtonDanger]}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalButtonPrimaryText}>{t("settings_delete_account")}</Text>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

function getReminderSubtitle(
  t: (key: string) => string,
  slot: ReminderTime | null
): string {
  if (!slot) return t("settings_reminder_time");
  if (slot === "morning") return t("onboarding_notif_morning_time");
  if (slot === "afternoon") return t("onboarding_notif_afternoon_time");
  return t("onboarding_notif_evening_time");
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { t, lang, setLang } = useLanguage();
  const { effectiveUser, signOut, deleteUser } = useAuth();
  const router = useRouter();

  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [reminderTime, setReminderTime] = useState<ReminderTime | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(REMINDER_TIME_KEY).then((value) => {
      if (value === "morning" || value === "afternoon" || value === "evening") {
        setReminderTime(value);
      } else {
        setReminderTime(null);
      }
    });
  }, []);

  const email = effectiveUser?.email ?? "";

  const appVersion =
    Constants.expoConfig?.version ?? Constants.manifest?.version ?? "1.0.0";

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.replace("/(auth)/onboarding");
  }, [signOut, router]);

  const handleDeleteAccount = useCallback(async () => {
    const { error } = await deleteUser();
    if (!error) {
      router.replace("/(auth)/onboarding");
    }
  }, [deleteUser, router]);

  const currentLangLabel = lang === "en" ? t("settings_lang_en") : t("settings_lang_nl");

  return (
    <GlassCardContainer>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>{t("settings_title")}</Text>

        {/* Reminder (read-only) */}
        <View style={[styles.card, styles.cardDisabled]}>
          <View style={styles.cardIconWrap}>
            <View style={[styles.cardIcon, styles.cardIconPurple]}>
              <Feather name="bell" size={16} strokeWidth={2} color={COLORS.ACCENT} />
            </View>
            <View style={styles.cardTextWrap}>
              <Text style={styles.cardTitle}>{t("settings_reminder")}</Text>
              <Text style={styles.cardSubtitle}>
                {getReminderSubtitle(t, reminderTime)}
              </Text>
            </View>
          </View>
        </View>

        {/* Language */}
        <Pressable style={styles.card} onPress={() => setLanguageModalVisible(true)}>
          <View style={styles.cardIconWrap}>
            <View style={[styles.cardIcon, styles.cardIconBlue]}>
              <Feather name="globe" size={16} strokeWidth={2} color="#3B82F6" />
            </View>
            <View style={styles.cardTextWrap}>
              <Text style={styles.cardTitle}>{t("settings_language")}</Text>
              <Text style={styles.cardSubtitle}>{currentLangLabel}</Text>
            </View>
            <Feather name="chevron-right" size={20} color={COLORS.TEXT_MUTED} />
          </View>
        </Pressable>

        {/* Signed in as */}
        <View style={styles.card}>
          <View style={styles.cardIconWrap}>
            <View style={[styles.cardIcon, styles.cardIconIndigo]}>
              <Feather name="mail" size={16} strokeWidth={2} color="#6366F1" />
            </View>
            <View style={[styles.cardTextWrap, styles.cardTextWrapFlex]}>
              <Text style={styles.cardTitle}>{t("settings_signed_in_as")}</Text>
              <Text style={styles.cardSubtitle} numberOfLines={1}>
                {email}
              </Text>
            </View>
          </View>
        </View>

        {/* Sign out: neutral card, TEXT_PRIMARY, no purple CTA */}
        <Pressable style={styles.card} onPress={handleSignOut}>
          <View style={styles.cardIconWrap}>
            <View style={[styles.cardIcon, styles.cardIconRed]}>
              <Feather name="log-out" size={16} strokeWidth={2} color="#DC2626" />
            </View>
            <View style={styles.cardTextWrap}>
              <Text style={styles.cardTitle}>{t("settings_sign_out")}</Text>
            </View>
          </View>
        </Pressable>

        {/* Delete account: card with red icon + red text, no full red button in list */}
        <Pressable style={styles.card} onPress={() => setDeleteModalVisible(true)}>
          <View style={styles.cardIconWrap}>
            <View style={[styles.cardIcon, styles.cardIconRedDark]}>
              <Feather name="trash-2" size={16} strokeWidth={2} color="#B91C1C" />
            </View>
            <View style={styles.cardTextWrap}>
              <Text style={styles.cardTitleDanger}>{t("settings_delete_account")}</Text>
            </View>
          </View>
        </Pressable>

        {/* About / Version */}
        <View style={styles.card}>
          <View style={styles.cardIconWrap}>
            <View style={[styles.cardIcon, styles.cardIconIndigo]}>
              <Feather name="info" size={16} strokeWidth={2} color="#6366F1" />
            </View>
            <View style={styles.cardTextWrap}>
              <Text style={styles.cardTitle}>{t("settings_about")}</Text>
              <Text style={styles.cardSubtitle}>
                {t("settings_version")} {appVersion}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <LanguageModal
        visible={languageModalVisible}
        currentLang={lang}
        onClose={() => setLanguageModalVisible(false)}
        onSelect={setLang}
      />
      <DeleteAccountModal
        visible={deleteModalVisible}
        onClose={() => setDeleteModalVisible(false)}
        onConfirm={handleDeleteAccount}
      />
      </View>
    </GlassCardContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
    paddingBottom: 92,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 24,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "rgba(255,254,249,0.65)",
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2,
  },
  cardDisabled: {
    opacity: 0.85,
  },
  cardIconWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  cardIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cardIconPurple: { backgroundColor: "rgba(237,233,254,0.7)" },
  cardIconBlue: { backgroundColor: "rgba(219,234,254,0.7)" },
  cardIconIndigo: { backgroundColor: "rgba(224,231,255,0.7)" },
  cardIconRed: { backgroundColor: "rgba(254,226,226,0.7)" },
  cardIconRedDark: { backgroundColor: "rgba(254,202,202,0.7)" },
  cardTextWrap: { flex: 1, minWidth: 0 },
  cardTextWrapFlex: { flex: 1 },
  cardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 1,
  },
  cardSubtitle: {
    fontSize: 13,
    color: COLORS.TEXT_SECONDARY,
  },
  cardTitleDanger: {
    fontSize: 14,
    fontWeight: "600",
    color: "#B91C1C",
  },
  modalBackdrop: {
    ...MODAL.WRAPPER,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalCard: {
    ...MODAL.CARD,
    minWidth: 300,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 16,
  },
  modalBody: {
    fontSize: 15,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 22,
    marginBottom: 20,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
  },
  optionRowSelected: {
    backgroundColor: "rgba(139,92,246,0.1)",
  },
  optionText: {
    fontSize: 16,
    color: COLORS.TEXT_PRIMARY,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalButtonSecondary: {
    backgroundColor: "rgba(156,163,175,0.3)",
  },
  modalButtonSecondaryText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.TEXT_PRIMARY,
  },
  modalButtonDangerWrap: { flex: 1 },
  modalButtonDanger: {
    backgroundColor: "transparent",
  },
  modalButtonPrimaryText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});
