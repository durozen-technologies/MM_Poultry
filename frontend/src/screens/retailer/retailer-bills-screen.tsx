import { useCallback, useMemo, useState } from "react";
import { FlatList, ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View, } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { listRetailerBills } from "../../api/retailer";
import type { DeliveryBill, RetailerBillsSummary } from "../../types/api";
import { formatIstDate } from "../../utils/ist-date";

export function RetailerBillsScreen({ navigation }: { navigation: any }) {
  const [bills, setBills] = useState<DeliveryBill[]>([]);
  const [summary, setSummary] = useState<RetailerBillsSummary | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const page = await listRetailerBills();
      setBills(page.items);
      setSummary(page.summary);
      setMessage(null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to load bills");
    } finally {
      setBusy(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bills;
    return bills.filter((b) => b.bill_number.toLowerCase().includes(q));
  }, [bills, query]);

  return (
    <SafeAreaView className="flex-1 max-w-3xl mx-auto w-full bg-background" edges={["top"]}>
      <View className="h-16 px-4 flex-row items-center justify-between bg-surface/80">
        <Text className="font-headline-sm text-on-surface font-semibold">Bills</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Button" className="w-11 h-11 items-center justify-center rounded-full" onPress={refresh}>
          <MaterialIcons name="refresh" size={24} className="text-on-surface" />
        </Pressable>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        className="flex-1 px-4 pt-2"
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={busy} onRefresh={refresh} />}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {summary ? (
              <View className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/20 mb-4">
                <Text className="font-headline-sm text-on-surface font-semibold mb-3">Overview</Text>
                <View className="flex-row flex-wrap gap-y-2">
                  <Summary label="Bills" value={String(summary.count)} />
                  <Summary label="Total" value={`₹${summary.total_amount}`} />
                  <Summary label="Paid" value={`₹${summary.total_paid}`} />
                  <Summary label="Outstanding" value={`₹${summary.outstanding}`} />
                </View>
              </View>
            ) : null}

            <TextInput
              className="bg-surface border border-outline-variant rounded-xl px-3 py-3 text-body-md text-on-surface mb-3 placeholder:text-on-surface-variant"
              placeholder="Search bill number"
              value={query}
              onChangeText={setQuery}
 />

            {message ? <Text className="text-error text-center mb-3">{message}</Text> : null}
            {busy && bills.length === 0 ? <ActivityIndicator className="text-primary mt-6" /> : null}
          </>
        }
        renderItem={({ item: bill }) => (
          <Pressable accessibilityRole="button" accessibilityLabel="Button"
            className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/20 mb-3"
            onPress={() => navigation.navigate("BillDetail", { billId: bill.id })}
          >
            <View className="flex-row justify-between items-start">
              <View>
                <Text className="font-headline-sm text-on-surface font-semibold">{bill.bill_number}</Text>
                <Text className="font-body-md text-on-surface-variant">
                  {bill.bill_date ? formatIstDate(bill.bill_date) : "?"} · {bill.items?.reduce((sum, it) => sum + Number(it.weight_kg), 0) || 0} kg Total
                </Text>
              </View>
              <Text className="font-headline-sm text-primary font-semibold">₹{bill.total_amount}</Text>
            </View>
            {Number(bill.balance_amount) > 0 ? (
              <Text className="font-label-md text-error mt-2">Balance ₹{bill.balance_amount}</Text>
            ) : (
              <Text className="font-label-md text-on-surface-variant mt-2">Paid</Text>
            )}
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <View className="w-1/2">
      <Text className="font-label-md text-on-surface-variant">{label}</Text>
      <Text className="font-body-md text-on-surface font-semibold">{value}</Text>
    </View>
  );
}
