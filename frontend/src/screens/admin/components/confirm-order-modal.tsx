import React, { useState } from "react";
import { View, Text, Pressable, Modal, ActivityIndicator, Platform, TextInput, ScrollView } from "react-native";
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
  const [prices, setPrices] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    order.items?.forEach(it => {
      if (it.locked_rate_per_kg != null) {
        initial[it.item_id] = String(it.locked_rate_per_kg);
      }
    });
    return initial;
  });

 const handleConfirm = () => {
 if (!date) return;
 
 // Format to YYYY-MM-DD for backend
 const yyyy = date.getFullYear();
 const mm = String(date.getMonth() + 1).padStart(2, "0");
 const dd = String(date.getDate()).padStart(2, "0");
 const expected_delivery_date = `${yyyy}-${mm}-${dd}`;

 const item_prices = order.items.map(it => ({
    item_id: it.item_id,
    locked_rate_per_kg: prices[it.item_id] && !isNaN(Number(prices[it.item_id])) ? Number(prices[it.item_id]) : null
 }));

 confirmOrder(
 { orderId: order.id, expected_delivery_date, item_prices },
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
 <View className="flex-1 bg-black/50 justify-center items-center p-4">
 <View className="w-full max-w-sm bg-white rounded-xl overflow-hidden">
 <View className="p-4 border-b border-[#e5e7eb] flex-row items-center justify-between">
 <Text className="text-lg text-[#202124] font-semibold">
 Confirm Order
 </Text>
 <Pressable onPress={onClose} className="p-2 -mr-2 rounded-lg active:bg-[#f7f8fa]"disabled={isPending}>
 <MaterialIcons name="close"size={24} className="text-[#5f6368]"/>
 </Pressable>
 </View>

 <ScrollView className="max-h-96" keyboardShouldPersistTaps="handled">
 <View className="p-4">
 <Text className="text-base text-[#202124] mb-4">
 Confirm order{""}
 <Text className="font-semibold text-[#202124]">
  {order.order_number || order.id.slice(0, 8)}
 </Text>
 {""}for {order.shop_name || order.retailer_name}?
 </Text>

 <Text className="text-sm font-semibold text-[#202124] mb-2">
 Estimated Delivery Date <Text className="text-red-500">*</Text>
 </Text>
 
 {Platform.OS === "ios"? (
 <View className="items-start mb-4">
 {date === null ? (
 <Pressable 
 onPress={() => setDate(new Date())} 
 className="flex-row items-center bg-[#f7f8fa] px-3 py-2 rounded-lg border border-[#e5e7eb]"
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
 colorScheme: "light",
 }}
 />
 </View>
 ) : (
 <View className="mb-4">
 <Pressable
 onPress={() => setShowPicker(true)}
 className="flex-row items-center justify-between bg-[#f7f8fa] px-4 py-3 rounded-lg border border-[#e5e7eb] active:bg-gray-100"
 >
 <Text className={`text-base ${date ? "text-[#202124]": "text-[#5f6368]"}`}>
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

 <Text className="text-sm font-semibold text-[#202124] mt-2 mb-2">
 Item Prices (Optional)
 </Text>
 {order.items.map((item) => (
   <View key={item.item_id} className="flex-row items-center justify-between mb-3 bg-[#f7f8fa] p-3 rounded-lg border border-[#e5e7eb]">
     <View className="flex-1 mr-2">
       <Text className="text-sm font-semibold text-[#202124] mb-1">{item.item_name}</Text>
       <Text className="text-xs text-[#5f6368]">Qty: {item.total_boxes} boxes</Text>
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

 <View className="flex-row justify-end mt-4">
 <Pressable
 onPress={onClose}
 className="px-4 py-2 mr-2 rounded-lg active:bg-gray-100"
 disabled={isPending}
 >
 <Text className="text-sm font-semibold text-[#5f6368]">Cancel</Text>
 </Pressable>
 
 <Pressable
 onPress={handleConfirm}
 disabled={!date || isPending}
 className={`px-4 py-2 rounded-lg flex-row items-center ${!date || isPending ? 'bg-gray-200' : 'bg-[#2E7D32]'} active:opacity-80`}
 >
 {isPending && <ActivityIndicator size="small"color="#ffffff"className="mr-2"/>}
 <Text className={`text-sm font-semibold ${!date || isPending ? 'text-[#5f6368]' : 'text-white'}`}>
 Confirm
 </Text>
 </Pressable>
 </View>
 </View>
 </ScrollView>
 </View>
 </View>
 </Modal>
 );
}
