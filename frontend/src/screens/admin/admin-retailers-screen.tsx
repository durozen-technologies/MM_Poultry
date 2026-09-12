import React, { useCallback, useState, useMemo } from "react";
import {
 FlatList,
 Pressable,
 Text,
 TextInput,
 View,
 Modal,
 ScrollView,
 ActivityIndicator,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, getApiErrorMessage } from "../../api/client";
import { useAdminRetailers } from "../../hooks/use-queries";
import { DatePickerField } from "../../components/date-picker-field";
import type { LedgerOut } from "../../types/api";
import { formatIstDate, toApiDate, todayIstDate } from "../../utils/ist-date";

import { AdminScreenContainer } from "../../components/admin/admin-screen-container";
import { AdminHeader } from "../../components/admin/admin-header";

export function AdminRetailersScreen({ navigation }: { navigation: any }) {
 const insets = useSafeAreaInsets();
 const { data: retailers = [], isLoading, refetch, isRefetching } = useAdminRetailers();
 const [refreshing, setRefreshing] = useState(false);

 const onRefresh = useCallback(async () => {
 setRefreshing(true);
 try {
 await refetch();
 } finally {
 setRefreshing(false);
 }
 }, [refetch]);

 const [selected, setSelected] = useState<LedgerOut | null>(null);
 const [cash, setCash] = useState("0");
 const [upi, setUpi] = useState("0");
 const [paymentDate, setPaymentDate] = useState(todayIstDate());
 const [paymentNotes, setPaymentNotes] = useState("");
 const [msg, setMsg] = useState<string | null>(null);
 const [searchQuery, setSearchQuery] = useState("");
 const [filter, setFilter] = useState<"All"| "Active"| "Inactive">("All");

 const openLedger = useCallback(async (id: string) => {
 try {
 const { data } = await api.get(`/admin/retailers/${id}/ledger`);
 setSelected(data);
 } catch (e) {
 console.warn("Failed to open ledger", e);
 }
 }, []);

 const collect = useCallback(async () => {
 if (!selected) return;
 try {
 await api.post(`/admin/retailers/${selected.retailer.id}/payments`, {
 cash_amount: cash,
 upi_amount: upi,
 payment_date: toApiDate(paymentDate),
 notes: paymentNotes
 });
 await openLedger(selected.retailer.id);
 await refetch();
 setMsg("Payment recorded successfully");
 setTimeout(() => setMsg(null), 3000);
 setCash("0");
 setUpi("0");
 setPaymentNotes("");
 } catch (e) {
 setMsg(getApiErrorMessage(e));
 }
 }, [selected, cash, upi, paymentDate, openLedger, refetch]);

 const filteredRetailers = useMemo(() => retailers.filter((r) => {
 if (searchQuery && !r.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
 if (filter === "Active"&& !r.is_active) return false;
 if (filter === "Inactive"&& r.is_active) return false;
 return true;
 }), [retailers, searchQuery, filter]);

 const activeCount = useMemo(() => retailers.filter(r => r.is_active).length, [retailers]);
 const totalOutstanding = useMemo(() => retailers.reduce((sum, r) => sum + Number(r.credit_balance || 0), 0), [retailers]);

 return (
 <AdminScreenContainer
 noScroll
 header={
 <AdminHeader 
 title="Retailers"
 subtitle="Manage your wholesale network"
 onBack={() => navigation.goBack()} 
 rightContent={
 <View className="flex-row gap-2">
 <Pressable
 accessibilityRole="button"
 className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#f7f8fa] active:bg-[#f7f8fa]"
 onPress={() => refetch()}
 >
 {isRefetching ? (
 <ActivityIndicator size="small"className="text-[#2E7D32]"/>
 ) : (
 <MaterialIcons name="refresh"size={22} className="text-[#202124]"/>
 )}
 </Pressable>
 <Pressable
 accessibilityRole="button"
 className="h-10 px-4 rounded-lg flex-row items-center justify-center bg-[#2E7D32] active:bg-[#2E7D32]/90"
 onPress={() => navigation.navigate("AddRetailer")}
 >
 <MaterialIcons name="person-add"size={20} color="white"className="mr-1.5"/>
 <Text className="text-sm font-bold text-white font-bold">Add</Text>
 </Pressable>
 </View>
 }
 />
 }
 >
 <FlatList
 data={filteredRetailers}
 keyExtractor={(item) => String(item.id)}
 refreshing={refreshing}
 onRefresh={onRefresh}
 className="flex-1 px-4"
 contentContainerStyle={{ paddingBottom: 100 }}
 showsVerticalScrollIndicator={false}
 initialNumToRender={10}
 maxToRenderPerBatch={10}
 windowSize={5}
 removeClippedSubviews={true}
 ListHeaderComponent={
 <>
 <View className="flex-col gap-4 mb-6 pt-2">
 {/* KPIs */}
 <View className="flex-row gap-3 mb-2">
 <View className="flex-1 min-w-0 bg-[#2E7D32] rounded-lg p-4 flex-col">
 <View className="flex-row justify-between items-start mb-2">
 <Text className="text-sm font-bold text-[#5f6368] text-[#2E7D32] uppercase tracking-wider flex-1"numberOfLines={1}>Active Retailers</Text>
 <View className="w-8 h-8 shrink-0 bg-white/10 rounded-lg items-center justify-center ml-1">
 <MaterialIcons name="storefront"size={16} className="text-[#2E7D32]"/>
 </View>
 </View>
 <Text className="text-3xl font-black text-white font-bold"numberOfLines={1} adjustsFontSizeToFit>{activeCount}</Text>
 </View>
 <View className="flex-1 min-w-0 bg-error-container/80 rounded-lg p-4 border border-error/20 flex-col">
 <View className="flex-row justify-between items-start mb-2">
 <Text className="text-sm font-bold text-[#5f6368] text-error uppercase tracking-wider flex-1"numberOfLines={1}>Total Due</Text>
 <View className="w-8 h-8 shrink-0 bg-error/10 rounded-lg items-center justify-center ml-1">
 <MaterialIcons name="account-balance-wallet"size={16} className="text-error"/>
 </View>
 </View>
 <Text className="text-lg text-[#5f6368] text-on-error-container"numberOfLines={1} adjustsFontSizeToFit>₹{totalOutstanding.toLocaleString("en-IN")}</Text>
 </View>
 </View>

 {/* Search */}
 <View className="flex-row items-center">
 <View className="absolute left-4"pointerEvents="none">
 <MaterialIcons name="search"size={20} className="text-[#5f6368]"/>
 </View>
 <TextInput
 placeholderTextColor="#717973"
 className="flex-1 h-14 pl-12 pr-4 bg-white border border-[#e5e7eb] rounded-lg text-lg text-[#202124] text-[#202124] focus:border-[#2E7D32]"
 placeholder="Search retailers..."
 value={searchQuery}
 onChangeText={setSearchQuery}
 />
 </View>

 {/* Filters */}
 <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row overflow-visible">
 {(["All", "Active", "Inactive"] as const).map((f) => (
 <Pressable
 key={f}
 onPress={() => setFilter(f)}
 className={`h-10 px-5 rounded-lg flex items-center justify-center border mr-3 ${
 filter === f 
 ? "bg-[#2E7D32] border-[#2E7D32]"
 : "bg-white border-[#e5e7eb]"
 }`}
 >
 <Text
 className={`text-sm font-bold text-[#5f6368] ${
 filter === f ? "text-white font-bold": "text-[#5f6368]"
 }`}
 >
 {f}
 </Text>
 </Pressable>
 ))}
 </ScrollView>
 </View>
 </>
 }
 ListEmptyComponent={
 isLoading ? (
 <View className="flex-col items-center justify-center py-12">
 <ActivityIndicator size="large"className="text-[#2E7D32] mb-4"/>
 <Text className="text-[#5f6368] font-medium">Loading retailers...</Text>
 </View>
 ) : (
 <View className="flex-col items-center justify-center py-12 px-4 border border-dashed border-[#e5e7eb] rounded-lg mt-4">
 <View className="w-20 h-20 bg-[#f7f8fa] rounded-lg flex items-center justify-center mb-4">
 <MaterialIcons name="storefront"size={40} className="text-[#5f6368]"/>
 </View>
 <Text className="text-2xl font-bold text-[#202124] mb-2 text-center">
 No retailers yet
 </Text>
 <Text className="text-base text-[#5f6368] text-[#5f6368] mb-6 text-center max-w-[250px]">
 {searchQuery || filter !== "All"
 ? "No retailers match your search filters."
 : "Start building your network by adding your first wholesale customer."}
 </Text>
 {!searchQuery && filter === "All"&& (
 <Pressable
 className="bg-[#2E7D32] px-6 py-3 rounded-lg flex-row items-center"
 onPress={() => navigation.navigate("AddRetailer")}
 >
 <MaterialIcons name="add"size={20} color="white"className="mr-2"/>
 <Text className="text-white font-bold">Add Retailer</Text>
 </Pressable>
 )}
 </View>
 )
 }
 ItemSeparatorComponent={() => <View className="h-4"/>}
 renderItem={({ item }) => (
 <RetailerListItem 
 item={item} 
 onPress={() => navigation.navigate("RetailerProfile", { retailerId: item.id })}
 onPay={() => openLedger(item.id)}
 />
 )}
 />

 {/* Ledger Modal for backwards compatibility until retailer_profile is built */}
 <Modal visible={!!selected} animationType="slide"transparent>
 <View className="flex-1 bg-[#2E7D32]/60 justify-end">
 <View className="bg-white rounded-t-3xl h-[85%] border-t border-[#e5e7eb]">
 <View className="flex-row justify-between items-center p-6 border-b border-[#e5e7eb] bg-white">
 <View>
 <Text className="text-2xl font-bold text-[#202124] mb-1">
 {selected?.retailer.name}
 </Text>
 <Text className="text-[#5f6368] font-medium">Account Ledger</Text>
 </View>
 <Pressable
 className="w-10 h-10 bg-[#f7f8fa] rounded-lg items-center justify-center active:bg-[#f7f8fa]"
 onPress={() => setSelected(null)}
 >
 <MaterialIcons name="close"size={20} className="text-[#202124]"/>
 </Pressable>
 </View>
 
 <View className="flex-1 p-6">
 {msg && (
 <View className={`mb-4 p-3 rounded-lg flex-row items-center ${msg.includes('success') ? 'bg-[#2E7D32]/10/80' : 'bg-error-container/80'}`}>
 <MaterialIcons name={msg.includes('success') ? "check-circle": "error-outline"} size={20} className={`${msg.includes('success') ? "text-on-primary-container": "text-error"} mr-2`} />
 <Text className={`text-sm font-bold text-[#5f6368] ${msg.includes('success') ? "text-on-primary-container": "text-error"}`}>
 {msg}
 </Text>
 </View>
 )}

 <View className="bg-error-container/20 border border-error/20 rounded-lg p-4 mb-6">
 <Text className="text-error uppercase tracking-wider text-label-sm mb-1">Total Outstanding</Text>
 <Text className="text-2xl font-bold text-error font-black">
 ₹{Number(selected?.credit_balance || 0).toLocaleString("en-IN")}
 </Text>
 </View>


 <View className="bg-white border border-[#e5e7eb] rounded-lg p-5 gap-4">
 <View className="flex-row items-center gap-2 mb-1">
 <MaterialIcons name="payments"size={20} className="text-[#2E7D32]"/>
 <Text className="text-base font-bold text-[#5f6368] text-[#202124]">Record Payment</Text>
 </View>
 
 <DatePickerField 
 label="Payment Date"
 value={paymentDate} 
 onChange={setPaymentDate} 
 inputStyle="h-12 bg-white border border-[#e5e7eb] rounded-lg px-4"
 />
 
 <View className="flex-row gap-3 mt-1">
 <View className="flex-1">
 <Text className="text-sm font-bold text-[#5f6368] text-[#5f6368] mb-1.5 ml-1">Cash (₹)</Text>
 <TextInput
 className="h-14 bg-white border border-[#e5e7eb] rounded-lg px-4 text-lg text-[#202124] text-[#202124] focus:border-[#2E7D32]"
 value={cash}
 onChangeText={setCash}
 placeholder="0.00"
 placeholderTextColor="#717973"
 keyboardType="decimal-pad"
 />
 </View>
 <View className="flex-1">
 <Text className="text-sm font-bold text-[#5f6368] text-[#5f6368] mb-1.5 ml-1">UPI (₹)</Text>
 <TextInput
 className="h-14 bg-white border border-[#e5e7eb] rounded-lg px-4 text-lg text-[#202124] text-[#202124] focus:border-[#2E7D32]"
 value={upi}
 onChangeText={setUpi}
 placeholder="0.00"
 placeholderTextColor="#717973"
 keyboardType="decimal-pad"
 />
 </View>
 </View>
 
 <View>
 <Text className="text-sm font-bold text-[#5f6368] text-[#5f6368] mb-1.5 ml-1">Notes (Optional)</Text>
 <TextInput
 className="h-14 bg-white border border-[#e5e7eb] rounded-lg px-4 text-lg text-[#202124] text-[#202124] focus:border-[#2E7D32]"
 value={paymentNotes}
 onChangeText={setPaymentNotes}
 placeholder="e.g. Bank Transfer"
 placeholderTextColor="#717973"
 />
 </View>
 
 <Pressable
 className="bg-[#2E7D32] h-14 mt-2 rounded-lg flex-row items-center justify-center gap-2 active:opacity-80"
 onPress={collect}
 >
 <Text className="text-white font-bold text-base font-bold">Confirm Payment</Text>
 <MaterialIcons name="check-circle"size={20} color="white"/>
 </Pressable>
 </View>
 </View>
 </View>
 </View>
 </Modal>
 </AdminScreenContainer>
 );
}

const RetailerListItem = React.memo(({ 
 item, 
 onPress,
 onPay
}: { 
 item: any; 
 onPress: () => void;
 onPay: () => void;
}) => {
 const bal = useMemo(() => Number(item.credit_balance || 0), [item.credit_balance]);
 
 return (
 <Pressable
 className="bg-white rounded-lg p-5 border border-[#e5e7eb] border-l-4 active:opacity-80"
 style={{ borderLeftColor: item.is_active ? "#012d1d": "#c1c9bf"}}
 onPress={onPress}
 >
 <View className="flex-row justify-between items-start mb-4 ml-2">
 <View className="flex-col flex-1 pr-4">
 <Text className="text-2xl font-bold text-[#202124] tracking-tight mb-1"numberOfLines={1}>
 {item.name}
 </Text>
 <Text className="text-base text-[#5f6368] text-[#5f6368] font-medium">
 {item.shop_name || "No shop name"}
 </Text>
 </View>
 <View
 className={`px-3 py-1 rounded-lg border ${
 item.is_active ? "bg-[#2E7D32]/10 border-[#2E7D32]/20": "bg-[#f7f8fa] border-[#e5e7eb]"
 }`}
 >
 <Text
 className={`text-xs font-bold uppercase tracking-widest ${
 item.is_active ? "text-[#2E7D32]": "text-[#5f6368]"
 }`}
 >
 {item.is_active ? "Active": "Inactive"}
 </Text>
 </View>
 </View>

 <View className="flex-row justify-between ml-2 mb-4">
 <View className="flex-col flex-1 pr-2">
 <View className="flex-row items-center mb-1">
 <MaterialIcons name="location-on"size={14} className="text-[#5f6368] mr-1"/>
 <Text className="text-xs font-bold text-[#5f6368] uppercase tracking-wider">
 Location
 </Text>
 </View>
 <Text className="text-base text-[#5f6368] text-[#202124] font-medium"numberOfLines={1}>
 {item.address || "N/A"}
 </Text>
 </View>
 <View className="flex-col flex-1 pl-2 border-l border-[#e5e7eb]">
 <View className="flex-row items-center mb-1">
 <MaterialIcons name="call"size={14} className="text-[#5f6368] mr-1"/>
 <Text className="text-xs font-bold text-[#5f6368] uppercase tracking-wider">
 Contact
 </Text>
 </View>
 <Text className="text-base text-[#5f6368] text-[#202124] font-medium">
 {item.phone || "N/A"}
 </Text>
 </View>
 </View>

 <View className="pt-4 mt-2 border-t border-[#e5e7eb] ml-2 flex-row justify-between items-center">
 <View className="flex-col">
 <Text className="text-xs font-bold text-[#5f6368] uppercase tracking-wider mb-1">
 Outstanding Balance
 </Text>
 <Text
 className={`text-lg text-[#5f6368] font-black ${
 bal > 0 ? "text-error": "text-[#2E7D32]"
 }`}
 >
 ₹{bal.toLocaleString("en-IN")}
 </Text>
 </View>
 {bal > 0 && (
 <Pressable
 className="bg-[#2E7D32]/10 px-4 py-2 rounded-lg border border-[#2E7D32]/20 active:bg-[#2E7D32]/20"
 onPress={onPay}
 >
 <Text className="text-[#2E7D32]">Pay Now</Text>
 </Pressable>
 )}
 </View>
 </Pressable>
 );
});
