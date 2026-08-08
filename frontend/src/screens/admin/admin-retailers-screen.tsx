import { useCallback, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../../api/client";
import { DatePickerField } from "../../components/date-picker-field";
import type { LedgerOut, Retailer } from "../../types/api";
import { formatIstDate, toApiDate, todayIstDate } from "../../utils/ist-date";

export function AdminRetailersScreen() {
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [selected, setSelected] = useState<LedgerOut | null>(null);
  const [cash, setCash] = useState("0");
  const [upi, setUpi] = useState("0");
  const [paymentDate, setPaymentDate] = useState(todayIstDate());
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data } = await api.get("/admin/retailers");
    setRetailers(data.items);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  async function openLedger(id: string) {
    const { data } = await api.get(`/admin/retailers/${id}/ledger`);
    setSelected(data);
  }

  async function collect() {
    if (!selected) return;
    try {
      await api.post(`/admin/retailers/${selected.retailer.id}/payments`, {
        cash_amount: cash,
        upi_amount: upi,
        payment_date: toApiDate(paymentDate),
      });
      await openLedger(selected.retailer.id);
      await refresh();
      setMsg("Payment recorded");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <View className="flex-1 bg-brand-sand p-4 pt-12">
      <Text className="text-2xl font-bold text-brand-ink mb-3">Retailers</Text>
      {msg ? <Text className="text-brand-clay mb-2">{msg}</Text> : null}
      <FlatList
        data={retailers}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <Pressable
            className="bg-white rounded-lg p-3 mb-2 border border-brand-leaf/20"
            onPress={() => openLedger(item.id)}
          >
            <Text className="font-semibold">{item.name}</Text>
            <Text>Outstanding ₹{item.credit_balance}</Text>
          </Pressable>
        )}
      />
      {selected ? (
        <View className="bg-white rounded-xl p-3 border border-brand-leaf/30 mt-2 max-h-80">
          <Text className="font-bold mb-1">
            Ledger · {selected.retailer.name} · ₹{selected.credit_balance}
          </Text>
          <FlatList
            data={selected.entries}
            keyExtractor={(_, idx) => String(idx)}
            renderItem={({ item }) => (
              <Text className="text-xs mb-1">
                {formatIstDate(item.entry_date)} {item.entry_type} Dr {item.debit} Cr{" "}
                {item.credit}
              </Text>
            )}
          />
          <DatePickerField label="Payment date" value={paymentDate} onChange={setPaymentDate} />
          <View className="flex-row gap-2 mt-2">
            <TextInput
              className="flex-1 border rounded px-2 py-1"
              value={cash}
              onChangeText={setCash}
              placeholder="Cash"
              keyboardType="decimal-pad"
            />
            <TextInput
              className="flex-1 border rounded px-2 py-1"
              value={upi}
              onChangeText={setUpi}
              placeholder="UPI"
              keyboardType="decimal-pad"
            />
            <Pressable className="bg-brand-leaf px-3 justify-center rounded" onPress={collect}>
              <Text className="text-white">Pay</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}
