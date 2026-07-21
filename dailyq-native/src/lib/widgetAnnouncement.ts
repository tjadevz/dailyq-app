import AsyncStorage from "@react-native-async-storage/async-storage";

const WIDGET_ANNOUNCEMENT_DISMISSED_PREFIX = "dailyq-widget-announcement-dismissed:";

function widgetAnnouncementDismissedKey(userId: string): string {
  return `${WIDGET_ANNOUNCEMENT_DISMISSED_PREFIX}${userId}`;
}

export async function getWidgetAnnouncementDismissed(userId: string): Promise<boolean> {
  const value = await AsyncStorage.getItem(widgetAnnouncementDismissedKey(userId));
  return value === "1";
}

export async function setWidgetAnnouncementDismissed(userId: string): Promise<void> {
  await AsyncStorage.setItem(widgetAnnouncementDismissedKey(userId), "1");
}
