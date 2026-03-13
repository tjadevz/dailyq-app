"use client";

import { useEffect } from "react";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { supabase } from "@/src/config/supabase";
import {
  isResetPasswordUrl,
  hasRecoveryTokens,
  parseHashParams,
} from "@/src/lib/resetPasswordLink";

/**
 * Handles incoming URL events when the app is already open (e.g. user taps reset link in email).
 * Does NOT block rendering. Cold-start links are handled in index.tsx.
 */
export function DeepLinkProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const subscription = Linking.addEventListener("url", (event) => {
      const url = event.url;
      if (!url || !isResetPasswordUrl(url) || !hasRecoveryTokens(url)) return;
      const { access_token, refresh_token } = parseHashParams(url);
      if (!access_token || !refresh_token) return;
      supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
        if (!error) router.replace("/(auth)/reset-password");
      });
    });
    return () => subscription.remove();
  }, [router]);

  return <>{children}</>;
}
