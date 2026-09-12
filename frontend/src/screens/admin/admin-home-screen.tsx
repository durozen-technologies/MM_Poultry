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

 const deliveredBoxes = useMemo(() => {
 return orders.filter(o => o.status === "FULFILLED")
 .reduce((sum, o) => sum + (o.items || []).reduce((s, it) => s + (it.total_boxes || 0), 0), 0);
 }, [orders]);
 const pendingBoxes = Math.max(0, orderedBoxes - deliveredBoxes);

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
 className="w-10 h-10 flex items-center justify-center rounded-md border border-[#e5e7eb] bg-white active:bg-[#f7f8fa]"
 onPress={refresh}
 >
 <MaterialIcons name="refresh" size={20} className="text-[#202124]" />
 </Pressable>
 <Pressable
 accessibilityRole="button"
 accessibilityLabel="Log out"
 accessibilityHint="Sign out of Trader's Hub"
 className="w-10 h-10 flex items-center justify-center rounded-md border border-[#e5e7eb] bg-white active:bg-red-50"
 onPress={logout}
 >
 <MaterialIcons name="logout" size={18} className="text-red-500" />
 </Pressable>
 </View>
 }
 />
 }
 refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} />}
 >
 {isInitialLoading && orders.length === 0 && !dashboard ? (
 <View className="flex-1 items-center justify-center py-16" accessibilityRole="progressbar" accessibilityLabel="Loading dashboard">
 <ActivityIndicator size="large" color="#2E7D32" />
 <Text className="text-[#5f6368] mt-3">Loading today's business…</Text>
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
 <Text className="font-sans text-[#111111] text-xl font-bold ml-1 mb-3 tracking-tight">Today's Overview</Text>
 <View className="flex-row flex-wrap justify-between gap-y-3">
 <MetricCard icon="shopping-cart" label="Orders today" value={dashboard?.order_count || 0} valueColor="text-[#2E7D32]" />
 <MetricCard icon="inventory-2" label="Boxes ordered" value={orderedBoxes} valueColor="text-[#2E7D32]" />
 <MetricCard icon="local-shipping" label="Delivered (kg)" value={deliveredKg} />
 <MetricCard icon="pending-actions" label="Pending Boxes" value={pendingBoxes} />
 </View>
 </View>

 {/* Sales Card */}
 <View className="bg-[#dcfce7] rounded-xl p-6">
 <View className="flex-row justify-between items-end mb-4">
 <View>
 <Text className="font-sans text-[13px] text-[#2E7D32] uppercase font-bold tracking-[2px] mb-1">Today's Sales</Text>
 <Text className="font-sans text-[#2E7D32] text-5xl font-black tracking-tighter -ml-1">₹{totalSales.toLocaleString("en-IN")}</Text>
 </View>
 <MaterialIcons name="trending-up" size={56} className="text-[#2E7D32] mb-1" />
 </View>

 <View className="h-[1px] w-full bg-[#2E7D32] opacity-40 my-3" />

 <View className="flex-row items-center pt-2 pb-1">
 <View className="flex-1">
 <Text className="font-sans text-[12px] text-[#2E7D32] uppercase font-bold tracking-[2px] mb-1">Collection</Text>
 <Text className="font-sans text-[#2E7D32] text-2xl font-bold tracking-tight">₹{collection.toLocaleString("en-IN")}</Text>
 </View>
 <View className="w-[1px] h-10 bg-[#2E7D32] opacity-40 mx-4" />
 <View className="flex-1 items-end">
 <Text className="font-sans text-[12px] text-[#2E7D32] uppercase font-bold tracking-[2px] mb-1">Outstanding</Text>
 <Text className="font-sans text-[#2E7D32] text-2xl font-bold tracking-tight">₹{outstanding.toLocaleString("en-IN")}</Text>
 </View>
 </View>
 </View>



 {/* Quick Actions */}
 <View>
 <Text className="font-sans text-[#111111] text-xl font-bold ml-1 mb-3 tracking-tight">Quick Actions</Text>
 <View className="flex-row flex-wrap justify-between gap-y-3">
 {[
 { icon: "person-add", label: "Add Retailer", route: "AddRetailer", color: "text-[#202124]", bg: "bg-white", border: "border border-[#e5e7eb]", textColor: "text-[#111111]" },
 { icon: "add-shopping-cart", label: "Add Order", route: "Orders", color: "text-white", bg: "bg-[#2E7D32]", border: "border border-[#2E7D32]", textColor: "text-white" },
 { icon: "rv-hookup", label: "Start Loading", route: "FarmPurchase", color: "text-[#202124]", bg: "bg-white", border: "border border-[#e5e7eb]", textColor: "text-[#111111]" },
 { icon: "payments", label: "Payment", route: "Retailers", color: "text-[#202124]", bg: "bg-white", border: "border border-[#e5e7eb]", textColor: "text-[#111111]" },
 ].map((action, idx) => (
 <Pressable
 key={idx}
 accessibilityRole="button"
 accessibilityLabel={action.label}
 className={`w-[48%] min-h-[96px] ${action.bg} rounded-md p-4 flex-col items-start justify-center gap-2 ${action.border} active:opacity-80 `}
 onPress={() => navigation.navigate(action.route)}
 >
 <MaterialIcons name={action.icon as any} size={20} className={action.color} />
 <Text className={`font-sans ${action.textColor} text-sm font-bold`}>{action.label}</Text>
 </Pressable>
 ))}
 <Pressable
 accessibilityRole="button"
 accessibilityLabel="Log expenses"
 className="w-full bg-white rounded-md p-4 min-h-[56px] flex-row items-center justify-center gap-2 border border-[#e5e7eb] active:opacity-80 mt-1"
 onPress={() => navigation.navigate("Expenses")}
 >
 <MaterialIcons name="receipt" size={18} className="text-[#202124]" />
 <Text className="font-sans text-[#111111] text-sm font-bold">Log Expenses</Text>
 </Pressable>
 </View>
 </View>

 {/* Recent Orders */}
 <View className="mb-4">
 <View className="flex-row items-center justify-between ml-1 mb-3">
 <Text className="font-sans text-[#111111] text-xl font-bold tracking-tight">Recent Orders</Text>
 <Pressable accessibilityRole="button" accessibilityLabel="View all orders" onPress={() => navigation.navigate("Orders")} className="min-h-[44px] min-w-[44px] justify-center px-2 active:opacity-70">
 <Text className="font-sans text-[#2E7D32] text-sm font-bold">View All</Text>
 </Pressable>
 </View>

 {recentOrders.map(({ order, totalKg, totalBoxes }) => (
 <Pressable
 key={order.id}
 accessibilityRole="button"
 accessibilityLabel={`Order ${order.order_number || order.id.slice(0, 5)} for ${order.shop_name || order.retailer_name}, ${totalKg} kilograms, status ${formatStatus(order.status)}`}
 className="bg-white border border-[#e5e7eb] rounded-lg p-5 mb-3 active:bg-[#f7f8fa]"
 onPress={() => navigation.navigate("OrderDetail", { order })}
 >
 <View className="flex-row justify-between items-start mb-4">
 <View className="flex-1 pr-4">
 <Text className="font-sans text-[#111111] text-base font-bold" numberOfLines={1}>{order.shop_name || order.retailer_name}</Text>
 <Text className="font-mono text-[#5f6368] text-xs mt-1">Order {order.order_number || `#${order.id.slice(0, 5)}`}</Text>
 </View>
 <View className="bg-[#f7f8fa] rounded-full px-3 py-1 min-h-[26px] justify-center border border-[#e5e7eb]">
 <Text className="font-mono text-[10px] uppercase tracking-[1px] text-[#202124] font-bold">{formatStatus(order.status)}</Text>
 </View>
 </View>

 <View className="flex-row justify-between items-center bg-[#f7f8fa] rounded-md p-3 mt-4 border border-[#e5e7eb]">
 <View className="flex-row items-center gap-2">
 <MaterialIcons name="scale" size={16} className="text-[#202124]" />
 <Text className="font-mono text-[#111111] text-sm font-bold">
 {totalKg || '-'} kg
 <Text className="font-sans text-[#5f6368] text-xs font-normal"> ({totalBoxes || 0} boxes)</Text>
 </Text>
 </View>
 <MaterialIcons name="chevron-right" size={20} className="text-[#202124]" />
 </View>
 </Pressable>
 ))}

 {orders.length === 0 && !isInitialLoading && (
 <View className="bg-[#f7f8fa] py-10 px-6 rounded-lg items-center justify-center border border-[#e5e7eb]">
 <MaterialIcons name="inbox" size={32} className="text-[#a0a5ab] mb-3" />
 <Text className="text-[#111111] font-bold text-lg mb-1">No orders today yet</Text>
 <Text className="text-[#5f6368] text-sm text-center mb-5">New retailer orders will appear here.</Text>
 <Pressable accessibilityRole="button" accessibilityLabel="Go to orders" onPress={() => navigation.navigate("Orders")} className="bg-[#2E7D32] rounded-md px-6 py-3 min-h-[44px] justify-center active:opacity-80">
 <Text className="text-white font-bold text-sm">View orders</Text>
 </Pressable>
 </View>
 )}
 </View>

 </View>
 )}
 </AdminScreenContainer>
 );
}
