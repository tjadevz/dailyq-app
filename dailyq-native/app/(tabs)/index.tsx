import { Redirect, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { View } from "react-native";

import { useAuth } from "@/src/context/AuthContext";
import { useProfileContext } from "@/src/context/ProfileContext";

export default function TabIndex() {
  const { user } = useAuth();
  const { profile } = useProfileContext();

  const willRedirect = !!(user && profile && profile.id === user.id && profile.onboarding_completed);

  const renderCount = useRef(0);
  renderCount.current += 1;
  console.log(`[IDX] render #${renderCount.current}  willRedirect=${willRedirect}  uid=${user?.id?.slice(0,8) ?? "null"}  pid=${profile?.id?.slice(0,8) ?? "null"}  oc=${profile?.onboarding_completed ?? "null"}`);

  useEffect(() => {
    console.log("[IDX] MOUNT");
    return () => { console.log("[IDX] UNMOUNT"); };
  }, []);

  useFocusEffect(useCallback(() => {
    console.log(`[IDX] FOCUSED  willRedirect=${willRedirect}`);
    return () => { console.log("[IDX] BLURRED"); };
  }, [willRedirect]));

  if (!willRedirect) {
    return <View style={{ flex: 1 }} />;
  }

  return <Redirect href="/(tabs)/today" />;
}
