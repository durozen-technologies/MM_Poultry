import React, { useCallback, useState, useMemo } from "react";
import {
  Pressable,
  Text,
  View,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { getLedger, recordPayment, createRetailerPortalUser, createReturn } from "../../api/retailers";
import { listTodayOrders } from "../../api/orders";
import { apiItems } from "../../api/items";
import { listRates, upsertRate } from "../../api/rates";
import type { DailyOrder, LedgerOut } from "../../types/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatIstDate, toApiDate, todayIstDate } from "../../utils/ist-date";
import { DatePickerField } from "../../components/date-picker-field";
import { FormField } from "../../components/form-field";
import { getApiErrorMessage } from "../../api/client";

import { AdminScreenContainer } from "../../components/admin/admin-screen-container";
import { AdminHeader } from "../../components/admin/admin-header";

export function AdminRetailerProfileScreen({ route, navigation }: { route: any; navigation: any }) {
  const { retailerId } = route.params;
  const [ledger, setLedger] = useState<LedgerOut | null>(null);
  const [orders, setOrders] = useState<DailyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [cash, setCash] = useState("");
  const [upi, setUpi] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayIstDate());
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [activeTab, setActiveTab] = useState("OVERVIEW");
  const [portalUsername, setPortalUsername] = useState("");
  const [portalPassword, setPortalPassword] = useState("");
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalMessage, setPortalMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  
  const [actionType, setActionType] = useState<"PAYMENT" | "RETURN" | "ADJUSTMENT">("PAYMENT");
  const [isCredit, setIsCredit] = useState(true); // for adjustment
  const [returnWeight, setReturnWeight] = useState("");
  const [returnRate, setReturnRate] = useState("");
  const [returnReason, setReturnReason] = useState("");

  const queryClient = useQueryClient();
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [customRateInput, setCustomRateInput] = useState("");
  const [rateMsg, setRateMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const { data: itemsPage, isLoading: loadingItems } = useQuery({
    queryKey: ["admin_items", { activeOnly: true }],
    queryFn: () => apiItems.list(true),
  });
  const items = itemsPage?.items || [];

  const { data: rates = [], isLoading: loadingRates } = useQuery({
    queryKey: ["admin_rates"],
    queryFn: () => listRates(),
  });

  const saveRateMutation = useMutation({
    mutationFn: (payload: { item_id: string; retailer_id: string; rate_per_kg: string }) => upsertRate(payload),
    onSuccess: () => {
      setRateMsg({ text: "Custom rate saved successfully", type: 'success' });
      queryClient.invalidateQueries({ queryKey: ["admin_rates"] });
      queryClient.invalidateQueries({ queryKey: ["admin_items", { activeOnly: true }] });
      setTimeout(() => setRateMsg(null), 3000);
    },
    onError: (e) => {
      setRateMsg({ text: getApiErrorMessage(e), type: 'error' });
      setTimeout(() => setRateMsg(null), 3000);
    }
  });

  const saveCustomRate = useCallback(() => {
    if (!selectedItemId || !customRateInput) return;
    saveRateMutation.mutate({ item_id: selectedItemId, retailer_id: retailerId, rate_per_kg: customRateInput });
  }, [selectedItemId, customRateInput, retailerId, saveRateMutation]);

  const refresh = useCallback(async () => {
    try {
      const [ledgerData, orderData] = await Promise.all([
        getLedger(retailerId),
        listTodayOrders(),
      ]);
      setLedger(ledgerData);
      setOrders(orderData.items.filter((o) => o.retailer_id === retailerId));
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

  const collect = useCallback(async () => {
    if (actionType === "PAYMENT" || actionType === "ADJUSTMENT") {
      if (!cash && !upi) {
        setMsg({ text: "Please enter an amount.", type: 'error' });
        setTimeout(() => setMsg(null), 3000);
        return;
      }
      const c = Number(cash || "0");
      const u = Number(upi || "0");
      if (!Number.isFinite(c) || !Number.isFinite(u)) {
        setMsg({ text: "Invalid amount", type: 'error' });
        setTimeout(() => setMsg(null), 3000);
        return;
      }
    }
    if (actionType === "RETURN") {
      if (!returnWeight || !returnRate) {
        setMsg({ text: "Please enter both weight and rate.", type: 'error' });
        setTimeout(() => setMsg(null), 3000);
        return;
      }
      const w = Number(returnWeight);
      const r = Number(returnRate);
      if (!Number.isFinite(w) || !Number.isFinite(r) || w <= 0 || r <= 0) {
        setMsg({ text: "Invalid weight or rate", type: 'error' });
        setTimeout(() => setMsg(null), 3000);
        return;
      }
    }
    
    setLoading(true);
    try {
      if (actionType === "RETURN") {
        const w = Number(returnWeight);
        const r = Number(returnRate);
        await createReturn(retailerId, {
          weight_kg: String(w),
          rate_per_kg: String(r),
          total_amount: String(w * r),
          reason: returnReason.trim() || undefined,
        });
        setReturnWeight("");
        setReturnRate("");
        setReturnReason("");
        setMsg({ text: "Return recorded successfully", type: 'success' });
      } else {
        await recordPayment(retailerId, {
          cash_amount: cash || "0",
          upi_amount: upi || "0",
          payment_date: toApiDate(paymentDate) ?? undefined,
          type: actionType === "ADJUSTMENT" ? "ADJUSTMENT" : "RECEIVED",
          is_credit: actionType === "ADJUSTMENT" ? isCredit : true,
        });
        setCash("");
        setUpi("");
        setMsg({ text: actionType === "ADJUSTMENT" ? "Adjustment recorded" : "Payment recorded", type: 'success' });
      }
      setTimeout(() => setMsg(null), 3000);
      await refresh();
      queryClient.invalidateQueries({ queryKey: ["admin", "retailers"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    } catch (e) {
      setMsg({ text: getApiErrorMessage(e), type: 'error' });
      setTimeout(() => setMsg(null), 3000);
    } finally {
      setLoading(false);
    }
  }, [actionType, cash, upi, paymentDate, returnWeight, returnRate, returnReason, retailerId, isCredit, refresh, queryClient]);

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
          <ActivityIndicator size="large" className="text-primary" />
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
          <MaterialIcons name="error-outline" size={48} className="text-error mb-4" />
          <Text className="text-on-surface-variant font-medium text-center">Failed to load retailer profile.</Text>
        </View>
      </AdminScreenContainer>
    );
  }

  const { retailer, entries } = ledger;
  const bal = useMemo(() => Number(retailer.credit_balance || 0), [retailer.credit_balance]);
  const billEntries = useMemo(() => entries.filter((e) => e.entry_type === "BILL"), [entries]);

  return (
    <AdminScreenContainer
      noScroll
      header={
        <AdminHeader 
          title="Retailer Profile" 
          subtitle={retailer.shop_name || retailer.owner_name}
          onBack={() => navigation.goBack()} 
          rightContent={
            <View className="flex-row gap-2">
              <Pressable 
                onPress={refresh} 
                className="w-10 h-10 items-center justify-center rounded-full bg-surface-container-highest active:bg-surface-variant"
              >
                {loading ? (
                  <ActivityIndicator size="small" className="text-primary" />
                ) : (
                  <MaterialIcons name="refresh" size={20} className="text-on-surface" />
                )}
              </Pressable>
              <Pressable 
                onPress={() => navigation.navigate("EditRetailer", { retailerId: retailer.id })} 
                className="w-10 h-10 items-center justify-center rounded-full bg-primary/10 active:bg-primary/20"
              >
                <MaterialIcons name="edit" size={20} className="text-primary" />
              </Pressable>
            </View>
          }
        />
      }
    >
      {/* Header Profile Section */}
      <View className="bg-surface-container-lowest px-4 py-6 border-b border-outline-variant/30 items-center z-10 shadow-sm relative overflow-hidden">
        <View className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-16 translate-x-16" />
        <View className="absolute bottom-0 left-0 w-24 h-24 bg-error/5 rounded-full translate-y-12 -translate-x-12" />
        
        <Text className="font-headline-md text-on-surface font-black text-center mb-1">
          {retailer.name}
        </Text>
        <Text className="font-title-sm text-on-surface-variant font-bold text-center mb-6">
          {retailer.shop_name || retailer.owner_name || "—"}
        </Text>

        <View className="w-64 bg-error-container/20 p-5 rounded-3xl border border-error/20 flex-col items-center justify-center shadow-sm">
          <View className="flex-row items-center gap-1.5 mb-1.5">
            <MaterialIcons name="account-balance-wallet" size={16} className="text-error" />
            <Text className="font-label-md text-error uppercase tracking-widest font-bold">
              Outstanding Balance
            </Text>
          </View>
          <Text className="font-display-sm text-error font-black">
            ₹{bal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View className="bg-surface-container-lowest border-b border-outline-variant/30 shadow-sm z-10">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
          {["OVERVIEW", "ORDERS", "BILLS", "RATES", "LEDGER"].map((tab) => (
            <Pressable 
              key={tab}
              onPress={() => setActiveTab(tab)}
              className={`py-4 px-4 mr-2 border-b-2 transition-colors ${
                activeTab === tab ? "border-primary" : "border-transparent"
              }`}
            >
              <Text className={`font-label-md font-bold uppercase tracking-wider ${
                activeTab === tab ? "text-primary" : "text-on-surface-variant"
              }`}>
                {tab}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <KeyboardAwareScrollView 
        enableOnAndroid={true} 
        keyboardShouldPersistTaps="always" 
        className="flex-1 px-4 pt-4" 
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <MessageBanner message={msg} />

        {activeTab === "OVERVIEW" && (
          <View className="flex-col gap-4">
            
            {/* Payment / Action Form */}
            <View className="bg-surface-container-lowest rounded-3xl p-5 border border-outline-variant/30 shadow-sm overflow-hidden relative">
              <View className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500 z-10" />
              
              <View className="flex-row items-center gap-2 mb-4 ml-1">
                <View className="w-8 h-8 rounded-full bg-emerald-500/10 items-center justify-center">
                  <MaterialIcons name="payments" size={16} className="text-emerald-600" />
                </View>
                <Text className="font-title-md text-on-surface font-bold">Record Transaction</Text>
              </View>

              <View className="flex-row bg-surface-container-highest rounded-xl p-1 mb-5 border border-outline-variant/20 ml-1">
                <Pressable 
                  className={`flex-1 py-2.5 rounded-lg items-center transition-colors ${actionType === "PAYMENT" ? "bg-emerald-500 shadow-sm" : ""}`}
                  onPress={() => setActionType("PAYMENT")}
                >
                  <Text className={`font-label-sm font-bold uppercase tracking-wider ${actionType === "PAYMENT" ? "text-white" : "text-on-surface-variant"}`}>Payment</Text>
                </Pressable>
                <Pressable 
                  className={`flex-1 py-2.5 rounded-lg items-center transition-colors ${actionType === "RETURN" ? "bg-emerald-500 shadow-sm" : ""}`}
                  onPress={() => setActionType("RETURN")}
                >
                  <Text className={`font-label-sm font-bold uppercase tracking-wider ${actionType === "RETURN" ? "text-white" : "text-on-surface-variant"}`}>Return</Text>
                </Pressable>
                <Pressable 
                  className={`flex-1 py-2.5 rounded-lg items-center transition-colors ${actionType === "ADJUSTMENT" ? "bg-emerald-500 shadow-sm" : ""}`}
                  onPress={() => setActionType("ADJUSTMENT")}
                >
                  <Text className={`font-label-sm font-bold uppercase tracking-wider ${actionType === "ADJUSTMENT" ? "text-white" : "text-on-surface-variant"}`}>Adjust</Text>
                </Pressable>
              </View>

              {actionType === "PAYMENT" && (
                <View className="ml-1 flex-col gap-4">
                  <View className="flex-row gap-4">
                    <View className="flex-1">
                      <Text className="font-label-sm font-bold text-on-surface-variant uppercase tracking-wider mb-2">Cash (₹)</Text>
                      <TextInput
                        className="bg-surface h-12 border border-outline-variant/50 rounded-xl px-4 text-title-sm font-bold text-on-surface focus:border-emerald-500"
                        keyboardType="decimal-pad"
                        value={cash}
                        onChangeText={setCash}
                        placeholder="0.00"
                        placeholderTextColor="#9ca3af"
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="font-label-sm font-bold text-on-surface-variant uppercase tracking-wider mb-2">UPI (₹)</Text>
                      <TextInput
                        className="bg-surface h-12 border border-outline-variant/50 rounded-xl px-4 text-title-sm font-bold text-on-surface focus:border-emerald-500"
                        keyboardType="decimal-pad"
                        value={upi}
                        onChangeText={setUpi}
                        placeholder="0.00"
                        placeholderTextColor="#9ca3af"
                      />
                    </View>
                  </View>
                  <View>
                    <Text className="font-label-sm font-bold text-on-surface-variant uppercase tracking-wider mb-2">Date</Text>
                    <DatePickerField 
                      label="" 
                      value={paymentDate} 
                      onChange={setPaymentDate} 
                      inputStyle="h-12 bg-surface border border-outline-variant/50 rounded-xl px-4" 
                    />
                  </View>
                </View>
              )}

              {actionType === "RETURN" && (
                <View className="ml-1 flex-col gap-4">
                  <View className="flex-row gap-4">
                    <View className="flex-1">
                      <Text className="font-label-sm font-bold text-on-surface-variant uppercase tracking-wider mb-2">Weight (KG)</Text>
                      <TextInput
                        className="bg-surface h-12 border border-outline-variant/50 rounded-xl px-4 text-title-sm font-bold text-on-surface focus:border-emerald-500"
                        keyboardType="decimal-pad"
                        value={returnWeight}
                        onChangeText={setReturnWeight}
                        placeholder="0.00"
                        placeholderTextColor="#9ca3af"
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="font-label-sm font-bold text-on-surface-variant uppercase tracking-wider mb-2">Rate / KG (₹)</Text>
                      <TextInput
                        className="bg-surface h-12 border border-outline-variant/50 rounded-xl px-4 text-title-sm font-bold text-on-surface focus:border-emerald-500"
                        keyboardType="decimal-pad"
                        value={returnRate}
                        onChangeText={setReturnRate}
                        placeholder="0.00"
                        placeholderTextColor="#9ca3af"
                      />
                    </View>
                  </View>
                  <View>
                    <Text className="font-label-sm font-bold text-on-surface-variant uppercase tracking-wider mb-2">Reason</Text>
                    <TextInput
                      className="bg-surface h-12 border border-outline-variant/50 rounded-xl px-4 text-body-md text-on-surface focus:border-emerald-500"
                      value={returnReason}
                      onChangeText={setReturnReason}
                      placeholder="Optional remarks"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                </View>
              )}

              {actionType === "ADJUSTMENT" && (
                <View className="ml-1 flex-col gap-4">
                  <View className="flex-row bg-surface-container-highest rounded-xl p-1 border border-outline-variant/20">
                    <Pressable 
                      className={`flex-1 py-2.5 rounded-lg items-center transition-colors ${isCredit ? "bg-surface shadow-sm border border-outline-variant/10" : ""}`}
                      onPress={() => setIsCredit(true)}
                    >
                      <Text className={`font-label-sm font-bold uppercase tracking-wider ${isCredit ? "text-emerald-600" : "text-on-surface-variant"}`}>Credit (-Bal)</Text>
                    </Pressable>
                    <Pressable 
                      className={`flex-1 py-2.5 rounded-lg items-center transition-colors ${!isCredit ? "bg-surface shadow-sm border border-outline-variant/10" : ""}`}
                      onPress={() => setIsCredit(false)}
                    >
                      <Text className={`font-label-sm font-bold uppercase tracking-wider ${!isCredit ? "text-error" : "text-on-surface-variant"}`}>Debit (+Bal)</Text>
                    </Pressable>
                  </View>
                  
                  <View>
                    <Text className="font-label-sm font-bold text-on-surface-variant uppercase tracking-wider mb-2">Amount (₹)</Text>
                    <TextInput
                      className="bg-surface h-12 border border-outline-variant/50 rounded-xl px-4 text-title-sm font-bold text-on-surface focus:border-emerald-500"
                      keyboardType="decimal-pad"
                      value={cash}
                      onChangeText={setCash}
                      placeholder="0.00"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                </View>
              )}

              <Pressable 
                className="h-13 bg-emerald-500 rounded-xl flex-row items-center justify-center gap-2 mt-5 shadow-sm shadow-emerald-500/30 active:scale-[0.98] transition-transform ml-1"
                onPress={collect}
              >
                <MaterialIcons name="done" size={20} color="white" />
                <Text className="text-white font-bold text-label-lg uppercase tracking-wider">Submit</Text>
              </Pressable>
            </View>

            <View className="bg-surface-container-lowest rounded-3xl p-5 shadow-sm border border-outline-variant/30 flex-col gap-2">
              <View className="flex-row items-center gap-2 mb-2">
                <View className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center">
                  <MaterialIcons name="contacts" size={16} className="text-primary" />
                </View>
                <Text className="font-title-md text-on-surface font-bold">Contact Details</Text>
              </View>
              <InfoRow label="Primary Phone" value={retailer.phone || "—"} />
              <InfoRow label="WhatsApp" value={retailer.whatsapp || "—"} />
              <InfoRow label="Alternate Phone" value={retailer.alternate_phone || "—"} isLast />
            </View>

            <View className="bg-surface-container-lowest rounded-3xl p-5 shadow-sm border border-outline-variant/30 flex-col gap-2">
              <View className="flex-row items-center gap-2 mb-2">
                <View className="w-8 h-8 rounded-full bg-secondary/10 items-center justify-center">
                  <MaterialIcons name="location-on" size={16} className="text-secondary" />
                </View>
                <Text className="font-title-md text-on-surface font-bold">Location & Delivery</Text>
              </View>
              <InfoRow label="Full Address" value={retailer.address || "—"} />
              <InfoRow label="Area" value={retailer.area || "—"} />
              <InfoRow label="Route" value={retailer.route_name || "—"} />
              {retailer.route_area ? (
                <InfoRow label="Route area" value={retailer.route_area} />
              ) : null}
              <InfoRow label="Locality" value={retailer.area || "—"} />
              <InfoRow label="Preferred Time" value={retailer.preferred_delivery_time || "—"} isLast />
            </View>

            <View className="bg-surface-container-lowest rounded-3xl p-5 shadow-sm border border-outline-variant/30 flex-col gap-2">
              <View className="flex-row items-center gap-2 mb-2">
                <View className="w-8 h-8 rounded-full bg-tertiary/10 items-center justify-center">
                  <MaterialIcons name="storefront" size={16} className="text-tertiary" />
                </View>
                <Text className="font-title-md text-on-surface font-bold">Business Information</Text>
              </View>
              <InfoRow label="Owner Name" value={retailer.owner_name || "—"} />
              <InfoRow label="Shop Name" value={retailer.shop_name || "—"} />
              <InfoRow label="Category" value={retailer.category || "—"} />
              <InfoRow label="Opening Balance" value={`₹${retailer.opening_balance}`} />
              <InfoRow label="Notes" value={retailer.notes || "—"} isLast />
            </View>

            {!retailer.has_portal_access && (
              <View className="bg-surface-container-lowest rounded-3xl p-5 shadow-sm border border-outline-variant/30 flex-col gap-4">
                <View className="flex-row items-center gap-2">
                  <View className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center">
                    <MaterialIcons name="security" size={16} className="text-primary" />
                  </View>
                  <Text className="font-title-md text-on-surface font-bold">
                    Portal Access
                  </Text>
                </View>
                
                <MessageBanner message={portalMessage} />
                
                <View className="flex-col gap-4 mt-1">
                  <View>
                    <Text className="font-label-sm font-bold text-on-surface-variant uppercase tracking-wider mb-2">Username</Text>
                    <TextInput
                      className="bg-surface h-12 border border-outline-variant/50 rounded-xl px-4 text-body-lg text-on-surface focus:border-primary"
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={portalUsername}
                      onChangeText={setPortalUsername}
                      placeholder="retailer_username"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                  <View>
                    <Text className="font-label-sm font-bold text-on-surface-variant uppercase tracking-wider mb-2">Password</Text>
                    <TextInput
                      className="bg-surface h-12 border border-outline-variant/50 rounded-xl px-4 text-body-lg text-on-surface focus:border-primary"
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={portalPassword}
                      onChangeText={setPortalPassword}
                      placeholder="••••••••"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                  <Pressable 
                    className="w-full bg-primary h-13 rounded-xl flex items-center justify-center mt-2 active:scale-[0.98] transition-transform shadow-sm shadow-primary/30"
                    onPress={createPortalAccount}
                    disabled={portalLoading}
                  >
                    <Text className="text-white font-bold text-label-lg uppercase tracking-wider">
                      {portalLoading ? "Creating..." : "Create Login Account"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        )}

        {activeTab === "ORDERS" && (
          <View className="flex-col gap-3">
            {orders.length === 0 ? (
              <View className="bg-surface-container-lowest rounded-3xl p-8 border border-dashed border-outline-variant/50 items-center justify-center mt-2">
                <MaterialIcons name="receipt" size={32} className="text-on-surface-variant/50 mb-3" />
                <Text className="font-title-md text-on-surface font-bold mb-1">No Orders Today</Text>
                <Text className="font-body-md text-on-surface-variant text-center max-w-[250px]">
                  There are no orders recorded for this retailer today.
                </Text>
              </View>
            ) : (
              orders.map((order) => (
                <Pressable 
                  key={order.id}
                  className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/20 shadow-sm relative overflow-hidden active:scale-[0.98] transition-transform"
                  onPress={() => navigation.navigate("OrderDetail", { order })}
                >
                  <View className={`absolute top-0 left-0 w-1.5 h-full ${
                    order.status === 'PLACED' ? 'bg-error' : 
                    order.status === 'ACKNOWLEDGED' ? 'bg-tertiary' :
                    order.status === 'FULFILLED' ? 'bg-primary' : 'bg-surface-variant'
                  }`} />
                  
                  <View className="ml-2">
                    <View className="flex-row justify-between items-center mb-3">
                      <View className="flex-row items-center gap-2">
                        <MaterialIcons name="event" size={16} className="text-on-surface-variant" />
                        <Text className="font-title-sm text-on-surface font-bold">{formatIstDate(order.order_date)}</Text>
                      </View>
                      <View className={`px-2.5 py-1 rounded-full border ${
                        order.status === 'PLACED' ? 'bg-error-container/50 border-error/20 text-error' : 
                        order.status === 'ACKNOWLEDGED' ? 'bg-tertiary/10 border-tertiary/20 text-tertiary' :
                        order.status === 'FULFILLED' ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-surface-variant/30 border-outline-variant/20 text-on-surface-variant'
                      }`}>
                        <Text className="font-label-sm uppercase tracking-widest font-bold text-inherit">
                          {order.status === 'ACKNOWLEDGED' ? 'CONFIRMED' : order.status === 'FULFILLED' ? 'DELIVERED' : order.status}
                        </Text>
                      </View>
                    </View>
                    <View className="bg-surface-container-highest/30 rounded-xl p-3 border border-outline-variant/10 flex-row justify-between items-center">
                      <Text className="font-label-sm font-bold text-on-surface-variant uppercase tracking-wider">Total Weight</Text>
                      <View className="flex-row items-end gap-1">
                        <Text className="font-title-lg font-black text-primary">
                          {order.items?.reduce((s, it) => s + Number(it.requested_kg || 0), 0) || 0}
                        </Text>
                        <Text className="font-label-sm font-bold text-primary mb-0.5">KG</Text>
                      </View>
                    </View>
                  </View>
                </Pressable>
              ))
            )}
          </View>
        )}

        {activeTab === "BILLS" && (
          <View className="flex-col gap-3">
            {billEntries.length === 0 ? (
              <View className="bg-surface-container-lowest rounded-3xl p-8 border border-dashed border-outline-variant/50 items-center justify-center mt-2">
                <MaterialIcons name="receipt-long" size={32} className="text-on-surface-variant/50 mb-3" />
                <Text className="font-title-md text-on-surface font-bold mb-1">No Bills Found</Text>
                <Text className="font-body-md text-on-surface-variant text-center max-w-[250px]">
                  There are no billing records for this retailer.
                </Text>
              </View>
            ) : (
              billEntries.map((item, idx) => (
                <View key={idx} className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/20 shadow-sm flex-row justify-between items-center relative overflow-hidden">
                  <View className="absolute top-0 left-0 w-1.5 h-full bg-error" />
                  <View className="ml-2 flex-row items-center gap-3">
                    <View className="w-10 h-10 rounded-full bg-error/10 items-center justify-center border border-error/20">
                      <MaterialIcons name="receipt" size={18} className="text-error" />
                    </View>
                    <View>
                      <Text className="font-label-md font-bold text-on-surface-variant uppercase tracking-wider mb-0.5">{formatIstDate(item.entry_date)}</Text>
                      <Text className="font-title-sm text-on-surface font-bold">{item.reference || "Bill"}</Text>
                    </View>
                  </View>
                  <Text className="font-title-lg text-error font-black">₹{Number(item.debit).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</Text>
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === "LEDGER" && (
          <View className="bg-surface-container-lowest rounded-3xl p-2 shadow-sm border border-outline-variant/30">
            {entries.length === 0 ? (
              <View className="p-8 items-center justify-center">
                <MaterialIcons name="menu-book" size={32} className="text-on-surface-variant/50 mb-3" />
                <Text className="font-body-md text-on-surface-variant text-center">No ledger entries found.</Text>
              </View>
            ) : (
              entries.map((item, idx) => (
                <View key={idx} className={`flex-row justify-between p-4 ${idx !== entries.length - 1 ? 'border-b border-surface-variant/50' : ''}`}>
                  <View className="flex-col justify-center">
                    <Text className="font-label-sm font-bold text-on-surface-variant uppercase tracking-wider mb-1">{formatIstDate(item.entry_date)}</Text>
                    <Text className="font-title-sm text-on-surface font-bold">{item.entry_type}</Text>
                  </View>
                  <View className="flex-col items-end justify-center">
                    {Number(item.debit) > 0 && (
                      <View className="bg-error-container/30 px-3 py-1.5 rounded-lg border border-error/10">
                        <Text className="font-title-sm font-black text-error">Dr ₹{Number(item.debit).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</Text>
                      </View>
                    )}
                    {Number(item.credit) > 0 && (
                      <View className="bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/10 mt-1">
                        <Text className="font-title-sm font-black text-primary">Cr ₹{Number(item.credit).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === "RATES" && (
          <View className="flex-col gap-6">
            <View className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl py-4 shadow-sm">
              <Text className="font-label-md font-bold text-on-surface-variant uppercase tracking-wider mb-3 px-5">Select Item to Override</Text>
              {loadingItems ? (
                <View className="py-4 items-center">
                  <ActivityIndicator color="#115E29" />
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
                  {items.map((item) => {
                    const isSelected = selectedItemId === item.id;
                    return (
                      <Pressable 
                        key={item.id}
                        onPress={() => {
                          setSelectedItemId(item.id);
                          const existingRate = rates.find((r) => r.item_id === item.id && r.retailer_id === retailerId);
                          setCustomRateInput(existingRate ? String(existingRate.rate_per_kg) : "");
                        }}
                        className={`px-4 py-2.5 rounded-full border flex-row items-center transition-colors ${
                          isSelected 
                            ? "bg-primary border-primary shadow-sm shadow-primary/30" 
                            : "bg-surface-container-highest border-outline-variant/50"
                        }`}
                      >
                        {isSelected && (
                          <MaterialIcons name="check" size={16} color="white" className="mr-1.5" />
                        )}
                        <Text className={`font-bold ${
                          isSelected ? "text-white" : "text-on-surface-variant"
                        }`}>
                          {item.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            {selectedItemId && (
              <View className="bg-surface-container-lowest rounded-3xl p-5 border border-outline-variant/30 shadow-sm relative overflow-hidden">
                <View className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -translate-y-8 translate-x-8" />
                
                <View className="flex-row items-center gap-2 mb-4">
                  <View className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center">
                    <MaterialIcons name="price-change" size={16} className="text-primary" />
                  </View>
                  <Text className="font-title-md font-bold text-on-surface">Custom Rate Override</Text>
                </View>

                <MessageBanner message={rateMsg} />

                <View className="mb-4">
                  <Text className="font-label-sm font-bold text-on-surface-variant uppercase tracking-wider mb-2 ml-1">
                    Special Rate (₹ / KG)
                  </Text>
                  <View className="relative flex-row items-center">
                    <View className="absolute left-4 z-10">
                      <Text className="font-title-lg text-on-surface-variant font-bold">₹</Text>
                    </View>
                    <TextInput
                      className="w-full bg-surface-container-highest/50 h-14 rounded-2xl border border-outline-variant/50 pl-10 pr-4 font-title-lg font-black text-primary focus:border-primary"
                      value={customRateInput}
                      onChangeText={setCustomRateInput}
                      placeholder="0.00"
                      keyboardType="decimal-pad"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                </View>
                
                <Pressable 
                  className={`h-13 rounded-2xl flex-row items-center justify-center gap-2 active:scale-[0.98] transition-transform ${
                    !customRateInput.trim() ? "bg-surface-variant" : "bg-primary shadow-sm shadow-primary/30"
                  }`} 
                  onPress={saveCustomRate}
                  disabled={saveRateMutation.isPending || !customRateInput.trim()}
                >
                  {saveRateMutation.isPending ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <>
                      <MaterialIcons name="save" size={18} color={!customRateInput.trim() ? "#717973" : "white"} />
                      <Text className={`font-bold text-label-lg uppercase tracking-wider ${!customRateInput.trim() ? "text-on-surface-variant" : "text-white"}`}>Save Rate</Text>
                    </>
                  )}
                </Pressable>
              </View>
            )}

            <View className="flex-col gap-3">
              <Text className="font-title-lg text-on-surface font-bold ml-1 mb-1">Active Rates for this Retailer</Text>
              {items.map((item) => {
                const customRate = rates.find((r) => r.item_id === item.id && r.retailer_id === retailerId);
                const globalRate = rates.find((r) => r.item_id === item.id && !r.retailer_id);
                if (!customRate && !globalRate) return null;

                return (
                  <View key={item.id} className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/20 shadow-sm flex-row justify-between items-center relative overflow-hidden">
                    <View className={`absolute top-0 left-0 w-1.5 h-full ${customRate ? 'bg-primary' : 'bg-surface-variant'}`} />
                    <View className="ml-2 flex-1">
                      <Text className="font-title-sm text-on-surface font-bold mb-1">{item.name}</Text>
                      <View className={`self-start px-2 py-0.5 rounded ${customRate ? 'bg-primary/10 border border-primary/20' : 'bg-surface-variant/30 border border-outline-variant/20'}`}>
                        <Text className={`font-label-sm uppercase font-bold tracking-wider ${customRate ? 'text-primary' : 'text-on-surface-variant'}`}>
                          {customRate ? "Custom Rate" : "Global Default"}
                        </Text>
                      </View>
                    </View>
                    <View className="items-end bg-surface-container-highest/30 px-4 py-2 rounded-xl border border-outline-variant/10">
                      <Text className="font-label-sm text-on-surface-variant uppercase font-bold tracking-wider mb-0.5">Rate / KG</Text>
                      <Text className={`font-title-lg font-black ${customRate ? 'text-primary' : 'text-on-surface'}`}>
                        ₹{customRate ? customRate.rate_per_kg : globalRate?.rate_per_kg}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </KeyboardAwareScrollView>
    </AdminScreenContainer>
  );
}

const MessageBanner = React.memo(({ message }: { message: { text: string; type: 'success' | 'error' } | null }) => {
  if (!message) return null;
  return (
    <View className={`p-4 rounded-xl mb-4 flex-row items-center border ${
      message.type === 'success' 
        ? 'bg-primary-container/30 border-primary/20' 
        : 'bg-error-container/30 border-error/20'
    }`}>
      <MaterialIcons 
        name={message.type === 'success' ? "check-circle" : "error-outline"} 
        size={20} 
        className={message.type === 'success' ? "text-primary mr-2" : "text-error mr-2"} 
      />
      <Text className={`font-label-md font-semibold flex-1 ${
        message.type === 'success' ? 'text-primary' : 'text-error'
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
      <Text className="font-label-md font-bold text-on-surface-variant uppercase tracking-wider">{label}</Text>
      <Text className="font-title-sm font-bold text-on-surface flex-1 text-right ml-4">{value}</Text>
    </View>
  );
});
