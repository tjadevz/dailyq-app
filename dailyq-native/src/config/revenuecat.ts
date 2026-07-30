/** RevenueCat configuration — single source of truth for keys and joker product ids. */

export const REVENUECAT_IOS_API_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? "";

/** Consumable joker-pack product identifiers configured in App Store Connect / RevenueCat. */
export const JOKER_PRODUCT_IDS = {
  jokers_3: "jokers_3",
  jokers_5: "jokers_5",
  jokers_10: "Jokers_10",
} as const;

export type JokerProductId = (typeof JOKER_PRODUCT_IDS)[keyof typeof JOKER_PRODUCT_IDS];

/**
 * Joker count per pack, for UI copy only (e.g. "+3"). The actual grant amount is
 * determined server-side (grant_iap_jokers RPC) from the RevenueCat webhook — this
 * is never trusted to compute the real balance change.
 */
export const JOKER_COUNT_BY_PRODUCT_ID: Record<JokerProductId, number> = {
  [JOKER_PRODUCT_IDS.jokers_3]: 3,
  [JOKER_PRODUCT_IDS.jokers_5]: 5,
  [JOKER_PRODUCT_IDS.jokers_10]: 10,
};
