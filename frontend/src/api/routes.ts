import { api } from "./client";
import type { Route, RouteDetail, Retailer, TodayOrdersResponse } from "../types/api";

export async function listRoutes() {
  const { data } = await api.get<Route[]>("/admin/routes");
  return data;
}

export async function getRoute(routeId: string) {
  const { data } = await api.get<RouteDetail>(`/admin/routes/${routeId}`);
  return data;
}

export async function createRoute(payload: {
  name: string;
  area?: string | null;
  description?: string | null;
  sort_order?: number | null;
}) {
  const { data } = await api.post<Route>("/admin/routes", payload);
  return data;
}

export async function updateRoute(routeId: string, payload: Record<string, unknown>) {
  const { data } = await api.patch<Route>(`/admin/routes/${routeId}`, payload);
  return data;
}

export async function deactivateRoute(routeId: string) {
  await api.delete(`/admin/routes/${routeId}`);
}

export async function replaceRouteRetailers(routeId: string, retailerIds: string[]) {
  const { data } = await api.put<RouteDetail>(`/admin/routes/${routeId}/retailers`, {
    retailer_ids: retailerIds,
  });
  return data;
}

export type CursorPage<T> = {
  items: T[];
  has_more: boolean;
  next_cursor: string | null;
  total_count?: number | null;
};

export async function listUnassignedRetailers(cursor?: string | null, limit = 50) {
  const { data } = await api.get<CursorPage<Retailer>>(
    "/admin/routes/unassigned-retailers",
    { params: { cursor: cursor || undefined, limit } }
  );
  return data;
}

export async function fetchAllUnassignedRetailers() {
  const items: Retailer[] = [];
  let cursor: string | null = null;
  do {
    const page = await listUnassignedRetailers(cursor, 200);
    items.push(...page.items);
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return items;
}

export async function listDeliveryRoutes() {
  const { data } = await api.get<Route[]>("/delivery/routes");
  return data;
}

export async function listDeliveryRouteOrders(routeId: string) {
  const { data } = await api.get<TodayOrdersResponse>(`/delivery/routes/${routeId}/orders`);
  return data;
}
