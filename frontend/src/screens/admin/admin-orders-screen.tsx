import React, { useState, useMemo, useEffect } from "react";
import {
 FlatList,
 Pressable,
 Text,
 TextInput,
 View,
 ScrollView,
 ActivityIndicator,
 Modal,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useAdminTodayOrders, useConfirmOrder } from "../../hooks/use-queries";
import type { OrderStatus, DailyOrderOut } from "../../types/api";
import { ConfirmOrderModal } from "./components/confirm-order-modal";
import { SingleOrderDispatchModal } from "./components/single-order-dispatch-modal";
import { MetricCard } from "./components/metric-card";
import { cancelOrder, listOrdersByDate } from "../../api/orders";
import { DatePickerField } from "../../components/date-picker-field";
import { todayIstDate, toApiDate } from "../../utils/ist-date";
import { useQuery } from "@tanstack/react-query";

import { AdminScreenContainer } from "../../components/admin/admin-screen-container";
import { AdminHeader } from "../../components/admin/admin-header";

import { startOfWeek, startOfMonth, startOfYear, format } from "date-fns";

export type DateRangeOption = "All" | "Today" | "This Week" | "This Month" | "This Year" | "Custom";

export function AdminOrdersScreen({ navigation }: { navigation: any }) {
 const [dateRangeOption, setDateRangeOption] = useState<DateRangeOption>("All");
 const [startDate, setStartDate] = useState<Date | null>(null);
 const [endDate, setEndDate] = useState<Date | null>(null);

 // Custom modal state
 const [isDateModalOpen, setIsDateModalOpen] = useState(false);
 const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
 const [customEndDate, setCustomEndDate] = useState<Date | null>(null);

 useEffect(() => {
 const now = new Date();
 if (dateRangeOption === "Today") {
 setStartDate(now);
 setEndDate(now);
 } else if (dateRangeOption === "This Week") {
 setStartDate(startOfWeek(now, { weekStartsOn: 1 })); // Monday start
 setEndDate(now);
 } else if (dateRangeOption === "This Month") {
 setStartDate(startOfMonth(now));
 setEndDate(now);
 } else if (dateRangeOption === "This Year") {
 setStartDate(startOfYear(now));
 setEndDate(now);
 } else if (dateRangeOption === "Custom") {
 setStartDate(customStartDate);
 setEndDate(customEndDate);
 } else {
 setStartDate(null);
 setEndDate(null);
 }
 }, [dateRangeOption, customStartDate, customEndDate]);

 const { data, isLoading, isRefetching, refetch } = useQuery({
 queryKey: ["admin", "orders", startDate ? toApiDate(startDate) : "all", endDate ? toApiDate(endDate) : "all"],
 queryFn: () => listOrdersByDate({ 
 start_date: (startDate ? toApiDate(startDate) : undefined) || undefined,
 end_date: (endDate ? toApiDate(endDate) : undefined) || undefined
 }),
 });
 
 const orders = data?.items || [];
 
 const activeOrders = useMemo(() => orders.filter((o) => o.status !== "FULFILLED" && o.status !== "CANCELLED"), [orders]);
 const activeTotalBoxes = useMemo(() => activeOrders.reduce((sum, o) => sum + (o.items || []).reduce((s, it) => s + (it.total_boxes || 0), 0), 0), [activeOrders]);
 
 const itemBoxesBreakdown = useMemo(() => {
 const breakdown: Record<string, number> = {};
 activeOrders.forEach((o) => {
 (o.items || []).forEach((it) => {
 const name = it.item_name || "Unknown Item";
 breakdown[name] = (breakdown[name] || 0) + (it.total_boxes || 0);
 });
 });
 return Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
 }, [activeOrders]);

 const [isItemBoxesModalOpen, setIsItemBoxesModalOpen] = useState(false);
 const [isTotalOrdersModalOpen, setIsTotalOrdersModalOpen] = useState(false);
 const [searchQuery, setSearchQuery] = useState("");
 const [filter, setFilter] = useState<"All"| OrderStatus>("All");
 const [confirmOrderModal, setConfirmOrderModal] = useState<DailyOrderOut | null>(null);
 const [dispatchOrderModal, setDispatchOrderModal] = useState<DailyOrderOut | null>(null);

 const filteredOrders = useMemo(() => orders.filter((o) => {
 if (searchQuery && !(o.shop_name?.toLowerCase().includes(searchQuery.toLowerCase()) || o.retailer_name?.toLowerCase().includes(searchQuery.toLowerCase()))) return false;
 if (filter !== "All"&& o.status !== filter) return false;
 return true;
 }), [orders, searchQuery, filter]);

 const pendingCount = useMemo(() => orders.filter((o) => o.status === "PLACED").length, [orders]);
 const confirmedCount = useMemo(() => orders.filter((o) => o.status === "ACKNOWLEDGED").length, [orders]);

 return (
 <AdminScreenContainer
 noScroll
 header={
 <AdminHeader 
 title="Orders"
 subtitle="Manage daily sales orders"
 onBack={() => navigation.goBack()} 
 rightContent={
 <View className="flex-row items-center gap-2">
 <Pressable
 accessibilityRole="button"
 className="w-10 h-10 flex items-center justify-center rounded-md bg-[#2E7D32]/10 active:bg-[#2E7D32]/20"
 onPress={() => navigation.navigate("DeliveryRuns")}
 >
 <MaterialIcons name="local-shipping" size={22} className="text-[#2E7D32]"/>
 </Pressable>
 <Pressable
 accessibilityRole="button"
 className="w-10 h-10 flex items-center justify-center rounded-md bg-white border border-[#e5e7eb] active:bg-[#f7f8fa]"
 onPress={() => refetch()}
 >
 {isRefetching ? (
 <ActivityIndicator size="small" className="text-[#2E7D32]"/>
 ) : (
 <MaterialIcons name="refresh" size={22} className="text-[#111111]"/>
 )}
 </Pressable>
 </View>
 }
 />
 }
 >
 <FlatList
 data={filteredOrders}
 keyExtractor={(item) => String(item.id)}
 refreshing={isRefetching}
 onRefresh={refetch}
 className="flex-1 px-4"
 contentContainerStyle={{ paddingBottom: 100 }}
 showsVerticalScrollIndicator={false}
 initialNumToRender={10}
 maxToRenderPerBatch={10}
 windowSize={5}
 removeClippedSubviews={true}
 ListHeaderComponent={
 <>
 <View className="pt-2 mb-4">
 {/* Search & Date Filter Row */}
 <View className="flex-row gap-3 z-20">
 <View className="flex-[7] relative justify-center">
 <View className="absolute left-3 z-10">
 <MaterialIcons name="search" size={20} className="text-[#5f6368]"/>
 </View>
 <TextInput 
 className="w-full bg-[#f7f8fa] h-12 rounded-lg border border-[#e5e7eb] pl-10 pr-3 font-sans text-base text-[#111111] focus:border-[#2E7D32]"
 placeholder="Search orders..."
 placeholderTextColor="#717973"
 value={searchQuery}
 onChangeText={setSearchQuery}
 />
 </View>
 <View className="flex-[3]">
 <Pressable 
 className="h-12 bg-white rounded-lg border border-[#e5e7eb] flex-row items-center justify-between px-3 active:bg-[#f7f8fa]"
 onPress={() => setIsDateModalOpen(true)}
 >
 <View className="flex-1 pr-1">
 <Text className="text-[10px] text-[#7a7f85] font-sans uppercase font-bold tracking-wider">Date</Text>
 <Text className="text-xs font-sans text-[#202124] font-semibold" numberOfLines={1}>{dateRangeOption}</Text>
 </View>
 <MaterialIcons name="arrow-drop-down" size={20} className="text-[#5f6368]" />
 </Pressable>
 </View>
 </View>
 </View>

 {/* KPI Summary Cards */}
 <View className="flex-row flex-wrap justify-between gap-y-3 mb-4">
 <MetricCard icon="shopping-cart" label="Total Orders" value={activeOrders.length} valueColor="text-[#2E7D32]" onPress={() => setIsTotalOrdersModalOpen(true)} />
 <MetricCard icon="inventory-2" label="Total Boxes" value={activeTotalBoxes} valueColor="text-[#2E7D32]" onPress={() => setIsItemBoxesModalOpen(true)} />
 <MetricCard icon="pending-actions" label="Pending Orders" value={pendingCount} onPress={() => setFilter("PLACED")} />
 <MetricCard icon="check-circle" label="Confirmed Orders" value={confirmedCount} onPress={() => setFilter("ACKNOWLEDGED")} />
 </View>

 {/* Filter Tabs */}
 <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-6 overflow-visible">
 {(["All", "PLACED", "ACKNOWLEDGED", "DISPATCHED", "FULFILLED", "CANCELLED"] as const).map((f) => (
 <Pressable
 key={f}
 accessibilityRole="button"
 onPress={() => setFilter(f)}
 className={`h-10 px-4 rounded-md items-center justify-center mr-2 transition-colors ${
 filter === f 
 ? "bg-[#2E7D32]"
 : "bg-transparent"
 }`}
 >
 <Text
 className={`font-sans text-sm font-bold ${
 filter === f ? "text-white": "text-[#5f6368]"
 }`}
 >
 {f === "ACKNOWLEDGED"? "Confirmed": f === "FULFILLED"? "Delivered": f === "All"? "All": f.charAt(0) + f.slice(1).toLowerCase()}
 </Text>
 </Pressable>
 ))}
 </ScrollView>
 </>
 }
 ListEmptyComponent={
 !isLoading && !isRefetching ? (
 <View className="bg-[#f7f8fa] py-10 px-6 rounded-lg items-center justify-center border border-[#e5e7eb]">
 <MaterialIcons name="inbox" size={32} className="text-[#a0a5ab] mb-3" />
 <Text className="font-sans text-[#111111] font-bold text-lg mb-1">
 No orders found
 </Text>
 <Text className="font-sans text-[#5f6368] text-sm text-center">
 There are no orders matching your current filters.
 </Text>
 </View>
 ) : null
 }
 ItemSeparatorComponent={() => <View className="h-4"/>}
 renderItem={({ item: order }) => (
 <OrderListItem 
 order={order}
 onConfirm={() => setConfirmOrderModal(order)}
 onDispatch={() => setDispatchOrderModal(order)}
 onPress={() => navigation.navigate("OrderDetail", { order })}
 />
 )}
 />
 
 {confirmOrderModal && (
 <ConfirmOrderModal
 order={confirmOrderModal}
 onClose={() => setConfirmOrderModal(null)}
 onConfirmed={() => {
 setConfirmOrderModal(null);
 refetch();
 }}
 />
 )}
 
 {dispatchOrderModal && (
 <SingleOrderDispatchModal
 order={dispatchOrderModal}
 onClose={() => setDispatchOrderModal(null)}
 onAssigned={() => {
 setDispatchOrderModal(null);
 refetch();
 }}
 />
 )}
 
 <Modal visible={isDateModalOpen} transparent animationType="slide" onRequestClose={() => setIsDateModalOpen(false)}>
 <Pressable className="flex-1 bg-black/50 justify-end" onPress={() => setIsDateModalOpen(false)}>
 <Pressable className="bg-white rounded-t-2xl p-6 min-h-[40%]" onPress={(e) => e.stopPropagation()}>
 <Text className="text-xl font-bold font-sans text-[#111111] mb-4">Filter by Date</Text>
 
 {(["All", "Today", "This Week", "This Month", "This Year", "Custom"] as DateRangeOption[]).map((opt) => (
 <Pressable 
 key={opt}
 className="py-3 border-b border-[#e5e7eb] last:border-b-0 flex-row items-center justify-between"
 onPress={() => {
 if (opt !== "Custom") {
 setDateRangeOption(opt);
 setIsDateModalOpen(false);
 } else {
 setDateRangeOption("Custom");
 }
 }}
 >
 <Text className={`font-sans text-base ${dateRangeOption === opt ? 'text-[#2E7D32] font-bold' : 'text-[#202124]'}`}>{opt}</Text>
 {dateRangeOption === opt && <MaterialIcons name="check" size={20} className="text-[#2E7D32]" />}
 </Pressable>
 ))}
 
 {dateRangeOption === "Custom" && (
 <View className="mt-4 gap-4">
 <DatePickerField 
 label="Start Date"
 value={customStartDate}
 onChange={setCustomStartDate}
 maximumDate={customEndDate || todayIstDate()}
 />
 <DatePickerField 
 label="End Date"
 value={customEndDate}
 onChange={setCustomEndDate}
 minimumDate={customStartDate || undefined}
 maximumDate={todayIstDate()}
 />
 <Pressable 
 className="bg-[#2E7D32] h-12 rounded-lg items-center justify-center mt-2"
 onPress={() => setIsDateModalOpen(false)}
 >
 <Text className="text-white font-bold font-sans">Apply Custom Range</Text>
 </Pressable>
 </View>
 )}
 </Pressable>
 </Pressable>
 </Modal>

 <Modal visible={isItemBoxesModalOpen} transparent animationType="fade" onRequestClose={() => setIsItemBoxesModalOpen(false)}>
 <Pressable className="flex-1 bg-black/50 justify-center items-center p-4" onPress={() => setIsItemBoxesModalOpen(false)}>
 <Pressable className="bg-white rounded-2xl p-6 w-full max-w-sm" onPress={(e) => e.stopPropagation()}>
 <View className="flex-row items-center justify-between mb-4">
 <Text className="text-xl font-bold font-sans text-[#111111]">Boxes Breakdown</Text>
 <Pressable onPress={() => setIsItemBoxesModalOpen(false)} className="w-8 h-8 items-center justify-center rounded-full bg-[#f7f8fa]">
 <MaterialIcons name="close" size={20} className="text-[#5f6368]" />
 </Pressable>
 </View>
 
 {itemBoxesBreakdown.length > 0 ? (
 <View className="gap-2">
 {itemBoxesBreakdown.map(([itemName, boxes]) => (
 <View key={itemName} className="flex-row items-center justify-between py-3 border-b border-[#e5e7eb] last:border-b-0">
 <Text className="font-sans text-base text-[#202124] font-medium flex-1 pr-4">{itemName}</Text>
 <Text className="font-mono text-lg font-bold text-[#2E7D32]">{boxes}</Text>
 </View>
 ))}
 </View>
 ) : (
 <View className="py-6 items-center">
 <Text className="font-sans text-[#7a7f85]">No active boxes today.</Text>
 </View>
 )}
 </Pressable>
 </Pressable>
 </Modal>
 
 <Modal visible={isTotalOrdersModalOpen} transparent animationType="slide" onRequestClose={() => setIsTotalOrdersModalOpen(false)}>
 <Pressable className="flex-1 bg-black/50 justify-end" onPress={() => setIsTotalOrdersModalOpen(false)}>
 <Pressable className="bg-[#f7f8fa] rounded-t-2xl min-h-[80%] max-h-[90%]" onPress={(e) => e.stopPropagation()}>
 <View className="flex-row items-center justify-between p-4 bg-white rounded-t-2xl border-b border-[#e5e7eb]">
 <Text className="text-xl font-bold font-sans text-[#111111]">Active Orders Summary</Text>
 <Pressable onPress={() => setIsTotalOrdersModalOpen(false)} className="w-8 h-8 items-center justify-center rounded-full bg-[#f7f8fa]">
 <MaterialIcons name="close" size={20} className="text-[#5f6368]" />
 </Pressable>
 </View>
 <FlatList 
 data={activeOrders}
 keyExtractor={o => String(o.id)}
 contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
 renderItem={({ item: o }) => {
 const boxes = (o.items || []).reduce((s, it) => s + (it.total_boxes || 0), 0);
 const statusText = o.status === 'ACKNOWLEDGED' ? 'Confirmed' : o.status === 'FULFILLED' ? 'Delivered' : o.status.charAt(0) + o.status.slice(1).toLowerCase();
 const badgeBg = o.status === 'PLACED' ? 'bg-[#EF4444]/10' : o.status === 'ACKNOWLEDGED' ? 'bg-[#3B82F6]/10' : o.status === 'DISPATCHED' ? 'bg-[#F59E0B]/10' : 'bg-[#e5e7eb]';
 const badgeText = o.status === 'PLACED' ? 'text-[#EF4444]' : o.status === 'ACKNOWLEDGED' ? 'text-[#3B82F6]' : o.status === 'DISPATCHED' ? 'text-[#F59E0B]' : 'text-[#5f6368]';
 return (
 <View className="bg-white rounded-xl p-4 border border-[#e5e7eb]">
 <View className="flex-row justify-between items-start mb-2">
 <View className="flex-1 pr-3">
 <Text className="font-sans text-[16px] text-[#202124] font-bold" numberOfLines={1}>{o.retailer_name || o.shop_name || "Unknown Retailer"}</Text>
 {o.shop_name && o.shop_name !== o.retailer_name && (
 <Text className="font-sans text-[13px] text-[#5f6368] mt-0.5" numberOfLines={1}>{o.shop_name}</Text>
 )}
 </View>
 <View className={`${badgeBg} rounded-full px-3 py-1 min-h-[26px] justify-center`}>
 <Text className={`font-sans text-[12px] font-bold ${badgeText}`}>{statusText}</Text>
 </View>
 </View>
 <View className="flex-row justify-between items-center pt-3 border-t border-[#f7f8fa] mt-1">
 <Text className="font-sans text-sm text-[#7a7f85]">Date: <Text className="font-bold text-[#202124]">{o.order_date}</Text></Text>
 <Text className="font-sans text-sm text-[#7a7f85]">Boxes: <Text className="font-bold text-[#202124]">{boxes}</Text></Text>
 </View>
 </View>
 );
 }}
 ListEmptyComponent={
 <View className="items-center py-10">
 <Text className="font-sans text-[#7a7f85]">No active orders.</Text>
 </View>
 }
 />
 </Pressable>
 </Pressable>
 </Modal>
 </AdminScreenContainer>
 );
}

const OrderListItem = React.memo(({
 order,
 onConfirm,
 onDispatch,
 onPress,
}: {
 order: DailyOrderOut;
 onConfirm: () => void;
 onDispatch: () => void;
 onPress: () => void;
}) => {
 const statusColor = order.status === 'PLACED' ? 'bg-[#EF4444]' :
 order.status === 'ACKNOWLEDGED' ? 'bg-[#3B82F6]' :
 order.status === 'DISPATCHED' ? 'bg-[#F59E0B]' :
 order.status === 'FULFILLED' ? 'bg-[#2E7D32]' : 'bg-[#e5e7eb]';

 const badgeBg = order.status === 'PLACED' ? 'bg-[#EF4444]/10' :
 order.status === 'ACKNOWLEDGED' ? 'bg-[#3B82F6]/10' :
 order.status === 'DISPATCHED' ? 'bg-[#F59E0B]/10' :
 order.status === 'FULFILLED' ? 'bg-[#2E7D32]/10' : 'bg-[#f7f8fa]';
 
 const badgeText = order.status === 'PLACED' ? 'text-[#EF4444]' :
 order.status === 'ACKNOWLEDGED' ? 'text-[#3B82F6]' :
 order.status === 'DISPATCHED' ? 'text-[#F59E0B]' :
 order.status === 'FULFILLED' ? 'text-[#2E7D32]' : 'text-[#5f6368]';

 return (
 <Pressable
 className="bg-white border border-[#e5e7eb] rounded-lg p-5 active:bg-[#f7f8fa] overflow-hidden relative"
 onPress={onPress}
 >
 <View className={`absolute top-0 left-0 bottom-0 w-[3px] ${statusColor}`} />
 <View className="flex-row justify-between items-start mb-4">
 <View className="flex-1 pr-4">
 <Text className="font-sans text-[16px] text-[#202124] font-semibold" numberOfLines={1}>{order.retailer_name || order.shop_name || "Unknown Retailer"}</Text>
 {order.shop_name && order.shop_name !== order.retailer_name && (
 <Text className="font-sans text-[13px] text-[#5f6368] mt-0.5" numberOfLines={1}>{order.shop_name}</Text>
 )}
 <Text className="font-sans text-[13px] text-[#7a7f85] mt-1">Order {order.order_number || `#${order.id.split("-")[0].toUpperCase()}`}</Text>
 </View>
 <View className={`${badgeBg} rounded-full px-3 py-1 flex-row items-center gap-1 min-h-[26px]`}>
 {order.status === 'FULFILLED' && <MaterialIcons name="check" size={14} className={badgeText} />}
 <Text className={`font-sans text-[12px] font-bold ${badgeText}`}>
 {order.status === 'ACKNOWLEDGED' ? 'Confirmed' : order.status === 'FULFILLED' ? 'Delivered' : order.status.charAt(0) + order.status.slice(1).toLowerCase()}
 </Text>
 </View>
 </View>

 <View className="bg-[#f7f8fa] rounded-lg p-4 mb-4 border border-[#e5e7eb]">
 {order.items?.map((it: any, idx: number) => (
 <View key={it.item_id ?? idx} className="flex-row items-center justify-between py-1.5 border-b border-[#e5e7eb] last:border-b-0">
 <Text className="font-sans text-[#202124] text-sm font-semibold flex-1 pr-2 truncate">
 {it.item_name || "Item"}
 </Text>
 <Text className="font-sans text-[#7a7f85] text-sm">
 <Text className="font-sans text-[#202124] font-semibold">{it.total_boxes}</Text> Box • <Text className="font-sans text-[#202124] font-semibold">{Number(it.requested_kg || 0).toFixed(1)}</Text> KG
 </Text>
 </View>
 ))}
 {(!order.items || order.items.length === 0) && (
 <Text className="font-sans text-[#7a7f85] text-xs italic py-1">No items listed</Text>
 )}
 </View>

 {(order.status === "PLACED" || order.status === "ACKNOWLEDGED") && (
 <View className="flex-row justify-end gap-2 mt-2">
 {order.status === "PLACED" && (
 <Pressable
 className="bg-[#2E7D32] min-h-[44px] px-6 rounded-md flex-row items-center justify-center gap-2 active:opacity-80"
 onPress={onConfirm}
 >
 <Text className="font-sans text-white text-sm font-bold">Confirm</Text>
 <MaterialIcons name="check-circle" size={16} color="white" />
 </Pressable>
 )}
 {order.status === "ACKNOWLEDGED" && (
 <Pressable
 className="bg-[#2E7D32] min-h-[44px] px-6 rounded-md flex-row items-center justify-center gap-2 active:opacity-80"
 onPress={onDispatch}
 >
 <MaterialIcons name="local-shipping" size={16} color="white" />
 <Text className="font-sans text-white text-sm font-bold">Dispatch</Text>
 </Pressable>
 )}
 </View>
 )}
 </Pressable>
 );
});
