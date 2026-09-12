import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { api } from "../../api/client";
import { formatIstDate } from "../../utils/ist-date";
import type { FarmLoad } from "../../types/api";

import { AdminScreenContainer } from "../../components/admin/admin-screen-container";
import { AdminHeader } from "../../components/admin/admin-header";

export function AdminFarmLoadDetailScreen({ route, navigation }: { route: any; navigation: any }) {
 const { loadId } = route.params || {};
 const [load, setLoad] = useState<FarmLoad | null>(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<{ text: string; ok: boolean } | null>(null);

 const fetchLoad = useCallback(async () => {
 if (!loadId) {
 setError({ text: "Missing load ID", ok: false });
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
 setError({ text: typeof msg === "string"? msg : JSON.stringify(msg), ok: false });
 } finally {
 setLoading(false);
 }
 }, [loadId]);

 useFocusEffect(
 useCallback(() => {
 void fetchLoad();
 }, [fetchLoad])
 );

 if (loading && !load) {
 return (
 <AdminScreenContainer
 header={
 <AdminHeader 
 title="Loading Details..."
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

 if (error && !load) {
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
 onPress={fetchLoad} 
 className="bg-[#2E7D32] px-8 py-3.5 rounded-lg flex-row items-center active:bg-[#2E7D32]/90"
 >
 <MaterialIcons name="refresh"size={20} color="white"className="mr-2"/>
 <Text className="text-white font-bold">Try Again</Text>
 </Pressable>
 </View>
 </AdminScreenContainer>
 );
 }

 if (!load) {
 return (
 <AdminScreenContainer
 header={
 <AdminHeader 
 title="Not Found"
 onBack={() => navigation.goBack()} 
 />
 }
 >
 <View className="py-12 items-center justify-center px-4">
 <MaterialIcons name="search-off"size={48} className="text-[#5f6368]/50 mb-4"/>
 <Text className="text-[#5f6368] text-center font-medium">No load details could be found.</Text>
 </View>
 </AdminScreenContainer>
 );
 }

 return (
 <AdminScreenContainer
 noScroll
 header={
 <AdminHeader 
 title="Load Details"
 subtitle="View purchase order information"
 onBack={() => navigation.goBack()} 
 rightContent={
 <View className="flex-row gap-2">
 <Pressable 
 onPress={fetchLoad} 
 className="w-10 h-10 items-center justify-center rounded-lg bg-[#f7f8fa] active:bg-[#f7f8fa]"
 >
 {loading ? (
 <ActivityIndicator size="small"className="text-[#2E7D32]"/>
 ) : (
 <MaterialIcons name="refresh"size={20} className="text-[#202124]"/>
 )}
 </Pressable>
 <Pressable 
 onPress={() => navigation.navigate("FarmPurchase", { loadId: load.id })} 
 className="w-10 h-10 items-center justify-center rounded-lg bg-[#2E7D32]/10 active:bg-[#2E7D32]/20"
 >
 <MaterialIcons name="edit"size={20} className="text-[#2E7D32]"/>
 </Pressable>
 </View>
 }
 />
 }
 >
 <ScrollView className="flex-1 px-4"contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
 <View className="pt-2">
 
 {/* Status Banner */}
 <View className="bg-white border border-[#e5e7eb] rounded-lg p-5 mb-6 relative overflow-hidden">
 <View className={`absolute top-0 left-0 w-1.5 h-full ${
 load.status === 'OPEN' ? 'bg-[#2E7D32]' : 
 load.status === 'IN_TRANSIT' ? 'bg-tertiary' : 'bg-[#f7f8fa]'
 }`} />
 
 <View className="flex-row justify-between items-center ml-2">
 <View className="flex-row items-center gap-2">
 <MaterialIcons name="info-outline"size={20} className="text-[#5f6368]"/>
 <Text className="text-sm font-bold text-[#5f6368] text-[#5f6368] uppercase tracking-wider">Status</Text>
 </View>
 <View className={`px-3 py-1.5 rounded-lg border ${
 load.status === "OPEN"? "bg-[#2E7D32]/10 border-[#2E7D32]/20": 
 load.status === "IN_TRANSIT"? "bg-[#f7f8fa] border border-[#e5e7eb] border-tertiary/20": 
 "bg-[#f7f8fa] border-[#e5e7eb]"
 }`}>
 <Text className={`text-xs font-bold uppercase tracking-widest ${
 load.status === "OPEN"? "text-[#2E7D32]": 
 load.status === "IN_TRANSIT"? "text-tertiary": 
 "text-[#5f6368]"
 }`}>
 {load.status.replace("_", "")}
 </Text>
 </View>
 </View>
 </View>

 {/* Load Info */}
 <View className="bg-white rounded-lg p-5 border border-[#e5e7eb] mb-6">
 <View className="flex-row items-center gap-2 mb-4">
 <View className="w-8 h-8 rounded-lg bg-[#2E7D32]/10 items-center justify-center">
 <MaterialIcons name="inventory-2"size={16} className="text-[#2E7D32]"/>
 </View>
 <Text className="text-base font-bold text-[#5f6368] text-[#202124]">Load Information</Text>
 </View>
 
 <View className="bg-[#f7f8fa]/30 rounded-lg p-1 border border-[#e5e7eb]">
 <InfoRow label="Date"value={formatIstDate(load.load_date)} icon="calendar-today"isFirst />
 <InfoRow label="Farm ID"value={load.farm_id || "—"} icon="agriculture"/>
 <InfoRow label="Vehicle"value={load.vehicle_number || "—"} icon="local-shipping"/>
 <InfoRow label="Driver"value={load.driver_name || "—"} icon="person"/>
 
 <View className="h-[1px] bg-outline-variant/20 my-2 mx-3"/>
 
 <InfoRow label="Weight"value={`${Number(load.loaded_weight_kg).toLocaleString("en-IN", { maximumFractionDigits: 1 })} kg`} icon="scale"/>
 <InfoRow label="Birds"value={load.bird_count ? Number(load.bird_count).toLocaleString("en-IN") : "—"} icon="pets"/>
 <InfoRow label="Boxes"value={load.total_boxes ? Number(load.total_boxes).toLocaleString("en-IN") : "—"} icon="all-inbox"isLast />
 </View>
 </View>

 {/* Commercial Info */}
 <View className="bg-white rounded-lg p-5 border border-[#e5e7eb] mb-6">
 <View className="flex-row items-center gap-2 mb-4">
 <View className="w-8 h-8 rounded-lg bg-[#f7f8fa] border border-[#e5e7eb] items-center justify-center">
 <MaterialIcons name="receipt-long"size={16} className="text-secondary"/>
 </View>
 <Text className="text-base font-bold text-[#5f6368] text-[#202124]">Commercial Details</Text>
 </View>
 
 <View className="bg-[#f7f8fa]/30 rounded-lg p-1 border border-[#e5e7eb]">
 <InfoRow 
 label="Rate/kg"
 value={load.rate_per_kg ? `₹${Number(load.rate_per_kg).toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "—"} 
 icon="price-change"
 isFirst 
 />
 <InfoRow 
 label="Total"
 value={load.total_amount ? `₹${Number(load.total_amount).toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "—"} 
 icon="account-balance-wallet"
 valueStyle="text-[#2E7D32] font-black"
 />
 <InfoRow 
 label="Paid"
 value={load.paid_amount ? `₹${Number(load.paid_amount).toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "₹0"} 
 icon="payments"
 />
 
 <View className="h-[1px] bg-outline-variant/20 my-2 mx-3"/>
 
 <View className="flex-row items-center p-3">
 <View className="w-8 items-center">
 <MaterialIcons name="payment"size={16} className="text-[#5f6368]"/>
 </View>
 <Text className="text-sm font-bold text-[#5f6368] uppercase tracking-wider w-24">Method</Text>
 <View className="flex-1 items-end">
 {(() => {
 const method = (load.payment_method || "").toLowerCase();
 if (!method) return <Text className="text-sm font-bold text-[#5f6368] text-[#202124]">—</Text>;
 
 const isUpi = method.includes("upi");
 const isBank = method.includes("bank");
 const isCredit = method.includes("credit");
 const isCash = method.includes("cash");
 const bg = isCash ? "bg-emerald-100": isUpi ? "bg-blue-100": isBank ? "bg-sky-100": isCredit ? "bg-purple-100": "bg-[#f7f8fa]";
 const text = isCash ? "text-emerald-800": isUpi ? "text-blue-800": isBank ? "text-sky-800": isCredit ? "text-purple-800": "text-[#202124]";
 const label = isCash ? "Cash": isUpi ? "UPI": isBank ? "Bank Transfer": isCredit ? "Credit": load.payment_method;
 
 return (
 <View className={`px-2 py-0.5 rounded ${bg}`}>
 <Text className={`text-xs font-bold tracking-wide ${text}`}>{label}</Text>
 </View>
 );
 })()}
 </View>
 </View>
 </View>
 
 {/* Balance Due */}
 <View className="mt-4 bg-error-container/20 rounded-lg p-4 border border-error/10 flex-row justify-between items-center">
 <View className="flex-row items-center gap-2">
 <MaterialIcons name="account-balance"size={20} className="text-error"/>
 <Text className="text-sm font-bold text-[#5f6368] text-error uppercase tracking-wider">Balance Due</Text>
 </View>
 <Text className="text-2xl font-bold font-black text-error">
 ₹{(Number(load.total_amount || 0) - Number(load.paid_amount || 0)).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
 </Text>
 </View>
 </View>

 {/* Remarks */}
 {load.remarks ? (
 <View className="bg-white rounded-lg p-5 border border-[#e5e7eb] mb-6">
 <View className="flex-row items-center gap-2 mb-3">
 <View className="w-8 h-8 rounded-lg bg-[#f7f8fa] border border-[#e5e7eb] items-center justify-center">
 <MaterialIcons name="notes"size={16} className="text-tertiary"/>
 </View>
 <Text className="text-base font-bold text-[#5f6368] text-[#202124]">Remarks</Text>
 </View>
 <View className="bg-[#f7f8fa]/30 rounded-lg p-4 border border-[#e5e7eb]">
 <Text className="text-base text-[#202124] text-[#202124] font-medium leading-relaxed">{load.remarks}</Text>
 </View>
 </View>
 ) : null}
 
 </View>
 </ScrollView>
 </AdminScreenContainer>
 );
}

function InfoRow({ 
 label, 
 value, 
 icon,
 isFirst = false, 
 isLast = false,
 valueStyle = "text-[#202124]"
}: { 
 label: string; 
 value: string; 
 icon: keyof typeof MaterialIcons.glyphMap;
 isFirst?: boolean; 
 isLast?: boolean;
 valueStyle?: string;
}) {
 return (
 <View className={`flex-row items-center p-3 ${!isLast && !label.includes('Rate') && !label.includes('Paid') ? 'border-b border-[#e5e7eb]' : ''}`}>
 <View className="w-8 items-center">
 <MaterialIcons name={icon} size={16} className="text-[#5f6368]"/>
 </View>
 <Text className="text-sm font-bold text-[#5f6368] uppercase tracking-wider w-24">{label}</Text>
 <Text className={`text-sm font-bold text-[#5f6368] flex-1 text-right truncate ${valueStyle}`}>{value}</Text>
 </View>
 );
}
