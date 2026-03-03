import { View } from "react-native";
import { Slot } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/src/context/AuthContext";
import { ProfileProvider } from "@/src/context/ProfileContext";
import { LanguageProvider } from "@/src/context/LanguageContext";
import { CalendarAnswersProvider } from "@/src/context/CalendarAnswersContext";
import { StreakMilestoneProvider } from "@/src/context/StreakMilestoneContext";
import { BackgroundLayer } from "@/src/components/BackgroundLayer";

// #region agent log
function logLayout(id: string, message: string, data: Record<string, unknown>) {
  fetch("http://127.0.0.1:7243/ingest/8b229217-1871-4da8-8258-2778d0f3e809", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "332a30" },
    body: JSON.stringify({
      sessionId: "332a30",
      runId: "run1",
      hypothesisId: id,
      location: "_layout.tsx",
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}
// #endregion

export default function RootLayout() {
  // #region agent log
  logLayout("H4", "RootLayout render start", { ts: Date.now() });
  // #endregion
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ProfileProvider>
          <LanguageProvider>
            <StreakMilestoneProvider>
              <CalendarAnswersProvider>
                <View style={{ flex: 1, backgroundColor: "#FAF9FF" }}>
                  <BackgroundLayer />
                  <View style={{ flex: 1, backgroundColor: "transparent" }}>
                    <Slot />
                  </View>
                </View>
              </CalendarAnswersProvider>
            </StreakMilestoneProvider>
          </LanguageProvider>
        </ProfileProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
