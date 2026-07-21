import { requireNativeModule } from "expo-modules-core";

type DailyqWidgetStatusModuleType = {
  isInstalled(): Promise<boolean>;
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
