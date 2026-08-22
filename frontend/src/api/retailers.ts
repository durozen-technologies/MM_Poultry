import { api } from "./client";
import type { LedgerOut, Retailer } from "../types/api";

export async function listRetailers(cursor?: string, limit = 50) {
  const { data } = await api.get<{ items: Retailer[]; has_more: boolean; next_cursor: string | null }>(
    "/admin/retailers",
    { params: { cursor, limit } }
  );
  return data;
}

export async function getRetailer(retailerId: string) {
  const { data } = await api.get<Retailer>(`/admin/retailers/${retailerId}`);
  return data;
}

export async function createRetailer(payload: Record<string, unknown>) {
  const { data } = await api.post<Retailer>("/admin/retailers", payload);
  return data;
}

export async function updateRetailer(retailerId: string, payload: Record<string, unknown>) {
  const { data } = await api.patch<Retailer>(`/admin/retailers/${retailerId}`, payload);
  return data;
}

export async function deleteRetailer(retailerId: string) {
  await api.delete(`/admin/retailers/${retailerId}`);
}

export async function getLedger(retailerId: string) {
  const { data } = await api.get<LedgerOut>(`/admin/retailers/${retailerId}/ledger`);
  return data;
}

export async function recordPayment(
  retailerId: string,
  payload: { cash_amount: string; upi_amount: string; payment_date?: string; notes?: string; type?: string; is_credit?: boolean }
) {
  const { data } = await api.post(`/admin/retailers/${retailerId}/payments`, payload);
  return data;
}

export async function createReturn(
  retailerId: string,
  payload: { weight_kg: string; rate_per_kg: string; total_amount: string; reason?: string; bird_count?: number }
) {
  const { data } = await api.post(`/admin/retailers/${retailerId}/returns`, payload);
  return data;
}

export async function createRetailerPortalUser(
  retailerId: string,
  payload: { username: string; password: string; }
) {
  const { data } = await api.post(`/admin/retailers/${retailerId}/portal-user`, payload);
  return data;
}
