import { api } from "./client";
import type { DeliveryBill, DeliveryRun, DeliveryStop, DispatchTodayOut } from "../types/api";

export type FarmLoadAllocationPayload = {
  farm_load_id: string;
  allocated_kg: string | number;
};

export async function getDispatchToday() {
  const { data } = await api.get<DispatchTodayOut>("/admin/dispatch/today");
  return data;
}

export async function createDeliveryRun(payload: {
  farm_load_id?: string | null;
  farm_load_allocations?: FarmLoadAllocationPayload[];
  order_ids: string[];
  run_date?: string;
  route_id?: string | null;
  driver_user_id?: string;
  driver_name?: string;
  vehicle_id?: string;
  vehicle_number?: string;
}) {
  const { data } = await api.post<DeliveryRun>("/admin/delivery-runs", payload);
  return data;
}

export async function cancelDeliveryRun(runId: string, reason?: string) {
  const { data } = await api.post<DeliveryRun>(`/admin/delivery-runs/${runId}/cancel`, {
    reason,
  });
  return data;
}

export async function reconcileRun(
  runId: string,
  payload: {
    returned_kg: string | number;
    wastage_kg: string | number;
    actual_loaded_kg?: string | number;
    notes?: string;
  }
) {
  const { data } = await api.post<DeliveryRun>(`/delivery/runs/${runId}/reconcile`, payload);
  return data;
}

export async function getActiveRun() {
  const { data } = await api.get<DeliveryRun | null>("/delivery/runs/active");
  return data;
}

export async function listDeliveryRuns(limit = 20, offset = 0) {
  const { data } = await api.get<DeliveryRun[]>("/admin/delivery-runs", { params: { limit, offset } });
  return data;
}

export async function startRun(runId: string) {
  const { data } = await api.post<DeliveryRun>(`/delivery/runs/${runId}/start`);
  return data;
}

export async function completeRun(runId: string) {
  const { data } = await api.post<DeliveryRun>(`/delivery/runs/${runId}/complete`);
  return data;
}

export async function weighStop(stopId: string, payload: Record<string, unknown>) {
  const { data } = await api.post<DeliveryStop>(`/delivery/stops/${stopId}/weigh`, payload);
  return data;
}

export async function skipStop(stopId: string, reason?: string) {
  const payload = reason ? { reason } : {};
  const { data } = await api.post<DeliveryStop>(`/delivery/stops/${stopId}/skip`, payload);
  return data;
}

export async function failStop(stopId: string, failure_reason: string) {
  const { data } = await api.post<DeliveryStop>(`/delivery/stops/${stopId}/fail`, {
    failure_reason,
  });
  return data;
}

export async function previewBill(stopId: string, payload: { cash_payment: string; upi_payment: string }) {
  const { data } = await api.post(`/delivery/stops/${stopId}/bill/preview`, payload);
  return data;
}

export async function commitBill(stopId: string, payload: Record<string, unknown>) {
  const { data } = await api.post<DeliveryBill>(`/delivery/stops/${stopId}/bill/commit`, payload);
  return data;
}

export async function updatePrintStatus(billId: string, printStatus: string) {
  const { data } = await api.patch<DeliveryBill>(`/delivery/bills/${billId}/print-status`, {
    print_status: printStatus,
  });
  return data;
}

export async function markWhatsAppShared(billId: string) {
  const { data } = await api.patch<DeliveryBill>(`/delivery/bills/${billId}/whatsapp`);
  return data;
}
