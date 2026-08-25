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
import type { DailyOrder, LedgerOut } from "../../types/api";
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
          onPress={() => alert("Edit Retailer functionality is under construction")}
        >
          <MaterialIcons name="edit" size={20} className="text-on-surface" />
        </Pressable>
      </View>

      <KeyboardAwareScrollView enableOnAndroid={true} keyboardShouldPersistTaps="always" className="flex-1 w-full" contentContainerStyle={{ paddingBottom: 100 }}>
        <View className="px-4 py-6 bg-surface flex-col gap-2">
          <View className="flex-row justify-between items-start">
            <View className="flex-col gap-1 flex-1">
              <View className="flex-row items-center gap-2 flex-wrap">
                <Text className="font-headline-md text-headline-md text-on-surface font-semibold">
                  {retailer.name}
                </Text>
                <View className="bg-tertiary-fixed px-2 py-1 rounded-full">
                  <Text className="font-label-md text-label-md text-on-tertiary-fixed-variant font-semibold text-[10px]">
                    {retailer.is_active ? "ACTIVE" : "INACTIVE"}
                  </Text>
                </View>
              </View>
              <Text className="text-on-surface-variant mt-1">{retailer.shop_name || retailer.owner_name || "—"}</Text>
            </View>
          </View>
          <View className="flex-row items-center mt-2">
            <MaterialIcons name="phone" size={16} className="text-on-surface" />
            <Text className="text-on-surface-variant ml-1">{retailer.phone || "N/A"}</Text>
          </View>
        </View>

        <View className="pl-4 py-3 bg-background">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-3 pr-4">
            <View className="w-40 bg-error-container p-3 rounded-2xl shadow-sm flex-col justify-between min-h-[96px] mr-3">
              <Text className="font-label-md text-on-error-container uppercase opacity-90 font-semibold text-[10px]">
                Outstanding
              </Text>
              <Text className="font-headline-sm text-on-error-container font-semibold mt-1">₹{bal}</Text>
            </View>
            <View className="w-40 bg-surface-container-lowest p-3 rounded-2xl shadow-sm flex-col justify-between min-h-[96px] mr-3">
              <Text className="font-label-md text-secondary uppercase font-semibold text-[10px]">Credit Limit</Text>
              <Text className="font-headline-sm text-on-surface font-semibold mt-1">₹{retailer.credit_limit || 0}</Text>
            </View>
          </ScrollView>
        </View>

        <View className="bg-surface border-b border-surface-container-high mt-4">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4">
            {["OVERVIEW", "ORDERS", "BILLS", "ACTIONS", "LEDGER"].map((tab) => (
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

          {activeTab === "ACTIONS" && (
            <View className="flex-col gap-4">
              <View className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm">
                
                <View className="flex-row bg-surface-container rounded-lg p-1 mb-4">
                  {(["PAYMENT", "RETURN", "ADJUSTMENT"] as const).map((type) => (
                    <Pressable
                      key={type}
                      onPress={() => setActionType(type)}
                      className={`flex-1 py-2 items-center justify-center rounded-md ${actionType === type ? "bg-surface shadow-sm" : ""}`}
                    >
                      <Text className={`font-label-md font-semibold ${actionType === type ? "text-primary" : "text-on-surface-variant"}`}>
                        {type}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {actionType === "RETURN" ? (
                  <View className="flex-col gap-3">
                    <View className="flex-row gap-2">
                      <TextInput placeholderTextColor="#737373" className="flex-1 bg-surface h-12 border border-outline-variant rounded-lg px-3 text-body-md text-on-surface" value={returnWeight} onChangeText={setReturnWeight} placeholder="Weight (kg)" keyboardType="decimal-pad" />
                      <TextInput placeholderTextColor="#737373" className="flex-1 bg-surface h-12 border border-outline-variant rounded-lg px-3 text-body-md text-on-surface" value={returnRate} onChangeText={setReturnRate} placeholder="Rate (₹/kg)" keyboardType="decimal-pad" />
                    </View>
                    <TextInput placeholderTextColor="#737373" className="w-full bg-surface h-12 border border-outline-variant rounded-lg px-3 text-body-md text-on-surface" value={returnReason} onChangeText={setReturnReason} placeholder="Reason (e.g., Spoiled, Dead on arrival)" />
                    {returnWeight && returnRate ? (
                      <Text className="text-on-surface-variant font-label-md">Total Credit: ₹{(Number(returnWeight) * Number(returnRate)).toFixed(2)}</Text>
                    ) : null}
                  </View>
                ) : (
                  <View className="flex-col gap-3">
                    <DatePickerField label="Date" value={paymentDate} onChange={setPaymentDate} />
                    <View className="flex-row gap-2">
                      <TextInput placeholderTextColor="#737373" className="flex-1 bg-surface h-12 border border-outline-variant rounded-lg px-3 text-body-md text-on-surface" value={cash} onChangeText={setCash} placeholder="Cash (₹)" keyboardType="decimal-pad" />
                      <TextInput placeholderTextColor="#737373" className="flex-1 bg-surface h-12 border border-outline-variant rounded-lg px-3 text-body-md text-on-surface" value={upi} onChangeText={setUpi} placeholder="UPI (₹)" keyboardType="decimal-pad" />
                    </View>
                    {actionType === "ADJUSTMENT" && (
                      <Pressable className="flex-row items-center gap-2 mt-2" onPress={() => setIsCredit(!isCredit)}>
                        <View className={`w-5 h-5 rounded border ${isCredit ? "bg-primary border-primary" : "border-outline"} items-center justify-center`}>
                          {isCredit && <MaterialIcons name="check" size={16} color="white" />}
                        </View>
                        <Text className="text-on-surface font-body-md">Credit Balance (Reduces Outstanding)</Text>
                      </Pressable>
                    )}
                  </View>
                )}

                <Pressable accessibilityRole="button" accessibilityLabel="Button" className="bg-primary-container h-12 mt-4 rounded-lg items-center justify-center active:scale-95" onPress={collect}>
                  <Text className="text-on-primary-container font-semibold text-label-md">
                    Submit {actionType}
                  </Text>
                </Pressable>
              </View>

              {actionEntries.map((item, idx) => (
                <View key={idx} className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/20 flex-row justify-between">
                  <View>
                    <Text className="font-body-md text-on-surface-variant">{formatIstDate(item.entry_date)}</Text>
                    <Text className="font-label-md text-on-surface font-semibold mt-1">{item.entry_type} {item.notes ? ` - ${item.notes}` : ""}</Text>
                  </View>
                  <Text className={`font-body-md font-semibold ${item.entry_type === "RETURN" || Number(item.credit) > 0 ? "text-primary" : "text-error"}`}>
                    ₹{item.entry_type === "RETURN" || Number(item.credit) > 0 ? item.credit : item.debit}
                  </Text>
                </View>
              ))}
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
