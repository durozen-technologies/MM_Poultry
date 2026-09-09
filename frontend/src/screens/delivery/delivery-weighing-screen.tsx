import React, { useState, useEffect } from "react";
import { View, Text, TextInput, ScrollView, Alert, Pressable, Switch } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { PrimaryButton } from "../../components/ui/primary-button";
import { getApiErrorMessage } from "../../api/client";
import { weighStop, previewBill, commitBill, updatePrintStatus, markWhatsAppShared } from "../../api/delivery";
import { deliveryBillToPrintPayload, printThermalReceipt, shareWhatsAppBill } from "../../services/printer";
import { getOrderBill } from "../../api/orders";
import type { DeliveryBill, DeliveryStop } from "../../types/api";
import { PrinterSetupModal } from "../../components/printer-setup-modal";
import { useQuery } from "@tanstack/react-query";
import { apiItems } from "../../api/items";
import { useAuthStore } from "../../store/auth-store";

function genCheckoutId(stopId: string): string {
  return `chk-${stopId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function DeliveryWeighingScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const stop = route.params?.stop as DeliveryStop | undefined;
  const isBilled = stop?.status === "BILLED";
  const isWeighedOnly = stop?.status === "WEIGHED";
  const isReadOnly = isBilled;
  
  const [weights, setWeights] = useState<Record<string, { boxes: string; weight: string }>>({});
  const [cash, setCash] = useState("0");
  const [upi, setUpi] = useState("0");
  const [notes, setNotes] = useState("");
  const [billing, setBilling] = useState(false);
  const [skipPrint, setSkipPrint] = useState(false);
  const [printerModalVisible, setPrinterModalVisible] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [lastBill, setLastBill] = useState<DeliveryBill | null>(null);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!stop?.daily_order_id || stop.status === "PENDING") return;
    getOrderBill(stop.daily_order_id)
      .then(setLastBill)
      .catch(() => setLastBill(null));
  }, [stop?.id, stop?.daily_order_id, stop?.status]);

  const { data: itemsPage } = useQuery({
    queryKey: ["delivery_items"],
    queryFn: () => apiItems.list(true),
  });
  const allItems = itemsPage?.items || [];
  const getItemName = (id: string) => allItems.find((i: any) => i.id === id)?.name || id.slice(0, 8);
  const organizationName = useAuthStore((s) => s.user?.organization_name);
  const receiptOpts = { organizationName };

  useEffect(() => {
    if (stop && stop.items) {
      const initialWeights: Record<string, { boxes: string; weight: string }> = {};
      stop.items.forEach((item: any) => {
        const weighed = stop.status === "WEIGHED" || stop.status === "BILLED";
        initialWeights[item.item_id] = {
          boxes: String(item.delivered_boxes ?? item.original_total_boxes ?? "1"),
          weight: weighed
            ? String(item.delivered_weight_kg ?? item.ordered_kg ?? "0")
            : String(item.ordered_kg || "0"),
        };
      });
      setWeights(initialWeights);
    }
  }, [stop]);

  if (!stop) {
    return (
      <View className="flex-1 bg-surface justify-center items-center" style={{ paddingTop: insets.top }}>
        <Text>Stop not found</Text>
        <PrimaryButton title="Go Back" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  const weighAndBill = async () => {
    setBilling(true);
    setMsg(null);
    const checkoutId = genCheckoutId(stop.id);
    
    try {
      const itemsPayload = (stop.items || []).map((item: any) => {
        const input = weights[item.item_id] || { boxes: "1", weight: "0" };
        const weight = Number(input.weight || "0");
        const boxes = Number(input.boxes || "1");
        
        if (weight <= 0) throw new Error(`Weight must be > 0 for ${item.item_id.slice(0, 8)}`);
        if (boxes <= 0) throw new Error(`Boxes must be > 0 for ${item.item_id.slice(0, 8)}`);
        
        return {
          item_id: item.item_id,
          weight_kg: weight,
          delivered_boxes: boxes,
          delivered_bird_count: 0,
        };
      });

      const cashNum = Number(cash);
      const upiNum = Number(upi);
      if (!Number.isFinite(cashNum) || !Number.isFinite(upiNum) || cashNum < 0 || upiNum < 0) {
        throw new Error("Invalid cash/UPI amount");
      }

      // Step 1: Weigh
      let weighDone = false;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          await weighStop(stop.id, {
            scale_device_id: "MANUAL",
            items: itemsPayload,
          });
          weighDone = true;
          break;
        } catch (e: any) {
          const code = e?.response?.status;
          if ((code === 503 || code === 429) && attempt === 0) {
            await new Promise((r) => setTimeout(r, 800));
            continue;
          }
          if (code === 409 && String(e?.message || "").includes("WEIGH")) {
            weighDone = true;
            break;
          }
          throw e;
        }
      }
      if (!weighDone) throw new Error("Weigh failed");

      const preview = await previewBill(stop.id, { cash_payment: String(cashNum), upi_payment: String(upiNum), notes });
      if (!preview) throw new Error("Failed to preview bill");

      // Step 2: Commit
      let bill: any = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          bill = await commitBill(stop.id, {
            cash_payment: String(cashNum),
            upi_payment: String(upiNum),
            print_status: "PENDING",
            checkout_id: checkoutId,
            notes,
          });
          break;
        } catch (e: any) {
          if ((e?.response?.status === 503 || e?.response?.status === 429) && attempt === 0) {
            await new Promise((r) => setTimeout(r, 800));
            continue;
          }
          throw e;
        }
      }
      if (!bill) throw new Error("Commit failed");

      // Step 3: Print
      let printStatus: "PRINTED" | "FAILED" | "SKIPPED" = "FAILED";
      if (skipPrint) {
        printStatus = "SKIPPED";
      } else {
        try {
          printStatus = await printThermalReceipt(
            deliveryBillToPrintPayload(bill, stop, getItemName, receiptOpts)
          );
        } catch {
          printStatus = "FAILED";
        }
      }

      let updated = bill;
      try {
        const backendStatus = printStatus === "PRINTED" ? "PRINTED" : printStatus === "SKIPPED" ? "SKIPPED" : "FAILED";
        updated = await updatePrintStatus(bill.id, backendStatus);
      } catch (e) {
        console.warn("Failed to update print status", e);
      }
      setLastBill(updated);
      setMsg(`Billed ${updated.bill_number} → print ${updated.print_status}`);
      Alert.alert("Success", `Billed ${updated.bill_number}.`, [
        { text: "OK", onPress: () => {
          navigation.goBack();
        }}
      ]);
    } catch (e) {
      setMsg(getApiErrorMessage(e));
      Alert.alert("Error", getApiErrorMessage(e));
    } finally {
      setBilling(false);
    }
  };

  const shareBill = async () => {
    if (!lastBill) return;
    try {
      await shareWhatsAppBill(deliveryBillToPrintPayload(lastBill, stop, getItemName, receiptOpts));
      await markWhatsAppShared(lastBill.id);
      setMsg("WhatsApp share marked");
    } catch (e) {
      setMsg(getApiErrorMessage(e));
    }
  };

  const handlePrintReceipt = async () => {
    if (!lastBill) return;
    setPrinting(true);
    setMsg(null);
    try {
      const printStatus = await printThermalReceipt(
        deliveryBillToPrintPayload(lastBill, stop, getItemName, receiptOpts)
      );
      if (printStatus === "PRINTED") {
        await updatePrintStatus(lastBill.id, "PRINTED");
        setMsg("Receipt printed");
      } else if (printStatus === "SKIPPED") {
        setMsg("Print cancelled");
      } else {
        setPrinterModalVisible(true);
        setMsg("Printer not connected — set up printer");
      }
    } catch {
      setPrinterModalVisible(true);
      setMsg("Print failed — check printer setup");
    } finally {
      setPrinting(false);
    }
  };

  const updateWeight = (itemId: string, field: "boxes" | "weight", value: string) => {
    setWeights(prev => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || { boxes: "1", weight: "0" }),
        [field]: value
      }
    }));
  };

  return (
    <View className="flex-1 bg-surface-container-lowest" style={{ paddingTop: insets.top }}>
      <View className="h-16 flex-row items-center px-4 bg-surface-container-lowest border-b border-outline-variant/20 z-20">
        <Pressable 
          onPress={() => navigation.goBack()} 
          className="w-10 h-10 rounded-full items-center justify-center mr-3 active:bg-surface-variant/50 transition-colors"
        >
          <MaterialIcons name="arrow-back" size={24} className="text-on-surface" />
        </Pressable>
        <View className="flex-1">
          <Text className="font-label-sm font-bold text-primary uppercase tracking-widest mb-0.5">
            {isBilled ? "Delivery" : isWeighedOnly ? "Bill & print" : "Weighing"}
          </Text>
          <Text className="text-title-lg font-black text-on-surface tracking-tight" numberOfLines={1}>
            {stop.shop_name || stop.retailer_name}
          </Text>
        </View>
        <Pressable 
          onPress={() => setPrinterModalVisible(true)} 
          className="w-10 h-10 rounded-full items-center justify-center active:bg-surface-variant/50 transition-colors"
        >
          <MaterialIcons name="print" size={22} className="text-primary" />
        </Pressable>
      </View>

      <ScrollView className="flex-1 p-4" keyboardShouldPersistTaps="handled">
        {msg ? (
          <View className="bg-primary-container p-3 rounded-lg mb-4">
            <Text className="text-on-primary-container text-sm text-center">{msg}</Text>
          </View>
        ) : null}

        {(stop.items || []).map((item: any) => {
          const input = weights[item.item_id] || { boxes: "1", weight: "0" };
          const rate = Number(item.rate_per_kg || 0);
          const isKgAdjusted = item.original_requested_kg !== null && item.ordered_kg !== null && Number(item.ordered_kg) !== Number(item.original_requested_kg);
          return (
            <WeighingRow 
              key={item.item_id}
              item={item} 
              input={input} 
              rate={rate} 
              isKgAdjusted={isKgAdjusted} 
              itemName={getItemName(item.item_id)}
              onUpdate={updateWeight}
              readOnly={isReadOnly}
            />
          );
        })}

        {lastBill ? (
          <View className="bg-surface-container-lowest p-4 rounded-xl mb-4 border border-outline-variant/20">
            <Text className="font-bold text-on-surface mb-2">Bill {lastBill.bill_number}</Text>
            <Text className="text-on-surface-variant">Total ₹{lastBill.total_amount}</Text>
            <Text className="text-on-surface-variant text-sm mt-1">
              Cash ₹{lastBill.cash_payment} · UPI ₹{lastBill.upi_payment} · Balance ₹{lastBill.balance_amount}
            </Text>
          </View>
        ) : null}

        {!isReadOnly ? (
        <>
        <View className="bg-surface-container-lowest p-4 rounded-xl mb-6 border border-outline-variant/20 shadow-sm">
          <Text className="font-bold text-lg text-on-surface mb-3">Payment</Text>
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Text className="text-xs font-bold text-on-surface-variant mb-1 uppercase">Cash (₹)</Text>
              <TextInput
                className="border border-outline-variant rounded-lg px-3 py-2 bg-surface text-on-surface"
                value={cash}
                onChangeText={setCash}
                keyboardType="decimal-pad"
              />
            </View>
            <View className="flex-1">
              <Text className="text-xs font-bold text-on-surface-variant mb-1 uppercase">UPI (₹)</Text>
              <TextInput
                className="border border-outline-variant rounded-lg px-3 py-2 bg-surface text-on-surface"
                value={upi}
                onChangeText={setUpi}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
          <View className="mt-3">
            <Text className="text-xs font-bold text-on-surface-variant mb-1 uppercase">Notes (Optional)</Text>
            <TextInput
              className="border border-outline-variant rounded-lg px-3 py-2 bg-surface text-on-surface"
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g. Paid for previous bills too"
              placeholderTextColor="#9ca3af"
            />
          </View>
          
          <View className="flex-row items-center gap-2 mt-4 pt-4 border-t border-outline-variant/20">
            <Switch value={!skipPrint} onValueChange={(v) => setSkipPrint(!v)} />
            <Text className="text-on-surface font-bold">Print Receipt Automatically</Text>
          </View>
        </View>

        <PrimaryButton
          className="mb-6"
          onPress={weighAndBill}
          loading={billing}
          disabled={billing}
          title={billing ? "Processing..." : isWeighedOnly ? "Generate bill" : "Complete Delivery"}
        />
        </>
        ) : null}

        {lastBill ? (
          <View className="mb-6 gap-3">
            <PrimaryButton 
              title="Print Receipt" 
              icon="print" 
              variant="primary" 
              loading={printing}
              disabled={printing}
              onPress={handlePrintReceipt}
            />
            <PrimaryButton 
              variant="secondary" 
              onPress={shareBill} 
              title="Share on WhatsApp" 
              icon="share"
            />
          </View>
        ) : isWeighedOnly ? (
          <Text className="text-on-surface-variant text-center mb-6">
            Weighed — enter payment above and tap Generate bill to print.
          </Text>
        ) : null}
        
      </ScrollView>

      <PrinterSetupModal
        visible={printerModalVisible}
        onClose={() => setPrinterModalVisible(false)}
      />
    </View>
  );
}



const WeighingRow = React.memo(({ item, input, rate, isKgAdjusted, itemName, onUpdate, readOnly }: any) => {
  const weightNum = Number(input.weight || 0);
  const amount = weightNum * rate;

  return (
    <View className="bg-surface-container-lowest p-4 rounded-xl mb-4 border border-outline-variant/20 shadow-sm">
      <View className="flex-row justify-between items-center mb-1">
        <Text className="font-bold text-lg text-on-surface">{itemName}</Text>
        <View className="items-end">
          <Text className="text-xs text-on-surface-variant font-bold uppercase">Rate</Text>
          <Text className="text-sm font-bold text-primary">₹{rate.toLocaleString("en-IN", { maximumFractionDigits: 2 })}/kg</Text>
        </View>
      </View>

      <View className="flex-row items-center flex-wrap mb-3 gap-2">
        <View className="bg-primary-container/30 px-2 py-1 rounded">
          <Text className="text-xs font-medium text-on-surface">Ordered: {item.original_total_boxes || 0} boxes</Text>
        </View>
        <View className="bg-secondary-container/30 px-2 py-1 rounded">
          {isKgAdjusted ? (
             <Text className="text-xs font-medium text-on-surface">{item.ordered_kg} kg <Text className="text-error font-bold">(Changed by Traders)</Text></Text>
          ) : (
             <Text className="text-xs font-medium text-on-surface">{item.ordered_kg} kg</Text>
          )}
        </View>
      </View>

      <View className="flex-row gap-2 mb-3">
        <View className="flex-1">
          <Text className="text-xs font-bold text-on-surface-variant mb-1 uppercase">Boxes</Text>
          <TextInput
            className="border border-outline-variant rounded-lg px-3 py-2 bg-surface text-on-surface"
            value={input.boxes}
            onChangeText={(v) => onUpdate(item.item_id, "boxes", v)}
            keyboardType="number-pad"
            editable={!readOnly}
          />
        </View>
        <View className="flex-1">
          <Text className="text-xs font-bold text-on-surface-variant mb-1 uppercase">Weight (kg)</Text>
          <TextInput
            className="border border-outline-variant rounded-lg px-3 py-2 bg-surface text-on-surface"
            value={input.weight}
            onChangeText={(v) => onUpdate(item.item_id, "weight", v)}
            keyboardType="decimal-pad"
            editable={!readOnly}
          />
        </View>
      </View>

      <View className="bg-primary/5 p-3 rounded-lg border border-primary/10 flex-row justify-between items-center">
        <View>
          <Text className="text-xs font-bold text-primary uppercase">Weight</Text>
          <Text className="text-lg font-black text-primary">{weightNum.toLocaleString("en-IN", { maximumFractionDigits: 2 })} kg</Text>
        </View>
        <View className="items-end">
          <Text className="text-xs font-bold text-error uppercase">Amount</Text>
          <Text className="text-lg font-black text-error">₹{amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</Text>
        </View>
      </View>
    </View>
  );
});
