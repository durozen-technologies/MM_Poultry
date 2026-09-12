import { View, Text, Pressable, FlatList, ActivityIndicator, TextInput, Modal, Alert, ScrollView } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import React, { useState, useMemo, useCallback } from "react";
import { useAdminInventoryItemLoads } from "../../hooks/use-queries";
import { formatIstDate, toApiDate, parseIstDate } from "../../utils/ist-date";
import { DatePickerField } from "../../components/date-picker-field";
import { deleteFarmLoad } from "../../api/farms";

import { AdminScreenContainer } from "../../components/admin/admin-screen-container";
import { AdminHeader } from "../../components/admin/admin-header";

export function AdminInventoryDetailScreen({ route, navigation }: { route: any, navigation: any }) {
 const { itemId, itemName } = route.params;
 const { data, isLoading, refetch } = useAdminInventoryItemLoads(itemId);

 const [searchQuery, setSearchQuery] = useState("");
 const [selectedLoad, setSelectedLoad] = useState<any>(null);
 const [searchDate, setSearchDate] = useState<Date | null>(null);
 const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
 const [filterType, setFilterType] = useState<"all"| "date"| "range">("all");
 const [fromDate, setFromDate] = useState<Date | null>(null);
 const [toDate, setToDate] = useState<Date | null>(null);

 const loads = data?.loads || [];

 const filteredLoads = useMemo(() => loads.filter((load) => {
 const q = searchQuery.toLowerCase();
 const matchesSearch = !q || 
 (load.farm_name?.toLowerCase().includes(q)) ||
 (load.vehicle_number?.toLowerCase().includes(q)) ||
 (load.contact_phone?.toLowerCase().includes(q));
 
 let matchesDate = true;
 if (filterType === "date"&& searchDate) {
 matchesDate = load.load_date === toApiDate(searchDate);
 } else if (filterType === "range"&& fromDate && toDate) {
 const loadDateObj = parseIstDate(load.load_date);
 if (loadDateObj) {
 // Normalize time for safe comparison
 loadDateObj.setHours(12, 0, 0, 0);
 fromDate.setHours(12, 0, 0, 0);
 toDate.setHours(12, 0, 0, 0);
 const endDate = toDate ? new Date(toDate.getTime() + 86400000 - 1) : null;
 matchesDate = loadDateObj.getTime() >= fromDate.getTime() && loadDateObj.getTime() <= (endDate?.getTime() || 0);
 } else {
 matchesDate = false;
 }
 }

 return matchesSearch && matchesDate;
 }), [loads, searchQuery, filterType, searchDate, fromDate, toDate]);

 // Calculate totals
 const totalAvailable = useMemo(() => filteredLoads.reduce((sum, load) => sum + Number(load.available_weight_kg || 0), 0), [filteredLoads]);
 const totalOriginal = useMemo(() => filteredLoads.reduce((sum, load) => sum + Number(load.loaded_weight_kg || 0), 0), [filteredLoads]);

 const handleDelete = useCallback(() => {
 if (!selectedLoad) return;
 Alert.alert(
 "Delete Purchase Order", 
 "Are you sure you want to delete this purchase order? This action cannot be undone and will affect your inventory balance.", 
 [
 { text: "Cancel", style: "cancel"},
 { 
 text: "Delete", 
 style: "destructive", 
 onPress: async () => {
 try {
 await deleteFarmLoad(selectedLoad.id);
 setSelectedLoad(null);
 refetch();
 } catch(e) {
 console.error("Failed to delete farm load:", e);
 }
 }
 }
 ]
 );
 }, [selectedLoad, refetch]);

 return (
 <AdminScreenContainer
 noScroll
 header={
 <AdminHeader 
 title={`${itemName} Inventory`} 
 subtitle="View active purchase orders and available stock"
 onBack={() => navigation.goBack()} 
 rightContent={
 <Pressable
 accessibilityRole="button"
 className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#f7f8fa] active:bg-[#f7f8fa]"
 onPress={() => refetch()}
 >
 {isLoading ? (
 <ActivityIndicator size="small"className="text-[#2E7D32]"/>
 ) : (
 <MaterialIcons name="refresh"size={22} className="text-[#202124]"/>
 )}
 </Pressable>
 }
 />
 }
 >
 <FlatList
 data={filteredLoads}
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
 <View className="flex-col gap-4 mb-6 pt-2">
 {/* KPIs */}
 {!isLoading && loads.length > 0 && (
 <View className="flex-row gap-4 mb-2">
 <View className="flex-1 bg-[#2E7D32] rounded-lg p-4 relative overflow-hidden">
 <View className="absolute -right-4 -top-4 w-16 h-16 bg-white/10 rounded-lg"/>
 <Text className="text-sm font-bold text-[#5f6368] text-[#2E7D32] mb-1 uppercase tracking-wider">Available Stock</Text>
 <View className="flex-row items-end gap-1">
 <Text className="text-2xl font-bold text-white font-bold font-black">{totalAvailable.toLocaleString("en-IN", { maximumFractionDigits: 1 })}</Text>
 <Text className="text-sm font-bold text-[#5f6368] text-[#2E7D32] mb-1">KG</Text>
 </View>
 </View>
 <View className="flex-1 bg-white rounded-lg p-4 border border-[#e5e7eb] relative overflow-hidden">
 <View className="absolute right-3 top-3 w-8 h-8 bg-[#2E7D32]/10 rounded-lg items-center justify-center">
 <MaterialIcons name="inventory"size={16} className="text-[#2E7D32]"/>
 </View>
 <Text className="text-sm font-bold text-[#5f6368] text-[#5f6368] mb-1 uppercase tracking-wider">Original Load</Text>
 <View className="flex-row items-end gap-1">
 <Text className="text-2xl font-bold text-[#202124] font-black">{totalOriginal.toLocaleString("en-IN", { maximumFractionDigits: 1 })}</Text>
 <Text className="text-sm font-bold text-[#5f6368] text-[#5f6368] mb-0.5">KG</Text>
 </View>
 </View>
 </View>
 )}

 {/* Search & Filter */}
 <View className="flex-row items-center gap-3">
 <View className="relative flex-1">
 <View className="absolute left-4 z-10 top-0 bottom-0 justify-center">
 <MaterialIcons name="search"size={20} className="text-[#5f6368]"/>
 </View>
 <TextInput
 placeholderTextColor="#717973"
 className="h-14 pl-12 pr-4 bg-white border border-[#e5e7eb] rounded-lg text-lg text-[#202124] text-[#202124] focus:border-[#2E7D32]"
 placeholder="Search farms..."
 value={searchQuery}
 onChangeText={setSearchQuery}
 />
 {searchQuery.length > 0 && (
 <Pressable 
 className="absolute right-4 top-0 bottom-0 justify-center z-10"
 onPress={() => setSearchQuery("")}
 >
 <MaterialIcons name="close"size={18} className="text-[#5f6368]"/>
 </Pressable>
 )}
 </View>
 <Pressable
 className={`w-14 h-14 rounded-lg flex items-center justify-center border active:scale-[0.95] transition-transform ${
 filterType !== "all"
 ? "bg-[#2E7D32]/10 border-[#2E7D32]/30"
 : "bg-white border-[#e5e7eb]"
 }`}
 onPress={() => setIsFilterModalVisible(true)}
 >
 <MaterialIcons 
 name="filter-list"
 size={22} 
 className={filterType !== "all"? "text-on-primary-container": "text-[#5f6368]"} 
 />
 {filterType !== "all"&& (
 <View className="absolute top-2 right-2 w-2 h-2 rounded-lg bg-[#2E7D32]"/>
 )}
 </Pressable>
 </View>
 
 {/* Active Filter Indicators */}
 {filterType !== "all"&& (
 <View className="flex-row flex-wrap gap-2 mt-1">
 <View className="bg-[#2E7D32]/10/50 px-3 py-1.5 rounded-lg flex-row items-center border border-[#2E7D32]/20">
 <MaterialIcons name="event"size={14} className="text-[#2E7D32] mr-1.5"/>
 <Text className="text-xs font-bold text-[#2E7D32]">
 {filterType === "date"
 ? `Date: ${searchDate ? formatIstDate(toApiDate(searchDate)) : "Not set"}` 
 : `Range: ${fromDate ? formatIstDate(toApiDate(fromDate)) : "?"} - ${toDate ? formatIstDate(toApiDate(toDate)) : "?"}`
 }
 </Text>
 <Pressable 
 className="ml-2 bg-[#2E7D32]/10 rounded-lg p-0.5"
 onPress={() => { setFilterType("all"); setSearchDate(null); setFromDate(null); setToDate(null); }}
 >
 <MaterialIcons name="close"size={12} className="text-[#2E7D32]"/>
 </Pressable>
 </View>
 </View>
 )}

 <View className="flex-row items-center justify-between ml-1 mb-1 mt-2">
 <Text className="text-2xl font-bold text-[#202124]">Active Stock</Text>
 {filteredLoads.length > 0 && (
 <View className="bg-[#f7f8fa] px-3 py-1 rounded-lg">
 <Text className="text-xs font-bold text-[#5f6368]">{filteredLoads.length} Loads</Text>
 </View>
 )}
 </View>
 </View>
 </>
 }
 ListEmptyComponent={
 isLoading ? (
 <View className="py-12 items-center">
 <ActivityIndicator size="large"className="text-[#2E7D32] mb-4"/>
 <Text className="text-[#5f6368] font-medium">Loading inventory data...</Text>
 </View>
 ) : (
 <View className="bg-white rounded-lg p-8 border border-dashed border-[#e5e7eb] items-center justify-center mb-6 mt-2">
 <View className="w-16 h-16 bg-[#f7f8fa] rounded-lg items-center justify-center mb-4">
 <MaterialIcons name="inventory-2"size={32} className="text-[#5f6368]"/>
 </View>
 <Text className="text-2xl font-bold text-[#202124] mb-1 text-center">
 {searchQuery || filterType !== "all"? "No matching stock": "No Active Stock"}
 </Text>
 <Text className="text-base text-[#5f6368] text-[#5f6368] text-center max-w-[250px]">
 {searchQuery || filterType !== "all"
 ? "Try adjusting your search or date filters."
 : "There are no open or in-transit farm loads for this item."}
 </Text>
 
 {!searchQuery && filterType === "all"&& (
 <Pressable
 className="mt-6 bg-[#2E7D32] px-6 py-3 rounded-lg flex-row items-center"
 onPress={() => navigation.navigate("FarmPurchase")}
 >
 <MaterialIcons name="add"size={20} color="white"className="mr-2"/>
 <Text className="text-white font-bold">Record Farm Load</Text>
 </Pressable>
 )}
 </View>
 )
 }
 ItemSeparatorComponent={() => <View className="h-4"/>}
 renderItem={({ item }) => (
 <LoadListItem item={item} onPress={() => setSelectedLoad(item)} />
 )}
 />

 <Modal visible={isFilterModalVisible} transparent animationType="fade"onRequestClose={() => setIsFilterModalVisible(false)}>
 <View className="flex-1 justify-end bg-[#2E7D32]/60">
 <Pressable className="flex-1"onPress={() => setIsFilterModalVisible(false)} />
 <View className="bg-white rounded-t-3xl p-6 pb-safe border-t border-[#e5e7eb]">
 <View className="flex-row justify-between items-center mb-6">
 <Text className="text-title-lg text-[#202124]">Filter by Date</Text>
 <Pressable onPress={() => setIsFilterModalVisible(false)} className="w-10 h-10 bg-[#f7f8fa] rounded-lg items-center justify-center active:bg-[#f7f8fa]">
 <MaterialIcons name="close"size={20} className="text-[#202124]"/>
 </Pressable>
 </View>

 <View className="flex-row justify-between bg-[#f7f8fa] rounded-lg p-1 mb-6 border border-[#e5e7eb]">
 {(["all", "date", "range"] as const).map((type) => (
 <Pressable 
 key={type}
 className={`flex-1 py-2.5 rounded-voltagent-sm items-center transition-colors ${filterType === type ? "bg-[#2E7D32] ": ""}`}
 onPress={() => { 
 setFilterType(type); 
 if (type === "all") {
 setSearchDate(null); setFromDate(null); setToDate(null); 
 }
 }}
 >
 <Text className={`text-sm font-bold text-[#5f6368] ${filterType === type ? "text-white font-bold": "text-[#5f6368]"}`}>
 {type.charAt(0).toUpperCase() + type.slice(1)}
 </Text>
 </Pressable>
 ))}
 </View>

 {filterType === "date"&& (
 <View className="mb-6 bg-white p-4 rounded-lg border border-[#e5e7eb]">
 <Text className="text-sm font-bold text-[#5f6368] text-[#5f6368] mb-3 uppercase tracking-wider ml-1">Select Date</Text>
 <DatePickerField 
 label=""
 value={searchDate} 
 onChange={setSearchDate} 
 inputStyle="h-14 bg-white border border-[#e5e7eb] rounded-lg px-4"
 />
 </View>
 )}

 {filterType === "range"&& (
 <View className="bg-white p-4 rounded-lg border border-[#e5e7eb] mb-6">
 <Text className="text-sm font-bold text-[#5f6368] text-[#5f6368] mb-3 uppercase tracking-wider ml-1">Date Range</Text>
 <View className="flex-row gap-4 mb-4">
 <View className="flex-1">
 <Text className="text-xs font-bold text-[#202124] mb-2 ml-1">From</Text>
 <DatePickerField 
 label=""
 value={fromDate} 
 onChange={setFromDate} 
 inputStyle="h-12 bg-white border border-[#e5e7eb] rounded-lg px-4 text-sm"
 />
 </View>
 <View className="flex-1">
 <Text className="text-xs font-bold text-[#202124] mb-2 ml-1">To</Text>
 <DatePickerField 
 label=""
 value={toDate} 
 onChange={setToDate} 
 inputStyle="h-12 bg-white border border-[#e5e7eb] rounded-lg px-4 text-sm"
 />
 </View>
 </View>
 </View>
 )}

 <Pressable 
 className="bg-[#2E7D32] h-14 rounded-lg flex-row items-center justify-center active:scale-[0.98] transition-transform mb-2"
 onPress={() => setIsFilterModalVisible(false)}
 >
 <Text className="text-white font-bold text-base font-bold mr-2">Apply Filters</Text>
 <MaterialIcons name="check"size={20} color="white"/>
 </Pressable>
 </View>
 </View>
 </Modal>

 {/* Bill Preview Modal */}
 <Modal visible={!!selectedLoad} transparent animationType="fade"onRequestClose={() => setSelectedLoad(null)}>
 <View className="flex-1 bg-[#2E7D32]/60 justify-end">
 <View className="bg-white rounded-t-3xl h-[90%] border-t border-[#e5e7eb] overflow-hidden">
 <View className="flex-row justify-between items-center p-6 border-b border-[#e5e7eb] bg-white">
 <View>
 <Text className="text-2xl font-bold text-[#202124] mb-1">Purchase Order Details</Text>
 <Text className="text-[#5f6368] font-medium">{selectedLoad?.farm_name}</Text>
 </View>
 <Pressable
 className="w-10 h-10 bg-[#f7f8fa] rounded-lg items-center justify-center active:bg-[#f7f8fa]"
 onPress={() => setSelectedLoad(null)}
 >
 <MaterialIcons name="close"size={20} className="text-[#202124]"/>
 </Pressable>
 </View>

 {selectedLoad && (
 <ScrollView className="flex-1 p-6"showsVerticalScrollIndicator={false}>
 <View className="flex-col gap-5 pb-8">
 
 {/* Status Banner */}
 <View className="bg-white border border-[#e5e7eb] rounded-lg p-4 flex-row justify-between items-center">
 <View className="flex-row items-center gap-2">
 <MaterialIcons name="info-outline"size={20} className="text-[#5f6368]"/>
 <Text className="text-sm font-bold text-[#5f6368] text-[#5f6368] uppercase tracking-wider">Status</Text>
 </View>
 <View className={`px-3 py-1 rounded-lg border ${
 selectedLoad.status === 'OPEN' ? 'bg-[#2E7D32]/10 border-[#2E7D32]/20' : 'bg-[#f7f8fa] border-[#e5e7eb]'
 }`}>
 <Text className={`text-xs font-bold uppercase tracking-widest ${
 selectedLoad.status === 'OPEN' ? 'text-[#2E7D32]' : 'text-[#5f6368]'
 }`}>
 {selectedLoad.status.replace("_", "")}
 </Text>
 </View>
 </View>

 {/* General Info */}
 <View className="bg-white border border-[#e5e7eb] rounded-lg p-5 flex-col gap-4">
 <Text className="text-base font-bold text-[#5f6368] text-[#202124] mb-1">General Information</Text>
 
 <View className="flex-row justify-between items-center border-b border-[#e5e7eb] pb-3">
 <Text className="text-sm font-bold text-[#5f6368] font-medium text-[#5f6368]">Farm Name</Text>
 <Text className="text-sm font-bold text-[#5f6368] text-[#202124]">{selectedLoad.farm_name || "Unknown Farm"}</Text>
 </View>
 
 <View className="flex-row justify-between items-center border-b border-[#e5e7eb] pb-3">
 <Text className="text-sm font-bold text-[#5f6368] font-medium text-[#5f6368]">Load Date</Text>
 <Text className="text-sm font-bold text-[#5f6368] text-[#202124]">{formatIstDate(selectedLoad.load_date)}</Text>
 </View>
 
 <View className="flex-row justify-between items-center border-b border-[#e5e7eb] pb-3">
 <Text className="text-sm font-bold text-[#5f6368] font-medium text-[#5f6368]">Vehicle</Text>
 <Text className="text-sm font-bold text-[#5f6368] text-[#202124]">{selectedLoad.vehicle_number || "—"}</Text>
 </View>
 
 <View className="flex-row justify-between items-center">
 <Text className="text-sm font-bold text-[#5f6368] font-medium text-[#5f6368]">Contact</Text>
 <Text className="text-sm font-bold text-[#5f6368] text-[#202124]">{selectedLoad.contact_phone || "—"}</Text>
 </View>
 </View>

 {/* Weight & Billing Info */}
 <View className="bg-[#2E7D32]/5 border border-[#2E7D32]/20 rounded-lg p-5 flex-col gap-4">
 <View className="flex-row items-center gap-2 mb-1">
 <MaterialIcons name="receipt-long"size={20} className="text-[#2E7D32]"/>
 <Text className="text-base font-bold text-[#5f6368] text-[#202124]">Weight & Billing</Text>
 </View>
 
 <View className="flex-row justify-between items-center border-b border-[#2E7D32]/10 pb-3">
 <Text className="text-sm font-bold text-[#5f6368] font-medium text-[#5f6368]">Original Load</Text>
 <Text className="text-sm font-bold text-[#5f6368] text-[#202124]">
 {Number(selectedLoad.loaded_weight_kg).toLocaleString("en-IN", { maximumFractionDigits: 2 })} KG
 </Text>
 </View>
 
 <View className="flex-row justify-between items-center border-b border-[#2E7D32]/10 pb-3">
 <Text className="text-sm font-bold text-[#5f6368] font-medium text-[#5f6368]">Rate / KG</Text>
 <Text className="text-sm font-bold text-[#5f6368] text-[#202124]">
 ₹{selectedLoad.rate_per_kg ? Number(selectedLoad.rate_per_kg).toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "—"}
 </Text>
 </View>
 
 <View className="flex-row justify-between items-center pt-1">
 <Text className="text-base font-bold text-[#5f6368] text-[#202124]">Net Payable</Text>
 <Text className="text-2xl font-bold font-black text-[#2E7D32]">
 ₹{selectedLoad.total_amount ? Number(selectedLoad.total_amount).toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "—"}
 </Text>
 </View>
 </View>

 {/* Payment Info */}
 <View className="bg-white border border-[#e5e7eb] rounded-lg p-5 flex-col gap-4">
 <Text className="text-base font-bold text-[#5f6368] text-[#202124] mb-1">Payment Status</Text>
 
 <View className="flex-row justify-between items-center border-b border-[#e5e7eb] pb-3">
 <Text className="text-sm font-bold text-[#5f6368] font-medium text-[#5f6368]">Method</Text>
 {(() => {
 const method = (selectedLoad.payment_method || "").toLowerCase();
 if (!method) return <Text className="text-sm font-bold text-[#5f6368] text-[#202124]">—</Text>;
 
 const isUpi = method.includes("upi");
 const isBank = method.includes("bank");
 const isCredit = method.includes("credit");
 const isCash = method.includes("cash");
 const bg = isCash ? "bg-emerald-100": isUpi ? "bg-blue-100": isBank ? "bg-sky-100": isCredit ? "bg-purple-100": "bg-[#f7f8fa]";
 const text = isCash ? "text-emerald-800": isUpi ? "text-blue-800": isBank ? "text-sky-800": isCredit ? "text-purple-800": "text-[#202124]";
 const label = isCash ? "Cash": isUpi ? "UPI": isBank ? "Bank Transfer": isCredit ? "Credit": selectedLoad.payment_method;
 
 return (
 <View className={`px-3 py-1 rounded-lg ${bg}`}>
 <Text className={`text-xs font-bold tracking-wide ${text}`}>{label}</Text>
 </View>
 );
 })()}
 </View>
 
 <View className="flex-row justify-between items-center border-b border-[#e5e7eb] pb-3">
 <Text className="text-sm font-bold text-[#5f6368] font-medium text-[#5f6368]">Paid Amount</Text>
 <Text className="text-sm font-bold text-[#5f6368] text-[#202124]">
 ₹{selectedLoad.paid_amount ? Number(selectedLoad.paid_amount).toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "0"}
 </Text>
 </View>
 
 <View className="flex-row justify-between items-center pt-1">
 <Text className="text-base font-bold text-[#5f6368] text-[#202124]">Balance Due</Text>
 <Text className="text-2xl font-bold font-black text-error">
 ₹{(Number(selectedLoad.total_amount || 0) - Number(selectedLoad.paid_amount || 0)).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
 </Text>
 </View>
 </View>
 </View>
 </ScrollView>
 )}

 <View className="p-6 pt-4 bg-white border-t border-[#e5e7eb] flex-row gap-3">
 <Pressable 
 className="flex-1 bg-[#f7f8fa] border border-error/20 rounded-lg h-14 flex-row items-center justify-center gap-2 active:bg-error/10 transition-colors"
 onPress={handleDelete}
 >
 <MaterialIcons name="delete-outline"size={20} className="text-error"/>
 <Text className="text-error text-base font-bold">Delete</Text>
 </Pressable>
 <Pressable 
 className="flex-[2] bg-[#2E7D32] rounded-lg h-14 flex-row items-center justify-center gap-2 active:bg-[#2E7D32]/90 transition-transform active:scale-[0.98]"
 onPress={() => {
 const loadId = selectedLoad.id;
 setSelectedLoad(null);
 navigation.navigate("FarmPurchase", { loadId });
 }}
 >
 <MaterialIcons name="edit"size={20} color="white"/>
 <Text className="text-white font-bold text-base font-bold">Edit Order</Text>
 </Pressable>
 </View>
 </View>
 </View>
 </Modal>

 </AdminScreenContainer>
 );
}

const LoadListItem = React.memo(({ item, onPress }: { item: any; onPress: () => void }) => {
 return (
 <Pressable 
 className="bg-white border border-[#e5e7eb] rounded-lg overflow-hidden active:scale-[0.98] transition-transform"
 onPress={onPress}
 >
 <View className="bg-[#2E7D32]/5 px-5 py-4 border-b border-[#2E7D32]/10 flex-row justify-between items-center relative overflow-hidden">
 <View className="absolute right-0 top-0 w-24 h-24 bg-[#2E7D32]/5 rounded-lg -translate-y-8 translate-x-8"/>
 
 <View className="flex-1 pr-4">
 <Text className="text-title-md text-[#202124] truncate mb-1">
 {item.farm_name || "Unknown Farm"}
 </Text>
 <View className="flex-row items-center text-[#5f6368]">
 <MaterialIcons name="calendar-today"size={12} className="text-[#5f6368] mr-1.5"/>
 <Text className="text-xs font-bold uppercase tracking-wider">{formatIstDate(item.load_date)}</Text>
 </View>
 </View>
 <View className={`px-3 py-1.5 rounded-lg border ${
 item.status === 'OPEN' ? 'bg-[#2E7D32]/10 border-[#2E7D32]/20' : 'bg-[#f7f8fa] border-[#e5e7eb]'
 }`}>
 <Text className={`text-xs font-bold uppercase tracking-widest ${
 item.status === 'OPEN' ? 'text-[#2E7D32]' : 'text-[#5f6368]'
 }`}>
 {item.status.replace("_", "")}
 </Text>
 </View>
 </View>

 <View className="p-5">
 <View className="flex-row items-center justify-between mb-5">
 <View className="flex-1 flex-row items-start gap-3">
 <View className="w-8 h-8 rounded-lg bg-[#f7f8fa] items-center justify-center mt-0.5">
 <MaterialIcons name="local-shipping"size={16} className="text-[#202124]"/>
 </View>
 <View>
 <Text className="text-xs font-bold text-[#5f6368] uppercase tracking-wider mb-1">Vehicle</Text>
 <Text className="text-sm font-bold text-[#5f6368] text-[#202124]">{item.vehicle_number || "—"}</Text>
 </View>
 </View>
 <View className="flex-1 items-end pl-2 border-l border-[#e5e7eb]">
 <Text className="text-xs font-bold text-[#5f6368] uppercase tracking-wider mb-1">Total Bill</Text>
 <Text className="text-base font-bold text-[#5f6368] text-[#2E7D32] font-black">
 {item.total_amount ? `₹${Number(item.total_amount).toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "—"}
 </Text>
 </View>
 </View>

 <View className="bg-[#f7f8fa]/30 rounded-lg p-4 flex-row justify-between items-center border border-[#e5e7eb]">
 <View>
 <Text className="text-xs font-bold text-[#5f6368] uppercase tracking-wider mb-1">Original Load</Text>
 <View className="flex-row items-end gap-1">
 <Text className="text-[#202124] text-title-md">
 {Number(item.loaded_weight_kg).toLocaleString("en-IN", { maximumFractionDigits: 1 })}
 </Text>
 <Text className="text-xs font-bold text-[#5f6368] mb-0.5">KG</Text>
 </View>
 </View>
 
 <View className="items-center px-4">
 <MaterialIcons name="arrow-right-alt"size={24} className="text-[#5f6368]/50"/>
 </View>
 
 <View className="items-end">
 <Text className="text-xs font-bold text-[#5f6368] uppercase tracking-wider mb-1">Available</Text>
 <View className="flex-row items-end gap-1">
 <Text className="text-[#2E7D32] font-black text-headline-sm">
 {Number(item.available_weight_kg).toLocaleString("en-IN", { maximumFractionDigits: 1 })}
 </Text>
 <Text className="text-sm font-bold text-[#5f6368] text-[#2E7D32] mb-1">KG</Text>
 </View>
 </View>
 </View>
 </View>
 </Pressable>
 );
});
