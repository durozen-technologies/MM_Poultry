import { api } from "./client";
import type {
  DailyOrder,
  DailyOrderCreate,
  DeliveryBill,
  LedgerOut,
  RetailerBillsPage,
  RetailerDashboard,
  RetailerOrderDetail,
  RetailerOrdersPage,
  RetailerProfile,
} from "../types/api";

export async function getRetailerDashboard() {
  const { data } = await api.get<RetailerDashboard>("/retailer/dashboard");
  return data;
}

export async function getTodayOrder() {
  const { data } = await api.get<DailyOrder | null>("/retailer/orders/today");
  return data;
}

export async function upsertTodayOrder(payload: DailyOrderCreate) {
  const { data } = await api.post<DailyOrder>("/retailer/orders/today", payload);
  return data;
}

export async function listRetailerOrders(params?: {
  scope?: "today" | "history";
  cursor?: string;
  limit?: number;
}) {
  const { data } = await api.get<RetailerOrdersPage>("/retailer/orders", { params });
  return data;
}

export async function getRetailerOrder(orderId: string) {
  const { data } = await api.get<RetailerOrderDetail>(`/retailer/orders/${orderId}`);
  return data;
}

export async function listRetailerBills(params?: { cursor?: string; limit?: number }) {
  const { data } = await api.get<RetailerBillsPage>("/retailer/bills", { params });
  return data;
}

export async function getRetailerBill(billId: string) {
  const { data } = await api.get<DeliveryBill>(`/retailer/bills/${billId}`);
  return data;
}

export async function getRetailerLedger() {
  const { data } = await api.get<LedgerOut>("/retailer/ledger");
  return data;
}

export async function getRetailerProfile() {
  const { data } = await api.get<RetailerProfile>("/retailer/profile");
  return data;
}
