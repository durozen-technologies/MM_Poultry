import { api } from "./client";
import type { FarmLoad, FarmOut } from "../types/api";

export async function listFarms() {
  const { data } = await api.get<FarmOut[]>("/admin/farms");
  return data;
}

export async function getFarm(farmId: string) {
  const { data } = await api.get<FarmOut>(`/admin/farms/${farmId}`);
  return data;
}

export async function createFarm(payload: Record<string, unknown>) {
  const { data } = await api.post<FarmOut>("/admin/farms", payload);
  return data;
}

export async function updateFarm(farmId: string, payload: Record<string, unknown>) {
  const { data } = await api.patch<FarmOut>(`/admin/farms/${farmId}`, payload);
  return data;
}

export async function deleteFarm(farmId: string) {
  await api.delete(`/admin/farms/${farmId}`);
}

export async function listFarmLoads() {
  const { data } = await api.get<FarmLoad[]>("/admin/farm-loads");
  return data;
}

export async function createFarmLoad(payload: Record<string, unknown>) {
  const { data } = await api.post<FarmLoad>("/admin/farm-loads", payload);
  return data;
}

export async function updateFarmLoad(loadId: string, payload: Record<string, unknown>) {
  const { data } = await api.patch<FarmLoad>(`/admin/farm-loads/${loadId}`, payload);
  return data;
}
