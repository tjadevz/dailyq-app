import AsyncStorage from "@react-native-async-storage/async-storage";

const NOTIFICATIONS_DONE_PREFIX = "dailyq-onboarding-notifications-done:";
const WIDGET_DONE_PREFIX = "dailyq-onboarding-widget-done:";

function notificationsDoneKey(userId: string): string {
  return `${NOTIFICATIONS_DONE_PREFIX}${userId}`;
}

function widgetDoneKey(userId: string): string {
  return `${WIDGET_DONE_PREFIX}${userId}`;
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

export async function getOnboardingWidgetDone(userId: string): Promise<boolean> {
  const value = await AsyncStorage.getItem(widgetDoneKey(userId));
  return value === "1";
}

export async function setOnboardingWidgetDone(userId: string): Promise<void> {
  await AsyncStorage.setItem(widgetDoneKey(userId), "1");
}

export async function clearOnboardingWidgetDone(userId: string): Promise<void> {
  await AsyncStorage.removeItem(widgetDoneKey(userId));
}

/** Post-auth onboarding entry: notifications, then the widget step, then historical questions. */
export async function getIncompleteOnboardingHref(userId: string): Promise<string> {
  const notificationsDone = await getOnboardingNotificationsDone(userId);
  if (!notificationsDone) return "/(tabs)/onboarding-notifications";
  const widgetDone = await getOnboardingWidgetDone(userId);
  if (!widgetDone) return "/(tabs)/onboarding-widget";
  return "/(tabs)/onboarding-questions";
}
