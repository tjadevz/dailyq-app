import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter, Redirect, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Feather from "@expo/vector-icons/Feather";

import { COLORS } from "@/src/config/constants";
import { useLanguage } from "@/src/context/LanguageContext";
import { useAuth } from "@/src/context/AuthContext";
import { supabase } from "@/src/config/supabase";
import { hasRecoveryTokens, parseHashParams } from "@/src/lib/resetPasswordLink";

const MIN_PASSWORD_LENGTH = 6;

function PrimaryButton({
  onPress,
  disabled,
  children,
}: {
  onPress: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const gradientColors = disabled
    ? ["#9CA3AF", "#9CA3AF"]
    : ["#7C3AED", "#6D28D9"];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primaryButtonWrap,
        pressed && !disabled && styles.primaryButtonPressed,
      ]}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[
          styles.primaryButtonGradient,
          disabled && styles.primaryButtonDisabled,
        ]}
      >
        {children}
      </LinearGradient>
    </Pressable>
  );
}

export default function ResetPasswordScreen() {
  const { t } = useLanguage();
  const { user, authCheckDone } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ url?: string }>();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [allowRedirectToOnboarding, setAllowRedirectToOnboarding] = useState(false);
  const [urlParamProcessed, setUrlParamProcessed] = useState(false);
  const urlParamProcessedRef = useRef(false);

  // If we landed with ?url=... (cold-start deep link), setSession from tokens then show form
  useEffect(() => {
    const rawUrl = params.url;
    if (!rawUrl || urlParamProcessedRef.current) {
      setUrlParamProcessed(true);
      return;
    }
    const url = decodeURIComponent(rawUrl);
    if (!hasRecoveryTokens(url)) {
      setUrlParamProcessed(true);
      return;
    }
    urlParamProcessedRef.current = true;
    const { access_token, refresh_token } = parseHashParams(url);
    if (!access_token || !refresh_token) {
      setUrlParamProcessed(true);
      return;
    }
    supabase.auth
      .setSession({ access_token, refresh_token })
      .finally(() => setUrlParamProcessed(true));
  }, [params.url]);

  // When opened via deep link (no url param), setSession may run elsewhere; give AuthContext time before redirecting
  useEffect(() => {
    if (user || !authCheckDone) return;
    const id = setTimeout(() => setAllowRedirectToOnboarding(true), 2000);
    return () => clearTimeout(id);
  }, [user, authCheckDone]);

  const handleSubmit = useCallback(async () => {
    setError(null);
    const trimmed = password.trim();
    const confirmTrimmed = confirmPassword.trim();

    if (trimmed.length < MIN_PASSWORD_LENGTH) {
      setError(t("reset_password_error_weak"));
      return;
    }
    if (trimmed !== confirmTrimmed) {
      setError(t("reset_password_error_mismatch"));
      return;
    }

    setSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: trimmed,
      });
      if (updateError) {
        setError(updateError.message || t("reset_password_error_generic"));
        return;
      }
      router.replace("/(tabs)/today");
    } catch {
      setError(t("reset_password_error_generic"));
    } finally {
      setSubmitting(false);
    }
  }, [password, confirmPassword, t, router]);

  if (!urlParamProcessed) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.ACCENT} />
          <Text style={styles.loadingText}>{t("loading")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (authCheckDone && !user) {
    if (allowRedirectToOnboarding) {
      return <Redirect href="/(auth)/onboarding" />;
    }
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.ACCENT} />
          <Text style={styles.loadingText}>{t("loading")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <View style={styles.header}>
              <View style={styles.logoCircle}>
                <Feather
                  name="lock"
                  size={40}
                  color={COLORS.ACCENT}
                  strokeWidth={2}
                />
              </View>
              <Text style={styles.title}>{t("reset_password_title")}</Text>
              <Text style={styles.subtitle}>{t("reset_password_subtitle")}</Text>
            </View>

            <View style={styles.form}>
              <View style={styles.passwordInputWrap}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder={t("reset_password_new")}
                  placeholderTextColor={COLORS.TEXT_MUTED}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setError(null);
                  }}
                  editable={!submitting}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="new-password"
                />
                <Pressable
                  onPress={() => setShowPassword((s) => !s)}
                  style={styles.passwordToggle}
                  accessibilityLabel={showPassword ? t("common_hide_password") : t("common_show_password")}
                >
                  <Feather
                    name={showPassword ? "eye-off" : "eye"}
                    size={22}
                    color={COLORS.TEXT_MUTED}
                    strokeWidth={2}
                  />
                </Pressable>
              </View>
              <View style={styles.passwordInputWrap}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder={t("reset_password_confirm")}
                  placeholderTextColor={COLORS.TEXT_MUTED}
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    setError(null);
                  }}
                  editable={!submitting}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="new-password"
                />
                <Pressable
                  onPress={() => setShowPassword((s) => !s)}
                  style={styles.passwordToggle}
                  accessibilityLabel={showPassword ? t("common_hide_password") : t("common_show_password")}
                >
                  <Feather
                    name={showPassword ? "eye-off" : "eye"}
                    size={22}
                    color={COLORS.TEXT_MUTED}
                    strokeWidth={2}
                  />
                </Pressable>
              </View>
              {error && <Text style={styles.error}>{error}</Text>}
              <PrimaryButton
                onPress={handleSubmit}
                disabled={
                  submitting ||
                  password.trim().length < MIN_PASSWORD_LENGTH ||
                  confirmPassword.trim() !== password.trim()
                }
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {t("reset_password_submit")}
                  </Text>
                )}
              </PrimaryButton>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },
  keyboard: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 32,
    paddingTop: 48,
    paddingBottom: 48,
  },
  card: {
    maxWidth: 440,
    width: "100%",
    alignSelf: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(139,92,246,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    color: COLORS.TEXT_PRIMARY,
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.TEXT_SECONDARY,
    textAlign: "center",
    lineHeight: 24,
  },
  form: {
    gap: 14,
  },
  input: {
    width: "100%",
    minHeight: 52,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(229,231,235,0.8)",
    backgroundColor: "#fff",
    fontSize: 15,
    color: COLORS.TEXT_PRIMARY,
  },
  passwordInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(229,231,235,0.8)",
    backgroundColor: "#fff",
  },
  passwordInput: {
    flex: 1,
    width: undefined,
    minHeight: 52,
    paddingRight: 12,
    borderWidth: 0,
    borderRadius: 0,
  },
  passwordToggle: {
    padding: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  error: {
    fontSize: 14,
    color: "#DC2626",
    marginBottom: 4,
    textAlign: "center",
  },
  primaryButtonWrap: {
    width: "100%",
    marginTop: 8,
  },
  primaryButtonGradient: {
    paddingVertical: 18,
    minHeight: 56,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "rgba(139,92,246,0.35)",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 1,
    shadowRadius: 56,
    elevation: 8,
  },
  primaryButtonDisabled: {
    shadowOpacity: 0,
  },
  primaryButtonPressed: {
    opacity: 0.9,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.TEXT_SECONDARY,
  },
});
