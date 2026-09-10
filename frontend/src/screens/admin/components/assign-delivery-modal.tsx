import React, { useState } from "react";
import { View, Text, Pressable, Modal, ActivityIndicator, ScrollView } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useAdminDeliveryUsers, useCreateDeliveryRun } from "../../../hooks/use-queries";
import type { DailyOrderOut } from "../../../types/api";

interface Props {
  order: DailyOrderOut;
  onClose: () => void;
  onAssigned: () => void;
}

export function AssignDeliveryModal({ order, onClose, onAssigned }: Props) {
  const { data: users, isLoading: loadingUsers } = useAdminDeliveryUsers();
  const { mutate: createRun, isPending } = useCreateDeliveryRun();

  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);

  const handleAssign = () => {
    if (!selectedDriverId) return;
    
    const driver = users?.find(u => u.id === selectedDriverId);
    if (!driver) return;

    createRun(
      {
        order_ids: [order.id],
        driver_user_id: driver.id,
        driver_name: driver.full_name || driver.username,
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
              Select Delivery Unit
            </Text>
            {loadingUsers ? (
              <ActivityIndicator size="small" className="my-2" />
            ) : (
              <View className="flex-col gap-2 mb-4">
                {users?.map((u) => {
                  const isSelected = selectedDriverId === u.id;
                  return (
                    <Pressable
                      key={u.id}
                      accessibilityRole="button"
                      onPress={() => setSelectedDriverId(u.id)}
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
                {(!users || users.length === 0) && (
                  <Text className="font-body-sm text-on-surface-variant italic">No drivers available</Text>
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
              disabled={!selectedDriverId || isPending}
              className={`h-10 px-6 items-center justify-center rounded-full ${
                !selectedDriverId || isPending
                  ? "bg-on-surface/12"
                  : "bg-primary"
              }`}
            >
              {isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text
                  className={`font-label-md text-label-md font-semibold ${
                    !selectedDriverId
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
