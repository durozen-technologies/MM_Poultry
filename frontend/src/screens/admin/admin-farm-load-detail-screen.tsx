import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../api/client";
import { formatIstDate } from "../../utils/ist-date";
import type { FarmLoad } from "../../types/api";

export function AdminFarmLoadDetailScreen({ route, navigation }: { route: any; navigation: any }) {
  const { loadId } = route.params || {};
  const [load, setLoad] = useState<FarmLoad | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLoad = useCallback(async () => {
    if (!loadId) {
      setError("Missing load ID");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<FarmLoad>(`/admin/farm-loads/${loadId}`);
      setLoad(data);
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || e?.response?.data?.detail || e.message || "Failed to load farm load";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  }, [loadId]);

  useFocusEffect(
    useCallback(() => {
      void fetchLoad();
    }, [fetchLoad])
  );

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#012D1D" />
        <Text className="text-on-surface-variant mt-3">Loading farm load...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="h-16 px-4 flex-row items-center bg-surface border-b border-outline-variant/20">
          <Pressable onPress={() => navigation.goBack()} className="w-11 h-11 -ml-2 items-center justify-center rounded-full">
            <MaterialIcons name="arrow-back" size={24} className="text-on-surface" />
          </Pressable>
          <Text className="font-semibold ml-2">Load Detail</Text>
        </View>
        <View className="flex-1 items-center justify-center p-6">
          <MaterialIcons name="error-outline" size={48} className="text-error mb-3" />
          <Text className="text-error text-center font-semibold">{error}</Text>
          <Pressable onPress={fetchLoad} className="mt-4 bg-primary px-6 py-3 rounded-xl">
            <Text className="text-on-primary font-semibold">Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!load) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <Text className="text-on-surface-variant">No load found</Text>
      </SafeAreaView>
    );
  }

  const statusColor = load.status === "OPEN" ? "bg-primary" : load.status === "IN_TRANSIT" ? "bg-tertiary" : "bg-surface-variant";

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="h-16 px-4 flex-row items-center bg-surface border-b border-outline-variant/20">
        <Pressable onPress={() => navigation.goBack()} className="w-11 h-11 -ml-2 items-center justify-center rounded-full active:bg-surface-variant">
          <MaterialIcons name="arrow-back" size={24} className="text-on-surface" />
        </Pressable>
        <Text className="font-headline-sm font-semibold ml-2">Load Detail</Text>
        <View className={`ml-auto px-3 py-1 rounded-full ${statusColor}`}>
          <Text className="text-white text-xs font-bold">{load.status}</Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/20 mb-3">
          <Text className="font-semibold text-on-surface mb-3">Load Info</Text>
          <InfoRow label="Date" value={formatIstDate(load.load_date)} />
          <InfoRow label="Farm ID" value={load.farm_id || "—"} />
          <InfoRow label="Vehicle" value={load.vehicle_number || "—"} />
          <InfoRow label="Driver" value={load.driver_name || "—"} />
          <InfoRow label="Weight" value={`${load.loaded_weight_kg} kg`} />
          <InfoRow label="Birds" value={load.bird_count ? String(load.bird_count) : "—"} />
          <InfoRow label="Boxes" value={load.total_boxes ? String(load.total_boxes) : "—"} />
        </View>

        <View className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/20 mb-3">
          <Text className="font-semibold text-on-surface mb-3">Commercial</Text>
          <InfoRow label="Rate/kg" value={load.rate_per_kg ? `₹${load.rate_per_kg}` : "—"} />
          <InfoRow label="Total" value={load.total_amount ? `₹${load.total_amount}` : "—"} />
          <InfoRow label="Paid" value={load.paid_amount ? `₹${load.paid_amount}` : "—"} />
          <InfoRow label="Payment" value={load.payment_method || "—"} />
        </View>

        {load.remarks ? (
          <View className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/20">
            <Text className="font-semibold text-on-surface mb-2">Remarks</Text>
            <Text className="text-on-surface-variant">{load.remarks}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-2 border-b border-surface-variant/30 last:border-0">
      <Text className="text-on-surface-variant">{label}</Text>
      <Text className="font-semibold text-on-surface ml-4 flex-1 text-right">{value}</Text>
    </View>
  );
}
