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
export const STREAK_MILESTONES = [7, 30, 60, 100, 180, 365] as const;

/** Joker count per milestone (7→1, 30→2, 60→2, 100→3, 180→4, 365→5). */
export const JOKER_COUNT_BY_MILESTONE: Record<number, number> = {
  7: 1,
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
