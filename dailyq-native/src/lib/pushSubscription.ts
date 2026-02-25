import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/src/config/supabase";
import { getExpoPushTokenAsync } from "@/src/native/notifications";

const REMINDER_TIME_KEY = "dailyq-reminder-time";
const EXPO_TOKEN_KEY = "dailyq_expo_push_token";

export type ReminderTime = "morning" | "afternoon" | "evening";

/**
 * Upsert push_subscriptions for the current user with expo_push_token and reminder_time.
 * Call after successful auth (onboarding) or on app open to keep token/choice in sync.
 */
export async function upsertPushSubscription(
  userId: string,
  expoPushToken: string | null,
  reminderTime: ReminderTime | null
): Promise<{ error: Error | null }> {
  if (userId === "dev-user") return { error: null };

  try {
    const payload = {
      user_id: userId,
      subscription: {},
      expo_push_token: expoPushToken,
      reminder_time: reminderTime,
    };

    console.log("push_subscriptions upsert call", {
      payload,
      onConflict: "user_id",
    });
    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(payload, { onConflict: "user_id" });

    if (error) {
      console.warn("push_subscriptions upsert error", error.message, error.details, error.code);
      return { error };
    }
    return { error: null };
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.warn("push_subscriptions upsert exception", err);
    return { error: err };
  }
}

/**
 * Get current Expo push token (after permission), then upsert to Supabase with stored reminder time.
 * Call on app open when user is logged in to refresh token if needed.
 */
export async function syncPushSubscriptionOnAppOpen(userId: string): Promise<void> {
  if (userId === "dev-user") return;

  try {
    const token = await getExpoPushTokenAsync();
    const reminderTime = (await AsyncStorage.getItem(REMINDER_TIME_KEY)) as ReminderTime | null;
    const validReminder = reminderTime === "morning" || reminderTime === "afternoon" || reminderTime === "evening"
      ? reminderTime
      : null;

    await upsertPushSubscription(userId, token, validReminder);
  } catch (e) {
    if (__DEV__) console.warn("Push subscription sync error:", e);
  }
}

/**
 * Store Expo push token in AsyncStorage (e.g. after onboarding step 3, before auth).
 * Later we read it after auth and persist to Supabase.
 */
export async function setStoredExpoPushToken(token: string | null): Promise<void> {
  if (token) await AsyncStorage.setItem(EXPO_TOKEN_KEY, token);
  else await AsyncStorage.removeItem(EXPO_TOKEN_KEY);
}

/**
 * Read Expo push token from AsyncStorage (e.g. after auth in onboarding).
 */
export async function getStoredExpoPushToken(): Promise<string | null> {
  return AsyncStorage.getItem(EXPO_TOKEN_KEY);
}
