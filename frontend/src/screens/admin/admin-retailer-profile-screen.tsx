import { useCallback, useState } from "react";
import {
  Pressable,
  Text,
  View,
  ScrollView,
  TextInput,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { getLedger, recordPayment, createRetailerPortalUser, createReturn } from "../../api/retailers";
import { listTodayOrders } from "../../api/orders";
import { apiItems } from "../../api/items";
import { listRates, upsertRate } from "../../api/rates";
import type { DailyOrder, LedgerOut, Rate } from "../../types/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatIstDate, toApiDate, todayIstDate } from "../../utils/ist-date";
import { DatePickerField } from "../../components/date-picker-field";
import { FormField } from "../../components/form-field";
export function AdminRetailerProfileScreen({ route, navigation }: { route: any; navigation: any }) {
  const { retailerId } = route.params;
  const [ledger, setLedger] = useState<LedgerOut | null>(null);
  const [orders, setOrders] = useState<DailyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [cash, setCash] = useState("");
  const [upi, setUpi] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayIstDate());
  const [msg, setMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("OVERVIEW");
  const [portalUsername, setPortalUsername] = useState("");
  const [portalPassword, setPortalPassword] = useState("");
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalMessage, setPortalMessage] = useState<string | null>(null);
  
  const [actionType, setActionType] = useState<"PAYMENT" | "RETURN" | "ADJUSTMENT">("PAYMENT");
  const [isCredit, setIsCredit] = useState(true); // for adjustment
  const [returnWeight, setReturnWeight] = useState("");
  const [returnRate, setReturnRate] = useState("");
  const [returnReason, setReturnReason] = useState("");

  const queryClient = useQueryClient();
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [customRateInput, setCustomRateInput] = useState("");
  const [rateMsg, setRateMsg] = useState<string | null>(null);

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
      setRateMsg("Custom rate saved successfully");
      queryClient.invalidateQueries({ queryKey: ["admin_rates"] });
      setTimeout(() => setRateMsg(null), 3000);
    },
    onError: (e) => {
      setRateMsg(e instanceof Error ? e.message : "Failed to save rate");
      setTimeout(() => setRateMsg(null), 3000);
    }
  });

  const saveCustomRate = () => {
    if (!selectedItemId || !customRateInput) return;
    saveRateMutation.mutate({ item_id: selectedItemId, retailer_id: retailerId, rate_per_kg: customRateInput });
  };

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

  async function collect() {
    if (actionType === "PAYMENT" || actionType === "ADJUSTMENT") {
      if (!cash && !upi) {
        setMsg("Please enter an amount.");
        setTimeout(() => setMsg(null), 3000);
        return;
      }
    }
    if (actionType === "RETURN") {
      if (!returnWeight || !returnRate) {
        setMsg("Please enter both weight and rate.");
        setTimeout(() => setMsg(null), 3000);
        return;
      }
    }
    
    setLoading(true);
    try {
      if (actionType === "RETURN") {
        await createReturn(retailerId, {
          weight_kg: returnWeight,
          rate_per_kg: returnRate,
          total_amount: String(Number(returnWeight) * Number(returnRate)),
          reason: returnReason || undefined,
        });
        setReturnWeight("");
        setReturnRate("");
        setReturnReason("");
        setMsg("Return recorded successfully");
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
        setMsg(actionType === "ADJUSTMENT" ? "Adjustment recorded" : "Payment recorded");
      }
      setTimeout(() => setMsg(null), 3000);
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
      setLoading(false);
    }
  }

  async function createPortalAccount() {
    if (!portalUsername.trim() || !portalPassword.trim()) {
      setPortalMessage("Username and Password are required");
      return;
    }
    setPortalLoading(true);
    setPortalMessage(null);
    try {
      await createRetailerPortalUser(retailerId, {
        username: portalUsername.trim(),
        password: portalPassword.trim(),
      });
      setPortalMessage("Portal account created successfully.");
      setPortalUsername("");
      setPortalPassword("");
    } catch (e: any) {
      if (e?.response?.status === 409) {
        setPortalMessage("This retailer already has a portal account.");
      } else {
        setPortalMessage(e instanceof Error ? e.message : "Failed to create portal account.");
      }
    } finally {
      setPortalLoading(false);
    }
  }

  if (loading || !ledger) {
    return (
      <SafeAreaView className="flex-1 max-w-3xl mx-auto w-full bg-background justify-center items-center">
        <MaterialIcons name="loop" size={32} className="text-primary" />
      </SafeAreaView>
    );
  }

  const { retailer, entries } = ledger;
  const bal = Number(retailer.credit_balance || 0);
  const billEntries = entries.filter((e) => e.entry_type === "BILL");
  const actionEntries = entries.filter((e) => e.entry_type === "PAYMENT" || e.entry_type === "BILL_PAYMENT" || e.entry_type === "RETURN" || e.entry_type === "ADJUSTMENT");

  return (
    <SafeAreaView className="flex-1 max-w-3xl mx-auto w-full bg-background" edges={["top", "bottom"]}>
      <View className="h-16 px-4 flex-row items-center justify-between bg-surface/80">
        <View className="flex-row items-center gap-2">
          <Pressable accessibilityRole="button" accessibilityLabel="Button"
            className="w-11 h-11 -ml-2 flex items-center justify-center rounded-full active:bg-surface-variant/50"
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="arrow-back" size={24} className="text-on-surface" />
          </Pressable>
          <Text className="font-headline-sm text-headline-sm text-primary font-semibold">
            Retailer Profile
          </Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Button"
          className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center active:bg-surface-container-high"
          onPress={() => navigation.navigate("EditRetailer", { retailerId: retailer.id })}
        >
          <MaterialIcons name="edit" size={20} className="text-on-surface" />
        </Pressable>
      </View>

      <KeyboardAwareScrollView enableOnAndroid={true} keyboardShouldPersistTaps="always" className="flex-1 w-full" contentContainerStyle={{ paddingBottom: 100 }}>
        <View className="px-4 py-6 bg-surface flex-col items-center justify-center gap-2">
          <View className="flex-row items-center justify-center gap-2 flex-wrap">
            <Text className="font-headline-md text-headline-md text-on-surface font-semibold text-center">
              {retailer.name}
            </Text>
          </View>
          <Text className="text-on-surface-variant mt-1 text-center">{retailer.shop_name || retailer.owner_name || "—"}</Text>
        </View>

        <View className="py-3 bg-background px-4 items-center">
          <View className="w-48 bg-error-container p-4 rounded-2xl shadow-sm flex-col items-center justify-center">
            <Text className="font-label-md text-on-error-container uppercase opacity-90 font-semibold text-[10px]">
              Outstanding Balance
            </Text>
            <Text className="font-headline-sm text-on-error-container font-bold mt-1">
              ₹{bal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </Text>
          </View>
        </View>

        <View className="bg-surface border-b border-surface-container-high mt-4">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4">
            {["OVERVIEW", "ORDERS", "BILLS", "RATES", "LEDGER"].map((tab) => (
              <Pressable accessibilityRole="button" accessibilityLabel="Button"
                key={tab}
                onPress={() => setActiveTab(tab)}
                className={`py-3 px-4 mr-2 ${activeTab === tab ? "border-b-2 border-primary" : ""}`}
              >
                <Text className={`font-label-md font-semibold ${activeTab === tab ? "text-primary" : "text-secondary"}`}>
                  {tab}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View className="p-4 bg-background flex-col gap-4">
          {msg ? <Text className="text-error font-semibold">{msg}</Text> : null}

          {activeTab === "OVERVIEW" && (
            <View className="flex-col gap-4">
              <View className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm flex-col gap-3">
                <View className="flex-row items-center gap-2 mb-1">
                  <MaterialIcons name="contacts" size={18} className="text-primary" />
                  <Text className="font-label-lg text-on-surface font-semibold">Contact Details</Text>
                </View>
                <InfoRow label="Primary Phone" value={retailer.phone || "—"} />
                <InfoRow label="WhatsApp" value={retailer.whatsapp || "—"} />
                <InfoRow label="Alternate Phone" value={retailer.alternate_phone || "—"} />
              </View>

              <View className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm flex-col gap-3">
                <View className="flex-row items-center gap-2 mb-1">
                  <MaterialIcons name="location-on" size={18} className="text-primary" />
                  <Text className="font-label-lg text-on-surface font-semibold">Location & Delivery</Text>
                </View>
                <InfoRow label="Full Address" value={retailer.address || "—"} />
                <InfoRow label="Area" value={retailer.area || "—"} />
                <InfoRow label="Route" value={retailer.route_name || "—"} />
                <InfoRow label="Preferred Time" value={retailer.preferred_delivery_time || "—"} />
              </View>

              <View className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm flex-col gap-3">
                <View className="flex-row items-center gap-2 mb-1">
                  <MaterialIcons name="storefront" size={18} className="text-primary" />
                  <Text className="font-label-lg text-on-surface font-semibold">Business Information</Text>
                </View>
                <InfoRow label="Owner Name" value={retailer.owner_name || "—"} />
                <InfoRow label="Shop Name" value={retailer.shop_name || "—"} />
                <InfoRow label="Category" value={retailer.category || "—"} />
                <InfoRow label="Opening Balance" value={`₹${retailer.opening_balance}`} />
                <InfoRow label="Notes" value={retailer.notes || "—"} />
              </View>

              {!retailer.has_portal_access && (
                <View className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm flex-col gap-3">
                  <View className="flex-row items-center gap-2 mb-2">
                    <MaterialIcons name="security" size={20} className="text-primary" />
                    <Text className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                      Portal Access
                    </Text>
                  </View>
                  {portalMessage && (
                    <Text className={`font-label-md p-2 rounded ${portalMessage.includes("success") ? "text-primary bg-primary-container" : "text-error bg-error-container"}`}>
                      {portalMessage}
                    </Text>
                  )}
                  <View className="flex-col gap-2">
                    <FormField
                      label="Username"
                      placeholder="Username"
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={portalUsername}
                      onChangeText={setPortalUsername}
                    />
                    <FormField
                      label="Password"
                      placeholder="Password"
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={portalPassword}
                      onChangeText={setPortalPassword}
                    />
                    <Pressable accessibilityRole="button" accessibilityLabel="Button"
                      className="w-full bg-primary h-12 rounded-lg flex items-center justify-center mt-2 active:scale-95"
                      onPress={createPortalAccount}
                      disabled={portalLoading}
                    >
                      <Text className="text-on-primary font-semibold font-label-md">
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
                <Text className="text-on-surface-variant text-center py-6">No orders today for this retailer.</Text>
              ) : (
                orders.map((order) => (
                  <Pressable accessibilityRole="button" accessibilityLabel="Button"
                    key={order.id}
                    className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/20"
                    onPress={() => navigation.navigate("OrderDetail", { order })}
                  >
                    <View className="flex-row justify-between">
                      <Text className="font-body-md text-on-surface font-semibold">{formatIstDate(order.order_date)}</Text>
                      <Text className="font-label-md text-on-surface-variant">{order.status}</Text>
                    </View>
                    <Text className="font-headline-sm text-primary mt-1">{order.items?.reduce((s, it) => s + Number(it.requested_kg || 0), 0) || 0} kg</Text>
                  </Pressable>
                ))
              )}
            </View>
          )}

          {activeTab === "BILLS" && (
            <View className="flex-col gap-2">
              {billEntries.length === 0 ? (
                <Text className="text-on-surface-variant text-center py-6">No bills found.</Text>
              ) : (
                billEntries.map((item, idx) => (
                  <View key={idx} className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/20 flex-row justify-between">
                    <View>
                      <Text className="font-body-md text-on-surface-variant">{formatIstDate(item.entry_date)}</Text>
                      <Text className="font-label-md text-on-surface font-semibold mt-1">{item.reference || "Bill"}</Text>
                    </View>
                    <Text className="font-body-md text-error font-semibold">₹{item.debit}</Text>
                  </View>
                ))
              )}
            </View>
          )}



          {activeTab === "LEDGER" && (
            <View className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm">
              {entries.map((item, idx) => (
                <View key={idx} className="flex-row justify-between border-b border-surface-variant py-3">
                  <View className="flex-col">
                    <Text className="font-body-md text-on-surface-variant">{formatIstDate(item.entry_date)}</Text>
                    <Text className="font-label-md text-on-surface font-semibold mt-1">{item.entry_type}</Text>
                  </View>
                  <View className="flex-col items-end">
                    {Number(item.debit) > 0 && <Text className={`font-body-md font-semibold ${item.entry_type === "ADJUSTMENT" ? "text-error" : "text-error"}`}>Dr ₹{item.debit}</Text>}
                    {Number(item.credit) > 0 && <Text className={`font-body-md font-semibold ${item.entry_type === "RETURN" ? "text-primary" : "text-primary"}`}>Cr ₹{item.credit}</Text>}
                  </View>
                </View>
              ))}
              {entries.length === 0 && (
                <Text className="text-on-surface-variant text-center py-4">No ledger entries found.</Text>
              )}
            </View>
          )}

          {activeTab === "RATES" && (
            <View className="flex-col gap-4">
              <View className="bg-surface border border-outline-variant/20 rounded-2xl p-4">
                <Text className="font-label-md text-on-surface-variant uppercase font-semibold mb-3">Select Item</Text>
                {loadingItems ? (
                  <MaterialIcons name="loop" size={24} className="text-primary animate-spin" />
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row pb-2">
                    {items.map((item) => (
                      <Pressable accessibilityRole="button"
                        key={item.id}
                        onPress={() => {
                          setSelectedItemId(item.id);
                          const existingRate = rates.find((r) => r.item_id === item.id && r.retailer_id === retailerId);
                          setCustomRateInput(existingRate ? String(existingRate.rate_per_kg) : "");
                        }}
                        className={`px-4 py-2 rounded-full mr-2 border ${
                          selectedItemId === item.id 
                            ? "bg-primary border-primary" 
                            : "bg-surface border-outline-variant"
                        }`}
                      >
                        <Text className={`font-semibold ${
                          selectedItemId === item.id ? "text-on-primary" : "text-on-surface"
                        }`}>
                          {item.name}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                )}
              </View>

              {selectedItemId && (
                <View className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/20">
                  <Text className="font-label-md text-on-surface-variant uppercase font-semibold mb-3">
                    Custom Rate (₹/kg)
                  </Text>
                  {rateMsg && (
                    <Text className={`mb-3 font-semibold ${rateMsg.includes("success") ? "text-primary" : "text-error"}`}>
                      {rateMsg}
                    </Text>
                  )}
                  <TextInput
                    placeholderTextColor="#737373"
                    className="bg-surface h-12 border border-outline-variant rounded-lg px-3 text-body-md mb-3 text-on-surface"
                    value={customRateInput}
                    onChangeText={setCustomRateInput}
                    placeholder="Enter special rate"
                    keyboardType="decimal-pad"
                  />
                  <Pressable accessibilityRole="button" className="bg-primary h-11 rounded-lg items-center justify-center active:scale-95" onPress={saveCustomRate}>
                    <Text className="text-on-primary font-semibold">Save Custom Rate</Text>
                  </Pressable>
                </View>
              )}

              <Text className="font-headline-sm text-on-surface font-semibold mt-2">Active Rates</Text>
              <View className="flex-col gap-2">
                {items.map((item) => {
                  const customRate = rates.find((r) => r.item_id === item.id && r.retailer_id === retailerId);
                  const globalRate = rates.find((r) => r.item_id === item.id && !r.retailer_id);
                  if (!customRate && !globalRate) return null;

                  return (
                    <View key={item.id} className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/20 flex-row justify-between items-center">
                      <View>
                        <Text className="font-body-md text-on-surface font-semibold">{item.name}</Text>
                        <Text className="font-label-md text-on-surface-variant mt-1">
                          {customRate ? "Custom Retailer Rate" : "Global Default Rate"}
                        </Text>
                      </View>
                      <Text className="font-headline-sm text-primary">₹{customRate ? customRate.rate_per_kg : globalRate?.rate_per_kg}/kg</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-2 border-b border-surface-variant/40">
      <Text className="font-body-md text-on-surface-variant">{label}</Text>
      <Text className="font-body-md text-on-surface font-semibold flex-1 text-right ml-4">{value}</Text>
    </View>
  );
}
