import { useCallback, useMemo, useState } from "react";
import { FlatList, ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View, } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { getRetailerLedger } from "../../api/retailer";
import type { LedgerOut } from "../../types/api";
import { formatIstDate } from "../../utils/ist-date";

export function RetailerLedgerScreen() {
  const [ledger, setLedger] = useState<LedgerOut | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const data = await getRetailerLedger();
      setLedger(data);
      setMessage(null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to load ledger");
    } finally {
      setBusy(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const totals = useMemo(() => {
    if (!ledger) return { purchases: "0", payments: "0" };
    let purchases = 0;
    let payments = 0;
    for (const e of ledger.entries) {
      purchases += Number(e.debit || 0);
      payments += Number(e.credit || 0);
    }
    return { purchases: purchases.toFixed(2), payments: payments.toFixed(2) };
  }, [ledger]);

  return (
    <SafeAreaView className="flex-1 max-w-3xl mx-auto w-full bg-background" edges={["top"]}>
      <View className="h-16 px-4 flex-row items-center justify-between bg-[#0052CC] border-b border-black/10">
        <Text className="font-headline-sm text-white font-semibold">Ledger</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Button" className="w-11 h-11 items-center justify-center rounded-full active:bg-white/10" onPress={refresh}>
          <MaterialIcons name="refresh" size={24} className="text-white" />
        </Pressable>
      </View>

      <FlatList
        data={ledger?.entries || []}
        keyExtractor={(item, index) => `${item.entry_date}-${item.entry_type}-${index}`}
        className="flex-1 px-4 pt-2"
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={busy} onRefresh={refresh} />}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {message ? <Text className="text-error text-center mb-3">{message}</Text> : null}
            {busy && !ledger ? <ActivityIndicator className="text-primary mt-8" /> : null}

            {ledger ? (
              <>
                <View className="bg-[#0052CC] rounded-[20px] p-6 mb-5 shadow-sm elevation-sm">
                  <Text className="font-label-md text-white/80 uppercase tracking-wide">Outstanding Balance</Text>
                  <Text className="font-display-lg text-white font-bold mt-2">₹{ledger.credit_balance}</Text>
                </View>

                <View className="flex-row gap-4 mb-5">
                  <Chip label="Purchases" value={`₹${totals.purchases}`} />
                  <Chip label="Payments" value={`₹${totals.payments}`} />
                </View>
              </>
            ) : null}
          </>
        }
        renderItem={({ item: entry }) => (
          <View className="bg-white rounded-[16px] p-4 border border-black/5 shadow-sm elevation-sm mb-3">
            <View className="flex-row justify-between">
              <View>
                <Text className="font-headline-sm text-on-surface font-semibold mb-1">{entry.entry_type}</Text>
                <Text className="font-label-md text-on-surface-variant">
                  {formatIstDate(entry.entry_date)}
                  {entry.reference ? ` · ${entry.reference}` : ""}
                </Text>
              </View>
              <View className="items-end">
                {Number(entry.debit) > 0 ? (
                  <Text className="font-headline-sm text-error font-bold">-₹{entry.debit}</Text>
                ) : null}
                {Number(entry.credit) > 0 ? (
                  <Text className="font-headline-sm text-[#0052CC] font-bold">+₹{entry.credit}</Text>
                ) : null}
                <Text className="font-label-md text-on-surface-variant mt-1 font-semibold">
                  Bal ₹{entry.balance_after ?? "—"}
                </Text>
              </View>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 bg-white rounded-[16px] p-4 border border-black/5 shadow-sm elevation-sm">
      <Text className="font-label-xs text-on-surface-variant uppercase tracking-wide mb-1">{label}</Text>
      <Text className="font-headline-sm text-on-surface font-bold">{value}</Text>
    </View>
  );
}
