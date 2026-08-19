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
  const limit = Number(retailer?.credit_limit || 0);
  const outstanding = Number(retailer?.credit_balance || 0);
  const usedPct = limit > 0 ? Math.min(100, Math.round((outstanding / limit) * 100)) : 0;

  return (
    <SafeAreaView className="flex-1 max-w-3xl mx-auto w-full bg-background" edges={["top"]}>
      <View className="h-16 px-4 flex-row items-center justify-between bg-surface/80">
        <Text className="font-headline-sm text-on-surface font-semibold">Profile</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Button" className="w-11 h-11 items-center justify-center rounded-full" onPress={logout}>
          <MaterialIcons name="logout" size={24} className="text-on-surface" />
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
            <View className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/20">
              <Text className="font-headline-md text-on-surface font-semibold">
                {retailer.shop_name || retailer.name}
              </Text>
              <Text className="font-body-md text-on-surface-variant mt-1">@{profile?.username}</Text>
              {retailer.owner_name ? (
                <Text className="font-body-md text-on-surface mt-2">{retailer.owner_name}</Text>
              ) : null}
            </View>

            <View className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/20">
              <Text className="font-label-md text-on-surface-variant mb-2">Credit limit usage</Text>
              <View className="h-2 bg-surface-variant rounded-full overflow-hidden mb-2">
                <View className="h-full bg-primary" style={{ width: `${usedPct}%` }} />
              </View>
              <Text className="font-body-md text-on-surface">
                ₹{retailer.credit_balance} of ₹{retailer.credit_limit || "—"} used
              </Text>
            </View>

            <View className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/20 flex-col gap-2">
              <InfoRow icon="phone" label="Phone" value={retailer.phone || "—"} />
              <InfoRow icon="chat" label="WhatsApp" value={retailer.whatsapp || "—"} />
              <InfoRow icon="place" label="Address" value={retailer.address || "—"} />
              <InfoRow icon="map" label="Area" value={retailer.area || "—"} />
              <InfoRow icon="route" label="Route" value={retailer.route_name || "—"} />
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
