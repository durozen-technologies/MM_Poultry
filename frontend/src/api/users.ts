import { api } from "./client";
import type { DeliveryUserCreate, User } from "../types/api";

export async function listDeliveryUsers() {
  const { data } = await api.get<User[]>("/admin/users/delivery");
  return data;
}

export async function createDeliveryUser(payload: DeliveryUserCreate) {
  const { data } = await api.post<User>("/admin/users/delivery", payload);
  return data;
}

export async function updateDeliveryUser(
  userId: string,
  payload: { is_active?: boolean; password?: string; full_name?: string | null; mobile_number?: string | null }
) {
  const { data } = await api.patch<User>(`/admin/users/delivery/${userId}`, payload);
  return data;
}

export async function deleteDeliveryUser(userId: string): Promise<void> {
  await api.delete(`/admin/users/delivery/${userId}`);
}

export async function listRetailerUsers(): Promise<User[]> {
  const { data } = await api.get<User[]>("/admin/users/retailer");
  return data;
}

export async function updateRetailerUser(
  userId: string,
  payload: { is_active?: boolean; password?: string }
): Promise<User> {
  const { data } = await api.patch<User>(`/admin/users/retailer/${userId}`, payload);
  return data;
}

export async function deleteRetailerUser(userId: string): Promise<void> {
  await api.delete(`/admin/users/retailer/${userId}`);
}
