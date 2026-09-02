import React, { useState, useEffect, useMemo, useCallback } from "react";
import { FlatList, ActivityIndicator, Pressable, Text, View, ScrollView } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { createDeliveryRun, listDeliveryRuns } from "../../api/delivery";
import { useAdminTodayOrders, useAdminFarms } from "../../hooks/use-queries";
import { formatIstDate } from "../../utils/ist-date";
import { useQuery } from "@tanstack/react-query";

import { AdminScreenContainer } from "../../components/admin/admin-screen-container";
import { AdminHeader } from "../../components/admin/admin-header";
import { AdminActionFooter } from "../../components/admin/admin-action-footer";

export function AdminDeliveryRunsScreen({ navigation }: { navigation: any }) {
  const { data: todayOrders, isLoading: isLoadingOrders, refetch: refetchOrders, isRefetching: isRefetchingOrders } = useAdminTodayOrders();
  const { data: farmsData, isLoading: isLoadingFarms, refetch: refetchFarms, isRefetching: isRefetchingFarms } = useAdminFarms();

  const orders = useMemo(() => todayOrders?.items?.filter((o) => ["PLACED", "ACKNOWLEDGED", "PARTIAL"].includes(o.status)) || [], [todayOrders?.items]);
  const loads = useMemo(() => farmsData?.loads?.filter((l) => l.status === "OPEN") || [], [farmsData?.loads]);

  const [selectedLoad, setSelectedLoad] = useState<string | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: runs = [], isLoading: isLoadingRuns, refetch: refetchRuns, isRefetching: isRefetchingRuns } = useQuery({
    queryKey: ["admin", "delivery-runs"],
    queryFn: () => listDeliveryRuns(20, 0),
  });

  const isLoading = isLoadingOrders || isLoadingFarms || isLoadingRuns;
  const isRefetching = isRefetchingOrders || isRefetchingFarms || isRefetchingRuns;

  useEffect(() => {
    if (todayOrders?.items && !initialized) {
      const eligible = todayOrders.items.filter((o) => ["PLACED", "ACKNOWLEDGED", "PARTIAL"].includes(o.status));
      setSelectedOrders(new Set(eligible.map((o) => o.id)));
      setInitialized(true);
    }
  }, [todayOrders?.items, initialized]);

  const refresh = useCallback(() => {
    refetchOrders();
    refetchFarms();
    refetchRuns();
  }, [refetchOrders, refetchFarms, refetchRuns]);

  const toggleOrder = useCallback((id: string) => {
    setSelectedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onCreateRun = useCallback(async () => {
    if (selectedOrders.size === 0) {
      setMsg({ text: "Select at least one order to include in the run", ok: false });
      return;
    }
    setIsSubmitting(true);
    setMsg(null);
    try {
      await createDeliveryRun({
        farm_load_id: selectedLoad || null,
        order_ids: Array.from(selectedOrders),
      });
      setMsg({ text: "Delivery run created successfully", ok: true });
      await Promise.all([refetchOrders(), refetchFarms(), refetchRuns()]);
      setSelectedLoad(null);
      setSelectedOrders(new Set());
      setInitialized(false);
    } catch (e: any) {
      const m = e?.response?.data?.error?.message || e?.response?.data?.detail || e.message || "Failed to create run";
      setMsg({ text: typeof m === "string" ? m : JSON.stringify(m), ok: false });
      setTimeout(() => setMsg(null), 4000);
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedOrders, selectedLoad, refetchOrders, refetchFarms, refetchRuns]);

  // Calculate totals for selected orders
  const selectedWeight = useMemo(() => {
    return orders
      .filter((o) => selectedOrders.has(o.id))
      .reduce((sum, o) => sum + (o.items?.reduce((s, it) => s + Number(it.requested_kg || 0), 0) || 0), 0);
  }, [orders, selectedOrders]);

  return (
    <AdminScreenContainer
      noScroll
      header={
        <AdminHeader 
          title="Delivery Runs" 
          subtitle="Assign pending orders to farm loads"
          onBack={() => navigation.goBack()} 
          rightContent={
            <Pressable
              accessibilityRole="button"
              className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container-highest active:bg-surface-variant"
              onPress={refresh}
            >
              {isRefetching ? (
                <ActivityIndicator size="small" className="text-primary" />
              ) : (
                <MaterialIcons name="refresh" size={22} className="text-on-surface" />
              )}
            </Pressable>
          }
        />
      }
    >
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        ListHeaderComponent={
          <>
            <View className="pt-2">
              {msg && (
                <View className={`p-4 rounded-xl mb-4 flex-row items-center ${msg.ok ? "bg-primary-container/80" : "bg-error-container/80"}`}>
                  <MaterialIcons name={msg.ok ? "check-circle" : "error-outline"} size={20} className={`${msg.ok ? "text-on-primary-container" : "text-error"} mr-2`} />
                  <Text className={`font-label-md font-semibold flex-1 ${msg.ok ? "text-on-primary-container" : "text-error"}`}>
                    {msg.text}
                  </Text>
                </View>
              )}

              {runs.length > 0 && (
                <View className="mb-6">
                  <View className="flex-row items-center justify-between mb-3 pl-1">
                    <Text className="font-title-lg text-on-surface font-bold">Recent Runs</Text>
                    <View className="bg-surface-container-highest px-3 py-1 rounded-full">
                      <Text className="font-label-sm text-on-surface-variant font-bold">{runs.length}</Text>
                    </View>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row overflow-visible pb-2">
                    {runs.slice(0, 5).map((run: any) => (
                      <View key={run.id} className="bg-surface-container-lowest rounded-2xl p-4 mr-3 border border-outline-variant/30 shadow-sm w-64">
                        <View className="flex-row justify-between items-start mb-2">
                          <Text className="font-label-md text-on-surface-variant font-bold uppercase tracking-wider">{formatIstDate(run.run_date)}</Text>
                          <View className={`px-2.5 py-0.5 rounded-full ${
                            run.status === "COMPLETED" ? "bg-primary/20" : 
                            run.status === "IN_PROGRESS" ? "bg-tertiary/20" : "bg-surface-variant/50"
                          }`}>
                            <Text className={`text-[10px] font-bold uppercase ${
                              run.status === "COMPLETED" ? "text-primary" : 
                              run.status === "IN_PROGRESS" ? "text-tertiary" : "text-on-surface-variant"
                            }`}>{run.status}</Text>
                          </View>
                        </View>
                        <View className="flex-row items-center gap-2 mt-2">
                          <MaterialIcons name="local-shipping" size={16} className="text-on-surface-variant" />
                          <Text className="font-title-md text-on-surface font-bold truncate">
                            {run.vehicle_number || "Unassigned Vehicle"}
                          </Text>
                        </View>
                        <View className="flex-row items-center gap-2 mt-1">
                          <MaterialIcons name="pin-drop" size={16} className="text-on-surface-variant" />
                          <Text className="font-body-md text-on-surface-variant font-medium">
                            {run.stops?.length || 0} Delivery Stops
                          </Text>
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}

              <Text className="font-title-lg text-on-surface font-bold ml-1 mb-3">Farm Load Source</Text>
              
              {isLoading ? (
                <View className="py-6 items-center">
                  <ActivityIndicator size="small" className="text-primary mb-2" />
                  <Text className="text-on-surface-variant font-medium text-sm">Loading farms...</Text>
                </View>
              ) : loads.length === 0 ? (
                <View className="bg-surface-container-lowest rounded-2xl p-6 border border-dashed border-outline-variant/50 items-center justify-center mb-6">
                  <MaterialIcons name="inventory-2" size={32} className="text-on-surface-variant/70 mb-2" />
                  <Text className="font-title-md text-on-surface font-bold mb-1">No Farm Loads</Text>
                  <Text className="text-on-surface-variant text-center font-medium">
                    No open farm loads available. Farm load is optional — you can still create a run.
                  </Text>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row overflow-visible pb-2 mb-6">
                  {loads.map((load) => (
                    <Pressable
                      key={load.id}
                      className={`rounded-2xl p-4 mr-3 shadow-sm border w-64 active:scale-[0.98] transition-transform relative overflow-hidden ${
                        selectedLoad === load.id 
                          ? "bg-primary-container/20 border-primary shadow-primary/20" 
                          : "bg-surface-container-lowest border-outline-variant/30"
                      }`}
                      onPress={() => setSelectedLoad(load.id)}
                    >
                      {selectedLoad === load.id && (
                        <View className="absolute top-0 right-0 w-8 h-8 bg-primary rounded-bl-2xl items-center justify-center z-10">
                          <MaterialIcons name="check" size={16} color="white" />
                        </View>
                      )}
                      <Text className="font-label-md text-on-surface-variant font-bold uppercase tracking-wider mb-2">{formatIstDate(load.load_date)}</Text>
                      <View className="flex-row items-end gap-1 mb-3">
                        <Text className="font-display-sm text-on-surface font-black">
                          {load.loaded_weight_kg}
                        </Text>
                        <Text className="font-title-md text-on-surface-variant font-bold mb-1">KG</Text>
                      </View>
                      <View className="flex-row items-center gap-2">
                        <View className="w-6 h-6 rounded-full bg-surface-variant/50 items-center justify-center">
                          <MaterialIcons name="local-shipping" size={14} className="text-on-surface" />
                        </View>
                        <Text className="font-label-md text-on-surface font-bold">
                          {load.vehicle_number || "Unassigned"}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              )}

              <View className="flex-row items-center justify-between ml-1 mb-3">
                <Text className="font-title-lg text-on-surface font-bold">Assign Orders</Text>
                {orders.length > 0 && (
                  <Pressable 
                    className="bg-surface-container-highest px-3 py-1 rounded-full"
                    onPress={() => {
                      if (selectedOrders.size === orders.length) {
                        setSelectedOrders(new Set());
                      } else {
                        setSelectedOrders(new Set(orders.map(o => o.id)));
                      }
                    }}
                  >
                    <Text className="font-label-sm text-primary font-bold">
                      {selectedOrders.size === orders.length ? "Deselect All" : "Select All"}
                    </Text>
                  </Pressable>
                )}
              </View>
              
              {orders.length === 0 ? (
                <View className="bg-surface-container-lowest rounded-2xl p-6 border border-dashed border-outline-variant/50 items-center justify-center mb-4">
                  <MaterialIcons name="receipt-long" size={32} className="text-on-surface-variant/70 mb-2" />
                  <Text className="text-on-surface-variant font-medium text-center">
                    No pending orders available to assign.
                  </Text>
                </View>
              ) : null}
            </View>
          </>
        }
        renderItem={({ item: order }) => (
          <OrderListItem 
            order={order} 
            isSelected={selectedOrders.has(order.id)} 
            onToggle={() => toggleOrder(order.id)} 
          />
        )}
        ListFooterComponent={
          <View className="pt-2">
            <AdminActionFooter
              primaryLabel="Create Delivery Run"
              primaryIcon="route"
              onPrimaryPress={onCreateRun}
              isPrimaryLoading={isSubmitting}
              isPrimaryDisabled={selectedOrders.size === 0}
              leftContent={
                <View>
                  <Text className="text-on-surface-variant text-label-lg font-medium mb-1">Selected</Text>
                  <Text className="text-primary font-headline-md font-bold">
                    {selectedOrders.size}
                  </Text>
                </View>
              }
              rightContent={
                <View className="items-end">
                  <Text className="text-on-surface-variant text-label-md font-medium mb-1">Estimated Load</Text>
                  <Text className="text-on-surface font-title-lg font-bold">{selectedWeight.toLocaleString("en-IN", { maximumFractionDigits: 1 })} KG</Text>
                </View>
              }
            />
          </View>
        }
      />
    </AdminScreenContainer>
  );
}

const OrderListItem = React.memo(({ 
  order, 
  isSelected, 
  onToggle 
}: { 
  order: any; 
  isSelected: boolean; 
  onToggle: () => void; 
}) => {
  const weight = useMemo(() => {
    return order.items?.reduce((s: number, it: any) => s + Number(it.requested_kg || 0), 0) || 0;
  }, [order.items]);

  return (
    <Pressable
      className={`rounded-2xl p-4 mb-3 border flex-row items-center gap-4 active:scale-[0.98] transition-transform shadow-sm ${
        isSelected 
          ? "bg-primary-container/20 border-primary" 
          : "bg-surface-container-lowest border-outline-variant/20"
      }`}
      onPress={onToggle}
    >
      <View className={`w-6 h-6 rounded border items-center justify-center ${
        isSelected ? "bg-primary border-primary" : "border-outline-variant/70 bg-transparent"
      }`}>
        {isSelected && <MaterialIcons name="check" size={16} color="white" />}
      </View>
      
      <View className="flex-1">
        <Text className="font-title-md text-on-surface font-bold truncate">
          {order.shop_name || order.retailer_name}
        </Text>
        <View className="flex-row items-center gap-2 mt-1">
          <View className="bg-surface-variant/40 px-2 py-0.5 rounded flex-row items-center">
            <Text className="font-label-sm text-on-surface font-semibold">{weight} KG</Text>
          </View>
          <Text className="font-label-sm text-on-surface-variant uppercase font-bold tracking-wider">
            {order.status}
          </Text>
        </View>
      </View>
    </Pressable>
  );
});
