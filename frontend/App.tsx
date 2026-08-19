import "react-native-gesture-handler";
import "./global.css";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppNavigator } from "./src/navigation/app-navigator";
import { useAuthStore } from "./src/store/auth-store";
import { cssInterop } from "nativewind";
import { MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";

cssInterop(MaterialIcons, {
  className: { target: "style", nativeStyleToProp: { color: true } }
});
cssInterop(MaterialCommunityIcons, {
  className: { target: "style", nativeStyleToProp: { color: true } }
});

const queryClient = new QueryClient();

export default function App() {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <AppNavigator />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
