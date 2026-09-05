import React, { useState, useMemo, useCallback } from "react";
import { View, Text, Pressable, Modal, ActivityIndicator, ScrollView, TextInput } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useAdminDeliveryUsers, useAdminVehicles, useCreateDeliveryRun, useAdminFarms } from "../../../hooks/use-queries";
import type { DailyOrderOut } from "../../../types/api";

interface Props {
  order: DailyOrderOut;
  onClose: () => void;
  onAssigned: () => void;
}

export function SingleOrderDispatchModal({ order, onClose, onAssigned }: Props) {
  const queryClient = useQueryClient();
  const { data: users, isLoading: loadingUsers } = useAdminDeliveryUsers();
  const { data: vehicles, isLoading: loadingVehicles } = useAdminVehicles();
  const { data: farmsData } = useAdminFarms();
  const { mutate: createRun, isPending } = useCreateDeliveryRun();

  const loads = useMemo(
    () => farmsData?.loads?.filter((l) => l.status === "OPEN" || l.status === "IN_TRANSIT") ?? [],
    [farmsData?.loads]
  );

  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedLoadIds, setSelectedLoadIds] = useState<Set<string>>(new Set());
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [itemAdjustments, setItemAdjustments] = useState<Record<string, string>>({});

  const toggleLoad = (id: string) => {
    setSelectedLoadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalSelectedKg = useMemo(() => {
    return (order.items || []).reduce((sum, it) => {
      const adj = itemAdjustments[it.item_id];
      return sum + Number(adj !== undefined ? adj : (it.requested_kg ?? 0));
    }, 0);
  }, [order.items, itemAdjustments]);

  const handleAssign = () => {
    if (!selectedDriverId || !selectedVehicleId) return;
    
    const driver = users?.find(u => u.id === selectedDriverId);
    const vehicle = vehicles?.find(v => v.id === selectedVehicleId);
    if (!driver || !vehicle) return;

    const loadIds = Array.from(selectedLoadIds);
    const perLoad = totalSelectedKg / (loadIds.length || 1);
    const farm_load_allocations = loadIds.map((farm_load_id) => ({
      farm_load_id,
      allocated_kg: allocations[farm_load_id] || String(perLoad.toFixed(3)),
    }));

    const order_adjustments = Object.entries(itemAdjustments).map(([item_id, requested_kg]) => ({
      order_id: order.id,
      item_id,
      requested_kg,
    }));

    createRun(
      {
        order_ids: [order.id],
        order_adjustments,

        driver_user_id: driver.id,
        driver_name: driver.full_name || driver.username,
        vehicle_id: vehicle.id,
        vehicle_number: vehicle.number,
        farm_load_allocations,
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
          queryClient.invalidateQueries({ queryKey: ["admin", "dispatch"] });
          onAssigned();
        },
      }
    );
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-center items-center p-4">
        <View className="w-full max-w-sm bg-surface rounded-3xl overflow-hidden shadow-lg">
          <View className="p-4 border-b border-outline-variant/30 flex-row items-center justify-between bg-surface-container-low">
            <Text className="font-title-md text-on-surface font-semibold">
              Dispatch Order
            </Text>
            <Pressable onPress={onClose} className="p-2 -mr-2 rounded-full active:bg-surface-variant">
              <MaterialIcons name="close" size={24} className="text-on-surface-variant" />
            </Pressable>
          </View>

          <ScrollView className="p-4 max-h-[70vh]">
            <View className="mb-4 bg-surface-container-lowest rounded-2xl p-3 border border-outline-variant/30">
              <Text className="font-title-sm font-bold text-on-surface mb-1">
                {order.shop_name || order.retailer_name || "Unknown Retailer"}
              </Text>
              <Text className="font-body-sm text-on-surface-variant">
                {order.order_number || order.id.slice(0, 8).toUpperCase()}
              </Text>
            </View>

            <Text className="font-label-lg text-on-surface font-semibold mb-2">
              Vehicle
            </Text>
            {loadingVehicles ? (
              <ActivityIndicator size="small" className="my-2" />
            ) : (
              <View className="flex-col gap-2 mb-4">
                {vehicles?.map(v => (
                  <Pressable
                    key={v.id}
                    onPress={() => {
                      setSelectedVehicleId(v.id);
                      if (!selectedDriverId && v.driver_name) {
                        const u = users?.find(x => x.full_name === v.driver_name || x.username === v.driver_name);
                        if (u) setSelectedDriverId(u.id);
                      }
                    }}
                    className={`p-3 rounded-xl border flex-row items-center justify-between ${
                      selectedVehicleId === v.id
                        ? "border-primary bg-primary-container/20"
                        : "border-outline-variant bg-surface"
                    }`}
                  >
                    <View className="flex-row items-center gap-2">
                      <MaterialIcons name="directions-car" size={20} className={selectedVehicleId === v.id ? "text-primary" : "text-on-surface-variant"} />
                      <Text className={`font-body-md ${selectedVehicleId === v.id ? "text-primary font-semibold" : "text-on-surface"}`}>
                        {v.number} {v.name ? `(${v.name})` : ""}
                      </Text>
                    </View>
                    {selectedVehicleId === v.id && (
                      <MaterialIcons name="check-circle" size={20} className="text-primary" />
                    )}
                  </Pressable>
                ))}
                {(!vehicles || vehicles.length === 0) && (
                  <Text className="font-body-sm text-on-surface-variant italic">No vehicles available</Text>
                )}
              </View>
            )}

            <Text className="font-label-lg text-on-surface font-semibold mb-2">
              Driver
            </Text>
            {loadingUsers ? (
              <ActivityIndicator size="small" className="my-2" />
            ) : (
              <View className="flex-col gap-2 mb-6">
                {users?.map(u => (
                  <Pressable
                    key={u.id}
                    onPress={() => setSelectedDriverId(u.id)}
                    className={`p-3 rounded-xl border flex-row items-center justify-between ${
                      selectedDriverId === u.id
                        ? "border-primary bg-primary-container/20"
                        : "border-outline-variant bg-surface"
                    }`}
                  >
                    <View className="flex-row items-center gap-2">
                      <MaterialIcons name="person" size={20} className={selectedDriverId === u.id ? "text-primary" : "text-on-surface-variant"} />
                      <Text className={`font-body-md ${selectedDriverId === u.id ? "text-primary font-semibold" : "text-on-surface"}`}>
                        {u.full_name || u.username}
                      </Text>
                    </View>
                    {selectedDriverId === u.id && (
                      <MaterialIcons name="check-circle" size={20} className="text-primary" />
                    )}
                  </Pressable>
                ))}
              </View>
            )}

            <Text className="font-label-lg text-on-surface font-semibold mb-2">Adjust Items</Text>
            <View className="bg-surface-container-highest/30 rounded-xl p-2 border border-outline-variant/10 mb-6">
              {order.items?.map((it) => (
                <View
                  key={it.item_id}
                  className="flex-row items-center justify-between py-2 border-b border-surface-variant/30 last:border-b-0"
                >
                  <Text className="font-label-md text-on-surface font-semibold flex-1 pr-2">
                    {it.item_name ?? "Item"}
                  </Text>
                  <View className="flex-row items-center gap-1">
                    <Text className="font-bold text-on-surface">{it.total_boxes ?? 0} Box • </Text>
                    <TextInput 
                      className="border border-outline-variant rounded px-2 py-0 text-on-surface min-w-[50px] text-center font-bold bg-surface"
                      value={itemAdjustments[it.item_id] ?? String(Number(it.requested_kg ?? 0).toFixed(1))}
                      onChangeText={(val) => setItemAdjustments(prev => ({...prev, [it.item_id]: val}))}
                      keyboardType="decimal-pad"
                    />
                    <Text className="font-bold text-on-surface"> KG</Text>
                  </View>
                </View>
              ))}
              {(!order.items || order.items.length === 0) ? (
                <Text className="text-on-surface-variant italic text-sm">No items listed</Text>
              ) : null}
            </View>

            <Text className="font-label-lg text-on-surface font-semibold mb-2">Farm Loads (Optional)</Text>
            <View className="gap-2 mb-6">
              {loads.map((l) => (
                <View key={l.id} className="border border-outline-variant rounded-xl p-3 bg-surface">
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
                      className="mt-2 border border-outline-variant rounded-lg px-3 py-2 text-on-surface bg-surface-container-lowest"
                      placeholder="Allocated kg"
                      keyboardType="decimal-pad"
                      value={allocations[l.id] ?? ""}
                      onChangeText={(v) => setAllocations((prev) => ({ ...prev, [l.id]: v }))}
                    />
                  ) : null}
                </View>
              ))}
              {loads.length === 0 ? (
                <Text className="text-on-surface-variant italic font-body-sm">No open farm loads available</Text>
              ) : null}
            </View>

          </ScrollView>

          <View className="p-4 border-t border-outline-variant/30 flex-row justify-end gap-3 bg-surface-container-low">
            <Pressable
              onPress={onClose}
              className="h-10 px-4 items-center justify-center rounded-full"
            >
              <Text className="font-label-md text-primary font-semibold">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleAssign}
              disabled={!selectedDriverId || !selectedVehicleId || isPending}
              className={`h-10 px-6 items-center justify-center rounded-full ${
                !selectedDriverId || !selectedVehicleId || isPending
                  ? "bg-on-surface/12"
                  : "bg-primary"
              }`}
            >
              {isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text
                  className={`font-label-md font-semibold ${
                    !selectedDriverId || !selectedVehicleId
                      ? "text-on-surface/38"
                      : "text-on-primary"
                  }`}
                >
                  Dispatch
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
