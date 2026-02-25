import { useCallback, useEffect, useState } from "react";
import { getNow } from "../lib/date";
import { supabase } from "../config/supabase";

export type Profile = {
  id: string;
  joker_balance: number;
  last_joker_grant_month: string | null;
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
          last_joker_grant_month: null,
        });
        return { id: "dev-user", joker_balance: 99, last_joker_grant_month: null };
      }
      setProfile(null);
      return null;
    }

    const { data: prof, error: fetchErr } = await supabase
      .from("profiles")
      .select("id, joker_balance, last_joker_grant_month")
      .eq("id", userId)
      .maybeSingle();

    if (fetchErr) {
      console.error("Profile fetch error:", fetchErr);
      return null;
    }

    const currentMonth = getNow().toISOString().slice(0, 7);
    const lastGrant = (prof as Profile | null)?.last_joker_grant_month ?? null;

    if (lastGrant !== currentMonth) {
      const { error: rpcErr } = await supabase.rpc("grant_monthly_jokers");
      if (!rpcErr) {
        const { data: refetched } = await supabase
          .from("profiles")
          .select("id, joker_balance, last_joker_grant_month")
          .eq("id", userId)
          .single();
        if (refetched) {
          setProfile(refetched as Profile);
          return refetched as Profile;
        }
      }
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
