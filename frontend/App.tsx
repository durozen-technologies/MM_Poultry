import "react-native-gesture-handler";
import "./global.css";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./src/query-client";
import { AppNavigator } from "./src/navigation/app-navigator";
import { useAuthStore } from "./src/store/auth-store";
import { usePrinterStore } from "./src/store/printer-store";
import { cssInterop } from "nativewind";
import { MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";

import { Platform, LogBox } from "react-native";

LogBox.ignoreLogs([
  "viewIsDescendantOf() noop: Cannot find view with reactTag",
]);

cssInterop(MaterialIcons, {
  className: { target: "style", nativeStyleToProp: { color: true } }
});
cssInterop(MaterialCommunityIcons, {
  className: { target: "style", nativeStyleToProp: { color: true } }
});

if (Platform.OS === "web") {
  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    if (args[0] && typeof args[0] === "string") {
      if (args[0].includes("props.pointerEvents is deprecated")) return;
      if (args[0].includes("DateTimePicker is not supported on: web")) return;
    }
    originalWarn(...args);
  };
}

export default function App() {
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const hydratePrinter = usePrinterStore((s) => s.hydrate);

  useEffect(() => {
    void hydrateAuth();
    void hydratePrinter();
  }, [hydrateAuth, hydratePrinter]);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <AppNavigator />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
