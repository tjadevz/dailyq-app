import type { BridgeMessage } from "../config/messageProtocol";

/**
 * DISABLED: expo-notifications removed to isolate TestFlight crash (TurboModule exception).
 * Stubs return null / no-op so callers do not break.
 */

export async function getExpoPushTokenAsync(): Promise<string | null> {
  return null;
}

export async function registerForPushNotificationsAsync(
  _sendToWebView: (message: BridgeMessage) => void
): Promise<string | null> {
  return null;
}
