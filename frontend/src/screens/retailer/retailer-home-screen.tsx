import { useCallback, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../../api/client";
import { useAuthStore } from "../../store/auth-store";
import type { DailyOrder, LedgerOut } from "../../types/api";
import { formatIstDate } from "../../utils/ist-date";

export function RetailerHomeScreen() {
  const logout = useAuthStore((s) => s.logout);
  const [kg, setKg] = useState("50");
  const [order, setOrder] = useState<DailyOrder | null>(null);
  const [ledger, setLedger] = useState<LedgerOut | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [o, l] = await Promise.all([
      api.get("/retailer/orders/today"),
      api.get("/retailer/ledger"),
    ]);
    setOrder(o.data);
    setLedger(l.data);
    if (o.data?.requested_kg) setKg(o.data.requested_kg);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  async function placeOrder() {
    try {
      const { data } = await api.post("/retailer/orders/today", { requested_kg: kg });
      setOrder(data);
      setMsg("Order saved for today");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <View className="flex-1 bg-brand-sand">
      <View className="px-4 pt-12 pb-3 flex-row justify-between bg-brand-ink">
        <Text className="text-white text-xl font-bold">Retailer</Text>
        <Pressable onPress={() => logout()}>
          <Text className="text-brand-sand">Logout</Text>
        </Pressable>
      </View>
      <View className="p-4 gap-3">
        {msg ? <Text className="text-brand-clay">{msg}</Text> : null}
        <Text className="text-lg font-semibold text-brand-ink">Today&apos;s order (kg)</Text>
        <TextInput
          className="bg-white border rounded-lg px-3 py-3"
          value={kg}
          onChangeText={setKg}
          keyboardType="decimal-pad"
        />
        <Pressable className="bg-brand-leaf rounded-lg py-3 items-center" onPress={placeOrder}>
          <Text className="text-white font-semibold">Save order</Text>
        </Pressable>
        {order ? (
          <Text>
            Current: {order.requested_kg} kg · {order.status}
          </Text>
        ) : null}
        {ledger ? (
          <View className="bg-white rounded-xl p-3 border border-brand-leaf/20 mt-4">
            <Text className="font-bold mb-1">Outstanding ₹{ledger.credit_balance}</Text>
            {ledger.entries.slice(-5).map((e, idx) => (
              <Text key={idx} className="text-xs mb-1">
                {formatIstDate(e.entry_date)} {e.entry_type} {e.reference} Bal {e.balance_after}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}
