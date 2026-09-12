import React, { useState } from "react";
import { View, Text, Pressable, Modal, ActivityIndicator, ScrollView, TextInput, Alert } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { getApiErrorMessage } from "../../../api/client";
import { setOrderPrices, makeOrderBilled } from "../../../api/orders";
import type { DailyOrderOut } from "../../../types/api";

interface Props {
  order: DailyOrderOut;
  onClose: () => void;
  onUpdated: (updatedOrder: DailyOrderOut) => void;
}

export function EditOrderPricesModal({ order, onClose, onUpdated }: Props) {
  const queryClient = useQueryClient();
  const isDelivered = order.status === "FULFILLED";

  const [prices, setPrices] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    order.items.forEach(it => {
      if (it.locked_rate_per_kg != null) {
        initial[it.item_id] = String(it.locked_rate_per_kg);
      }
    });
    return initial;
  });
  const [error, setError] = useState<string | null>(null);

  const allPricesEntered = order.items.length > 0 &&
    order.items.every(it => {
      const v = prices[it.item_id];
      return v && !isNaN(Number(v)) && Number(v) > 0;
    });

  const { mutate, isPending } = useMutation({
    mutationFn: async (item_prices: { item_id: string; locked_rate_per_kg: number | null }[]) => {
      const updated = await setOrderPrices(order.id, item_prices);
      // For delivered orders: auto-bill immediately after prices are saved
      if (isDelivered && item_prices.every(p => p.locked_rate_per_kg !== null)) {
        try {
          await makeOrderBilled(order.id);
        } catch (e: any) {
          // If already billed, that's fine — commit_bill updates the existing bill
          const msg: string = e?.response?.data?.detail || "";
          if (!msg.includes("already") && !msg.includes("BILLED")) throw e;
        }
      }
      return updated;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      queryClient.invalidateQueries({ queryKey: ["order_bill", order.id] });
      onUpdated(data);
    },
    onError: (err) => {
      setError(getApiErrorMessage(err));
    }
  });

  const handleSave = () => {
    setError(null);
    const item_prices = order.items.map(it => ({
       item_id: it.item_id,
       locked_rate_per_kg: prices[it.item_id] && !isNaN(Number(prices[it.item_id])) ? Number(prices[it.item_id]) : null
    }));
    mutate(item_prices);
  };

  const saveLabel = isDelivered ? (allPricesEntered ? "Save & Bill" : "Save Prices") : "Save Prices";

  return (
  <Modal visible transparent animationType="fade" onRequestClose={onClose}>
  <View className="flex-1 bg-black/50 justify-center items-center p-4">
  <View className="w-full max-w-sm bg-white rounded-xl overflow-hidden">
  <View className="p-4 border-b border-[#e5e7eb] flex-row items-center justify-between">
  <View>
  <Text className="text-lg text-[#202124] font-semibold">
  {isDelivered ? "Set & Bill Prices" : "Edit Prices"}
  </Text>
  {isDelivered && (
    <Text className="text-xs text-[#5f6368] mt-0.5">Prices will be saved and order billed</Text>
  )}
  </View>
  <Pressable onPress={onClose} className="p-2 -mr-2 rounded-lg active:bg-[#f7f8fa]">
  <MaterialIcons name="close" size={24} className="text-[#5f6368]"/>
  </Pressable>
  </View>

  <ScrollView className="p-4 max-h-[70vh]">
  {error ? (
  <View className="mb-3 p-3 rounded-lg bg-red-50">
  <Text className="text-red-600 font-semibold">{error}</Text>
  </View>
  ) : null}

  <View className="mb-4 bg-white rounded-lg p-3 border border-[#e5e7eb]">
  <Text className="text-sm font-semibold text-[#202124] mb-1">
  {order.shop_name || order.retailer_name || "Unknown Retailer"}
  </Text>
  <Text className="text-sm text-[#5f6368]">
  {order.order_number || order.id.slice(0, 8).toUpperCase()}
  </Text>
  </View>

  <Text className="text-sm font-semibold text-[#202124] mt-2 mb-2">
  Item Prices (₹/kg)
  </Text>
  {order.items.map((item) => (
    <View key={item.item_id} className="flex-row items-center justify-between mb-3 bg-[#f7f8fa] p-3 rounded-lg border border-[#e5e7eb]">
      <View className="flex-1 mr-2">
        <Text className="text-sm font-semibold text-[#202124] mb-1">{item.item_name}</Text>
        <Text className="text-xs text-[#5f6368]">
          {item.delivered_kg ? `${item.delivered_kg} kg delivered` : `${item.total_boxes} boxes`}
        </Text>
        {item.locked_rate_per_kg && prices[item.item_id] && (
          <Text className="text-xs text-[#2E7D32] font-semibold mt-0.5">
            = ₹{(Number(item.delivered_kg || 0) * Number(prices[item.item_id] || 0)).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
          </Text>
        )}
      </View>
      <View className="w-24">
        <TextInput
          value={prices[item.item_id] || ""}
          onChangeText={(v) => setPrices(prev => ({...prev, [item.item_id]: v}))}
          placeholder="Rate/kg"
          keyboardType="numeric"
          placeholderTextColor="#a0a5ab"
          className="bg-white border border-[#e5e7eb] rounded-lg px-3 py-2 text-sm text-[#202124]"
        />
      </View>
    </View>
  ))}
  </ScrollView>

  <View className="p-4 border-t border-[#e5e7eb] flex-row justify-end gap-3">
  <Pressable
  onPress={onClose}
  className="h-10 px-4 items-center justify-center rounded-lg"
  >
  <Text className="text-sm font-semibold text-[#5f6368]">Cancel</Text>
  </Pressable>
  <Pressable
  onPress={handleSave}
  disabled={isPending}
  className={`h-10 px-6 items-center justify-center rounded-lg ${
  isPending ? "bg-gray-200" : isDelivered && allPricesEntered ? "bg-[#0052CC]" : "bg-[#2E7D32]"
  }`}
  >
  {isPending ? (
  <ActivityIndicator size="small" color="#fff"/>
  ) : (
  <View className="flex-row items-center gap-1.5">
    {isDelivered && allPricesEntered && <MaterialIcons name="receipt" size={16} color="white"/>}
    <Text className="text-sm font-semibold text-white">{saveLabel}</Text>
  </View>
  )}
  </Pressable>
  </View>
  </View>
  </View>
  </Modal>
  );
}
