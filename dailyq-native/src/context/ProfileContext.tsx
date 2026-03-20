import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "../config/supabase";
import { useAuth } from "./AuthContext";

export type Profile = {
  id: string;
  joker_balance: number;
  language: string;
  onboarding_completed: boolean;
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

  const refetch = useCallback(async (): Promise<Profile | null> => {
    if (!userId || userId === "dev-user") {
      if (userId === "dev-user") {
        setProfile({
          id: "dev-user",
          joker_balance: 99,
          language: "nl",
          onboarding_completed: true,
        });
        return { id: "dev-user", joker_balance: 99, language: "nl", onboarding_completed: true };
      }
      setProfile(null);
      return null;
    }

    const { data: prof, error: fetchErr } = await supabase
      .from("profiles")
      .select("id, joker_balance, language, onboarding_completed")
      .eq("id", userId)
      .maybeSingle();

    if (fetchErr) {
      console.error("Profile fetch error:", fetchErr);
      return null;
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
