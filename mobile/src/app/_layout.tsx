import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { expireHolds, loadStore, useAppState } from "../lib/store";
import { C } from "../lib/theme";

export default function RootLayout() {
  const state = useAppState();

  useEffect(() => {
    loadStore();
  }, []);

  // PLAN.md job 3: release holds that ran out. Stage 3 moves this to a server job.
  useEffect(() => {
    if (!state) return;
    expireHolds();
    const t = setInterval(expireHolds, 30_000);
    return () => clearInterval(t);
  }, [!!state]);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {!state ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg }}>
          <ActivityIndicator color={C.brand} size="large" />
        </View>
      ) : (
        <Stack screenOptions={{ headerTintColor: C.brand, headerTitleStyle: { color: C.ink }, contentStyle: { backgroundColor: C.bg } }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="booking/[id]" options={{ title: "Booking" }} />
        </Stack>
      )}
    </SafeAreaProvider>
  );
}
