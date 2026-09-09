import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { api } from "../../api/client";
import { formatIstDate } from "../../utils/ist-date";
import type { FarmOut, FarmLoad } from "../../types/api";

import { AdminScreenContainer } from "../../components/admin/admin-screen-container";
import { AdminHeader } from "../../components/admin/admin-header";

export function AdminFarmProfileScreen({ route, navigation }: { route: any; navigation: any }) {
  const { farmId } = route.params || {};
  const [farm, setFarm] = useState<FarmOut | null>(null);
  const [loads, setLoads] = useState<FarmLoad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ text: string; ok: boolean } | null>(null);

  const fetchAll = useCallback(async () => {
    if (!farmId) {
      setError({ text: "Missing farm ID", ok: false });
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
      setError({ text: typeof msg === "string" ? msg : JSON.stringify(msg), ok: false });
    } finally {
      setLoading(false);
    }
  }, [farmId]);

  useFocusEffect(useCallback(() => { void fetchAll(); }, [fetchAll]));

  if (loading && !farm) {
    return (
      <AdminScreenContainer
        header={
          <AdminHeader 
            title="Loading Farm..." 
            onBack={() => navigation.goBack()} 
          />
        }
      >
        <View className="py-24 items-center justify-center">
          <ActivityIndicator size="large" className="text-primary" />
        </View>
      </AdminScreenContainer>
    );
  }

  if (error && !farm) {
    return (
      <AdminScreenContainer
        header={
          <AdminHeader 
            title="Error" 
            onBack={() => navigation.goBack()} 
          />
        }
      >
        <View className="py-12 items-center justify-center px-4">
          <MaterialIcons name="error-outline" size={48} className="text-error mb-4" />
          <Text className="text-error text-center font-semibold mb-6">{error.text}</Text>
          <Pressable 
            onPress={fetchAll} 
            className="bg-primary px-8 py-3.5 rounded-full flex-row items-center active:bg-primary/90"
          >
            <MaterialIcons name="refresh" size={20} color="white" className="mr-2" />
            <Text className="text-white font-bold">Try Again</Text>
          </Pressable>
        </View>
      </AdminScreenContainer>
    );
  }

  return (
    <AdminScreenContainer
      noScroll
      header={
        <AdminHeader 
          title={farm?.name || "Farm Profile"} 
          subtitle="Manage farm details and loads"
          onBack={() => navigation.goBack()} 
          rightContent={
            <View className="flex-row gap-2">
              <Pressable 
                onPress={fetchAll} 
                className="w-10 h-10 items-center justify-center rounded-full bg-surface-container-highest active:bg-surface-variant"
              >
                {loading ? (
                  <ActivityIndicator size="small" className="text-primary" />
                ) : (
                  <MaterialIcons name="refresh" size={20} className="text-on-surface" />
                )}
              </Pressable>
              <Pressable 
                onPress={() => navigation.navigate("AdminEditFarm", { farmId })} 
                className="w-10 h-10 items-center justify-center rounded-full bg-primary/10 active:bg-primary/20"
              >
                <MaterialIcons name="edit" size={20} className="text-primary" />
              </Pressable>
            </View>
          }
        />
      }
    >
      <FlatList
        data={loads}
        keyExtractor={(item) => item.id}
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        ListHeaderComponent={
          <>
            <View className="pt-2 mb-6">
              {error && (
                <View className="p-4 rounded-xl mb-4 flex-row items-center bg-error-container/80">
                  <MaterialIcons name="error-outline" size={20} className="text-error mr-2" />
                  <Text className="font-label-md font-semibold flex-1 text-error">
                    {error.text}
                  </Text>
                </View>
              )}

              {/* Farm Info Card */}
              <View className="bg-surface-container-lowest rounded-3xl p-5 border border-outline-variant/30 shadow-sm relative overflow-hidden mb-6">
                {farm?.is_active && (
                  <View className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
                )}
                
                <View className="flex-row items-center justify-between mb-4 ml-1">
                  <View className="flex-row items-center gap-2">
                    <View className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center">
                      <MaterialIcons name="agriculture" size={16} className="text-primary" />
                    </View>
                    <Text className="font-title-md text-on-surface font-bold">Farm Details</Text>
                  </View>
                  <View className={`px-2.5 py-1 rounded-full border ${
                    farm?.is_active ? "bg-primary/10 border-primary/20" : "bg-surface-variant/30 border-outline-variant/20"
                  }`}>
                    <Text className={`font-label-sm uppercase tracking-widest font-bold ${
                      farm?.is_active ? "text-primary" : "text-on-surface-variant"
                    }`}>
                      {farm?.is_active ? "Active" : "Inactive"}
                    </Text>
                  </View>
                </View>

                <View className="bg-surface-container-highest/30 rounded-2xl p-1 border border-outline-variant/10 ml-1">
                  <InfoRow label="Owner" value={farm?.owner_name || "—"} icon="person" isFirst />
                  <InfoRow label="Location" value={farm?.location || "—"} icon="place" />
                  <InfoRow label="Address" value={farm?.address || "—"} icon="home" />
                  <InfoRow label="Phone" value={farm?.contact_phone || "—"} icon="phone" isLast />
                </View>
              </View>

              <View className="flex-row justify-between items-center ml-1 mb-2">
                <Text className="font-title-lg text-on-surface font-bold">Farm Loads</Text>
                <Pressable 
                  onPress={() => navigation.navigate("FarmPurchase", { farmId })} 
                  className="bg-primary px-4 py-2 rounded-full flex-row items-center shadow-sm shadow-primary/20 active:scale-[0.97]"
                >
                  <MaterialIcons name="add" size={16} color="white" className="mr-1" />
                  <Text className="text-white font-bold text-label-sm uppercase tracking-wider">New Load</Text>
                </Pressable>
              </View>
            </View>
          </>
        }
        ListEmptyComponent={
          <View className="bg-surface-container-lowest rounded-3xl p-8 border border-dashed border-outline-variant/50 items-center justify-center mt-2">
            <View className="w-16 h-16 bg-surface-variant/30 rounded-full items-center justify-center mb-4">
              <MaterialIcons name="receipt-long" size={32} className="text-on-surface-variant/70" />
            </View>
            <Text className="font-title-lg text-on-surface font-bold mb-1">No Loads Yet</Text>
            <Text className="font-body-md text-on-surface-variant text-center max-w-[250px] mb-6">
              This farm has no recorded loads. Add a new purchase order to start tracking inventory.
            </Text>
            <Pressable
              className="bg-primary px-6 py-3 rounded-full flex-row items-center"
              onPress={() => navigation.navigate("FarmPurchase", { farmId })}
            >
              <MaterialIcons name="add" size={20} color="white" className="mr-2" />
              <Text className="text-white font-bold">Record First Load</Text>
            </Pressable>
          </View>
        }
        ItemSeparatorComponent={ItemSeparator}
        renderItem={({ item }) => <LoadListItem item={item} onPress={() => navigation.navigate("AdminFarmLoadDetail", { loadId: item.id })} />}
      />
    </AdminScreenContainer>
  );
}

const InfoRow = React.memo(({ label, value, icon, isFirst = false, isLast = false }: { label: string; value: string; icon: keyof typeof MaterialIcons.glyphMap; isFirst?: boolean; isLast?: boolean }) => {
  return (
    <View className={`flex-row items-center p-3 ${!isLast ? 'border-b border-outline-variant/10' : ''}`}>
      <View className="w-8 items-center">
        <MaterialIcons name={icon} size={16} className="text-on-surface-variant" />
      </View>
      <Text className="text-label-md font-bold text-on-surface-variant uppercase tracking-wider w-24">{label}</Text>
      <Text className="font-title-sm font-bold text-on-surface flex-1 text-right truncate">{value}</Text>
    </View>
  );
});

const ItemSeparator = React.memo(() => <View className="h-4" />);

const LoadListItem = React.memo(({ item, onPress }: { item: FarmLoad; onPress: () => void }) => {
  return (
    <Pressable 
      onPress={onPress} 
      className="bg-surface-container-lowest rounded-3xl p-5 border border-outline-variant/20 shadow-sm active:scale-[0.98] transition-transform relative overflow-hidden"
    >
      <View className={`absolute top-0 left-0 w-1.5 h-full z-10 ${
        item.status === 'OPEN' ? 'bg-primary' : 
        item.status === 'IN_TRANSIT' ? 'bg-tertiary' : 'bg-surface-variant'
      }`} />

      <View className="flex-row justify-between items-start mb-4 ml-2">
        <View className="flex-row items-center gap-2">
          <View className="w-10 h-10 rounded-full bg-surface-container-highest items-center justify-center border border-outline-variant/30">
            <MaterialIcons name="calendar-today" size={18} className="text-on-surface-variant" />
          </View>
          <View>
            <Text className="font-label-md text-on-surface-variant font-bold uppercase tracking-wider mb-0.5">Load Date</Text>
            <Text className="font-title-md text-on-surface font-bold">{formatIstDate(item.load_date)}</Text>
          </View>
        </View>
        <View className={`px-2.5 py-1 rounded-full border ${
          item.status === "OPEN" ? "bg-primary/10 border-primary/20" : 
          item.status === "IN_TRANSIT" ? "bg-tertiary/10 border-tertiary/20" : 
          "bg-surface-variant/30 border-outline-variant/20"
        }`}>
          <Text className={`font-label-sm uppercase tracking-widest font-bold ${
            item.status === "OPEN" ? "text-primary" : 
            item.status === "IN_TRANSIT" ? "text-tertiary" : 
            "text-on-surface-variant"
          }`}>
            {item.status.replace("_", " ")}
          </Text>
        </View>
      </View>

      <View className="flex-row justify-between ml-2 items-end">
        <View>
          <View className="flex-row items-center gap-1.5 mb-1.5">
            <MaterialIcons name="local-shipping" size={14} className="text-on-surface-variant" />
            <Text className="font-label-sm text-on-surface font-bold uppercase tracking-wider">
              {item.vehicle_number || "No vehicle"}
            </Text>
          </View>
          <View className="flex-row items-end gap-1">
            <Text className="font-headline-sm text-on-surface font-black">
              {Number(item.loaded_weight_kg).toLocaleString("en-IN", { maximumFractionDigits: 1 })}
            </Text>
            <Text className="font-label-md text-on-surface-variant font-bold mb-1">KG</Text>
            
            {item.bird_count ? (
              <Text className="font-label-md text-on-surface-variant font-medium mb-1 ml-2">
                ({item.bird_count} birds)
              </Text>
            ) : null}
          </View>
        </View>
        
        <View className="w-10 h-10 rounded-full bg-surface-variant/30 items-center justify-center">
          <MaterialIcons name="chevron-right" size={24} className="text-on-surface-variant" />
        </View>
      </View>
    </Pressable>
  );
});
