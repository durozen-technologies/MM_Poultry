import React, { useState, useEffect } from "react";
import { View, Text, TextInput, ScrollView, Alert, Pressable, Switch } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { PrimaryButton } from "../../components/ui/primary-button";
import { getApiErrorMessage } from "../../api/client";
import { weighStop, previewBill, commitBill, advancePayment, updatePrintStatus, markWhatsAppShared } from "../../api/delivery";
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
  
  const [lastBill, setLastBill] = useState<DeliveryBill | null>(null);
  const isReadOnly = isBilled || !!lastBill;
  
  const [weights, setWeights] = useState<Record<string, { boxes: string; weight: string }>>({});
  const [cash, setCash] = useState("0");
  const [upi, setUpi] = useState("0");
  const [notes, setNotes] = useState("");
  const [billing, setBilling] = useState(false);
  const [skipPrint, setSkipPrint] = useState(false);
  const [printerModalVisible, setPrinterModalVisible] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
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
          boxes: weighed ? String(item.delivered_boxes ?? "") : "",
          weight: weighed ? String(item.delivered_weight_kg ?? "") : "",
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
    setMsg("Saving delivery data...");
    const checkoutId = genCheckoutId(stop.id);
    
    try {
      const itemsPayload = (stop.items || []).map((item: any) => {
        const input = weights[item.item_id] || { boxes: "", weight: "" };
        const weight = Number(input.weight || "0");
        const boxes = Number(input.boxes || "0");
        
        if (boxes <= 0) throw new Error(`Please enter the boxes given for ${getItemName(item.item_id)}`);
        if (weight <= 0) throw new Error(`Please enter the delivered weight (kg) for ${getItemName(item.item_id)}`);
        
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

      // STEP 1: Save weigh data to database
      setMsg("Saving weights to server...");
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
      if (!weighDone) throw new Error("Failed to save weights");

      // Check if we should generate a bill or just a weighment slip
      const hasMissingPrices = stop.items.some(i => !i.rate_per_kg || Number(i.rate_per_kg) === 0);

      if (hasMissingPrices) {
        setMsg("Weights saved. (Awaiting Pricing)");
        if (cashNum > 0 || upiNum > 0) {
          setMsg("Recording payment...");
          try {
            await advancePayment(stop.id, {
              cash_payment: String(cashNum),
              upi_payment: String(upiNum),
              notes,
              items: [],
            });
          } catch (e) {
            console.warn("Failed to record advance payment", e);
            Alert.alert("Payment Error", "Failed to save payment. Please record it manually.");
          }
        }
        let printStatus: "PRINTED" | "FAILED" | "SKIPPED" = "SKIPPED";
        if (!skipPrint) {
          setMsg(`Data saved! Printing Weighment Slip...`);
          try {
              printStatus = await printThermalReceipt(
                deliveryBillToPrintPayload(
                  { 
                    bill_number: "WEIGH SLIP", 
                    items: stop.items.map(i => ({...i, amount: null, rate_per_kg: null, weight_kg: weights[i.item_id]?.weight || "0"})),
                    cash_payment: String(cashNum),
                    upi_payment: String(upiNum),
                    total_amount: "0",
                    balance_amount: "0",
                  } as any, 
                  stop, 
                  getItemName, 
                  receiptOpts
                )
              );
          } catch (printErr) {
            console.warn("Print error after save:", printErr);
            printStatus = "FAILED";
          }
        }
        Alert.alert("Success", `Weighment saved successfully.\nPrint: ${printStatus}`);
        navigation.goBack();
        return;
      }

      // STEP 2: Commit & save bill to database first
      setMsg("Saving bill to server...");
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
      if (!bill) throw new Error("Failed to commit and save bill");

      // THE DATA IS NOW CONFIRMED AND SAVED IN DATABASE!
      setLastBill(bill);
      setMsg(`Saved Bill #${bill.bill_number}`);

      // STEP 3: Print ONLY after data is saved
      let printStatus: "PRINTED" | "FAILED" | "SKIPPED" = "SKIPPED";
      if (!skipPrint) {
        setMsg(`Data saved! Printing receipt for ${bill.bill_number}...`);
        try {
          printStatus = await printThermalReceipt(
            deliveryBillToPrintPayload(bill, stop, getItemName, receiptOpts)
          );
        } catch (printErr) {
          console.warn("Print error after save:", printErr);
          printStatus = "FAILED";
        }

        try {
          const backendStatus = printStatus === "PRINTED" ? "PRINTED" : "FAILED";
          bill = await updatePrintStatus(bill.id, backendStatus);
          setLastBill(bill);
        } catch (e) {
          console.warn("Failed to update print status", e);
        }
      }

      if (printStatus === "PRINTED") {
        Alert.alert(
          "Delivery Complete",
          `Data saved to database and receipt printed!\n\nBill: ${bill.bill_number}`,
          [{ text: "OK", onPress: () => navigation.goBack() }]
        );
      } else if (!skipPrint && printStatus === "FAILED") {
        Alert.alert(
          "Data Saved Successfully",
          `✓ Data is saved in database!\nBill: ${bill.bill_number}\n\nPrinter was not connected or print failed. You can print receipt below or share on WhatsApp.`,
          [{ text: "OK" }]
        );
      } else {
        Alert.alert(
          "Data Saved Successfully",
          `✓ Data is saved in database!\nBill: ${bill.bill_number}`,
          [{ text: "OK", onPress: () => navigation.goBack() }]
        );
      }
    } catch (e) {
      setMsg(getApiErrorMessage(e));
      Alert.alert("Save Failed", getApiErrorMessage(e));
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
        ...(prev[itemId] || { boxes: "", weight: "" }),
        [field]: value
      }
    }));
  };

  const totalCalculatedAmount = (stop.items || []).reduce((sum: number, item: any) => {
    const input = weights[item.item_id] || { boxes: "", weight: "" };
    const w = Number(input.weight || 0);
    const r = Number(item.rate_per_kg || 0);
    return sum + (w * r);
  }, 0);

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

      <ScrollView 
        className="flex-1" 
        contentContainerStyle={{ 
          padding: 16, 
          paddingBottom: Math.max(insets.bottom + 32, 48) 
        }} 
        keyboardShouldPersistTaps="handled"
      >
        {msg ? (
          <View className="bg-primary-container p-3 rounded-lg mb-4">
            <Text className="text-on-primary-container text-sm text-center">{msg}</Text>
          </View>
        ) : null}

        {(stop.items || []).map((item: any) => {
          const input = weights[item.item_id] || { boxes: "", weight: "" };
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
          <View className="bg-surface-container-lowest p-5 rounded-2xl mb-6 border border-primary/30 shadow-sm">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="font-black text-xl text-primary">✓ Saved: Bill {lastBill.bill_number}</Text>
              <View className="bg-primary/10 px-2.5 py-1 rounded-lg">
                <Text className="text-xs font-bold text-primary">{lastBill.print_status || "SAVED"}</Text>
              </View>
            </View>
            <Text className="text-on-surface font-bold text-lg mb-1">Total ₹{lastBill.total_amount}</Text>
            <Text className="text-on-surface-variant text-sm">
              Cash ₹{lastBill.cash_payment} · UPI ₹{lastBill.upi_payment} · Balance ₹{lastBill.balance_amount}
            </Text>
          </View>
        ) : null}

        {!isReadOnly ? (
        <>
        <View className="bg-surface-container-lowest p-4 rounded-2xl mb-6 border border-outline-variant/20 shadow-sm">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="font-bold text-lg text-on-surface">Payment</Text>
            {totalCalculatedAmount > 0 && (
              <View className="flex-row items-center gap-1.5 bg-primary/10 px-3 py-1.5 rounded-xl border border-primary/20">
                <Text className="text-xs text-on-surface-variant font-bold uppercase">Total:</Text>
                <Text className="text-lg font-black text-primary">
                  ₹{totalCalculatedAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                </Text>
              </View>
            )}
          </View>
          <View className="flex-row gap-3 mb-3">
            <View className="flex-1">
              <View className="h-5 flex-row items-center mb-1.5">
                <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Cash (₹)</Text>
              </View>
              <TextInput
                className="h-12 border border-outline-variant rounded-xl px-4 bg-surface text-on-surface font-bold text-base"
                style={{
                  paddingVertical: 0,
                  textAlignVertical: "center",
                  includeFontPadding: false,
                }}
                value={cash}
                onChangeText={setCash}
                keyboardType="decimal-pad"
              />
            </View>
            <View className="flex-1">
              <View className="h-5 flex-row items-center mb-1.5">
                <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">UPI (₹)</Text>
              </View>
              <TextInput
                className="h-12 border border-outline-variant rounded-xl px-4 bg-surface text-on-surface font-bold text-base"
                style={{
                  paddingVertical: 0,
                  textAlignVertical: "center",
                  includeFontPadding: false,
                }}
                value={upi}
                onChangeText={setUpi}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
          <View>
            <View className="h-5 flex-row items-center mb-1.5">
              <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Notes (Optional)</Text>
            </View>
            <TextInput
              className="h-12 border border-outline-variant rounded-xl px-4 bg-surface text-on-surface font-medium text-base"
              style={{
                paddingVertical: 0,
                textAlignVertical: "center",
                includeFontPadding: false,
              }}
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g. Paid for previous bills too"
              placeholderTextColor="#9ca3af"
            />
          </View>
          
          <View className="flex-row items-center justify-between mt-4 pt-4 border-t border-outline-variant/20">
            <Text className="text-on-surface font-bold text-sm">Print Receipt Automatically</Text>
            <Switch value={!skipPrint} onValueChange={(v) => setSkipPrint(!v)} />
          </View>
        </View>

        <PrimaryButton
          className="mb-8"
          onPress={weighAndBill}
          loading={billing}
          disabled={billing}
          title={billing ? (msg || "Saving...") : isWeighedOnly ? "Save & Generate Bill" : "Save & Complete Delivery"}
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
            <PrimaryButton 
              variant="secondary" 
              onPress={() => navigation.goBack()} 
              title="Done & Back to Stops" 
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
    <View className="bg-surface-container-lowest p-4 rounded-2xl mb-4 border border-outline-variant/20 shadow-sm">
      {/* Item Name & Prominent Rate Badge */}
      <View className="flex-row justify-between items-center mb-4 pb-3 border-b border-outline-variant/20">
        <View className="flex-1 pr-3">
          <Text className="font-bold text-xl text-on-surface" numberOfLines={1}>
            {itemName}
          </Text>
        </View>
        <View className="bg-primary/10 px-3.5 py-2 rounded-xl border border-primary/20 flex-row items-center gap-1.5">
          <Text className="text-xs font-black text-primary/80 uppercase tracking-wider">RATE</Text>
          <Text className="text-xl font-black text-primary">
            ₹{rate.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
          </Text>
          <Text className="text-xs font-bold text-primary/70">/kg</Text>
        </View>
      </View>

      {/* Ordered Boxes & Ordered Weight */}
      <View className="flex-row gap-3 mb-3">
        <View className="flex-1">
          <View className="h-5 flex-row items-center mb-1.5">
            <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Ordered Boxes</Text>
          </View>
          <View className="border border-outline-variant rounded-xl px-4 bg-surface-container-high/60 justify-center h-12">
            <Text className="text-on-surface font-bold text-base" style={{ includeFontPadding: false }}>
              {item.original_total_boxes || 0}
            </Text>
          </View>
        </View>
        <View className="flex-1">
          <View className="h-5 flex-row items-center justify-between mb-1.5">
            <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Ordered Weight</Text>
            {isKgAdjusted && (
              <View className="bg-error/10 px-1.5 py-0.5 rounded">
                <Text className="text-[10px] text-error font-bold uppercase tracking-tight">Adjusted</Text>
              </View>
            )}
          </View>
          <View className="border border-outline-variant rounded-xl px-4 bg-surface-container-high/60 justify-center h-12">
            <Text className="text-on-surface font-bold text-base" style={{ includeFontPadding: false }}>
              {item.ordered_kg || "0"} kg
            </Text>
          </View>
        </View>
      </View>

      {/* Delivered Boxes Given & Weight */}
      <View className="flex-row gap-3 mb-4">
        <View className="flex-1">
          <View className="h-5 flex-row items-center mb-1.5">
            <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Boxes Given</Text>
          </View>
          <TextInput
            className="border border-outline-variant rounded-xl px-4 bg-surface text-on-surface font-bold text-base h-12"
            style={{
              paddingVertical: 0,
              textAlignVertical: "center",
              includeFontPadding: false,
            }}
            value={input.boxes}
            placeholder={item.original_total_boxes ? String(item.original_total_boxes) : "0"}
            placeholderTextColor="#9ca3af"
            onChangeText={(v) => onUpdate(item.item_id, "boxes", v)}
            keyboardType="number-pad"
            editable={!readOnly}
          />
        </View>
        <View className="flex-1">
          <View className="h-5 flex-row items-center mb-1.5">
            <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Weight (kg)</Text>
          </View>
          <TextInput
            className="border border-outline-variant rounded-xl px-4 bg-surface text-on-surface font-bold text-base h-12"
            style={{
              paddingVertical: 0,
              textAlignVertical: "center",
              includeFontPadding: false,
            }}
            value={input.weight}
            placeholder="0.000"
            placeholderTextColor="#9ca3af"
            onChangeText={(v) => onUpdate(item.item_id, "weight", v)}
            keyboardType="decimal-pad"
            editable={!readOnly}
          />
        </View>
      </View>

      {/* Delivered Weight & Amount Summary Card */}
      <View className="bg-primary/10 p-4 rounded-2xl border border-primary/20 flex-row justify-between items-center">
        <View>
          <Text className="text-xs font-bold text-primary uppercase tracking-wider mb-0.5">Delivered Weight</Text>
          <Text className="text-xl font-black text-primary">
            {weightNum > 0 ? `${weightNum.toLocaleString("en-IN", { maximumFractionDigits: 3 })} kg` : "0.000 kg"}
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-xs font-bold text-primary uppercase tracking-wider mb-0.5">Amount</Text>
          <Text className="text-2xl font-black text-primary">
            ₹{amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
          </Text>
        </View>
      </View>
    </View>
  );
});
