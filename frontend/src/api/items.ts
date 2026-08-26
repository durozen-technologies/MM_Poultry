import { api as client } from "./client";
import type { Item } from "../types/api";

type Page<T> = {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
};

export const apiItems = {
  list: async (activeOnly: boolean = false) => {
    const res = await client.get<Page<Item>>("/admin/items", {
      params: { active_only: activeOnly },
    });
    return res.data;
  },

  create: async (data: { name: string; default_price?: string; description?: string }) => {
    const res = await client.post<Item>("/admin/items", data);
    return res.data;
  },

  update: async (
    id: string,
    data: { name?: string; default_price?: string; description?: string; is_active?: boolean }
  ) => {
    const res = await client.patch<Item>(`/admin/items/${id}`, data);
    return res.data;
  },

  delete: async (id: string) => {
    await client.delete(`/admin/items/${id}`);
  },
};
