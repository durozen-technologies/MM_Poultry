import { Text, View, Pressable, ScrollView } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { apiItems } from "../../api/items";
import type { DailyOrder } from "../../types/api";
import { formatIstDate } from "../../utils/ist-date";

export function AdminOrderDetailScreen({ route, navigation }: { route: any; navigation: any }) {
  const order = route.params?.order as DailyOrder;

  const { data: itemsPage } = useQuery({
    queryKey: ["admin_items"],
    queryFn: () => apiItems.list(),
  });
  
  const allItems = itemsPage?.items || [];
  const getItemName = (id: string) => allItems.find((i) => i.id === id)?.name || "Unknown Item";

  if (!order) {
    return (
      <SafeAreaView className="flex-1 max-w-3xl mx-auto w-full bg-background items-center justify-center">
        <Text className="text-on-surface-variant">Order not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 max-w-3xl mx-auto w-full bg-background" edges={["top", "bottom"]}>
      <View className="h-16 px-4 flex-row items-center bg-surface/90 border-b border-outline-variant/20">
        <Pressable accessibilityRole="button" accessibilityLabel="Button" className="w-11 h-11 -ml-2 items-center justify-center rounded-full" onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} className="text-on-surface" />
        </Pressable>
        <Text className="font-headline-sm text-on-surface font-semibold ml-2">Order Details</Text>
      </View>

      <ScrollView className="flex-1 px-4 py-4">
        <View className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/20 flex-col gap-4">
          <View className="flex-row justify-between items-start">
            <View>
              <Text className="font-headline-md text-on-surface font-semibold">
                {order.shop_name || order.retailer_name}
              </Text>
              <Text className="font-body-md text-on-surface-variant mt-1">{order.order_number || `#${order.id.slice(0, 8).toUpperCase()}`}</Text>
            </View>
            <View className="bg-surface-variant px-3 py-1 rounded-full">
              <Text className="font-label-md text-on-surface-variant font-semibold">{order.status}</Text>
            </View>
          </View>

          <DetailRow icon="event" label="Order Date" value={formatIstDate(order.order_date)} />
          <DetailRow icon="scale" label="Total Requested" value={`${order.items?.reduce((sum, it) => sum + Number(it.requested_kg || 0), 0) || 0} kg`} />
        </View>

        <Text className="font-headline-sm text-on-surface font-semibold mt-6 mb-3">Order Items</Text>
        
        {order.items?.map((item) => (
          <View key={item.id} className="bg-surface-container-lowest rounded-xl p-4 mb-2 border border-outline-variant/20">
             <Text className="font-body-lg text-on-surface font-semibold mb-2">
               {getItemName(item.item_id)}
             </Text>
             <DetailRow icon="scale" label="Requested" value={`${item.requested_kg} kg`} />
             <DetailRow icon="egg" label="Bird Size" value={item.bird_size || "Any"} />
             {item.notes ? (
                <DetailRow icon="notes" label="Notes" value={item.notes} />
             ) : null}
          </View>
        ))}

        <Pressable accessibilityRole="button" accessibilityLabel="Button"
          className="bg-primary h-12 rounded-xl items-center justify-center mt-6 mb-8"
          onPress={() => navigation.navigate("DeliveryRuns")}
        >
          <Text className="text-on-primary font-semibold">Create Delivery Run</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ icon, label, value }: { icon: keyof typeof MaterialIcons.glyphMap; label: string; value: string }) {
  return (
    <View className="flex-row items-center gap-3 py-2 border-b border-surface-variant/40">
      <MaterialIcons name={icon} size={20} className="text-on-surface" />
      <View className="flex-1">
        <Text className="font-label-md text-on-surface-variant">{label}</Text>
        <Text className="font-body-md text-on-surface font-semibold">{value}</Text>
      </View>
    </View>
  );
}
