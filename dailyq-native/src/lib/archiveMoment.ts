import { daysSinceAccountCreated } from "@/src/lib/accountMilestone";

/**
 * Day-4 in-app "archive moment" (answers-so-far preview), no joker involved.
 * Signup day = day 1, so day 4 is daysSinceAccountCreated === 3.
 */
export function shouldShowArchiveMoment(
  createdAt: string | Date | null | undefined,
  alreadyShown: boolean
): boolean {
  if (createdAt == null || alreadyShown) return false;
  return daysSinceAccountCreated(createdAt) === 3;
}
