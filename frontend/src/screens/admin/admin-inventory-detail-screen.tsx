import { View, Text, Pressable, FlatList, ActivityIndicator, TextInput, Modal, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useState } from "react";
import { useAdminInventoryItemLoads } from "../../hooks/use-queries";
import { formatIstDate, toApiDate, parseIstDate } from "../../utils/ist-date";
import { DatePickerField } from "../../components/date-picker-field";
import { deleteFarmLoad } from "../../api/farms";

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

  const filteredLoads = loads.filter((load) => {
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
  });

  const handleDelete = () => {
    if (!selectedLoad) return;
    Alert.alert("Delete Purchase Order", "Are you sure you want to delete this purchase order?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
          try {
            await deleteFarmLoad(selectedLoad.id);
            setSelectedLoad(null);
            refetch();
          } catch(e) {
            console.error(e);
          }
      }}
    ])
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      {/* Header */}
      <View className="h-16 px-4 flex-row items-center gap-3 bg-surface border-b border-outline-variant/30">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="w-11 h-11 -ml-2 flex items-center justify-center rounded-full active:bg-surface-variant/50"
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} className="text-on-surface" />
        </Pressable>
        <View>
          <Text className="font-headline-sm text-on-surface font-semibold">{itemName} Inventory</Text>
          <Text className="text-label-md text-on-surface-variant">Active Purchase Orders</Text>
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0e6832" />
        </View>
      ) : (
        <FlatList
          data={filteredLoads}
          keyExtractor={(item) => item.id}
          className="flex-1 px-4 pt-4"
          contentContainerStyle={{ paddingBottom: 40 }}
          ListHeaderComponent={
            <View className="flex-row items-center gap-3 mb-4">
              <View className="relative flex-[0.6]">
                <View className="absolute left-3 z-10 top-0 bottom-0 justify-center">
                  <MaterialIcons name="search" size={20} className="text-on-surface-variant" />
                </View>
                <TextInput
                  placeholderTextColor="#737373"
                  className="h-[46px] pl-10 pr-3 bg-surface-container-lowest border border-surface-variant rounded-xl text-body-md text-on-surface placeholder:text-on-surface-variant"
                  placeholder="Search farms, vehicles..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
              <View className="flex-[0.4]">
                <Pressable
                  className="h-[46px] border border-surface-variant rounded-xl px-3 bg-surface-container-lowest flex-row items-center justify-center active:bg-surface-variant/30"
                  onPress={() => setIsFilterModalVisible(true)}
                >
                  <MaterialIcons name="filter-list" size={18} className="text-on-surface-variant" style={{ marginRight: 4 }} />
                  <Text className="text-body-md text-on-surface">Filter</Text>
                </Pressable>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View className="flex-col items-center justify-center p-8 mt-4">
              <MaterialIcons name="inventory-2" size={48} className="text-on-surface-variant" />
              <Text className="font-headline-md text-on-surface mb-2 mt-4 font-semibold text-center">
                No active stock
              </Text>
              <Text className="font-body-md text-on-surface-variant text-center">
                There are no open or in-transit farm loads for this item.
              </Text>
            </View>
          }
          ItemSeparatorComponent={() => <View className="h-4" />}
          renderItem={({ item }) => (
            <Pressable 
              className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl overflow-hidden shadow-sm active:bg-surface-container/50"
              onPress={() => setSelectedLoad(item)}
            >
              <View className="bg-[#0e6832]/5 px-4 py-3 border-b border-outline-variant/20 flex-row justify-between items-center">
                <View>
                  <Text className="text-on-surface font-semibold text-sm">{item.farm_name || "Unknown Farm"}</Text>
                  <Text className="text-on-surface-variant text-[11px] mt-0.5">{formatIstDate(item.load_date)}</Text>
                </View>
                <View className="bg-[#0e6832] px-2.5 py-1 rounded-full">
                  <Text className="text-white font-bold text-[10px]">{item.status.replace("_", " ")}</Text>
                </View>
              </View>

              <View className="p-4">
                <View className="flex-row items-center justify-between mb-4">
                  <View className="flex-1">
                    <Text className="text-on-surface-variant text-xs mb-1">Vehicle</Text>
                    <Text className="text-on-surface font-medium text-sm">{item.vehicle_number || "—"}</Text>
                  </View>
                  <View className="flex-1 items-end">
                    <Text className="text-on-surface-variant text-xs mb-1">Original Load</Text>
                    <Text className="text-on-surface font-medium text-sm">
                      {Number(item.loaded_weight_kg).toLocaleString("en-IN", { maximumFractionDigits: 3 })} KG
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center justify-between mb-4">
                  <View className="flex-1">
                    <Text className="text-on-surface-variant text-xs mb-1">Bill Amount</Text>
                    <Text className="text-[#115E29] font-bold text-sm">
                      {item.total_amount ? `₹${Number(item.total_amount).toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "—"}
                    </Text>
                  </View>
                </View>

                <View className="bg-surface-variant/30 rounded-xl p-3 flex-row justify-between items-center">
                  <View>
                    <Text className="text-on-surface-variant text-[11px] font-medium mb-0.5">Delivered</Text>
                    <Text className="text-error font-semibold text-sm">
                      - {Number(item.delivered_weight_kg).toLocaleString("en-IN", { maximumFractionDigits: 3 })} KG
                    </Text>
                  </View>
                  <View className="h-6 w-[1px] bg-outline-variant/30 mx-2" />
                  <View className="items-end">
                    <Text className="text-on-surface-variant text-[11px] font-medium mb-0.5">Available Stock</Text>
                    <Text className="text-[#0e6832] font-bold text-lg">
                      {Number(item.available_weight_kg).toLocaleString("en-IN", { maximumFractionDigits: 3 })} KG
                    </Text>
                  </View>
                </View>
              </View>
            </Pressable>
          )}
        />
      )}

      <Modal visible={isFilterModalVisible} transparent animationType="fade" onRequestClose={() => setIsFilterModalVisible(false)}>
        <View className="flex-1 justify-center items-center bg-black/40 p-4">
          <View className="bg-surface rounded-3xl p-6 w-full max-w-sm">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-headline-sm font-semibold text-on-surface">Date Filter</Text>
              <Pressable onPress={() => setIsFilterModalVisible(false)} className="p-2 -mr-2">
                <MaterialIcons name="close" size={24} className="text-on-surface-variant" />
              </Pressable>
            </View>

            <View className="flex-row justify-between bg-surface-container-lowest rounded-xl p-1 mb-6 border border-outline-variant/30">
              <Pressable 
                className={`flex-1 py-2 rounded-lg items-center ${filterType === "all" ? "bg-primary" : ""}`}
                onPress={() => { setFilterType("all"); setSearchDate(null); setFromDate(null); setToDate(null); }}
              >
                <Text className={`font-medium ${filterType === "all" ? "text-white" : "text-on-surface-variant"}`}>All</Text>
              </Pressable>
              <Pressable 
                className={`flex-1 py-2 rounded-lg items-center ${filterType === "date" ? "bg-primary" : ""}`}
                onPress={() => setFilterType("date")}
              >
                <Text className={`font-medium ${filterType === "date" ? "text-white" : "text-on-surface-variant"}`}>Specific</Text>
              </Pressable>
              <Pressable 
                className={`flex-1 py-2 rounded-lg items-center ${filterType === "range" ? "bg-primary" : ""}`}
                onPress={() => setFilterType("range")}
              >
                <Text className={`font-medium ${filterType === "range" ? "text-white" : "text-on-surface-variant"}`}>Range</Text>
              </Pressable>
            </View>

            {filterType === "date" && (
              <View className="mb-6">
                <Text className="text-label-md text-on-surface-variant mb-2">Select Date</Text>
                <DatePickerField value={searchDate} onChange={setSearchDate} />
              </View>
            )}

            {filterType === "range" && (
              <View className="flex-row gap-4 mb-6">
                <View className="flex-1">
                  <Text className="text-label-md text-on-surface-variant mb-2">From Date</Text>
                  <DatePickerField value={fromDate} onChange={setFromDate} />
                </View>
                <View className="flex-1">
                  <Text className="text-label-md text-on-surface-variant mb-2">To Date</Text>
                  <DatePickerField value={toDate} onChange={setToDate} />
                </View>
              </View>
            )}

            <Pressable 
              className="bg-primary h-12 rounded-xl flex items-center justify-center active:bg-primary/90 mt-2 shadow-sm"
              onPress={() => setIsFilterModalVisible(false)}
            >
              <Text className="text-white font-bold text-base">Apply Filter</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Bill Preview Modal */}
      <Modal visible={!!selectedLoad} transparent animationType="fade" onRequestClose={() => setSelectedLoad(null)}>
        <View className="flex-1 justify-center items-center bg-black/50 px-4">
          <View className="bg-surface rounded-3xl p-6 pb-8 w-full max-h-[85%]">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-headline-sm font-semibold text-on-surface">Bill Preview</Text>
              <Pressable onPress={() => setSelectedLoad(null)} className="p-2 -mr-2 bg-surface-variant/30 rounded-full">
                <MaterialIcons name="close" size={24} className="text-on-surface-variant" />
              </Pressable>
            </View>

            {selectedLoad && (
              <View className="flex-col gap-4 mb-8">
                <View className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-4 flex-col gap-3">
                  <View className="flex-row justify-between">
                    <Text className="text-on-surface-variant font-medium">Farm Name</Text>
                    <Text className="text-on-surface font-semibold">{selectedLoad.farm_name || "Unknown Farm"}</Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-on-surface-variant font-medium">Date</Text>
                    <Text className="text-on-surface font-semibold">{formatIstDate(selectedLoad.load_date)}</Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-on-surface-variant font-medium">Vehicle</Text>
                    <Text className="text-on-surface font-semibold">{selectedLoad.vehicle_number || "—"}</Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-on-surface-variant font-medium">Status</Text>
                    <Text className="text-primary font-bold">{selectedLoad.status.replace("_", " ")}</Text>
                  </View>
                </View>

                <View className="bg-[#0e6832]/5 border border-[#0e6832]/20 rounded-xl p-4 flex-col gap-3">
                  <View className="flex-row justify-between">
                    <Text className="text-on-surface-variant font-medium">Original Load</Text>
                    <Text className="text-on-surface font-semibold">
                      {Number(selectedLoad.loaded_weight_kg).toLocaleString("en-IN", { maximumFractionDigits: 3 })} KG
                    </Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-on-surface-variant font-medium">Rate / KG</Text>
                    <Text className="text-on-surface font-semibold">
                      ₹{selectedLoad.rate_per_kg ? Number(selectedLoad.rate_per_kg).toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "—"}
                    </Text>
                  </View>
                  
                  <View className="h-[1px] bg-[#0e6832]/20 my-1" />
                  
                  <View className="flex-row justify-between">
                    <Text className="text-on-surface font-bold text-base">Net Payable</Text>
                    <Text className="text-[#0e6832] font-bold text-lg">
                      ₹{selectedLoad.total_amount ? Number(selectedLoad.total_amount).toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "—"}
                    </Text>
                  </View>
                </View>

                <View className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-4 flex-col gap-3">
                  <View className="flex-row justify-between items-center">
                    <Text className="text-on-surface-variant font-medium">Payment</Text>
                    {(() => {
                      const method = (selectedLoad.payment_method || "").toLowerCase();
                      const isUpi = method.includes("upi");
                      const isBank = method.includes("bank");
                      const isCredit = method.includes("credit");
                      const isCash = method.includes("cash");
                      const bg = isCash ? "bg-emerald-100" : isUpi ? "bg-blue-100" : isBank ? "bg-sky-100" : isCredit ? "bg-purple-100" : "bg-gray-100";
                      const text = isCash ? "text-emerald-700" : isUpi ? "text-blue-700" : isBank ? "text-sky-700" : isCredit ? "text-purple-700" : "text-gray-600";
                      const label = isCash ? "Cash" : isUpi ? "UPI" : isBank ? "Bank Transfer" : isCredit ? "Credit" : selectedLoad.payment_method || "—";
                      return (
                        <View className={`px-3 py-1 rounded-full ${bg}`}>
                          <Text className={`font-bold text-sm ${text}`}>{label}</Text>
                        </View>
                      );
                    })()}
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-on-surface-variant font-medium">Paid Amount</Text>
                    <Text className="text-[#115E29] font-semibold">
                      ₹{selectedLoad.paid_amount ? Number(selectedLoad.paid_amount).toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "0"}
                    </Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-on-surface-variant font-medium">Balance</Text>
                    <Text className="text-error font-bold text-base">
                      ₹{(Number(selectedLoad.total_amount || 0) - Number(selectedLoad.paid_amount || 0)).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            <View className="flex-row gap-3">
              <Pressable 
                className="flex-1 bg-white border border-error rounded-xl h-14 flex items-center justify-center active:bg-error/10"
                onPress={handleDelete}
              >
                <Text className="text-error font-bold text-base">Delete</Text>
              </Pressable>
              <Pressable 
                className="flex-1 bg-primary rounded-xl h-14 flex items-center justify-center active:bg-primary/90"
                onPress={() => {
                  const loadId = selectedLoad.id;
                  setSelectedLoad(null);
                  navigation.navigate("FarmPurchase", { loadId });
                }}
              >
                <Text className="text-white font-bold text-base">Edit</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}
