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
  TextInput,
  Linking,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { APP_VERSION, COLORS, MODAL, MODAL_CLOSE_MS } from "@/src/config/constants";
import { GlassCardContainer } from "@/src/components/GlassCardContainer";
import { useLanguage } from "@/src/context/LanguageContext";
import { useAuth } from "@/src/context/AuthContext";
import { useProfileContext } from "@/src/context/ProfileContext";
import { supabase } from "@/src/config/supabase";
import { clearOnboardingNotificationsDone, clearOnboardingWidgetDone } from "@/src/lib/onboardingProgress";
import {
  upsertPushSubscription,
  getStoredExpoPushToken,
  setStoredExpoPushToken,
  type ReminderTime,
} from "@/src/lib/pushSubscription";
import { getExpoPushTokenAsync } from "@/src/native/notifications";
import { useStreakMilestone, STREAK_MILESTONES } from "@/src/context/StreakMilestoneContext";
import { setPendingReferralCode } from "@/src/lib/referralPending";
import { setReferralGivenDevTrigger } from "@/src/lib/referralGivenDevTrigger";

const REMINDER_TIME_KEY = "dailyq-reminder-time";
const MONTHLY_RECAP_DEV_TRIGGER_KEY = "dailyq-dev-force-monthly-recap";
const FEEDBACK_EMAIL = "info@dailyqapp.com";

const showDebugModals = __DEV__ && process.env.EXPO_PUBLIC_DEBUG_MODALS === "true";


function getReminderSubtitle(
  t: (key: string) => string,
  slot: ReminderTime | null
): string {
  if (!slot) return t("settings_reminder_off");
  if (slot === "morning") return t("onboarding_notif_morning_time");
  if (slot === "afternoon") return t("onboarding_notif_afternoon_time");
  return t("onboarding_notif_evening_time");
}

// ----- ReminderModal -----
function ReminderModal({
  visible,
  current,
  onClose,
  onSelect,
}: {
  visible: boolean;
  current: ReminderTime | null;
  onClose: () => void;
  onSelect: (slot: ReminderTime | null) => void;
}) {
  const { t } = useLanguage();
  const opacity = useRef(new Animated.Value(0)).current;
  const cardY = useRef(new Animated.Value(14)).current;
  const cardScale = useRef(new Animated.Value(0.95)).current;
  const [rendered, setRendered] = useState(visible);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      cardY.setValue(14);
      cardScale.setValue(0.95);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(cardY, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(cardScale, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: MODAL_CLOSE_MS, useNativeDriver: true }),
        Animated.timing(cardY, { toValue: 14, duration: MODAL_CLOSE_MS, useNativeDriver: true }),
        Animated.timing(cardScale, { toValue: 0.95, duration: MODAL_CLOSE_MS, useNativeDriver: true }),
      ]).start(() => setRendered(false));
    }
  }, [visible]);

  if (!rendered) return null;

  const OPTIONS: { value: ReminderTime | null; labelKey: string; timeKey?: string }[] = [
    { value: null, labelKey: "settings_reminder_off" },
    { value: "morning", labelKey: "onboarding_notif_morning", timeKey: "onboarding_notif_morning_time" },
    { value: "afternoon", labelKey: "onboarding_notif_afternoon", timeKey: "onboarding_notif_afternoon_time" },
    { value: "evening", labelKey: "onboarding_notif_evening", timeKey: "onboarding_notif_evening_time" },
  ];

  return (
    <Modal transparent visible={rendered} animationType="none">
      <Animated.View style={[styles.modalBackdrop, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[styles.modalCard, { transform: [{ translateY: cardY }, { scale: cardScale }] }]}>
          <Pressable style={MODAL.CLOSE_BUTTON} onPress={onClose}>
            <Feather name="x" size={18} color={COLORS.TEXT_SECONDARY} strokeWidth={2.5} />
          </Pressable>
          <Text style={styles.modalTitle}>{t("settings_reminder_modal_title")}</Text>
          {OPTIONS.map((opt) => (
            <Pressable
              key={String(opt.value)}
              style={[styles.optionRow, current === opt.value && styles.optionRowSelected]}
              onPress={() => {
                onSelect(opt.value);
                onClose();
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.optionText}>{t(opt.labelKey)}</Text>
                {opt.timeKey && (
                  <Text style={styles.optionSubtext}>{t(opt.timeKey)}</Text>
                )}
              </View>
              {current === opt.value && (
                <Feather name="check" size={20} color={COLORS.ACCENT} strokeWidth={2.5} />
              )}
            </Pressable>
          ))}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { effectiveUser, signOut } = useAuth();
  const { refetch: refetchProfile } = useProfileContext();
  const { showMilestone } = useStreakMilestone();
  const router = useRouter();

  const [reminderModalVisible, setReminderModalVisible] = useState(false);
  const [reminderTime, setReminderTime] = useState<ReminderTime | null>(null);
  const [replayOnboardingLoading, setReplayOnboardingLoading] = useState(false);
  const [referralModalVisible, setReferralModalVisible] = useState(false);
  const [referralCodeInput, setReferralCodeInput] = useState("");
  const [startReferralLoading, setStartReferralLoading] = useState(false);
  const [startReferralError, setStartReferralError] = useState<string | null>(null);
  const [triggerReferralGivenModalLoading, setTriggerReferralGivenModalLoading] = useState(false);
  const [triggerMonthlyRecapLoading, setTriggerMonthlyRecapLoading] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(REMINDER_TIME_KEY).then((value) => {
      if (value === "morning" || value === "afternoon" || value === "evening") {
        setReminderTime(value);
      } else {
        setReminderTime(null);
      }
    });
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.replace("/(auth)/onboarding");
  }, [signOut, router]);

  const handleReminderSelect = useCallback(
    async (slot: ReminderTime | null) => {
      setReminderTime(slot);
      if (slot) {
        await AsyncStorage.setItem(REMINDER_TIME_KEY, slot);
      } else {
        await AsyncStorage.removeItem(REMINDER_TIME_KEY);
      }
      const userId = effectiveUser?.id;
      if (!userId || userId === "dev-user") return;
      // Re-request token in case it was never stored (e.g. permissions granted later).
      let token = await getStoredExpoPushToken();
      if (!token && slot) {
        token = await getExpoPushTokenAsync();
        await setStoredExpoPushToken(token);
      }
      await upsertPushSubscription(userId, slot ? token : null, slot);
    },
    [effectiveUser?.id]
  );

  const handleOverDailyQ = useCallback(() => {
    router.push("/(tabs)/settings/over");
  }, [router]);

  const handleAccount = useCallback(() => {
    router.push("/(tabs)/settings/account");
  }, [router]);

  const handleReplayOnboarding = useCallback(async () => {
    const userId = effectiveUser?.id;
    if (!userId || userId === "dev-user") return;
    setReplayOnboardingLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ onboarding_completed: false })
        .eq("id", userId);
      if (error) throw error;
      await refetchProfile();
      await clearOnboardingNotificationsDone(userId);
      await clearOnboardingWidgetDone(userId);
      router.replace("/(tabs)/onboarding-widget");
    } catch (e) {
      console.error("[Settings] Replay onboarding failed:", e);
    } finally {
      setReplayOnboardingLoading(false);
    }
  }, [effectiveUser?.id, refetchProfile, router]);

  const handleOpenReferralDevModal = useCallback(() => {
    setStartReferralError(null);
    setReferralModalVisible(true);
  }, []);

  const handleCloseReferralDevModal = useCallback(() => {
    if (startReferralLoading) return;
    setReferralModalVisible(false);
    setStartReferralError(null);
  }, [startReferralLoading]);

  const handleStartReferralOnboarding = useCallback(async () => {
    const userId = effectiveUser?.id;
    if (!userId || userId === "dev-user") return;
    const normalizedCode = referralCodeInput.trim();
    if (!normalizedCode) {
      setStartReferralError("Voer een referral code in.");
      return;
    }

    setStartReferralLoading(true);
    setStartReferralError(null);
    try {
      await setPendingReferralCode(normalizedCode);
      const { error } = await supabase
        .from("profiles")
        .update({ onboarding_completed: false })
        .eq("id", userId);
      if (error) throw error;
      await refetchProfile();
      setReferralModalVisible(false);
      router.replace("/(auth)/referral-claim");
    } catch (e) {
      console.error("[Settings] Start referral onboarding failed:", e);
      setStartReferralError("Kon referral flow niet starten. Probeer opnieuw.");
    } finally {
      setStartReferralLoading(false);
    }
  }, [effectiveUser?.id, referralCodeInput, refetchProfile, router]);

  const handleTriggerReferralGivenModal = useCallback(async () => {
    if (!__DEV__) return;
    setTriggerReferralGivenModalLoading(true);
    try {
      await setReferralGivenDevTrigger();
      router.replace("/");
    } catch (e) {
      console.error("[Settings] Trigger referral_given modal failed:", e);
    } finally {
      setTriggerReferralGivenModalLoading(false);
    }
  }, [router]);

  const handleTriggerMonthlyRecap = useCallback(async () => {
    const userId = effectiveUser?.id;
    if (!__DEV__ || !userId || userId === "dev-user") return;
    setTriggerMonthlyRecapLoading(true);
    try {
      const now = new Date();
      const firstOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const firstOfPreviousMonth = new Date(
        firstOfCurrentMonth.getFullYear(),
        firstOfCurrentMonth.getMonth() - 1,
        1
      );
      const pad = (n: number) => String(n).padStart(2, "0");
      const dayA = new Date(
        firstOfPreviousMonth.getFullYear(),
        firstOfPreviousMonth.getMonth(),
        5,
        6,
        0,
        0,
        0
      );
      const dayB = new Date(
        firstOfPreviousMonth.getFullYear(),
        firstOfPreviousMonth.getMonth(),
        20,
        22,
        0,
        0,
        0
      );
      const questionDateA = `${dayA.getFullYear()}-${pad(dayA.getMonth() + 1)}-${pad(dayA.getDate())}`;
      const questionDateB = `${dayB.getFullYear()}-${pad(dayB.getMonth() + 1)}-${pad(dayB.getDate())}`;

      const { error: seedError } = await supabase.from("answers").upsert(
        [
          {
            user_id: userId,
            question_date: questionDateA,
            answer_text: "Dev recap seed earliest",
            is_onboarding: false,
            created_at: dayA.toISOString(),
          },
          {
            user_id: userId,
            question_date: questionDateB,
            answer_text: "Dev recap seed latest",
            is_onboarding: false,
            is_joker: true,
            created_at: dayB.toISOString(),
          },
        ],
        { onConflict: "user_id,question_date" }
      );
      if (seedError) throw seedError;

      await AsyncStorage.setItem(MONTHLY_RECAP_DEV_TRIGGER_KEY, "1");
      const { error } = await supabase
        .from("profiles")
        .update({ last_monthly_recap_shown: null })
        .eq("id", userId);
      if (error) throw error;
      router.replace("/(tabs)/today");
    } catch (e) {
      console.error("[Settings] Trigger monthly recap failed:", e);
    } finally {
      setTriggerMonthlyRecapLoading(false);
    }
  }, [effectiveUser?.id, router]);

  const handleSendFeedback = useCallback(async () => {
    const subject = encodeURIComponent(`DailyQ Feedback (v${APP_VERSION})`);
    const url = `mailto:${FEEDBACK_EMAIL}?subject=${subject}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        t("settings_feedback_mail_error_title"),
        t("settings_feedback_mail_error_body", { email: FEEDBACK_EMAIL })
      );
    }
  }, [t]);

  const handleOpenInstagram = useCallback(() => {
    Linking.openURL("https://www.instagram.com/dailyqapp/");
  }, []);

  return (
    <GlassCardContainer>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>{t("settings_title")}</Text>

          {/* Notifications */}
          <Pressable
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.82, transform: [{ scale: 0.98 }] }]}
            onPress={() => setReminderModalVisible(true)}
          >
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
              <Feather name="chevron-right" size={20} color={COLORS.TEXT_MUTED} />
            </View>
          </Pressable>

          {/* Account */}
          <Pressable
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.82, transform: [{ scale: 0.98 }] }]}
            onPress={handleAccount}
          >
            <View style={styles.cardIconWrap}>
              <View style={[styles.cardIcon, styles.cardIconIndigo]}>
                <Feather name="user" size={16} strokeWidth={2} color="#6366F1" />
              </View>
              <View style={styles.cardTextWrap}>
                <Text style={styles.cardTitle}>{t("settings_account")}</Text>
              </View>
              <Feather name="chevron-right" size={20} color={COLORS.TEXT_MUTED} />
            </View>
          </Pressable>

          {/* Over DailyQ */}
          <Pressable
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.82, transform: [{ scale: 0.98 }] }]}
            onPress={handleOverDailyQ}
          >
            <View style={styles.cardIconWrap}>
              <View style={[styles.cardIcon, styles.cardIconIndigo]}>
                <Feather name="info" size={16} strokeWidth={2} color="#6366F1" />
              </View>
              <View style={styles.cardTextWrap}>
                <Text style={styles.cardTitle}>{t("settings_about")}</Text>
              </View>
              <Feather name="chevron-right" size={20} color={COLORS.TEXT_MUTED} />
            </View>
          </Pressable>

          {/* Instagram */}
          <Pressable
            style={({ pressed }) => [styles.card, styles.cardInstagram, pressed && { opacity: 0.82, transform: [{ scale: 0.98 }] }]}
            onPress={handleOpenInstagram}
          >
            <View style={styles.cardIconWrap}>
              <View style={[styles.cardIcon, styles.cardIconInstagram]}>
                <MaterialCommunityIcons name="instagram" size={18} color="#E1306C" />
              </View>
              <View style={styles.cardTextWrap}>
                <Text style={styles.cardTitle}>{t("settings_instagram_follow")}</Text>
                <Text style={styles.cardSubtitle}>@dailyqapp</Text>
              </View>
              <Feather name="chevron-right" size={20} color={COLORS.TEXT_MUTED} />
            </View>
          </Pressable>

          {/* Send Feedback */}
          <Pressable
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.82, transform: [{ scale: 0.98 }] }]}
            onPress={handleSendFeedback}
          >
            <View style={styles.cardIconWrap}>
              <View style={[styles.cardIcon, styles.cardIconBlue]}>
                <MaterialCommunityIcons name="email-outline" size={18} color="#3B82F6" />
              </View>
              <View style={styles.cardTextWrap}>
                <Text style={styles.cardTitle}>{t("settings_send_feedback")}</Text>
              </View>
              <Feather name="chevron-right" size={20} color={COLORS.TEXT_MUTED} />
            </View>
          </Pressable>

          {/* Uitloggen */}
          <Pressable
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.82, transform: [{ scale: 0.98 }] }]}
            onPress={handleSignOut}
          >
            <View style={styles.cardIconWrap}>
              <View style={[styles.cardIcon, styles.cardIconRed]}>
                <Feather name="log-out" size={16} strokeWidth={2} color="#DC2626" />
              </View>
              <View style={styles.cardTextWrap}>
                <Text style={styles.cardTitle}>{t("settings_sign_out")}</Text>
              </View>
            </View>
          </Pressable>

          {/* Replay onboarding (dev only; tap does nothing when logged in as dev-user) */}
          {__DEV__ && (
            <Pressable
              style={({ pressed }) => [styles.card, replayOnboardingLoading && styles.cardDisabled, !replayOnboardingLoading && pressed && { opacity: 0.82, transform: [{ scale: 0.98 }] }]}
              onPress={handleReplayOnboarding}
              disabled={replayOnboardingLoading}
            >
              <View style={styles.cardIconWrap}>
                <View style={[styles.cardIcon, styles.cardIconPurple]}>
                  <Feather name="refresh-cw" size={16} strokeWidth={2} color={COLORS.ACCENT} />
                </View>
                <View style={styles.cardTextWrap}>
                  <Text style={styles.cardTitle}>Replay onboarding (dev)</Text>
                  <Text style={styles.cardSubtitle}>
                    {replayOnboardingLoading ? "Loading…" : "Set onboarding_completed = false and open flow"}
                  </Text>
                </View>
                {replayOnboardingLoading ? (
                  <ActivityIndicator size="small" color={COLORS.ACCENT} />
                ) : (
                  <Feather name="chevron-right" size={20} color={COLORS.TEXT_MUTED} />
                )}
              </View>
            </Pressable>
          )}

          {/* Start referral onboarding (dev only; hidden for dev-user) */}
          {__DEV__ && effectiveUser?.id && effectiveUser.id !== "dev-user" && (
            <Pressable
              style={({ pressed }) => [styles.card, startReferralLoading && styles.cardDisabled, !startReferralLoading && pressed && { opacity: 0.82, transform: [{ scale: 0.98 }] }]}
              onPress={handleOpenReferralDevModal}
              disabled={startReferralLoading}
            >
              <View style={styles.cardIconWrap}>
                <View style={[styles.cardIcon, styles.cardIconPurple]}>
                  <Feather name="gift" size={16} strokeWidth={2} color={COLORS.ACCENT} />
                </View>
                <View style={styles.cardTextWrap}>
                  <Text style={styles.cardTitle}>Start referral onboarding (dev)</Text>
                  <Text style={styles.cardSubtitle}>Set code + open referral claim flow</Text>
                </View>
                <Feather name="chevron-right" size={20} color={COLORS.TEXT_MUTED} />
              </View>
            </Pressable>
          )}

          {/* Trigger referral_given app-open modal (dev only) */}
          {__DEV__ && (
            <Pressable
              style={({ pressed }) => [styles.card, triggerReferralGivenModalLoading && styles.cardDisabled, !triggerReferralGivenModalLoading && pressed && { opacity: 0.82, transform: [{ scale: 0.98 }] }]}
              onPress={handleTriggerReferralGivenModal}
              disabled={triggerReferralGivenModalLoading}
            >
              <View style={styles.cardIconWrap}>
                <View style={[styles.cardIcon, styles.cardIconPurple]}>
                  <Feather name="bell" size={16} strokeWidth={2} color={COLORS.ACCENT} />
                </View>
                <View style={styles.cardTextWrap}>
                  <Text style={styles.cardTitle}>Trigger referral_given modal (dev)</Text>
                  <Text style={styles.cardSubtitle}>Show one-time referral reward modal on app open</Text>
                </View>
                {triggerReferralGivenModalLoading ? (
                  <ActivityIndicator size="small" color={COLORS.ACCENT} />
                ) : (
                  <Feather name="chevron-right" size={20} color={COLORS.TEXT_MUTED} />
                )}
              </View>
            </Pressable>
          )}

          {/* Trigger monthly recap (dev only) */}
          {__DEV__ && (
            <Pressable
              style={({ pressed }) => [styles.card, triggerMonthlyRecapLoading && styles.cardDisabled, !triggerMonthlyRecapLoading && pressed && { opacity: 0.82, transform: [{ scale: 0.98 }] }]}
              onPress={handleTriggerMonthlyRecap}
              disabled={triggerMonthlyRecapLoading}
            >
              <View style={styles.cardIconWrap}>
                <View style={[styles.cardIcon, styles.cardIconPurple]}>
                  <Feather name="calendar" size={16} strokeWidth={2} color={COLORS.ACCENT} />
                </View>
                <View style={styles.cardTextWrap}>
                  <Text style={styles.cardTitle}>Trigger monthly recap (dev)</Text>
                  <Text style={styles.cardSubtitle}>Reset recap shown flag and open Today</Text>
                </View>
                {triggerMonthlyRecapLoading ? (
                  <ActivityIndicator size="small" color={COLORS.ACCENT} />
                ) : (
                  <Feather name="chevron-right" size={20} color={COLORS.TEXT_MUTED} />
                )}
              </View>
            </Pressable>
          )}

          {/* Debug modals (only when npm start with EXPO_PUBLIC_DEBUG_MODALS=true) */}
          {showDebugModals && (
            <>
              <Text style={[styles.title, { marginTop: 8, marginBottom: 12 }]}>Debug modals</Text>
              {STREAK_MILESTONES.map((milestone) => (
                <Pressable
                  key={milestone}
                  style={({ pressed }) => [styles.card, pressed && { opacity: 0.82, transform: [{ scale: 0.98 }] }]}
                  onPress={() => showMilestone(milestone)}
                >
                  <View style={styles.cardIconWrap}>
                    <View style={[styles.cardIcon, styles.cardIconPurple]}>
                      <Feather name="award" size={16} strokeWidth={2} color={COLORS.ACCENT} />
                    </View>
                    <View style={styles.cardTextWrap}>
                      <Text style={styles.cardTitle}>Streak {milestone}</Text>
                      <Text style={styles.cardSubtitle}>Show celebration modal</Text>
                    </View>
                    <Feather name="chevron-right" size={20} color={COLORS.TEXT_MUTED} />
                  </View>
                </Pressable>
              ))}
            </>
          )}
        </ScrollView>

      <ReminderModal
        visible={reminderModalVisible}
        current={reminderTime}
        onClose={() => setReminderModalVisible(false)}
        onSelect={handleReminderSelect}
      />
      <Modal
        transparent
        visible={referralModalVisible}
        animationType="fade"
        onRequestClose={handleCloseReferralDevModal}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleCloseReferralDevModal} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Start referral onboarding (dev)</Text>
            <Text style={styles.modalBody}>
              Voer een referral code in. We bewaren de code, zetten onboarding opnieuw aan, en openen
              de referral claim flow.
            </Text>

            <TextInput
              value={referralCodeInput}
              onChangeText={setReferralCodeInput}
              placeholder="Referral code"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!startReferralLoading}
              style={styles.modalInput}
            />
            {startReferralError ? <Text style={styles.modalErrorText}>{startReferralError}</Text> : null}

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={handleCloseReferralDevModal}
                disabled={startReferralLoading}
              >
                <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleStartReferralOnboarding}
                disabled={startReferralLoading}
              >
                {startReferralLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalButtonPrimaryText}>Start</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    flexGrow: 1,
    justifyContent: "center",
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
    opacity: 0.6,
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
  cardIconInstagram: { backgroundColor: "rgba(255,220,230,0.7)" },
  cardInstagram: {
    borderColor: "rgba(225,48,108,0.15)",
  },
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
    fontSize: 17,
    color: COLORS.TEXT_PRIMARY,
  },
  optionSubtext: {
    fontSize: 13,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 1,
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
  modalButtonPrimary: {
    backgroundColor: COLORS.ACCENT,
  },
  modalButtonDanger: {
    backgroundColor: "#DC2626",
  },
  modalButtonDangerText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  modalButtonPrimaryText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  modalInput: {
    width: "100%",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.25)",
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 8,
  },
  modalErrorText: {
    fontSize: 13,
    color: "#B91C1C",
    marginBottom: 2,
  },
});
