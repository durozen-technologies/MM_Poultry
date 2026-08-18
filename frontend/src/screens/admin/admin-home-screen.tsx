import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
  ScrollView,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../api/client";
import { useAuthStore } from "../../store/auth-store";
import type {
  DailyOrder,
  FarmLoad,
  OpsDashboard,
  ReportSummary,
  Retailer,
  Vehicle,
} from "../../types/api";
import { formatIstDate, toApiDate, todayIstDate } from "../../utils/ist-date";

export function AdminHomeScreen({ navigation }: { navigation: any }) {
  const insets = useSafeAreaInsets();
  const logout = useAuthStore((s) => s.logout);
  const [orders, setOrders] = useState<DailyOrder[]>([]);
  const [dashboard, setDashboard] = useState<OpsDashboard | null>(null);
  const [reportDate, setReportDate] = useState(todayIstDate());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const [o, dash] = await Promise.all([
        api.get("/admin/orders/today"),
        api.get("/admin/dashboard", {
          params: { on_date: toApiDate(reportDate) },
        }),
      ]);
      setOrders(o.data.items);
      setDashboard(dash.data);
      setMessage(null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setBusy(false);
    }
  }, [reportDate]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  useEffect(() => {
    void refresh();
  }, [reportDate]);

  const pendingKg = dashboard 
    ? Math.max(0, Number(dashboard.ordered_kg) - Number(dashboard.delivered_kg)).toFixed(1)
    : "0";

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      {/* Header */}
      <View className="h-16 px-4 flex-row items-center justify-between bg-surface/80">
        <Text className="font-headline-sm text-headline-sm text-on-surface font-semibold">
          Dashboard
        </Text>
        <View className="flex-row items-center gap-4">
          <Pressable
            className="w-11 h-11 flex items-center justify-center rounded-full active:bg-surface-variant/50"
            onPress={refresh}
          >
            <MaterialIcons name="refresh" size={24} color="#414844" />
          </Pressable>
          <Pressable
            className="w-11 h-11 flex items-center justify-center rounded-full active:bg-surface-variant/50"
            onPress={logout}
          >
            <MaterialIcons name="logout" size={24} color="#414844" />
          </Pressable>
        </View>
      </View>

      {message && (
        <Text className="px-4 py-2 text-error text-center text-label-md bg-error-container">
          {message}
        </Text>
      )}

      <ScrollView
        className="flex-1 w-full pt-4 pb-20"
        refreshControl={<RefreshControl refreshing={busy} onRefresh={refresh} />}
      >
        {/* Today's Overview */}
        <View className="px-4 pb-6 flex-col gap-4">
          <View className="flex-row items-center justify-between">
            <Text className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Today's Overview
            </Text>
          </View>

          <View className="flex-row flex-wrap justify-between">
            <View className="w-[48%] bg-surface-container-lowest shadow-sm rounded-2xl p-4 flex-col gap-2 mb-4">
              <View className="flex-row items-center gap-2 text-on-surface-variant">
                <MaterialIcons name="shopping-cart" size={18} color="#414844" />
                <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
                  Today's Orders
                </Text>
              </View>
              <Text className="font-display-lg text-display-lg text-primary font-bold">
                {dashboard?.order_count || 0}
              </Text>
            </View>

            <View className="w-[48%] bg-surface-container-lowest shadow-sm rounded-2xl p-4 flex-col gap-2 mb-4">
              <View className="flex-row items-center gap-2 text-on-surface-variant">
                <MaterialIcons name="scale" size={18} color="#414844" />
                <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
                  Ordered KG
                </Text>
              </View>
              <Text className="font-display-lg text-display-lg text-primary font-bold">
                {dashboard?.ordered_kg || 0}
              </Text>
            </View>

            <View className="w-[48%] bg-surface-container-lowest shadow-sm rounded-2xl p-4 flex-col gap-2 mb-4">
              <View className="flex-row items-center gap-2 text-on-surface-variant">
                <MaterialIcons name="local-shipping" size={18} color="#414844" />
                <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
                  Delivered KG
                </Text>
              </View>
              <Text className="font-display-lg text-display-lg text-on-surface font-bold">
                {dashboard?.delivered_kg || 0}
              </Text>
            </View>

            <View className="w-[48%] bg-surface-container-lowest shadow-sm rounded-2xl p-4 flex-col gap-2 mb-4">
              <View className="flex-row items-center gap-2 text-on-surface-variant">
                <MaterialIcons name="pending-actions" size={18} color="#414844" />
                <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
                  Pending KG
                </Text>
              </View>
              <Text className="font-display-lg text-display-lg text-on-surface font-bold">
                {pendingKg}
              </Text>
            </View>
          </View>

          {/* Today's Sales */}
          <View className="bg-primary-container rounded-2xl p-4 flex-col gap-3 shadow-sm mt-2 relative overflow-hidden">
            <View className="flex-col gap-1 relative z-10">
              <Text className="font-label-md text-label-md text-on-primary-container font-semibold">
                Today's Sales
              </Text>
              <Text className="font-display-lg text-display-lg text-on-primary font-bold">
                ₹{dashboard?.total_sales || 0}
              </Text>
            </View>
            <View className="flex-row justify-between gap-4 mt-3 relative z-10">
              <View className="flex-col gap-1">
                <Text className="font-label-md text-label-md text-on-primary-container font-semibold">
                  Collection
                </Text>
                <Text className="font-headline-sm text-headline-sm text-on-primary font-semibold">
                  ₹{dashboard?.total_collection || 0}
                </Text>
              </View>
              <View className="flex-col gap-1">
                <Text className="font-label-md text-label-md text-on-primary-container font-semibold">
                  Outstanding
                </Text>
                <Text className="font-headline-sm text-headline-sm text-on-primary font-semibold">
                  ₹{dashboard?.outstanding || 0}
                </Text>
              </View>
            </View>
          </View>

          {/* Farm Metrics */}
          <View className="bg-surface-container-lowest shadow-sm rounded-2xl p-4 mt-2 flex-col gap-4">
            <Text className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider font-semibold">
              Farm Metrics
            </Text>
            <View className="flex-row justify-between items-end">
              <View className="flex-col gap-1">
                <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
                  Loaded Weight
                </Text>
                <Text className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                  {dashboard?.loaded_kg || 0} KG
                </Text>
              </View>
              <View className="flex-col gap-1 items-end">
                <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
                  Weight Loss
                </Text>
                <Text className="font-headline-sm text-headline-sm text-error font-semibold">
                  {dashboard?.loss_kg || 0} KG
                </Text>
              </View>
            </View>
            <View className="w-full bg-surface-variant h-2 rounded-full overflow-hidden">
              <View
                className="bg-error h-full rounded-full"
                style={{ width: `${Math.min(100, Number(dashboard?.loss_pct || 0))}%` }}
              />
            </View>
            <View className="flex-row justify-between items-center text-xs">
              <Text className="font-body-md text-body-md text-on-surface-variant">
                Status: {dashboard?.loss_status || "OK"}
              </Text>
              <Text className="font-label-md text-label-md text-error font-semibold">
                {dashboard?.loss_pct || 0}% Loss
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View className="px-4 pb-6 flex-col gap-4">
          <Text className="font-headline-sm text-headline-sm text-on-surface font-semibold">
            Quick Actions
          </Text>
          <View className="flex-row flex-wrap justify-between">
            <Pressable 
              onPress={() => navigation.navigate("Retailers")}
              className="w-[48%] bg-surface-container-lowest shadow-sm rounded-2xl p-3 mb-4 flex-row items-center justify-center gap-2 active:scale-95"
            >
              <MaterialIcons name="person-add" size={20} color="#012d1d" />
              <Text className="font-label-md text-label-md text-on-surface font-semibold">
                Retailers
              </Text>
            </Pressable>
            <Pressable className="w-[48%] bg-surface-container-lowest shadow-sm rounded-2xl p-3 mb-4 flex-row items-center justify-center gap-2 active:scale-95">
              <MaterialIcons name="add-shopping-cart" size={20} color="#012d1d" />
              <Text className="font-label-md text-label-md text-on-surface font-semibold">
                Add Order
              </Text>
            </Pressable>
            <Pressable 
              className="w-[48%] bg-surface-container-lowest shadow-sm rounded-2xl p-3 mb-4 flex-row items-center justify-center gap-2 active:scale-95"
              onPress={() => navigation.navigate("FarmPurchase")}
            >
              <MaterialIcons name="rv-hookup" size={20} color="#012d1d" />
              <Text className="font-label-md text-label-md text-on-surface font-semibold">
                Farm Purchase
              </Text>
            </Pressable>
            <Pressable className="w-[48%] bg-surface-container-lowest shadow-sm rounded-2xl p-3 mb-4 flex-row items-center justify-center gap-2 active:scale-95">
              <MaterialIcons name="payments" size={20} color="#012d1d" />
              <Text className="font-label-md text-label-md text-on-surface font-semibold">
                Payment
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Recent Orders */}
        <View className="px-4 pb-20 flex-col gap-4">
          <View className="flex-row items-center justify-between">
            <Text className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Today's Orders ({orders.length})
            </Text>
            <Pressable className="px-2 py-1">
              <Text className="font-label-md text-label-md text-primary font-semibold">
                View All
              </Text>
            </Pressable>
          </View>
          <View className="flex-col gap-2">
            {orders.slice(0, 5).map((order) => (
              <View key={order.id} className="bg-surface-container-lowest shadow-sm rounded-2xl p-4 flex-col gap-3">
                <View className="flex-row justify-between items-start">
                  <View className="flex-col">
                    <Text className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                      {order.retailer_name}
                    </Text>
                    <Text className="font-body-md text-body-md text-on-surface-variant">
                      Order • {formatIstDate(order.order_date)}
                    </Text>
                  </View>
                  <View className="bg-surface-variant rounded-full px-3 py-1 flex-row items-center gap-1">
                    <View className="w-1.5 h-1.5 rounded-full bg-on-surface-variant" />
                    <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
                      {order.status}
                    </Text>
                  </View>
                </View>
                <View className="w-full h-px bg-surface-variant" />
                <View className="flex-row justify-between items-center">
                  <View className="flex-row items-center gap-2">
                    <MaterialIcons name="scale" size={20} color="#414844" />
                    <Text className="font-body-md text-body-md text-on-surface">
                      {order.requested_kg} KG
                    </Text>
                  </View>
                  <Pressable className="px-3 py-1 rounded-full active:bg-surface-container">
                    <Text className="font-label-md text-label-md text-primary font-semibold">
                      Details
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Bottom Navigation Bar */}
      <View className="absolute bottom-0 inset-x-0 bg-surface/90 border-t border-outline-variant/20 flex-row justify-around items-center px-2 px-2 pt-2" style={{ paddingBottom: Math.max(insets.bottom, 12), height: 60 + Math.max(insets.bottom, 12) }}>
        <Pressable className="flex-col items-center justify-center gap-1 w-20">
          <MaterialIcons name="grid-view" size={24} color="#012d1d" />
          <Text className="font-label-md text-label-md text-primary font-semibold">
            Dashboard
          </Text>
        </Pressable>
        <Pressable 
          className="flex-col items-center justify-center gap-1 w-20"
          onPress={() => navigation.navigate("Retailers")}
        >
          <MaterialIcons name="group" size={24} color="#414844" />
          <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
            Retailers
          </Text>
        </Pressable>
        <Pressable 
          className="flex-col items-center justify-center gap-1 w-20"
          onPress={() => navigation.navigate("Farms")}
        >
          <MaterialIcons name="agriculture" size={24} color="#414844" />
          <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
            Farms
          </Text>
        </Pressable>
        <Pressable 
          className="flex-col items-center justify-center gap-1 w-20"
          onPress={() => navigation.navigate("Orders")}
        >
          <MaterialIcons name="shopping-cart" size={24} color="#414844" />
          <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
            Orders
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
