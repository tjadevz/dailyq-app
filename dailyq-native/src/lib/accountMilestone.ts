export type AccountMilestoneFlags = {
  milestone_10_days_shown: boolean;
  milestone_30_days_shown: boolean;
  milestone_100_days_shown: boolean;
};

/**
 * Day-10 account milestone only (30/100 reserved in DB for future use).
 */
export function resolveAccountMilestone(
  createdAt: string | Date | null | undefined,
  flags: AccountMilestoneFlags
): 10 | null {
  if (createdAt == null) return null;
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return null;
  const daysSinceCreation = Math.floor((Date.now() - t) / 86400000);
  if (daysSinceCreation >= 10 && !flags.milestone_10_days_shown) return 10;
  return null;
}
