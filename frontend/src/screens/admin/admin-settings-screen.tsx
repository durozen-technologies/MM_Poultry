import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export function AdminSettingsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-surface pt-4" edges={["top"]}>
      <View className="px-4">
        <Text className="text-display-lg text-primary font-bold">Settings</Text>
        <Text className="text-body-md text-on-surface-variant mt-4">Settings screen coming soon...</Text>
      </View>
    </SafeAreaView>
  );
}
