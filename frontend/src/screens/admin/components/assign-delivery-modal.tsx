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
 <Modal visible transparent animationType="fade"onRequestClose={onClose}>
 <View className="flex-1 bg-[#2E7D32]/50 justify-center items-center p-4">
 <View className="w-full max-w-sm bg-white rounded-lg overflow-hidden">
 <View className="p-4 border-b border-[#e5e7eb] flex-row items-center justify-between bg-[#f7f8fa]-low">
 <Text className="text-base font-bold text-[#5f6368] text-title-md text-[#202124] font-semibold">
 Assign Delivery
 </Text>
 <Pressable onPress={onClose} className="p-2 -mr-2 rounded-lg active:bg-[#f7f8fa]">
 <MaterialIcons name="close"size={24} className="text-[#5f6368]"/>
 </Pressable>
 </View>

 <ScrollView className="p-4 max-h-[60vh]">
 <Text className="text-base text-[#5f6368] text-base text-[#202124] text-[#5f6368] mb-4">
 Assign a delivery person and vehicle for order{""}
 <Text className="font-semibold text-[#202124]">
 {order.order_number || "Unknown"}
 </Text>.
 </Text>

 <Text className="text-base font-bold text-[#5f6368] text-base font-bold text-[#202124] font-semibold mb-2">
 Select Delivery Unit
 </Text>
 {loadingUsers ? (
 <ActivityIndicator size="small"className="my-2"/>
 ) : (
 <View className="flex-col gap-2 mb-4">
 {users?.map((u) => {
 const isSelected = selectedDriverId === u.id;
 return (
 <Pressable
 key={u.id}
 accessibilityRole="button"
 onPress={() => setSelectedDriverId(u.id)}
 className={`rounded-lg p-3.5 border mb-2.5 flex-row items-center justify-between ${
 isSelected
 ? "border-[#2E7D32] bg-[#2E7D32]/10"
 : "border-[#e5e7eb] bg-white active:bg-[#f7f8fa]-low"
 }`}
 >
 <View className="flex-row items-center gap-3.5 flex-1 pr-2">
 {/* Vehicle Avatar Badge */}
 <View
 className={`w-11 h-11 rounded-lg items-center justify-center ${
 isSelected
 ? "bg-[#2E7D32]"
 : "bg-[#f7f8fa]"
 }`}
 >
 <MaterialIcons
 name="local-shipping"
 size={22}
 color={isSelected ? "#ffffff": "#444746"}
 />
 </View>

 {/* Info details */}
 <View className="flex-1">
 {/* Vehicle Name & Number */}
 <View className="flex-row items-center gap-2 flex-wrap mb-1">
 <Text
 className={`text-base font-bold text-[#5f6368] tracking-tight ${
 isSelected ? "text-[#2E7D32]": "text-[#202124]"
 }`}
 >
 {u.vehicle_name || "Vehicle"}
 </Text>
 {u.mobile_number ? (
 <View className="bg-[#f7f8fa] border border-[#e5e7eb] px-2 py-0.5 rounded-md">
 <Text className="text-xs font-bold tracking-wider text-[#202124]">
 {u.mobile_number}
 </Text>
 </View>
 ) : null}
 </View>

 {/* Driver Name & Username */}
 <View className="flex-row items-center gap-1.5">
 <MaterialIcons name="badge"size={15} color="#717973"/>
 <Text className="text-base text-[#5f6368] text-[#202124] font-medium">
 {u.full_name || u.username}
 </Text>
 {u.full_name && (
 <Text className="font-body-xs text-[#5f6368]">
 (@{u.username})
 </Text>
 )}
 </View>
 </View>
 </View>

 {/* Selection Radio / Check Indicator */}
 <View
 className={`w-6 h-6 rounded-lg items-center justify-center ${
 isSelected
 ? "bg-[#2E7D32]"
 : "border border-[#e5e7eb]"
 }`}
 >
 {isSelected && (
 <MaterialIcons name="check"size={16} color="#ffffff"/>
 )}
 </View>
 </Pressable>
 );
 })}
 {(!users || users.length === 0) && (
 <Text className="text-sm text-[#5f6368] text-[#5f6368] italic">No drivers available</Text>
 )}
 </View>
 )}
 </ScrollView>

 <View className="p-4 border-t border-[#e5e7eb] flex-row justify-end gap-3 bg-[#f7f8fa]-low">
 <Pressable
 onPress={onClose}
 className="h-10 px-4 items-center justify-center rounded-lg"
 >
 <Text className="text-sm font-bold text-[#5f6368] text-sm font-bold text-[#2E7D32] font-semibold">Cancel</Text>
 </Pressable>
 <Pressable
 onPress={handleAssign}
 disabled={!selectedDriverId || isPending}
 className={`h-10 px-6 items-center justify-center rounded-lg ${
 !selectedDriverId || isPending
 ? "bg-on-surface/12"
 : "bg-[#2E7D32]"
 }`}
 >
 {isPending ? (
 <ActivityIndicator size="small"color="#fff"/>
 ) : (
 <Text
 className={`text-sm font-bold text-[#5f6368] text-sm font-bold font-semibold ${
 !selectedDriverId
 ? "text-[#202124]/38"
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
