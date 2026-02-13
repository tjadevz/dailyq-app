/**
 * Central date provider for the app.
 * In development, supports a global override for testing date-based logic (e.g. Monday Recap).
 *
 * Usage in browser console (dev only):
 *   globalThis.__DEV_DATE__ = "2026-02-16T10:00:00";  // simulate Monday
 *   globalThis.__DEV_DATE__ = undefined;              // reset to real date
 * Then refresh the page.
 */

declare global {
  // eslint-disable-next-line no-var
  var __DEV_DATE__: string | undefined;
}

/**
 * Returns the current date/time. In production always returns new Date().
 * In development, if globalThis.__DEV_DATE__ is set (ISO string), returns that date
 * so you can simulate any day (e.g. Monday) for testing recap and rolling-window logic.
 */
export function getNow(): Date {
  if (process.env.NODE_ENV === "development" && typeof globalThis.__DEV_DATE__ === "string") {
    const override = new Date(globalThis.__DEV_DATE__);
    if (!Number.isNaN(override.getTime())) {
      return override;
    }
  }
  return new Date();
}
