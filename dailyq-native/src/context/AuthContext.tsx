"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { InteractionManager } from "react-native";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../config/supabase";
import { syncPushSubscriptionOnAppOpen } from "../lib/pushSubscription";

// #region agent log
function logAuth(id: string, message: string, data: Record<string, unknown>) {
  fetch("http://127.0.0.1:7243/ingest/8b229217-1871-4da8-8258-2778d0f3e809", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "332a30" },
    body: JSON.stringify({ sessionId: "332a30", runId: "run1", hypothesisId: id, location: "AuthContext.tsx", message, data, timestamp: Date.now() }),
  }).catch(() => {});
}
// #endregion

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
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authCheckDone, setAuthCheckDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const t0 = Date.now();
    // #region agent log
    logAuth("H2", "initAuth start", { ts: t0 });
    // #endregion

    const initAuth = async () => {
      try {
        const {
          data: { user: u },
        } = await supabase.auth.getUser();
        // #region agent log
        logAuth("H2", "getUser returned", { ts: Date.now(), elapsed: Date.now() - t0, hasUser: !!u });
        // #endregion
        if (!cancelled) {
          setUser(u ?? null);
          setAuthCheckDone(true);
        }
      } catch (e) {
        if (!cancelled) setUser(null);
        console.error("Auth init error:", e);
      } finally {
        if (!cancelled) {
          setAuthCheckDone(true);
          setLoading(false);
          // #region agent log
          logAuth("H1", "authCheckDone set", { ts: Date.now(), elapsed: Date.now() - t0 });
          // #endregion
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

  useEffect(() => {
    if (!user?.id || user.id === "dev-user") return;
    const handle = InteractionManager.runAfterInteractions(() => {
      // #region agent log
      const t0 = Date.now();
      logAuth("H3", "syncPushSubscriptionOnAppOpen start (after interactions)", { userId: user.id, ts: t0 });
      // #endregion
      syncPushSubscriptionOnAppOpen(user.id).then(() => {
        // #region agent log
        logAuth("H3", "syncPushSubscriptionOnAppOpen done", { elapsed: Date.now() - t0 });
        // #endregion
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
