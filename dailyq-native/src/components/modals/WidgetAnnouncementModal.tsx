import React, { useCallback } from "react";
import { Modal, Pressable, StyleSheet, Text, View, Image, useWindowDimensions } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackgroundLayer } from "@/src/components/BackgroundLayer";
import { WidgetPreviewMockup } from "@/src/components/WidgetPreviewMockup";
import { COLORS } from "@/src/config/constants";
import { useLanguage } from "@/src/context/LanguageContext";

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function WidgetAnnouncementModal({ visible, onClose }: Props) {
  // Fabric doesn't reliably size flex:1/absoluteFillObject (right/bottom-based)
  // content inside <Modal> — needs explicit numeric width/height. SafeAreaView's
  // automatic inset computation is equally unreliable inside a bare <Modal>'s
  // separate native layer (it rendered the close button up under the status bar) —
  // use the useSafeAreaInsets() hook and apply insets explicitly instead, matching
  // every other modal in this app.
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  const handleDismiss = useCallback(() => onClose(), [onClose]);

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={handleDismiss}>
      <View style={{ width, height, backgroundColor: COLORS.BACKGROUND }}>
        <View style={{ position: "absolute", top: 0, left: 0, width, height }} pointerEvents="none">
          <BackgroundLayer
            style={{ position: "absolute", top: 0, left: 0, right: undefined, bottom: undefined, width, height }}
          />
        </View>
        <View style={{ width, height, paddingTop: insets.top, paddingBottom: insets.bottom }}>
          <View style={styles.closeRow}>
            <Pressable
              onPress={handleDismiss}
              style={styles.closeButton}
              accessibilityLabel={t("widget_announcement_dismiss")}
              hitSlop={12}
            >
              <Feather name="x" size={20} color={COLORS.TEXT_SECONDARY} />
            </Pressable>
          </View>

          <View style={styles.content}>
            <View style={styles.header}>
              <Image
                source={require("@/assets/images/logo.nobg.png")}
                style={styles.logoImage}
                resizeMode="contain"
              />
              <Text style={styles.title}>{t("widget_announcement_title")}</Text>
            </View>

            <WidgetPreviewMockup size="large" />

            <Text style={styles.hintText}>{t("onboarding_widget_hint")}</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  closeRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: "center",
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    gap: 32,
  },
  header: {
    alignItems: "center",
  },
  logoImage: {
    width: 80,
    height: 80,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    color: COLORS.TEXT_PRIMARY,
    textAlign: "center",
  },
  hintText: {
    fontSize: 16,
    fontWeight: "500",
    color: COLORS.TEXT_PRIMARY,
    textAlign: "center",
    lineHeight: 22,
    marginTop: 12,
  },
});
