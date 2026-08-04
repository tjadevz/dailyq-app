import { daysSinceAccountCreated } from "@/src/lib/accountMilestone";

/**
 * Day-4 in-app "archive moment" (answers-so-far preview), no joker involved.
 * Signup day = day 1, so day 4 is daysSinceAccountCreated === 3. Uses a
 * catch-up threshold (>= 3, no upper bound) rather than an exact match —
 * same pattern as resolveAccountMilestone's day-10 check — so a user who
 * doesn't submit on exactly day 4 (missed day, or the feature reaching
 * their device via OTA after day 4 already passed) still gets it on their
 * next submission instead of missing the one-shot window forever.
 */
export function shouldShowArchiveMoment(
  createdAt: string | Date | null | undefined,
  alreadyShown: boolean
): boolean {
  if (createdAt == null || alreadyShown) return false;
  return daysSinceAccountCreated(createdAt) >= 3;
}
