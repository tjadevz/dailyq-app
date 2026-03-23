import AsyncStorage from "@react-native-async-storage/async-storage";

const PENDING_REFERRAL_CODE_KEY = "dailyq_pending_referral_code";

export async function setPendingReferralCode(code: string | null): Promise<void> {
  const normalized = (code ?? "").trim();
  if (!normalized) {
    await clearPendingReferralCode();
    return;
  }
  await AsyncStorage.setItem(PENDING_REFERRAL_CODE_KEY, normalized);
}

export async function getPendingReferralCode(): Promise<string | null> {
  const raw = await AsyncStorage.getItem(PENDING_REFERRAL_CODE_KEY);
  const normalized = (raw ?? "").trim();
  return normalized ? normalized : null;
}

export async function clearPendingReferralCode(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_REFERRAL_CODE_KEY);
}

