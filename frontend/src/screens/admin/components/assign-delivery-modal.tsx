import React, { useState } from "react";
import { View, Text, Pressable, Modal, ActivityIndicator, ScrollView } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useAdminDeliveryUsers, useAdminVehicles, useCreateDeliveryRun } from "../../../hooks/use-queries";
import type { DailyOrderOut } from "../../../types/api";

interface Props {
  order: DailyOrderOut;
  onClose: () => void;
  onAssigned: () => void;
}

export function AssignDeliveryModal({ order, onClose, onAssigned }: Props) {
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
        driver_user_id: driver.id,
        driver_name: driver.full_name || driver.username,
        vehicle_id: vehicle.id,
        vehicle_number: vehicle.number,
      },
      {
        onSuccess: () => {
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
            <Text className="font-title-md text-title-md text-on-surface font-semibold">
              Assign Delivery
            </Text>
            <Pressable onPress={onClose} className="p-2 -mr-2 rounded-full active:bg-surface-variant">
              <MaterialIcons name="close" size={24} className="text-on-surface-variant" />
            </Pressable>
          </View>

          <ScrollView className="p-4 max-h-[60vh]">
            <Text className="font-body-md text-body-md text-on-surface-variant mb-4">
              Assign a delivery person and vehicle for order{" "}
              <Text className="font-semibold text-on-surface">
                {order.order_number || "Unknown"}
              </Text>.
            </Text>

            <Text className="font-label-lg text-label-lg text-on-surface font-semibold mb-2">
              Select Delivery Person
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
                      <Text className={`font-body-md text-body-md ${selectedDriverId === u.id ? "text-primary font-semibold" : "text-on-surface"}`}>
                        {u.full_name || u.username}
                      </Text>
                    </View>
                    {selectedDriverId === u.id && (
                      <MaterialIcons name="check-circle" size={20} className="text-primary" />
                    )}
                  </Pressable>
                ))}
                {(!users || users.length === 0) && (
                  <Text className="font-body-sm text-on-surface-variant italic">No delivery personnel available</Text>
                )}
              </View>
            )}

            <Text className="font-label-lg text-label-lg text-on-surface font-semibold mb-2">
              Select Vehicle
            </Text>
            {loadingVehicles ? (
              <ActivityIndicator size="small" className="my-2" />
            ) : (
              <View className="flex-col gap-2 mb-4">
                {vehicles?.map(v => (
                  <Pressable
                    key={v.id}
                    onPress={() => setSelectedVehicleId(v.id)}
                    className={`p-3 rounded-xl border flex-row items-center justify-between ${
                      selectedVehicleId === v.id
                        ? "border-primary bg-primary-container/20"
                        : "border-outline-variant bg-surface"
                    }`}
                  >
                    <View className="flex-row items-center gap-2">
                      <MaterialIcons name="directions-car" size={20} className={selectedVehicleId === v.id ? "text-primary" : "text-on-surface-variant"} />
                      <Text className={`font-body-md text-body-md ${selectedVehicleId === v.id ? "text-primary font-semibold" : "text-on-surface"}`}>
                        {v.number}
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
          </ScrollView>

          <View className="p-4 border-t border-outline-variant/30 flex-row justify-end gap-3 bg-surface-container-low">
            <Pressable
              onPress={onClose}
              className="h-10 px-4 items-center justify-center rounded-full"
            >
              <Text className="font-label-md text-label-md text-primary font-semibold">Cancel</Text>
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
                  className={`font-label-md text-label-md font-semibold ${
                    !selectedDriverId || !selectedVehicleId
                      ? "text-on-surface/38"
                      : "text-on-primary"
                  }`}
                >
                  Assign
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
