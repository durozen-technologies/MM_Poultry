import { useMemo, useState } from "react";
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
  const isRefreshing = isRefetchingOrders || isRefetchingDashboard;
  const isInitialLoading = isLoadingOrders || isLoadingDashboard;
  const errorMsg = errorOrders ? errorOrders.message : (errorDashboard ? errorDashboard.message : null);

  const recentOrders = useMemo(() => {
    return orders.slice(0, 3).map((order) => {
      const items = order.items || [];
      const totalKg = items.reduce((s, it) => s + Number(it.requested_kg || 0), 0);
      const totalBoxes = items.reduce((s, it) => s + (it.total_boxes || 0), 0);
      return { order, totalKg, totalBoxes };
    });
  }, [orders]);

  function formatStatus(status: string) {
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase().replace(/_/g, " ");
  }

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
                accessibilityLabel="Refresh dashboard"
                accessibilityHint="Reload today's orders and sales"
                className="w-12 h-12 flex items-center justify-center rounded-full bg-surface-container-highest active:opacity-70"
                onPress={refresh}
              >
                <MaterialIcons name="refresh" size={24} className="text-on-surface" />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Log out"
                accessibilityHint="Sign out of Trader's Hub"
                className="w-12 h-12 flex items-center justify-center rounded-full bg-error-container active:opacity-70"
                onPress={logout}
              >
                <MaterialIcons name="logout" size={22} className="text-error" />
              </Pressable>
            </View>
          }
        />
      }
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} />}
    >
      {isInitialLoading && orders.length === 0 && !dashboard ? (
        <View className="flex-1 items-center justify-center py-16" accessibilityRole="progressbar" accessibilityLabel="Loading dashboard">
          <ActivityIndicator size="large" />
          <Text className="text-on-surface-variant mt-3">Loading today's business…</Text>
        </View>
      ) : (
      <View className="flex-col gap-6">
        {errorMsg && (
          <View accessibilityRole="alert" accessibilityLiveRegion="polite" className="bg-error-container/90 px-4 py-3 rounded-xl flex-row items-center">
            <MaterialIcons name="error-outline" size={20} className="text-on-error-container mr-2" />
            <Text className="text-on-error-container text-body-sm font-medium flex-1">Couldn't load dashboard. Pull down to try again.</Text>
          </View>
        )}

        <View>
          <Text className="font-title-lg text-on-surface font-bold ml-1 mb-3">Today's Overview</Text>
          <View className="flex-row flex-wrap justify-between gap-y-3">
            <MetricCard icon="shopping-cart" label="Orders today" value={dashboard?.order_count || 0} valueColor="text-primary" />
            <MetricCard icon="inventory-2" label="Boxes ordered" value={orderedBoxes} valueColor="text-primary" />
            <MetricCard icon="local-shipping" label="Delivered (kg)" value={deliveredKg} />
            <MetricCard icon="pending-actions" label="Pending (kg)" value={pendingKg} />
          </View>
        </View>

        {/* Sales Card */}
        <View className="bg-primary rounded-3xl p-6 shadow-sm">
          
          <Text className="font-label-lg text-primary-fixed uppercase font-bold tracking-wider mb-2">Today's Sales</Text>
          <Text className="font-display-lg text-white font-bold">₹{totalSales.toLocaleString("en-IN")}</Text>
          
          <View className="flex-row justify-between mt-6">
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
                accessibilityLabel={action.label}
                className="w-[48%] min-h-[96px] bg-surface-container-lowest rounded-2xl p-4 flex-col items-center justify-center gap-2 border border-outline-variant/30 active:opacity-80 shadow-sm"
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
              accessibilityLabel="Log expenses"
              className="w-full bg-surface-container-lowest rounded-2xl p-4 min-h-[64px] flex-row items-center justify-center gap-3 border border-outline-variant/30 active:opacity-80 shadow-sm mt-1"
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
            <Pressable accessibilityRole="button" accessibilityLabel="View all orders" onPress={() => navigation.navigate("Orders")} className="min-h-[44px] min-w-[44px] justify-center px-2 active:opacity-70">
              <Text className="font-label-md text-primary font-bold">View All</Text>
            </Pressable>
          </View>

          {recentOrders.map(({ order, totalKg, totalBoxes }) => (
            <Pressable
              key={order.id}
              accessibilityRole="button"
              accessibilityLabel={`Order ${order.order_number || order.id.slice(0, 5)} for ${order.shop_name || order.retailer_name}, ${totalKg} kilograms, status ${formatStatus(order.status)}`}
              className="bg-surface-container-lowest shadow-sm border border-outline-variant/30 rounded-2xl p-5 mb-3 active:opacity-80"
              onPress={() => navigation.navigate("OrderDetail", { order })}
            >
              <View className="flex-row justify-between items-start mb-4">
                <View className="flex-1 pr-4">
                  <Text className="font-title-md text-on-surface font-bold" numberOfLines={1}>{order.shop_name || order.retailer_name}</Text>
                  <Text className="font-body-sm text-on-surface-variant mt-0.5 font-medium">Order {order.order_number || `#${order.id.slice(0, 5)}`}</Text>
                </View>
                <View className="bg-surface-variant/50 rounded-full px-3 py-1 min-h-[28px] justify-center">
                  <Text className="font-label-sm text-on-surface font-semibold">{formatStatus(order.status)}</Text>
                </View>
              </View>
              
              <View className="flex-row justify-between items-center bg-surface-container-highest rounded-xl p-3">
                <View className="flex-row items-center gap-2">
                  <MaterialIcons name="scale" size={20} className="text-primary" />
                  <Text className="font-label-md text-on-surface font-semibold">
                    {totalKg || '-'} kg
                    <Text className="text-on-surface-variant font-normal"> ({totalBoxes || 0} boxes)</Text>
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} className="text-on-surface-variant" />
              </View>
            </Pressable>
          ))}

          {orders.length === 0 && !isInitialLoading && (
            <View className="bg-surface-container-lowest py-8 px-6 rounded-2xl items-center justify-center border border-outline-variant/30">
              <MaterialIcons name="inbox" size={48} className="text-on-surface-variant/50 mb-2" />
              <Text className="text-on-surface font-semibold font-body-lg text-center">No orders today yet</Text>
              <Text className="text-on-surface-variant font-body-sm text-center mt-1 mb-4">New retailer orders will appear here.</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Go to orders" onPress={() => navigation.navigate("Orders")} className="bg-primary rounded-full px-6 min-h-[48px] justify-center active:opacity-80">
                <Text className="text-white font-bold">View orders</Text>
              </Pressable>
            </View>
          )}
        </View>

      </View>
      )}
    </AdminScreenContainer>
  );
}
