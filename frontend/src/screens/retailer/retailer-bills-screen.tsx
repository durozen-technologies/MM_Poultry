import React, { useCallback, useMemo, useState } from "react";
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
      <View className="h-16 px-4 flex-row items-center justify-between bg-[#0052CC] border-b border-black/10">
        <Text className="font-headline-sm text-white font-semibold">Bills</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Button" className="w-11 h-11 items-center justify-center rounded-full active:bg-white/10" onPress={refresh}>
          <MaterialIcons name="refresh" size={24} className="text-white" />
        </Pressable>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        className="flex-1 px-4 pt-2"
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={busy} onRefresh={refresh} />}
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        ListHeaderComponent={
          <>
            {summary ? (
              <View className="bg-[#0052CC] rounded-2xl p-5 mb-5 shadow-sm elevation-sm">
                <Text className="font-headline-sm text-white font-bold mb-4">Overview</Text>
                <View className="flex-row flex-wrap gap-y-4">
                  <Summary label="Total Bills" value={String(summary.count)} />
                  <Summary label="Total Amount" value={`₹${summary.total_amount}`} />
                  <Summary label="Paid Amount" value={`₹${summary.total_paid}`} />
                  <Summary label="Outstanding" value={`₹${summary.outstanding}`} />
                </View>
              </View>
            ) : null}

            <TextInput
              className="bg-white border border-black/5 shadow-sm elevation-sm rounded-xl px-4 py-4 text-body-md text-on-surface mb-4 placeholder:text-on-surface-variant"
              placeholder="Search bill number"
              value={query}
              onChangeText={setQuery}
            />

            {message ? <Text className="text-error text-center mb-3">{message}</Text> : null}
            {busy && bills.length === 0 ? <ActivityIndicator className="text-primary mt-6" /> : null}
          </>
        }
        renderItem={({ item: bill }) => (
          <BillListItem bill={bill} onPress={() => navigation.navigate("BillDetail", { billId: bill.id })} />
        )}
      />
    </SafeAreaView>
  );
}

const Summary = React.memo(({ label, value }: { label: string; value: string }) => {
  return (
    <View className="w-1/2">
      <Text className="font-label-xs text-white/70 uppercase tracking-wider mb-1">{label}</Text>
      <Text className="font-headline-sm text-white font-bold">{value}</Text>
    </View>
  );
});

const BillListItem = React.memo(({ bill, onPress }: { bill: DeliveryBill; onPress: () => void }) => {
  const isPaid = Number(bill.balance_amount) <= 0;
  const totalKg = bill.items?.reduce((sum, it) => sum + Number(it.weight_kg), 0) || 0;
  
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Button"
      className="bg-white rounded-[20px] p-5 border border-black/5 shadow-sm elevation-sm mb-4 active:opacity-80"
      onPress={onPress}
    >
      <View className="flex-row justify-between items-start">
        <View>
          <Text className="font-headline-sm text-on-surface font-bold">{bill.bill_number}</Text>
          <Text className="font-body-sm text-on-surface-variant mt-1">
            {bill.bill_date ? formatIstDate(bill.bill_date) : "?"} · {totalKg} kg Total
          </Text>
        </View>
        <Text className="font-headline-sm text-[#0052CC] font-bold">₹{bill.total_amount}</Text>
      </View>
      <View className="flex-row items-center justify-between mt-4">
        <View className={`px-3 py-1.5 rounded-md ${isPaid ? "bg-[#e8f5e9]" : "bg-error-container"}`}>
          <Text className={`font-label-sm font-bold uppercase tracking-wider ${isPaid ? "text-[#2e7d32]" : "text-error"}`}>
            {isPaid ? "Paid" : "Due"}
          </Text>
        </View>
        {!isPaid && (
          <Text className="font-label-md text-error font-bold">Bal: ₹{bill.balance_amount}</Text>
        )}
      </View>
    </Pressable>
  );
});
