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
import { useAuthStore } from "../../store/auth-store";
import { useAdminTodayOrders, useAdminDashboard } from "../../hooks/use-queries";
import { toApiDate, todayIstDate } from "../../utils/ist-date";
import { MetricCard } from "./components/metric-card";
import { AdminScreenContainer } from "../../components/admin/admin-screen-container";
import { AdminHeader } from "../../components/admin/admin-header";
import { AdminCard } from "../../components/admin/admin-card";

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
  const orderedBoxes = dashboard?.ordered_boxes || 0;
  const deliveredKg = dashboard?.delivered_kg || "0";
  const totalSales = Number(dashboard?.total_sales || 0);
  const collection = Number(dashboard?.total_collection || 0);
  const outstanding = Number(dashboard?.outstanding || 0);
  const loadedKg = Number(dashboard?.loaded_kg || 0);
  const lossKg = Number(dashboard?.loss_kg || 0);
  const lossPercent = dashboard?.loss_pct || "0";

  return (
    <AdminScreenContainer
      header={
        <AdminHeader 
          title="Dashboard" 
          subtitle="Overview of today's business"
          showBackButton={false}
          rightContent={
            <View className="flex-row items-center gap-3">
              <Pressable
                accessibilityRole="button"
                className="w-11 h-11 flex items-center justify-center rounded-full bg-white/20 active:bg-white/30"
                onPress={refresh}
              >
                <MaterialIcons name="refresh" size={24} color="white" />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                className="w-11 h-11 flex items-center justify-center rounded-full bg-error-container active:bg-error-container/80"
                onPress={logout}
              >
                <MaterialIcons name="logout" size={22} className="text-error" />
              </Pressable>
            </View>
          }
        />
      }
      refreshControl={<RefreshControl refreshing={busy} onRefresh={refresh} />}
    >
      <View className="flex-col gap-6">
        {errorMsg && (
          <View className="bg-error-container/90 px-4 py-3 rounded-xl flex-row items-center">
            <MaterialIcons name="error-outline" size={20} className="text-on-error-container mr-2" />
            <Text className="text-on-error-container text-body-sm font-medium flex-1">{errorMsg}</Text>
          </View>
        )}

        <View>
          <Text className="font-title-lg text-on-surface font-bold ml-1 mb-3">Today's Overview</Text>
          <View className="flex-row flex-wrap justify-between gap-y-3">
            <MetricCard icon="shopping-cart" label="Today's Orders" value={dashboard?.order_count || 0} valueColor="text-primary" />
            <MetricCard icon="inventory-2" label="Total Ordered" value={orderedBoxes} valueColor="text-primary" />
            <MetricCard icon="local-shipping" label="Delivered KG" value={deliveredKg} />
            <MetricCard icon="pending-actions" label="Pending KG" value={pendingKg} />
          </View>
        </View>

        {/* Sales Card */}
        <View className="bg-primary rounded-3xl p-6 shadow-sm overflow-hidden relative">
          <View className="absolute -right-8 -top-8 w-40 h-40 bg-white/10 rounded-full" />
          <View className="absolute -left-12 -bottom-12 w-32 h-32 bg-white/5 rounded-full" />
          
          <Text className="font-label-lg text-primary-fixed uppercase font-bold tracking-wider mb-2">Today's Sales</Text>
          <Text className="font-display-lg text-white font-bold">₹{totalSales.toLocaleString("en-IN")}</Text>
          
          <View className="flex-row justify-between mt-6 z-10">
            <View>
              <Text className="font-label-md text-primary-fixed-dim mb-1">Collection</Text>
              <Text className="font-title-lg text-white font-bold">₹{collection.toLocaleString("en-IN")}</Text>
            </View>
            <View className="items-end">
              <Text className="font-label-md text-primary-fixed-dim mb-1">Outstanding</Text>
              <Text className="font-title-lg text-white font-bold">₹{outstanding.toLocaleString("en-IN")}</Text>
            </View>
          </View>
        </View>

        {/* Farm Metrics Card */}
        <AdminCard title="Farm Metrics" icon="agriculture" iconColorClass="text-tertiary" iconBgClass="bg-tertiary/10">
          <View className="flex-row justify-between items-end mb-4">
            <View>
              <Text className="font-label-md text-on-surface-variant font-medium mb-1">Loaded Weight</Text>
              <Text className="font-headline-sm text-on-surface font-bold">{loadedKg} KG</Text>
            </View>
            <View className="items-end">
              <Text className="font-label-md text-on-surface-variant font-medium mb-1">Weight Loss</Text>
              <Text className="font-headline-sm text-error font-bold">{lossKg} KG</Text>
            </View>
          </View>
          <View className="w-full bg-surface-container-highest h-3 rounded-full overflow-hidden mb-3 border border-outline-variant/20">
            <View className="bg-error h-full rounded-full" style={{ width: `${Math.min(100, Number(lossPercent))}%` }} />
          </View>
          <View className="flex-row justify-between items-center">
            <Text className="font-label-md text-on-surface-variant font-medium">Industry Avg: 2.5%</Text>
            <Text className="font-label-md text-error font-bold">{lossPercent}% Loss</Text>
          </View>
        </AdminCard>

        {/* Quick Actions */}
        <View>
          <Text className="font-title-lg text-on-surface font-bold ml-1 mb-3">Quick Actions</Text>
          <View className="flex-row flex-wrap justify-between gap-y-3">
            {[
              { icon: "person-add", label: "Add Retailer", route: "AddRetailer", color: "text-secondary" },
              { icon: "add-shopping-cart", label: "Add Order", route: "Orders", color: "text-primary" },
              { icon: "rv-hookup", label: "Start Loading", route: "FarmPurchase", color: "text-tertiary" },
              { icon: "payments", label: "Payment", route: "Retailers", color: "text-secondary" },
            ].map((action, idx) => (
              <Pressable
                key={idx}
                accessibilityRole="button"
                className="w-[48%] bg-surface-container-lowest rounded-2xl p-4 flex-col items-center justify-center gap-2 border border-outline-variant/30 active:scale-95 shadow-sm"
                onPress={() => navigation.navigate(action.route)}
              >
                <View className={`w-10 h-10 rounded-full ${action.color === 'text-primary' ? 'bg-primary/10' : action.color === 'text-secondary' ? 'bg-secondary/10' : 'bg-tertiary/10'} items-center justify-center`}>
                  <MaterialIcons name={action.icon as any} size={20} className={action.color} />
                </View>
                <Text className="font-label-md text-on-surface font-semibold text-center">{action.label}</Text>
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              className="w-full bg-surface-container-lowest rounded-2xl p-4 flex-row items-center justify-center gap-3 border border-outline-variant/30 active:scale-95 shadow-sm mt-1"
              onPress={() => navigation.navigate("Expenses")}
            >
              <View className="w-10 h-10 rounded-full bg-error/10 items-center justify-center">
                <MaterialIcons name="receipt" size={20} className="text-error" />
              </View>
              <Text className="font-label-md text-on-surface font-semibold">Log Expenses</Text>
            </Pressable>
          </View>
        </View>

        {/* Recent Orders */}
        <View className="mb-4">
          <View className="flex-row items-center justify-between ml-1 mb-3">
            <Text className="font-title-lg text-on-surface font-bold">Recent Orders</Text>
            <Pressable accessibilityRole="button" onPress={() => navigation.navigate("Orders")}>
              <Text className="font-label-md text-primary font-bold">View All</Text>
            </Pressable>
          </View>

          {orders.slice(0, 3).map((order) => (
            <Pressable
              key={order.id}
              className="bg-surface-container-lowest shadow-sm border border-outline-variant/30 rounded-2xl p-5 mb-3 active:scale-[0.98] transition-transform"
              onPress={() => navigation.navigate("OrderDetail", { order })}
            >
              <View className="flex-row justify-between items-start mb-4">
                <View className="flex-1 pr-4">
                  <Text className="font-title-md text-on-surface font-bold" numberOfLines={1}>{order.shop_name || order.retailer_name}</Text>
                  <Text className="font-body-sm text-on-surface-variant mt-0.5 font-medium">Order {order.order_number || `#${order.id.slice(0, 5)}`}</Text>
                </View>
                <View className="bg-surface-variant/50 rounded-full px-3 py-1">
                  <Text className="font-label-sm text-on-surface font-semibold">{order.status}</Text>
                </View>
              </View>
              
              <View className="flex-row justify-between items-center bg-surface-container-highest rounded-xl p-3">
                <View className="flex-row items-center gap-2">
                  <MaterialIcons name="scale" size={20} className="text-primary" />
                  <Text className="font-label-md text-on-surface font-semibold">
                    {order.items?.reduce((s, it) => s + Number(it.requested_kg || 0), 0) || '-'} KG
                    <Text className="text-on-surface-variant font-normal"> ({order.items?.reduce((s, it) => s + (it.total_boxes || 0), 0) || 0} Boxes)</Text>
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} className="text-on-surface-variant" />
              </View>
            </Pressable>
          ))}

          {orders.length === 0 && (
            <View className="bg-surface-container-lowest py-8 rounded-2xl items-center justify-center border border-outline-variant/30">
              <MaterialIcons name="inbox" size={48} className="text-on-surface-variant/50 mb-2" />
              <Text className="text-on-surface-variant font-body-lg">No orders today yet.</Text>
            </View>
          )}
        </View>

      </View>
    </AdminScreenContainer>
  );
}
