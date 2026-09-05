import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { getRetailerProfile } from "../../api/retailer";
import { useAuthStore } from "../../store/auth-store";
import type { RetailerProfile } from "../../types/api";

export function RetailerProfileScreen() {
  const logout = useAuthStore((s) => s.logout);
  const [profile, setProfile] = useState<RetailerProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const data = await getRetailerProfile();
      setProfile(data);
      setMessage(null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to load profile");
    } finally {
      setBusy(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const retailer = profile?.retailer;
  const outstanding = Number(retailer?.credit_balance || 0);

  return (
    <SafeAreaView className="flex-1 max-w-3xl mx-auto w-full bg-background" edges={["top"]}>
      <View className="h-16 px-4 flex-row items-center justify-between bg-[#0052CC] border-b border-black/10">
        <Text className="font-headline-sm text-white font-semibold">Profile</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Button" className="w-11 h-11 items-center justify-center rounded-full active:bg-white/10" onPress={logout}>
          <MaterialIcons name="logout" size={24} className="text-white" />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-2"
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={busy} onRefresh={refresh} />}
      >
        {message ? <Text className="text-error text-center mb-3">{message}</Text> : null}
        {busy && !profile ? <ActivityIndicator className="text-primary mt-8" /> : null}

        {retailer ? (
          <View className="flex-col gap-4">
            <View className="bg-[#0052CC] rounded-[20px] p-6 shadow-sm elevation-sm flex-row items-center justify-between">
              <View>
                <Text className="font-headline-md text-white font-bold">
                  {retailer.shop_name || retailer.name}
                </Text>
                <Text className="font-body-md text-white/70 mt-1">@{profile?.username}</Text>
                {retailer.owner_name ? (
                  <Text className="font-body-md text-white mt-3 font-semibold">{retailer.owner_name}</Text>
                ) : null}
              </View>
              <View className="w-16 h-16 rounded-full bg-white/20 items-center justify-center border border-white/30">
                <MaterialIcons name="store" size={32} className="text-white" />
              </View>
            </View>

            <View className="bg-white rounded-[20px] p-6 border border-black/5 shadow-sm elevation-sm flex-col gap-2">
              <Text className="font-label-md text-on-surface-variant uppercase tracking-wider font-semibold mb-1">Current Balance</Text>
              <Text className="font-display-lg text-error font-bold">₹{outstanding}</Text>
            </View>

            <View className="bg-white rounded-[20px] p-5 border border-black/5 shadow-sm elevation-sm flex-col">
              <InfoRow icon="phone" label="Phone" value={retailer.phone || "—"} />
              <InfoRow icon="chat" label="WhatsApp" value={retailer.whatsapp || "—"} />
              <InfoRow icon="place" label="Address" value={retailer.address || "—"} />

              <InfoRow icon="map" label="Area" value={retailer.area || "—"} />
            </View>

            <Pressable accessibilityRole="button" accessibilityLabel="Button"
              className="bg-error-container h-12 rounded-xl items-center justify-center"
              onPress={logout}
            >
              <Text className="text-error font-semibold">Logout</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-row items-start gap-3 py-2 border-b border-surface-variant/40">
      <MaterialIcons name={icon} size={20} className="text-on-surface" />
      <View className="flex-1">
        <Text className="font-label-md text-on-surface-variant">{label}</Text>
        <Text className="font-body-md text-on-surface">{value}</Text>
      </View>
    </View>
  );
}
