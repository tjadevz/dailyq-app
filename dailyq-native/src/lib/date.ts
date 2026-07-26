/**
 * Returns the current date. In React Native we don't use __DEV_DATE__; extend if needed.
 */
export function getNow(): Date {
  return new Date();
}

/** YYYY-MM-DD in local timezone */
export function getLocalDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** YYYY-MM-DD for the day before `reference` (local calendar). */
export function getYesterdayDayKey(reference: Date = getNow()): string {
  const d = new Date(reference);
  d.setDate(d.getDate() - 1);
  return getLocalDayKey(d);
}

/** Day of year 1–366 from YYYY-MM-DD (leap-aware). For display e.g. #001–#366. */
export function getDayOfYear(dayKey: string): number {
  const [y, m, d] = dayKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const start = new Date(y, 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

/** Days between two YYYY-MM-DD day keys (positive = fromKey is earlier). */
export function daysBetween(fromKey: string, toKey: string): number {
  return Math.round(
    (new Date(toKey + "T12:00:00").getTime() - new Date(fromKey + "T12:00:00").getTime()) /
      (1000 * 60 * 60 * 24)
  );
}

export function isMonday(date: Date): boolean {
  return date.getDay() === 1;
}

/** Previous week (Mon–Sun) as day keys. */
export function getPreviousWeekRange(today: Date): { start: string; end: string } {
  const daysSinceMonday = (today.getDay() + 6) % 7;
  const lastMonday = new Date(today);
  lastMonday.setDate(lastMonday.getDate() - 7 - daysSinceMonday);
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastSunday.getDate() + 6);
  return {
    start: getLocalDayKey(lastMonday),
    end: getLocalDayKey(lastSunday),
  };
}

export function getAnswerableDaysInRange(
  startDayKey: string,
  endDayKey: string,
  userCreatedAt: string | undefined
): number {
  const createdKey = userCreatedAt ? getLocalDayKey(new Date(userCreatedAt)) : null;
  let count = 0;
  const start = new Date(startDayKey + "T12:00:00");
  const end = new Date(endDayKey + "T12:00:00");
  const cur = new Date(start);
  while (cur <= end) {
    const dk = getLocalDayKey(cur);
    if (!createdKey || dk >= createdKey) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}
