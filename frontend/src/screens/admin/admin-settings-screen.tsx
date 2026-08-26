import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "../../store/auth-store";

type SettingsItem = {
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  screen: string;
};

const ITEMS: SettingsItem[] = [
  { title: "Items", subtitle: "Manage products", icon: "category", screen: "Items" },
  { title: "Vehicles", subtitle: "Fleet & driver details", icon: "local-shipping", screen: "Vehicles" },
  { title: "Delivery Users", subtitle: "Driver app logins", icon: "badge", screen: "DeliveryUsers" },
  { title: "Delivery Runs", subtitle: "Build runs from farm loads", icon: "route", screen: "DeliveryRuns" },
  { title: "Reports", subtitle: "Sales summary & PDF export", icon: "assessment", screen: "Reports" },
  { title: "Retailer Users", subtitle: "Manage portal logins", icon: "security", screen: "AdminRetailerUsers" },
];

export function AdminSettingsScreen({ navigation }: { navigation: any }) {
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);

  return (
    <SafeAreaView className="flex-1 max-w-3xl mx-auto w-full bg-background" edges={["top"]}>
      <View className="h-16 px-4 flex-row items-center bg-surface/90">
        <Text className="font-headline-sm text-headline-sm text-on-surface font-semibold">Settings</Text>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
        {user?.organization_name ? (
          <View className="bg-primary-container rounded-2xl p-4 mb-4">
            <Text className="font-label-md text-on-primary-container uppercase font-semibold">Organization</Text>
            <Text className="font-headline-sm text-on-primary font-semibold mt-1">{user.organization_name}</Text>
            {user.organization_slug ? (
              <Text className="font-body-md text-on-primary-container mt-1">@{user.organization_slug}</Text>
            ) : null}
          </View>
        ) : null}

        <View className="flex-col gap-3">
          {ITEMS.map((item) => (
            <Pressable accessibilityRole="button" accessibilityLabel="Button"
              key={item.screen}
              className="bg-surface-container-lowest rounded-2xl p-4 flex-row items-center gap-4 border border-outline-variant/20 active:bg-surface-container"
              onPress={() => navigation.navigate(item.screen)}
            >
              <View className="w-12 h-12 rounded-full bg-primary-container/20 items-center justify-center">
                <MaterialIcons name={item.icon} size={24} className="text-primary" />
              </View>
              <View className="flex-1">
                <Text className="font-headline-sm text-on-surface font-semibold">{item.title}</Text>
                <Text className="font-body-md text-on-surface-variant mt-0.5">{item.subtitle}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} className="text-on-surface-variant" />
            </Pressable>
          ))}
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel="Button"
          className="mt-6 bg-error-container rounded-2xl p-4 flex-row items-center justify-center gap-2 active:opacity-80"
          onPress={() => logout()}
        >
          <MaterialIcons name="logout" size={20} className="text-error" />
          <Text className="font-label-md text-on-error-container font-semibold">Logout</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
