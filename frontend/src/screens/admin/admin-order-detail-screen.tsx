import { useState } from "react";
import { Text, View, Pressable, ScrollView, Alert, ActivityIndicator } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { apiItems } from "../../api/items";
import type { DailyOrder } from "../../types/api";
import { useAuthStore } from "../../store/auth-store";
import { formatIstDate } from "../../utils/ist-date";
import { cancelOrder, getOrderBill } from "../../api/orders";
import { useQueryClient } from "@tanstack/react-query";

import { AdminScreenContainer } from "../../components/admin/admin-screen-container";
import { AdminHeader } from "../../components/admin/admin-header";
import { SingleOrderDispatchModal } from "./components/single-order-dispatch-modal";
import { ConfirmOrderModal } from "./components/confirm-order-modal";
import { EditOrderPricesModal } from "./components/edit-order-prices-modal";

import { PrimaryButton } from "../../components/ui/primary-button";

export function AdminOrderDetailScreen({ route, navigation }: { route: any; navigation: any }) {
 const [order, setOrder] = useState<DailyOrder>(route.params?.order as DailyOrder);
 const [cancelling, setCancelling] = useState(false);
 const [showDispatchModal, setShowDispatchModal] = useState(false);
 const [showConfirmModal, setShowConfirmModal] = useState(false);
 const [showEditPricesModal, setShowEditPricesModal] = useState(false);
 const user = useAuthStore((s) => s.user);
 const queryClient = useQueryClient();

 const { data: itemsPage } = useQuery({
 queryKey: ["admin_items"],
 queryFn: () => apiItems.list(),
 });

 const { data: bill } = useQuery({
 queryKey: ["order_bill", order?.id],
 queryFn: () => getOrderBill(order!.id),
 enabled: !!order && order.status === "FULFILLED",
 });
 
 const allItems = itemsPage?.items || [];
 const getItemName = (id: string) => allItems.find((i: any) => i.id === id)?.name || "Unknown Item";

 if (!order) {
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
 <Text className="text-[#5f6368] text-center font-medium">Order details could not be found.</Text>
 </View>
 </AdminScreenContainer>
 );
 }

 const totalWeight = order.items?.reduce((sum, it) => sum + Number(it.requested_kg || 0), 0) || 0;
 const totalBoxes = order.items?.reduce((sum, it) => sum + Number(it.total_boxes || 0), 0) || 0;

 const handleCancel = async () => {
 Alert.alert(
 "Cancel Order",
 "Are you sure you want to cancel this order?",
 [
 { text: "No", style: "cancel"},
 { 
 text: "Yes, Cancel", 
 style: "destructive",
 onPress: async () => {
 setCancelling(true);
 try {
 await cancelOrder(order.id);
 setOrder({ ...order, status: "CANCELLED"});
 } catch (e: any) {
 const msg = e?.response?.data?.error?.message || e?.response?.data?.detail || e.message || "Failed to cancel";
 Alert.alert("Error", typeof msg === "string"? msg : JSON.stringify(msg));
 } finally {
 setCancelling(false);
 }
 }
 }
 ]
 );
 };

 return (
 <AdminScreenContainer
 noScroll
 header={
 <AdminHeader 
 title="Order Details"
 subtitle={order.order_number || `#${order.id.slice(0, 8).toUpperCase()}`}
 onBack={() => navigation.goBack()} 
 />
 }
 >
 <ScrollView className="flex-1 px-4 pt-2"contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
 
 {/* Status Banner */}
 <View className="bg-white border border-[#e5e7eb] rounded-[24px] p-6 mb-6 relative overflow-hidden">
 <View className={`absolute top-0 left-0 w-2 h-full ${
 order.status === 'PLACED' ? 'bg-error' : 
 order.status === 'ACKNOWLEDGED' ? 'bg-[#0052CC]' :
 order.status === 'DISPATCHED' ? 'bg-[#d97706]' :
 order.status === 'FULFILLED' ? 'bg-[#2E7D32]' : 
 order.status === 'CANCELLED' ? 'bg-error' : 'bg-[#f7f8fa]'
 }`} />
 
 <View className="flex-row justify-between items-center ml-3">
 <View className="flex-row items-center gap-3">
 <View className={`w-10 h-10 rounded-lg items-center justify-center ${
 order.status === 'PLACED' ? 'bg-error/10' : 
 order.status === 'ACKNOWLEDGED' ? 'bg-[#0052CC]/10' :
 order.status === 'DISPATCHED' ? 'bg-[#fef3c7]' :
 order.status === 'FULFILLED' ? 'bg-[#2E7D32]/10' : 
 order.status === 'CANCELLED' ? 'bg-error/10' : 'bg-[#f7f8fa]'
 }`}>
 <MaterialIcons name={(
 order.status === 'PLACED' ? 'pending-actions' : 
 order.status === 'ACKNOWLEDGED' ? 'check-circle' :
 order.status === 'DISPATCHED' ? 'local-shipping' :
 order.status === 'FULFILLED' ? 'done-all' : 
 order.status === 'CANCELLED' ? 'cancel' : 'info-outline'
 ) as any} size={22} className={
 order.status === 'PLACED' ? 'text-error' : 
 order.status === 'ACKNOWLEDGED' ? 'text-[#0052CC]' :
 order.status === 'DISPATCHED' ? 'text-[#d97706]' :
 order.status === 'FULFILLED' ? 'text-[#2E7D32]' : 
 order.status === 'CANCELLED' ? 'text-error' : 'text-[#5f6368]'
 } />
 </View>
 <View>
 <Text className="text-xs font-bold text-[#5f6368] uppercase tracking-widest mb-1">Status</Text>
 <Text className={`text-lg text-[#5f6368] font-black uppercase tracking-wider ${
 order.status === 'PLACED' ? 'text-error' : 
 order.status === 'ACKNOWLEDGED' ? 'text-[#0052CC]' :
 order.status === 'DISPATCHED' ? 'text-[#d97706]' :
 order.status === 'FULFILLED' ? 'text-[#2E7D32]' : 
 order.status === 'CANCELLED' ? 'text-error' : 'text-[#5f6368]'
 }`}>
 {order.status === 'ACKNOWLEDGED' ? 'CONFIRMED' : order.status === 'FULFILLED' ? 'DELIVERED' : order.status}
 </Text>
 </View>
 </View>
 </View>
 </View>

 {/* Order Info */}
 <View className="bg-white rounded-lg p-5 border border-[#e5e7eb] mb-6">
 <View className="flex-row items-center gap-2 mb-4">
 <View className="w-8 h-8 rounded-lg bg-[#2E7D32]/10 items-center justify-center">
 <MaterialIcons name="receipt-long"size={16} className="text-[#2E7D32]"/>
 </View>
 <Text className="text-base font-bold text-[#5f6368] text-[#202124]">Order Information</Text>
 </View>
 
 <View className="bg-[#f7f8fa]/30 rounded-lg p-1 border border-[#e5e7eb]">
 <InfoRow label="Retailer"value={order.shop_name || order.retailer_name || "Unknown"} icon="storefront"isFirst />
 <InfoRow label="Order Date"value={formatIstDate(order.order_date)} icon="event"/>
 
 <View className="h-[1px] bg-outline-variant/20 my-2 mx-3"/>
 
 <View className="flex-row justify-between items-center p-4 border-b border-[#e5e7eb]">
 <View className="flex-row items-center gap-3">
 <View className="w-10 h-10 rounded-lg bg-[#0052CC]/10 items-center justify-center">
 <MaterialIcons name="inventory-2"size={20} className="text-[#0052CC]"/>
 </View>
 <Text className="text-base font-bold text-[#0052CC] uppercase tracking-wider">Total Boxes</Text>
 </View>
 <View className="flex-row items-end gap-1.5 bg-[#0052CC]/10 px-4 py-2 rounded-lg border border-[#0052CC]/20">
 <Text className="text-lg text-[#5f6368] font-black text-[#0052CC]">{totalBoxes}</Text>
 <Text className="text-sm font-bold text-[#5f6368] text-[#0052CC] mb-1">BOXES</Text>
 </View>
 </View>

 <View className="flex-row justify-between items-center p-3">
 <View className="flex-row items-center gap-2">
 <View className="w-8 items-center">
 <MaterialIcons name="scale"size={16} className="text-[#5f6368]"/>
 </View>
 <Text className="text-sm font-bold text-[#5f6368] uppercase tracking-wider">Est. Weight</Text>
 </View>
 <View className="flex-row items-end gap-1">
 <Text className="text-base font-bold text-[#5f6368] font-black text-[#2E7D32]">{totalWeight.toLocaleString("en-IN", { maximumFractionDigits: 1 })}</Text>
 <Text className="text-sm font-bold text-[#5f6368] text-[#2E7D32] mb-0.5">KG</Text>
 </View>
 </View>
 </View>
 </View>

 {/* Order Items */}
 <View className="flex-row items-center gap-2 mb-4 ml-1">
 <MaterialIcons name="list-alt"size={20} className="text-[#202124]"/>
 <Text className="text-2xl font-bold text-[#202124]">Requested Items</Text>
 <View className="bg-[#f7f8fa] px-2 py-0.5 rounded-lg ml-auto">
 <Text className="text-xs font-bold text-[#5f6368]">{order.items?.length || 0}</Text>
 </View>
 </View>
 
 <View className="flex-col gap-3 mb-8">
 {order.items?.map((item, idx) => (
 <View key={item.id} className="bg-white rounded-lg p-4 border border-[#e5e7eb] relative overflow-hidden">
 <View className="absolute top-0 right-0 w-16 h-16 bg-[#2E7D32]/5 rounded-lg -translate-y-8 translate-x-8"/>
 
 <View className="flex-row justify-between items-start mb-3">
 <View className="flex-1 pr-4">
 <Text className="text-sm font-bold text-[#5f6368] text-[#202124] mb-1">
 {getItemName(item.item_id)}
 </Text>
 </View>
 <View className="flex-row gap-2">
 <View className="items-end bg-[#f7f8fa] border border-[#e5e7eb] px-3 py-2 rounded-lg border border-tertiary/20">
 <Text className="text-xs font-bold text-tertiary uppercase tracking-wider mb-0.5">Boxes</Text>
 <View className="flex-row items-end gap-0.5">
 <Text className="text-base font-bold text-[#5f6368] font-black text-tertiary">{item.total_boxes || 0}</Text>
 <Text className="text-xs font-bold text-tertiary mb-0.5">BOX</Text>
 </View>
 </View>
 
 {(() => {
 const billItem = bill?.items?.find((bi: any) => bi.item_id === item.item_id);
 if (billItem) {
 return (
 <>
 <View className="items-end bg-[#115E29]/10 px-3 py-2 rounded-lg border border-[#115E29]/20">
 <Text className="text-xs font-bold text-[#115E29] uppercase tracking-wider mb-0.5">Net Wt</Text>
 <View className="flex-row items-end gap-0.5">
 <Text className="text-base font-bold text-[#5f6368] font-black text-[#115E29]">{Number(billItem.weight_kg).toLocaleString("en-IN", { maximumFractionDigits: 1 })}</Text>
 <Text className="text-xs font-bold text-[#115E29] mb-0.5">KG</Text>
 </View>
 </View>
 <View className="items-end bg-error/10 px-3 py-2 rounded-lg border border-error/20">
 <Text className="text-xs font-bold text-error uppercase tracking-wider mb-0.5">Price</Text>
 <View className="flex-row items-end gap-0.5">
 <Text className="text-xs font-bold text-error mb-0.5">₹</Text>
 <Text className="text-base font-bold text-[#5f6368] font-black text-error">{Number(billItem.amount).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</Text>
 </View>
 </View>
 </>
 );
 }
 if (item.requested_kg && Number(item.requested_kg) > 0) {
 return (
 <View className="items-end bg-[#2E7D32]/10 px-3 py-2 rounded-lg border border-[#2E7D32]/20">
 <Text className="text-xs font-bold text-[#2E7D32] uppercase tracking-wider mb-0.5">Est. Wt</Text>
 <View className="flex-row items-end gap-0.5">
 <Text className="text-base font-bold text-[#5f6368] font-black text-[#2E7D32]">{Number(item.requested_kg).toLocaleString("en-IN", { maximumFractionDigits: 1 })}</Text>
 <Text className="text-xs font-bold text-[#2E7D32] mb-0.5">KG</Text>
 </View>
 </View>
 );
 }
 return null;
 })()}
 </View>
 </View>
 
 {item.notes ? (
 <View className="bg-[#f7f8fa] rounded-lg p-3 border border-[#e5e7eb] flex-row gap-2">
 <MaterialIcons name="notes"size={16} className="text-[#5f6368] mt-0.5"/>
 <Text className="text-sm text-[#5f6368] text-[#5f6368] flex-1">{item.notes}</Text>
 </View>
 ) : null}
 </View>
 ))}
 
 {(!order.items || order.items.length === 0) && (
 <View className="bg-white rounded-lg p-6 border border-dashed border-[#e5e7eb] items-center justify-center">
 <MaterialIcons name="hourglass-empty"size={32} className="text-[#5f6368]/50 mb-2"/>
 <Text className="text-base text-[#5f6368] text-[#5f6368] text-center">No items found in this order.</Text>
 </View>
 )}
 </View>

 {/* Action Buttons */}
 {order.status === "PLACED"&& (
 <Pressable
 className="mb-4 h-14 rounded-lg flex-row items-center justify-center px-6 bg-[#0052CC] active:scale-[0.98] transition-transform"
 onPress={() => setShowConfirmModal(true)}
 >
 <View className="flex-row items-center justify-center gap-2">
 <MaterialIcons name="check-circle"size={22} color="white"/>
 <Text className="text-white font-bold text-base font-bold uppercase tracking-wider">
 Confirm Order
 </Text>
 </View>
 </Pressable>
 )}
 {(order.status === "PLACED"|| order.status === "ACKNOWLEDGED"|| order.status === "PARTIAL") && (
 <PrimaryButton
 title="Cancel Order"
 icon="cancel"
 variant="error"
 onPress={handleCancel}
 loading={cancelling}
 className="mb-4"
 />
 )}

 {user?.role !== "DELIVERY"&& (order.status === "ACKNOWLEDGED"|| order.status === "PARTIAL") && (
 <Pressable
 className="mb-8 h-14 rounded-lg flex-row items-center justify-center px-6 bg-[#d97706] active:scale-[0.98] transition-transform"
 onPress={() => setShowDispatchModal(true)}
 >
 <View className="flex-row items-center justify-center gap-2">
 <MaterialIcons name="local-shipping"size={22} color="white"/>
 <Text className="text-white font-bold text-base font-bold uppercase tracking-wider">
 Dispatch Order
 </Text>
 </View>
 </Pressable>
 )}

 {user?.role !== "DELIVERY" && order.status !== "CANCELLED" && (
 <Pressable
 className="mb-8 h-14 rounded-lg flex-row items-center justify-center px-6 bg-white border border-[#e5e7eb] active:bg-[#f7f8fa] transition-transform"
 onPress={() => setShowEditPricesModal(true)}
 >
 <View className="flex-row items-center justify-center gap-2">
 <MaterialIcons name="edit" size={22} className="text-[#202124]" />
 <Text className="text-[#202124] font-bold text-base uppercase tracking-wider">
 Edit Prices
 </Text>
 </View>
 </Pressable>
 )}
 </ScrollView>
 
 {showDispatchModal && (
 <SingleOrderDispatchModal
 order={order}
 onClose={() => setShowDispatchModal(false)}
 onAssigned={() => {
 setShowDispatchModal(false);
 setOrder({ ...order, status: "DISPATCHED"});
 }}
 />
 )}

 {showConfirmModal && (
 <ConfirmOrderModal
 order={order}
 onClose={() => setShowConfirmModal(false)}
 onConfirmed={() => {
 setShowConfirmModal(false);
 setOrder({ ...order, status: "ACKNOWLEDGED"});
 }}
 />
 )}

 {showEditPricesModal && (
 <EditOrderPricesModal
 order={order}
 onClose={() => setShowEditPricesModal(false)}
 onUpdated={(updated) => {
 setOrder(updated);
 // Prices changed — the bill total is now stale, force a refetch
 queryClient.invalidateQueries({ queryKey: ["order_bill", order?.id] });
 setShowEditPricesModal(false);
 }}
 />
 )}
 </AdminScreenContainer>
 );
}

function InfoRow({ 
 label, 
 value, 
 icon,
 isFirst = false, 
 isLast = false
}: { 
 label: string; 
 value: string; 
 icon: keyof typeof MaterialIcons.glyphMap;
 isFirst?: boolean; 
 isLast?: boolean;
}) {
 return (
 <View className={`flex-row items-center p-3 ${!isLast ? 'border-b border-[#e5e7eb]' : ''}`}>
 <View className="w-8 items-center">
 <MaterialIcons name={icon} size={16} className="text-[#5f6368]"/>
 </View>
 <Text className="text-sm font-bold text-[#5f6368] uppercase tracking-wider w-24">{label}</Text>
 <Text className={`text-sm font-bold text-[#5f6368] flex-1 text-right truncate text-[#202124]`}>{value}</Text>
 </View>
 );
}
