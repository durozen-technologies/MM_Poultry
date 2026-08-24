import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { getRetailerOrder } from "../../api/retailer";
import type { RetailerOrderDetail } from "../../types/api";
import { formatIstDate } from "../../utils/ist-date";

export function RetailerOrderDetailScreen({ route, navigation }: { route: any; navigation: any }) {
  const orderId = route.params?.orderId as string;
  const [order, setOrder] = useState<RetailerOrderDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
                {order.requested_kg} kg
              </Text>
              <Text className="font-body-md text-on-surface-variant mt-1">
                {formatIstDate(order.order_date)} · {order.bird_size || "Any"}
              </Text>
              <Text className="font-label-md text-on-surface-variant mt-2">
                Est. delivery {formatIstDate(order.estimated_delivery_date)}
              </Text>
              {order.notes ? (
                <Text className="font-body-md text-on-surface mt-3">Notes: {order.notes}</Text>
              ) : null}
            </View>

            <Text className="font-headline-sm text-on-surface mb-3">Tracking</Text>
            <View className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/20">
              {order.tracking_stages.map((stage, idx) => (
                <View key={stage.key} className="flex-row gap-3">
                  <View className="items-center">
                    <View
                      className={`w-3 h-3 rounded-full ${
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
                        stage.active ? "text-primary font-semibold" : "text-on-surface"
                      }`}
                    >
                      {stage.label}
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
