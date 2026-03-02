import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";

const PROJECT_ID = "9418d4f1-3d4b-4492-b37d-6a31b50ed5da";

/**
 * Request notification permissions and return the Expo push token.
 * Returns null if permissions are denied or the token cannot be obtained
 * (e.g. on simulators without a push-capable environment).
 */
export async function getExpoPushTokenAsync(): Promise<string | null> {
  if (Platform.OS === "web") return null;

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? PROJECT_ID;
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch (e) {
    if (__DEV__) console.warn("[notifications] getExpoPushTokenAsync:", e);
    return null;
  }
}

/**
 * Full registration: set up Android channel, request permission, return token.
 * Call this during onboarding (notifications step) so the system permission
 * dialog fires at the right moment.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "DailyQ",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#8B5CF6",
      });
    }

    return await getExpoPushTokenAsync();
  } catch (e) {
    if (__DEV__) console.warn("[notifications] registerForPushNotificationsAsync:", e);
    return null;
  }
}
