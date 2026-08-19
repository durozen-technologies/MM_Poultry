import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { listFarms, listFarmLoads } from "../api/farms";
import { listTodayOrders } from "../api/orders";
import type { DailyOrderOut, FarmOut, FarmLoad, Retailer, OpsDashboard } from "../types/api";

export function useAdminTodayOrders() {
  return useQuery({
    queryKey: ["admin", "orders", "today"],
    queryFn: async () => {
      const { data } = await api.get<{ items: DailyOrderOut[]; total_requested_kg: string }>("/admin/orders/today");
      return data;
    },
  });
}

export function useAdminFarms() {
  return useQuery({
    queryKey: ["admin", "farms"],
    queryFn: async () => {
      const [farms, loads] = await Promise.all([listFarms(), listFarmLoads()]);
      return { farms, loads };
    },
  });
}

export function useAdminRetailers() {
  return useQuery({
    queryKey: ["admin", "retailers"],
    queryFn: async () => {
      const { data } = await api.get<{ items: Retailer[] }>("/admin/retailers");
      return data.items;
    },
  });
}

export function useAdminDashboard(dateStr: string | null) {
  return useQuery({
    queryKey: ["admin", "dashboard", dateStr],
    queryFn: async () => {
      if (!dateStr) return null;
      const { data } = await api.get<OpsDashboard>("/admin/dashboard", {
        params: { on_date: dateStr },
      });
      return data;
    },
    enabled: !!dateStr,
  });
}
