import { api } from "./client";
import type { DailyOrder } from "../types/api";

export async function listTodayOrders() {
  const { data } = await api.get<{
    items: DailyOrder[];
    total_requested_kg: string;
    total_boxes: number;
    has_more: boolean;
    next_cursor: string | null;
  }>("/admin/orders/today");
  return data;
}

export async function listOrdersByDate(date?: string) {
  const params = date ? { date } : {};
  const { data } = await api.get<{
    items: DailyOrder[];
    total_requested_kg: string;
    total_boxes: number;
    has_more: boolean;
    next_cursor: string | null;
  }>("/admin/orders", { params });
  return data;
}

export async function cancelOrder(orderId: string) {
  const { data } = await api.post<DailyOrder>(`/admin/orders/${orderId}/cancel`);
  return data;
}

export async function confirmOrder(orderId: string, expected_delivery_date: string) {
  const { data } = await api.post<DailyOrder>(`/admin/orders/${orderId}/confirm`, { expected_delivery_date });
  return data;
}
