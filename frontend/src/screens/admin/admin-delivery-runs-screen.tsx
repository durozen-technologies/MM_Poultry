import { useState, useEffect } from "react";
import { FlatList, ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View, } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { createDeliveryRun, listDeliveryRuns } from "../../api/delivery";
import { useAdminTodayOrders, useAdminFarms } from "../../hooks/use-queries";
import { formatIstDate } from "../../utils/ist-date";
import { useQuery } from "@tanstack/react-query";

export function AdminDeliveryRunsScreen({ navigation }: { navigation: any }) {
  const { data: todayOrders, isLoading: isLoadingOrders, refetch: refetchOrders } = useAdminTodayOrders();
  const { data: farmsData, isLoading: isLoadingFarms, refetch: refetchFarms } = useAdminFarms();

  const orders = todayOrders?.items?.filter((o) => o.status === "PLACED") || [];
  const loads = farmsData?.loads?.filter((l) => l.status === "OPEN") || [];

  const [selectedLoad, setSelectedLoad] = useState<string | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: runs = [], isLoading: isLoadingRuns, refetch: refetchRuns } = useQuery({
    queryKey: ["admin", "delivery-runs"],
    queryFn: () => listDeliveryRuns(20, 0),
  });

  const isLoading = isLoadingOrders || isLoadingFarms || isLoadingRuns;

  useEffect(() => {
    if (todayOrders?.items && !initialized) {
      const eligible = todayOrders.items.filter((o) => o.status === "PLACED");
      setSelectedOrders(new Set(eligible.map((o) => o.id)));
      setInitialized(true);
    }
  }, [todayOrders?.items, initialized]);

  function toggleOrder(id: string) {
    setSelectedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onCreateRun() {
    if (selectedOrders.size === 0) {
      setMsg("Select at least one order");
      return;
    }
    if (!selectedLoad) {
      setMsg("Select a farm load");
      return;
    }
    setIsSubmitting(true);
    setMsg("");
    try {
      await createDeliveryRun({
        farm_load_id: selectedLoad || null,
        order_ids: Array.from(selectedOrders),
      });
      setMsg("Delivery run created");
      await Promise.all([refetchOrders(), refetchFarms(), refetchRuns()]);
    } catch (e: any) {
      const m = e?.response?.data?.error?.message || e?.response?.data?.detail || e.message || "Failed to create run";
      setMsg(typeof m === "string" ? m : JSON.stringify(m));
      setTimeout(() => setMsg(null), 4000);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 max-w-3xl mx-auto w-full bg-background" edges={["top", "bottom"]}>
      <View className="h-16 px-4 flex-row items-center bg-surface/90 border-b border-outline-variant/20">
        <Pressable accessibilityRole="button" accessibilityLabel="Button" className="w-11 h-11 -ml-2 items-center justify-center rounded-full" onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} className="text-on-surface" />
        </Pressable>
        <Text className="font-headline-sm text-on-surface font-semibold ml-2">Delivery Runs</Text>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        className="flex-1 px-4 py-4"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {msg ? <Text className="text-error mb-3 font-semibold">{msg}</Text> : null}

            {runs.length > 0 && (
              <View className="mb-4">
                <Text className="font-headline-sm text-on-surface font-semibold mb-3">Recent Runs ({runs.length})</Text>
                {runs.slice(0, 5).map((run: any) => (
                  <View key={run.id} className="bg-surface-container rounded-xl p-3 mb-2 border border-outline-variant/20 flex-row justify-between items-center">
                    <View>
                      <Text className="font-semibold text-on-surface">{formatIstDate(run.run_date)} · {run.status}</Text>
                      <Text className="text-on-surface-variant text-sm">{run.stops?.length || 0} stops {run.vehicle_number ? `· ${run.vehicle_number}` : ""}</Text>
                    </View>
                    <View className={`px-2 py-1 rounded-full ${run.status === "COMPLETED" ? "bg-primary" : run.status === "IN_PROGRESS" ? "bg-tertiary" : "bg-surface-variant"}`}>
                      <Text className="text-white text-xs font-bold">{run.status}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            <Text className="font-headline-sm text-on-surface font-semibold mb-3">Farm Load</Text>
            {isLoading ? (
              <ActivityIndicator className="text-primary" />
            ) : loads.length === 0 ? (
              <Text className="text-on-surface-variant mb-4">No available farm loads. Record a load first.</Text>
            ) : (
              loads.map((load) => (
                <Pressable accessibilityRole="button" accessibilityLabel="Button"
                  key={load.id}
                  className={`rounded-xl p-4 mb-2 border ${
                    selectedLoad === load.id ? "bg-primary-container/20 border-primary" : "bg-surface-container-lowest border-outline-variant/20"
                  }`}
                  onPress={() => setSelectedLoad(load.id)}
                >
                  <Text className="font-headline-sm text-on-surface font-semibold">{formatIstDate(load.load_date)}</Text>
                  <Text className="font-body-md text-on-surface-variant">{load.loaded_weight_kg} kg · {load.status}</Text>
                  {load.vehicle_number ? (
                    <Text className="font-label-md text-on-surface-variant mt-1">{load.vehicle_number}</Text>
                  ) : null}
                </Pressable>
              ))
            )}

            <Text className="font-headline-sm text-on-surface font-semibold mt-4 mb-3">Today's Orders</Text>
            {orders.length === 0 ? (
              <Text className="text-on-surface-variant mb-4">No pending orders for today.</Text>
            ) : null}
          </>
        }
        renderItem={({ item: order }) => (
          <Pressable accessibilityRole="button" accessibilityLabel="Button"
            className={`rounded-xl p-4 mb-2 border flex-row items-center gap-3 ${
              selectedOrders.has(order.id) ? "bg-primary-container/20 border-primary" : "bg-surface-container-lowest border-outline-variant/20"
            }`}
            onPress={() => toggleOrder(order.id)}
          >
            <MaterialIcons
              name={selectedOrders.has(order.id) ? "check-box" : "check-box-outline-blank"}
              size={22}
              className="text-primary"
            />
            <View className="flex-1">
              <Text className="font-body-md text-on-surface font-semibold">{order.shop_name || order.retailer_name}</Text>
              <Text className="font-label-md text-on-surface-variant">{order.items?.reduce((s, it) => s + Number(it.requested_kg || 0), 0) || 0} kg · {order.status}</Text>
            </View>
          </Pressable>
        )}
        ListFooterComponent={
          <Pressable accessibilityRole="button" accessibilityLabel="Button" className="bg-primary h-12 rounded-xl items-center justify-center mt-4" onPress={onCreateRun}>
            <Text className="text-on-primary font-semibold">Create Delivery Run</Text>
          </Pressable>
        }
      />
    </SafeAreaView>
  );
}
