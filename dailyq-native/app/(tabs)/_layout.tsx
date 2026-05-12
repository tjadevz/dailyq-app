import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image, View } from "react-native";
import { TabBarWithPill } from "@/src/components/TabBarWithPill";
import { useLanguage } from "@/src/context/LanguageContext";

export default function TabsLayout() {
  const { t, lang } = useLanguage();
  return (
    <Tabs
      tabBar={(props) => <TabBarWithPill {...props} />}
      screenOptions={{
        tabBarActiveTintColor: "#8B5CF6",
        tabBarInactiveTintColor: "#9CA3AF",
        tabBarStyle: { position: "absolute", backgroundColor: "transparent" },
        headerShown: true,
        headerTitle: "DailyQ",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ tabBarButton: () => null }}
      />
      <Tabs.Screen
        name="onboarding-questions"
        options={{ tabBarButton: () => null, headerShown: false }}
      />
      <Tabs.Screen
        name="today"
        options={{
          title: t("tabs_today"),
          tabBarLabel: "",
          headerShown: false,
          tabBarIcon: ({ size }) => (
            <View
              style={{
                width: Math.round((size ?? 22) * 1.872),
                height: Math.round((size ?? 22) * 1.872),
                transform: [{ translateY: Math.round((size ?? 22) * 0.1) }],
              }}
            >
              <Image
                source={require("@/assets/images/logo.nobg.png")}
                style={{ width: "100%", height: "100%" }}
                resizeMode="contain"
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: t("tabs_calendar"),
          tabBarLabel: "",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="calendar-outline"
              size={size ?? 22}
              color={color}
              style={{
                lineHeight: size ?? 22,
                includeFontPadding: false,
                textAlignVertical: "center",
              }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="archive"
        options={{
          title: lang === "en" ? "Archive" : "Archief",
          tabBarLabel: "",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="book-outline"
              size={size ?? 22}
              color={color}
              style={{
                lineHeight: size ?? 22,
                includeFontPadding: false,
                textAlignVertical: "center",
              }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("tabs_settings"),
          tabBarLabel: "",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="options-outline"
              size={size ?? 22}
              color={color}
              style={{
                lineHeight: size ?? 22,
                includeFontPadding: false,
                textAlignVertical: "center",
              }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="over"
        options={{ tabBarButton: () => null, headerShown: false }}
      />
      <Tabs.Screen
        name="account"
        options={{ tabBarButton: () => null, headerShown: false }}
      />
    </Tabs>
  );
}
