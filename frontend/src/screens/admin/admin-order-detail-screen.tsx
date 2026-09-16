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
import { EditOrderItemModal } from "./components/edit-order-item-modal";

import { PrimaryButton } from "../../components/ui/primary-button";

export function AdminOrderDetailScreen({ route, navigation }: { route: any; navigation: any }) {
 const [order, setOrder] = useState<DailyOrder>(route.params?.order as DailyOrder);
 const [cancelling, setCancelling] = useState(false);
 const [showDispatchModal, setShowDispatchModal] = useState(false);
 const [showConfirmModal, setShowConfirmModal] = useState(false);
 const [showEditPricesModal, setShowEditPricesModal] = useState(false);
 const [showMenu, setShowMenu] = useState(false);
 const [editingItem, setEditingItem] = useState<any>(null);
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
 <View className="z-50">
 <AdminHeader 
 title="Order Details"
 subtitle={order.order_number || `#${order.id.slice(0, 8).toUpperCase()}`}
 onBack={() => navigation.goBack()} 
 rightContent={
 <View className="relative z-50">
 <Pressable
 accessibilityRole="button"
 className="w-10 h-10 rounded-lg flex items-center justify-center active:bg-[#f7f8fa] transition-colors"
 onPress={() => setShowMenu(!showMenu)}
 >
 <MaterialIcons name="more-vert" size={24} className="text-[#5f6368]" />
 </Pressable>

 {showMenu && (
 <View className="absolute top-12 right-0 bg-white rounded-lg border border-[#e5e7eb] overflow-hidden w-48 shadow-sm z-50" style={{ elevation: 5 }}>
 {(order.status === "PLACED" || order.status === "ACKNOWLEDGED" || order.status === "PARTIAL") && (
 <Pressable 
 className="flex-row items-center gap-3 px-4 py-3.5 active:bg-[#f7f8fa]"
 onPress={() => {
 setShowMenu(false);
 handleCancel();
 }}
 >
 <MaterialIcons name="cancel" size={20} className="text-error" />
 <Text className="text-sm font-bold text-error">
 Cancel Order
 </Text>
 </Pressable>
 )}
 {order.status !== "PLACED" && order.status !== "ACKNOWLEDGED" && order.status !== "PARTIAL" && (
 <View className="px-4 py-3.5">
 <Text className="text-sm font-medium text-[#5f6368]">No actions available</Text>
 </View>
 )}
 </View>
 )}
 </View>
 }
 />
 </View>
 }
 >
 <ScrollView className="flex-1 px-4 pt-2"contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
 
  {/* Status Banner */}
  <View className={`rounded-xl p-5 mb-6 border flex-row items-center justify-between ${
    order.status === 'PLACED' ? 'bg-error/5 border-error/20' : 
    order.status === 'ACKNOWLEDGED' ? 'bg-[#0052CC]/5 border-[#0052CC]/20' :
    order.status === 'DISPATCHED' ? 'bg-[#d97706]/5 border-[#d97706]/20' :
    order.status === 'FULFILLED' ? 'bg-[#2E7D32]/5 border-[#2E7D32]/20' : 
    order.status === 'CANCELLED' ? 'bg-error/5 border-error/20' : 'bg-gray-50 border-gray-200'
  }`}>
    <View className="flex-row items-center gap-4">
      <View className={`w-12 h-12 rounded-full items-center justify-center ${
        order.status === 'PLACED' ? 'bg-error/10' : 
        order.status === 'ACKNOWLEDGED' ? 'bg-[#0052CC]/10' :
        order.status === 'DISPATCHED' ? 'bg-[#d97706]/10' :
        order.status === 'FULFILLED' ? 'bg-[#2E7D32]/10' : 
        order.status === 'CANCELLED' ? 'bg-error/10' : 'bg-gray-100'
      }`}>
        <MaterialIcons name={(
          order.status === 'PLACED' ? 'pending-actions' : 
          order.status === 'ACKNOWLEDGED' ? 'check-circle' :
          order.status === 'DISPATCHED' ? 'local-shipping' :
          order.status === 'FULFILLED' ? 'done-all' : 
          order.status === 'CANCELLED' ? 'cancel' : 'info-outline'
        ) as any} size={24} className={
          order.status === 'PLACED' ? 'text-error' : 
          order.status === 'ACKNOWLEDGED' ? 'text-[#0052CC]' :
          order.status === 'DISPATCHED' ? 'text-[#d97706]' :
          order.status === 'FULFILLED' ? 'text-[#2E7D32]' : 
          order.status === 'CANCELLED' ? 'text-error' : 'text-gray-500'
        } />
      </View>
      <View>
        <Text className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">Status</Text>
        <Text className={`text-lg font-black uppercase tracking-wider ${
          order.status === 'PLACED' ? 'text-error' : 
          order.status === 'ACKNOWLEDGED' ? 'text-[#0052CC]' :
          order.status === 'DISPATCHED' ? 'text-[#d97706]' :
          order.status === 'FULFILLED' ? 'text-[#2E7D32]' : 
          order.status === 'CANCELLED' ? 'text-error' : 'text-gray-700'
        }`}>
          {order.status === 'ACKNOWLEDGED' ? 'CONFIRMED' : order.status === 'FULFILLED' ? 'DELIVERED' : order.status}
        </Text>
      </View>
    </View>
  </View>

  {/* Order Info */}
  <View className="mb-6">
    <View className="flex-row items-center gap-2 mb-3 ml-1">
      <MaterialIcons name="info-outline" size={20} className="text-gray-700"/>
      <Text className="text-lg font-bold text-gray-800">Order Summary</Text>
    </View>
    
    <View className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm" style={{ elevation: 2 }}>
      <View className="p-4 border-b border-gray-100">
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center gap-3">
            <View className="w-10 h-10 rounded-full bg-blue-50 items-center justify-center">
              <MaterialIcons name="storefront" size={20} className="text-blue-600"/>
            </View>
            <View>
              <Text className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">Retailer</Text>
              <Text className="text-base font-bold text-gray-900">{order.shop_name || order.retailer_name || "Unknown"}</Text>
            </View>
          </View>
        </View>

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <View className="w-10 h-10 rounded-full bg-gray-50 items-center justify-center">
              <MaterialIcons name="event" size={20} className="text-gray-500"/>
            </View>
            <View>
              <Text className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">Date</Text>
              <Text className="text-sm font-semibold text-gray-700">{formatIstDate(order.order_date)}</Text>
            </View>
          </View>
        </View>

        {order.notes && (
          <View className="mt-4 p-3 bg-gray-50 rounded-lg flex-row gap-2 border border-gray-100">
            <MaterialIcons name="notes" size={16} className="text-gray-500 mt-0.5"/>
            <Text className="text-sm text-gray-600 flex-1 leading-5">{order.notes}</Text>
          </View>
        )}
      </View>

      <View className="flex-row bg-gray-50 divide-x divide-gray-200">
        <View className="flex-1 p-4 items-center justify-center">
          <Text className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1">Total Boxes</Text>
          <View className="flex-row items-end gap-1">
            <Text className="text-2xl font-black text-blue-600">{totalBoxes}</Text>
            <Text className="text-xs font-bold text-blue-600 mb-1">BX</Text>
          </View>
        </View>
        <View className="flex-1 p-4 items-center justify-center">
          <Text className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1">Total Weight</Text>
          <View className="flex-row items-end gap-1">
            <Text className="text-2xl font-black text-green-600">{totalWeight.toLocaleString("en-IN", { maximumFractionDigits: 1 })}</Text>
            <Text className="text-xs font-bold text-green-600 mb-1">KG</Text>
          </View>
        </View>
      </View>
    </View>
  </View>

  {/* Order Items */}
  <View className="flex-row items-center gap-2 mb-4 ml-1">
    <MaterialIcons name="list-alt" size={20} className="text-gray-700"/>
    <Text className="text-lg font-bold text-gray-800">Requested Items</Text>
    <View className="bg-gray-100 px-2.5 py-0.5 rounded-full ml-auto">
      <Text className="text-xs font-bold text-gray-600">{order.items?.length || 0}</Text>
    </View>
  </View>
  
  <View className="flex-col gap-4 mb-8">
    {order.items?.map((item, idx) => (
      <View key={item.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm" style={{ elevation: 1 }}>
        <View className="p-4">
          <View className="flex-row justify-between items-start mb-4">
            <View className="flex-1 pr-4">
              <Text className="text-base font-bold text-gray-900 mb-1">
                {getItemName(item.item_id)}
              </Text>
              {(order.status === "PLACED" || order.status === "ACKNOWLEDGED") && (
                <Pressable 
                  onPress={() => setEditingItem(item)}
                  className="flex-row items-center gap-1 mt-1 active:opacity-50"
                  hitSlop={8}
                >
                  <MaterialIcons name="edit" size={14} className="text-blue-600" />
                  <Text className="text-xs font-bold text-blue-600">Edit Quantity</Text>
                </Pressable>
              )}
            </View>
          </View>
          
          <View className="flex-row gap-3">
            <View className="flex-1 bg-gray-50 border border-gray-100 rounded-lg p-3 items-center justify-center">
              <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Ordered</Text>
              <View className="flex-row items-baseline gap-1 flex-wrap justify-center">
                <Text className="text-lg font-black text-gray-800">{item.total_boxes || 0}</Text>
                <Text className="text-[10px] font-bold text-gray-500 mr-2">bx</Text>
                {item.requested_kg && Number(item.requested_kg) > 0 ? (
                  <>
                    <Text className="text-lg font-black text-gray-800">{Number(item.requested_kg).toLocaleString("en-IN", { maximumFractionDigits: 1 })}</Text>
                    <Text className="text-[10px] font-bold text-gray-500">kg</Text>
                  </>
                ) : null}
              </View>
            </View>
            
            {(item.delivered_boxes != null || item.delivered_kg != null) && (
              <View className="flex-1 bg-green-50 border border-green-100 rounded-lg p-3 items-center justify-center">
                <Text className="text-[10px] font-bold text-green-700 uppercase tracking-widest mb-1.5">Delivered</Text>
                <View className="flex-row items-baseline gap-1 flex-wrap justify-center">
                  <Text className="text-lg font-black text-green-700">{item.delivered_boxes ?? "--"}</Text>
                  <Text className="text-[10px] font-bold text-green-700 mr-2">bx</Text>
                  {item.delivered_kg != null ? (
                    <>
                      <Text className="text-lg font-black text-green-700">{Number(item.delivered_kg).toLocaleString("en-IN", { maximumFractionDigits: 1 })}</Text>
                      <Text className="text-[10px] font-bold text-green-700">kg</Text>
                    </>
                  ) : null}
                </View>
              </View>
            )}
          </View>

          <View className="flex-row justify-between items-center mt-3 pt-3 border-t border-gray-100">
            <View className="flex-row items-center gap-2">
              {item.locked_rate_per_kg != null ? (
                <View className="flex-row items-baseline gap-1">
                  <Text className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mr-1">Price</Text>
                  <Text className="text-sm font-bold text-gray-900">₹{Number(item.locked_rate_per_kg).toLocaleString("en-IN")}</Text>
                  <Text className="text-xs font-medium text-gray-500">/kg</Text>
                </View>
              ) : (
                <View className="bg-red-50 px-2 py-1 rounded">
                  <Text className="text-[10px] font-bold text-red-600 uppercase tracking-widest">Price Not Set</Text>
                </View>
              )}
            </View>

            {(() => {
              const billItem = bill?.items?.find((bi: any) => bi.item_id === item.item_id);
              if (billItem) {
                return (
                  <View className="flex-row items-baseline gap-1">
                    <Text className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mr-1">Total</Text>
                    <Text className="text-xs font-bold text-gray-900">₹</Text>
                    <Text className="text-base font-black text-gray-900">{Number(billItem.amount).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</Text>
                  </View>
                );
              }
              return null;
            })()}
          </View>
          
          {item.notes ? (
            <View className="mt-3 bg-gray-50 rounded-lg p-3 border border-gray-100 flex-row gap-2">
              <MaterialIcons name="notes" size={16} className="text-gray-400 mt-0.5"/>
              <Text className="text-sm text-gray-600 flex-1">{item.notes}</Text>
            </View>
          ) : null}
        </View>
      </View>
    ))}
    
    {(!order.items || order.items.length === 0) && (
      <View className="bg-gray-50 rounded-xl p-8 border border-dashed border-gray-300 items-center justify-center">
        <MaterialIcons name="hourglass-empty" size={32} className="text-gray-400 mb-3"/>
        <Text className="text-sm font-medium text-gray-500 text-center">No items found in this order.</Text>
      </View>
    )}
  </View>

  {/* Action Buttons */}
  <View className="mb-8 gap-3">
    {order.status === "PLACED" && (
      <Pressable
        className="h-14 rounded-xl flex-row items-center justify-center px-6 bg-blue-600 active:bg-blue-700 shadow-sm"
        style={{ elevation: 2 }}
        onPress={() => setShowConfirmModal(true)}
      >
        <MaterialIcons name="check-circle" size={22} color="white" />
        <Text className="text-white font-bold text-base uppercase tracking-wider ml-2">
          Confirm Order
        </Text>
      </Pressable>
    )}

    {user?.role !== "DELIVERY" && (order.status === "ACKNOWLEDGED" || order.status === "PARTIAL") && (
      <Pressable
        className="h-14 rounded-xl flex-row items-center justify-center px-6 bg-orange-600 active:bg-orange-700 shadow-sm"
        style={{ elevation: 2 }}
        onPress={() => setShowDispatchModal(true)}
      >
        <MaterialIcons name="local-shipping" size={22} color="white" />
        <Text className="text-white font-bold text-base uppercase tracking-wider ml-2">
          Dispatch Order
        </Text>
      </Pressable>
    )}

    {user?.role !== "DELIVERY" && order.status !== "CANCELLED" && (
      <Pressable
        className="h-14 rounded-xl flex-row items-center justify-center px-6 bg-white border border-gray-200 active:bg-gray-50 shadow-sm"
        style={{ elevation: 1 }}
        onPress={() => setShowEditPricesModal(true)}
      >
        <MaterialIcons name="edit" size={22} className="text-gray-700" />
        <Text className="text-gray-800 font-bold text-base uppercase tracking-wider ml-2">
          Edit Prices
        </Text>
      </Pressable>
    )}
  </View>
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
 
 {editingItem && (
 <EditOrderItemModal
 order={order}
 itemToEdit={editingItem}
 itemName={getItemName(editingItem.item_id)}
 onClose={() => setEditingItem(null)}
 onSaved={(updated) => {
 setOrder(updated);
 setEditingItem(null);
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
