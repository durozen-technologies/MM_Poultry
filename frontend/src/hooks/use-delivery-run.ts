import { useCallback, useState, useMemo } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  completeRun,
  getActiveRun,
  markWhatsAppShared,
  previewBill,
  commitBill,
  reconcileRun,
  startRun,
  updatePrintStatus,
  weighStop,
} from "../api/delivery";
import { getApiErrorMessage } from "../api/client";
import { readScaleWeight } from "../services/ble-scale";
import { printThermalReceipt, shareWhatsAppBill, deliveryBillToPrintPayload } from "../services/printer";
import { buildWeighPayload, safeWeighStop, safeCommitBill } from "../utils/billing";
import type { DeliveryBill, DeliveryRun, DeliveryStop } from "../types/api";
import { getTripWeightLoss } from "../api/reports";
import { useAuthStore } from "../store/auth-store";

function genCheckoutId(stopId: string): string {
  return `chk-${stopId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useDeliveryRun() {
  const [runs, setRuns] = useState<DeliveryRun[]>([]);
  const [activeStop, setActiveStop] = useState<DeliveryStop | null>(null);
  const [cash, setCash] = useState("0");
  const [upi, setUpi] = useState("0");
  const [msg, setMsg] = useState<string | null>(null);
  const [lastBill, setLastBill] = useState<DeliveryBill | null>(null);
  const [lastBilledStop, setLastBilledStop] = useState<DeliveryStop | null>(null);
  const [billing, setBilling] = useState(false);
  const [startingRun, setStartingRun] = useState(false);
  const organizationName = useAuthStore((s) => s.user?.organization_name);
  const receiptOpts = { organizationName };

  const refresh = useCallback(async () => {
    try {
      const data = await getActiveRun();
      setRuns(data || []);
    } catch (e) {
      setRuns([]);
    }
  }, []);

  const run = useMemo(() => {
    if (runs.length === 0) return null;
    const merged = { ...runs[0] };
    merged.stops = runs.flatMap(r => r.stops).sort((a, b) => a.sequence - b.sequence);
    return merged;
  }, [runs]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  async function onStartRun() {
    if (runs.length === 0 || startingRun) return;
    setStartingRun(true);
    try {
      for (const r of runs) {
        if (r.status === "PENDING") {
          await startRun(r.id);
        }
      }
      await refresh();
    } catch (e) {
      setMsg(getApiErrorMessage(e));
    } finally {
      setStartingRun(false);
    }
  }

  const [weights, setWeights] = useState<Record<string, string>>({});

  async function onCompleteRun() {
    if (runs.length === 0) return;
    try {
      for (const r of runs) {
        if (!r.reconciled_at) {
          let totalDelivered = 0;
          for (const stop of r.stops) {
            if (stop.status === "BILLED" || stop.status === "PRINT_PENDING") {
              for (const item of stop.items || []) {
                totalDelivered += Number(item.delivered_weight_kg ?? item.ordered_kg ?? 0);
              }
            }
          }
          await reconcileRun(r.id, {
            returned_kg: 0,
            wastage_kg: 0,
            actual_loaded_kg: totalDelivered,
          });
        }
        await completeRun(r.id);
      }
      setMsg(`All active runs completed.`);
      await refresh();
    } catch (e: unknown) {
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
      const payload = buildWeighPayload(activeStop, weights, options?.skipScale);

      const cashNum = Number(cash);
      const upiNum = Number(upi);
      if (!Number.isFinite(cashNum) || !Number.isFinite(upiNum) || cashNum < 0 || upiNum < 0) {
        throw new Error("Invalid cash/UPI amount");
      }

      await safeWeighStop(weighStop, activeStop.id, payload);

      const preview = await previewBill(activeStop.id, { cash_payment: String(cashNum), upi_payment: String(upiNum) });
      if (!preview) {
        throw new Error("Failed to preview bill");
      }

      const bill = await safeCommitBill(commitBill, activeStop.id, {
        cash_payment: String(cashNum),
        upi_payment: String(upiNum),
        print_status: "PENDING",
        checkout_id: checkoutId,
      });

      if (!bill) throw new Error("Commit failed");

      const totalWeight = bill.items?.reduce((sum: number, it: { weight_kg: string }) => sum + Number(it.weight_kg), 0) || 0;

      // Step 3: Print — never fail the billing if print fails; update status accordingly
      let printStatus: "PRINTED" | "FAILED" | "SKIPPED" = "FAILED";
      if (options?.skipPrint) {
        printStatus = "SKIPPED";
      } else {
        try {
          printStatus = await printThermalReceipt(
            deliveryBillToPrintPayload(bill, activeStop, (id) => id.slice(0, 8), receiptOpts)
          );
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
      setLastBilledStop(activeStop);
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

  async function shareBill() {
    if (!lastBill || !lastBilledStop) return;
    try {
      await shareWhatsAppBill(
        deliveryBillToPrintPayload(lastBill, lastBilledStop, (id) => id.slice(0, 8), receiptOpts)
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
    weighAndBill,
    shareBill,
    refresh,
  };
}
