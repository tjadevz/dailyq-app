/** Milestones we check for (order: ascending). */
export const STREAK_MILESTONES = [7, 14, 30, 60, 100, 180, 365] as const;
export type StreakMilestone = (typeof STREAK_MILESTONES)[number];

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
