export type AccountMilestoneFlags = {
  milestone_10_days_shown: boolean;
  milestone_30_days_shown: boolean;
  milestone_100_days_shown: boolean;
};

/**
 * Whole **calendar** days since the account creation **date** in the device local timezone
 * (midnight-to-midnight), not raw 24h blocks from the exact timestamp.
 * E.g. created Mar 11 → on Mar 22 this returns 11, even if the ISO time-of-day would
 * yield only ~10.x × 24h with floor(ms/86400000).
 */
export function daysSinceAccountCreated(createdAt: string | Date | null | undefined): number {
  if (createdAt == null) return 0;
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) return 0;
  const createdDay = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = today.getTime() - createdDay.getTime();
  return Math.max(0, Math.floor(diffMs / 86400000));
}

/**
 * Day-10 account milestone only (30/100 reserved in DB for future use).
 */
export function resolveAccountMilestone(
  createdAt: string | Date | null | undefined,
  flags: AccountMilestoneFlags
): 10 | null {
  if (createdAt == null) return null;
  const daysSinceCreation = daysSinceAccountCreated(createdAt);
  if (daysSinceCreation >= 10 && !flags.milestone_10_days_shown) return 10;
  return null;
}
