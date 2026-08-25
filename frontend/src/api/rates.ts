import { api } from "./client";
import type { Rate } from "../types/api";

export async function listRates(item_id?: string) {
  const params = item_id ? { item_id } : {};
  const { data } = await api.get<Rate[]>("/admin/rates", { params });
  return data;
}

export async function upsertRate(payload: {
  item_id: string;
  retailer_id?: string | null;
  rate_per_kg: string | number;
  effective_from?: string;
  effective_to?: string | null;
}) {
  const { data } = await api.put<Rate>("/admin/rates", payload);
  return data;
}
