import React, { useCallback, useState } from "react";
import { FlatList, ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View, } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { listRetailerOrders } from "../../api/retailer";
import type { DailyOrder } from "../../types/api";
import { formatIstDate } from "../../utils/ist-date";

type Tab = "today" | "history";

export function RetailerOrdersScreen({ navigation }: { navigation: any }) {
  const [tab, setTab] = useState<Tab>("today");
  const [orders, setOrders] = useState<DailyOrder[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const page = await listRetailerOrders({ scope: tab });
      setOrders(page.items);
      setMessage(null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to load orders");
    } finally {
      setBusy(false);
    }
  }, [tab]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  return (
    <SafeAreaView className="flex-1 max-w-3xl mx-auto w-full bg-background" edges={["top"]}>
      <View className="h-16 px-4 flex-row items-center justify-between bg-[#0052CC] border-b border-black/10">
        <Text className="font-headline-sm text-white font-semibold">My Orders</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Button" className="w-11 h-11 items-center justify-center rounded-full active:bg-white/10" onPress={refresh}>
          <MaterialIcons name="refresh" size={24} className="text-white" />
        </Pressable>
      </View>

      <View className="flex-row mx-4 mt-4 bg-surface-container-highest rounded-full p-1 border border-outline-variant/30">
        {(["today", "history"] as Tab[]).map((key) => (
          <Pressable accessibilityRole="button" accessibilityLabel="Button"
            key={key}
            className="flex-1 py-2.5 rounded-full items-center"
            style={tab === key ? { backgroundColor: "#fff", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 } : undefined}
            onPress={() => setTab(key)}
          >
            <Text className={tab === key ? "text-[#0052CC] font-bold" : "text-on-surface-variant font-medium"}>
              {key === "today" ? "Today's Orders" : "Order History"}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        className="flex-1 px-4 pt-3"
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={busy} onRefresh={refresh} />}
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        ListHeaderComponent={
          <>
            {message ? (
              <Text className="text-error text-center mb-3">{message}</Text>
            ) : null}
            {busy && orders.length === 0 ? <ActivityIndicator className="text-primary mt-6" /> : null}
          </>
        }
        ListEmptyComponent={
          !busy ? (
            <Text className="text-on-surface-variant text-center mt-8">No orders found</Text>
          ) : null
        }
        renderItem={({ item: order }) => (
          <OrderListItem order={order} onPress={() => navigation.navigate("OrderDetail", { orderId: order.id })} />
        )}
      />
    </SafeAreaView>
  );
}

const OrderListItem = React.memo(({ order, onPress }: { order: DailyOrder; onPress: () => void }) => {
  const isDelivered = order.status === "FULFILLED";
  const isCancelled = order.status === "CANCELLED";
  
  let bgClass = "bg-primary-container";
  let textClass = "text-on-primary-container";
  if (isDelivered) {
    bgClass = "bg-[#e8f5e9]";
    textClass = "text-[#2e7d32]";
  } else if (isCancelled) {
    bgClass = "bg-error-container";
    textClass = "text-on-error-container";
  }

  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Button"
      className="bg-white rounded-[20px] p-5 border border-black/5 shadow-sm elevation-sm mb-4 active:opacity-80 relative"
      onPress={onPress}
    >
      <View className={`absolute right-4 top-4 px-2 py-1 rounded-md ${bgClass}`}>
        <Text className={`font-bold uppercase tracking-wider text-[10px] ${textClass}`}>
          {order.status === 'ACKNOWLEDGED' ? 'CONFIRMED' : order.status}
        </Text>
      </View>

      <Text className="font-body-sm text-on-surface-variant mb-2">
        {formatIstDate(order.order_date)}
      </Text>

      <View className="flex-col gap-2 mt-1 mb-3">
        {order.items?.map(it => (
          <View key={it.item_id} className="flex-row items-baseline gap-1 flex-wrap pr-16">
            <Text className="font-headline-sm text-on-surface font-bold">{it.item_name || "Item"}</Text>
            <Text className="font-body-md text-on-surface-variant font-medium ml-1">
              {it.total_boxes || 0} Boxes
            </Text>
            {it.requested_kg ? (
              <Text className="font-body-md text-on-surface-variant ml-1">({it.requested_kg} kg)</Text>
            ) : null}
          </View>
        ))}
      </View>

      <View className="flex-row items-center justify-between border-t border-surface-variant/30 pt-3">
        <View className="flex-row items-center gap-1">
          <Text className="font-label-md text-primary">View order details</Text>
          <MaterialIcons name="chevron-right" size={18} className="text-primary" />
        </View>
      </View>
    </Pressable>
  );
});
