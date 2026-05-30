import { getLocalDayKey, getNow } from "@/src/lib/date";

/** Number of historical days in the onboarding question flow (incl. today). */
export const ONBOARDING_QUESTION_COUNT = 3;

/** First onboarding day offset from reference: today-2 (day before yesterday). */
export const ONBOARDING_FIRST_DAY_OFFSET = 2;

/**
 * Onboarding question dates: day before yesterday, yesterday, and today (local calendar).
 * Anchored to "now" so copy matches eergisteren / gisteren / vandaag.
 */
export function getOnboardingQuestionDayKeys(
  reference: Date = getNow()
): string[] {
  const keys: string[] = [];
  for (let daysBefore = ONBOARDING_FIRST_DAY_OFFSET; daysBefore >= 0; daysBefore--) {
    const d = new Date(reference);
    d.setDate(d.getDate() - daysBefore);
    keys.push(getLocalDayKey(d));
  }
  return keys;
}

/** First calendar day users may answer after onboarding (same as first onboarding question). */
export function getOnboardingWindowStartKey(reference: Date = getNow()): string {
  return getOnboardingQuestionDayKeys(reference)[0];
}

export function isOnboardingQuestionDay(
  dayKey: string,
  reference: Date = getNow()
): boolean {
  return getOnboardingQuestionDayKeys(reference).includes(dayKey);
}
