import Tabs from "expo-router/js-tabs";
import { Text } from "react-native";
import { C } from "../../lib/theme";

const icon = (glyph: string) => ({ focused }: { focused: boolean }) => <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{glyph}</Text>;

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: C.brand, headerTitleStyle: { fontWeight: "800" } }}>
      <Tabs.Screen name="index" options={{ title: "24/7 RideSafe", tabBarLabel: "Home", tabBarIcon: icon("🏠") }} />
      <Tabs.Screen name="book" options={{ title: "Book a ride", tabBarLabel: "Book", tabBarIcon: icon("🚐") }} />
      <Tabs.Screen name="my-bookings" options={{ title: "My bookings", tabBarLabel: "My bookings", tabBarIcon: icon("🧾") }} />
      <Tabs.Screen name="owner" options={{ title: "Owner", tabBarLabel: "Owner", tabBarIcon: icon("📋") }} />
    </Tabs>
  );
}
