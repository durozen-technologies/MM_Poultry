import { api } from "./client";
import type { Rate } from "../types/api";

export async function listRates() {
  const { data } = await api.get<Rate[]>("/admin/rates");
  return data;
}

export async function upsertRate(payload: {
  retailer_id?: string | null;
  rate_per_kg: string | number;
  effective_from?: string;
  effective_to?: string | null;
}) {
  const { data } = await api.put<Rate>("/admin/rates", payload);
  return data;
}
