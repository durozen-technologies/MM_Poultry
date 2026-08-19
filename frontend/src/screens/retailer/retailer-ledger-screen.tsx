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
      <View className="h-16 px-4 flex-row items-center justify-between bg-surface/80">
        <Text className="font-headline-sm text-on-surface font-semibold">Ledger</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Button" className="w-11 h-11 items-center justify-center rounded-full" onPress={refresh}>
          <MaterialIcons name="refresh" size={24} className="text-on-surface" />
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
                <View className="bg-primary rounded-2xl p-5 mb-4">
                  <Text className="font-label-md text-on-primary/80">Outstanding</Text>
                  <Text className="font-display-lg text-on-primary mt-1">₹{ledger.credit_balance}</Text>
                </View>

                <View className="flex-row gap-3 mb-4">
                  <Chip label="Purchases" value={`₹${totals.purchases}`} />
                  <Chip label="Payments" value={`₹${totals.payments}`} />
                </View>
              </>
            ) : null}
          </>
        }
        renderItem={({ item: entry }) => (
          <View className="bg-surface-container-lowest rounded-xl p-3 border border-outline-variant/20 mb-2">
            <View className="flex-row justify-between">
              <View>
                <Text className="font-body-md text-on-surface font-semibold">{entry.entry_type}</Text>
                <Text className="font-label-md text-on-surface-variant">
                  {formatIstDate(entry.entry_date)}
                  {entry.reference ? ` · ${entry.reference}` : ""}
                </Text>
              </View>
              <View className="items-end">
                {Number(entry.debit) > 0 ? (
                  <Text className="font-body-md text-error">-₹{entry.debit}</Text>
                ) : null}
                {Number(entry.credit) > 0 ? (
                  <Text className="font-body-md text-primary">+₹{entry.credit}</Text>
                ) : null}
                <Text className="font-label-md text-on-surface-variant mt-1">
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
    <View className="flex-1 bg-surface-container-lowest rounded-xl p-3 border border-outline-variant/20">
      <Text className="font-label-md text-on-surface-variant">{label}</Text>
      <Text className="font-body-md text-on-surface font-semibold">{value}</Text>
    </View>
  );
}
