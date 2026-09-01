import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../api/client";
import { formatIstDate } from "../../utils/ist-date";
import type { FarmOut, FarmLoad } from "../../types/api";

export function AdminFarmProfileScreen({ route, navigation }: { route: any; navigation: any }) {
  const { farmId } = route.params || {};
  const [farm, setFarm] = useState<FarmOut | null>(null);
  const [loads, setLoads] = useState<FarmLoad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!farmId) {
      setError("Missing farm ID");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [farmRes, loadsRes] = await Promise.all([
        api.get<FarmOut>(`/admin/farms/${farmId}`),
        api.get<FarmLoad[]>(`/admin/farm-loads`),
      ]);
      setFarm(farmRes.data);
      // Filter loads for this farm client-side (backend list has no farm filter)
      const allLoads = Array.isArray(loadsRes.data) ? loadsRes.data : (loadsRes.data as any).items || [];
      setLoads(allLoads.filter((l: FarmLoad) => l.farm_id === farmId));
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || e?.response?.data?.detail || e.message || "Failed to load farm";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  }, [farmId]);

  useFocusEffect(useCallback(() => { void fetchAll(); }, [fetchAll]));

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#012D1D" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="h-16 px-4 flex-row items-center border-b border-outline-variant/20">
          <Pressable onPress={() => navigation.goBack()} className="w-11 h-11 -ml-2 items-center justify-center rounded-full">
            <MaterialIcons name="arrow-back" size={24} className="text-on-surface" />
          </Pressable>
          <Text className="font-semibold ml-2">Farm Profile</Text>
        </View>
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-error text-center">{error}</Text>
          <Pressable onPress={fetchAll} className="mt-4 bg-primary px-6 py-3 rounded-xl"><Text className="text-white font-semibold">Retry</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="h-16 px-4 flex-row items-center bg-surface border-b border-outline-variant/20">
        <Pressable onPress={() => navigation.goBack()} className="w-11 h-11 -ml-2 items-center justify-center rounded-full">
          <MaterialIcons name="arrow-back" size={24} className="text-on-surface" />
        </Pressable>
        <Text className="font-headline-sm font-semibold ml-2">{farm?.name || "Farm"}</Text>
        <Pressable onPress={() => navigation.navigate("AdminEditFarm", { farmId })} className="ml-auto w-10 h-10 items-center justify-center rounded-full bg-surface-container">
          <MaterialIcons name="edit" size={20} className="text-on-surface" />
        </Pressable>
      </View>

      <FlatList
        data={loads}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        ListHeaderComponent={
          <View className="mb-4">
            <View className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/20">
              <Text className="font-semibold mb-3">Farm Info</Text>
              <InfoRow label="Owner" value={farm?.owner_name || "—"} />
              <InfoRow label="Location" value={farm?.location || "—"} />
              <InfoRow label="Address" value={farm?.address || "—"} />
              <InfoRow label="Phone" value={farm?.contact_phone || "—"} />
              <InfoRow label="Active" value={farm?.is_active ? "Yes" : "No"} />
            </View>
            <View className="flex-row justify-between items-center mt-4 mb-2">
              <Text className="font-semibold text-on-surface">Loads ({loads.length})</Text>
              <Pressable onPress={() => navigation.navigate("FarmPurchase", { farmId })} className="bg-primary px-4 py-2 rounded-full">
                <Text className="text-white font-semibold">+ Add Load</Text>
              </Pressable>
            </View>
          </View>
        }
        ListEmptyComponent={<Text className="text-on-surface-variant text-center py-8">No loads for this farm yet.</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => navigation.navigate("AdminFarmLoadDetail", { loadId: item.id })} className="bg-surface-container-lowest rounded-xl p-4 mb-3 border border-outline-variant/20 active:bg-surface-container">
            <View className="flex-row justify-between">
              <Text className="font-semibold">{formatIstDate(item.load_date)}</Text>
              <Text className={`px-2 py-1 rounded-full text-xs font-bold ${item.status === "OPEN" ? "bg-primary text-white" : item.status === "IN_TRANSIT" ? "bg-tertiary text-white" : "bg-surface-variant"}`}>{item.status}</Text>
            </View>
            <Text className="text-on-surface-variant mt-1">{item.loaded_weight_kg} kg {item.bird_count ? `· ${item.bird_count} birds` : ""}</Text>
            <Text className="text-primary font-semibold mt-1">{item.vehicle_number || "No vehicle"}</Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-2 border-b border-surface-variant/30 last:border-0">
      <Text className="text-on-surface-variant">{label}</Text>
      <Text className="font-semibold ml-4 flex-1 text-right">{value}</Text>
    </View>
  );
}
