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
import { getApiErrorMessage } from "../api/client";
import { readScaleWeight } from "../services/ble-scale";
import { printThermalReceipt, shareWhatsAppBill } from "../services/printer";
import type { DeliveryBill, DeliveryRun, DeliveryStop } from "../types/api";
import { getTripWeightLoss } from "../api/reports";

function genCheckoutId(stopId: string): string {
  return `chk-${stopId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useDeliveryRun() {
  const [run, setRun] = useState<DeliveryRun | null>(null);
  const [activeStop, setActiveStop] = useState<DeliveryStop | null>(null);
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [deliveredBoxes, setDeliveredBoxes] = useState<Record<string, string>>({});
  const [emptyBoxWeights, setEmptyBoxWeights] = useState<Record<string, string>>({});
  const [cash, setCash] = useState("0");
  const [upi, setUpi] = useState("0");
  const [msg, setMsg] = useState<string | null>(null);
  const [lastBill, setLastBill] = useState<DeliveryBill | null>(null);
  const [billing, setBilling] = useState(false);

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
      setMsg(getApiErrorMessage(e));
    }
  }

  async function onCompleteRun() {
    if (!run) return;
    try {
      await completeRun(run.id);
      const loss = await getTripWeightLoss(run.id);
      if (loss) {
        setMsg(`Run complete. Loss ${loss.loss_kg} kg (${loss.loss_pct}%)`);
      } else {
        setMsg(`Run complete.`);
      }
      await refresh();
    } catch (e: unknown) {
      setMsg(getApiErrorMessage(e));
    }
  }

  async function simulateScale(itemId: string) {
    try {
      const reading = await readScaleWeight();
      setWeights((prev) => ({ ...prev, [itemId]: String(reading.kg) }));
      setMsg(`Scale ${reading.source}: ${reading.kg} kg`);
    } catch (e) {
      setMsg(getApiErrorMessage(e));
    }
  }

  const weighAndBill = async (options?: { skipScale?: boolean; skipPrint?: boolean }) => {
    if (!activeStop || !run) return;
    setBilling(true);
    setMsg(null);
    // Idempotent checkout ID — keep stable across retries for same stop
    const checkoutId = genCheckoutId(activeStop.id);
    try {
      const itemsPayload = (activeStop.items || []).map((item) => {
        const gross = Number(weights[item.item_id] || "0");
        const boxes = Number(deliveredBoxes[item.item_id] || "0");
        const empty = Number(emptyBoxWeights[item.item_id] || "0");
        if (!Number.isFinite(gross) || !Number.isFinite(boxes) || !Number.isFinite(empty)) {
          throw new Error("Invalid weight or box input: check gross/boxes/empty");
        }
        if (gross <= 0) throw new Error(`Gross weight must be > 0 for ${item.item_id.slice(0, 8)}`);
        if (boxes <= 0) throw new Error(`Boxes must be > 0 for ${item.item_id.slice(0, 8)}`);
        const net = gross - boxes * empty;
        if (net <= 0) throw new Error(`Net weight must be > 0 (gross ${gross} - ${boxes}*${empty})`);
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

      // Step 1: Weigh — retry once on 503/429
      let weighDone = false;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          await weighStop(activeStop.id, {
            scale_device_id: options?.skipScale ? "MANUAL" : "BLE-SCALE",
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
          // 409 means already weighed — treat as success
          if (code === 409 && String(e?.message || "").includes("WEIGH")) {
            weighDone = true;
            break;
          }
          throw e;
        }
      }
      if (!weighDone) throw new Error("Weigh failed");

      const preview = await previewBill(activeStop.id, { cash_payment: String(cashNum), upi_payment: String(upiNum) });
      if (!preview) {
        throw new Error("Failed to preview bill");
      }

      // Step 2: Commit — idempotent via checkout_id; retry safe
      let bill: any = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          bill = await commitBill(activeStop.id, {
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

      // Step 3: Print — never fail the billing if print fails; update status accordingly
      let printStatus: "PRINTED" | "FAILED" | "SKIPPED" = "FAILED";
      if (options?.skipPrint) {
        printStatus = "SKIPPED";
      } else {
        try {
          printStatus = await printThermalReceipt({
            shopName: "Demo Wholesaler",
            billNumber: bill.bill_number,
            retailerName: activeStop.retailer_name || "",
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
        // Map frontend print result to backend PrintStatus enum
        const backendStatus = printStatus === "PRINTED" ? "PRINTED" : printStatus === "SKIPPED" ? "SKIPPED" : "FAILED";
        updated = await updatePrintStatus(bill.id, backendStatus);
      } catch (e) {
        // Print status update is non-critical; keep original bill
        console.warn("Failed to update print status", e);
      }
      setLastBill(updated);
      setMsg(`Billed ${updated.bill_number} → print ${updated.print_status}`);
      setActiveStop(null);
      setWeights({});
      setDeliveredBoxes({});
      setEmptyBoxWeights({});
      setCash("0");
      setUpi("0");
      await refresh();
    } catch (e) {
      setMsg(getApiErrorMessage(e));
    } finally {
      setBilling(false);
    }
  }

  async function onSkipStop() {
    if (!activeStop) return;
    try {
      await skipStop(activeStop.id);
      setMsg(`Skipped stop for ${activeStop.retailer_name}`);
      setActiveStop(null);
      setWeights({});
      setDeliveredBoxes({});
      setEmptyBoxWeights({});
      await refresh();
    } catch (e) {
      setMsg(getApiErrorMessage(e));
    }
  }

  async function shareBill() {
    if (!lastBill) return;
    try {
      const totalWeight = lastBill.items?.reduce((sum: number, it: { weight_kg: string }) => sum + Number(it.weight_kg), 0) || 0;
      await shareWhatsAppBill(
        `Bill ${lastBill.bill_number}\nWeight ${totalWeight} kg\nTotal ₹${lastBill.total_amount}\nBalance ₹${lastBill.balance_amount}`
      );
      await markWhatsAppShared(lastBill.id);
      setMsg("WhatsApp share marked");
    } catch (e) {
      setMsg(getApiErrorMessage(e));
    }
  }

  return {
    run,
    activeStop,
    setActiveStop,
    weights,
    setWeights,
    deliveredBoxes,
    setDeliveredBoxes,
    emptyBoxWeights,
    setEmptyBoxWeights,
    cash,
    setCash,
    upi,
    setUpi,
    msg,
    lastBill,
    billing,
    onStartRun,
    onCompleteRun,
    simulateScale,
    weighAndBill,
    onSkipStop,
    shareBill,
    refresh,
  };
}
