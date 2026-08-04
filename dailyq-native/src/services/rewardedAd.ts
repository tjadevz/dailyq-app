import { AdEventType, MobileAds, RewardedAd, RewardedAdEventType } from "react-native-google-mobile-ads";
import * as Sentry from "@sentry/react-native";

import { ADMOB_REWARDED_AD_UNIT_ID } from "@/src/config/admob";
import { ensureAdsConsent } from "@/src/services/adConsent";

export type WatchAdOutcome = "earned" | "cancelled" | "error" | "consent_denied";

let initializePromise: Promise<void> | null = null;
function ensureInitialized(): Promise<void> {
  if (!initializePromise) {
    initializePromise = MobileAds()
      .initialize()
      .then(() => undefined);
  }
  return initializePromise;
}

// Loads and shows a single rewarded ad, gated on a fresh GDPR/UMP consent
// check (per Google policy, this must run before every ad load, not just
// once at app start). The actual joker grant never happens here — it's
// server-side only, via AdMob's SSV callback -> grant_ad_reward_jokers().
// `userId` is passed through as the SSV `user_id` param so that callback can
// attribute the grant; this function only reports whether the user watched
// the ad to completion, for optimistic local UI.
export async function watchAdForJoker(userId: string): Promise<WatchAdOutcome> {
  const canRequestAds = await ensureAdsConsent();
  if (!canRequestAds) return "consent_denied";

  try {
    await ensureInitialized();

    const rewarded = RewardedAd.createForAdRequest(ADMOB_REWARDED_AD_UNIT_ID, {
      serverSideVerificationOptions: { userId },
    });

    return await new Promise<WatchAdOutcome>((resolve) => {
      let earned = false;
      let settled = false;

      const finish = (outcome: WatchAdOutcome) => {
        if (settled) return;
        settled = true;
        unsubscribe();
        resolve(outcome);
      };

      const unsubscribe = rewarded.addAdEventsListener(({ type, payload }) => {
        switch (type) {
          case RewardedAdEventType.LOADED:
            rewarded.show();
            break;
          case RewardedAdEventType.EARNED_REWARD:
            earned = true;
            break;
          case AdEventType.CLOSED:
            finish(earned ? "earned" : "cancelled");
            break;
          case AdEventType.ERROR:
            // payload is the underlying AdMob Error (e.g. no-fill, network, invalid
            // request). console.error alone is invisible in production (Sentry doesn't
            // auto-capture plain console calls, only crashes/unhandled exceptions), so
            // report explicitly to actually see the real error code/message.
            console.error("[rewardedAd] ad failed:", payload);
            Sentry.captureException(payload, { tags: { feature: "rewarded_ad" } });
            finish("error");
            break;
        }
      });

      rewarded.load();
    });
  } catch (e) {
    console.error("[rewardedAd] watchAdForJoker failed:", e);
    Sentry.captureException(e, { tags: { feature: "rewarded_ad" } });
    return "error";
  }
}
