import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";
import Purchases, {
  LOG_LEVEL,
  PURCHASE_TYPE,
  PURCHASES_ERROR_CODE,
  type PurchasesError,
  type PurchasesStoreProduct,
} from "react-native-purchases";
import { JOKER_PRODUCT_IDS, REVENUECAT_IOS_API_KEY } from "../config/revenuecat";
import { logEvent } from "@/lib/analytics";
import { useAuth } from "./AuthContext";

/** DailyQ is iOS-only; RevenueCat is only configured when both are true. */
export const PURCHASES_SUPPORTED = Platform.OS === "ios" && !!REVENUECAT_IOS_API_KEY;

export type JokerPurchaseResult = "purchased" | "cancelled" | "error";

type PurchasesContextValue = {
  /** True once the SDK is configured (or immediately on unsupported platforms). */
  isReady: boolean;
  /** Localized joker-pack store products (jokers_3/5/10). Empty while loading or unsupported. */
  products: PurchasesStoreProduct[];
  productsLoading: boolean;
  /** Buys a joker pack by product id. The actual joker_balance grant happens server-side via a RevenueCat webhook. */
  purchaseJokerPack: (productId: string) => Promise<JokerPurchaseResult>;
};

const PurchasesContext = createContext<PurchasesContextValue | null>(null);

export function PurchasesProvider({ children }: { children: React.ReactNode }) {
  const { effectiveUser, authCheckDone } = useAuth();
  const [isReady, setIsReady] = useState(!PURCHASES_SUPPORTED);
  const [products, setProducts] = useState<PurchasesStoreProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(PURCHASES_SUPPORTED);
  const configuredRef = useRef(false);
  const loggedInUserIdRef = useRef<string | null>(null);

  // Configure the SDK once, as soon as the initial auth check has resolved, then fetch the joker products.
  useEffect(() => {
    if (!PURCHASES_SUPPORTED || !authCheckDone || configuredRef.current) return;
    configuredRef.current = true;

    const userId =
      effectiveUser?.id && effectiveUser.id !== "dev-user" ? effectiveUser.id : undefined;

    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }
    Purchases.configure({ apiKey: REVENUECAT_IOS_API_KEY, appUserID: userId });
    loggedInUserIdRef.current = userId ?? null;
    setIsReady(true);

    Purchases.getProducts(Object.values(JOKER_PRODUCT_IDS), PURCHASE_TYPE.INAPP)
      .then(setProducts)
      .catch((e) => console.error("[Purchases] getProducts failed:", e))
      .finally(() => setProductsLoading(false));
  }, [authCheckDone]);

  // Keep RevenueCat's logged-in user in sync with Supabase auth (sign in / sign out) after the initial configure,
  // so the RevenueCat app_user_id (used by the webhook to attribute a purchase) always matches auth.uid().
  useEffect(() => {
    if (!PURCHASES_SUPPORTED || !configuredRef.current) return;

    const userId =
      effectiveUser?.id && effectiveUser.id !== "dev-user" ? effectiveUser.id : null;
    if (userId === loggedInUserIdRef.current) return;

    (async () => {
      try {
        if (userId) {
          await Purchases.logIn(userId);
        } else {
          await Purchases.logOut();
        }
        loggedInUserIdRef.current = userId;
      } catch (e) {
        console.error("[Purchases] logIn/logOut sync failed:", e);
      }
    })();
  }, [effectiveUser?.id]);

  const purchaseJokerPack = useCallback(
    async (productId: string): Promise<JokerPurchaseResult> => {
      if (!PURCHASES_SUPPORTED) return "error";
      const product = products.find((p) => p.identifier === productId);
      if (!product) {
        console.error("[Purchases] purchaseJokerPack: unknown product", productId);
        return "error";
      }
      logEvent("joker_pack_purchase_started", { product_id: productId });
      try {
        await Purchases.purchaseStoreProduct(product);
        logEvent("joker_pack_purchased", { product_id: productId });
        return "purchased";
      } catch (e) {
        const err = e as PurchasesError;
        if (err?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
          logEvent("joker_pack_purchase_cancelled", { product_id: productId });
          return "cancelled";
        }
        console.error("[Purchases] purchaseStoreProduct failed:", e);
        logEvent("joker_pack_purchase_error", { product_id: productId });
        return "error";
      }
    },
    [products]
  );

  const value: PurchasesContextValue = {
    isReady,
    products,
    productsLoading,
    purchaseJokerPack,
  };

  return (
    <PurchasesContext.Provider value={value}>{children}</PurchasesContext.Provider>
  );
}

export function usePurchases(): PurchasesContextValue {
  const ctx = useContext(PurchasesContext);
  if (!ctx) throw new Error("usePurchases must be used within PurchasesProvider");
  return ctx;
}
