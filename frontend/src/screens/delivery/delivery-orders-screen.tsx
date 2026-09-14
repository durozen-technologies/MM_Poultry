import React, { useState, useMemo, useCallback } from "react";
import {
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
  ScrollView,
  ActivityIndicator,
  Linking,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDeliveryRun } from "../../hooks/use-delivery-run";
import { useQuery } from "@tanstack/react-query";
import { apiItems } from "../../api/items";
import type { DeliveryStopStatus } from "../../types/api";
import { getBill, markWhatsAppShared } from "../../api/delivery";
import { shareWhatsAppBill, deliveryBillToPrintPayload } from "../../services/printer";
import { getApiErrorMessage } from "../../api/client";
import { useAuthStore } from "../../store/auth-store";


export function DeliveryOrdersScreen({ navigation }: { navigation: any }) {
  const insets = useSafeAreaInsets();
  const { run, refresh: refetch, isLoading: isRunLoading } = useDeliveryRun();
  
  const stops = run?.stops || [];
  
  const { data: itemsPage, isLoading: isItemsLoading } = useQuery({
    queryKey: ["delivery_items"],
    queryFn: () => apiItems.list(true),
  });
  const allItems = itemsPage?.items || [];
  const getItemName = useCallback((id: string) => allItems.find((i: any) => i.id === id)?.name || id.slice(0, 8), [allItems]);

  const totalBoxes = useMemo(() => stops.reduce((sum: number, s: any) => sum + (s.items || []).reduce((isum: number, it: any) => isum + (it.original_total_boxes || 0), 0), 0), [stops]);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"All" | "PENDING" | "DELIVERED" | "BILLED">("All");

  const filteredStops = useMemo(() => {
    return stops.filter((s: any) => {
      if (searchQuery && !(s.shop_name?.toLowerCase().includes(searchQuery.toLowerCase()) || s.retailer_name?.toLowerCase().includes(searchQuery.toLowerCase()))) return false;
      if (filter === "All") return true;
      if (filter === "PENDING" && s.status === "PENDING") return true;
      if (filter === "DELIVERED" && (s.status === "WEIGHED" || s.status === "BILLED")) return true;
      if (filter === "BILLED" && s.status === "BILLED") return true;
      return false;
    });
  }, [stops, searchQuery, filter]);

  const pendingCount = useMemo(() => stops.filter((s: any) => s.status === "PENDING").length, [stops]);
  const deliveredCount = useMemo(() => stops.filter((s: any) => s.status === "WEIGHED" || s.status === "BILLED").length, [stops]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING": return { bg: "bg-[#FFEBEE]", text: "text-[#C62828]", icon: "pending-actions" };
      case "WEIGHED": return { bg: "bg-[#FFF3E0]", text: "text-[#E65100]", icon: "local-shipping" };
      case "BILLED": return { bg: "bg-[#E8F5E9]", text: "text-[#2E7D32]", icon: "check-circle" };
      case "SKIPPED": return { bg: "bg-[#F3F4F6]", text: "text-[#4B5563]", icon: "skip-next" };
      case "FAILED": return { bg: "bg-error", text: "text-white", icon: "cancel" };
      default: return { bg: "bg-surface-variant", text: "text-on-surface-variant", icon: "help" };
    }
  };

  const isRefetching = isRunLoading || isItemsLoading;
  const isLoading = isRefetching;

  const organizationName = useAuthStore((s) => s.user?.organization_name);

  const handleShareBill = useCallback(async (stop: any) => {
    try {
      const bill = await getBill(stop.id);
      if (!bill) {
        alert("Could not find bill for this order.");
        return;
      }
      const payload = deliveryBillToPrintPayload(bill, stop, getItemName, { organizationName });
      await shareWhatsAppBill(payload);
      await markWhatsAppShared(bill.id);
      alert("WhatsApp share marked");
    } catch (e) {
      alert(getApiErrorMessage(e));
    }
  }, [getItemName, organizationName]);

  return (
    <View className="flex-1 max-w-3xl mx-auto w-full bg-background" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="h-16 px-4 flex-row items-center justify-between bg-surface-container-lowest border-b border-outline-variant/20 z-20">
        <View className="flex-row items-center gap-2">
          <View className="w-8 h-8 rounded-full bg-[#0052CC]/10 items-center justify-center">
            <MaterialIcons name="receipt-long" size={18} className="text-[#0052CC]" />
          </View>
          <Text className="font-headline-sm text-on-surface font-bold tracking-tight">
            Orders
          </Text>
        </View>
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
        data={filteredStops}
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
              <View className="w-[48%] bg-[#E8F5E9] rounded-xl p-4 shadow-sm flex-col justify-between border border-[#2E7D32]/20">
                <Text className="font-body-md text-[#2E7D32] opacity-90 font-semibold">Today's Orders</Text>
                <Text className="font-display-lg text-[#2E7D32] mt-1 font-bold">{stops.length}</Text>
              </View>
              {/* Big Stat 2 */}
              <View className="w-[48%] bg-[#E8F5E9] rounded-xl p-4 shadow-sm flex-col justify-between border border-[#2E7D32]/20">
                <Text className="font-body-md text-[#2E7D32] opacity-90 font-semibold">Total Boxes</Text>
                <Text className="font-headline-md text-[#2E7D32] mt-1 font-bold truncate">
                  {totalBoxes}
                </Text>
              </View>
              {/* Small Stat 1 */}
              <View className="w-[48%] bg-white rounded-xl p-3 shadow-sm flex-row items-center gap-3 border border-outline-variant/20">
                <View className="w-8 h-8 rounded-full bg-[#FFEBEE] flex items-center justify-center">
                  <MaterialIcons name="pending-actions" size={18} className="text-[#C62828]" />
                </View>
                <View className="flex-col flex-1">
                  <Text className="font-headline-sm text-on-surface font-bold leading-tight">{pendingCount}</Text>
                  <Text className="font-label-md text-on-surface-variant truncate font-semibold">Pending</Text>
                </View>
              </View>
              {/* Small Stat 2 */}
              <View className="w-[48%] bg-white rounded-xl p-3 shadow-sm flex-row items-center gap-3 border border-outline-variant/20">
                <View className="w-8 h-8 rounded-full bg-[#E8F5E9] flex items-center justify-center">
                  <MaterialIcons name="check-circle" size={18} className="text-[#2E7D32]" />
                </View>
                <View className="flex-col flex-1">
                  <Text className="font-headline-sm text-on-surface font-bold leading-tight">{deliveredCount}</Text>
                  <Text className="font-label-md text-on-surface-variant truncate font-semibold">Delivered</Text>
                </View>
              </View>
            </View>

            {/* Filter Chips */}
            <View className="pt-4">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4 flex-row gap-2 pb-2">
                {(["All", "PENDING", "DELIVERED", "BILLED"] as const).map((f) => (
                  <Pressable accessibilityRole="button" accessibilityLabel="Button"
                    key={f}
                    onPress={() => setFilter(f)}
                    className={`h-10 px-5 rounded-full items-center justify-center shadow-sm mr-2 border ${
                      filter === f ? "bg-[#2E7D32] border-[#2E7D32]" : "bg-white border-[#e5e7eb]"
                    }`}
                  >
                    <Text
                      className={`font-label-md font-bold uppercase tracking-wider ${
                        filter === f ? "text-white" : "text-[#5f6368]"
                      }`}
                    >
                      {f}
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
        renderItem={({ item: stop }) => (
          <OrderListItem 
            stop={stop} 
            statusColors={getStatusColor(stop.status)} 
            getItemName={getItemName}
            onPress={() => navigation.navigate("DeliveryWeighing", { stop })} 
            onShareBill={() => handleShareBill(stop)}
          />
        )}
      />

    </View>
  );
}

const OrderListItem = React.memo(({ stop, statusColors, getItemName, onPress, onShareBill }: { stop: any, statusColors: any, getItemName: (id: string) => string, onPress: () => void, onShareBill?: () => void }) => {
  return (
    <View
      className="bg-white rounded-xl p-4 shadow-sm elevation-sm mb-2 border border-[#E5E7EB] flex-col relative overflow-hidden"
    >
      <View className={`absolute top-0 left-0 w-1 h-full ${stop.status === 'PENDING' ? 'bg-[#C62828]' : 'bg-[#E5E7EB]'}`} />
      
      <View className="flex-row items-center justify-between w-full mb-1">
        <View className="flex-row items-center gap-2">
          <View className={`w-6 h-6 rounded-full items-center justify-center ${stop.status === 'PENDING' ? 'bg-[#FFEBEE]' : 'bg-[#F3F4F6]'}`}>
            <Text className={`font-bold text-[12px] ${stop.status === 'PENDING' ? 'text-[#C62828]' : 'text-[#4B5563]'}`}>{stop.sequence}</Text>
          </View>
          <Text className="font-headline-sm text-[16px] text-[#202124] font-bold">
            {stop.shop_name || stop.retailer_name || "Unknown Retailer"}
          </Text>
        </View>
        <View className={`${statusColors.bg} px-3 py-1 rounded-full flex-row items-center gap-1`}>
          <MaterialIcons name={statusColors.icon as any} size={14} color={statusColors.text.replace('text-', '')} className={statusColors.text} />
          <Text className={`font-label-md text-[11px] uppercase tracking-wider font-bold ${statusColors.text}`}>
            {stop.status === 'WEIGHED' ? 'DELIVERED' : stop.status}
          </Text>
        </View>
      </View>

      <View className="flex-col pl-8 mb-3">
        {stop.shop_name && stop.shop_name !== stop.retailer_name ? (
          <Text className="text-[14px] text-[#5F6368]" numberOfLines={1}>
            {stop.retailer_name}
          </Text>
        ) : null}
        {stop.retailer_mobile ? (
          <Pressable onPress={() => Linking.openURL(`tel:${stop.retailer_mobile}`)} className="flex-row items-center gap-1 mt-1 bg-blue-50/50 self-start px-2 py-1 rounded-md border border-blue-100 active:bg-blue-100">
            <MaterialIcons name="phone" size={14} className="text-[#0052CC]" />
            <Text className="text-[14px] text-[#0052CC] font-medium" numberOfLines={1}>
              {stop.retailer_mobile}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/* Item List with Price Badges */}
      {stop.items && stop.items.length > 0 && (
        <View className="mt-1 bg-[#F7F8FA] rounded-lg p-2 flex-col gap-2 border border-[#E5E7EB]">
          {stop.items.map((it: any, index: number) => {
            const boxes = (stop.status === "WEIGHED" || stop.status === "BILLED") ? (it.delivered_boxes ?? it.original_total_boxes ?? 0) : (it.original_total_boxes || 0);
            const isLast = index === stop.items.length - 1;
            return (
              <View key={it.item_id} className={`flex-row items-center justify-between py-1 ${!isLast ? 'border-b border-[#E5E7EB]' : ''}`}>
                <View className="flex-1 mr-2">
                  <Text className="text-[14px] text-[#202124] font-medium" numberOfLines={1}>
                    {getItemName(it.item_id)}
                  </Text>
                  <View className={`self-start mt-1 px-1.5 py-0.5 rounded ${it.rate_per_kg != null ? 'bg-[#E8F5E9]' : 'bg-[#FFEBEE]'}`}>
                    <Text className={`text-[10px] font-bold uppercase ${it.rate_per_kg != null ? 'text-[#2E7D32]' : 'text-[#C62828]'}`}>
                      {it.rate_per_kg != null ? 'Price Set' : 'Price Not Set'}
                    </Text>
                  </View>
                </View>
                <View className="bg-[#2E7D32]/10 px-2 py-1 rounded-md border border-[#2E7D32]/20">
                  <Text className="text-[13px] text-[#115E29] font-bold">
                    {boxes} boxes
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <View className="mt-4 flex-row justify-end items-center gap-2">
        {(stop.status === "WEIGHED" || stop.status === "BILLED") && onShareBill ? (
          <Pressable
            onPress={onShareBill}
            className="bg-transparent px-3 py-2 rounded-xl flex-row items-center justify-center gap-1 active:bg-[#f7f8fa]"
          >
            <MaterialIcons name="share" size={16} className="text-[#2E7D32]" />
            <Text className="text-[13px] text-[#2E7D32] font-bold">Share Bill</Text>
          </Pressable>
        ) : null}
        
        <Pressable accessibilityRole="button" accessibilityLabel="Button"
          className="bg-transparent px-3 py-2 rounded-xl flex-row items-center justify-center gap-1 active:bg-[#f7f8fa]"
          onPress={onPress}
        >
          <Text className="text-[13px] text-[#0052CC] font-bold">View Details</Text>
          <MaterialIcons name="arrow-forward" size={16} className="text-[#0052CC]" />
        </Pressable>
      </View>
    </View>
  );
});
