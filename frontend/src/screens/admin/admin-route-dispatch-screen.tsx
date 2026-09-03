import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createDeliveryRun, getDispatchToday } from "../../api/delivery";
import { useAdminDeliveryUsers, useAdminFarms, useAdminVehicles } from "../../hooks/use-queries";
import { AdminScreenContainer } from "../../components/admin/admin-screen-container";
import { AdminHeader } from "../../components/admin/admin-header";
import { AdminActionFooter } from "../../components/admin/admin-action-footer";
import { DispatchItemSummaryList } from "../../components/admin/dispatch-item-lines";
import type { DispatchItemSummary } from "../../types/api";

type Params = {
  routeId: string | null;
  routeName: string;
};

export function AdminRouteDispatchScreen({
  navigation,
  route,
}: {
  navigation: any;
  route: { params: Params };
}) {
  const { routeId, routeName } = route.params;
  const queryClient = useQueryClient();
  const { data: dispatch, isLoading } = useQuery({
    queryKey: ["admin", "dispatch", "today"],
    queryFn: getDispatchToday,
  });
  const { data: users = [] } = useAdminDeliveryUsers();
  const { data: vehicles = [] } = useAdminVehicles();
  const { data: farmsData } = useAdminFarms();

  const bucket = dispatch?.routes.find((r) =>
    routeId ? r.route_id === routeId : r.route_id === null
  );

  const loads = useMemo(
    () => farmsData?.loads?.filter((l) => l.status === "OPEN" || l.status === "IN_TRANSIT") ?? [],
    [farmsData?.loads]
  );

  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [selectedLoadIds, setSelectedLoadIds] = useState<Set<string>>(new Set());
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [driverId, setDriverId] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedKg = useMemo(() => {
    if (!bucket) return 0;
    return bucket.orders
      .filter((o) => selectedOrders.has(o.order_id))
      .reduce((sum, o) => sum + Number(o.requested_kg), 0);
  }, [bucket, selectedOrders]);

  const selectedItems = useMemo((): DispatchItemSummary[] => {
    if (!bucket) return [];
    const totals: Record<string, DispatchItemSummary> = {};
    for (const order of bucket.orders) {
      if (!selectedOrders.has(order.order_id)) continue;
      for (const line of order.items) {
        const existing = totals[line.item_id];
        if (!existing) {
          totals[line.item_id] = {
            item_id: line.item_id,
            item_name: line.item_name,
            total_boxes: line.total_boxes ?? 0,
            total_kg: String(line.requested_kg ?? 0),
          };
        } else {
          existing.total_boxes += line.total_boxes ?? 0;
          existing.total_kg = String(
            Number(existing.total_kg) + Number(line.requested_kg ?? 0)
          );
        }
      }
    }
    return Object.values(totals);
  }, [bucket, selectedOrders]);

  const toggleOrder = (id: string) => {
    setSelectedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleLoad = (id: string) => {
    setSelectedLoadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onCreate = useCallback(async () => {
    if (selectedOrders.size === 0) {
      setMsg({ text: "Select at least one order", ok: false });
      return;
    }
    if (!driverId || !vehicleId) {
      setMsg({ text: "Select driver and vehicle", ok: false });
      return;
    }
    if (selectedLoadIds.size === 0) {
      setMsg({ text: "Select at least one farm load", ok: false });
      return;
    }

    const driver = users.find((u) => u.id === driverId);
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    if (!driver || !vehicle) return;

    const loadIds = Array.from(selectedLoadIds);
    const perLoad = selectedKg / loadIds.length;
    const farm_load_allocations = loadIds.map((farm_load_id) => ({
      farm_load_id,
      allocated_kg: allocations[farm_load_id] || String(perLoad.toFixed(3)),
    }));

    setSubmitting(true);
    setMsg(null);
    try {
      await createDeliveryRun({
        order_ids: Array.from(selectedOrders),
        route_id: routeId ?? undefined,
        driver_user_id: driver.id,
        driver_name: driver.full_name || driver.username,
        vehicle_id: vehicle.id,
        vehicle_number: vehicle.number,
        farm_load_allocations,
      });
      await queryClient.invalidateQueries({ queryKey: ["admin", "dispatch"] });
      setMsg({ text: "Delivery run created", ok: true });
      navigation.goBack();
    } catch (e: any) {
      setMsg({ text: e?.response?.data?.error?.message || e.message || "Failed", ok: false });
    } finally {
      setSubmitting(false);
    }
  }, [
    selectedOrders,
    driverId,
    vehicleId,
    selectedLoadIds,
    users,
    vehicles,
    selectedKg,
    allocations,
    routeId,
    queryClient,
    navigation,
  ]);

  if (isLoading || !bucket) {
    return (
      <AdminScreenContainer header={<AdminHeader title={routeName} onBack={() => navigation.goBack()} />}>
        <ActivityIndicator className="mt-8" />
      </AdminScreenContainer>
    );
  }

  return (
    <AdminScreenContainer header={<AdminHeader title={routeName} subtitle="Create delivery run" onBack={() => navigation.goBack()} />}>
      {msg ? (
        <Text className={msg.ok ? "text-primary mb-2" : "text-error mb-2"}>{msg.text}</Text>
      ) : null}

      <Text className="font-label-lg font-semibold text-on-surface mb-2">Vehicle</Text>
        <View className="gap-2 mb-4">
          {vehicles.map((v) => (
            <Pressable
              key={v.id}
              onPress={() => setVehicleId(v.id)}
              className={`p-3 rounded-xl border ${vehicleId === v.id ? "border-primary bg-primary-container/20" : "border-outline-variant"}`}
            >
              <Text className={vehicleId === v.id ? "text-primary font-semibold" : "text-on-surface"}>
                {v.number}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text className="font-label-lg font-semibold text-on-surface mb-2">Driver</Text>
        <View className="gap-2 mb-4">
          {users.map((u) => (
            <Pressable
              key={u.id}
              onPress={() => setDriverId(u.id)}
              className={`p-3 rounded-xl border ${driverId === u.id ? "border-primary bg-primary-container/20" : "border-outline-variant"}`}
            >
              <Text className={driverId === u.id ? "text-primary font-semibold" : "text-on-surface"}>
                {u.full_name || u.username}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text className="font-label-lg font-semibold text-on-surface mb-2">Farm loads</Text>
        <View className="gap-2 mb-4">
          {loads.map((l) => (
            <View key={l.id} className="border border-outline-variant rounded-xl p-3">
              <Pressable onPress={() => toggleLoad(l.id)} className="flex-row justify-between items-center">
                <Text className="text-on-surface font-semibold">
                  {l.loaded_weight_kg} kg · {l.status}
                </Text>
                <MaterialIcons
                  name={selectedLoadIds.has(l.id) ? "check-circle" : "radio-button-unchecked"}
                  size={22}
                  className={selectedLoadIds.has(l.id) ? "text-primary" : "text-on-surface-variant"}
                />
              </Pressable>
              {selectedLoadIds.has(l.id) ? (
                <TextInput
                  className="mt-2 border border-outline-variant rounded-lg px-3 py-2 text-on-surface"
                  placeholder="Allocated kg"
                  keyboardType="decimal-pad"
                  value={allocations[l.id] ?? ""}
                  onChangeText={(v) => setAllocations((prev) => ({ ...prev, [l.id]: v }))}
                />
              ) : null}
            </View>
          ))}
          {loads.length === 0 ? (
            <Text className="text-on-surface-variant italic">No open loads</Text>
          ) : null}
        </View>

        <Text className="font-label-lg font-semibold text-on-surface mb-2">Selected</Text>
        <DispatchItemSummaryList
          items={selectedItems}
          emptyLabel="Select retailers below"
          className="gap-1 mb-4"
        />
        {selectedKg > 0 ? (
          <Text className="text-sm text-on-surface-variant mb-4">{selectedKg.toFixed(1)} kg total</Text>
        ) : null}

        <Text className="font-label-lg font-semibold text-on-surface mb-2">Retailers</Text>
        <View className="gap-2">
          {bucket.orders.map((o) => (
            <Pressable
              key={o.order_id}
              onPress={() => toggleOrder(o.order_id)}
              className={`p-3 rounded-xl border ${
                selectedOrders.has(o.order_id) ? "border-primary bg-primary-container/10" : "border-outline-variant"
              }`}
            >
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-on-surface font-semibold">{o.shop_name ?? o.retailer_id}</Text>
                <MaterialIcons
                  name={selectedOrders.has(o.order_id) ? "check-circle" : "radio-button-unchecked"}
                  size={22}
                  className={selectedOrders.has(o.order_id) ? "text-primary" : "text-on-surface-variant"}
                />
              </View>
              <View className="bg-surface-container-highest/30 rounded-xl p-2 border border-outline-variant/10">
                {o.items.map((it) => (
                  <View
                    key={it.item_id}
                    className="flex-row items-center justify-between py-1 border-b border-surface-variant/30 last:border-b-0"
                  >
                    <Text className="font-label-md text-on-surface font-semibold flex-1 pr-2">
                      {it.item_name ?? "Item"}
                    </Text>
                    <Text className="font-label-md text-on-surface-variant">
                      <Text className="font-bold text-on-surface">{it.total_boxes ?? 0}</Text> Box •{" "}
                      <Text className="font-bold text-on-surface">
                        {Number(it.requested_kg ?? 0).toFixed(1)}
                      </Text>{" "}
                      KG
                    </Text>
                  </View>
                ))}
                {o.items.length === 0 ? (
                  <Text className="text-on-surface-variant italic text-sm">No items listed</Text>
                ) : null}
              </View>
            </Pressable>
          ))}
          {bucket.orders.length === 0 ? (
            <Text className="text-on-surface-variant">No eligible orders for this route</Text>
          ) : null}
        </View>

      <AdminActionFooter
        primaryLabel={submitting ? "Creating…" : "Create delivery run"}
        onPrimaryPress={onCreate}
        isPrimaryDisabled={submitting}
        isPrimaryLoading={submitting}
      />
    </AdminScreenContainer>
  );
}
