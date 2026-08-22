import { useState } from "react";
import {
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
  ScrollView,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useAdminFarms } from "../../hooks/use-queries";
import type { FarmLoad, FarmOut } from "../../types/api";
import { formatIstDate } from "../../utils/ist-date";
import { updateFarm } from "../../api/farms";

export function AdminFarmsScreen({ navigation }: { navigation: any }) {
  const insets = useSafeAreaInsets();
  const { data, isLoading, refetch } = useAdminFarms();

  const farms = data?.farms || [];
  const [openMenuFarmId, setOpenMenuFarmId] = useState<string | null>(null);
  const loads = (data?.loads || []).slice(0, 10);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"All" | "Active" | "Inactive">("All");

  const filteredFarms = farms.filter((f) => {
    if (searchQuery && !f.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filter === "Active" && !f.is_active) return false;
    if (filter === "Inactive" && f.is_active) return false;
    return true;
  });

  const activeCount = farms.filter(f => f.is_active).length;
  const inactiveCount = farms.length - activeCount;

  return (
    <SafeAreaView className="flex-1 max-w-3xl mx-auto w-full bg-background" edges={["top", "bottom"]}>
      {/* Header */}
      <View className="h-16 px-4 flex-row items-center justify-between bg-surface/90 z-20">
        <View className="flex-row items-center gap-2">
          <Pressable accessibilityRole="button" accessibilityLabel="Button"
            className="w-11 h-11 -ml-2 flex items-center justify-center rounded-full active:bg-surface-variant/50"
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="arrow-back" size={24} className="text-on-surface" />
          </Pressable>
          <Text className="font-headline-sm text-headline-sm text-primary font-semibold">
            Farms
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Pressable accessibilityRole="button" accessibilityLabel="Button"
            className="h-10 px-3 flex-row items-center justify-center rounded-xl bg-surface-container border border-outline-variant/30 active:bg-surface-container-high"
            onPress={() => navigation.navigate("FarmPurchase")}
          >
            <MaterialIcons name="inventory" size={20} className="text-primary" style={{ marginRight: 4 }} />
            <Text className="text-label-md text-primary font-semibold">Load</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Button"
            className="h-10 px-3 flex-row items-center justify-center rounded-xl bg-primary shadow-sm active:bg-primary/90"
            onPress={() => navigation.navigate("AddFarm")}
          >
            <MaterialIcons name="add" size={20} className="text-white" style={{ marginRight: 4 }} />
            <Text className="text-label-md text-on-primary font-semibold">Add</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={filteredFarms}
        keyExtractor={(item) => item.id}
        className="flex-1 px-4 pt-4"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        onScroll={() => setOpenMenuFarmId(null)}
        scrollEventThrottle={16}
        ListHeaderComponent={
          <>
            {/* Summary Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-3 mb-4">
              <View className="flex-row items-center gap-2 bg-surface-container px-3 py-2 rounded-full">
                <Text className="text-label-md text-on-surface-variant uppercase tracking-wider font-semibold">
                  Total
                </Text>
                <Text className="text-headline-sm text-primary font-semibold">{farms.length}</Text>
              </View>
              <View className="flex-row items-center gap-2 bg-primary-container/20 px-3 py-2 rounded-full">
                <View className="w-2 h-2 rounded-full bg-primary" />
                <Text className="text-label-md text-on-surface-variant uppercase tracking-wider font-semibold">
                  Active
                </Text>
                <Text className="text-headline-sm text-primary font-semibold">{activeCount}</Text>
              </View>
              <View className="flex-row items-center gap-2 bg-error-container/40 px-3 py-2 rounded-full">
                <View className="w-2 h-2 rounded-full bg-error" />
                <Text className="text-label-md text-on-surface-variant uppercase tracking-wider font-semibold">
                  Inactive
                </Text>
                <Text className="text-headline-sm text-error font-semibold">{inactiveCount}</Text>
              </View>
            </ScrollView>

            {/* Search & Filters */}
            <View className="flex-col gap-3 mb-6">
              <View className="relative flex-row items-center">
                <View className="absolute left-4 z-10">
                  <MaterialIcons name="search" size={20} className="text-on-surface-variant" />
                </View>
                <TextInput placeholderTextColor="#737373"
                  className="flex-1 h-12 pl-12 pr-4 bg-surface-container-lowest border border-surface-variant rounded-2xl text-body-md text-on-surface placeholder:text-on-surface-variant"
                  placeholder="Search farms..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
 />
              </View>
              <View className="flex-row gap-2">
                {(["All", "Active", "Inactive"] as const).map((f) => (
                  <Pressable accessibilityRole="button" accessibilityLabel="Button"
                    key={f}
                    onPress={() => setFilter(f)}
                    className={`h-10 px-4 rounded-full flex items-center justify-center ${
                      filter === f ? "bg-primary" : "bg-surface-container"
                    }`}
                  >
                    <Text
                      className={`font-label-md text-label-md font-semibold ${
                        filter === f ? "text-on-primary" : "text-on-surface"
                      }`}
                    >
                      {f}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Recent Farm Loads */}
            <Text className="font-headline-sm text-on-surface font-semibold mb-3 mt-2">Recent Farm Loads</Text>
            {loads.length === 0 ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Button"
                className="bg-surface-container-lowest rounded-2xl p-4 mb-6 border border-dashed border-outline-variant items-center"
                onPress={() => navigation.navigate("FarmPurchase")}
              >
                <MaterialIcons name="add-circle-outline" size={28} className="text-on-surface-variant" />
                <Text className="font-body-md text-on-surface-variant mt-2">Record your first farm load</Text>
              </Pressable>
            ) : (
              <View className="flex-col gap-3 mb-6">
                {loads.map((load) => (
                  <View key={load.id} className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/20">
                    <View className="flex-row justify-between items-start">
                      <Text className="font-headline-sm text-on-surface font-semibold">{formatIstDate(load.load_date)}</Text>
                      <View className="bg-surface-variant px-2 py-1 rounded-full">
                        <Text className="font-label-md text-on-surface-variant text-[10px] font-bold">{load.status}</Text>
                      </View>
                    </View>
                    <Text className="font-body-md text-primary font-semibold mt-1">{load.loaded_weight_kg} kg</Text>
                    {load.vehicle_number ? (
                      <Text className="font-label-md text-on-surface-variant mt-1">{load.vehicle_number} · {load.driver_name || "—"}</Text>
                    ) : null}
                  </View>
                ))}
              </View>
            )}
            <View className="h-2" />
          </>
        }
        ListEmptyComponent={
          !isLoading ? (
            <View className="flex-col items-center justify-center p-8 mt-4">
              <MaterialIcons name="agriculture" size={48} className="text-on-surface-variant" />
              <Text className="font-headline-md text-on-surface mb-2 mt-4 font-semibold">
                No farms found
              </Text>
              <Text className="font-body-md text-on-surface-variant text-center">
                Add a new farm to start recording farm loads.
              </Text>
            </View>
          ) : null
        }
        ItemSeparatorComponent={() => <View className="h-4" />}
        renderItem={({ item: farm }) => (
          <View
            className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm flex-col gap-3 border border-outline-variant/20"
            style={{ zIndex: openMenuFarmId === farm.id ? 50 : 0, elevation: openMenuFarmId === farm.id ? 10 : 0 }}
          >
            <View className="flex-row justify-between items-start">
              <View className="flex-col flex-1">
                <View className="flex-row items-center gap-2 flex-wrap">
                  <Text className="text-headline-sm text-on-surface font-semibold">
                    {farm.name}
                  </Text>
                  <View
                    className={`px-2 py-1 rounded-full flex-row items-center gap-1 ${
                      farm.is_active ? "bg-primary-container/30" : "bg-surface-variant"
                    }`}
                  >
                    <View
                      className={`w-1.5 h-1.5 rounded-full ${
                        farm.is_active ? "bg-primary" : "bg-outline"
                      }`}
                    />
                    <Text
                      className={`text-[10px] uppercase font-bold ${
                        farm.is_active ? "text-primary" : "text-on-surface-variant"
                      }`}
                    >
                      {farm.is_active ? "Active" : "Inactive"}
                    </Text>
                  </View>
                </View>
                <Text className="text-label-md text-outline font-mono mt-1">
                  {farm.id.split("-")[0].toUpperCase()}
                </Text>
              </View>
              <View className="relative z-50">
                <Pressable accessibilityRole="button" accessibilityLabel="Button" 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-outline active:bg-surface-container"
                  onPress={() => setOpenMenuFarmId(openMenuFarmId === farm.id ? null : farm.id)}
                >
                  <MaterialIcons name="more-vert" size={20} className="text-on-surface-variant" />
                </Pressable>

                {openMenuFarmId === farm.id && (
                  <View className="absolute top-10 right-0 bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/30 overflow-hidden w-44" style={{ elevation: 5 }}>
                    <Pressable 
                      className="flex-row items-center gap-3 px-4 py-3 active:bg-surface-container"
                      onPress={() => {
                        setOpenMenuFarmId(null);
                        navigation.navigate("AdminEditFarm", { farmId: farm.id });
                      }}
                    >
                      <MaterialIcons name="edit" size={18} className="text-on-surface-variant" />
                      <Text className="font-body-md text-on-surface">Edit Farm</Text>
                    </Pressable>
                    
                    <Pressable 
                      className="flex-row items-center gap-3 px-4 py-3 active:bg-surface-container border-t border-surface-variant/30"
                      onPress={async () => {
                        setOpenMenuFarmId(null);
                        try {
                          await updateFarm(farm.id, { is_active: !farm.is_active });
                          refetch();
                        } catch (e) {
                          console.error("Failed to toggle active status", e);
                        }
                      }}
                    >
                      <MaterialIcons 
                        name={farm.is_active ? "block" : "check-circle-outline"} 
                        size={18} 
                        className={farm.is_active ? "text-error" : "text-primary"} 
                      />
                      <Text className={`font-body-md font-semibold ${farm.is_active ? "text-error" : "text-primary"}`}>
                        {farm.is_active ? "Mark Inactive" : "Mark Active"}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </View>

            <View className="flex-col gap-2 mt-2 z-0">
              <View className="flex-row items-center gap-2">
                <MaterialIcons name="call" size={16} className="text-on-surface-variant" />
                <Text className="text-body-md text-primary font-semibold">
                  {farm.contact_phone || "No Contact"}
                </Text>
              </View>
              <View className="flex-row items-start mt-3 pt-3 border-t border-gray-100">
                <MaterialIcons name="location-on" size={16} color="#64748b" />
                <Text className="flex-1 ml-2 text-sm text-gray-600">
                  {farm.address || farm.location || "No address provided"}
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <MaterialIcons name="warehouse" size={16} className="text-on-surface-variant" />
                <Text className="text-body-md text-on-surface-variant">
                  Capacity: {farm.capacity ? `${farm.capacity} Birds` : "Unknown"}
                </Text>
              </View>
            </View>
          </View>
        )}
      />

    </SafeAreaView>
  );
}
