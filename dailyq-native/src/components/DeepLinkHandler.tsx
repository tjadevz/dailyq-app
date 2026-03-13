"use client";

import { useEffect, useRef, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { supabase } from "@/src/config/supabase";
import { useAuth } from "@/src/context/AuthContext";

const RESET_PASSWORD_PATH = "reset-password";

function isResetPasswordUrl(url: string): boolean {
  try {
    const parsed = Linking.parse(url);
    const path = parsed.path ?? "";
    const hostname = parsed.hostname ?? "";
    return (
      path.includes(RESET_PASSWORD_PATH) ||
      hostname === RESET_PASSWORD_PATH
    );
  } catch {
    return false;
  }
}

function parseHashParams(url: string): {
  access_token?: string;
  refresh_token?: string;
  type?: string;
} {
  const hashIndex = url.indexOf("#");
  if (hashIndex === -1) return {};
  const hash = url.slice(hashIndex + 1);
  const params = new URLSearchParams(hash);
  return {
    access_token: params.get("access_token") ?? undefined,
    refresh_token: params.get("refresh_token") ?? undefined,
    type: params.get("type") ?? undefined,
  };
}

/** Process reset-password URL: setSession then navigate. Used for both cold start and url event. */
async function processResetPasswordUrl(
  url: string,
  router: ReturnType<typeof useRouter>
): Promise<boolean> {
  if (!isResetPasswordUrl(url)) return false;
  const { access_token, refresh_token, type } = parseHashParams(url);
  if (type !== "recovery" || !access_token || !refresh_token) return false;
  try {
    const { error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });
    if (error) {
      console.error("[DeepLinkHandler] setSession error:", error.message);
      return false;
    }
    router.replace("/(auth)/reset-password");
    return true;
  } catch (e) {
    console.error("[DeepLinkHandler] processResetPasswordUrl error:", e);
    return false;
  }
}

export function DeepLinkHandler({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { authCheckDone } = useAuth();
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  const [initialUrlFetched, setInitialUrlFetched] = useState(false);
  const [pendingInitialUrl, setPendingInitialUrl] = useState<string | null>(null);
  const coldStartProcessedRef = useRef(false);

  // Cold start: get initial URL as soon as possible (only fires when app was opened via link)
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      setPendingInitialUrl(url ?? null);
      setInitialUrlFetched(true);
    });
  }, []);

  // When app is already open: handle incoming URL events
  useEffect(() => {
    const subscription = Linking.addEventListener("url", (event) => {
      processResetPasswordUrl(event.url, router);
    });
    return () => subscription.remove();
  }, [router]);

  // Gate: wait for AuthContext to be ready, then process cold-start URL before showing app
  useEffect(() => {
    if (!initialUrlFetched || !authCheckDone || coldStartProcessedRef.current) return;

    coldStartProcessedRef.current = true;

    const run = async () => {
      if (pendingInitialUrl && isResetPasswordUrl(pendingInitialUrl)) {
        const ok = await processResetPasswordUrl(pendingInitialUrl, router);
        if (!ok) {
          router.replace("/(auth)/onboarding");
        }
      }
      setInitialCheckDone(true);
    };

    run();
  }, [initialUrlFetched, authCheckDone, pendingInitialUrl, router]);

  if (!initialCheckDone) {
    return (
      <View style={gateStyles.wrap}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={gateStyles.text}>Loading…</Text>
      </View>
    );
  }

  return <>{children}</>;
}

const gateStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FAF9FF",
    gap: 12,
  },
  text: {
    fontSize: 16,
    color: "#6B7280",
  },
});
