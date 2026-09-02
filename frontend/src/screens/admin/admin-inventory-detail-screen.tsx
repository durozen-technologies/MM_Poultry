import { View, Text, Pressable, FlatList, ActivityIndicator, TextInput, Modal, Alert, ScrollView } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import React, { useState, useMemo, useCallback } from "react";
import { useAdminInventoryItemLoads } from "../../hooks/use-queries";
import { formatIstDate, toApiDate, parseIstDate } from "../../utils/ist-date";
import { DatePickerField } from "../../components/date-picker-field";
import { deleteFarmLoad } from "../../api/farms";

import { AdminScreenContainer } from "../../components/admin/admin-screen-container";
import { AdminHeader } from "../../components/admin/admin-header";

export function AdminInventoryDetailScreen({ route, navigation }: { route: any, navigation: any }) {
  const { itemId, itemName } = route.params;
  const { data, isLoading, refetch } = useAdminInventoryItemLoads(itemId);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLoad, setSelectedLoad] = useState<any>(null);
  const [searchDate, setSearchDate] = useState<Date | null>(null);
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "date" | "range">("all");
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);

  const loads = data?.loads || [];

  const filteredLoads = useMemo(() => loads.filter((load) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || 
      (load.farm_name?.toLowerCase().includes(q)) ||
      (load.vehicle_number?.toLowerCase().includes(q)) ||
      (load.contact_phone?.toLowerCase().includes(q));
    
    let matchesDate = true;
    if (filterType === "date" && searchDate) {
      matchesDate = load.load_date === toApiDate(searchDate);
    } else if (filterType === "range" && fromDate && toDate) {
      const loadDateObj = parseIstDate(load.load_date);
      if (loadDateObj) {
        // Normalize time for safe comparison
        loadDateObj.setHours(12, 0, 0, 0);
        fromDate.setHours(12, 0, 0, 0);
        toDate.setHours(12, 0, 0, 0);
        const endDate = toDate ? new Date(toDate.getTime() + 86400000 - 1) : null;
        matchesDate = loadDateObj.getTime() >= fromDate.getTime() && loadDateObj.getTime() <= (endDate?.getTime() || 0);
      } else {
        matchesDate = false;
      }
    }

    return matchesSearch && matchesDate;
  }), [loads, searchQuery, filterType, searchDate, fromDate, toDate]);

  // Calculate totals
  const totalAvailable = useMemo(() => filteredLoads.reduce((sum, load) => sum + Number(load.available_weight_kg || 0), 0), [filteredLoads]);
  const totalOriginal = useMemo(() => filteredLoads.reduce((sum, load) => sum + Number(load.loaded_weight_kg || 0), 0), [filteredLoads]);

  const handleDelete = useCallback(() => {
    if (!selectedLoad) return;
    Alert.alert(
      "Delete Purchase Order", 
      "Are you sure you want to delete this purchase order? This action cannot be undone and will affect your inventory balance.", 
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: async () => {
            try {
              await deleteFarmLoad(selectedLoad.id);
              setSelectedLoad(null);
              refetch();
            } catch(e) {
              console.error("Failed to delete farm load:", e);
            }
          }
        }
      ]
    );
  }, [selectedLoad, refetch]);

  return (
    <AdminScreenContainer
      noScroll
      header={
        <AdminHeader 
          title={`${itemName} Inventory`} 
          subtitle="View active purchase orders and available stock"
          onBack={() => navigation.goBack()} 
          rightContent={
            <Pressable
              accessibilityRole="button"
              className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container-highest active:bg-surface-variant"
              onPress={() => refetch()}
            >
              {isLoading ? (
                <ActivityIndicator size="small" className="text-primary" />
              ) : (
                <MaterialIcons name="refresh" size={22} className="text-on-surface" />
              )}
            </Pressable>
          }
        />
      }
    >
      <FlatList
        data={filteredLoads}
        keyExtractor={(item) => item.id}
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        ListHeaderComponent={
          <>
            <View className="flex-col gap-4 mb-6 pt-2">
              {/* KPIs */}
              {!isLoading && loads.length > 0 && (
                <View className="flex-row gap-4 mb-2">
                  <View className="flex-1 bg-primary rounded-2xl p-4 shadow-sm relative overflow-hidden">
                    <View className="absolute -right-4 -top-4 w-16 h-16 bg-white/10 rounded-full" />
                    <Text className="font-label-md text-primary-fixed font-bold mb-1 uppercase tracking-wider">Available Stock</Text>
                    <View className="flex-row items-end gap-1">
                      <Text className="font-display-sm text-white font-black">{totalAvailable.toLocaleString("en-IN", { maximumFractionDigits: 1 })}</Text>
                      <Text className="font-title-sm text-primary-fixed font-bold mb-1">KG</Text>
                    </View>
                  </View>
                  <View className="flex-1 bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant/30 relative overflow-hidden">
                    <View className="absolute right-3 top-3 w-8 h-8 bg-primary/10 rounded-full items-center justify-center">
                      <MaterialIcons name="inventory" size={16} className="text-primary" />
                    </View>
                    <Text className="font-label-md text-on-surface-variant font-bold mb-1 uppercase tracking-wider">Original Load</Text>
                    <View className="flex-row items-end gap-1">
                      <Text className="font-title-lg text-on-surface font-black">{totalOriginal.toLocaleString("en-IN", { maximumFractionDigits: 1 })}</Text>
                      <Text className="font-label-md text-on-surface-variant font-bold mb-0.5">KG</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Search & Filter */}
              <View className="flex-row items-center gap-3">
                <View className="relative flex-1">
                  <View className="absolute left-4 z-10 top-0 bottom-0 justify-center">
                    <MaterialIcons name="search" size={20} className="text-on-surface-variant" />
                  </View>
                  <TextInput
                    placeholderTextColor="#9ca3af"
                    className="h-13 pl-12 pr-4 bg-surface-container-lowest border border-outline-variant/50 rounded-xl text-body-lg text-on-surface focus:border-primary shadow-sm"
                    placeholder="Search farms, vehicles..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                  {searchQuery.length > 0 && (
                    <Pressable 
                      className="absolute right-4 top-0 bottom-0 justify-center z-10"
                      onPress={() => setSearchQuery("")}
                    >
                      <MaterialIcons name="close" size={18} className="text-on-surface-variant" />
                    </Pressable>
                  )}
                </View>
                <Pressable
                  className={`w-13 h-13 rounded-xl flex items-center justify-center shadow-sm border active:scale-[0.95] transition-transform ${
                    filterType !== "all" 
                      ? "bg-primary-container border-primary/30" 
                      : "bg-surface-container-lowest border-outline-variant/50"
                  }`}
                  onPress={() => setIsFilterModalVisible(true)}
                >
                  <MaterialIcons 
                    name="filter-list" 
                    size={22} 
                    className={filterType !== "all" ? "text-on-primary-container" : "text-on-surface-variant"} 
                  />
                  {filterType !== "all" && (
                    <View className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />
                  )}
                </Pressable>
              </View>
              
              {/* Active Filter Indicators */}
              {filterType !== "all" && (
                <View className="flex-row flex-wrap gap-2 mt-1">
                  <View className="bg-primary-container/50 px-3 py-1.5 rounded-full flex-row items-center border border-primary/20">
                    <MaterialIcons name="event" size={14} className="text-primary mr-1.5" />
                    <Text className="font-label-sm text-primary font-bold">
                      {filterType === "date" 
                        ? `Date: ${searchDate ? formatIstDate(toApiDate(searchDate)) : "Not set"}` 
                        : `Range: ${fromDate ? formatIstDate(toApiDate(fromDate)) : "?"} - ${toDate ? formatIstDate(toApiDate(toDate)) : "?"}`
                      }
                    </Text>
                    <Pressable 
                      className="ml-2 bg-primary/10 rounded-full p-0.5" 
                      onPress={() => { setFilterType("all"); setSearchDate(null); setFromDate(null); setToDate(null); }}
                    >
                      <MaterialIcons name="close" size={12} className="text-primary" />
                    </Pressable>
                  </View>
                </View>
              )}

              <View className="flex-row items-center justify-between ml-1 mb-1 mt-2">
                <Text className="font-title-lg text-on-surface font-bold">Active Stock</Text>
                {filteredLoads.length > 0 && (
                  <View className="bg-surface-container-highest px-3 py-1 rounded-full">
                    <Text className="font-label-sm text-on-surface-variant font-bold">{filteredLoads.length} Loads</Text>
                  </View>
                )}
              </View>
            </View>
          </>
        }
        ListEmptyComponent={
          isLoading ? (
            <View className="py-12 items-center">
              <ActivityIndicator size="large" className="text-primary mb-4" />
              <Text className="text-on-surface-variant font-medium">Loading inventory data...</Text>
            </View>
          ) : (
            <View className="bg-surface-container-lowest rounded-3xl p-8 border border-dashed border-outline-variant/50 items-center justify-center mb-6 mt-2">
              <View className="w-16 h-16 bg-surface-variant/30 rounded-full items-center justify-center mb-4">
                <MaterialIcons name="inventory-2" size={32} className="text-on-surface-variant/70" />
              </View>
              <Text className="font-title-lg text-on-surface font-bold mb-1 text-center">
                {searchQuery || filterType !== "all" ? "No matching stock" : "No Active Stock"}
              </Text>
              <Text className="font-body-md text-on-surface-variant text-center max-w-[250px]">
                {searchQuery || filterType !== "all" 
                  ? "Try adjusting your search or date filters." 
                  : "There are no open or in-transit farm loads for this item."}
              </Text>
              
              {!searchQuery && filterType === "all" && (
                <Pressable
                  className="mt-6 bg-primary px-6 py-3 rounded-full flex-row items-center"
                  onPress={() => navigation.navigate("FarmPurchase")}
                >
                  <MaterialIcons name="add" size={20} color="white" className="mr-2" />
                  <Text className="text-white font-bold">Record Farm Load</Text>
                </Pressable>
              )}
            </View>
          )
        }
        ItemSeparatorComponent={() => <View className="h-4" />}
        renderItem={({ item }) => (
          <LoadListItem item={item} onPress={() => setSelectedLoad(item)} />
        )}
      />

      <Modal visible={isFilterModalVisible} transparent animationType="fade" onRequestClose={() => setIsFilterModalVisible(false)}>
        <View className="flex-1 justify-end bg-black/60">
          <Pressable className="flex-1" onPress={() => setIsFilterModalVisible(false)} />
          <View className="bg-surface rounded-t-3xl p-6 pb-safe border-t border-outline-variant/20 shadow-lg">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-title-lg font-bold text-on-surface">Filter by Date</Text>
              <Pressable onPress={() => setIsFilterModalVisible(false)} className="w-10 h-10 bg-surface-variant/30 rounded-full items-center justify-center active:bg-surface-variant/50">
                <MaterialIcons name="close" size={20} className="text-on-surface" />
              </Pressable>
            </View>

            <View className="flex-row justify-between bg-surface-container-highest rounded-xl p-1 mb-6 border border-outline-variant/20">
              {(["all", "date", "range"] as const).map((type) => (
                <Pressable 
                  key={type}
                  className={`flex-1 py-2.5 rounded-lg items-center transition-colors ${filterType === type ? "bg-primary shadow-sm" : ""}`}
                  onPress={() => { 
                    setFilterType(type); 
                    if (type === "all") {
                      setSearchDate(null); setFromDate(null); setToDate(null); 
                    }
                  }}
                >
                  <Text className={`font-label-md font-bold ${filterType === type ? "text-white" : "text-on-surface-variant"}`}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {filterType === "date" && (
              <View className="mb-6 bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/30">
                <Text className="font-label-md font-bold text-on-surface-variant mb-3 uppercase tracking-wider ml-1">Select Date</Text>
                <DatePickerField 
                  label="" 
                  value={searchDate} 
                  onChange={setSearchDate} 
                  inputStyle="h-13 bg-surface border border-outline-variant/50 rounded-xl px-4"
                />
              </View>
            )}

            {filterType === "range" && (
              <View className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/30 mb-6">
                <Text className="font-label-md font-bold text-on-surface-variant mb-3 uppercase tracking-wider ml-1">Date Range</Text>
                <View className="flex-row gap-4 mb-4">
                  <View className="flex-1">
                    <Text className="font-label-sm font-bold text-on-surface mb-2 ml-1">From</Text>
                    <DatePickerField 
                      label="" 
                      value={fromDate} 
                      onChange={setFromDate} 
                      inputStyle="h-12 bg-surface border border-outline-variant/50 rounded-xl px-4 text-sm"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="font-label-sm font-bold text-on-surface mb-2 ml-1">To</Text>
                    <DatePickerField 
                      label="" 
                      value={toDate} 
                      onChange={setToDate} 
                      inputStyle="h-12 bg-surface border border-outline-variant/50 rounded-xl px-4 text-sm"
                    />
                  </View>
                </View>
              </View>
            )}

            <Pressable 
              className="bg-primary h-14 rounded-xl flex-row items-center justify-center active:scale-[0.98] transition-transform shadow-sm shadow-primary/30 mb-2"
              onPress={() => setIsFilterModalVisible(false)}
            >
              <Text className="text-white font-bold text-label-lg mr-2">Apply Filters</Text>
              <MaterialIcons name="check" size={20} color="white" />
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Bill Preview Modal */}
      <Modal visible={!!selectedLoad} transparent animationType="fade" onRequestClose={() => setSelectedLoad(null)}>
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-surface rounded-t-3xl h-[90%] shadow-lg border-t border-outline-variant/20 overflow-hidden">
            <View className="flex-row justify-between items-center p-6 border-b border-outline-variant/20 bg-surface-container-lowest">
              <View>
                <Text className="font-title-lg font-bold text-on-surface mb-1">Purchase Order Details</Text>
                <Text className="text-on-surface-variant font-medium">{selectedLoad?.farm_name}</Text>
              </View>
              <Pressable
                className="w-10 h-10 bg-surface-variant/30 rounded-full items-center justify-center active:bg-surface-variant/50"
                onPress={() => setSelectedLoad(null)}
              >
                <MaterialIcons name="close" size={20} className="text-on-surface" />
              </Pressable>
            </View>

            {selectedLoad && (
              <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
                <View className="flex-col gap-5 pb-8">
                  
                  {/* Status Banner */}
                  <View className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 flex-row justify-between items-center">
                    <View className="flex-row items-center gap-2">
                      <MaterialIcons name="info-outline" size={20} className="text-on-surface-variant" />
                      <Text className="font-label-md font-bold text-on-surface-variant uppercase tracking-wider">Status</Text>
                    </View>
                    <View className={`px-3 py-1 rounded-full border ${
                      selectedLoad.status === 'OPEN' ? 'bg-primary/10 border-primary/20' : 'bg-surface-variant/30 border-outline-variant/20'
                    }`}>
                      <Text className={`font-label-sm font-bold uppercase tracking-widest ${
                        selectedLoad.status === 'OPEN' ? 'text-primary' : 'text-on-surface-variant'
                      }`}>
                        {selectedLoad.status.replace("_", " ")}
                      </Text>
                    </View>
                  </View>

                  {/* General Info */}
                  <View className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 flex-col gap-4">
                    <Text className="font-title-md font-bold text-on-surface mb-1">General Information</Text>
                    
                    <View className="flex-row justify-between items-center border-b border-outline-variant/20 pb-3">
                      <Text className="font-label-md font-medium text-on-surface-variant">Farm Name</Text>
                      <Text className="font-title-sm font-bold text-on-surface">{selectedLoad.farm_name || "Unknown Farm"}</Text>
                    </View>
                    
                    <View className="flex-row justify-between items-center border-b border-outline-variant/20 pb-3">
                      <Text className="font-label-md font-medium text-on-surface-variant">Load Date</Text>
                      <Text className="font-title-sm font-bold text-on-surface">{formatIstDate(selectedLoad.load_date)}</Text>
                    </View>
                    
                    <View className="flex-row justify-between items-center border-b border-outline-variant/20 pb-3">
                      <Text className="font-label-md font-medium text-on-surface-variant">Vehicle</Text>
                      <Text className="font-title-sm font-bold text-on-surface">{selectedLoad.vehicle_number || "—"}</Text>
                    </View>
                    
                    <View className="flex-row justify-between items-center">
                      <Text className="font-label-md font-medium text-on-surface-variant">Contact</Text>
                      <Text className="font-title-sm font-bold text-on-surface">{selectedLoad.contact_phone || "—"}</Text>
                    </View>
                  </View>

                  {/* Weight & Billing Info */}
                  <View className="bg-primary/5 border border-primary/20 rounded-2xl p-5 flex-col gap-4">
                    <View className="flex-row items-center gap-2 mb-1">
                      <MaterialIcons name="receipt-long" size={20} className="text-primary" />
                      <Text className="font-title-md font-bold text-on-surface">Weight & Billing</Text>
                    </View>
                    
                    <View className="flex-row justify-between items-center border-b border-primary/10 pb-3">
                      <Text className="font-label-md font-medium text-on-surface-variant">Original Load</Text>
                      <Text className="font-title-sm font-bold text-on-surface">
                        {Number(selectedLoad.loaded_weight_kg).toLocaleString("en-IN", { maximumFractionDigits: 2 })} KG
                      </Text>
                    </View>
                    
                    <View className="flex-row justify-between items-center border-b border-primary/10 pb-3">
                      <Text className="font-label-md font-medium text-on-surface-variant">Rate / KG</Text>
                      <Text className="font-title-sm font-bold text-on-surface">
                        ₹{selectedLoad.rate_per_kg ? Number(selectedLoad.rate_per_kg).toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "—"}
                      </Text>
                    </View>
                    
                    <View className="flex-row justify-between items-center pt-1">
                      <Text className="font-title-md font-bold text-on-surface">Net Payable</Text>
                      <Text className="font-title-lg font-black text-primary">
                        ₹{selectedLoad.total_amount ? Number(selectedLoad.total_amount).toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "—"}
                      </Text>
                    </View>
                  </View>

                  {/* Payment Info */}
                  <View className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 flex-col gap-4">
                    <Text className="font-title-md font-bold text-on-surface mb-1">Payment Status</Text>
                    
                    <View className="flex-row justify-between items-center border-b border-outline-variant/20 pb-3">
                      <Text className="font-label-md font-medium text-on-surface-variant">Method</Text>
                      {(() => {
                        const method = (selectedLoad.payment_method || "").toLowerCase();
                        if (!method) return <Text className="font-title-sm font-bold text-on-surface">—</Text>;
                        
                        const isUpi = method.includes("upi");
                        const isBank = method.includes("bank");
                        const isCredit = method.includes("credit");
                        const isCash = method.includes("cash");
                        const bg = isCash ? "bg-emerald-100" : isUpi ? "bg-blue-100" : isBank ? "bg-sky-100" : isCredit ? "bg-purple-100" : "bg-surface-variant";
                        const text = isCash ? "text-emerald-800" : isUpi ? "text-blue-800" : isBank ? "text-sky-800" : isCredit ? "text-purple-800" : "text-on-surface";
                        const label = isCash ? "Cash" : isUpi ? "UPI" : isBank ? "Bank Transfer" : isCredit ? "Credit" : selectedLoad.payment_method;
                        
                        return (
                          <View className={`px-3 py-1 rounded-full ${bg}`}>
                            <Text className={`font-label-sm font-bold tracking-wide ${text}`}>{label}</Text>
                          </View>
                        );
                      })()}
                    </View>
                    
                    <View className="flex-row justify-between items-center border-b border-outline-variant/20 pb-3">
                      <Text className="font-label-md font-medium text-on-surface-variant">Paid Amount</Text>
                      <Text className="font-title-sm font-bold text-on-surface">
                        ₹{selectedLoad.paid_amount ? Number(selectedLoad.paid_amount).toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "0"}
                      </Text>
                    </View>
                    
                    <View className="flex-row justify-between items-center pt-1">
                      <Text className="font-title-md font-bold text-on-surface">Balance Due</Text>
                      <Text className="font-title-lg font-black text-error">
                        ₹{(Number(selectedLoad.total_amount || 0) - Number(selectedLoad.paid_amount || 0)).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                      </Text>
                    </View>
                  </View>
                </View>
              </ScrollView>
            )}

            <View className="p-6 pt-4 bg-surface-container-lowest border-t border-outline-variant/20 flex-row gap-3">
              <Pressable 
                className="flex-1 bg-surface-container-highest border border-error/20 rounded-xl h-14 flex-row items-center justify-center gap-2 active:bg-error/10 transition-colors"
                onPress={handleDelete}
              >
                <MaterialIcons name="delete-outline" size={20} className="text-error" />
                <Text className="text-error font-bold text-label-lg">Delete</Text>
              </Pressable>
              <Pressable 
                className="flex-[2] bg-primary rounded-xl h-14 flex-row items-center justify-center gap-2 active:bg-primary/90 shadow-sm shadow-primary/30 transition-transform active:scale-[0.98]"
                onPress={() => {
                  const loadId = selectedLoad.id;
                  setSelectedLoad(null);
                  navigation.navigate("FarmPurchase", { loadId });
                }}
              >
                <MaterialIcons name="edit" size={20} color="white" />
                <Text className="text-white font-bold text-label-lg">Edit Order</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

    </AdminScreenContainer>
  );
}

const LoadListItem = React.memo(({ item, onPress }: { item: any; onPress: () => void }) => {
  return (
    <Pressable 
      className="bg-surface-container-lowest border border-outline-variant/20 rounded-3xl overflow-hidden shadow-sm active:scale-[0.98] transition-transform"
      onPress={onPress}
    >
      <View className="bg-primary/5 px-5 py-4 border-b border-primary/10 flex-row justify-between items-center relative overflow-hidden">
        <View className="absolute right-0 top-0 w-24 h-24 bg-primary/5 rounded-full -translate-y-8 translate-x-8" />
        
        <View className="flex-1 pr-4">
          <Text className="text-title-md text-on-surface font-bold truncate mb-1">
            {item.farm_name || "Unknown Farm"}
          </Text>
          <View className="flex-row items-center text-on-surface-variant">
            <MaterialIcons name="calendar-today" size={12} className="text-on-surface-variant mr-1.5" />
            <Text className="font-label-sm uppercase font-bold tracking-wider">{formatIstDate(item.load_date)}</Text>
          </View>
        </View>
        <View className={`px-3 py-1.5 rounded-full border ${
          item.status === 'OPEN' ? 'bg-primary/10 border-primary/20' : 'bg-surface-variant/30 border-outline-variant/20'
        }`}>
          <Text className={`font-label-sm font-bold uppercase tracking-widest ${
            item.status === 'OPEN' ? 'text-primary' : 'text-on-surface-variant'
          }`}>
            {item.status.replace("_", " ")}
          </Text>
        </View>
      </View>

      <View className="p-5">
        <View className="flex-row items-center justify-between mb-5">
          <View className="flex-1 flex-row items-start gap-3">
            <View className="w-8 h-8 rounded-full bg-surface-variant/30 items-center justify-center mt-0.5">
              <MaterialIcons name="local-shipping" size={16} className="text-on-surface" />
            </View>
            <View>
              <Text className="font-label-sm text-on-surface-variant uppercase font-bold tracking-wider mb-1">Vehicle</Text>
              <Text className="font-title-sm text-on-surface font-bold">{item.vehicle_number || "—"}</Text>
            </View>
          </View>
          <View className="flex-1 items-end pl-2 border-l border-outline-variant/30">
            <Text className="font-label-sm text-on-surface-variant uppercase font-bold tracking-wider mb-1">Total Bill</Text>
            <Text className="font-title-md text-primary font-black">
              {item.total_amount ? `₹${Number(item.total_amount).toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "—"}
            </Text>
          </View>
        </View>

        <View className="bg-surface-container-highest/30 rounded-2xl p-4 flex-row justify-between items-center border border-outline-variant/10">
          <View>
            <Text className="font-label-sm text-on-surface-variant uppercase font-bold tracking-wider mb-1">Original Load</Text>
            <View className="flex-row items-end gap-1">
              <Text className="text-on-surface font-bold text-title-md">
                {Number(item.loaded_weight_kg).toLocaleString("en-IN", { maximumFractionDigits: 1 })}
              </Text>
              <Text className="font-label-sm text-on-surface-variant font-bold mb-0.5">KG</Text>
            </View>
          </View>
          
          <View className="items-center px-4">
            <MaterialIcons name="arrow-right-alt" size={24} className="text-on-surface-variant/50" />
          </View>
          
          <View className="items-end">
            <Text className="font-label-sm text-on-surface-variant uppercase font-bold tracking-wider mb-1">Available</Text>
            <View className="flex-row items-end gap-1">
              <Text className="text-primary font-black text-headline-sm">
                {Number(item.available_weight_kg).toLocaleString("en-IN", { maximumFractionDigits: 1 })}
              </Text>
              <Text className="font-label-md text-primary font-bold mb-1">KG</Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
});
