import AsyncStorage from "@react-native-async-storage/async-storage";

const NOTIFICATIONS_DONE_PREFIX = "dailyq-onboarding-notifications-done:";

function notificationsDoneKey(userId: string): string {
  return `${NOTIFICATIONS_DONE_PREFIX}${userId}`;
}

export async function getOnboardingNotificationsDone(userId: string): Promise<boolean> {
  const value = await AsyncStorage.getItem(notificationsDoneKey(userId));
  return value === "1";
}

export async function setOnboardingNotificationsDone(userId: string): Promise<void> {
  await AsyncStorage.setItem(notificationsDoneKey(userId), "1");
}

export async function clearOnboardingNotificationsDone(userId: string): Promise<void> {
  await AsyncStorage.removeItem(notificationsDoneKey(userId));
}

/** Post-auth onboarding entry: notifications first, then historical questions. */
export async function getIncompleteOnboardingHref(userId: string): Promise<string> {
  const notificationsDone = await getOnboardingNotificationsDone(userId);
  return notificationsDone
    ? "/(tabs)/onboarding-questions"
    : "/(tabs)/onboarding-notifications";
}
