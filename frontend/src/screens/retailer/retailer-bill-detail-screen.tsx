import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { getRetailerBill } from "../../api/retailer";
import { apiItems } from "../../api/items";
import type { DeliveryBill } from "../../types/api";
import { formatIstDate } from "../../utils/ist-date";

export function RetailerBillDetailScreen({ route, navigation }: { route: any; navigation: any }) {
  const billId = route.params?.billId as string;
  const [bill, setBill] = useState<DeliveryBill | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const { data: itemsPage } = useQuery({
    queryKey: ["retailer_items"],
    queryFn: () => apiItems.list(),
  });
  const allItems = itemsPage?.items || [];
  const getItemName = (id: string) => allItems.find((i) => i.id === id)?.name || "Unknown Item";

  const refresh = useCallback(async () => {
    if (!billId) return;
    setBusy(true);
    try {
      const data = await getRetailerBill(billId);
      setBill(data);
      setMessage(null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to load bill");
    } finally {
      setBusy(false);
    }
  }, [billId]);

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
        <Text className="font-headline-sm text-on-surface font-semibold ml-2">Bill Details</Text>
      </View>

      <ScrollView className="flex-1 px-4 py-4" contentContainerStyle={{ paddingBottom: 40 }}>
        {message ? <Text className="text-error text-center mb-3">{message}</Text> : null}
        {busy && !bill ? <ActivityIndicator className="text-primary mt-8" /> : null}
        {bill ? (
          <View className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/20 flex-col gap-3">
            <Text className="font-headline-md text-on-surface font-semibold">{bill.bill_number}</Text>
            <Row label="Date" value={bill.bill_date ? formatIstDate(bill.bill_date) : "?"} />
            <Row label="Checkout ID" value={bill.checkout_id} />
            
            <View className="my-2 border-t border-surface-variant/40 pt-2">
              <Text className="font-label-md text-on-surface-variant mb-2">Line Items</Text>
              {bill.items?.map((item) => (
                <View key={item.item_id} className="flex-row justify-between py-1">
                  <View>
                    <Text className="font-body-md text-on-surface">{getItemName(item.item_id)}</Text>
                    <Text className="font-label-sm text-on-surface-variant">{item.weight_kg} kg @ ₹{item.rate_per_kg}/kg</Text>
                  </View>
                  <Text className="font-body-md text-on-surface font-semibold">₹{item.amount}</Text>
                </View>
              ))}
            </View>

            <View className="border-t border-surface-variant/40 pt-2">
              <Row label="Total Amount" value={`₹${bill.total_amount}`} />
              <Row label="Cash paid" value={`₹${bill.cash_payment}`} />
              <Row label="UPI paid" value={`₹${bill.upi_payment}`} />
              <Row label="Balance" value={`₹${bill.balance_amount}`} />
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-2">
      <Text className="font-label-md text-on-surface-variant">{label}</Text>
      <Text className="font-body-md text-on-surface font-semibold">{value}</Text>
    </View>
  );
}
