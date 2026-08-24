import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  Text,
  View,
  ScrollView,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "../../store/auth-store";
import { useAdminTodayOrders, useAdminDashboard } from "../../hooks/use-queries";
import { toApiDate, todayIstDate } from "../../utils/ist-date";

export function AdminHomeScreen({ navigation }: { navigation: any }) {
  const logout = useAuthStore((s) => s.logout);
  const [reportDate] = useState(todayIstDate());

  const { data: todayOrders, isLoading: isLoadingOrders, isRefetching: isRefetchingOrders, refetch: refetchOrders, error: errorOrders } = useAdminTodayOrders();
  const { data: dashboard, isLoading: isLoadingDashboard, isRefetching: isRefetchingDashboard, refetch: refetchDashboard, error: errorDashboard } = useAdminDashboard(toApiDate(reportDate));

  const orders = todayOrders?.items || [];
  const busy = isLoadingOrders || isLoadingDashboard || isRefetchingOrders || isRefetchingDashboard;
  const errorMsg = errorOrders ? errorOrders.message : (errorDashboard ? errorDashboard.message : null);

  function refresh() {
    refetchOrders();
    refetchDashboard();
  }

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
    <SafeAreaView className="flex-1 max-w-3xl mx-auto w-full bg-background" edges={["top"]}>
      {/* Header */}
      <View className="h-16 px-4 flex-row items-center justify-between bg-surface/80">
        <Text className="font-headline-sm text-headline-sm text-on-surface">Dashboard</Text>
        <View className="flex-row items-center gap-3">
          <Pressable accessibilityRole="button" accessibilityLabel="Button"
            className="w-11 h-11 flex items-center justify-center rounded-full active:bg-surface-variant/50"
            onPress={refresh}
          >
            <MaterialIcons name="refresh" size={24} className="text-on-surface" />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Button"
            className="w-11 h-11 flex items-center justify-center rounded-full active:bg-surface-variant/50"
            onPress={logout}
          >
            <MaterialIcons name="logout" size={24} className="text-on-surface" />
          </Pressable>
        </View>
      </View>

      <ScrollView
        className="flex-1 w-full"
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={busy} onRefresh={refresh} />}
      >
        {errorMsg && (
          <View className="px-4 py-2 mb-4 bg-error-container mx-4 rounded-lg">
            <Text className="text-error text-center text-label-md">{errorMsg}</Text>
          </View>
        )}

        <View className="px-4 flex-col gap-4">
          
          {/* Today's Overview Section */}
          <Text className="font-headline-sm text-headline-sm text-on-surface mt-2">Today's Overview</Text>
          <View className="flex-row flex-wrap justify-between gap-y-3">
            <View className="w-[48%] bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant/30">
              <View className="flex-row items-center gap-2 mb-2">
                <MaterialIcons name="shopping-cart" size={18} className="text-on-surface" />
                <Text className="font-label-md text-label-md text-on-surface-variant">Today's Orders</Text>
              </View>
              <Text className="font-display-lg text-display-lg text-primary">{dashboard?.order_count || 0}</Text>
            </View>
            <View className="w-[48%] bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant/30">
              <View className="flex-row items-center gap-2 mb-2">
                <MaterialIcons name="scale" size={18} className="text-on-surface" />
                <Text className="font-label-md text-label-md text-on-surface-variant">Total Ordered</Text>
              </View>
              <Text className="font-display-lg text-display-lg text-primary">{orderedKg}</Text>
            </View>
            <View className="w-[48%] bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant/30">
              <View className="flex-row items-center gap-2 mb-2">
                <MaterialIcons name="local-shipping" size={18} className="text-on-surface" />
                <Text className="font-label-md text-label-md text-on-surface-variant">Delivered KG</Text>
              </View>
              <Text className="font-display-lg text-display-lg text-on-surface">{deliveredKg}</Text>
            </View>
            <View className="w-[48%] bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant/30">
              <View className="flex-row items-center gap-2 mb-2">
                <MaterialIcons name="pending-actions" size={18} className="text-on-surface" />
                <Text className="font-label-md text-label-md text-on-surface-variant">Pending KG</Text>
              </View>
              <Text className="font-display-lg text-display-lg text-on-surface">{pendingKg}</Text>
            </View>
          </View>

          {/* Today's Sales */}
          <View className="bg-primary-container rounded-2xl p-4 mt-2 shadow-sm overflow-hidden relative">
            <View className="absolute -right-8 -top-8 w-32 h-32 bg-primary rounded-full opacity-20" />
            <Text className="font-label-md text-label-md text-on-primary-container">Today's Sales</Text>
            <Text className="font-display-lg text-display-lg text-on-primary">₹{totalSales.toLocaleString("en-IN")}</Text>
            
            <View className="flex-row justify-between mt-4 z-10">
              <View>
                <Text className="font-label-md text-label-md text-on-primary-container">Collection</Text>
                <Text className="font-headline-sm text-headline-sm text-on-primary">₹{collection.toLocaleString("en-IN")}</Text>
              </View>
              <View>
                <Text className="font-label-md text-label-md text-on-primary-container">Outstanding</Text>
                <Text className="font-headline-sm text-headline-sm text-on-primary">₹{outstanding.toLocaleString("en-IN")}</Text>
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
            <Pressable accessibilityRole="button" accessibilityLabel="Button" 
              className="w-[48%] bg-surface-container-lowest rounded-2xl p-3 flex-row items-center justify-center gap-2 shadow-sm active:scale-95 border border-outline-variant/30"
              onPress={() => navigation.navigate("AddRetailer")}
            >
              <MaterialIcons name="person-add" size={20} className="text-primary" />
              <Text className="font-label-md text-label-md text-on-surface">Add Retailer</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Button" 
              className="w-[48%] bg-surface-container-lowest rounded-2xl p-3 flex-row items-center justify-center gap-2 shadow-sm active:scale-95 border border-outline-variant/30"
              onPress={() => navigation.navigate("Orders")}
            >
              <MaterialIcons name="add-shopping-cart" size={20} className="text-primary" />
              <Text className="font-label-md text-label-md text-on-surface">Add Order</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Button" 
              className="w-[48%] bg-surface-container-lowest rounded-2xl p-3 flex-row items-center justify-center gap-2 shadow-sm active:scale-95 border border-outline-variant/30"
              onPress={() => navigation.navigate("FarmPurchase")}
            >
              <MaterialIcons name="rv-hookup" size={20} className="text-primary" />
              <Text className="font-label-md text-label-md text-on-surface">Start Loading</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Button" 
              className="w-[48%] bg-surface-container-lowest rounded-2xl p-3 flex-row items-center justify-center gap-2 shadow-sm active:scale-95 border border-outline-variant/30"
              onPress={() => navigation.navigate("Retailers")}
            >
              <MaterialIcons name="payments" size={20} className="text-primary" />
              <Text className="font-label-md text-label-md text-on-surface">Payment</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Button" 
              className="w-[48%] bg-surface-container-lowest rounded-2xl p-3 flex-row items-center justify-center gap-2 shadow-sm active:scale-95 border border-outline-variant/30 mt-3"
              onPress={() => navigation.navigate("Expenses")}
            >
              <MaterialIcons name="receipt" size={20} className="text-primary" />
              <Text className="font-label-md text-label-md text-on-surface">Expenses</Text>
            </Pressable>
          </View>

          {/* Recent Orders */}
          <View className="flex-row items-center justify-between mt-4">
            <Text className="font-headline-sm text-headline-sm text-on-surface">Recent Orders</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Button" onPress={() => navigation.navigate("Orders")}>
              <Text className="font-label-md text-label-md text-primary px-2 py-1">View All</Text>
            </Pressable>
          </View>

          {orders.slice(0, 3).map((order) => (
            <View key={order.id} className="bg-surface-container-lowest shadow-sm border border-outline-variant/30 rounded-2xl p-4 mt-2">
              <View className="flex-row justify-between items-start mb-3">
                <View>
                  <Text className="font-headline-sm text-headline-sm text-on-surface">{order.shop_name || order.retailer_name}</Text>
                  <Text className="font-body-md text-body-md text-on-surface-variant">Order {order.order_number || `#${order.id.slice(0, 5)}`}</Text>
                </View>
                <View className="bg-surface-variant rounded-full px-3 py-1">
                  <Text className="font-label-md text-label-md text-on-surface-variant">{order.status}</Text>
                </View>
              </View>
              <View className="h-[1px] bg-surface-variant w-full mb-3" />
              <View className="flex-row justify-between items-center">
                <View className="flex-row items-center gap-1">
                  <MaterialIcons name="scale" size={20} className="text-on-surface" />
                  <Text className="font-body-md text-body-md text-on-surface">{order.requested_kg} KG</Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="Button"
                  className="px-3 py-1 bg-surface-container rounded-full"
                  onPress={() => navigation.navigate("OrderDetail", { order })}
                >
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
