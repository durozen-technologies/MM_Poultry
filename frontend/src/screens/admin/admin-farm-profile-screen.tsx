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
 setError({ text: typeof msg === "string"? msg : JSON.stringify(msg), ok: false });
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
 <ActivityIndicator size="large"className="text-[#2E7D32]"/>
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
 <MaterialIcons name="error-outline"size={48} className="text-error mb-4"/>
 <Text className="text-error text-center font-semibold mb-6">{error.text}</Text>
 <Pressable 
 onPress={fetchAll} 
 className="bg-[#2E7D32] px-8 py-3.5 rounded-lg flex-row items-center active:bg-[#2E7D32]/90"
 >
 <MaterialIcons name="refresh"size={20} color="white"className="mr-2"/>
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
 className="w-10 h-10 items-center justify-center rounded-lg bg-[#f7f8fa] active:bg-[#f7f8fa]"
 >
 {loading ? (
 <ActivityIndicator size="small"className="text-[#2E7D32]"/>
 ) : (
 <MaterialIcons name="refresh"size={20} className="text-[#202124]"/>
 )}
 </Pressable>
 <Pressable 
 onPress={() => navigation.navigate("AdminEditFarm", { farmId })} 
 className="w-10 h-10 items-center justify-center rounded-lg bg-[#2E7D32]/10 active:bg-[#2E7D32]/20"
 >
 <MaterialIcons name="edit"size={20} className="text-[#2E7D32]"/>
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
 <View className="p-4 rounded-lg mb-4 flex-row items-center bg-error-container/80">
 <MaterialIcons name="error-outline"size={20} className="text-error mr-2"/>
 <Text className="text-sm font-bold text-[#5f6368] font-semibold flex-1 text-error">
 {error.text}
 </Text>
 </View>
 )}

 {/* Farm Info Card */}
 <View className="bg-white rounded-lg p-5 border border-[#e5e7eb] relative overflow-hidden mb-6">
 {farm?.is_active && (
 <View className="absolute top-0 left-0 w-1.5 h-full bg-[#2E7D32]"/>
 )}
 
 <View className="flex-row items-center justify-between mb-4 ml-1">
 <View className="flex-row items-center gap-2">
 <View className="w-8 h-8 rounded-lg bg-[#2E7D32]/10 items-center justify-center">
 <MaterialIcons name="agriculture"size={16} className="text-[#2E7D32]"/>
 </View>
 <Text className="text-base font-bold text-[#5f6368] text-[#202124]">Farm Details</Text>
 </View>
 <View className={`px-2.5 py-1 rounded-lg border ${
 farm?.is_active ? "bg-[#2E7D32]/10 border-[#2E7D32]/20": "bg-[#f7f8fa] border-[#e5e7eb]"
 }`}>
 <Text className={`text-xs font-bold uppercase tracking-widest ${
 farm?.is_active ? "text-[#2E7D32]": "text-[#5f6368]"
 }`}>
 {farm?.is_active ? "Active": "Inactive"}
 </Text>
 </View>
 </View>

 <View className="bg-[#f7f8fa]/30 rounded-lg p-1 border border-[#e5e7eb] ml-1">
 <InfoRow label="Location"value={farm?.location || "—"} icon="place"isFirst />
 <InfoRow label="Phone"value={farm?.contact_phone || "—"} icon="phone"isLast />
 </View>
 </View>

 <View className="flex-row justify-between items-center ml-1 mb-2">
 <Text className="text-2xl font-bold text-[#202124]">Farm Loads</Text>
 <Pressable 
 onPress={() => navigation.navigate("FarmPurchase", { farmId })} 
 className="bg-[#2E7D32] px-4 py-2 rounded-lg flex-row items-center active:scale-[0.97]"
 >
 <MaterialIcons name="add"size={16} color="white"className="mr-1"/>
 <Text className="text-white font-bold text-label-sm uppercase tracking-wider">New Load</Text>
 </Pressable>
 </View>
 </View>
 </>
 }
 ListEmptyComponent={
 <View className="bg-white rounded-lg p-8 border border-dashed border-[#e5e7eb] items-center justify-center mt-2">
 <View className="w-16 h-16 bg-[#f7f8fa] rounded-lg items-center justify-center mb-4">
 <MaterialIcons name="receipt-long"size={32} className="text-[#5f6368]"/>
 </View>
 <Text className="text-2xl font-bold text-[#202124] mb-1">No Loads Yet</Text>
 <Text className="text-base text-[#5f6368] text-[#5f6368] text-center max-w-[250px] mb-6">
 This farm has no recorded loads. Add a new purchase order to start tracking inventory.
 </Text>
 <Pressable
 className="bg-[#2E7D32] px-6 py-3 rounded-lg flex-row items-center"
 onPress={() => navigation.navigate("FarmPurchase", { farmId })}
 >
 <MaterialIcons name="add"size={20} color="white"className="mr-2"/>
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
 <View className={`flex-row items-center p-3 ${!isLast ? 'border-b border-[#e5e7eb]' : ''}`}>
 <View className="w-8 items-center">
 <MaterialIcons name={icon} size={16} className="text-[#5f6368]"/>
 </View>
 <Text className="text-sm font-bold text-[#5f6368] uppercase tracking-wider w-24">{label}</Text>
 <Text className="text-sm font-bold text-[#5f6368] text-[#202124] flex-1 text-right truncate">{value}</Text>
 </View>
 );
});

const ItemSeparator = React.memo(() => <View className="h-4"/>);

const LoadListItem = React.memo(({ item, onPress }: { item: FarmLoad; onPress: () => void }) => {
 return (
 <Pressable 
 onPress={onPress} 
 className="bg-white rounded-lg p-5 border border-[#e5e7eb] active:scale-[0.98] transition-transform relative overflow-hidden"
 >
 <View className={`absolute top-0 left-0 w-1.5 h-full z-10 ${
 item.status === 'OPEN' ? 'bg-[#2E7D32]' : 
 item.status === 'IN_TRANSIT' ? 'bg-tertiary' : 'bg-[#f7f8fa]'
 }`} />

 <View className="flex-row justify-between items-start mb-4 ml-2">
 <View className="flex-row items-center gap-2">
 <View className="w-10 h-10 rounded-lg bg-[#f7f8fa] items-center justify-center border border-[#e5e7eb]">
 <MaterialIcons name="calendar-today"size={18} className="text-[#5f6368]"/>
 </View>
 <View>
 <Text className="text-sm font-bold text-[#5f6368] text-[#5f6368] uppercase tracking-wider mb-0.5">Load Date</Text>
 <Text className="text-base font-bold text-[#5f6368] text-[#202124]">{formatIstDate(item.load_date)}</Text>
 </View>
 </View>
 <View className={`px-2.5 py-1 rounded-lg border ${
 item.status === "OPEN"? "bg-[#2E7D32]/10 border-[#2E7D32]/20": 
 item.status === "IN_TRANSIT"? "bg-[#f7f8fa] border border-[#e5e7eb] border-tertiary/20": 
 "bg-[#f7f8fa] border-[#e5e7eb]"
 }`}>
 <Text className={`text-xs font-bold uppercase tracking-widest ${
 item.status === "OPEN"? "text-[#2E7D32]": 
 item.status === "IN_TRANSIT"? "text-tertiary": 
 "text-[#5f6368]"
 }`}>
 {item.status.replace("_", "")}
 </Text>
 </View>
 </View>

 <View className="flex-row justify-between ml-2 items-end">
 <View>
 <View className="flex-row items-center gap-1.5 mb-1.5">
 <MaterialIcons name="local-shipping"size={14} className="text-[#5f6368]"/>
 <Text className="text-xs font-bold text-[#202124] uppercase tracking-wider">
 {item.vehicle_number || "No vehicle"}
 </Text>
 </View>
 <View className="flex-row items-end gap-1">
 <Text className="text-lg text-[#5f6368] text-[#202124] font-black">
 {Number(item.loaded_weight_kg).toLocaleString("en-IN", { maximumFractionDigits: 1 })}
 </Text>
 <Text className="text-sm font-bold text-[#5f6368] text-[#5f6368] mb-1">KG</Text>
 
 {item.bird_count ? (
 <Text className="text-sm font-bold text-[#5f6368] text-[#5f6368] font-medium mb-1 ml-2">
 ({item.bird_count} birds)
 </Text>
 ) : null}
 </View>
 </View>
 
 <View className="w-10 h-10 rounded-lg bg-[#f7f8fa] items-center justify-center">
 <MaterialIcons name="chevron-right"size={24} className="text-[#5f6368]"/>
 </View>
 </View>
 </Pressable>
 );
});
