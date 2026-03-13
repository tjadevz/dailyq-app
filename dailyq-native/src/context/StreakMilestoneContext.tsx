import React, { createContext, useCallback, useContext, useState } from "react";
import { useLanguage } from "@/src/context/LanguageContext";
import { StreakCelebrationModal, type StreakMilestone } from "@/src/components/StreakCelebrationModal";

type StreakMilestoneState = {
  open: boolean;
  milestone: StreakMilestone | null;
};

type StreakMilestoneContextValue = StreakMilestoneState & {
  showMilestone: (milestone: StreakMilestone) => void;
  hideMilestone: () => void;
};

const StreakMilestoneContext = createContext<StreakMilestoneContextValue | null>(null);

export function StreakMilestoneProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StreakMilestoneState>({ open: false, milestone: null });
  const { t } = useLanguage();

  const showMilestone = useCallback((milestone: StreakMilestone) => {
    setState({ open: true, milestone });
  }, []);

  const hideMilestone = useCallback(() => {
    setState({ open: false, milestone: null });
  }, []);

  return (
    <StreakMilestoneContext.Provider
      value={{
        ...state,
        showMilestone,
        hideMilestone,
      }}
    >
      {children}
      <StreakCelebrationModal
        visible={state.open}
        milestone={state.milestone}
        onClose={hideMilestone}
        t={t}
      />
    </StreakMilestoneContext.Provider>
  );
}

export function useStreakMilestone(): StreakMilestoneContextValue {
  const ctx = useContext(StreakMilestoneContext);
  if (!ctx) throw new Error("useStreakMilestone must be used within StreakMilestoneProvider");
  return ctx;
}

/** Milestones we check for (order: ascending). */
export const STREAK_MILESTONES = [7, 14, 30, 60, 100, 180, 365] as const;

/** Joker count per milestone (7→1, 14→1, 30→2, 60→2, 100→3, 180→4, 365→5). */
export const JOKER_COUNT_BY_MILESTONE: Record<number, number> = {
  7: 1,
  14: 1,
  30: 2,
  60: 2,
  100: 3,
  180: 4,
  365: 5,
};

/**
 * Returns the highest milestone crossed when going from previousStreak to newStreak.
 * Uses >= : e.g. prev 6, new 7 → 7; prev 6, new 30 → 30.
 */
export function getHighestMilestoneCrossed(previousStreak: number, newStreak: number): (typeof STREAK_MILESTONES)[number] | null {
  let highest: (typeof STREAK_MILESTONES)[number] | null = null;
  for (const m of STREAK_MILESTONES) {
    if (previousStreak < m && newStreak >= m) {
      highest = m;
    }
  }
  return highest;
}

/**
 * Returns all milestones crossed (for granting jokers for each).
 */
export function getMilestonesCrossed(previousStreak: number, newStreak: number): (typeof STREAK_MILESTONES)[number][] {
  return STREAK_MILESTONES.filter((m) => previousStreak < m && newStreak >= m);
}

/** Row shape when selecting from user_milestone_grants (streak_at_grant may be added by migration). */
type UserMilestoneGrantRow = { milestone: number; streak_at_grant?: number | null };

/** Minimal Supabase-like client for fetching grants and calling RPC. */
type SupabaseLike = {
  from: (table: string) => { select: (cols: string) => { eq: (col: string, value: string) => PromiseLike<{ data: UserMilestoneGrantRow[] | null; error: unknown }> } };
  rpc: (fn: string, params: { p_user_id: string; p_milestone: number; p_streak_at_grant?: number }) => Promise<{ error: unknown }>;
};

/**
 * Fetches user_milestone_grants for the given user and returns which milestones
 * are already granted in the current streak cycle. A milestone M counts as
 * "already granted in this cycle" if there is a row with streak_at_grant >= M.
 * If streak_at_grant is missing (legacy row), that row's milestone is considered granted.
 */
export async function getAlreadyGrantedInCycle(
  supabase: SupabaseLike,
  userId: string,
  _currentStreak: number
): Promise<Set<number>> {
  const granted = new Set<number>();
  const { data: rows, error } = await supabase
    .from("user_milestone_grants")
    .select("milestone, streak_at_grant")
    .eq("user_id", userId);
  if (error || !rows) return granted;
  for (const row of rows as UserMilestoneGrantRow[]) {
    const streakAtGrant = row.streak_at_grant;
    if (streakAtGrant != null) {
      for (const m of STREAK_MILESTONES) {
        if (streakAtGrant >= m) granted.add(m);
      }
    } else {
      granted.add(row.milestone);
    }
  }
  return granted;
}

/**
 * Grants milestone jokers for all newly crossed milestones that are not already
 * granted in the current cycle. Passes newStreak as third argument.
 * Wrapped in try/catch per call: logs errors but does not throw.
 * @returns true if every grant succeeded (or there was nothing to grant), false if any failed.
 */
export async function grantMilestoneJokersForCrossed(
  supabase: SupabaseLike,
  userId: string,
  previousStreak: number,
  newStreak: number
): Promise<boolean> {
  const crossed = getMilestonesCrossed(previousStreak, newStreak);
  console.log("[StreakMilestone] crossed", crossed);

  const alreadyGranted = await getAlreadyGrantedInCycle(supabase, userId, newStreak);
  console.log("[StreakMilestone] alreadyGrantedInCycle (weggefilterd)", Array.from(alreadyGranted));

  const toGrant = crossed.filter((m) => !alreadyGranted.has(m));
  for (const m of toGrant) {
    try {
      console.log("[StreakMilestone] calling grant_milestone_jokers", {
        user_id: userId,
        milestone: m,
        newStreak,
      });
      const { error } = await supabase.rpc("grant_milestone_jokers", {
        p_user_id: userId,
        p_milestone: m,
        p_streak_at_grant: newStreak,
      });
      console.log("[StreakMilestone] grant_milestone_jokers result", { milestone: m, error });
      if (error) throw error;
    } catch (e) {
      console.error("[StreakMilestone] grant_milestone_jokers failed", {
        userId,
        milestone: m,
        newStreak,
        error: e,
      });
      return false;
    }
  }
  return true;
}
