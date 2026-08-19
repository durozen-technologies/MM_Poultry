import { useCallback, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { completeRun, getActiveRun, markWhatsAppShared, previewBill, commitBill, skipStop, startRun, updatePrintStatus, weighStop } from "../../api/delivery";
import { readScaleWeight } from "../../services/ble-scale";
import { printThermalReceipt, shareWhatsAppBill } from "../../services/printer";
import { useAuthStore } from "../../store/auth-store";
import type { DeliveryBill, DeliveryRun, DeliveryStop } from "../../types/api";
import { formatIstDate } from "../../utils/ist-date";
import { getTripWeightLoss } from "../../api/reports";

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
    const data = await getActiveRun();
    setRun(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  async function onStartRun() {
    if (!run) return;
    await startRun(run.id);
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
      await weighStop(activeStop.id, {
        delivered_weight_kg: weight,
        scale_device_id: "SIM-SCALE",
      });
      const preview = await previewBill(activeStop.id, { cash_payment: cash, upi_payment: upi });
      const checkoutId = `chk-${activeStop.id}-${Date.now()}`;
      const bill = await commitBill(activeStop.id, {
        cash_payment: cash,
        upi_payment: upi,
        print_status: "PENDING",
        checkout_id: checkoutId,
      });
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
      const updated = await updatePrintStatus(bill.id, printStatus);
      setLastBill(updated);
      setMsg(`Billed ${updated.bill_number} · print ${updated.print_status}`);
      setActiveStop(null);
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  }

  async function onSkipStop() {
    if (!activeStop) return;
    try {
      await skipStop(activeStop.id);
      setMsg(`Skipped stop for ${activeStop.retailer_name}`);
      setActiveStop(null);
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to skip");
    }
  }

  async function onCompleteRun() {
    if (!run) return;
    await completeRun(run.id);
    const loss = await getTripWeightLoss(run.id);
    setMsg(`Run complete. Loss ${loss.loss_kg} kg (${loss.loss_pct}%)`);
    await refresh();
  }

  async function shareBill() {
    if (!lastBill) return;
    await shareWhatsAppBill(
      `Bill ${lastBill.bill_number}\nWeight ${lastBill.weight_kg} kg\nTotal ₹${lastBill.total_amount}\nBalance ₹${lastBill.balance_amount}`
    );
    await markWhatsAppShared(lastBill.id);
    setMsg("WhatsApp share marked");
  }

  return (
    <SafeAreaView className="flex-1 max-w-3xl mx-auto w-full bg-background" edges={["top", "bottom"]}>
      <View className="px-4 py-3 flex-row justify-between items-center bg-primary">
        <Text className="text-on-primary text-headline-sm font-semibold">Delivery</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Button" onPress={() => logout()} className="px-3 py-1 rounded-full bg-primary-container/30">
          <Text className="text-on-primary font-semibold">Logout</Text>
        </Pressable>
      </View>

      <View className="p-4 flex-1">
        {msg ? <Text className="text-error mb-2 font-semibold">{msg}</Text> : null}
        {!run ? (
          <View className="bg-surface-container-lowest rounded-2xl p-6 items-center border border-outline-variant/20">
            <MaterialIcons name="local-shipping" size={40} className="text-on-surface-variant" />
            <Text className="text-on-surface-variant mt-3 text-center">No active delivery run. Ask admin to build one.</Text>
          </View>
        ) : (
          <>
            <View className="bg-surface-container-lowest rounded-2xl p-4 mb-3 border border-outline-variant/20">
              <Text className="font-headline-sm text-on-surface font-semibold">
                Run {run.status} · {formatIstDate(run.run_date)}
              </Text>
              <View className="flex-row gap-2 mt-3">
                <Pressable accessibilityRole="button" accessibilityLabel="Button" className="bg-primary px-4 py-2 rounded-lg flex-1 items-center" onPress={onStartRun}>
                  <Text className="text-on-primary font-semibold">Start</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Button" className="bg-error px-4 py-2 rounded-lg flex-1 items-center" onPress={onCompleteRun}>
                  <Text className="text-on-error font-semibold">Complete</Text>
                </Pressable>
              </View>
            </View>
            <FlatList
              data={run.stops}
              keyExtractor={(s) => s.id}
              renderItem={({ item }) => (
                <Pressable accessibilityRole="button" accessibilityLabel="Button"
                  className={`rounded-xl p-3 mb-2 border ${
                    activeStop?.id === item.id ? "bg-primary-container/20 border-primary" : "bg-surface-container-lowest border-outline-variant/20"
                  }`}
                  onPress={() => setActiveStop(item)}
                >
                  <Text className="font-semibold text-on-surface">
                    #{item.sequence} {item.retailer_name}
                  </Text>
                  <Text className="text-on-surface-variant">
                    Ordered {item.ordered_kg} kg · {item.status}
                  </Text>
                </Pressable>
              )}
            />
          </>
        )}

        {activeStop ? (
          <View className="bg-surface-container-lowest rounded-xl p-4 border border-primary/40 mt-2">
            <Text className="font-bold mb-2 text-on-surface">Stop · {activeStop.retailer_name}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Button" className="bg-primary rounded-lg py-2 mb-2 items-center" onPress={simulateScale}>
              <Text className="text-on-primary font-semibold">Read Bluetooth scale</Text>
            </Pressable>
            <TextInput
              className="border border-outline-variant rounded-lg px-3 py-2 mb-2 bg-surface text-on-surface"
              value={weight}
              onChangeText={setWeight}
              placeholder="Delivered kg"
              keyboardType="decimal-pad"
            />
            <View className="flex-row gap-2 mb-2">
              <TextInput className="flex-1 border border-outline-variant rounded-lg px-3 py-2 bg-surface" value={cash} onChangeText={setCash} placeholder="Cash" keyboardType="decimal-pad" />
              <TextInput className="flex-1 border border-outline-variant rounded-lg px-3 py-2 bg-surface" value={upi} onChangeText={setUpi} placeholder="UPI" keyboardType="decimal-pad" />
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Button" className="bg-primary rounded-lg py-3 items-center mb-2" onPress={weighAndBill}>
              <Text className="text-on-primary font-semibold">Weigh → Commit → Print</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Button" className="border border-error rounded-lg py-3 items-center" onPress={onSkipStop}>
              <Text className="text-error font-semibold">Skip Stop</Text>
            </Pressable>
          </View>
        ) : null}

        {lastBill ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Button" className="mt-3 border border-primary rounded-lg py-3 items-center bg-surface-container-lowest" onPress={shareBill}>
            <Text className="text-primary font-semibold">Share bill on WhatsApp</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
