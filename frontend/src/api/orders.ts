import { api } from "./client";
import type { DailyOrder } from "../types/api";

export async function listTodayOrders() {
  const { data } = await api.get<{
    items: DailyOrder[];
    total_requested_kg: string;
    has_more: boolean;
    next_cursor: string | null;
  }>("/admin/orders/today");
  return data;
}
