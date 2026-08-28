import { api } from "./client";
import type { DeliveryBill, DeliveryRun, DeliveryStop } from "../types/api";

export async function createDeliveryRun(payload: {
  farm_load_id: string | null;
  order_ids: string[];
  run_date?: string;
}) {
  const { data } = await api.post<DeliveryRun>("/admin/delivery-runs", payload);
  return data;
}

export async function getActiveRun() {
  const { data } = await api.get<DeliveryRun | null>("/delivery/runs/active");
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

export async function skipStop(stopId: string) {
  const { data } = await api.post<DeliveryStop>(`/delivery/stops/${stopId}/skip`);
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
