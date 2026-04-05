import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";

import { setPendingReferralCode } from "@/src/lib/referralPending";

const FIRST_LAUNCH_CLIPBOARD_KEY = "dailyq_first_launch_clipboard_referral_done";

/** Matches server-generated codes: 8 chars from a-z and 0-9 (see generate_referral_code). */
const REFERRAL_CODE_PATTERN = /^[a-z0-9]{8}$/;

function normalizeClipboardReferralCode(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length !== 8) return null;
  const lower = trimmed.toLowerCase();
  return REFERRAL_CODE_PATTERN.test(lower) ? lower : null;
}

/**
 * On cold start, read clipboard until we either consume a valid referral code or confirm the
 * clipboard had no string. Unrelated text is left untouched; we retry on the next launch.
 */
export async function tryConsumeReferralFromClipboardOnFirstLaunch(): Promise<void> {
  try {
    const alreadyDone = await AsyncStorage.getItem(FIRST_LAUNCH_CLIPBOARD_KEY);
    if (alreadyDone === "1") return;

    let has: boolean;
    try {
      has = await Clipboard.hasStringAsync();
    } catch {
      return;
    }

    if (!has) {
      await AsyncStorage.setItem(FIRST_LAUNCH_CLIPBOARD_KEY, "1");
      return;
    }

    let content: string;
    try {
      content = await Clipboard.getStringAsync();
    } catch {
      return;
    }

    const code = normalizeClipboardReferralCode(content);
    if (!code) {
      return;
    }

    await setPendingReferralCode(code);
    try {
      await Clipboard.setStringAsync("");
    } catch {
      // non-fatal
    }
    await AsyncStorage.setItem(FIRST_LAUNCH_CLIPBOARD_KEY, "1");
  } catch {
    // no-op: do not set done flag so we can retry
  }
}
