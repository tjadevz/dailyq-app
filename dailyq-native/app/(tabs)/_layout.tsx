import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TabBarWithPill } from "@/src/components/TabBarWithPill";

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBarWithPill {...props} />}
      screenOptions={{
        tabBarActiveTintColor: "#8B5CF6",
        tabBarInactiveTintColor: "#9CA3AF",
        tabBarStyle: { position: "absolute", backgroundColor: "transparent" },
        sceneContainerStyle: { backgroundColor: "transparent" },
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
          title: "Today",
          tabBarLabel: "Today",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="help-circle-outline" size={size ?? 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Calendar",
          tabBarLabel: "Calendar",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size ?? 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarLabel: "Settings",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size ?? 22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
