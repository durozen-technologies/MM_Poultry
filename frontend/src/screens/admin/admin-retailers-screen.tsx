import React, { useCallback, useState, useMemo } from "react";
import {
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
  Modal,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, getApiErrorMessage } from "../../api/client";
import { useAdminRetailers } from "../../hooks/use-queries";
import { DatePickerField } from "../../components/date-picker-field";
import type { LedgerOut } from "../../types/api";
import { formatIstDate, toApiDate, todayIstDate } from "../../utils/ist-date";

import { AdminScreenContainer } from "../../components/admin/admin-screen-container";
import { AdminHeader } from "../../components/admin/admin-header";

export function AdminRetailersScreen({ navigation }: { navigation: any }) {
  const insets = useSafeAreaInsets();
  const { data: retailers = [], isLoading, refetch, isRefetching } = useAdminRetailers();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const [selected, setSelected] = useState<LedgerOut | null>(null);
  const [cash, setCash] = useState("0");
  const [upi, setUpi] = useState("0");
  const [paymentDate, setPaymentDate] = useState(todayIstDate());
  const [msg, setMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"All" | "Active" | "Inactive">("All");

  const openLedger = useCallback(async (id: string) => {
    try {
      const { data } = await api.get(`/admin/retailers/${id}/ledger`);
      setSelected(data);
    } catch (e) {
      console.warn("Failed to open ledger", e);
    }
  }, []);

  const collect = useCallback(async () => {
    if (!selected) return;
    try {
      await api.post(`/admin/retailers/${selected.retailer.id}/payments`, {
        cash_amount: cash,
        upi_amount: upi,
        payment_date: toApiDate(paymentDate),
      });
      await openLedger(selected.retailer.id);
      await refetch();
      setMsg("Payment recorded successfully");
      setTimeout(() => setMsg(null), 3000);
      setCash("0");
      setUpi("0");
    } catch (e) {
      setMsg(getApiErrorMessage(e));
    }
  }, [selected, cash, upi, paymentDate, openLedger, refetch]);

  const filteredRetailers = useMemo(() => retailers.filter((r) => {
    if (searchQuery && !r.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filter === "Active" && !r.is_active) return false;
    if (filter === "Inactive" && r.is_active) return false;
    return true;
  }), [retailers, searchQuery, filter]);

  const activeCount = useMemo(() => retailers.filter(r => r.is_active).length, [retailers]);
  const totalOutstanding = useMemo(() => retailers.reduce((sum, r) => sum + Number(r.credit_balance || 0), 0), [retailers]);

  return (
    <AdminScreenContainer
      noScroll
      header={
        <AdminHeader 
          title="Retailers" 
          subtitle="Manage your wholesale network"
          onBack={() => navigation.goBack()} 
          rightContent={
            <View className="flex-row gap-2">
              <Pressable
                accessibilityRole="button"
                className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container-highest active:bg-surface-variant"
                onPress={() => refetch()}
              >
                {isRefetching ? (
                  <ActivityIndicator size="small" className="text-primary" />
                ) : (
                  <MaterialIcons name="refresh" size={22} className="text-on-surface" />
                )}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                className="h-10 px-4 rounded-full flex-row items-center justify-center bg-primary active:bg-primary/90 shadow-sm shadow-primary/30"
                onPress={() => navigation.navigate("AddRetailer")}
              >
                <MaterialIcons name="person-add" size={20} color="white" className="mr-1.5" />
                <Text className="text-label-md text-white font-bold">Add</Text>
              </Pressable>
            </View>
          }
        />
      }
    >
      <FlatList
        data={filteredRetailers}
        keyExtractor={(item) => String(item.id)}
        refreshing={refreshing}
        onRefresh={onRefresh}
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        ListHeaderComponent={
          <>
            <View className="flex-col gap-4 mb-6 pt-2">
              {/* KPIs */}
              <View className="flex-row gap-4 mb-2">
                <View className="w-[48%] bg-primary rounded-2xl p-4 shadow-sm relative overflow-hidden">
                  <View className="absolute -right-4 -top-4 w-16 h-16 bg-white/10 rounded-full" />
                  <Text className="font-label-md text-primary-fixed font-bold mb-1 uppercase tracking-wider">Active Retailers</Text>
                  <Text className="font-display-md text-white font-bold">{activeCount}</Text>
                </View>
                <View className="w-[48%] bg-error-container/80 rounded-2xl p-4 shadow-sm border border-error/20 relative overflow-hidden">
                  <View className="absolute right-3 top-3 w-8 h-8 bg-error/10 rounded-full items-center justify-center">
                    <MaterialIcons name="account-balance-wallet" size={16} className="text-error" />
                  </View>
                  <Text className="font-label-md text-error font-bold mb-1 uppercase tracking-wider">Total Due</Text>
                  <Text className="font-headline-sm text-on-error-container font-bold">₹{totalOutstanding.toLocaleString("en-IN")}</Text>
                </View>
              </View>

              {/* Search */}
              <View className="relative flex-row items-center">
                <View className="absolute left-4 z-10">
                  <MaterialIcons name="search" size={20} className="text-on-surface-variant" />
                </View>
                <TextInput
                  placeholderTextColor="#9ca3af"
                  className="flex-1 h-13 pl-12 pr-4 bg-surface-container-lowest border border-outline-variant/50 rounded-xl text-body-lg text-on-surface focus:border-primary shadow-sm"
                  placeholder="Search retailers..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>

              {/* Filters */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row overflow-visible">
                {(["All", "Active", "Inactive"] as const).map((f) => (
                  <Pressable
                    key={f}
                    onPress={() => setFilter(f)}
                    className={`h-10 px-5 rounded-full flex items-center justify-center border mr-3 transition-colors ${
                      filter === f 
                        ? "bg-primary border-primary" 
                        : "bg-surface-container-lowest border-outline-variant/30"
                    }`}
                  >
                    <Text
                      className={`font-label-md font-bold ${
                        filter === f ? "text-white" : "text-on-surface-variant"
                      }`}
                    >
                      {f}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </>
        }
        ListEmptyComponent={
          isLoading ? (
            <View className="flex-col items-center justify-center py-12">
              <ActivityIndicator size="large" className="text-primary mb-4" />
              <Text className="text-on-surface-variant font-medium">Loading retailers...</Text>
            </View>
          ) : (
            <View className="flex-col items-center justify-center py-12 px-4 border border-dashed border-outline-variant/50 rounded-3xl mt-4">
              <View className="w-20 h-20 bg-surface-variant/30 rounded-full flex items-center justify-center mb-4">
                <MaterialIcons name="storefront" size={40} className="text-on-surface-variant/70" />
              </View>
              <Text className="font-title-lg text-on-surface mb-2 font-bold text-center">
                No retailers yet
              </Text>
              <Text className="font-body-md text-on-surface-variant mb-6 text-center max-w-[250px]">
                {searchQuery || filter !== "All" 
                  ? "No retailers match your search filters."
                  : "Start building your network by adding your first wholesale customer."}
              </Text>
              {!searchQuery && filter === "All" && (
                <Pressable
                  className="bg-primary px-6 py-3 rounded-full flex-row items-center"
                  onPress={() => navigation.navigate("AddRetailer")}
                >
                  <MaterialIcons name="add" size={20} color="white" className="mr-2" />
                  <Text className="text-white font-bold">Add Retailer</Text>
                </Pressable>
              )}
            </View>
          )
        }
        ItemSeparatorComponent={() => <View className="h-4" />}
        renderItem={({ item }) => (
          <RetailerListItem 
            item={item} 
            onPress={() => navigation.navigate("RetailerProfile", { retailerId: item.id })}
            onPay={() => openLedger(item.id)}
          />
        )}
      />

      {/* Ledger Modal for backwards compatibility until retailer_profile is built */}
      <Modal visible={!!selected} animationType="slide" transparent>
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-surface rounded-t-3xl h-[85%] overflow-hidden shadow-lg border-t border-outline-variant/20">
            <View className="flex-row justify-between items-center p-6 border-b border-outline-variant/20 bg-surface-container-lowest">
              <View>
                <Text className="font-title-lg font-bold text-on-surface mb-1">
                  {selected?.retailer.name}
                </Text>
                <Text className="text-on-surface-variant font-medium">Account Ledger</Text>
              </View>
              <Pressable
                className="w-10 h-10 bg-surface-variant/30 rounded-full items-center justify-center active:bg-surface-variant/50"
                onPress={() => setSelected(null)}
              >
                <MaterialIcons name="close" size={20} className="text-on-surface" />
              </Pressable>
            </View>
            
            <View className="flex-1 p-6">
              {msg && (
                <View className={`mb-4 p-3 rounded-xl flex-row items-center ${msg.includes('success') ? 'bg-primary-container/80' : 'bg-error-container/80'}`}>
                  <MaterialIcons name={msg.includes('success') ? "check-circle" : "error-outline"} size={20} className={`${msg.includes('success') ? "text-on-primary-container" : "text-error"} mr-2`} />
                  <Text className={`font-label-md font-bold ${msg.includes('success') ? "text-on-primary-container" : "text-error"}`}>
                    {msg}
                  </Text>
                </View>
              )}

              <View className="bg-error-container/20 border border-error/20 rounded-2xl p-4 mb-6">
                <Text className="text-error font-bold uppercase tracking-wider text-label-sm mb-1">Total Outstanding</Text>
                <Text className="font-display-sm text-error font-black">
                  ₹{Number(selected?.credit_balance || 0).toLocaleString("en-IN")}
                </Text>
              </View>

              <Text className="font-title-md font-bold text-on-surface mb-3">Recent Transactions</Text>
              <View className="flex-1 mb-6 border border-outline-variant/30 rounded-2xl bg-surface-container-lowest overflow-hidden">
                <FlatList
                  data={selected?.entries || []}
                  keyExtractor={(_, idx) => String(idx)}
                  contentContainerStyle={{ padding: 12 }}
                  ItemSeparatorComponent={() => <View className="h-[1px] bg-outline-variant/20 my-2" />}
                  ListEmptyComponent={
                    <View className="py-8 items-center">
                      <Text className="text-on-surface-variant font-medium">No recent transactions.</Text>
                    </View>
                  }
                  renderItem={({ item }) => (
                    <View className="flex-row justify-between items-center py-1">
                      <View>
                        <Text className="font-label-md text-on-surface-variant mb-1">{formatIstDate(item.entry_date)}</Text>
                        <Text className="font-title-sm font-bold text-on-surface">{item.entry_type}</Text>
                      </View>
                      <View className="items-end">
                        {Number(item.debit) > 0 && <Text className="font-title-md font-black text-error">Dr ₹{Number(item.debit).toLocaleString("en-IN")}</Text>}
                        {Number(item.credit) > 0 && <Text className="font-title-md font-black text-primary">Cr ₹{Number(item.credit).toLocaleString("en-IN")}</Text>}
                      </View>
                    </View>
                  )}
                />
              </View>

              <View className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-5 gap-4">
                <View className="flex-row items-center gap-2 mb-1">
                  <MaterialIcons name="payments" size={20} className="text-primary" />
                  <Text className="font-title-md font-bold text-on-surface">Record Payment</Text>
                </View>
                
                <DatePickerField 
                  label="Payment Date" 
                  value={paymentDate} 
                  onChange={setPaymentDate} 
                  inputStyle="h-12 bg-surface border border-outline-variant/50 rounded-xl px-4"
                />
                
                <View className="flex-row gap-3 mt-1">
                  <View className="flex-1">
                    <Text className="font-label-md text-on-surface-variant font-bold mb-1.5 ml-1">Cash (₹)</Text>
                    <TextInput
                      className="h-13 bg-surface border border-outline-variant/50 rounded-xl px-4 text-body-lg font-bold text-on-surface focus:border-primary"
                      value={cash}
                      onChangeText={setCash}
                      placeholder="0.00"
                      placeholderTextColor="#9ca3af"
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="font-label-md text-on-surface-variant font-bold mb-1.5 ml-1">UPI (₹)</Text>
                    <TextInput
                      className="h-13 bg-surface border border-outline-variant/50 rounded-xl px-4 text-body-lg font-bold text-on-surface focus:border-primary"
                      value={upi}
                      onChangeText={setUpi}
                      placeholder="0.00"
                      placeholderTextColor="#9ca3af"
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
                
                <Pressable
                  className="bg-primary h-14 mt-2 rounded-xl flex-row items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-sm shadow-primary/30"
                  onPress={collect}
                >
                  <Text className="text-white font-bold text-label-lg">Confirm Payment</Text>
                  <MaterialIcons name="check-circle" size={20} color="white" />
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </AdminScreenContainer>
  );
}

const RetailerListItem = React.memo(({ 
  item, 
  onPress,
  onPay
}: { 
  item: any; 
  onPress: () => void;
  onPay: () => void;
}) => {
  const bal = useMemo(() => Number(item.credit_balance || 0), [item.credit_balance]);
  
  return (
    <Pressable
      className="bg-surface-container-lowest rounded-3xl p-5 shadow-sm border border-outline-variant/20 active:scale-[0.98] transition-transform relative overflow-hidden"
      onPress={onPress}
    >
      {/* Left border indicator */}
      <View className={`absolute top-0 left-0 w-1.5 h-full ${item.is_active ? 'bg-primary' : 'bg-surface-variant'}`} />

      <View className="flex-row justify-between items-start mb-4 ml-2">
        <View className="flex-col flex-1 pr-4">
          <Text className="font-title-lg text-on-surface font-bold tracking-tight mb-1" numberOfLines={1}>
            {item.name}
          </Text>
          <Text className="font-body-md text-on-surface-variant font-medium">
            {item.owner_name || "No contact"}
          </Text>
        </View>
        <View
          className={`px-3 py-1 rounded-full border ${
            item.is_active ? "bg-primary/10 border-primary/20" : "bg-surface-variant/30 border-outline-variant/20"
          }`}
        >
          <Text
            className={`font-label-sm uppercase tracking-widest font-bold ${
              item.is_active ? "text-primary" : "text-on-surface-variant"
            }`}
          >
            {item.is_active ? "Active" : "Inactive"}
          </Text>
        </View>
      </View>

      <View className="flex-row justify-between ml-2 mb-4">
        <View className="flex-col flex-1 pr-2">
          <View className="flex-row items-center mb-1">
            <MaterialIcons name="location-on" size={14} className="text-on-surface-variant mr-1" />
            <Text className="font-label-sm text-on-surface-variant uppercase font-bold tracking-wider">
              Location
            </Text>
          </View>
          <Text className="font-body-md text-on-surface font-medium" numberOfLines={1}>
            {item.address || "N/A"}
          </Text>
        </View>
        <View className="flex-col flex-1 pl-2 border-l border-outline-variant/30">
          <View className="flex-row items-center mb-1">
            <MaterialIcons name="call" size={14} className="text-on-surface-variant mr-1" />
            <Text className="font-label-sm text-on-surface-variant uppercase font-bold tracking-wider">
              Contact
            </Text>
          </View>
          <Text className="font-body-md text-on-surface font-medium">
            {item.phone || "N/A"}
          </Text>
        </View>
      </View>

      <View className="bg-surface-container-highest/30 rounded-2xl p-4 ml-2 border border-outline-variant/10 flex-row justify-between items-center">
        <View className="flex-col">
          <Text className="font-label-sm text-on-surface-variant uppercase font-bold tracking-wider mb-1">
            Outstanding Balance
          </Text>
          <Text
            className={`font-headline-sm font-black ${
              bal > 0 ? "text-error" : "text-primary"
            }`}
          >
            ₹{bal.toLocaleString("en-IN")}
          </Text>
        </View>
        {bal > 0 && (
          <Pressable
            className="bg-primary/10 px-4 py-2 rounded-full border border-primary/20 active:bg-primary/20"
            onPress={onPay}
          >
            <Text className="text-primary font-bold">Pay Now</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
});
