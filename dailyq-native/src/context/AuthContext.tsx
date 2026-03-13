"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { InteractionManager, Platform } from "react-native";
import type { User } from "@supabase/supabase-js";
import * as AppleAuthentication from "expo-apple-authentication";
import { supabase } from "../config/supabase";
import { syncPushSubscriptionOnAppOpen } from "../lib/pushSubscription";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

const DEV_USER: User = {
  id: "dev-user",
  app_metadata: {},
  user_metadata: {},
  aud: "authenticated",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  email: "dev@dailyq.local",
  email_confirmed_at: new Date().toISOString(),
} as User;

function getCurrentUser(user: User | null): User | null {
  if (user) return user;
  if (__DEV__) return DEV_USER;
  return null;
}

type AuthContextValue = {
  user: User | null;
  /** In dev, when no real session: dev-user. Otherwise same as user. */
  effectiveUser: User | null;
  /** True only after the initial getUser() has completed. Use to show minimal UI until then. */
  authCheckDone: boolean;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithPassword: (
    email: string,
    password: string
  ) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  /** Calls delete_user RPC then signOut. */
  deleteUser: () => Promise<{ error: Error | null }>;
  /** Sign in with Apple (iOS). Gets identity token, sends to Edge Function, sets session. */
  signInWithApple: () => Promise<{ error: Error | null }>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authCheckDone, setAuthCheckDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const initAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!cancelled) {
          setUser(session?.user ?? null);
          setAuthCheckDone(true);
        }
      } catch (e) {
        if (!cancelled) {
          setUser(null);
        }
        console.error("Auth init error:", e);
      } finally {
        if (!cancelled) {
          setAuthCheckDone(true);
          setLoading(false);
        }
      }
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setUser(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // Re-sync push token on every app open so NULL expo_push_token in DB gets filled.
  useEffect(() => {
    if (!user?.id || user.id === "dev-user") return;
    const handle = InteractionManager.runAfterInteractions(() => {
      syncPushSubscriptionOnAppOpen(user.id).catch((e) => {
        console.error("[AuthContext] syncPushSubscriptionOnAppOpen failed:", e);
      });
    });
    return () => handle.cancel();
  }, [user?.id]);

  const signUp = useCallback(
    async (email: string, password: string) => {
      try {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
        });
        return { error: error ?? null };
      } catch (e) {
        return { error: e instanceof Error ? e : new Error(String(e)) };
      }
    },
    []
  );

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        });
        return { error: error ?? null };
      } catch (e) {
        return { error: e instanceof Error ? e : new Error(String(e)) };
      }
    },
    []
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const deleteUser = useCallback(async () => {
    try {
      const { error } = await supabase.rpc("delete_user");
      if (error) return { error };
      await supabase.auth.signOut();
      setUser(null);
      return { error: null };
    } catch (e) {
      return {
        error: e instanceof Error ? e : new Error(String(e)),
      };
    }
  }, []);

  const signInWithApple = useCallback(async () => {
    if (Platform.OS !== "ios") {
      return { error: new Error("Sign in with Apple is only available on iOS") };
    }
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const identityToken = credential.identityToken;
      if (!identityToken) {
        return { error: new Error("Apple did not return an identity token") };
      }
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        return { error: new Error("Supabase configuration missing") };
      }
      const url = `${SUPABASE_URL}/functions/v1/verify-apple-token`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          identityToken,
          user: credential.user,
          fullName: credential.fullName
            ? {
                givenName: credential.fullName.givenName ?? undefined,
                familyName: credential.fullName.familyName ?? undefined,
              }
            : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = data?.error ?? data?.message ?? res.statusText;
        return { error: new Error(String(message)) };
      }
      const access_token = data.access_token;
      const refresh_token = data.refresh_token;
      if (!access_token || !refresh_token) {
        return {
          error: new Error(
            data?.error ?? "verify-apple-token not implemented"
          ),
        };
      }
      const { error } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });
      if (error) return { error };
      return { error: null };
    } catch (e) {
      if (e && typeof e === "object" && "code" in e) {
        const code = (e as { code: string }).code;
        if (code === "ERR_REQUEST_CANCELED") {
          return { error: null };
        }
      }
      return {
        error: e instanceof Error ? e : new Error(String(e)),
      };
    }
  }, []);

  const effectiveUser = getCurrentUser(user);

  const value: AuthContextValue = {
    user,
    effectiveUser,
    authCheckDone,
    loading,
    signUp,
    signInWithPassword,
    signOut,
    deleteUser,
    signInWithApple,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

/** Hook for Apple Sign In with loading and error state. Use on the auth screen. */
export function useAppleSignIn(): {
  signInWithApple: () => Promise<{ error: Error | null }>;
  loading: boolean;
  error: Error | null;
  clearError: () => void;
} {
  const { signInWithApple: doSignIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const signInWithApple = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const { error: err } = await doSignIn();
      if (err) setError(err);
      return { error: err };
    } finally {
      setLoading(false);
    }
  }, [doSignIn]);

  const clearError = useCallback(() => setError(null), []);

  return { signInWithApple, loading, error, clearError };
}
