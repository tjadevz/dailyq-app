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
import Feather from "@expo/vector-icons/Feather";

import { COLORS, MODAL, MODAL_CLOSE_MS } from "@/src/config/constants";
import { GlassCardContainer } from "@/src/components/GlassCardContainer";
import { useLanguage } from "@/src/context/LanguageContext";
import { useAuth } from "@/src/context/AuthContext";

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
      <Animated.View style={[accountStyles.modalBackdrop, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={accountStyles.modalCard}>
          <Text style={accountStyles.modalTitle}>{t("settings_delete_account")}</Text>
          <Text style={accountStyles.modalBody}>{t("settings_delete_confirm")}</Text>
          <View style={accountStyles.modalActions}>
            <Pressable
              style={[accountStyles.modalButton, accountStyles.modalButtonSecondary]}
              onPress={onClose}
              disabled={deleting}
            >
              <Text style={accountStyles.modalButtonSecondaryText}>{t("common_cancel")}</Text>
            </Pressable>
            <Pressable
              style={[accountStyles.modalButton, accountStyles.modalButtonDanger]}
              onPress={handleConfirm}
              disabled={deleting}
            >
              {deleting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={accountStyles.modalButtonDangerText}>{t("common_confirm")}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useLanguage();
  const { deleteUser } = useAuth();
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  const handleDeleteAccount = useCallback(async () => {
    const { error } = await deleteUser();
    if (!error) {
      router.replace("/(auth)/onboarding");
    }
  }, [deleteUser, router]);

  return (
    <GlassCardContainer>
      <View style={[accountStyles.container, { paddingTop: insets.top }]}>
        <View style={accountStyles.header}>
          <Pressable
            style={accountStyles.backButton}
            onPress={() => router.replace("/(tabs)/settings")}
            hitSlop={12}
          >
            <Feather name="chevron-left" size={24} color={COLORS.TEXT_PRIMARY} strokeWidth={2.5} />
          </Pressable>
          <Text style={accountStyles.title}>{t("settings_account")}</Text>
          <View style={accountStyles.backButton} />
        </View>
        <ScrollView
          contentContainerStyle={accountStyles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Pressable style={accountStyles.card} onPress={() => setDeleteModalVisible(true)}>
            <View style={accountStyles.cardIconWrap}>
              <View style={[accountStyles.cardIcon, accountStyles.cardIconRedDark]}>
                <Feather name="trash-2" size={16} strokeWidth={2} color="#B91C1C" />
              </View>
              <View style={accountStyles.cardTextWrap}>
                <Text style={accountStyles.cardTitleDanger}>{t("settings_delete_account")}</Text>
              </View>
            </View>
          </Pressable>
        </ScrollView>
      </View>
      <DeleteAccountModal
        visible={deleteModalVisible}
        onClose={() => setDeleteModalVisible(false)}
        onConfirm={handleDeleteAccount}
      />
    </GlassCardContainer>
  );
}

const accountStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.TEXT_PRIMARY,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
    flexGrow: 1,
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
  cardIconRedDark: { backgroundColor: "rgba(254,202,202,0.7)" },
  cardTextWrap: { flex: 1, minWidth: 0 },
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
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 18,
  },
  modalBody: {
    fontSize: 16,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 24,
    marginBottom: 20,
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
  modalButtonDangerText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});
