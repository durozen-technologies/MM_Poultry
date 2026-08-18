import { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
  ScrollView,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../api/client";
import type { DailyOrderOut, OrderStatus } from "../../types/api";



export function AdminOrdersScreen({ navigation }: { navigation: any }) {
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<DailyOrderOut[]>([]);
  const [totalKg, setTotalKg] = useState("0");
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"All" | OrderStatus>("All");
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/orders/today");
      setOrders(data.items);
      setTotalKg(data.total_requested_kg);
    } catch (e) {
      console.warn("Failed to fetch orders", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const filteredOrders = orders.filter((o) => {
    if (searchQuery && !(o.shop_name?.toLowerCase().includes(searchQuery.toLowerCase()) || o.retailer_name?.toLowerCase().includes(searchQuery.toLowerCase()))) return false;
    if (filter !== "All" && o.status !== filter) return false;
    return true;
  });

  const pendingCount = orders.filter((o) => o.status === "PENDING").length;
  const confirmedCount = orders.filter((o) => o.status === "CONFIRMED").length;

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case "PENDING": return { bg: "bg-error-container", text: "text-on-error-container", icon: "pending-actions" };
      case "CONFIRMED": return { bg: "bg-primary-fixed", text: "text-on-primary-fixed", icon: "check-circle" };
      case "DISPATCHED": return { bg: "bg-tertiary-fixed", text: "text-on-tertiary-fixed-variant", icon: "local-shipping" };
      case "DELIVERED": return { bg: "bg-surface-variant", text: "text-on-surface-variant", icon: "done-all" };
      case "CANCELLED": return { bg: "bg-error", text: "text-on-error", icon: "cancel" };
      default: return { bg: "bg-surface-variant", text: "text-on-surface-variant", icon: "help" };
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      {/* Header */}
      <View className="h-16 px-4 flex-row items-center justify-between bg-surface/90 z-20">
        <Text className="font-headline-sm text-headline-sm text-on-surface font-semibold">
          Orders
        </Text>
        <Pressable
          className="w-11 h-11 flex items-center justify-center rounded-full active:bg-surface-container"
          onPress={refresh}
        >
          <MaterialIcons name="refresh" size={24} color="#181c20" />
        </Pressable>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Search & Top Actions */}
        <View className="px-4 pt-3 flex-row items-center gap-3">
          <View className="flex-1 h-12 bg-surface-container-high rounded-full flex-row items-center px-4 shadow-sm">
            <MaterialIcons name="search" size={20} color="#414844" />
            <TextInput
              className="flex-1 h-full pl-2 font-body-md text-on-surface"
              placeholder="Search orders..."
              placeholderTextColor="#717973"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <Pressable className="w-12 h-12 rounded-full bg-surface-container-high shadow-sm flex items-center justify-center active:bg-surface-container">
            <MaterialIcons name="tune" size={20} color="#181c20" />
          </Pressable>
        </View>

        {/* KPI Summary Cards */}
        <View className="px-4 pt-4 flex-row flex-wrap justify-between gap-y-3">
          {/* Big Stat 1 */}
          <View className="w-[48%] bg-primary rounded-xl p-4 shadow-md flex-col justify-between">
            <Text className="font-body-md text-body-md text-on-primary opacity-90 font-semibold">Today's Orders</Text>
            <Text className="font-display-lg text-display-lg text-on-primary mt-1 font-bold">{orders.length}</Text>
          </View>
          {/* Big Stat 2 */}
          <View className="w-[48%] bg-primary-container rounded-xl p-4 shadow-sm flex-col justify-between">
            <Text className="font-body-md text-body-md text-on-primary-container opacity-90 font-semibold">Total Ordered</Text>
            <Text className="font-headline-md text-headline-md-mobile text-on-primary-container mt-1 font-bold truncate">
              {Number(totalKg).toFixed(0)} <Text className="font-body-md font-normal opacity-80">KG</Text>
            </Text>
          </View>
          {/* Small Stat 1 */}
          <View className="w-[48%] bg-surface-container rounded-xl p-3 shadow-sm flex-row items-center gap-3">
            <View className="w-8 h-8 rounded-full bg-error-container flex items-center justify-center">
              <MaterialIcons name="pending-actions" size={18} color="#93000a" />
            </View>
            <View className="flex-col flex-1">
              <Text className="font-headline-sm text-headline-sm text-on-surface font-bold leading-tight">{pendingCount}</Text>
              <Text className="font-label-md text-label-md text-on-surface-variant truncate font-semibold">Pending</Text>
            </View>
          </View>
          {/* Small Stat 2 */}
          <View className="w-[48%] bg-surface-container rounded-xl p-3 shadow-sm flex-row items-center gap-3">
            <View className="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center">
              <MaterialIcons name="check-circle" size={18} color="#002114" />
            </View>
            <View className="flex-col flex-1">
              <Text className="font-headline-sm text-headline-sm text-on-surface font-bold leading-tight">{confirmedCount}</Text>
              <Text className="font-label-md text-label-md text-on-surface-variant truncate font-semibold">Confirmed</Text>
            </View>
          </View>
        </View>

        {/* Filter Chips */}
        <View className="pt-4">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4 flex-row gap-2">
            {(["All", "PENDING", "CONFIRMED", "DISPATCHED", "DELIVERED", "CANCELLED"] as const).map((f) => (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                className={`h-10 px-4 rounded-full items-center justify-center shadow-sm mr-2 ${
                  filter === f ? "bg-primary" : "bg-surface-container"
                }`}
              >
                <Text
                  className={`font-label-md text-label-md font-semibold ${
                    filter === f ? "text-on-primary" : "text-on-surface"
                  }`}
                >
                  {f.charAt(0) + f.slice(1).toLowerCase()}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Order List */}
        <View className="px-4 pt-4 flex-col gap-4">
          {filteredOrders.length === 0 && !loading ? (
            <View className="flex-col items-center justify-center p-8 mt-4">
              <MaterialIcons name="receipt-long" size={48} color="#717973" />
              <Text className="font-headline-md text-on-surface mb-2 mt-4 font-semibold">
                No orders found
              </Text>
            </View>
          ) : (
            filteredOrders.map((order) => {
              const statusColors = getStatusColor(order.status);
              return (
                <View
                  key={order.id}
                  className="bg-surface-container-lowest rounded-xl p-4 shadow-sm flex-col gap-3 relative overflow-hidden"
                >
                  {/* Left indicator bar */}
                  <View className={`absolute top-0 left-0 w-1 h-full ${order.status === 'PENDING' ? 'bg-error' : 'bg-primary-fixed-dim'}`} />
                  
                  <View className="flex-row items-center justify-between w-full">
                    <Text className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                      #{order.id.split("-")[0].toUpperCase()}
                    </Text>
                    <View className={`${statusColors.bg} px-3 py-1 rounded-full flex-row items-center gap-1`}>
                      <MaterialIcons name={statusColors.icon as any} size={14} color={statusColors.text === 'text-on-primary-fixed' ? '#002114' : (statusColors.text === 'text-on-error-container' ? '#93000a' : '#181c20')} />
                      <Text className={`font-label-md text-label-md font-semibold ${statusColors.text}`}>
                        {order.status.charAt(0) + order.status.slice(1).toLowerCase()}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row items-center gap-2">
                    <MaterialIcons name="storefront" size={18} color="#414844" />
                    <Text className="font-body-md text-body-md text-on-surface-variant">
                      {order.shop_name || order.retailer_name || "Unknown Retailer"}
                    </Text>
                  </View>

                  <View className="flex-row gap-3 mt-1 bg-surface-container-low p-3 rounded-lg">
                    <View className="flex-col gap-1 flex-1">
                      <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">Req. Quantity</Text>
                      <Text className="font-body-lg text-body-lg text-on-surface font-bold">{Number(order.requested_kg)} KG</Text>
                    </View>
                    <View className="flex-col gap-1 flex-1">
                      <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">Bird Size</Text>
                      <Text className="font-body-lg text-body-lg text-on-surface font-bold">{order.bird_size || "Any"}</Text>
                    </View>
                    <View className="flex-col gap-1 flex-1">
                      <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">Notes</Text>
                      <Text className="font-body-lg text-body-lg text-on-surface font-bold truncate" numberOfLines={1}>
                        {order.notes || "None"}
                      </Text>
                    </View>
                  </View>

                  <View className="mt-3 pt-3 flex-row justify-end border-t border-surface-variant/30">
                    <Pressable className="bg-transparent h-10 px-4 rounded-xl flex-row items-center justify-center gap-2 active:bg-surface-variant/50">
                      <Text className="font-label-md text-label-md text-primary font-semibold">View Details</Text>
                      <MaterialIcons name="arrow-forward" size={18} color="#012d1d" />
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Bottom Navigation Bar */}
      <View className="absolute bottom-0 inset-x-0 bg-surface/90 border-t border-outline-variant/20 flex-row justify-around items-center px-2 z-40 px-2 pt-2" style={{ paddingBottom: Math.max(insets.bottom, 12), height: 60 + Math.max(insets.bottom, 12) }}>
        <Pressable 
          className="flex-col items-center justify-center gap-1 w-20"
          onPress={() => navigation.navigate("AdminHome")}
        >
          <MaterialIcons name="grid-view" size={24} color="#414844" />
          <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
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
        <Pressable className="flex-col items-center justify-center gap-1 w-20">
          <View className="bg-primary-container/30 px-4 py-1 rounded-full mb-1">
            <MaterialIcons name="receipt-long" size={24} color="#012d1d" />
          </View>
          <Text className="font-label-md text-label-md text-primary font-semibold -mt-1">
            Orders
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
