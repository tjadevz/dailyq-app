import { Platform } from "react-native";
import { TestIds } from "react-native-google-mobile-ads";

/** DailyQ is iOS-only; matches PURCHASES_SUPPORTED in PurchasesContext. */
export const ADS_SUPPORTED = Platform.OS === "ios";

// Real ad unit only in production builds; Google's test unit everywhere else
// so development/TestFlight never serves (or accidentally clicks) real ads.
export const ADMOB_REWARDED_AD_UNIT_ID = __DEV__ ? TestIds.REWARDED : "ca-app-pub-3065939958076631/2528014423";
