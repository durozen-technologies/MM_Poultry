import React from "react";
import { View, Text, Pressable, Modal, ActivityIndicator } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useConfirmOrder } from "../../../hooks/use-queries";
import type { DailyOrderOut } from "../../../types/api";

interface Props {
  order: DailyOrderOut;
  onClose: () => void;
  onConfirmed: () => void;
}

export function ConfirmOrderModal({ order, onClose, onConfirmed }: Props) {
  const { mutate: confirmOrder, isPending } = useConfirmOrder();

  const handleConfirm = () => {
    // ponytail: date entry removed, backend handles timestamp
    confirmOrder(
      { orderId: order.id },
      { onSuccess: onConfirmed }
    );
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-center items-center p-4">
        <View className="w-full max-w-sm bg-surface rounded-3xl overflow-hidden shadow-lg">
          <View className="p-4 border-b border-outline-variant/30 flex-row items-center justify-between bg-surface-container-low">
            <Text className="font-title-md text-title-md text-on-surface font-semibold">
              Confirm Order
            </Text>
            <Pressable onPress={onClose} className="p-2 -mr-2 rounded-full active:bg-surface-variant" disabled={isPending}>
              <MaterialIcons name="close" size={24} className="text-on-surface-variant" />
            </Pressable>
          </View>

          <View className="p-4">
            <Text className="font-body-md text-body-md text-on-surface-variant mb-6">
              Confirm order{" "}
              <Text className="font-semibold text-on-surface">
                {order.order_number || order.id.slice(0, 8)}
              </Text>
              {" "}for {order.shop_name || order.retailer_name}?
            </Text>

            <View className="flex-row justify-end">
              <Pressable
                onPress={onClose}
                className="px-4 py-2 mr-2 rounded-full active:bg-surface-variant"
                disabled={isPending}
              >
                <Text className="font-label-md text-label-md text-primary font-semibold">Cancel</Text>
              </Pressable>
              
              <Pressable
                onPress={handleConfirm}
                disabled={isPending}
                className={`px-4 py-2 rounded-full flex-row items-center ${isPending ? 'bg-surface-variant' : 'bg-primary'} active:opacity-80`}
              >
                {isPending && <ActivityIndicator size="small" color="#ffffff" className="mr-2" />}
                <Text className={`font-label-md text-label-md font-semibold ${isPending ? 'text-on-surface-variant' : 'text-on-primary'}`}>
                  Confirm
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
