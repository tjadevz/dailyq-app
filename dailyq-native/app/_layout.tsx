import { View } from "react-native";
import { Slot } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/src/context/AuthContext";
import { ProfileProvider } from "@/src/context/ProfileContext";
import { LanguageProvider } from "@/src/context/LanguageContext";
import { CalendarAnswersProvider } from "@/src/context/CalendarAnswersContext";
import { StreakMilestoneProvider } from "@/src/context/StreakMilestoneContext";
import { BackgroundLayer } from "@/src/components/BackgroundLayer";
import { DeepLinkProvider } from "@/src/context/DeepLinkContext";
import * as Sentry from '@sentry/react-native';

if (!__DEV__) {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  });
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <DeepLinkProvider>
        <ProfileProvider>
          <LanguageProvider>
            <StreakMilestoneProvider>
              <CalendarAnswersProvider>
                <View style={{ flex: 1, backgroundColor: "#FAFAFF" }}>
                  <BackgroundLayer />
                  <View style={{ flex: 1, backgroundColor: "transparent" }}>
                    <Slot />
                  </View>
                </View>
              </CalendarAnswersProvider>
            </StreakMilestoneProvider>
          </LanguageProvider>
        </ProfileProvider>
        </DeepLinkProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
