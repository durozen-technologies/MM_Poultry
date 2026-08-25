import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  completeRun,
  getActiveRun,
  markWhatsAppShared,
  previewBill,
  commitBill,
  skipStop,
  startRun,
  updatePrintStatus,
  weighStop,
} from "../api/delivery";
import { readScaleWeight } from "../services/ble-scale";
import { printThermalReceipt, shareWhatsAppBill } from "../services/printer";
import type { DeliveryBill, DeliveryRun, DeliveryStop } from "../types/api";
import { getTripWeightLoss } from "../api/reports";

export function useDeliveryRun() {
  const [run, setRun] = useState<DeliveryRun | null>(null);
  const [activeStop, setActiveStop] = useState<DeliveryStop | null>(null);
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [cash, setCash] = useState("0");
  const [upi, setUpi] = useState("0");
  const [msg, setMsg] = useState<string | null>(null);
  const [lastBill, setLastBill] = useState<DeliveryBill | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await getActiveRun();
      setRun(data);
    } catch (e) {
      setRun(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  async function onStartRun() {
    if (!run) return;
    try {
      await startRun(run.id);
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to start run");
    }
  }

  async function onCompleteRun() {
    if (!run) return;
    try {
      await completeRun(run.id);
      const loss = await getTripWeightLoss(run.id);
      setMsg(`Run complete. Loss ${loss.loss_kg} kg (${loss.loss_pct}%)`);
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to complete run");
    }
  }

  async function simulateScale(itemId: string) {
    try {
      const reading = await readScaleWeight();
      setWeights((prev) => ({ ...prev, [itemId]: String(reading.kg) }));
      setMsg(`Scale ${reading.source}: ${reading.kg} kg`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Scale read failed");
    }
  }

  async function weighAndBill() {
    if (!activeStop) return;
    setMsg(null);
    try {
      const itemsPayload = (activeStop.items || []).map((item) => ({
        item_id: item.item_id,
        delivered_weight_kg: weights[item.item_id] || "0",
        delivered_bird_count: 0,
      }));

      await weighStop(activeStop.id, {
        scale_device_id: "SIM-SCALE",
        items: itemsPayload,
      });

      await previewBill(activeStop.id, { cash_payment: cash, upi_payment: upi });
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
        weightKg: String(bill.items?.reduce((sum: number, it: any) => sum + Number(it.weight_kg), 0) || 0),
        rate: "Mixed",
        total: bill.total_amount,
        cash: bill.cash_payment,
        upi: bill.upi_payment,
        balance: bill.balance_amount,
      });

      const updated = await updatePrintStatus(bill.id, printStatus);
      setLastBill(updated);
      setMsg(`Billed ${updated.bill_number} → print ${updated.print_status}`);
      setActiveStop(null);
      setWeights({});
      setCash("0");
      setUpi("0");
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to bill");
    }
  }

  async function onSkipStop() {
    if (!activeStop) return;
    try {
      await skipStop(activeStop.id);
      setMsg(`Skipped stop for ${activeStop.retailer_name}`);
      setActiveStop(null);
      setWeights({});
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to skip");
    }
  }

  async function shareBill() {
    if (!lastBill) return;
    try {
      const totalWeight = lastBill.items?.reduce((sum: number, it: any) => sum + Number(it.weight_kg), 0) || 0;
      await shareWhatsAppBill(
        `Bill ${lastBill.bill_number}\nWeight ${totalWeight} kg\nTotal ₹${lastBill.total_amount}\nBalance ₹${lastBill.balance_amount}`
      );
      await markWhatsAppShared(lastBill.id);
      setMsg("WhatsApp share marked");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to share");
    }
  }

  return {
    run,
    activeStop,
    setActiveStop,
    weights,
    setWeights,
    cash,
    setCash,
    upi,
    setUpi,
    msg,
    lastBill,
    onStartRun,
    onCompleteRun,
    simulateScale,
    weighAndBill,
    onSkipStop,
    shareBill,
  };
}
