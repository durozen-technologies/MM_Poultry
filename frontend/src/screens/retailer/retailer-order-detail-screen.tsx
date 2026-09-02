import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { getRetailerOrder } from "../../api/retailer";
import { apiItems } from "../../api/items";
import type { RetailerOrderDetail } from "../../types/api";
import { formatIstDate } from "../../utils/ist-date";

export function RetailerOrderDetailScreen({ route, navigation }: { route: any; navigation: any }) {
  const orderId = route.params?.orderId as string;
  const [order, setOrder] = useState<RetailerOrderDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const { data: itemsPage } = useQuery({
    queryKey: ["retailer_items"],
    queryFn: () => apiItems.list(),
  });
  const allItems = itemsPage?.items || [];
  const getItemName = (id: string) => allItems.find((i: any) => i.id === id)?.name || "Unknown Item";

  const refresh = useCallback(async () => {
    if (!orderId) return;
    setBusy(true);
    try {
      const data = await getRetailerOrder(orderId);
      setOrder(data);
      setMessage(null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to load order");
    } finally {
      setBusy(false);
    }
  }, [orderId]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  return (
    <SafeAreaView className="flex-1 max-w-3xl mx-auto w-full bg-background" edges={["top", "bottom"]}>
      <View className="h-16 px-4 flex-row items-center bg-surface/90 border-b border-outline-variant/20">
        <Pressable accessibilityRole="button" accessibilityLabel="Button" className="w-11 h-11 -ml-2 items-center justify-center rounded-full" onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} className="text-on-surface" />
        </Pressable>
        <Text className="font-headline-sm text-on-surface font-semibold ml-2">Order {order?.order_number || (orderId ? `#${orderId.slice(0, 8).toUpperCase()}` : "Details")}</Text>
      </View>

      <ScrollView className="flex-1 px-4 py-4" contentContainerStyle={{ paddingBottom: 40 }}>
        {message ? <Text className="text-error text-center mb-3">{message}</Text> : null}
        {busy && !order ? <ActivityIndicator className="text-primary mt-8" /> : null}
        {order ? (
          <>
            <View className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/20 mb-4">
              <Text className="font-headline-md text-on-surface font-semibold">
                Date: {formatIstDate(order.order_date)}
              </Text>
              {order.expected_delivery_date ? (
                <Text className="font-label-md text-on-surface-variant mt-2">
                  Delivery: {formatIstDate(order.expected_delivery_date)}
                </Text>
              ) : null}
            </View>

            <Text className="font-headline-sm text-on-surface mb-3">Order Items</Text>
            {order.items?.map((item) => (
              <View key={item.id} className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/20 mb-3">
                <Text className="font-body-lg text-on-surface font-semibold mb-2">
                  {getItemName(item.item_id)}
                </Text>
                <View className="flex-row items-center gap-3 py-1">
                  <MaterialIcons name="scale" size={18} className="text-on-surface-variant" />
                  <Text className="font-body-md text-on-surface font-semibold">{item.requested_kg} kg</Text>
                </View>
                <View className="flex-row items-center gap-3 py-1">
                  <MaterialIcons name="inventory-2" size={18} className="text-on-surface-variant" />
                  <Text className="font-body-md text-on-surface">{item.total_boxes || 0} Boxes</Text>
                </View>
                <View className="flex-row items-center gap-3 py-1">
                  <MaterialIcons name="egg" size={18} className="text-on-surface-variant" />
                  <Text className="font-body-md text-on-surface">{item.bird_size || "Any"}</Text>
                </View>
                {item.notes ? (
                  <View className="flex-row items-center gap-3 py-1 mt-1 border-t border-surface-variant/30">
                    <MaterialIcons name="notes" size={18} className="text-on-surface-variant" />
                    <Text className="font-body-md text-on-surface flex-1">{item.notes}</Text>
                  </View>
                ) : null}
              </View>
            ))}

            <Text className="font-headline-sm text-on-surface mt-2 mb-3">Tracking</Text>
            <View className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/20">
              {order.tracking_stages.map((stage, idx) => (
                <View key={stage.key} className="flex-row gap-3">
                  <View className="items-center">
                    <View
                      className={`w-3 h-3 rounded-full ${
                        stage.key === "cancelled" ? "bg-error" : 
                        stage.completed || stage.active ? "bg-primary" : "bg-outline-variant"
                      }`}
                    />
                    {idx < order.tracking_stages.length - 1 ? (
                      <View className={`w-0.5 flex-1 my-1 ${stage.completed ? "bg-primary" : "bg-outline-variant"}`} />
                    ) : null}
                  </View>
                  <View className="flex-1 pb-4">
                    <Text
                      className={`font-body-md ${
                        stage.key === "cancelled" ? "text-error font-semibold" :
                        stage.active ? "text-primary font-semibold" : "text-on-surface"
                      }`}
                    >
                      {stage.label}
                      {stage.key === "confirmed" && (stage.completed || stage.active) ? ` on ${formatIstDate(order.order_date)}` : ""}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
