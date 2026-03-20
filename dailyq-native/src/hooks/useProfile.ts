import { useCallback, useEffect, useState } from "react";
import { supabase } from "../config/supabase";

export type Profile = {
  id: string;
  joker_balance: number;
  language: string;
};

export function useProfile(userId: string | null): {
  profile: Profile | null;
  refetch: () => Promise<Profile | null>;
} {
  const [profile, setProfile] = useState<Profile | null>(null);

  const refetch = useCallback(async (): Promise<Profile | null> => {
    if (!userId || userId === "dev-user") {
      if (userId === "dev-user") {
        setProfile({
          id: "dev-user",
          joker_balance: 99,
          language: "nl",
        });
        return { id: "dev-user", joker_balance: 99, language: "nl" };
      }
      setProfile(null);
      return null;
    }

    const { data: prof, error: fetchErr } = await supabase
      .from("profiles")
      .select("id, joker_balance, language")
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

  return { profile, refetch };
}
