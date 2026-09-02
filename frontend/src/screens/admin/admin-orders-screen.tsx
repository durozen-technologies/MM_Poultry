import React, { useState, useMemo, useCallback } from "react";
import {
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useAdminTodayOrders, useConfirmOrder } from "../../hooks/use-queries";
import type { OrderStatus, DailyOrderOut } from "../../types/api";
import { AssignDeliveryModal } from "./components/assign-delivery-modal";
import { ConfirmOrderModal } from "./components/confirm-order-modal";
import { cancelOrder, listOrdersByDate } from "../../api/orders";
import { DatePickerField } from "../../components/date-picker-field";
import { todayIstDate, toApiDate } from "../../utils/ist-date";
import { useQuery } from "@tanstack/react-query";

import { AdminScreenContainer } from "../../components/admin/admin-screen-container";
import { AdminHeader } from "../../components/admin/admin-header";

export function AdminOrdersScreen({ navigation }: { navigation: any }) {
  const [selectedDate, setSelectedDate] = useState(todayIstDate());
  const isToday = toApiDate(selectedDate) === toApiDate(todayIstDate());
  const { data: todayData, isLoading: isLoadingToday, isRefetching: isRefetchingToday, refetch: refetchToday } = useAdminTodayOrders();
  const { data: dateData, isLoading: isLoadingDate, isRefetching: isRefetchingDate, refetch: refetchDate } = useQuery({
    queryKey: ["admin", "orders", "by-date", toApiDate(selectedDate)],
    queryFn: () => listOrdersByDate(toApiDate(selectedDate) as string),
    enabled: !isToday,
  });
  const data = isToday ? todayData : dateData;
  const isLoading = isToday ? isLoadingToday : isLoadingDate;
  const isRefetching = isToday ? isRefetchingToday : isRefetchingDate;
  const refetch = isToday ? refetchToday : refetchDate;
  
  const orders = data?.items || [];
  const totalBoxes = data?.total_boxes || 0;
  
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"All" | OrderStatus>("All");
  const [assignOrder, setAssignOrder] = useState<DailyOrderOut | null>(null);
  const [confirmOrderModal, setConfirmOrderModal] = useState<DailyOrderOut | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const handleCancel = useCallback(async (order: DailyOrderOut) => {
    setCancellingId(order.id);
    try {
      await cancelOrder(order.id);
      refetch();
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || e?.response?.data?.detail || e.message || "Failed to cancel";
      alert(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setCancellingId(null);
    }
  }, [refetch]);

  const filteredOrders = useMemo(() => orders.filter((o) => {
    if (searchQuery && !(o.shop_name?.toLowerCase().includes(searchQuery.toLowerCase()) || o.retailer_name?.toLowerCase().includes(searchQuery.toLowerCase()))) return false;
    if (filter !== "All" && o.status !== filter) return false;
    return true;
  }), [orders, searchQuery, filter]);

  const pendingCount = useMemo(() => orders.filter((o) => o.status === "PLACED").length, [orders]);
  const confirmedCount = useMemo(() => orders.filter((o) => o.status === "ACKNOWLEDGED").length, [orders]);

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case "PLACED": return { bg: "bg-error-container/80", text: "text-error", icon: "pending-actions" };
      case "ACKNOWLEDGED": return { bg: "bg-primary-container/80", text: "text-primary", icon: "check-circle" };
      case "PARTIAL": return { bg: "bg-tertiary-container/80", text: "text-tertiary", icon: "local-shipping" };
      case "FULFILLED": return { bg: "bg-secondary-container/80", text: "text-secondary", icon: "done-all" };
      case "CANCELLED": return { bg: "bg-error/10", text: "text-error", icon: "cancel" };
      default: return { bg: "bg-surface-variant", text: "text-on-surface-variant", icon: "help" };
    }
  };

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
                className="w-10 h-10 flex items-center justify-center rounded-full bg-primary/10 active:bg-primary/20"
                onPress={() => navigation.navigate("DeliveryRuns")}
              >
                <MaterialIcons name="local-shipping" size={22} className="text-primary" />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container-highest active:bg-surface-variant"
                onPress={() => refetch()}
              >
                {isRefetching ? (
                  <ActivityIndicator size="small" className="text-primary" />
                ) : (
                  <MaterialIcons name="refresh" size={22} className="text-on-surface" />
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
              <DatePickerField 
                label="Filter by Date" 
                value={selectedDate} 
                onChange={setSelectedDate} 
                maximumDate={todayIstDate()} 
              />
            </View>

            {/* Search */}
            <View className="relative flex-row items-center mb-4">
              <View className="absolute left-4 z-10">
                <MaterialIcons name="search" size={20} className="text-on-surface-variant" />
              </View>
              <TextInput 
                className="flex-1 bg-surface-container-lowest h-13 rounded-2xl border border-outline-variant/50 pl-11 pr-4 font-body-lg text-on-surface focus:border-primary shadow-sm"
                placeholder="Search orders..."
                placeholderTextColor="#9ca3af"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {/* KPI Summary Cards */}
            <View className="flex-row flex-wrap justify-between gap-y-3 mb-4">
              {/* Big Stat 1 */}
              <View className="w-[48%] bg-primary rounded-2xl p-4 shadow-sm relative overflow-hidden">
                <View className="absolute -right-4 -top-4 w-20 h-20 bg-white/10 rounded-full" />
                <Text className="font-label-md text-primary-fixed font-bold mb-1 uppercase tracking-wider">Total Orders</Text>
                <Text className="font-display-md text-white font-bold">{orders.length}</Text>
              </View>
              {/* Big Stat 2 */}
              <View className="w-[48%] bg-primary-container rounded-2xl p-4 shadow-sm relative overflow-hidden border border-primary/20">
                <View className="absolute -right-4 -top-4 w-20 h-20 bg-primary/5 rounded-full" />
                <Text className="font-label-md text-primary font-bold mb-1 uppercase tracking-wider">Total Boxes</Text>
                <Text className="font-display-md text-on-primary-container font-bold">{totalBoxes}</Text>
              </View>
              {/* Small Stat 1 */}
              <View className="w-[48%] bg-surface-container-lowest rounded-2xl p-3 shadow-sm border border-outline-variant/30 flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-full bg-error-container/80 flex items-center justify-center">
                  <MaterialIcons name="pending-actions" size={20} className="text-error" />
                </View>
                <View className="flex-1">
                  <Text className="font-title-lg text-on-surface font-bold leading-tight">{pendingCount}</Text>
                  <Text className="font-label-sm text-on-surface-variant font-medium">Pending</Text>
                </View>
              </View>
              {/* Small Stat 2 */}
              <View className="w-[48%] bg-surface-container-lowest rounded-2xl p-3 shadow-sm border border-outline-variant/30 flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center">
                  <MaterialIcons name="check-circle" size={20} className="text-primary" />
                </View>
                <View className="flex-1">
                  <Text className="font-title-lg text-on-surface font-bold leading-tight">{confirmedCount}</Text>
                  <Text className="font-label-sm text-on-surface-variant font-medium">Confirmed</Text>
                </View>
              </View>
            </View>

            {/* Filter Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-6 overflow-visible">
              {(["All", "PLACED", "ACKNOWLEDGED", "PARTIAL", "FULFILLED", "CANCELLED"] as const).map((f) => (
                <Pressable
                  key={f}
                  accessibilityRole="button"
                  onPress={() => setFilter(f)}
                  className={`h-10 px-5 rounded-full items-center justify-center border mr-2 transition-colors ${
                    filter === f 
                      ? "bg-primary border-primary" 
                      : "bg-surface-container-lowest border-outline-variant/30"
                  }`}
                >
                  <Text
                    className={`font-label-md font-bold ${
                      filter === f ? "text-white" : "text-on-surface-variant"
                    }`}
                  >
                    {f === "ACKNOWLEDGED" ? "Confirmed" : f === "All" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        }
        ListEmptyComponent={
          !isLoading && !isRefetching ? (
            <View className="flex-col items-center justify-center py-12 px-4">
              <View className="w-20 h-20 bg-surface-variant/30 rounded-full items-center justify-center mb-4">
                <MaterialIcons name="receipt-long" size={40} className="text-on-surface-variant" />
              </View>
              <Text className="font-title-lg text-on-surface mb-2 font-bold text-center">
                No orders found
              </Text>
              <Text className="text-body-md text-on-surface-variant text-center">
                There are no orders matching your current filters.
              </Text>
            </View>
          ) : null
        }
        ItemSeparatorComponent={() => <View className="h-3" />}
        renderItem={({ item: order }) => (
          <OrderListItem 
            order={order}
            cancellingId={cancellingId}
            onCancel={() => handleCancel(order)}
            onConfirm={() => setConfirmOrderModal(order)}
            onAssign={() => setAssignOrder(order)}
            onPress={() => navigation.navigate("OrderDetail", { order })}
            getStatusColor={getStatusColor}
          />
        )}
      />
      
      {assignOrder && (
        <AssignDeliveryModal
          order={assignOrder}
          onClose={() => setAssignOrder(null)}
          onAssigned={() => {
            setAssignOrder(null);
            refetch();
          }}
        />
      )}

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
    </AdminScreenContainer>
  );
}

const OrderListItem = React.memo(({
  order,
  cancellingId,
  onCancel,
  onConfirm,
  onAssign,
  onPress,
  getStatusColor,
}: {
  order: DailyOrderOut;
  cancellingId: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  onAssign: () => void;
  onPress: () => void;
  getStatusColor: (status: OrderStatus) => any;
}) => {
  const statusColors = getStatusColor(order.status);
  return (
    <Pressable
      className="bg-surface-container-lowest rounded-3xl p-5 shadow-sm border border-outline-variant/20 active:scale-[0.98] transition-transform overflow-hidden relative"
      onPress={onPress}
    >
      {/* Status indicator bar */}
      <View className={`absolute top-0 left-0 w-1.5 h-full ${statusColors.bg.replace('/80', '').replace('/10', '')}`} />
      
      <View className="flex-row items-center justify-between w-full mb-4 pl-2">
        <Text className="font-title-md text-on-surface font-bold tracking-tight">
          {order.order_number || `#${order.id.split("-")[0].toUpperCase()}`}
        </Text>
        <View className={`${statusColors.bg} px-3 py-1 rounded-full flex-row items-center gap-1.5 border border-white/10`}>
          <MaterialIcons name={statusColors.icon as any} size={14} className={statusColors.text} />
          <Text className={`font-label-sm font-bold ${statusColors.text}`}>
            {order.status === 'ACKNOWLEDGED' ? 'Confirmed' : order.status.charAt(0) + order.status.slice(1).toLowerCase()}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center gap-3 mb-4 pl-2">
        <View className="w-10 h-10 rounded-full bg-surface-variant/30 items-center justify-center">
          <MaterialIcons name="storefront" size={20} className="text-on-surface-variant" />
        </View>
        <View className="flex-1">
          <Text className="font-title-sm text-on-surface font-bold truncate">
            {order.shop_name || "No Business Name"}
          </Text>
          <Text className="font-body-sm text-on-surface-variant font-medium mt-0.5">
            {order.retailer_name || "Unknown Owner"}
          </Text>
        </View>
      </View>

      <View className="bg-surface-container-highest/30 rounded-2xl p-3 mb-4 border border-outline-variant/10 ml-2">
        {order.items?.map((it: any, idx: number) => (
          <View key={it.item_id ?? idx} className="flex-row items-center justify-between py-1.5 border-b border-surface-variant/30 last:border-b-0">
            <Text className="font-label-md text-on-surface font-semibold flex-1 pr-2 truncate">
              {it.item_name || "Item"}
            </Text>
            <Text className="font-label-md text-on-surface-variant">
              <Text className="font-bold text-on-surface">{it.total_boxes}</Text> Box • <Text className="font-bold text-on-surface">{Number(it.requested_kg || 0).toFixed(1)}</Text> KG
            </Text>
          </View>
        ))}
        {(!order.items || order.items.length === 0) && (
          <Text className="font-body-sm text-on-surface-variant italic py-1">No items listed</Text>
        )}
      </View>

      <View className="flex-row justify-end gap-2 pl-2">
        {order.status === "PLACED" && (
          <>
            <Pressable
              className="h-11 px-4 rounded-xl flex-row items-center justify-center border border-error/30 bg-error/5 active:bg-error/10"
              onPress={onCancel}
              disabled={cancellingId === order.id}
            >
              <Text className="font-label-md text-error font-bold">{cancellingId === order.id ? "..." : "Cancel"}</Text>
            </Pressable>
            <Pressable
              className="bg-primary h-11 px-5 rounded-xl flex-row items-center justify-center gap-2 active:opacity-80 shadow-sm shadow-primary/20"
              onPress={onConfirm}
            >
              <Text className="font-label-md text-white font-bold">Confirm</Text>
              <MaterialIcons name="check-circle" size={18} color="white" />
            </Pressable>
          </>
        )}
        
        {order.status === "ACKNOWLEDGED" && (
          <Pressable
            className="bg-primary-container h-11 px-5 rounded-xl flex-row items-center justify-center gap-2 active:opacity-80 border border-primary/10"
            onPress={onAssign}
          >
            <MaterialIcons name="local-shipping" size={18} className="text-primary" />
            <Text className="font-label-md text-primary font-bold">Assign</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
});
