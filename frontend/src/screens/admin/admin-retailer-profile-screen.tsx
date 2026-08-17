import { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  Text,
  View,
  ScrollView,
  TextInput,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../api/client";
import type { LedgerOut } from "../../types/api";
import { formatIstDate, toApiDate, todayIstDate } from "../../utils/ist-date";
import { DatePickerField } from "../../components/date-picker-field";

export function AdminRetailerProfileScreen({ route, navigation }: { route: any; navigation: any }) {
  const { retailerId } = route.params;
  const [ledger, setLedger] = useState<LedgerOut | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Payment state
  const [cash, setCash] = useState("");
  const [upi, setUpi] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayIstDate());
  const [msg, setMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("LEDGER");

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get(`/admin/retailers/${retailerId}/ledger`);
      setLedger(data);
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
    if (!cash && !upi) return;
    try {
      await api.post(`/admin/retailers/${retailerId}/payments`, {
        cash_amount: cash || "0",
        upi_amount: upi || "0",
        payment_date: toApiDate(paymentDate),
      });
      setCash("");
      setUpi("");
      setMsg("Payment recorded");
      setTimeout(() => setMsg(null), 3000);
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  }

  if (loading || !ledger) {
    return (
      <SafeAreaView className="flex-1 bg-background justify-center items-center">
        <MaterialIcons name="loop" size={32} color="#012d1d" />
      </SafeAreaView>
    );
  }

  const { retailer, entries } = ledger;
  const bal = Number(retailer.credit_balance || 0);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      {/* Header */}
      <View className="h-16 px-4 flex-row items-center justify-between bg-surface/80">
        <View className="flex-row items-center gap-2">
          <Pressable
            className="w-11 h-11 -ml-2 flex items-center justify-center rounded-full active:bg-surface-variant/50"
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="arrow-back" size={24} color="#181c20" />
          </Pressable>
          <Text className="font-headline-sm text-headline-sm text-primary font-semibold">
            Retailer Profile
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1 w-full" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Retailer Identity */}
        <View className="px-4 py-6 bg-surface flex-col gap-2">
          <View className="flex-row justify-between items-start">
            <View className="flex-col gap-1">
              <View className="flex-row items-center gap-2">
                <Text className="font-headline-md text-headline-md text-on-surface font-semibold">
                  {retailer.name}
                </Text>
                <View className="bg-tertiary-fixed px-2 py-1 rounded-full">
                  <Text className="font-label-md text-label-md text-on-tertiary-fixed-variant font-semibold text-[10px]">
                    {retailer.is_active ? "ACTIVE" : "INACTIVE"}
                  </Text>
                </View>
              </View>
              <Text className="text-gray-500 mt-1">
                {retailer.owner_name || "Owner"}
              </Text>
            </View>
          </View>
          <View className="flex-row items-center mt-4">
            <View className="flex-row items-center mr-6">
              <MaterialIcons name="phone" size={16} color="#64748b" />
              <Text className="text-gray-600 ml-1">
                {retailer.phone || "N/A"}
              </Text>
              </View>
            </View>
            <Pressable className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center active:bg-surface-container-high">
              <MaterialIcons name="edit" size={20} color="#181c20" />
            </Pressable>
        </View>

        {/* Financial Summary */}
        <View className="pl-4 py-3 bg-background">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-3 pr-4">
            <View className="w-40 bg-error-container p-3 rounded-2xl shadow-sm flex-col justify-between min-h-[96px] mr-3">
              <Text className="font-label-md text-label-md text-on-error-container uppercase opacity-90 font-semibold text-[10px]">
                Outstanding
              </Text>
              <Text className="font-headline-sm text-headline-sm text-on-error-container font-semibold mt-1">
                ₹{bal}
              </Text>
            </View>
            <View className="w-40 bg-surface-container-lowest p-3 rounded-2xl shadow-sm flex-col justify-between min-h-[96px] mr-3">
              <Text className="font-label-md text-label-md text-secondary uppercase font-semibold text-[10px]">
                Credit Limit
              </Text>
              <Text className="font-headline-sm text-headline-sm text-on-surface font-semibold mt-1">
                ₹{retailer.credit_limit || 0}
              </Text>
            </View>
          </ScrollView>
        </View>

        {/* Activity Tabs */}
        <View className="bg-surface sticky top-0 z-40 border-b border-surface-container-high mt-4">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4">
            {["OVERVIEW", "ORDERS", "BILLS", "PAYMENTS", "LEDGER"].map((tab) => (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                className={`py-3 px-4 mr-2 ${activeTab === tab ? "border-b-2 border-primary" : ""}`}
              >
                <Text
                  className={`font-label-md text-label-md font-semibold ${
                    activeTab === tab ? "text-primary" : "text-secondary"
                  }`}
                >
                  {tab}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Tab Content */}
        <View className="p-4 bg-background flex-col gap-4">
          {activeTab === "LEDGER" && (
            <View className="flex-col gap-4">
              {msg && <Text className="text-brand-clay font-semibold">{msg}</Text>}
              
              <View className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm">
                <Text className="font-headline-sm font-semibold mb-4">Record Payment</Text>
                <DatePickerField label="Payment Date" value={paymentDate} onChange={setPaymentDate} />
                <View className="flex-row gap-2 mt-4">
                  <TextInput
                    className="flex-1 bg-surface h-12 border border-outline-variant rounded-lg px-3 text-body-md"
                    value={cash}
                    onChangeText={setCash}
                    placeholder="Cash (₹)"
                    keyboardType="decimal-pad"
                  />
                  <TextInput
                    className="flex-1 bg-surface h-12 border border-outline-variant rounded-lg px-3 text-body-md"
                    value={upi}
                    onChangeText={setUpi}
                    placeholder="UPI (₹)"
                    keyboardType="decimal-pad"
                  />
                </View>
                <Pressable
                  className="bg-primary-container h-12 mt-4 rounded-lg items-center justify-center active:scale-95"
                  onPress={collect}
                >
                  <Text className="text-on-primary-container font-semibold text-label-md">Submit Payment</Text>
                </Pressable>
              </View>

              <View className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm mt-2">
                <Text className="font-headline-sm font-semibold mb-4">Transactions</Text>
                {entries.map((item, idx) => (
                  <View key={idx} className="flex-row justify-between border-b border-surface-variant py-3">
                    <View className="flex-col">
                      <Text className="font-body-md text-on-surface-variant">{formatIstDate(item.entry_date)}</Text>
                      <Text className="font-label-md text-on-surface font-semibold mt-1">{item.entry_type}</Text>
                    </View>
                    <View className="flex-col items-end">
                      {Number(item.debit) > 0 && <Text className="font-body-md text-error font-semibold">Dr ₹{item.debit}</Text>}
                      {Number(item.credit) > 0 && <Text className="font-body-md text-primary font-semibold">Cr ₹{item.credit}</Text>}
                    </View>
                  </View>
                ))}
                {entries.length === 0 && (
                  <Text className="text-on-surface-variant text-center py-4">No ledger entries found.</Text>
                )}
              </View>
            </View>
          )}

          {activeTab !== "LEDGER" && (
            <View className="py-8 items-center justify-center">
              <MaterialIcons name="construction" size={32} color="#c5c7c8" />
              <Text className="text-on-surface-variant font-body-md mt-4">This tab is under construction.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
