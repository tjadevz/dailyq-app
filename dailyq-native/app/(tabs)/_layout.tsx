import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TabBarWithPill } from "@/src/components/TabBarWithPill";
import { useLanguage } from "@/src/context/LanguageContext";

export default function TabsLayout() {
  const { t } = useLanguage();
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
        name="today"
        options={{
          title: t("tabs_today"),
          tabBarLabel: t("tabs_today"),
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="help-circle-outline" size={size ?? 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: t("tabs_calendar"),
          tabBarLabel: t("tabs_calendar"),
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size ?? 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("tabs_settings"),
          tabBarLabel: t("tabs_settings"),
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size ?? 22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
