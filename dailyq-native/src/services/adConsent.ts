import { Platform } from "react-native";
import { AdsConsent } from "react-native-google-mobile-ads";
import * as TrackingTransparency from "expo-tracking-transparency";
import * as Sentry from "@sentry/react-native";

// Must be checked before every ad load per AdMob/GDPR policy — not just once
// at app start. Cheap to call repeatedly: once consent has already been
// gathered, requestInfoUpdate + loadAndShowConsentFormIfRequired (both run
// inside AdsConsent.gatherConsent) resolve immediately without showing any UI.
export async function ensureAdsConsent(): Promise<boolean> {
  try {
    if (Platform.OS === "ios") {
      const { status } = await TrackingTransparency.getTrackingPermissionsAsync();
      if (status === TrackingTransparency.PermissionStatus.UNDETERMINED) {
        await TrackingTransparency.requestTrackingPermissionsAsync();
      }
    }

    const consentInfo = await AdsConsent.gatherConsent();
    if (!consentInfo.canRequestAds) {
      // Not necessarily an error (e.g. status REQUIRED with no message configured
      // yet), but worth seeing in Sentry since it silently blocks the whole feature.
      Sentry.captureMessage("[adConsent] canRequestAds is false", {
        level: "warning",
        tags: { feature: "rewarded_ad" },
        extra: { status: consentInfo.status, isConsentFormAvailable: consentInfo.isConsentFormAvailable },
      });
    }
    return consentInfo.canRequestAds;
  } catch (e) {
    console.error("[adConsent] consent flow failed:", e);
    Sentry.captureException(e, { tags: { feature: "rewarded_ad" } });
    return false;
  }
}
