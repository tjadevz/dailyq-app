import type { RedirectSystemPathOptions } from "expo-router";

/**
 * Expo Router may not be able to deterministically map native deep links
 * (scheme://host/path) to your file-based routes.
 *
 * We normalize `dailyq://invite/<CODE>` into the Expo Router route path
 * `/invite/<CODE>` so it matches `app/invite/[code].tsx`.
 */
export function redirectSystemPath({
  path,
}: RedirectSystemPathOptions): string {
  try {
    const p = String(path);

    // Attempt to parse as a full URL first (expected: dailyq://invite/abcd).
    let url: URL | null = null;
    try {
      url = new URL(p);
    } catch {
      // Fallback: parse as a path-like string using a dummy scheme.
      url = new URL(p, "dailyq://dummy");
    }

    const hostname = url.hostname;
    const pathname = url.pathname ?? "";

    // iOS can URL-encode parts of the path (e.g. `/%2Finvite/abcd`).
    // Decode once or a few times so we can reliably match `/invite/<code>`.
    let pathnameDecoded = pathname;
    for (let i = 0; i < 3; i++) {
      try {
        pathnameDecoded = decodeURIComponent(pathnameDecoded);
      } catch {
        break;
      }
    }

    if (hostname === "invite") {
      const code = pathnameDecoded.replace(/^\/+/, "");
      if (code) return `/invite/${code}`;
      return path;
    }

    // Extra safety: handle cases where parsing lost the hostname and we only
    // see `/invite/<code>` in the pathname.
    const invitePrefix = "/invite/";
    if (pathnameDecoded.startsWith(invitePrefix)) {
      const code = pathnameDecoded.slice(invitePrefix.length);
      if (code) return `/invite/${code}`;
    }

    return path;
  } catch {
    // Never throw inside redirectSystemPath.
    return path;
  }
}

