import { useCallback, useState } from "react";
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
      <View className="h-16 px-4 flex-row items-center justify-between bg-surface/80">
        <Text className="font-headline-sm text-on-surface font-semibold">Orders</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Button" className="w-11 h-11 items-center justify-center rounded-full" onPress={refresh}>
          <MaterialIcons name="refresh" size={24} className="text-on-surface" />
        </Pressable>
      </View>

      <View className="flex-row mx-4 mt-2 bg-surface-variant/50 rounded-xl p-1">
        {(["today", "history"] as Tab[]).map((key) => (
          <Pressable accessibilityRole="button" accessibilityLabel="Button"
            key={key}
            className={`flex-1 py-2 rounded-lg items-center ${tab === key ? "bg-surface" : ""}`}
            onPress={() => setTab(key)}
          >
            <Text className={tab === key ? "text-primary font-semibold" : "text-on-surface-variant"}>
              {key === "today" ? "Today" : "Previous"}
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
          <Pressable accessibilityRole="button" accessibilityLabel="Button"
            className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/20 mb-3"
            onPress={() => navigation.navigate("OrderDetail", { orderId: order.id })}
          >
            <View className="flex-row justify-between items-start mb-2">
              <View>
                <Text className="font-headline-sm text-on-surface font-semibold">
                  {order.requested_kg} kg
                </Text>
                <Text className="font-body-md text-on-surface-variant">
                  {formatIstDate(order.order_date)} · {order.bird_size || "Any"}
                </Text>
              </View>
              <View className="bg-surface-variant px-3 py-1 rounded-full">
                <Text className="font-label-md text-on-surface-variant">{order.status}</Text>
              </View>
            </View>
            <View className="flex-row items-center gap-1">
              <MaterialIcons name="chevron-right" size={18} className="text-on-surface" />
              <Text className="font-label-md text-primary">View tracking</Text>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
