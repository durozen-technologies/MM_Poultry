import React, { useState, useMemo, useCallback } from "react";
import { View, Text, Pressable, Modal, ActivityIndicator, ScrollView, TextInput } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useAdminDeliveryUsers, useAdminVehicles, useCreateDeliveryRun } from "../../../hooks/use-queries";
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
  const { mutate: createRun, isPending } = useCreateDeliveryRun();

  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  const handleAssign = () => {
    if (!selectedDriverId || !selectedVehicleId) return;
    
    const driver = users?.find(u => u.id === selectedDriverId);
    const vehicle = vehicles?.find(v => v.id === selectedVehicleId);
    if (!driver || !vehicle) return;

    createRun(
      {
        order_ids: [order.id],
        order_adjustments: [],

        driver_user_id: driver.id,
        driver_name: driver.full_name || driver.username,
        vehicle_id: vehicle.id,
        vehicle_number: vehicle.number,
        farm_load_allocations: [],
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
