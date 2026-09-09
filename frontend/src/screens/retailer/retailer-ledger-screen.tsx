import { useCallback, useMemo, useState } from "react";
import { FlatList, ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View, } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getRetailerLedger } from "../../api/retailer";
import type { LedgerOut } from "../../types/api";
import { formatIstDate } from "../../utils/ist-date";

export function RetailerLedgerScreen() {
  const insets = useSafeAreaInsets();
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

  const ledgerEntries = useMemo(() => {
    return ledger?.entries?.filter(e => e.entry_type !== "BILL") || [];
  }, [ledger]);

  return (
    <View className="flex-1 max-w-3xl mx-auto w-full bg-background" style={{ paddingTop: insets.top }}>
      <View className="h-16 px-4 flex-row items-center justify-between bg-[#0052CC] border-b border-black/10">
        <Text className="font-headline-sm text-white font-semibold">Ledger</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Button" className="w-11 h-11 items-center justify-center rounded-full active:bg-white/10" onPress={refresh}>
          <MaterialIcons name="refresh" size={24} className="text-white" />
        </Pressable>
      </View>

      <FlatList
        data={ledgerEntries}
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
        renderItem={({ item: entry, index }) => (
          <View className={`bg-white p-4 ${index !== ledgerEntries.length - 1 ? 'border-b border-black/5' : ''} shadow-sm elevation-sm ${index === 0 ? 'rounded-t-[16px]' : ''} ${index === ledgerEntries.length - 1 ? 'rounded-b-[16px] mb-3' : ''}`}>
            <View className="flex-row justify-between items-center">
              <View className="flex-col justify-center flex-1">
                <Text className="font-label-sm font-bold text-on-surface-variant uppercase tracking-wider mb-1">{formatIstDate(entry.entry_date)}</Text>
                <Text className="font-title-sm text-on-surface font-bold">{entry.entry_type}</Text>
                {entry.notes ? (
                  <Text className="font-body-sm text-on-surface-variant mt-0.5">{entry.notes}</Text>
                ) : null}
              </View>
              <View className="flex-col items-end justify-center">
                {Number(entry.debit) > 0 && (
                  <View className="bg-error-container/30 px-3 py-1.5 rounded-lg border border-error/10">
                    <Text className="font-title-sm font-black text-error">₹{Number(entry.debit).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</Text>
                  </View>
                )}
                {Number(entry.credit) > 0 && (
                  <View className="bg-primary-container/30 px-3 py-1.5 rounded-lg border border-[#0052CC]/10">
                    <Text className="font-title-sm font-black text-[#0052CC]">₹{Number(entry.credit).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}
      />
    </View>
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
