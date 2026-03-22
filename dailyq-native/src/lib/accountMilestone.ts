export type AccountMilestoneFlags = {
  milestone_10_days_shown: boolean;
  milestone_30_days_shown: boolean;
  milestone_100_days_shown: boolean;
};

/**
 * First matching milestone in order 10 → 30 → 100, or null.
 */
export function resolveAccountMilestone(
  createdAt: string | Date | null | undefined,
  flags: AccountMilestoneFlags
): 10 | 30 | 100 | null {
  if (createdAt == null) return null;
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return null;
  const daysSinceCreation = Math.floor((Date.now() - t) / 86400000);
  const m10 = flags.milestone_10_days_shown ?? false;
  const m30 = flags.milestone_30_days_shown ?? false;
  const m100 = flags.milestone_100_days_shown ?? false;
  if (daysSinceCreation >= 10 && !m10) return 10;
  if (daysSinceCreation >= 30 && !m30) return 30;
  if (daysSinceCreation >= 100 && !m100) return 100;
  return null;
}
