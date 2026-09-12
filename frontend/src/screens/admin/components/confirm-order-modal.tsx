import React, { useState } from "react";
import { View, Text, Pressable, Modal, ActivityIndicator, Platform } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useConfirmOrder } from "../../../hooks/use-queries";
import type { DailyOrderOut } from "../../../types/api";

interface Props {
 order: DailyOrderOut;
 onClose: () => void;
 onConfirmed: () => void;
}

export function ConfirmOrderModal({ order, onClose, onConfirmed }: Props) {
 const { mutate: confirmOrder, isPending } = useConfirmOrder();

 const [date, setDate] = useState<Date | null>(null);
 const [showPicker, setShowPicker] = useState(false);

 const handleConfirm = () => {
 if (!date) return;
 
 // Format to YYYY-MM-DD for backend
 const yyyy = date.getFullYear();
 const mm = String(date.getMonth() + 1).padStart(2, "0");
 const dd = String(date.getDate()).padStart(2, "0");
 const expected_delivery_date = `${yyyy}-${mm}-${dd}`;

 confirmOrder(
 { orderId: order.id, expected_delivery_date },
 {
 onSuccess: () => {
 onConfirmed();
 },
 }
 );
 };

 const formatDateDisplay = (d: Date | null) => {
 if (!d) return "Select Date";
 const yyyy = d.getFullYear();
 const mm = String(d.getMonth() + 1).padStart(2, "0");
 const dd = String(d.getDate()).padStart(2, "0");
 return `${dd}/${mm}/${yyyy}`; // DD/MM/YYYY format as requested
 };

 const onChangeDate = (event: any, selectedDate?: Date) => {
 if (Platform.OS === "android") {
 setShowPicker(false);
 }
 if (selectedDate) {
 setDate(selectedDate);
 }
 };

 return (
 <Modal visible transparent animationType="fade"onRequestClose={onClose}>
 <View className="flex-1 bg-[#2E7D32]/50 justify-center items-center p-4">
 <View className="w-full max-w-sm bg-white rounded-lg overflow-hidden">
 <View className="p-4 border-b border-[#e5e7eb] flex-row items-center justify-between bg-[#f7f8fa]-low">
 <Text className="text-base font-bold text-[#5f6368] text-title-md text-[#202124] font-semibold">
 Confirm Order
 </Text>
 <Pressable onPress={onClose} className="p-2 -mr-2 rounded-lg active:bg-[#f7f8fa]"disabled={isPending}>
 <MaterialIcons name="close"size={24} className="text-[#5f6368]"/>
 </Pressable>
 </View>

 <View className="p-4">
 <Text className="text-base text-[#5f6368] text-base text-[#202124] text-[#5f6368] mb-2">
 Confirm order{""}
 <Text className="font-semibold text-[#202124]">
 {order.order_number || order.id.slice(0, 8)}
 </Text>
 {""}for {order.shop_name || order.retailer_name}?
 </Text>

 <Text className="text-sm font-bold text-[#5f6368] text-sm font-bold text-[#202124] font-semibold mt-4 mb-2">
 Estimated Delivery Date <Text className="text-error">*</Text>
 </Text>
 
 {Platform.OS === "ios"? (
 <View className="items-start mb-4">
 {date === null ? (
 <Pressable 
 onPress={() => setDate(new Date())} 
 className="flex-row items-center bg-[#f7f8fa] px-3 py-2 rounded-voltagent-sm border border-[#e5e7eb]"
 >
 <MaterialIcons name="calendar-today"size={18} className="text-[#5f6368] mr-2"/>
 <Text className="text-[#5f6368]">Select Date</Text>
 </Pressable>
 ) : (
 <DateTimePicker
 value={date || new Date()}
 mode="date"
 display="default"
 onChange={onChangeDate}
 minimumDate={new Date()}
 />
 )}
 </View>
 ) : Platform.OS === "web"? (
 <View className="mb-4">
 <input
 type="date"
 value={date ? date.toISOString().split("T")[0] : ""}
 onChange={(e: any) => {
 const d = new Date(e.target.value);
 if (!isNaN(d.getTime())) setDate(d);
 }}
 style={{
 padding: "12px 16px",
 borderRadius: "12px",
 border: "1px solid rgba(115, 115, 115, 0.3)",
 backgroundColor: "transparent",
 color: "inherit",
 fontSize: "16px",
 width: "100%",
 colorScheme: "dark",
 }}
 />
 </View>
 ) : (
 <View className="mb-4">
 <Pressable
 onPress={() => setShowPicker(true)}
 className="flex-row items-center justify-between bg-[#f7f8fa] px-4 py-3 rounded-lg border border-[#e5e7eb] active:bg-[#f7f8fa]"
 >
 <Text className={`text-base text-[#5f6368] text-base text-[#202124] ${date ? "text-[#202124]": "text-[#5f6368]"}`}>
 {formatDateDisplay(date)}
 </Text>
 <MaterialIcons name="calendar-today"size={20} className="text-[#2E7D32]"/>
 </Pressable>

 {showPicker && (
 <DateTimePicker
 value={date || new Date()}
 mode="date"
 display="default"
 onChange={onChangeDate}
 minimumDate={new Date()}
 />
 )}
 </View>
 )}

 <View className="flex-row justify-end mt-4">
 <Pressable
 onPress={onClose}
 className="px-4 py-2 mr-2 rounded-lg active:bg-[#f7f8fa]"
 disabled={isPending}
 >
 <Text className="text-sm font-bold text-[#5f6368] text-sm font-bold text-[#2E7D32] font-semibold">Cancel</Text>
 </Pressable>
 
 <Pressable
 onPress={handleConfirm}
 disabled={!date || isPending}
 className={`px-4 py-2 rounded-lg flex-row items-center ${!date || isPending ? 'bg-[#f7f8fa]' : 'bg-[#2E7D32]'} active:opacity-80`}
 >
 {isPending && <ActivityIndicator size="small"color="#ffffff"className="mr-2"/>}
 <Text className={`text-sm font-bold text-[#5f6368] text-sm font-bold font-semibold ${!date || isPending ? 'text-[#5f6368]' : 'text-on-primary'}`}>
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
