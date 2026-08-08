import { useCallback, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../../api/client";
import { readScaleWeight } from "../../services/ble-scale";
import { printThermalReceipt, shareWhatsAppBill } from "../../services/printer";
import { useAuthStore } from "../../store/auth-store";
import type { DeliveryBill, DeliveryRun, DeliveryStop } from "../../types/api";
import { formatIstDate } from "../../utils/ist-date";

export function DeliveryHomeScreen() {
  const logout = useAuthStore((s) => s.logout);
  const [run, setRun] = useState<DeliveryRun | null>(null);
  const [activeStop, setActiveStop] = useState<DeliveryStop | null>(null);
  const [weight, setWeight] = useState("");
  const [cash, setCash] = useState("0");
  const [upi, setUpi] = useState("0");
  const [msg, setMsg] = useState<string | null>(null);
  const [lastBill, setLastBill] = useState<DeliveryBill | null>(null);

  const refresh = useCallback(async () => {
    const { data } = await api.get<DeliveryRun | null>("/delivery/runs/active");
    setRun(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  async function startRun() {
    if (!run) return;
    await api.post(`/delivery/runs/${run.id}/start`);
    await refresh();
  }

  async function simulateScale() {
    const reading = await readScaleWeight();
    setWeight(String(reading.kg));
    setMsg(`Scale ${reading.source}: ${reading.kg} kg`);
  }

  async function weighAndBill() {
    if (!activeStop) return;
    try {
      await api.post(`/delivery/stops/${activeStop.id}/weigh`, {
        delivered_weight_kg: weight,
        scale_device_id: "SIM-SCALE",
      });
      const preview = (
        await api.post(`/delivery/stops/${activeStop.id}/bill/preview`, {
          cash_payment: cash,
          upi_payment: upi,
        })
      ).data;
      const checkoutId = `chk-${activeStop.id}-${Date.now()}`;
      // IDEA §17: persist bill first, then print, then update print status
      const bill = (
        await api.post(`/delivery/stops/${activeStop.id}/bill/commit`, {
          cash_payment: cash,
          upi_payment: upi,
          print_status: "PENDING",
          checkout_id: checkoutId,
        })
      ).data as DeliveryBill;
      const printStatus = await printThermalReceipt({
        shopName: "Demo Wholesaler",
        billNumber: bill.bill_number,
        retailerName: activeStop.retailer_name || "",
        weightKg: preview.weight_kg,
        rate: preview.rate_per_kg,
        total: preview.total_amount,
        cash: preview.cash_payment,
        upi: preview.upi_payment,
        balance: preview.balance_amount,
      });
      const updated = (
        await api.patch(`/delivery/bills/${bill.id}/print-status`, {
          print_status: printStatus,
        })
      ).data as DeliveryBill;
      setLastBill(updated);
      setMsg(`Billed ${updated.bill_number} · print ${updated.print_status}`);
      setActiveStop(null);
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  }

  async function completeRun() {
    if (!run) return;
    await api.post(`/delivery/runs/${run.id}/complete`);
    const loss = (await api.get(`/admin/trips/${run.id}/weight-loss`)).data;
    setMsg(`Run complete. Loss ${loss.loss_kg} kg (${loss.loss_pct}%)`);
    await refresh();
  }

  async function shareBill() {
    if (!lastBill) return;
    await shareWhatsAppBill(
      `Bill ${lastBill.bill_number}\nWeight ${lastBill.weight_kg} kg\nTotal ₹${lastBill.total_amount}\nBalance ₹${lastBill.balance_amount}`
    );
    await api.patch(`/delivery/bills/${lastBill.id}/whatsapp`);
    setMsg("WhatsApp share marked");
  }

  return (
    <View className="flex-1 bg-brand-sand">
      <View className="px-4 pt-12 pb-3 flex-row justify-between bg-brand-ink">
        <Text className="text-white text-xl font-bold">Delivery</Text>
        <Pressable onPress={() => logout()}>
          <Text className="text-brand-sand">Logout</Text>
        </Pressable>
      </View>
      <View className="p-4 flex-1">
        {msg ? <Text className="text-brand-clay mb-2">{msg}</Text> : null}
        {!run ? (
          <Text>No active delivery run. Ask admin to build one.</Text>
        ) : (
          <>
            <Text className="font-semibold mb-2">
              Run {run.status} · {formatIstDate(run.run_date)}
            </Text>
            <View className="flex-row gap-2 mb-3">
              <Pressable className="bg-brand-leaf px-3 py-2 rounded" onPress={startRun}>
                <Text className="text-white">Start</Text>
              </Pressable>
              <Pressable className="bg-brand-clay px-3 py-2 rounded" onPress={completeRun}>
                <Text className="text-white">Complete</Text>
              </Pressable>
            </View>
            <FlatList
              data={run.stops}
              keyExtractor={(s) => s.id}
              renderItem={({ item }) => (
                <Pressable
                  className="bg-white rounded-lg p-3 mb-2 border border-black/5"
                  onPress={() => setActiveStop(item)}
                >
                  <Text className="font-semibold">
                    #{item.sequence} {item.retailer_name}
                  </Text>
                  <Text>
                    Ordered {item.ordered_kg} kg · {item.status}
                  </Text>
                </Pressable>
              )}
            />
          </>
        )}
        {activeStop ? (
          <View className="bg-white rounded-xl p-3 border border-brand-leaf/40 mt-2">
            <Text className="font-bold mb-2">Stop · {activeStop.retailer_name}</Text>
            <Pressable className="bg-brand-ink rounded py-2 mb-2 items-center" onPress={simulateScale}>
              <Text className="text-white">Read Bluetooth scale</Text>
            </Pressable>
            <TextInput
              className="border rounded px-2 py-2 mb-2"
              value={weight}
              onChangeText={setWeight}
              placeholder="Delivered kg"
              keyboardType="decimal-pad"
            />
            <View className="flex-row gap-2 mb-2">
              <TextInput
                className="flex-1 border rounded px-2 py-2"
                value={cash}
                onChangeText={setCash}
                placeholder="Cash"
                keyboardType="decimal-pad"
              />
              <TextInput
                className="flex-1 border rounded px-2 py-2"
                value={upi}
                onChangeText={setUpi}
                placeholder="UPI"
                keyboardType="decimal-pad"
              />
            </View>
            <Pressable className="bg-brand-leaf rounded py-3 items-center" onPress={weighAndBill}>
              <Text className="text-white font-semibold">Weigh → Commit → Print</Text>
            </Pressable>
          </View>
        ) : null}
        {lastBill ? (
          <Pressable className="mt-3 border border-brand-leaf rounded py-3 items-center" onPress={shareBill}>
            <Text className="text-brand-leaf font-semibold">Share bill on WhatsApp</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
