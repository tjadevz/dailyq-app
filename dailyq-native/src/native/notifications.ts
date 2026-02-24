/**
 * Placeholder for push notifications.
 * When fully configured: request permissions, get Expo push token, then send to WebView
 * via bridge: sendToWebView(ref, { type: 'PUSH_TOKEN', payload: { token } }).
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  return Promise.resolve(null);
}
