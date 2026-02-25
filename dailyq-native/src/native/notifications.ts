import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import type { BridgeMessage } from "../config/messageProtocol";

const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;

/**
 * Requests notification permission and fetches the Expo push token for the native app.
 * Use in onboarding (step 3) and when syncing on app open. Returns null if permission denied or no projectId.
 */
export async function getExpoPushTokenAsync(): Promise<string | null> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let status = existingStatus;
    if (existingStatus !== "granted") {
      const { status: newStatus } = await Notifications.requestPermissionsAsync();
      status = newStatus;
    }
    if (status !== "granted") return null;

    if (!projectId) {
      if (__DEV__) console.warn("Push: no EAS projectId in app config");
      return null;
    }

    const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenResult?.data ?? null;
  } catch (e) {
    if (__DEV__) console.warn("Push token error:", e);
    return null;
  }
}

/**
 * Requests notification permission, fetches the Expo push token, and sends it to the WebView via the bridge.
 * Call after the WebView has loaded so the bridge is ready.
 */
export async function registerForPushNotificationsAsync(
  sendToWebView: (message: BridgeMessage) => void
): Promise<string | null> {
  const token = await getExpoPushTokenAsync();
  if (token) sendToWebView({ type: "PUSH_TOKEN", payload: { token } });
  return token;
}
