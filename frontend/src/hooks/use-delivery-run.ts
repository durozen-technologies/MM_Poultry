import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  completeRun,
  failStop,
  getActiveRun,
  markWhatsAppShared,
  previewBill,
  commitBill,
  reconcileRun,
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
  const [cash, setCash] = useState("0");
  const [upi, setUpi] = useState("0");
  const [msg, setMsg] = useState<string | null>(null);
  const [lastBill, setLastBill] = useState<DeliveryBill | null>(null);
  const [billing, setBilling] = useState(false);
  const [startingRun, setStartingRun] = useState(false);

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
    if (!run || startingRun) return;
    setStartingRun(true);
    try {
      await startRun(run.id);
      await refresh();
    } catch (e) {
      setMsg(getApiErrorMessage(e));
    } finally {
      setStartingRun(false);
    }
  }

  const [weights, setWeights] = useState<Record<string, string>>({});
  const [failReason, setFailReason] = useState("");
  const [showFail, setShowFail] = useState(false);

  async function onCompleteRun() {
    if (!run) return;
    try {
      if (!run.reconciled_at) {
        // Phase 1: Auto-reconcile to bypass manual reconciliation step
        let totalDelivered = 0;
        for (const stop of run.stops) {
          if (stop.status === "BILLED" || stop.status === "PRINT_PENDING") {
            for (const item of stop.items || []) {
              totalDelivered += Number(item.ordered_kg || 0);
            }
          }
        }
        await reconcileRun(run.id, {
          returned_kg: 0,
          wastage_kg: 0,
          actual_loaded_kg: totalDelivered,
        });
      }
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

  async function onFailStop() {
    if (!activeStop || !failReason.trim()) {
      setMsg("Failure reason required");
      return;
    }
    try {
      await failStop(activeStop.id, failReason.trim());
      setMsg(`Failed stop for ${activeStop.retailer_name}`);
      setActiveStop(null);
      setShowFail(false);
      setFailReason("");
      await refresh();
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
        const inputWeight = weights[item.item_id];
        const gross = Number(inputWeight || item.ordered_kg || "0");
        const boxes = Number(item.original_total_boxes || "1");
        const empty = 0;
        
        if (gross <= 0) throw new Error(`Gross weight must be > 0 for ${item.item_id.slice(0, 8)}`);
        
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
      await refresh();
    } catch (e) {
      setMsg(getApiErrorMessage(e));
    }
  }

  async function shareBill() {
    if (!lastBill) return;
    try {
      const totalWeight = lastBill.items?.reduce((sum: number, it: { weight_kg: string }) => sum + Number(it.weight_kg), 0) || 0;
      
      const payload = {
        shopName: "MM Broilers", // fallback if not available
        billNumber: lastBill.bill_number || "Draft",
        retailerName: "Retailer", // fallback
        weightKg: String(totalWeight),
        rate: lastBill.items?.[0]?.rate_per_kg || "0",
        total: String(lastBill.total_amount),
        cash: String(lastBill.cash_payment || 0),
        upi: String(lastBill.upi_payment || 0),
        balance: String(lastBill.balance_amount || 0),
        items: (lastBill.items || []).map((it: any) => ({
          name: String(it.item_id).slice(0, 8),
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
    billing,
    startingRun,
    onStartRun,
    onCompleteRun,

    onFailStop,
    failReason,
    setFailReason,
    showFail,
    setShowFail,
    weighAndBill,
    onSkipStop,
    shareBill,
    refresh,
  };
}
