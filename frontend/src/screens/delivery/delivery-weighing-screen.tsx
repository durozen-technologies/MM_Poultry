import React, { useState, useEffect } from "react";
import { View, Text, TextInput, ScrollView, Alert, SafeAreaView, Pressable, Switch } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { PrimaryButton } from "../../components/ui/primary-button";
import { getApiErrorMessage } from "../../api/client";
import { weighStop, previewBill, commitBill, updatePrintStatus, markWhatsAppShared, skipStop, failStop } from "../../api/delivery";
import { printThermalReceipt, shareWhatsAppBill } from "../../services/printer";
import { PrinterSetupModal } from "../../components/printer-setup-modal";
import { useQuery } from "@tanstack/react-query";
import { apiItems } from "../../api/items";

function genCheckoutId(stopId: string): string {
  return `chk-${stopId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function DeliveryWeighingScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const stop = route.params?.stop;
  
  const [weights, setWeights] = useState<Record<string, { gross: string, empty: string, boxes: string }>>({});
  const [cash, setCash] = useState("0");
  const [upi, setUpi] = useState("0");
  const [billing, setBilling] = useState(false);
  const [skipPrint, setSkipPrint] = useState(false);
  const [printerModalVisible, setPrinterModalVisible] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [lastBill, setLastBill] = useState<any | null>(null);
  
  const [showFail, setShowFail] = useState(false);
  const [failReason, setFailReason] = useState("");

  const { data: itemsPage } = useQuery({
    queryKey: ["delivery_items"],
    queryFn: () => apiItems.list(true),
  });
  const allItems = itemsPage?.items || [];
  const getItemName = (id: string) => allItems.find((i: any) => i.id === id)?.name || id.slice(0, 8);

  useEffect(() => {
    if (stop && stop.items) {
      const initialWeights: Record<string, any> = {};
      stop.items.forEach((item: any) => {
        initialWeights[item.item_id] = {
          gross: item.ordered_kg || "0",
          empty: "0",
          boxes: item.original_total_boxes || "1"
        };
      });
      setWeights(initialWeights);
    }
  }, [stop]);

  if (!stop) {
    return (
      <SafeAreaView className="flex-1 bg-surface justify-center items-center">
        <Text>Stop not found</Text>
        <PrimaryButton title="Go Back" onPress={() => navigation.goBack()} />
      </SafeAreaView>
    );
  }

  const weighAndBill = async () => {
    setBilling(true);
    setMsg(null);
    const checkoutId = genCheckoutId(stop.id);
    
    try {
      const itemsPayload = (stop.items || []).map((item: any) => {
        const input = weights[item.item_id] || { gross: "0", empty: "0", boxes: "1" };
        const gross = Number(input.gross || "0");
        const empty = Number(input.empty || "0");
        const boxes = Number(input.boxes || "1");
        
        if (gross <= 0) throw new Error(`Gross weight must be > 0 for ${item.item_id.slice(0, 8)}`);
        if (empty < 0) throw new Error(`Empty weight must be >= 0 for ${item.item_id.slice(0, 8)}`);
        if (boxes <= 0) throw new Error(`Boxes must be > 0 for ${item.item_id.slice(0, 8)}`);
        
        return {
          item_id: item.item_id,
          gross_weight_kg: gross,
          delivered_boxes: boxes,
          empty_box_weight_kg: empty,
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

      const preview = await previewBill(stop.id, { cash_payment: String(cashNum), upi_payment: String(upiNum) });
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

      const totalWeight = bill.items?.reduce((sum: number, it: { weight_kg: string }) => sum + Number(it.weight_kg), 0) || 0;
      const itemsForPrint = (bill.items || []).map((it: any) => ({
        name: it.item_id.slice(0, 8),
        weightKg: String(it.weight_kg),
        rate: String(it.rate_per_kg),
        amount: String(it.amount),
      }));

      // Step 3: Print
      let printStatus: "PRINTED" | "FAILED" | "SKIPPED" = "FAILED";
      if (skipPrint) {
        printStatus = "SKIPPED";
      } else {
        try {
          printStatus = await printThermalReceipt({
            shopName: "Demo Wholesaler",
            billNumber: bill.bill_number,
            retailerName: stop.retailer_name || "",
            weightKg: String(totalWeight),
            rate: "Mixed",
            total: bill.total_amount,
            cash: bill.cash_payment,
            upi: bill.upi_payment,
            balance: bill.balance_amount,
            items: itemsForPrint,
          });
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
          // In real app we might pass param back or rely on refresh
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
      const totalWeight = lastBill.items?.reduce((sum: number, it: { weight_kg: string }) => sum + Number(it.weight_kg), 0) || 0;
      
      const payload = {
        shopName: stop.shop_name || stop.retailer_name,
        billNumber: lastBill.bill_number || "Draft",
        retailerName: stop.retailer_name,
        weightKg: String(totalWeight),
        rate: lastBill.items?.[0]?.rate_per_kg || "0",
        total: String(lastBill.total_amount),
        cash: String(lastBill.cash_payment || 0),
        upi: String(lastBill.upi_payment || 0),
        balance: String(lastBill.balance_amount || 0),
        items: (lastBill.items || []).map((it: any) => ({
          name: getItemName(it.item_id),
          weightKg: String(it.weight_kg),
          rate: String(it.rate_per_kg),
          amount: String(it.amount),
        }))
      };

      await shareWhatsAppBill(payload);
      await markWhatsAppShared(lastBill.id);
      setMsg("WhatsApp share marked");
    } catch (e) {
      setMsg(getApiErrorMessage(e));
    }
  };

  const updateWeight = (itemId: string, field: "gross" | "empty" | "boxes", value: string) => {
    setWeights(prev => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || { gross: "0", empty: "0", boxes: "1" }),
        [field]: value
      }
    }));
  };

  const handleSkip = async () => {
    try {
      await skipStop(stop.id);
      Alert.alert("Skipped", `Skipped stop for ${stop.retailer_name}`, [
        { text: "OK", onPress: () => navigation.goBack() }
      ]);
    } catch (e) {
      setMsg(getApiErrorMessage(e));
      Alert.alert("Error", getApiErrorMessage(e));
    }
  };

  const handleFail = async () => {
    if (!failReason.trim()) {
      setMsg("Failure reason required");
      return;
    }
    try {
      await failStop(stop.id, failReason.trim());
      Alert.alert("Failed", `Failed stop for ${stop.retailer_name}`, [
        { text: "OK", onPress: () => navigation.goBack() }
      ]);
    } catch (e) {
      setMsg(getApiErrorMessage(e));
      Alert.alert("Error", getApiErrorMessage(e));
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="flex-row items-center px-4 py-3 bg-surface border-b border-outline-variant/20">
        <Pressable onPress={() => navigation.goBack()} className="mr-3 p-1">
          <MaterialIcons name="arrow-back" size={24} className="text-on-surface" />
        </Pressable>
        <Text className="text-xl font-bold text-on-surface flex-1">Weighing: {stop.retailer_name}</Text>
        <Pressable onPress={() => setPrinterModalVisible(true)} className="p-1">
          <MaterialIcons name="print" size={24} className="text-primary" />
        </Pressable>
      </View>

      <ScrollView className="flex-1 p-4" keyboardShouldPersistTaps="handled">
        {msg ? (
          <View className="bg-primary-container p-3 rounded-lg mb-4">
            <Text className="text-on-primary-container text-sm text-center">{msg}</Text>
          </View>
        ) : null}

        {(stop.items || []).map((item: any, idx: number) => {
          const input = weights[item.item_id] || { gross: "0", empty: "0", boxes: "1" };
          const grossNum = Number(input.gross || 0);
          const emptyNum = Number(input.empty || 0);
          const netWt = Math.max(0, grossNum - emptyNum);
          const rate = Number(item.rate_per_kg || 0);
          const amount = netWt * rate;
          
          const isKgAdjusted = item.original_requested_kg !== null && item.ordered_kg !== null && Number(item.ordered_kg) !== Number(item.original_requested_kg);

          return (
            <View key={item.item_id} className="bg-surface-container-lowest p-4 rounded-xl mb-4 border border-outline-variant/20 shadow-sm">
              <View className="flex-row justify-between items-center mb-1">
                <Text className="font-bold text-lg text-on-surface">{getItemName(item.item_id)}</Text>
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
                    onChangeText={(v) => updateWeight(item.item_id, "boxes", v)}
                    keyboardType="number-pad"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-bold text-on-surface-variant mb-1 uppercase">Gross (kg)</Text>
                  <TextInput
                    className="border border-outline-variant rounded-lg px-3 py-2 bg-surface text-on-surface"
                    value={input.gross}
                    onChangeText={(v) => updateWeight(item.item_id, "gross", v)}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-bold text-on-surface-variant mb-1 uppercase">Empty (kg)</Text>
                  <TextInput
                    className="border border-outline-variant rounded-lg px-3 py-2 bg-surface text-on-surface"
                    value={input.empty}
                    onChangeText={(v) => updateWeight(item.item_id, "empty", v)}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View className="bg-primary/5 p-3 rounded-lg border border-primary/10 flex-row justify-between items-center">
                <View>
                  <Text className="text-xs font-bold text-primary uppercase">Net Weight</Text>
                  <Text className="text-lg font-black text-primary">{netWt.toLocaleString("en-IN", { maximumFractionDigits: 2 })} kg</Text>
                </View>
                <View className="items-end">
                  <Text className="text-xs font-bold text-error uppercase">Amount</Text>
                  <Text className="text-lg font-black text-error">₹{amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</Text>
                </View>
              </View>
            </View>
          );
        })}

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
          
          <View className="flex-row items-center gap-2 mt-4 pt-4 border-t border-outline-variant/20">
            <Switch value={!skipPrint} onValueChange={(v) => setSkipPrint(!v)} />
            <Text className="text-on-surface font-bold">Print Receipt Automatically</Text>
          </View>
        </View>

        <PrimaryButton
          className="mb-4"
          onPress={weighAndBill}
          loading={billing}
          disabled={billing}
          title={billing ? "Processing..." : "Complete Delivery"}
        />

        {!showFail ? (
          <PrimaryButton
            className="mb-4"
            variant="error"
            onPress={() => setShowFail(true)}
            title="Fail Delivery"
          />
        ) : (
          <View className="bg-surface-container-lowest rounded-xl p-4 border border-error/30 mb-4">
            <Text className="font-bold text-on-surface mb-2">Failure reason (required)</Text>
            <View className="mb-2">
              <TextInput 
                className="border border-outline-variant rounded-lg px-3 py-2 bg-surface text-on-surface" 
                value={failReason} 
                onChangeText={setFailReason} 
                placeholder="e.g. Shop closed" 
                placeholderTextColor="#9ca3af" 
              />
            </View>
            <PrimaryButton className="mt-2" variant="error" onPress={handleFail} title="Confirm Failed Delivery" />
          </View>
        )}

        <PrimaryButton
          className="mb-6"
          variant="secondary"
          onPress={handleSkip}
          title="Skip Stop"
        />

        {lastBill ? (
          <PrimaryButton className="mb-6" variant="secondary" onPress={shareBill} title="Share Bill on WhatsApp" />
        ) : null}
        
      </ScrollView>

      <PrinterSetupModal
        visible={printerModalVisible}
        onClose={() => setPrinterModalVisible(false)}
      />
    </SafeAreaView>
  );
}
