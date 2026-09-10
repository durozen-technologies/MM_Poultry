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
import { getApiErrorMessage } from "../../api/client";
import { useAdminDeliveryUsers, useAdminFarms } from "../../hooks/use-queries";
import { AdminScreenContainer } from "../../components/admin/admin-screen-container";
import { AdminHeader } from "../../components/admin/admin-header";
import { AdminActionFooter } from "../../components/admin/admin-action-footer";
import { DispatchItemSummaryList } from "../../components/admin/dispatch-item-lines";
import type { DispatchItemSummary } from "../../types/api";

type Params = {
  routeId: string | null;
  routeName: string;
};

function matchRouteBucket(
  bucketRouteId: string | null | undefined,
  targetRouteId: string | null | undefined
) {
  if (!targetRouteId) return bucketRouteId == null;
  return bucketRouteId != null && String(bucketRouteId) === String(targetRouteId);
}

export function AdminRouteDispatchScreen({
  navigation,
  route,
}: {
  navigation: any;
  route: any;
}) {
  const { routeId, routeName } = route.params;
  const queryClient = useQueryClient();
  const { data: dispatch, isLoading } = useQuery({
    queryKey: ["admin", "dispatch", "today"],
    queryFn: getDispatchToday,
  });
  const { data: users = [] } = useAdminDeliveryUsers();

  const { data: farmsData } = useAdminFarms();

  const bucket = dispatch?.routes.find((r) => matchRouteBucket(r.route_id, routeId));

  const loads = useMemo(
    () => farmsData?.loads?.filter((l) => l.status === "OPEN" || l.status === "IN_TRANSIT") ?? [],
    [farmsData?.loads]
  );

  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [selectedLoadIds, setSelectedLoadIds] = useState<Set<string>>(new Set());
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [itemAdjustments, setItemAdjustments] = useState<Record<string, string>>({});
  const [driverId, setDriverId] = useState<string | null>(null);

  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedKg = useMemo(() => {
    if (!bucket) return 0;
    return bucket.orders
      .filter((o) => selectedOrders.has(o.order_id))
      .reduce((sum, o) => {
        const orderKg = o.items.reduce((s, it) => {
           const adj = itemAdjustments[`${o.order_id}_${it.item_id}`];
           return s + Number(adj !== undefined ? adj : (it.requested_kg ?? 0));
        }, 0);
        return sum + orderKg;
      }, 0);
  }, [bucket, selectedOrders, itemAdjustments]);

  const selectedItems = useMemo((): DispatchItemSummary[] => {
    if (!bucket) return [];
    const totals: Record<string, DispatchItemSummary> = {};
    for (const order of bucket.orders) {
      if (!selectedOrders.has(order.order_id)) continue;
      for (const line of order.items) {
        const existing = totals[line.item_id];
        const adj = itemAdjustments[`${order.order_id}_${line.item_id}`];
        const qty = Number(adj !== undefined ? adj : (line.requested_kg ?? 0));
        
        if (!existing) {
          totals[line.item_id] = {
            item_id: line.item_id,
            item_name: line.item_name,
            total_boxes: line.total_boxes ?? 0,
            total_kg: String(qty),
          };
        } else {
          existing.total_boxes += line.total_boxes ?? 0;
          existing.total_kg = String(
            Number(existing.total_kg) + qty
          );
        }
      }
    }
    return Object.values(totals);
  }, [bucket, selectedOrders, itemAdjustments]);

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
    if (!driverId) {
      setMsg({ text: "Select driver", ok: false });
      return;
    }

    const driver = users.find((u) => u.id === driverId);
    if (!driver) {
      setMsg({ text: "Selected driver is no longer available", ok: false });
      return;
    }

    const loadIds = Array.from(selectedLoadIds);
    const farm_load_allocations = loadIds
      .map((farm_load_id) => ({
        farm_load_id,
        allocated_kg:
          allocations[farm_load_id] ||
          (loadIds.length > 0 ? String((selectedKg / loadIds.length).toFixed(3)) : "0"),
      }))
      .filter((row) => Number(row.allocated_kg) > 0);

    const order_adjustments = Object.entries(itemAdjustments)
      .filter(([, v]) => v.trim() !== "" && Number(v) > 0)
      .map(([k, v]) => {
        const sep = k.indexOf("_");
        return {
          order_id: k.slice(0, sep),
          item_id: k.slice(sep + 1),
          requested_kg: v,
        };
      });

    setSubmitting(true);
    setMsg(null);
    try {
      await createDeliveryRun({
        order_ids: Array.from(selectedOrders),
        ...(order_adjustments.length > 0 ? { order_adjustments } : {}),
        route_id: routeId ?? undefined,
        driver_user_id: driver.id,
        driver_name: driver.full_name || driver.username,
        ...(farm_load_allocations.length > 0 ? { farm_load_allocations } : {}),
      });
      await queryClient.invalidateQueries({ queryKey: ["admin", "dispatch"] });
      setMsg({ text: "Delivery run created", ok: true });
      navigation.goBack();
    } catch (e: unknown) {
      setMsg({ text: getApiErrorMessage(e), ok: false });
    } finally {
      setSubmitting(false);
    }
  }, [
    selectedOrders,
    driverId,
    users,
    selectedKg,
    selectedLoadIds,
    allocations,
    itemAdjustments,
    routeId,
    queryClient,
    navigation,
  ]);

  if (isLoading) {
    return (
      <AdminScreenContainer header={<AdminHeader title={routeName} onBack={() => navigation.goBack()} />}>
        <ActivityIndicator className="mt-8" />
      </AdminScreenContainer>
    );
  }

  if (!bucket) {
    return (
      <AdminScreenContainer header={<AdminHeader title={routeName} onBack={() => navigation.goBack()} />}>
        <Text className="text-error px-4 py-8 text-center">
          Route not found on today&apos;s dispatch board. Go back and refresh.
        </Text>
      </AdminScreenContainer>
    );
  }

  return (
    <AdminScreenContainer header={<AdminHeader title={routeName} subtitle="Create delivery run" onBack={() => navigation.goBack()} />}>
      {msg ? (
        <Text className={msg.ok ? "text-primary mb-2" : "text-error mb-2"}>{msg.text}</Text>
      ) : null}



        <Text className="font-label-lg font-semibold text-on-surface mb-2">Driver</Text>
        <View className="gap-2.5 mb-4">
          {users.map((u) => {
            const isSelected = driverId === u.id;
            return (
              <Pressable
                key={u.id}
                accessibilityRole="button"
                onPress={() => setDriverId(u.id)}
                className={`rounded-2xl p-3.5 border mb-2.5 flex-row items-center justify-between ${
                  isSelected
                    ? "border-primary bg-primary/10"
                    : "border-outline-variant/40 bg-surface-container-lowest active:bg-surface-container-low"
                }`}
              >
                <View className="flex-row items-center gap-3.5 flex-1 pr-2">
                  {/* Vehicle Avatar Badge */}
                  <View
                    className={`w-11 h-11 rounded-xl items-center justify-center ${
                      isSelected
                        ? "bg-primary"
                        : "bg-surface-container-highest"
                    }`}
                  >
                    <MaterialIcons
                      name="local-shipping"
                      size={22}
                      color={isSelected ? "#ffffff" : "#444746"}
                    />
                  </View>

                  {/* Info details */}
                  <View className="flex-1">
                    {/* Vehicle Name & Number */}
                    <View className="flex-row items-center gap-2 flex-wrap mb-1">
                      <Text
                        className={`font-title-md font-bold tracking-tight ${
                          isSelected ? "text-primary" : "text-on-surface"
                        }`}
                      >
                        {u.vehicle_name || "Vehicle"}
                      </Text>
                      {u.mobile_number ? (
                        <View className="bg-surface-container-highest border border-outline-variant/40 px-2 py-0.5 rounded-md">
                          <Text className="font-label-sm font-bold tracking-wider text-on-surface">
                            {u.mobile_number}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Driver Name & Username */}
                    <View className="flex-row items-center gap-1.5">
                      <MaterialIcons name="badge" size={15} color="#717973" />
                      <Text className="font-body-md text-on-surface font-medium">
                        {u.full_name || u.username}
                      </Text>
                      {u.full_name && (
                        <Text className="font-body-xs text-on-surface-variant">
                          (@{u.username})
                        </Text>
                      )}
                    </View>
                  </View>
                </View>

                {/* Selection Radio / Check Indicator */}
                <View
                  className={`w-6 h-6 rounded-full items-center justify-center ${
                    isSelected
                      ? "bg-primary"
                      : "border-2 border-outline-variant"
                  }`}
                >
                  {isSelected && (
                    <MaterialIcons name="check" size={16} color="#ffffff" />
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text className="font-label-lg font-semibold text-on-surface mb-2 mt-4">Farm loads (Optional)</Text>
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
                    <View className="flex-row items-center gap-1">
                      <Text className="font-bold text-on-surface">{it.total_boxes ?? 0} Box • </Text>
                      <TextInput 
                        className="border border-outline-variant rounded px-2 py-0 text-on-surface min-w-[50px] text-center font-bold"
                        value={itemAdjustments[`${o.order_id}_${it.item_id}`] ?? String(Number(it.requested_kg ?? 0).toFixed(1))}
                        onChangeText={(val) => setItemAdjustments(prev => ({...prev, [`${o.order_id}_${it.item_id}`]: val}))}
                        keyboardType="decimal-pad"
                      />
                      <Text className="font-bold text-on-surface"> KG</Text>
                    </View>
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
