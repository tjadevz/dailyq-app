import { requireNativeModule } from "expo-modules-core";

type DailyqWidgetStatusModuleType = {
  isInstalled(): Promise<boolean>;
  reload(): void;
};

const DailyqWidgetStatus = requireNativeModule<DailyqWidgetStatusModuleType>(
  "DailyqWidgetStatus"
);

/** True if the DailyQ home-screen widget is currently placed on the device. Resolves false on Android/non-iOS. */
export async function isDailyQWidgetInstalled(): Promise<boolean> {
  try {
    return await DailyqWidgetStatus.isInstalled();
  } catch {
    return false;
  }
}

/** Forces the widget to refetch today's question now instead of waiting for its own schedule. No-op on Android/non-iOS. */
export function reloadDailyQWidget(): void {
  try {
    DailyqWidgetStatus.reload();
  } catch {
    // no-op — non-iOS or module unavailable
  }
}
