import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { getNow, getLocalDayKey } from "../lib/date";
import { supabase } from "../config/supabase";
import { useAuth } from "./AuthContext";

export type Profile = {
  id: string;
  joker_balance: number;
  last_joker_grant_month: string | null;
  language: string;
};

type ProfileContextValue = {
  profile: Profile | null;
  refetch: () => Promise<Profile | null>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { effectiveUser } = useAuth();
  const userId = effectiveUser?.id ?? null;
  const [profile, setProfile] = useState<Profile | null>(null);
  const grantInFlightRef = useRef(false);

  const refetch = useCallback(async (): Promise<Profile | null> => {
    if (!userId || userId === "dev-user") {
      if (userId === "dev-user") {
        setProfile({
          id: "dev-user",
          joker_balance: 99,
          last_joker_grant_month: null,
          language: "nl",
        });
        return { id: "dev-user", joker_balance: 99, last_joker_grant_month: null, language: "nl" };
      }
      setProfile(null);
      return null;
    }

    const { data: prof, error: fetchErr } = await supabase
      .from("profiles")
      .select("id, joker_balance, last_joker_grant_month, language")
      .eq("id", userId)
      .maybeSingle();

    if (fetchErr) {
      console.error("Profile fetch error:", fetchErr);
      return null;
    }

    const currentMonth = getLocalDayKey(getNow()).slice(0, 7);
    const lastGrant = (prof as Profile | null)?.last_joker_grant_month ?? null;

    if (lastGrant !== currentMonth && !grantInFlightRef.current) {
      grantInFlightRef.current = true;
      try {
        const { error: rpcErr } = await supabase.rpc("grant_monthly_jokers");
        if (!rpcErr) {
          const { data: refetched } = await supabase
            .from("profiles")
            .select("id, joker_balance, last_joker_grant_month, language")
            .eq("id", userId)
            .single();
          if (refetched) {
            setProfile(refetched as Profile);
            return refetched as Profile;
          }
        }
      } finally {
        grantInFlightRef.current = false;
      }
    }

    const p = (prof ?? null) as Profile | null;
    setProfile(p);
    return p;
  }, [userId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return (
    <ProfileContext.Provider value={{ profile, refetch }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfileContext(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfileContext must be used within ProfileProvider");
  return ctx;
}
