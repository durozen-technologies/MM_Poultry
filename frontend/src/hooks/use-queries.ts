import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { listFarms, listFarmLoads } from "../api/farms";
import { listTodayOrders } from "../api/orders";
import {
  getRoute,
  listRoutes,
  fetchAllUnassignedRetailers,
  listDeliveryRoutes,
} from "../api/routes";
import type {
  DailyOrderOut,
  FarmOut,
  FarmLoad,
  Retailer,
  OpsDashboard,
  TodayOrdersResponse,
  InventorySummaryOut,
  InventoryItemLoadsOut,
} from "../types/api";

export function useAdminInventory() {
  return useQuery({
    queryKey: ["admin", "inventory"],
    queryFn: async () => {
      const { data } = await api.get<InventorySummaryOut>("/admin/inventory");
      return data;
    },
  });
}

export function useAdminInventoryItemLoads(itemId: string) {
  return useQuery({
    queryKey: ["admin", "inventory", itemId],
    queryFn: async () => {
      const { data } = await api.get<InventoryItemLoadsOut>(`/admin/inventory/${itemId}/loads`);
      return data;
    },
    enabled: !!itemId,
  });
}

export function useAdminTodayOrders(options?: { routeId?: string | null; unassignedOnly?: boolean }) {
  const routeId = options?.routeId ?? null;
  const unassignedOnly = options?.unassignedOnly ?? false;
  return useQuery({
    queryKey: ["admin", "orders", "today", routeId, unassignedOnly],
    queryFn: async () => {
      const { data } = await api.get<TodayOrdersResponse>("/admin/orders/today", {
        params: {
          route_id: routeId || undefined,
          unassigned_only: unassignedOnly || undefined,
        },
      });
      return data;
    },
  });
}

export function useAdminRoutes() {
  return useQuery({
    queryKey: ["admin", "routes"],
    queryFn: listRoutes,
  });
}

export function useRouteDetail(routeId: string | null) {
  return useQuery({
    queryKey: ["admin", "routes", routeId],
    queryFn: () => getRoute(routeId!),
    enabled: !!routeId,
  });
}

export function useUnassignedRetailers() {
  return useQuery({
    queryKey: ["admin", "routes", "unassigned"],
    queryFn: fetchAllUnassignedRetailers,
  });
}

export function useDeliveryRoutes() {
  return useQuery({
    queryKey: ["delivery", "routes"],
    queryFn: listDeliveryRoutes,
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


export function useConfirmOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, expected_delivery_date }: { orderId: string, expected_delivery_date: string }) => {
      const { data } = await api.post(`/admin/orders/${orderId}/confirm`, { expected_delivery_date });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
  });
}

export function useAdminDeliveryUsers() {
  return useQuery({
    queryKey: ["admin", "users", "delivery"],
    queryFn: async () => {
      const { data } = await api.get<any[]>("/admin/users/delivery");
      return data;
    },
  });
}

export function useAdminVehicles() {
  return useQuery({
    queryKey: ["admin", "vehicles"],
    queryFn: async () => {
      const { data } = await api.get<any[]>("/admin/vehicles");
      return data;
    },
  });
}

export function useCreateDeliveryRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.post("/admin/delivery-runs", payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] });
    },
  });
}

