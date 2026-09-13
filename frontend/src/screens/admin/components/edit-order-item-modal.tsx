import React, { useState } from "react";
import { View, Text, Modal, Pressable, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { createOrderAsAdmin } from "../../../api/orders";
import type { DailyOrder, DailyOrderCreate } from "../../../types/api";

type Props = {
  order: DailyOrder;
  itemToEdit: any; // The item being edited
  itemName: string;
  onClose: () => void;
  onSaved: (updatedOrder: DailyOrder) => void;
};

export function EditOrderItemModal({ order, itemToEdit, itemName, onClose, onSaved }: Props) {
  const [boxes, setBoxes] = useState(String(itemToEdit.total_boxes || 1));
  const [kg, setKg] = useState(itemToEdit.requested_kg ? String(itemToEdit.requested_kg) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    const b = parseInt(boxes, 10);
    const k = kg.trim() ? parseFloat(kg) : null;

    if (!Number.isFinite(b) || b <= 0) {
      setError("Please enter a valid number of boxes.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload: DailyOrderCreate = {
        order_id: order.id,
        notes: order.notes,
        items: (order.items || []).map(it => {
          if (it.item_id === itemToEdit.item_id) {
            return {
              item_id: it.item_id,
              total_boxes: b,
              requested_kg: k ? String(k) : null,
              notes: it.notes,
              locked_rate_per_kg: it.locked_rate_per_kg,
            };
          }
          return {
            item_id: it.item_id,
            total_boxes: it.total_boxes,
            requested_kg: it.requested_kg,
            notes: it.notes,
            locked_rate_per_kg: it.locked_rate_per_kg,
          };
        }),
      };

      const updated = await createOrderAsAdmin(order.retailer_id, payload);
      onSaved(updated);
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || e?.response?.data?.detail || e.message || "Failed to update item";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 bg-black/50 justify-center px-4 py-12"
      >
        <View className="bg-white rounded-2xl overflow-hidden max-h-full">
          {/* Header */}
          <View className="flex-row items-center justify-between p-4 border-b border-[#e5e7eb] bg-surface-container-lowest">
            <View className="flex-row items-center gap-2">
              <MaterialIcons name="edit" size={20} className="text-[#202124]" />
              <Text className="text-lg font-bold text-[#202124]">Edit Requested Item</Text>
            </View>
            <Pressable onPress={onClose} className="p-2 -mr-2 active:bg-surface-variant/50 rounded-full">
              <MaterialIcons name="close" size={24} className="text-[#5f6368]" />
            </Pressable>
          </View>

          <ScrollView className="p-5 flex-col gap-4">
            <View className="bg-[#f7f8fa] p-3 rounded-lg border border-[#e5e7eb] mb-2">
              <Text className="text-sm font-bold text-[#5f6368] uppercase tracking-wider mb-1">Item</Text>
              <Text className="text-base font-bold text-[#202124]">{itemName}</Text>
            </View>

            {error && (
              <View className="bg-error-container/80 p-3 rounded-lg flex-row items-center mb-2">
                <MaterialIcons name="error-outline" size={20} className="text-error mr-2" />
                <Text className="text-error text-sm font-bold flex-1">{error}</Text>
              </View>
            )}

            <View>
              <Text className="text-[#5f6368] text-sm font-bold mb-1.5 ml-1">Total Boxes *</Text>
              <TextInput
                className="h-12 bg-white border border-[#e5e7eb] rounded-lg px-4 text-base text-[#202124] focus:border-[#0052CC]"
                value={boxes}
                onChangeText={setBoxes}
                keyboardType="number-pad"
                placeholder="Enter boxes"
              />
            </View>

            <View>
              <Text className="text-[#5f6368] text-sm font-bold mb-1.5 ml-1">Estimated Weight (KG)</Text>
              <TextInput
                className="h-12 bg-white border border-[#e5e7eb] rounded-lg px-4 text-base text-[#202124] focus:border-[#0052CC]"
                value={kg}
                onChangeText={setKg}
                keyboardType="decimal-pad"
                placeholder="Optional"
              />
            </View>
          </ScrollView>

          <View className="p-4 border-t border-[#e5e7eb] bg-surface-container-lowest flex-row justify-end gap-3">
            <Pressable
              onPress={onClose}
              disabled={saving}
              className="px-5 py-2.5 rounded-lg border border-[#e5e7eb] bg-white active:bg-surface-variant/50"
            >
              <Text className="text-[#5f6368] font-bold">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={saving}
              className={`px-5 py-2.5 rounded-lg flex-row items-center gap-2 active:opacity-90 ${saving ? "bg-[#0052CC]/70" : "bg-[#0052CC]"}`}
            >
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <MaterialIcons name="check" size={18} color="white" />}
              <Text className="text-white font-bold">Save Changes</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
