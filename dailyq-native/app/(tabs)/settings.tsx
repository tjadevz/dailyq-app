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
import Constants from "expo-constants";
import Feather from "@expo/vector-icons/Feather";

import { COLORS, MODAL, MODAL_CLOSE_MS } from "@/src/config/constants";
import { useLanguage } from "@/src/context/LanguageContext";
import { useAuth } from "@/src/context/AuthContext";
import type { Lang } from "@/src/i18n/translations";

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
              style={[styles.modalButton, styles.modalButtonDanger]}
              onPress={handleConfirm}
              disabled={deleting}
            >
              {deleting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.modalButtonPrimaryText}>{t("settings_delete_account")}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

export default function SettingsScreen() {
  const { t, lang, setLang } = useLanguage();
  const { effectiveUser, signOut, deleteUser } = useAuth();
  const router = useRouter();

  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

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
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{t("settings_title")}</Text>
        <Text style={styles.subtitle}>{t("settings_subtitle")}</Text>

        {/* Language */}
        <Pressable
          style={styles.row}
          onPress={() => setLanguageModalVisible(true)}
        >
          <Text style={styles.rowLabel}>{t("settings_language")}</Text>
          <View style={styles.rowValue}>
            <Text style={styles.rowValueText}>{currentLangLabel}</Text>
            <Feather name="chevron-right" size={20} color={COLORS.TEXT_MUTED} />
          </View>
        </Pressable>

        {/* Signed in as */}
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t("settings_signed_in_as")}</Text>
          <Text style={styles.rowValueText} numberOfLines={1}>
            {email}
          </Text>
        </View>

        {/* Sign out */}
        <Pressable style={[styles.row, styles.rowButton]} onPress={handleSignOut}>
          <Text style={styles.rowButtonText}>{t("settings_sign_out")}</Text>
        </Pressable>

        {/* Delete account */}
        <Pressable
          style={[styles.row, styles.rowButton, styles.rowButtonDanger]}
          onPress={() => setDeleteModalVisible(true)}
        >
          <Text style={styles.rowButtonDangerText}>{t("settings_delete_account")}</Text>
        </Pressable>

        {/* Version */}
        <Text style={styles.version}>{t("settings_version")} {appVersion}</Text>

        {/* Tagline */}
        <Text style={styles.tagline}>{t("settings_tagline")}</Text>
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
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
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 24,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "rgba(255,255,255,0.8)",
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(229,231,235,0.6)",
  },
  rowLabel: {
    fontSize: 15,
    color: COLORS.TEXT_PRIMARY,
    fontWeight: "500",
  },
  rowValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    justifyContent: "flex-end",
  },
  rowValueText: {
    fontSize: 15,
    color: COLORS.TEXT_SECONDARY,
    maxWidth: "70%",
  },
  rowButton: {
    justifyContent: "center",
    backgroundColor: COLORS.ACCENT,
    borderColor: "transparent",
  },
  rowButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  rowButtonDanger: {
    backgroundColor: "transparent",
    borderColor: "#DC2626",
  },
  rowButtonDangerText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#DC2626",
  },
  version: {
    fontSize: 13,
    color: COLORS.TEXT_MUTED,
    marginTop: 24,
    marginBottom: 8,
    textAlign: "center",
  },
  tagline: {
    fontSize: 14,
    color: COLORS.TEXT_MUTED,
    textAlign: "center",
    fontStyle: "italic",
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
  modalButtonDanger: {
    backgroundColor: "#DC2626",
  },
  modalButtonPrimaryText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});
