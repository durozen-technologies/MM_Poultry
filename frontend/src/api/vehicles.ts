import { api } from "./client";
import type { Vehicle } from "../types/api";

export async function listVehicles() {
  const { data } = await api.get<Vehicle[]>("/admin/vehicles");
  return data;
}

export async function createVehicle(payload: {
  number: string;
  capacity_kg?: string | number | null;
  driver_name?: string | null;
}) {
  const { data } = await api.post<Vehicle>("/admin/vehicles", payload);
  return data;
}

export async function updateVehicle(vehicleId: string, payload: Record<string, unknown>) {
  const { data } = await api.patch<Vehicle>(`/admin/vehicles/${vehicleId}`, payload);
  return data;
}

export async function deleteVehicle(vehicleId: string) {
  await api.delete(`/admin/vehicles/${vehicleId}`);
}
