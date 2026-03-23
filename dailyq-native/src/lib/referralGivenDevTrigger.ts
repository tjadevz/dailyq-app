import AsyncStorage from "@react-native-async-storage/async-storage";

const REFERRAL_GIVEN_DEV_TRIGGER_KEY = "dailyq_referral_given_dev_trigger";

export async function setReferralGivenDevTrigger(): Promise<void> {
  await AsyncStorage.setItem(REFERRAL_GIVEN_DEV_TRIGGER_KEY, "1");
}

export async function consumeReferralGivenDevTrigger(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(REFERRAL_GIVEN_DEV_TRIGGER_KEY);
  if (raw !== "1") return false;
  await AsyncStorage.removeItem(REFERRAL_GIVEN_DEV_TRIGGER_KEY);
  return true;
}
