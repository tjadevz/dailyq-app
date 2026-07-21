import { Platform } from "react-native";

import { isDailyQWidgetInstalled } from "../../modules/dailyq-widget-status";
import { supabase } from "@/src/config/supabase";
import { logEvent } from "@/lib/analytics";

/**
 * Checks the real WidgetCenter state and, only when it differs from the
 * last-known value on the profile, persists it and logs the change.
 * Call on Today focus so it catches widgets added while the app was backgrounded.
 */
export async function syncWidgetInstalledStatus(
  userId: string,
  knownInstalled: boolean | null | undefined
): Promise<boolean | null> {
  if (Platform.OS !== "ios" || userId === "dev-user") return null;

  const installed = await isDailyQWidgetInstalled();
  if (installed === (knownInstalled ?? false)) return installed;

  const { error } = await supabase
    .from("profiles")
    .update({ widget_installed: installed })
    .eq("id", userId);
  if (error) {
    console.warn("[widgetStatus] Failed to persist widget_installed:", error);
    return null;
  }

  logEvent("widget_status_changed", { installed });
  return installed;
}
