import { View } from "react-native";
import { Slot } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/src/context/AuthContext";
import { LanguageProvider } from "@/src/context/LanguageContext";
import { CalendarAnswersProvider } from "@/src/context/CalendarAnswersContext";
import { BackgroundLayer } from "@/src/components/BackgroundLayer";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <LanguageProvider>
          <CalendarAnswersProvider>
            <View style={{ flex: 1, backgroundColor: "transparent" }}>
              <BackgroundLayer />
              <View style={{ flex: 1, backgroundColor: "transparent" }}>
                <Slot />
              </View>
            </View>
          </CalendarAnswersProvider>
        </LanguageProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
