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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useAdminTodayOrders } from "../../hooks/use-queries";
import type { OrderStatus } from "../../types/api";



export function DeliveryOrdersScreen({ navigation }: { navigation: any }) {
  const insets = useSafeAreaInsets();
  const { data, isLoading, isRefetching, refetch } = useAdminTodayOrders({});
  
  const orders = data?.items || [];
  const totalKg = data?.total_requested_kg || "0";
  
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"All" | OrderStatus>("All");

  const filteredOrders = useMemo(() => {
    return orders.filter((o: any) => {
      if (searchQuery && !(o.shop_name?.toLowerCase().includes(searchQuery.toLowerCase()) || o.retailer_name?.toLowerCase().includes(searchQuery.toLowerCase()))) return false;
      if (filter !== "All" && o.status !== filter) return false;
      return true;
    });
  }, [orders, searchQuery, filter]);

  const pendingCount = useMemo(() => orders.filter((o: any) => o.status === "PLACED").length, [orders]);
  const confirmedCount = useMemo(() => orders.filter((o: any) => o.status === "ACKNOWLEDGED").length, [orders]);

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case "PLACED": return { bg: "bg-error-container", text: "text-on-error-container", icon: "pending-actions" };
      case "ACKNOWLEDGED": return { bg: "bg-primary-fixed", text: "text-on-primary-fixed", icon: "check-circle" };
      case "PARTIAL": return { bg: "bg-tertiary-fixed", text: "text-on-tertiary-fixed-variant", icon: "local-shipping" };
      case "FULFILLED": return { bg: "bg-surface-variant", text: "text-on-surface-variant", icon: "done-all" };
      case "CANCELLED": return { bg: "bg-error", text: "text-on-error", icon: "cancel" };
      default: return { bg: "bg-surface-variant", text: "text-on-surface-variant", icon: "help" };
    }
  };

  return (
    <SafeAreaView className="flex-1 max-w-3xl mx-auto w-full bg-background" edges={["top", "bottom"]}>
      {/* Header */}
      <View className="h-16 px-4 flex-row items-center justify-between bg-surface/90 z-20">
        <Text className="font-headline-sm text-headline-sm text-on-surface font-semibold">
          Orders
        </Text>
        <View className="flex-row items-center gap-1">

          <Pressable accessibilityRole="button" accessibilityLabel="Button"
            className="w-11 h-11 flex items-center justify-center rounded-full active:bg-surface-container"
            onPress={() => refetch()}
          >
            {isRefetching ? (
              <ActivityIndicator size="small" color="#012D1D" />
            ) : (
              <MaterialIcons name="refresh" size={24} className="text-on-surface" />
            )}
          </Pressable>
        </View>
      </View>

      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        ListHeaderComponent={
          <>
            {/* Search & Top Actions */}
            <View className="px-4 pt-3 flex-row items-center gap-3">
              <View className="flex-1 h-12 bg-surface-container-high rounded-full flex-row items-center px-4 shadow-sm">
                <MaterialIcons name="search" size={20} className="text-on-surface" />
                <TextInput placeholderTextColor="#737373"
                  className="flex-1 h-full pl-2 font-body-md text-on-surface placeholder:text-on-surface-variant"
                  placeholder="Search orders..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
 />
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Button" className="w-12 h-12 rounded-full bg-surface-container-high shadow-sm flex items-center justify-center active:bg-surface-container">
                <MaterialIcons name="tune" size={20} className="text-on-surface" />
              </Pressable>
            </View>

            {/* KPI Summary Cards */}
            <View className="px-4 pt-4 flex-row flex-wrap justify-between gap-y-3">
              {/* Big Stat 1 */}
              <View className="w-[48%] bg-primary rounded-xl p-4 shadow-md flex-col justify-between">
                <Text className="font-body-md text-body-md text-on-primary opacity-90 font-semibold">Today's Orders</Text>
                <Text className="font-display-lg text-display-lg text-on-primary mt-1 font-bold">{orders.length}</Text>
              </View>
              {/* Big Stat 2 */}
              <View className="w-[48%] bg-primary-container rounded-xl p-4 shadow-sm flex-col justify-between">
                <Text className="font-body-md text-body-md text-on-primary-container opacity-90 font-semibold">Total Ordered</Text>
                <Text className="font-headline-md text-headline-md-mobile text-on-primary-container mt-1 font-bold truncate">
                  {Number(totalKg).toFixed(0)} <Text className="font-body-md font-normal opacity-80">KG</Text>
                </Text>
              </View>
              {/* Small Stat 1 */}
              <View className="w-[48%] bg-surface-container rounded-xl p-3 shadow-sm flex-row items-center gap-3">
                <View className="w-8 h-8 rounded-full bg-error-container flex items-center justify-center">
                  <MaterialIcons name="pending-actions" size={18} className="text-error" />
                </View>
                <View className="flex-col flex-1">
                  <Text className="font-headline-sm text-headline-sm text-on-surface font-bold leading-tight">{pendingCount}</Text>
                  <Text className="font-label-md text-label-md text-on-surface-variant truncate font-semibold">Pending</Text>
                </View>
              </View>
              {/* Small Stat 2 */}
              <View className="w-[48%] bg-surface-container rounded-xl p-3 shadow-sm flex-row items-center gap-3">
                <View className="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center">
                  <MaterialIcons name="check-circle" size={18} className="text-on-primary-container" />
                </View>
                <View className="flex-col flex-1">
                  <Text className="font-headline-sm text-headline-sm text-on-surface font-bold leading-tight">{confirmedCount}</Text>
                  <Text className="font-label-md text-label-md text-on-surface-variant truncate font-semibold">Confirmed</Text>
                </View>
              </View>
            </View>

            {/* Filter Chips */}
            <View className="pt-4">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4 flex-row gap-2">
                {(["All", "PLACED", "ACKNOWLEDGED", "PARTIAL", "FULFILLED", "CANCELLED"] as const).map((f) => (
                  <Pressable accessibilityRole="button" accessibilityLabel="Button"
                    key={f}
                    onPress={() => setFilter(f)}
                    className={`h-10 px-4 rounded-full items-center justify-center shadow-sm mr-2 ${
                      filter === f ? "bg-primary" : "bg-surface-container"
                    }`}
                  >
                    <Text
                      className={`font-label-md text-label-md font-semibold ${
                        filter === f ? "text-on-primary" : "text-on-surface"
                      }`}
                    >
                      {f === "ACKNOWLEDGED" ? "Confirmed" : f === "All" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
            <View className="h-4" />
          </>
        }
        ListEmptyComponent={
          !isLoading && !isRefetching ? (
            <View className="flex-col items-center justify-center p-8 mt-4">
              <MaterialIcons name="receipt-long" size={48} className="text-on-surface-variant" />
              <Text className="font-headline-md text-on-surface mb-2 mt-4 font-semibold">
                No orders found
              </Text>
            </View>
          ) : null
        }

        ItemSeparatorComponent={() => <View className="h-4" />}
        renderItem={({ item: order }) => (
          <OrderListItem 
            order={order} 
            statusColors={getStatusColor(order.status)} 
            onPress={() => navigation.navigate("OrderDetail", { order })} 
          />
        )}
      />

    </SafeAreaView>
  );
}

const OrderListItem = React.memo(({ order, statusColors, onPress }: { order: any, statusColors: any, onPress: () => void }) => {
  return (
    <View
      className="bg-surface-container-lowest rounded-xl p-4 shadow-sm elevation-sm mb-2 border border-outline-variant/20 flex-col gap-3 relative overflow-hidden"
    >
      <View className={`absolute top-0 left-0 w-1 h-full ${order.status === 'PLACED' ? 'bg-error' : 'bg-primary-fixed-dim'}`} />
      
      <View className="flex-row items-center justify-between w-full">
        <Text className="font-headline-sm text-headline-sm text-on-surface font-semibold">
          {order.order_number || `#${order.id.split("-")[0].toUpperCase()}`}
        </Text>
        <View className={`${statusColors.bg} px-3 py-1 rounded-full flex-row items-center gap-1`}>
          <MaterialIcons name={statusColors.icon as any} size={14} color={statusColors.text === 'text-on-primary-fixed' ? '#002114' : (statusColors.text === 'text-on-error-container' ? '#93000a' : '#181c20')} />
          <Text className={`font-label-md text-label-md font-semibold ${statusColors.text}`}>
            {order.status === 'ACKNOWLEDGED' ? 'Confirmed' : order.status.charAt(0) + order.status.slice(1).toLowerCase()}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center gap-2">
        <MaterialIcons name="storefront" size={18} className="text-on-surface" />
        <Text className="font-body-md text-body-md text-on-surface-variant">
          {order.shop_name || order.retailer_name || "Unknown Retailer"}
        </Text>
      </View>
      {order.retailer_area ? (
        <Text className="text-sm text-on-surface-variant pl-7">
          {order.retailer_area}
        </Text>
      ) : null}

      <View className="flex-row gap-3 mt-1 bg-surface-container-low p-3 rounded-lg">
        <View className="flex-col gap-1 flex-1">
          <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">Total Req.</Text>
          <Text className="font-body-lg text-body-lg text-on-surface font-bold">
            {order.items?.reduce((sum: number, it: any) => sum + Number(it.requested_kg || 0), 0) || '-'} KG ({order.items?.reduce((sum: number, it: any) => sum + (it.total_boxes || 0), 0) || 0} Boxes)
          </Text>
        </View>
        <View className="flex-col gap-1 flex-1">
          <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">Items</Text>
          <Text className="font-body-lg text-body-lg text-on-surface font-bold">{order.items?.length || 0}</Text>
        </View>
        <View className="flex-col gap-1 flex-1">
          <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">Notes</Text>
          <Text className="font-body-lg text-body-lg text-on-surface font-bold truncate" numberOfLines={1}>
            {order.items?.some((i: any) => i.notes) ? "Yes" : "None"}
          </Text>
        </View>
      </View>

      <View className="mt-3 pt-3 flex-row justify-end border-t border-surface-variant/30">
        <Pressable accessibilityRole="button" accessibilityLabel="Button"
          className="bg-transparent h-10 px-4 rounded-xl flex-row items-center justify-center gap-2 active:bg-surface-variant/50"
          onPress={onPress}
        >
          <Text className="font-label-md text-label-md text-primary font-semibold">View Details</Text>
          <MaterialIcons name="arrow-forward" size={18} className="text-primary" />
        </Pressable>
      </View>
    </View>
  );
});
