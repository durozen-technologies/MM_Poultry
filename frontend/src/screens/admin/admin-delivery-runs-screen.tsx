import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { listDeliveryRuns } from "../../api/delivery";
import { apiItems } from "../../api/items";
import type { DeliveryRun, DeliveryStop } from "../../types/api";
import { AdminScreenContainer } from "../../components/admin/admin-screen-container";
import { AdminHeader } from "../../components/admin/admin-header";

const STATUS_LABEL: Record<string, string> = {
  planned: "Planned",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function AdminDeliveryRunsScreen({ navigation }: { navigation: any }) {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["admin", "delivery-runs"],
    queryFn: () => listDeliveryRuns(100, 0),
  });

  const { data: itemsData } = useQuery({
    queryKey: ["admin", "items"],
    queryFn: () => apiItems.list(),
  });

  const itemsMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    itemsData?.items.forEach((item) => {
      map[item.id] = item.name;
    });
    return map;
  }, [itemsData]);

  const groupedData = React.useMemo(() => {
    if (!data) return [];
    
    // Group runs by vehicle (or driver/id if vehicle missing)
    const grouped = new Map<string, DeliveryRun & { original_runs: string[] }>();
    
    data.forEach((run) => {
      const vKey = run.vehicle_id || run.vehicle_number || run.driver_user_id || run.id;
      if (grouped.has(vKey)) {
        const existing = grouped.get(vKey)!;
        existing.stops = [...(existing.stops || []), ...(run.stops || [])];
        existing.original_runs.push(run.id);
        // We can prioritize 'in_progress' status over 'planned' if combining
        if (run.status === 'in_progress') existing.status = 'in_progress';
      } else {
        grouped.set(vKey, { ...run, stops: [...(run.stops || [])], original_runs: [run.id] });
      }
    });
    
    return Array.from(grouped.values());
  }, [data]);

  const [expandedRuns, setExpandedRuns] = useState<Record<string, boolean>>({});

  const refresh = useCallback(() => {
    refetch();
  }, [refetch]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const toggleRun = (runId: string) => {
    setExpandedRuns((prev) => ({ ...prev, [runId]: !prev[runId] }));
  };

  // We use the first original run's id or the grouped id as the key for expanding
  const renderRun = ({ item }: { item: DeliveryRun & { original_runs?: string[] } }) => {
    const runKey = item.id;
    const isExpanded = expandedRuns[runKey];
    let totalBoxes = 0;
    let totalKg = 0;
    
    const itemSummary: Record<string, { boxes: number; kg: number }> = {};
    const retailerSummary: Record<string, { id: string, name: string, shop: string, boxes: number, kg: number, items: Record<string, { boxes: number, kg: number }> }> = {};

    item.stops?.forEach((stop) => {
      const rId = stop.retailer_id;
      if (!retailerSummary[rId]) {
        retailerSummary[rId] = { 
          id: rId, 
          name: stop.retailer_name || "Unknown Company", 
          shop: stop.shop_name || "Unknown Shop", 
          boxes: 0, 
          kg: 0,
          items: {}
        };
      }

      stop.items?.forEach((i) => {
        const boxes = i.original_total_boxes || 0;
        const kg = Number(i.original_requested_kg || i.ordered_kg || 0);
        
        totalBoxes += boxes;
        totalKg += kg;

        if (!itemSummary[i.item_id]) {
          itemSummary[i.item_id] = { boxes: 0, kg: 0 };
        }
        itemSummary[i.item_id].boxes += boxes;
        itemSummary[i.item_id].kg += kg;

        retailerSummary[rId].boxes += boxes;
        retailerSummary[rId].kg += kg;

        if (!retailerSummary[rId].items[i.item_id]) {
          retailerSummary[rId].items[i.item_id] = { boxes: 0, kg: 0 };
        }
        retailerSummary[rId].items[i.item_id].boxes += boxes;
        retailerSummary[rId].items[i.item_id].kg += kg;
      });
    });

    const vName = item.vehicle_name ? item.vehicle_name : "";
    const vNumber = item.vehicle_number ? ` - ${item.vehicle_number}` : "";
    const vehicleDisplay = (vName || vNumber) ? `${vName}${vNumber}`.replace(/^ - /, "") : "Unassigned Vehicle";

    // Deduplicate orders count (some stops might be for the same order if backend splits, but we just use unique daily_order_id or fallback to stops count)
    const uniqueOrders = new Set(item.stops?.map(s => s.daily_order_id || s.id));
    const ordersCount = uniqueOrders.size;

    return (
      <View className="bg-white rounded-lg mb-3 border border-[#e5e7eb] overflow-hidden">
        <Pressable
          className="p-4 flex-row items-center justify-between"
          onPress={() => toggleRun(runKey)}
        >
          <View className="flex-1">
            <View className="flex-row items-center gap-2 mb-1">
              <Text className="text-lg font-bold text-[#202124] flex-shrink">{vehicleDisplay}</Text>
              <View className="bg-[#f7f8fa] px-2 py-0.5 rounded-lg">
                <Text className="text-xs text-[#5f6368] font-semibold uppercase">
                  {STATUS_LABEL[item.status] ?? item.status}
                </Text>
              </View>
            </View>
            
            <View className="flex-row items-center mt-1">
              <MaterialIcons name="person" size={14} className="text-[#5f6368] mr-1" />
              <Text className="text-sm font-bold text-[#5f6368] mr-4">{item.driver_name || "Unassigned Driver"}</Text>
            </View>

            <View className="flex-row gap-4 mt-3">
              <View>
                <Text className="text-xs text-[#5f6368] uppercase font-bold tracking-wider mb-0.5">Orders</Text>
                <Text className="text-base font-bold text-[#202124]">{ordersCount}</Text>
              </View>
              <View>
                <Text className="text-xs text-[#5f6368] uppercase font-bold tracking-wider mb-0.5">Boxes</Text>
                <Text className="text-base font-bold text-[#202124]">{totalBoxes}</Text>
              </View>
              <View>
                <Text className="text-xs text-[#5f6368] uppercase font-bold tracking-wider mb-0.5">KGs</Text>
                <Text className="text-base font-bold text-[#202124]">{totalKg.toFixed(1)}</Text>
              </View>
            </View>
          </View>
          
          <MaterialIcons 
            name={isExpanded ? "expand-less" : "expand-more"} 
            size={24} 
            className="text-[#5f6368]"
          />
        </Pressable>

        {isExpanded && (
          <View className="bg-[#f7f8fa]/50 border-t border-[#e5e7eb] p-3">
            {/* Items Wise Boxes List */}
            {Object.keys(itemSummary).length > 0 && (
              <View className="mb-4">
                <Text className="text-xs font-bold text-[#5f6368] uppercase tracking-wider mb-2">Item-wise Summary</Text>
                {Object.entries(itemSummary).map(([itemId, sum]) => (
                  <View key={itemId} className="flex-row justify-between items-center bg-white rounded-md p-2 mb-1.5 border border-[#e5e7eb]">
                    <Text className="text-sm font-bold text-[#202124]">{itemsMap[itemId] || "Unknown Item"}</Text>
                    <Text className="text-sm font-bold text-[#2E7D32]">
                      {sum.boxes} Boxes · {sum.kg.toFixed(1)} kg
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Retailers Wise List */}
            {Object.keys(retailerSummary).length > 0 && (
              <View>
                <Text className="text-xs font-bold text-[#5f6368] uppercase tracking-wider mb-2">Retailer-wise List</Text>
                {Object.values(retailerSummary).map((ret) => (
                  <View key={ret.id} className="bg-white rounded-md p-2 mb-1.5 border border-[#e5e7eb]">
                    <View className="flex-row justify-between items-center mb-1">
                      <Text className="text-sm font-bold text-[#202124] flex-1 mr-2">{ret.shop}</Text>
                      <Text className="text-sm font-bold text-[#2E7D32]">
                        {ret.boxes} Boxes · {ret.kg.toFixed(1)} kg
                      </Text>
                    </View>
                    <Text className="text-xs font-bold text-[#5f6368] mb-1">{ret.name}</Text>
                    
                    {Object.keys(ret.items).length > 0 && (
                      <View className="mt-1 pt-1.5 border-t border-[#f0f0f0]">
                        {Object.entries(ret.items).map(([itemId, sum]) => (
                          <View key={itemId} className="flex-row justify-between items-center mb-1">
                            <Text className="text-xs text-[#5f6368]">{itemsMap[itemId] || "Unknown Item"}</Text>
                            <Text className="text-xs font-semibold text-[#5f6368]">
                              {sum.boxes} Boxes · {sum.kg.toFixed(1)} kg
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <AdminScreenContainer
      noScroll
      header={
        <AdminHeader
          title="Active Vehicles"
          subtitle="Overview of delivery runs and assigned orders"
          showBackButton={true}
          onBack={() => navigation.goBack()}
        />
      }
    >
      {isLoading ? (
        <ActivityIndicator className="mt-8" />
      ) : (
        <FlatList
          className="flex-1 px-4 pt-4"
          data={groupedData}
          keyExtractor={(item) => item.id}
          renderItem={renderRun}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refresh} />}
          ListEmptyComponent={
            <View className="py-10 items-center justify-center">
              <MaterialIcons name="local-shipping" size={48} className="text-[#e5e7eb] mb-3" />
              <Text className="text-base text-[#5f6368] font-bold">No active vehicles</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </AdminScreenContainer>
  );
}
