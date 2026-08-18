import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  Text,
  View,
  ScrollView,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../api/client";
import { useAuthStore } from "../../store/auth-store";
import type { DailyOrder, OpsDashboard } from "../../types/api";
import { toApiDate, todayIstDate } from "../../utils/ist-date";

export function AdminHomeScreen({ navigation }: { navigation: any }) {
  const logout = useAuthStore((s) => s.logout);
  const [orders, setOrders] = useState<DailyOrder[]>([]);
  const [dashboard, setDashboard] = useState<OpsDashboard | null>(null);
  const [reportDate] = useState(todayIstDate());
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
      setOrders(o.data.items || []);
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

  const pendingKg = dashboard?.pending_kg || "0";
  
  const orderedKg = dashboard?.ordered_kg || "0";
  const deliveredKg = dashboard?.delivered_kg || "0";

  const totalSales = Number(dashboard?.total_sales || 0);
  const collection = Number(dashboard?.total_collection || 0);
  const outstanding = Number(dashboard?.outstanding || 0);

  const loadedKg = Number(dashboard?.loaded_kg || 0);
  const lossKg = Number(dashboard?.loss_kg || 0);
  const lossPercent = dashboard?.loss_pct || "0";

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header */}
      <View className="h-16 px-4 flex-row items-center justify-between bg-surface/80">
        <Text className="font-headline-sm text-headline-sm text-on-surface">Dashboard</Text>
        <View className="flex-row items-center gap-3">
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

      <ScrollView
        className="flex-1 w-full"
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={busy} onRefresh={refresh} />}
      >
        {message && (
          <View className="px-4 py-2 mb-4 bg-error-container mx-4 rounded-lg">
            <Text className="text-error text-center text-label-md">{message}</Text>
          </View>
        )}

        <View className="px-4 flex-col gap-4">
          
          {/* Today's Overview Section */}
          <Text className="font-headline-sm text-headline-sm text-on-surface mt-2">Today's Overview</Text>
          <View className="flex-row flex-wrap justify-between gap-y-3">
            <View className="w-[48%] bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant/30">
              <View className="flex-row items-center gap-2 mb-2">
                <MaterialIcons name="shopping-cart" size={18} color="#414844" />
                <Text className="font-label-md text-label-md text-on-surface-variant">Today's Orders</Text>
              </View>
              <Text className="font-display-lg text-display-lg text-primary">{dashboard?.order_count || 0}</Text>
            </View>
            <View className="w-[48%] bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant/30">
              <View className="flex-row items-center gap-2 mb-2">
                <MaterialIcons name="scale" size={18} color="#414844" />
                <Text className="font-label-md text-label-md text-on-surface-variant">Total Ordered</Text>
              </View>
              <Text className="font-display-lg text-display-lg text-primary">{orderedKg}</Text>
            </View>
            <View className="w-[48%] bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant/30">
              <View className="flex-row items-center gap-2 mb-2">
                <MaterialIcons name="local-shipping" size={18} color="#414844" />
                <Text className="font-label-md text-label-md text-on-surface-variant">Delivered KG</Text>
              </View>
              <Text className="font-display-lg text-display-lg text-on-surface">{deliveredKg}</Text>
            </View>
            <View className="w-[48%] bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant/30">
              <View className="flex-row items-center gap-2 mb-2">
                <MaterialIcons name="pending-actions" size={18} color="#414844" />
                <Text className="font-label-md text-label-md text-on-surface-variant">Pending KG</Text>
              </View>
              <Text className="font-display-lg text-display-lg text-on-surface">{pendingKg}</Text>
            </View>
          </View>

          {/* Today's Sales */}
          <View className="bg-primary-container rounded-2xl p-4 mt-2 shadow-sm overflow-hidden relative">
            <View className="absolute -right-8 -top-8 w-32 h-32 bg-primary rounded-full opacity-20" />
            <Text className="font-label-md text-label-md text-on-primary-container">Today's Sales</Text>
            <Text className="font-display-lg text-display-lg text-on-primary">${totalSales.toLocaleString()}</Text>
            
            <View className="flex-row justify-between mt-4 z-10">
              <View>
                <Text className="font-label-md text-label-md text-on-primary-container">Collection</Text>
                <Text className="font-headline-sm text-headline-sm text-on-primary">${collection.toLocaleString()}</Text>
              </View>
              <View>
                <Text className="font-label-md text-label-md text-on-primary-container">Outstanding</Text>
                <Text className="font-headline-sm text-headline-sm text-on-primary">${outstanding.toLocaleString()}</Text>
              </View>
            </View>
          </View>

          {/* Farm Metrics */}
          <View className="bg-surface-container-lowest rounded-2xl p-4 mt-2 shadow-sm border border-outline-variant/30">
            <Text className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest mb-3">Farm Metrics</Text>
            <View className="flex-row justify-between items-end mb-4">
              <View>
                <Text className="font-label-md text-label-md text-on-surface-variant">Loaded Weight</Text>
                <Text className="font-headline-sm text-headline-sm text-on-surface">{loadedKg} KG</Text>
              </View>
              <View className="items-end">
                <Text className="font-label-md text-label-md text-on-surface-variant">Weight Loss</Text>
                <Text className="font-headline-sm text-headline-sm text-error">{lossKg} KG</Text>
              </View>
            </View>
            <View className="w-full bg-surface-variant h-2 rounded-full overflow-hidden mb-2">
              <View className="bg-error h-full rounded-full" style={{ width: `${Math.min(100, Number(lossPercent))}%` }} />
            </View>
            <View className="flex-row justify-between items-center">
              <Text className="font-body-md text-body-md text-on-surface-variant">Industry Avg: 2.5%</Text>
              <Text className="font-label-md text-label-md text-error">{lossPercent}% Loss</Text>
            </View>
          </View>

          {/* Quick Actions */}
          <Text className="font-headline-sm text-headline-sm text-on-surface mt-4 mb-2">Quick Actions</Text>
          <View className="flex-row flex-wrap justify-between gap-y-3">
            <Pressable 
              className="w-[48%] bg-surface-container-lowest rounded-2xl p-3 flex-row items-center justify-center gap-2 shadow-sm active:scale-95 border border-outline-variant/30"
              onPress={() => navigation.navigate("AddRetailer")}
            >
              <MaterialIcons name="person-add" size={20} color="#012d1d" />
              <Text className="font-label-md text-label-md text-on-surface">Add Retailer</Text>
            </Pressable>
            <Pressable 
              className="w-[48%] bg-surface-container-lowest rounded-2xl p-3 flex-row items-center justify-center gap-2 shadow-sm active:scale-95 border border-outline-variant/30"
            >
              <MaterialIcons name="add-shopping-cart" size={20} color="#012d1d" />
              <Text className="font-label-md text-label-md text-on-surface">Add Order</Text>
            </Pressable>
            <Pressable 
              className="w-[48%] bg-surface-container-lowest rounded-2xl p-3 flex-row items-center justify-center gap-2 shadow-sm active:scale-95 border border-outline-variant/30"
              onPress={() => navigation.navigate("AddFarm")}
            >
              <MaterialIcons name="rv-hookup" size={20} color="#012d1d" />
              <Text className="font-label-md text-label-md text-on-surface">Start Loading</Text>
            </Pressable>
            <Pressable 
              className="w-[48%] bg-surface-container-lowest rounded-2xl p-3 flex-row items-center justify-center gap-2 shadow-sm active:scale-95 border border-outline-variant/30"
            >
              <MaterialIcons name="payments" size={20} color="#012d1d" />
              <Text className="font-label-md text-label-md text-on-surface">Payment</Text>
            </Pressable>
          </View>

          {/* Recent Orders */}
          <View className="flex-row items-center justify-between mt-4">
            <Text className="font-headline-sm text-headline-sm text-on-surface">Recent Orders</Text>
            <Pressable onPress={() => navigation.navigate("Orders")}>
              <Text className="font-label-md text-label-md text-primary px-2 py-1">View All</Text>
            </Pressable>
          </View>

          {orders.slice(0, 3).map((order) => (
            <View key={order.id} className="bg-surface-container-lowest shadow-sm border border-outline-variant/30 rounded-2xl p-4 mt-2">
              <View className="flex-row justify-between items-start mb-3">
                <View>
                  <Text className="font-headline-sm text-headline-sm text-on-surface">{order.shop_name || order.retailer_name}</Text>
                  <Text className="font-body-md text-body-md text-on-surface-variant">Order #{order.id.slice(0, 5)}</Text>
                </View>
                <View className="bg-surface-variant rounded-full px-3 py-1">
                  <Text className="font-label-md text-label-md text-on-surface-variant">{order.status}</Text>
                </View>
              </View>
              <View className="h-[1px] bg-surface-variant w-full mb-3" />
              <View className="flex-row justify-between items-center">
                <View className="flex-row items-center gap-1">
                  <MaterialIcons name="scale" size={20} color="#414844" />
                  <Text className="font-body-md text-body-md text-on-surface">{order.requested_kg} KG</Text>
                </View>
                <Pressable className="px-3 py-1 bg-surface-container rounded-full">
                  <Text className="font-label-md text-label-md text-primary">Details</Text>
                </Pressable>
              </View>
            </View>
          ))}

          {orders.length === 0 && (
             <View className="bg-surface-container-lowest p-6 rounded-2xl mt-2 items-center justify-center border border-outline-variant/30">
                <Text className="text-on-surface-variant font-body-md">No orders today yet.</Text>
             </View>
          )}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
