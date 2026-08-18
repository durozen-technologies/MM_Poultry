import { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
  Modal,
  ScrollView,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../api/client";
import { DatePickerField } from "../../components/date-picker-field";
import type { LedgerOut, Retailer } from "../../types/api";
import { formatIstDate, toApiDate, todayIstDate } from "../../utils/ist-date";

export function AdminRetailersScreen({ navigation }: { navigation: any }) {
  const insets = useSafeAreaInsets();
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [selected, setSelected] = useState<LedgerOut | null>(null);
  const [cash, setCash] = useState("0");
  const [upi, setUpi] = useState("0");
  const [paymentDate, setPaymentDate] = useState(todayIstDate());
  const [msg, setMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"All" | "Active" | "Inactive">("All");

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/admin/retailers");
      setRetailers(data.items);
    } catch (e) {
      console.warn("Failed to fetch retailers", e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  async function openLedger(id: string) {
    try {
      const { data } = await api.get(`/admin/retailers/${id}/ledger`);
      setSelected(data);
    } catch (e) {
      console.warn("Failed to open ledger", e);
    }
  }

  async function collect() {
    if (!selected) return;
    try {
      await api.post(`/admin/retailers/${selected.retailer.id}/payments`, {
        cash_amount: cash,
        upi_amount: upi,
        payment_date: toApiDate(paymentDate),
      });
      await openLedger(selected.retailer.id);
      await refresh();
      setMsg("Payment recorded");
      setTimeout(() => setMsg(null), 3000);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  }

  const filteredRetailers = retailers.filter((r) => {
    if (searchQuery && !r.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filter === "Active" && !r.is_active) return false;
    if (filter === "Inactive" && r.is_active) return false;
    return true;
  });

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
            Retailers
          </Text>
        </View>
        <Pressable
          className="w-11 h-11 flex items-center justify-center rounded-full active:bg-surface-variant/50"
          onPress={() => navigation.navigate("AddRetailer")}
        >
          <MaterialIcons name="person-add" size={24} color="#414844" />
        </Pressable>
      </View>

      {/* Search & Filters */}
      <View className="px-4 pt-4 pb-2 z-40 bg-background/95">
        <View className="flex-row items-center gap-2 bg-surface-container-highest rounded-full px-4 py-3 mb-3">
          <MaterialIcons name="search" size={24} color="#717973" />
          <TextInput
            className="flex-1 text-body-lg text-on-surface"
            placeholder="Search retailers..."
            placeholderTextColor="#717973"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <View className="flex-row items-center justify-between">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
            {(["All", "Active", "Inactive"] as const).map((f) => (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                className={`px-4 py-2 rounded-full mr-2 ${
                  filter === f ? "bg-primary-container" : "bg-surface-container-high"
                }`}
              >
                <Text
                  className={`font-label-md text-label-md font-semibold ${
                    filter === f ? "text-on-primary-container" : "text-on-surface-variant"
                  }`}
                >
                  {f}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable className="p-2 ml-2 bg-surface-container-high rounded-full flex-shrink-0">
            <MaterialIcons name="tune" size={20} color="#414844" />
          </Pressable>
        </View>
      </View>

      {/* Retailer List */}
      <FlatList
        data={filteredRetailers}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 100 }}
        ListEmptyComponent={
          <View className="flex-col items-center justify-center p-8 mt-8">
            <View className="w-32 h-32 bg-surface-container-high rounded-full flex items-center justify-center mb-4">
              <MaterialIcons name="storefront" size={48} color="#717973" />
            </View>
            <Text className="font-headline-md text-on-surface mb-2 font-semibold">
              No retailers yet
            </Text>
            <Text className="font-body-md text-on-surface-variant mb-6 text-center">
              Start building your network by adding your first wholesale customer.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const limit = Number(item.credit_limit || 0);
          const bal = Number(item.credit_balance || 0);
          const limitPct = limit > 0 ? Math.min(100, (bal / limit) * 100) : 0;
          return (
            <Pressable
              className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant/30 flex-col gap-3 mb-3 active:bg-surface-container"
              onPress={() => navigation.navigate("RetailerProfile", { retailerId: item.id })}
            >
              <View className="flex-row justify-between items-start">
                <View className="flex-col">
                  <Text className="font-headline-sm text-on-surface font-semibold">
                    {item.name}
                  </Text>
                  <Text className="text-sm text-gray-500 mt-0.5">
                    {item.owner_name || "No contact"}
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <View
                    className={`px-3 py-1 rounded-full ${
                      item.is_active ? "bg-primary-fixed" : "bg-surface-variant"
                    }`}
                  >
                    <Text
                      className={`font-label-md text-[10px] tracking-wide font-semibold ${
                        item.is_active
                          ? "text-on-primary-fixed-variant"
                          : "text-on-surface-variant"
                      }`}
                    >
                      {item.is_active ? "ACTIVE" : "INACTIVE"}
                    </Text>
                  </View>
                  <MaterialIcons name="more-vert" size={20} color="#414844" />
                </View>
              </View>

              <View className="flex-row justify-between">
                <View className="flex-col flex-1">
                  <Text className="font-label-md text-on-surface-variant uppercase text-[10px] font-semibold">
                    Location
                  </Text>
                  <Text className="font-body-md text-on-surface" numberOfLines={1}>
                    {item.address || "N/A"}
                  </Text>
                </View>
                <View className="flex-col flex-1 pl-2">
                  <Text className="font-label-md text-on-surface-variant uppercase text-[10px] font-semibold">
                    Contact
                  </Text>
                  <Text className="text-gray-600 ml-1">
                    {item.phone || "N/A"}
                  </Text>
                </View>
              </View>

              <View className="bg-surface-container rounded-lg p-3 mt-2">
                <View className="flex-row justify-between items-end">
                  <View className="flex-col">
                    <Text className="font-label-md text-on-surface-variant uppercase text-[10px] font-semibold">
                      Outstanding
                    </Text>
                    <Text
                      className={`font-headline-md-mobile font-semibold ${
                        bal > 0 ? "text-error" : "text-primary"
                      }`}
                    >
                      ₹{bal}
                    </Text>
                  </View>
                  <View className="flex-col items-end">
                    <Text className="font-label-md text-on-surface-variant uppercase text-[10px] font-semibold">
                      Credit Limit
                    </Text>
                    <Text className="font-body-md text-on-surface font-semibold">
                      ₹{limit}
                    </Text>
                  </View>
                </View>
                {limit > 0 && (
                  <View className="h-1.5 w-full bg-surface-variant rounded-full mt-2 overflow-hidden">
                    <View
                      className={`h-full rounded-full ${
                        limitPct > 90 ? "bg-error" : "bg-primary"
                      }`}
                      style={{ width: `${limitPct}%` }}
                    />
                  </View>
                )}
              </View>
            </Pressable>
          );
        }}
      />

      {/* FAB */}
      <Pressable
        className="absolute right-4 w-14 h-14 bg-primary rounded-2xl shadow-lg flex items-center justify-center active:bg-primary/90 z-50"
        style={{ bottom: 80 + Math.max(insets.bottom, 12) }}
        onPress={() => navigation.navigate("AddRetailer")}
      >
        <MaterialIcons name="add" size={28} color="#ffffff" />
      </Pressable>

      {/* Ledger Modal for backwards compatibility until retailer_profile is built */}
      <Modal visible={!!selected} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-surface rounded-t-3xl p-6 h-[80%]">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold text-on-surface">
                {selected?.retailer.name} Ledger
              </Text>
              <Pressable onPress={() => setSelected(null)}>
                <MaterialIcons name="close" size={24} color="#414844" />
              </Pressable>
            </View>
            
            {msg && <Text className="text-brand-clay mb-2 font-semibold">{msg}</Text>}

            <Text className="font-bold mb-2 text-error">
              Outstanding: ₹{selected?.credit_balance}
            </Text>

            <View className="flex-1 mb-4 border border-outline-variant/30 rounded-lg p-2 bg-surface-container-lowest">
              <FlatList
                data={selected?.entries || []}
                keyExtractor={(_, idx) => String(idx)}
                renderItem={({ item }) => (
                  <View className="flex-row justify-between border-b border-surface-variant py-2">
                    <View>
                      <Text className="text-xs text-on-surface-variant">{formatIstDate(item.entry_date)}</Text>
                      <Text className="font-semibold text-on-surface">{item.entry_type}</Text>
                    </View>
                    <View className="items-end">
                      {Number(item.debit) > 0 && <Text className="text-error">Dr ₹{item.debit}</Text>}
                      {Number(item.credit) > 0 && <Text className="text-primary">Cr ₹{item.credit}</Text>}
                    </View>
                  </View>
                )}
              />
            </View>

            <View className="bg-surface-container rounded-xl p-4 gap-2 pb-safe">
              <Text className="font-semibold">Record Payment</Text>
              <DatePickerField label="Payment Date" value={paymentDate} onChange={setPaymentDate} />
              <View className="flex-row gap-2 mt-2">
                <TextInput
                  className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2"
                  value={cash}
                  onChangeText={setCash}
                  placeholder="Cash"
                  keyboardType="decimal-pad"
                />
                <TextInput
                  className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2"
                  value={upi}
                  onChangeText={setUpi}
                  placeholder="UPI"
                  keyboardType="decimal-pad"
                />
              </View>
              <Pressable
                className="bg-primary-container py-3 mt-2 rounded-lg items-center"
                onPress={collect}
              >
                <Text className="text-on-primary-container font-semibold">Pay</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bottom Navigation Bar */}
      <View className="absolute bottom-0 inset-x-0 bg-surface/90 border-t border-outline-variant/20 flex-row justify-around items-center px-2 z-40 px-2 pt-2" style={{ paddingBottom: Math.max(insets.bottom, 12), height: 60 + Math.max(insets.bottom, 12) }}>
        <Pressable 
          className="flex-col items-center justify-center gap-1 w-20"
          onPress={() => navigation.navigate("AdminHome")}
        >
          <MaterialIcons name="grid-view" size={24} color="#414844" />
          <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
            Dashboard
          </Text>
        </Pressable>
        <Pressable className="flex-col items-center justify-center gap-1 w-20">
          <View className="bg-primary-container/30 px-4 py-1 rounded-full mb-1">
            <MaterialIcons name="group" size={24} color="#012d1d" />
          </View>
          <Text className="font-label-md text-label-md text-primary font-semibold -mt-1">
            Retailers
          </Text>
        </Pressable>
        <Pressable 
          className="flex-col items-center justify-center gap-1 w-20"
          onPress={() => navigation.navigate("Farms")}
        >
          <MaterialIcons name="agriculture" size={24} color="#414844" />
          <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
            Farms
          </Text>
        </Pressable>
        <Pressable 
          className="flex-col items-center justify-center gap-1 w-20"
          onPress={() => navigation.navigate("Orders")}
        >
          <MaterialIcons name="shopping-cart" size={24} color="#414844" />
          <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
            Orders
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
