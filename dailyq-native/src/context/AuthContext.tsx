"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../config/supabase";
import { syncPushSubscriptionOnAppOpen } from "../lib/pushSubscription";

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const initAuth = async () => {
      try {
        const {
          data: { user: u },
        } = await supabase.auth.getUser();

        if (!cancelled) {
          setUser(u ?? null);
        }
      } catch (e) {
        if (!cancelled) setUser(null);
        console.error("Auth init error:", e);
      } finally {
        if (!cancelled) setLoading(false);
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
    syncPushSubscriptionOnAppOpen(user.id);
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
