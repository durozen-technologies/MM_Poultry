import React, { useCallback, useState, useMemo } from "react";
import { Pressable, Text, View, ScrollView, TextInput, ActivityIndicator, FlatList, Modal } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { getLedger, createRetailerPortalUser, recordRetailerPayment } from "../../api/retailers";
import { listOrdersByDate } from "../../api/orders";
import { apiItems } from "../../api/items";
import type { DailyOrder, LedgerOut } from "../../types/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatIstDate, toApiDate, todayIstDate } from "../../utils/ist-date";
import { DatePickerField } from "../../components/date-picker-field";
import { FormField } from "../../components/form-field";
import { getApiErrorMessage } from "../../api/client";

import { AdminScreenContainer } from "../../components/admin/admin-screen-container";
import { AdminHeader } from "../../components/admin/admin-header";
import { startOfWeek, startOfMonth, startOfYear } from "date-fns";

export type DateRangeOption = "All" | "Today" | "This Week" | "This Month" | "This Year" | "Custom";

export function AdminRetailerProfileScreen({ route, navigation }: { route: any; navigation: any }) {
 const { retailerId } = route.params;
 const [ledger, setLedger] = useState<LedgerOut | null>(null);
 const [orders, setOrders] = useState<DailyOrder[]>([]);
 const [loading, setLoading] = useState(true);

 const [paymentModalVisible, setPaymentModalVisible] = useState(false);
 const [paymentDate, setPaymentDate] = useState(new Date());
 const [paymentCash, setPaymentCash] = useState("0");
 const [paymentUpi, setPaymentUpi] = useState("0");
 const [paymentNotes, setPaymentNotes] = useState("");
 const [recordingPayment, setRecordingPayment] = useState(false);

 const [dateRangeOption, setDateRangeOption] = useState<DateRangeOption>("All");
 const [startDate, setStartDate] = useState<Date | null>(null);
 const [endDate, setEndDate] = useState<Date | null>(null);
 const [isDateModalOpen, setIsDateModalOpen] = useState(false);
 const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
 const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
 const [searchQueryOrderId, setSearchQueryOrderId] = useState("");

 React.useEffect(() => {
 const now = new Date();
 if (dateRangeOption === "Today") {
 setStartDate(now);
 setEndDate(now);
 } else if (dateRangeOption === "This Week") {
 setStartDate(startOfWeek(now, { weekStartsOn: 1 }));
 setEndDate(now);
 } else if (dateRangeOption === "This Month") {
 setStartDate(startOfMonth(now));
 setEndDate(now);
 } else if (dateRangeOption === "This Year") {
 setStartDate(startOfYear(now));
 setEndDate(now);
 } else if (dateRangeOption === "Custom") {
 setStartDate(customStartDate);
 setEndDate(customEndDate);
 } else {
 setStartDate(null);
 setEndDate(null);
 }
 }, [dateRangeOption, customStartDate, customEndDate]);


 const queryClient = useQueryClient();


 const refresh = useCallback(async () => {
 try {
 const [ledgerData, orderData] = await Promise.all([
 getLedger(retailerId),
 listOrdersByDate({ retailer_id: retailerId }),
 ]);
 setLedger(ledgerData);
 setOrders(orderData.items);
 } catch (e) {
 console.warn("Failed to load retailer profile", e);
 } finally {
 setLoading(false);
 }
 }, [retailerId]);

 useFocusEffect(
 useCallback(() => {
 void refresh();
 }, [refresh])
 );

 const handleRecordPayment = async () => {
 setRecordingPayment(true);
 try {
 await recordRetailerPayment(retailerId, {
 payment_date: toApiDate(paymentDate) || "",
 cash_amount: paymentCash || "0",
 upi_amount: paymentUpi || "0",
 notes: paymentNotes
 });
 setPaymentModalVisible(false);
 setPaymentCash("0");
 setPaymentUpi("0");
 setPaymentNotes("");
 refresh();
 } catch (e) {
 alert(getApiErrorMessage(e));
 } finally {
 setRecordingPayment(false);
 }
 };

 const [activeTab, setActiveTab] = useState("OVERVIEW");
 const [portalUsername, setPortalUsername] = useState("");
 const [portalPassword, setPortalPassword] = useState("");
 const [portalLoading, setPortalLoading] = useState(false);
 const [portalMessage, setPortalMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

 const createPortalAccount = useCallback(async () => {
 if (!portalUsername.trim() || !portalPassword.trim()) {
 setPortalMessage({ text: "Username and Password are required", type: 'error' });
 return;
 }
 setPortalLoading(true);
 setPortalMessage(null);
 try {
 await createRetailerPortalUser(retailerId, {
 username: portalUsername.trim(),
 password: portalPassword.trim(),
 });
 setPortalMessage({ text: "Portal account created successfully.", type: 'success' });
 setPortalUsername("");
 setPortalPassword("");
 } catch (e: unknown) {
 const msgStr = getApiErrorMessage(e);
 if ((e as { response?: { status?: number } })?.response?.status === 409) {
 setPortalMessage({ text: "This retailer already has a portal account.", type: 'error' });
 } else {
 setPortalMessage({ text: msgStr, type: 'error' });
 }
 } finally {
 setPortalLoading(false);
 }
 }, [portalUsername, portalPassword, retailerId]);

 const bal = useMemo(() => Number(ledger?.retailer?.credit_balance || 0), [ledger?.retailer?.credit_balance]);
 const billEntries = useMemo(() => ledger?.entries?.filter((e) => e.entry_type === "BILL") || [], [ledger?.entries]);
 const ledgerEntries = useMemo(() => ledger?.entries?.filter((e) => e.entry_type !== "BILL") || [], [ledger?.entries]);

 const filteredOrders = useMemo(() => {
 let filtered = orders;
 if (startDate && endDate) {
 const startStr = toApiDate(startDate);
 const endStr = toApiDate(endDate);
 if (startStr && endStr) {
 filtered = filtered.filter(o => o.order_date >= startStr && o.order_date <= endStr);
 }
 }
 if (searchQueryOrderId) {
 filtered = filtered.filter(o => 
 o.id.toLowerCase().includes(searchQueryOrderId.toLowerCase()) || 
 (o.order_number && String(o.order_number).toLowerCase().includes(searchQueryOrderId.toLowerCase()))
 );
 }
 return filtered;
 }, [orders, startDate, endDate, searchQueryOrderId]);

 if (loading && !ledger) {
 return (
 <AdminScreenContainer
 header={
 <AdminHeader 
 title="Loading..."
 onBack={() => navigation.goBack()} 
 />
 }
 >
 <View className="py-24 items-center justify-center">
 <ActivityIndicator size="large"className="text-[#2E7D32]"/>
 </View>
 </AdminScreenContainer>
 );
 }

 if (!ledger) {
 return (
 <AdminScreenContainer
 header={
 <AdminHeader 
 title="Error"
 onBack={() => navigation.goBack()} 
 />
 }
 >
 <View className="py-24 items-center justify-center px-4">
 <MaterialIcons name="error-outline"size={48} className="text-error mb-4"/>
 <Text className="text-[#5f6368] font-medium text-center">Failed to load retailer profile.</Text>
 </View>
 </AdminScreenContainer>
 );
 }

 const { retailer, entries } = ledger;

 return (
 <AdminScreenContainer
 noScroll
 header={
 <AdminHeader 
 title="Retailer Profile"
 subtitle={retailer.shop_name || "—"}
 onBack={() => navigation.goBack()} 
 rightContent={
 <View className="flex-row gap-2">
 <Pressable 
 onPress={refresh} 
 className="w-10 h-10 items-center justify-center rounded-lg bg-[#f7f8fa] active:bg-[#f7f8fa]"
 >
 {loading ? (
 <ActivityIndicator size="small"className="text-[#2E7D32]"/>
 ) : (
 <MaterialIcons name="refresh"size={20} className="text-[#202124]"/>
 )}
 </Pressable>
 <Pressable 
 onPress={() => navigation.navigate("EditRetailer", { retailerId: retailer.id })} 
 className="w-10 h-10 items-center justify-center rounded-lg bg-[#2E7D32]/10 active:bg-[#2E7D32]/20"
 >
 <MaterialIcons name="edit"size={20} className="text-[#2E7D32]"/>
 </Pressable>
 </View>
 }
 />
 }
 >
  {/* Header Profile Section */}
  <View className="bg-white px-5 py-6 border-b border-[#e5e7eb] flex-row items-center justify-between z-10 relative">
    <View className="flex-1 pr-4">
      <Text className="text-[22px] font-bold text-[#111111] mb-1">
        {retailer.name}
      </Text>
      {retailer.shop_name ? (
        <Text className="text-[15px] font-medium text-[#5f6368] mb-0.5">
          {retailer.shop_name}
        </Text>
      ) : null}
      {retailer.phone ? (
        <Text className="text-[15px] font-medium text-[#5f6368]">
          {retailer.phone}
        </Text>
      ) : null}
    </View>

    <View className="bg-[#FFF5F5] py-3 px-4 rounded-xl border border-[#FFE4E4] min-w-[140px]">
      <View className="flex-row items-center gap-1.5 mb-1.5">
        <View className="bg-[#D32F2F] rounded p-0.5">
          <MaterialIcons name="account-balance-wallet" size={12} color="white" />
        </View>
        <Text className="text-xs font-semibold text-[#D32F2F]">
          Outstanding Balance
        </Text>
      </View>
      <Text className="text-[26px] font-black text-[#D32F2F]">
        ₹{bal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
      </Text>
    </View>
  </View>

 {/* Tabs */}
 <View className="bg-white border-b border-[#e5e7eb] z-10">
 <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled"contentContainerStyle={{ paddingHorizontal: 16 }}>
 {["OVERVIEW", "ORDERS", "BILLS", "LEDGER"].map((tab) => (
 <Pressable 
 key={tab}
 onPress={() => setActiveTab(tab)}
 className={`py-4 px-4 mr-2 border-b transition-colors ${
 activeTab === tab ? "border-[#2E7D32]": "border-transparent"
 }`}
 >
 <Text className={`text-sm font-bold text-[#5f6368] uppercase tracking-wider ${
 activeTab === tab ? "text-[#2E7D32]": "text-[#5f6368]"
 }`}>
 {tab}
 </Text>
 </Pressable>
 ))}
 </ScrollView>
 </View>

 
 <>
 {activeTab === "OVERVIEW"&& (
 <ScrollView keyboardShouldPersistTaps="handled"className="flex-1 px-4"contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
{activeTab === "OVERVIEW"&& (
 <View className="flex-col gap-4">
 <View className="mb-2">
 <Pressable
 onPress={() => setPaymentModalVisible(true)}
 className="w-full h-14 bg-[#2E7D32] rounded-lg flex-row items-center justify-center active:scale-[0.98] transition-transform"
 >
 <MaterialIcons name="payments"size={20} className="text-on-primary mr-2"/>
 <Text className="text-on-primary text-base font-bold uppercase tracking-wider">Record Payment</Text>
 </Pressable>
 </View>
 

 <View className="bg-white rounded-lg p-5 border border-[#e5e7eb] flex-col gap-2">
 <View className="flex-row items-center gap-2 mb-2">
 <View className="w-8 h-8 rounded-lg bg-[#2E7D32]/10 items-center justify-center">
 <MaterialIcons name="contacts"size={16} className="text-[#2E7D32]"/>
 </View>
 <Text className="text-base font-bold text-[#5f6368] text-[#202124]">Contact Details</Text>
 </View>
 <InfoRow label="Primary Phone"value={retailer.phone || "—"} isLast />
 </View>

 <View className="bg-white rounded-lg p-5 border border-[#e5e7eb] flex-col gap-2">
 <View className="flex-row items-center gap-2 mb-2">
 <View className="w-8 h-8 rounded-lg bg-[#f7f8fa] border border-[#e5e7eb] items-center justify-center">
 <MaterialIcons name="storefront"size={16} className="text-tertiary"/>
 </View>
 <Text className="text-base font-bold text-[#5f6368] text-[#202124]">Business Information</Text>
 </View>
 <InfoRow label="Shop Name"value={retailer.shop_name || "—"} />
 <InfoRow label="Opening Balance"value={`₹${retailer.opening_balance}`} isLast />
 </View>

 {!retailer.has_portal_access && (
 <View className="bg-white rounded-lg p-5 border border-[#e5e7eb] flex-col gap-4">
 <View className="flex-row items-center gap-2">
 <View className="w-8 h-8 rounded-lg bg-[#2E7D32]/10 items-center justify-center">
 <MaterialIcons name="security"size={16} className="text-[#2E7D32]"/>
 </View>
 <Text className="text-base font-bold text-[#5f6368] text-[#202124]">
 Portal Access
 </Text>
 </View>
 
 <MessageBanner message={portalMessage} />
 
 <View className="flex-col gap-4 mt-1">
 <View>
 <Text className="text-xs font-bold text-[#5f6368] uppercase tracking-wider mb-2">Username</Text>
 <TextInput
 className="bg-white h-12 border border-[#e5e7eb] rounded-lg px-4 text-lg text-[#202124] text-[#202124] focus:border-[#2E7D32]"
 autoCapitalize="none"
 autoCorrect={false}
 value={portalUsername}
 onChangeText={setPortalUsername}
 placeholder="retailer_username"
 placeholderTextColor="#717973"
 />
 </View>
 <View>
 <Text className="text-xs font-bold text-[#5f6368] uppercase tracking-wider mb-2">Password</Text>
 <TextInput
 className="bg-white h-12 border border-[#e5e7eb] rounded-lg px-4 text-lg text-[#202124] text-[#202124] focus:border-[#2E7D32]"
 secureTextEntry
 autoCapitalize="none"
 autoCorrect={false}
 value={portalPassword}
 onChangeText={setPortalPassword}
 placeholder="••••••••"
 placeholderTextColor="#717973"
 />
 </View>
 <Pressable 
 className="w-full bg-[#2E7D32] h-14 rounded-lg flex items-center justify-center mt-2 active:scale-[0.98] transition-transform"
 onPress={createPortalAccount}
 disabled={portalLoading}
 >
 <Text className="text-white font-bold text-base font-bold uppercase tracking-wider">
 {portalLoading ? "Creating...": "Create Login Account"}
 </Text>
 </Pressable>
 </View>
 </View>
 )}
 </View>
 )}

 
 </ScrollView>
 )}
 {activeTab === "ORDERS"&& (
 <View className="flex-1">
 <View className="px-4 py-3 bg-white border-b border-[#e5e7eb] flex-row gap-3 z-20">
 <View className="flex-1 relative justify-center">
 <View className="absolute left-3 z-10">
 <MaterialIcons name="search" size={20} className="text-[#5f6368]"/>
 </View>
 <TextInput 
 className="w-full bg-[#f7f8fa] h-12 rounded-lg border border-[#e5e7eb] pl-10 pr-3 font-sans text-base text-[#111111] focus:border-[#2E7D32]"
 placeholder="Search order ID..."
 placeholderTextColor="#717973"
 value={searchQueryOrderId}
 onChangeText={setSearchQueryOrderId}
 />
 </View>
 <View className="w-32">
 <Pressable 
 className="h-12 bg-white rounded-lg border border-[#e5e7eb] flex-row items-center justify-between px-3 active:bg-[#f7f8fa]"
 onPress={() => setIsDateModalOpen(true)}
 >
 <View className="flex-1 pr-1">
 <Text className="text-[10px] text-[#7a7f85] font-sans uppercase font-bold tracking-wider">Date</Text>
 <Text className="text-xs font-sans text-[#202124] font-semibold" numberOfLines={1}>{dateRangeOption}</Text>
 </View>
 <MaterialIcons name="arrow-drop-down" size={20} className="text-[#5f6368]" />
 </Pressable>
 </View>
 </View>
 <FlatList
 data={filteredOrders}
 keyExtractor={item => item.id}
 className="flex-1 px-4"
 contentContainerStyle={{ paddingBottom: 100 }}
 ListEmptyComponent={
 <View className="bg-white rounded-lg p-8 border border-dashed border-[#e5e7eb] items-center justify-center mt-2">
 <MaterialIcons name="receipt"size={32} className="text-[#5f6368]/50 mb-3"/>
 <Text className="text-base font-bold text-[#5f6368] text-[#202124] mb-1">No Orders Found</Text>
 <Text className="text-base text-[#5f6368] text-[#5f6368] text-center max-w-[250px]">
 There are no orders recorded for this retailer.
 </Text>
 </View>
 }
 renderItem={({ item: order }) => (
 <Pressable 
 className="bg-white rounded-lg p-5 border border-[#e5e7eb] relative overflow-hidden active:scale-[0.98] transition-transform mb-3"
 onPress={() => navigation.navigate("OrderDetail", { order })}
 >
 <View className={`absolute top-0 left-0 w-1.5 h-full ${
 order.status === 'PLACED' ? 'bg-error' : 
 order.status === 'ACKNOWLEDGED' ? 'bg-tertiary' :
 order.status === 'FULFILLED' ? 'bg-[#2E7D32]' : 'bg-[#f7f8fa]'
 }`} />
 
 <View className="ml-2">
 <View className="flex-row justify-between items-center mb-3">
 <View className="flex-row items-center gap-2">
 <MaterialIcons name="event"size={16} className="text-[#5f6368]"/>
 <Text className="text-sm font-bold text-[#5f6368] text-[#202124]">{formatIstDate(order.order_date)}</Text>
 </View>
 <View className={`px-2.5 py-1 rounded-lg border ${
 order.status === 'PLACED' ? 'bg-error-container/50 border-error/20 text-error' : 
 order.status === 'ACKNOWLEDGED' ? 'bg-[#f7f8fa] border border-[#e5e7eb] border-tertiary/20 text-tertiary' :
 order.status === 'FULFILLED' ? 'bg-[#2E7D32]/10 border-[#2E7D32]/20 text-[#2E7D32]' : 'bg-[#f7f8fa] border-[#e5e7eb] text-[#5f6368]'
 }`}>
 <Text className="text-xs font-bold uppercase tracking-widest text-inherit">
 {order.status === 'ACKNOWLEDGED' ? 'CONFIRMED' : order.status === 'FULFILLED' ? (order.is_billed ? 'BILLED' : 'DELIVERED') : order.status}
 </Text>
 </View>
 </View>
 <View className="mt-2 border-t border-surface-variant/40 pt-2">
 {order.items?.map((it) => (
 <View key={it.id} className="flex-row justify-between items-center mb-2 last:mb-0">
 <View>
 <Text className="text-base text-[#5f6368] text-[#202124]">{it.item_name || 'Unknown Item'}</Text>
 <Text className="text-xs font-bold text-[#5f6368] mt-0.5">{it.total_boxes || 0} boxes</Text>
 </View>
 <View className="items-end">
 <Text className="text-sm text-[#5f6368] text-[#5f6368]">Est: {it.requested_kg || 0} kg</Text>
 {it.delivered_kg ? (
 <Text className="text-sm font-bold text-[#5f6368] text-[#2E7D32] mt-0.5">Net: {it.delivered_kg} kg</Text>
 ) : null}
 </View>
 </View>
 ))}
 </View>
 </View>
 </Pressable>
 )}
 />
 </View>
 )}
 {activeTab === "BILLS"&& (
 <FlatList
 data={billEntries}
 keyExtractor={(_, idx) => String(idx)}
 className="flex-1 px-4"
 contentContainerStyle={{ paddingBottom: 100 }}
 ListEmptyComponent={
 <View className="bg-white rounded-lg p-8 border border-dashed border-[#e5e7eb] items-center justify-center mt-2">
 <MaterialIcons name="receipt-long"size={32} className="text-[#5f6368]/50 mb-3"/>
 <Text className="text-base font-bold text-[#5f6368] text-[#202124] mb-1">No Bills Found</Text>
 <Text className="text-base text-[#5f6368] text-[#5f6368] text-center max-w-[250px]">
 There are no billing records for this retailer.
 </Text>
 </View>
 }
 renderItem={({ item }) => (
 <View className="bg-white rounded-lg p-5 border border-[#e5e7eb] relative overflow-hidden mb-3">
 <View className="absolute top-0 left-0 w-1.5 h-full bg-[#2E7D32]"/>
 
 <View className="ml-2 flex-row justify-between items-start mb-1">
 <View className="flex-row items-center gap-3">
 <View className="w-10 h-10 rounded-lg bg-[#2E7D32]/10 items-center justify-center border border-[#2E7D32]/20">
 <MaterialIcons name="receipt"size={18} className="text-[#2E7D32]"/>
 </View>
 <View>
 <Text className="text-sm font-bold text-[#5f6368] text-[#5f6368] uppercase tracking-wider mb-0.5">{formatIstDate(item.entry_date)}</Text>
 <Text className="text-sm font-bold text-[#5f6368] text-[#202124]">{item.reference || "Bill"}</Text>
 </View>
 </View>
 <Text className="text-2xl font-bold text-[#2E7D32] font-black mt-1">₹{Number(item.debit).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</Text>
 </View>

 {item.bill_items && item.bill_items.length > 0 ? (
 <View className="ml-2 mt-2 border-t border-surface-variant/40 pt-3">
 {item.bill_items.map((bItem, idx) => (
 <View key={idx} className="flex-row justify-between items-center mb-2 last:mb-0">
 <View>
 <Text className="text-base text-[#5f6368] text-[#202124]">{bItem.item_name}</Text>
 <Text className="text-xs font-bold text-[#5f6368] mt-0.5">{bItem.boxes} boxes</Text>
 </View>
 <View className="items-end">
 <Text className="text-sm text-[#5f6368] text-[#202124]">Net: {bItem.net_kg} kg</Text>
 <Text className="text-xs font-bold text-[#5f6368] mt-0.5">₹{Number(bItem.amount).toLocaleString("en-IN")}</Text>
 </View>
 </View>
 ))}
 </View>
 ) : item.notes ? (
 <View className="ml-2 mt-2 border-t border-surface-variant/40 pt-3">
 <Text className="text-sm text-[#5f6368] text-[#5f6368]">{item.notes}</Text>
 </View>
 ) : null}
 </View>
 )}
 />
 )}
 {activeTab === "LEDGER"&& (
 <View className="flex-1 px-4">
 <View className="bg-white rounded-lg p-2 border border-[#e5e7eb] flex-1 overflow-hidden">
 <FlatList
 data={ledgerEntries}
 keyExtractor={(_, idx) => String(idx)}
 contentContainerStyle={{ paddingBottom: 100 }}
 ListEmptyComponent={
 <View className="p-8 items-center justify-center">
 <MaterialIcons name="menu-book"size={32} className="text-[#5f6368]/50 mb-3"/>
 <Text className="text-base text-[#5f6368] text-[#5f6368] text-center">No ledger entries found.</Text>
 </View>
 }
 renderItem={({ item, index }) => (
 <View className={`flex-row justify-between p-4 ${index !== ledgerEntries.length - 1 ? 'border-b border-surface-variant/50' : ''}`}>
 <View className="flex-col justify-center">
 <Text className="text-xs font-bold text-[#5f6368] uppercase tracking-wider mb-1">{formatIstDate(item.entry_date)}</Text>
 <Text className="text-sm font-bold text-[#5f6368] text-[#202124]">{item.entry_type}</Text>
 {item.notes ? (
 <Text className="text-sm text-[#5f6368] text-[#5f6368] mt-0.5">{item.notes}</Text>
 ) : null}
 </View>
 <View className="flex-col items-end justify-center">
 {Number(item.debit) > 0 && (
 <View className="bg-error-container/30 px-3 py-1.5 rounded-voltagent-sm border border-error/10">
 <Text className="text-sm font-bold text-[#5f6368] font-black text-error">₹{Number(item.debit).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</Text>
 </View>
 )}
 {Number(item.credit) > 0 && (
 <View className="bg-[#2E7D32]/10 px-3 py-1.5 rounded-voltagent-sm border border-[#2E7D32]/10 mt-1">
 <Text className="text-sm font-bold text-[#5f6368] font-black text-[#2E7D32]">₹{Number(item.credit).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</Text>
 </View>
 )}
 </View>
 </View>
 )}
 />
 </View>
 </View>
 )}

 </>

 {/* Record Payment Modal */}
 {paymentModalVisible && (
 <View className="absolute inset-0 bg-[#2E7D32]/50 justify-center items-center p-4 z-50">
 <View className="bg-white w-full max-w-sm rounded-lg overflow-hidden border border-[#e5e7eb]">
 <View className="bg-[#f7f8fa]-low px-6 py-4 flex-row justify-between items-center border-b border-[#e5e7eb]">
 <Text className="text-2xl font-bold text-[#202124]">Record Payment</Text>
 <Pressable onPress={() => setPaymentModalVisible(false)} className="w-8 h-8 rounded-lg items-center justify-center active:bg-[#f7f8fa]">
 <MaterialIcons name="close"size={20} className="text-[#5f6368]"/>
 </Pressable>
 </View>
 <ScrollView className="p-6">
 <View className="mb-4">
 <DatePickerField
 label="Payment Date"
 value={paymentDate}
 onChange={setPaymentDate}
 />
 </View>
 <View className="flex-row gap-3 mb-4">
 <View className="flex-1">
 <FormField
 label="Cash (₹)"
 value={paymentCash}
 onChangeText={setPaymentCash}
 keyboardType="decimal-pad"
 />
 </View>
 <View className="flex-1">
 <FormField
 label="UPI (₹)"
 value={paymentUpi}
 onChangeText={setPaymentUpi}
 keyboardType="decimal-pad"
 />
 </View>
 </View>
 <View className="mb-6">
 <FormField
 label="Notes (Optional)"
 value={paymentNotes}
 onChangeText={setPaymentNotes}
 placeholder="e.g. Bank transfer, old due"
 />
 </View>
 <Pressable
 onPress={handleRecordPayment}
 disabled={recordingPayment}
 className={`w-full py-4 rounded-lg items-center flex-row justify-center ${recordingPayment ? "bg-[#2E7D32]/50": "bg-[#2E7D32] active:bg-[#2E7D32]/90"}`}
 >
 {recordingPayment ? (
 <ActivityIndicator color="#fff"size="small"/>
 ) : (
 <>
 <MaterialIcons name="check-circle"size={20} className="text-on-primary mr-2"/>
 <Text className="text-on-primary text-base">Save Payment</Text>
 </>
 )}
 </Pressable>
 </ScrollView>
 </View>
 </View>
 )}

 {/* Date Filter Modal */}
 <Modal visible={isDateModalOpen} transparent animationType="slide" onRequestClose={() => setIsDateModalOpen(false)}>
 <Pressable className="flex-1 bg-black/50 justify-end" onPress={() => setIsDateModalOpen(false)}>
 <Pressable className="bg-white rounded-t-2xl p-6 min-h-[40%]" onPress={(e) => e.stopPropagation()}>
 <Text className="text-xl font-bold font-sans text-[#111111] mb-4">Filter by Date</Text>
 
 {(["All", "Today", "This Week", "This Month", "This Year", "Custom"] as DateRangeOption[]).map((opt) => (
 <Pressable 
 key={opt}
 className="py-3 border-b border-[#e5e7eb] last:border-b-0 flex-row items-center justify-between"
 onPress={() => {
 if (opt !== "Custom") {
 setDateRangeOption(opt);
 setIsDateModalOpen(false);
 } else {
 setDateRangeOption("Custom");
 }
 }}
 >
 <Text className={`font-sans text-base ${dateRangeOption === opt ? 'text-[#2E7D32] font-bold' : 'text-[#202124]'}`}>{opt}</Text>
 {dateRangeOption === opt && <MaterialIcons name="check" size={20} className="text-[#2E7D32]" />}
 </Pressable>
 ))}
 
 {dateRangeOption === "Custom" && (
 <View className="mt-4 gap-4">
 <DatePickerField 
 label="Start Date"
 value={customStartDate}
 onChange={setCustomStartDate}
 maximumDate={customEndDate || todayIstDate()}
 />
 <DatePickerField 
 label="End Date"
 value={customEndDate}
 onChange={setCustomEndDate}
 minimumDate={customStartDate || undefined}
 maximumDate={todayIstDate()}
 />
 <Pressable 
 className="bg-[#2E7D32] h-12 rounded-lg items-center justify-center mt-2"
 onPress={() => setIsDateModalOpen(false)}
 >
 <Text className="text-white font-bold font-sans">Apply Custom Range</Text>
 </Pressable>
 </View>
 )}
 </Pressable>
 </Pressable>
 </Modal>

 </AdminScreenContainer>
 );
}

const MessageBanner = React.memo(({ message }: { message: { text: string; type: 'success' | 'error' } | null }) => {
 if (!message) return null;
 return (
 <View className={`p-4 rounded-lg mb-4 flex-row items-center border ${
 message.type === 'success' 
 ? 'bg-[#2E7D32]/10/30 border-[#2E7D32]/20' 
 : 'bg-error-container/30 border-error/20'
 }`}>
 <MaterialIcons 
 name={message.type === 'success' ? "check-circle": "error-outline"} 
 size={20} 
 className={message.type === 'success' ? "text-[#2E7D32] mr-2": "text-error mr-2"} 
 />
 <Text className={`text-sm font-bold text-[#5f6368] font-semibold flex-1 ${
 message.type === 'success' ? 'text-[#2E7D32]' : 'text-error'
 }`}>
 {message.text}
 </Text>
 </View>
 );
});

const InfoRow = React.memo(({ 
 label, 
 value,
 isLast = false
}: { 
 label: string; 
 value: string;
 isLast?: boolean;
}) => {
 return (
 <View className={`flex-row justify-between py-3 ${!isLast ? 'border-b border-surface-variant/50' : ''}`}>
 <Text className="text-sm font-bold text-[#5f6368] text-[#5f6368] uppercase tracking-wider">{label}</Text>
 <Text className="text-sm font-bold text-[#5f6368] text-[#202124] flex-1 text-right ml-4">{value}</Text>
 </View>
 );
});
