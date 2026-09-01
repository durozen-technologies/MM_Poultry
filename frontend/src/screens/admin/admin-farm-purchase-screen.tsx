import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  FlatList,
  Text,
  TextInput,
  View,
  ScrollView,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { DatePickerField } from "../../components/date-picker-field";
import { toApiDate, todayIstDate, parseIstDate } from "../../utils/ist-date";
import type { FarmOut, Item } from "../../types/api";

export function AdminFarmPurchaseScreen({ route, navigation }: { route: any, navigation: any }) {
  const loadId = route?.params?.loadId;
  const isEditing = !!loadId;
  const queryClient = useQueryClient();
  const [farms, setFarms] = useState<FarmOut[]>([]);
  const [selectedFarm, setSelectedFarm] = useState<string>("");
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string>("");
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<string>("");
  const [purchaseDate, setPurchaseDate] = useState(todayIstDate());
  const [quantity, setQuantity] = useState("");
  const [weight, setWeight] = useState("");
  const [rate, setRate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer");
  const [paidAmount, setPaidAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derived values
  const weightNum = parseFloat(weight) || 0;
  const rateNum = parseFloat(rate) || 0;
  const netPayable = weightNum * rateNum;
  const paidNum = parseFloat(paidAmount) || 0;
  const balanceAmount = netPayable - paidNum;
  const [showFarmDropdown, setShowFarmDropdown] = useState(false);
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);
  const [showItemDropdown, setShowItemDropdown] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [farmsRes, itemsRes, vehiclesRes] = await Promise.all([
        api.get("/admin/farms"),
        api.get("/admin/items?active_only=true"),
        api.get("/admin/vehicles").catch(() => ({ data: [] })),
      ]);
      setFarms(farmsRes.data);
      setItems(itemsRes.data.items || itemsRes.data);
      setVehicles(Array.isArray(vehiclesRes.data) ? vehiclesRes.data : (vehiclesRes.data as any).items || []);
      
      if (loadId) {
        const { data: loadData } = await api.get(`/admin/farm-loads/${loadId}`);
        setSelectedFarm(loadData.farm_id || "");
        setSelectedItem(loadData.item_id || "");
        setSelectedVehicle(loadData.vehicle_id || "");
        if (loadData.load_date) {
            setPurchaseDate(parseIstDate(loadData.load_date) || todayIstDate());
        }
        setQuantity(loadData.bird_count != null ? String(loadData.bird_count) : "");
        setWeight(loadData.loaded_weight_kg != null ? String(loadData.loaded_weight_kg) : "");
        setRate(loadData.rate_per_kg != null ? String(loadData.rate_per_kg) : "");
        setPaymentMethod(loadData.payment_method || "Bank Transfer");
        setPaidAmount(loadData.paid_amount != null ? String(loadData.paid_amount) : "");
        setRemarks(loadData.remarks || "");
      } else {

      }
    } catch (e) {
      console.warn("Failed to fetch data in AdminFarmPurchaseScreen", e);
    }
  }, [loadId]);

  useFocusEffect(
    useCallback(() => {
      void fetchData();
    }, [fetchData])
  );

  async function onSubmit() {
    if (!selectedFarm) {
      setError("Please select a farm");
      return;
    }
    if (!selectedItem) {
      setError("Please select an item");
      return;
    }
    if (!weight) {
      setError("Total Weight is required");
      return;
    }
    const w = parseFloat(weight);
    if (!Number.isFinite(w) || w <= 0) {
      setError("Weight must be a positive number");
      return;
    }
    if (selectedVehicle) {
      const v = vehicles.find((x) => x.id === selectedVehicle);
      if (v?.capacity_kg && w > parseFloat(v.capacity_kg)) {
        setError(`Weight ${w}kg exceeds vehicle capacity ${v.capacity_kg}kg`);
        return;
      }
    }
    setLoading(true);
    setError(null);
    try {
      const payload = {
        farm_id: selectedFarm,
        item_id: selectedItem,
        vehicle_id: selectedVehicle || null,
        load_date: toApiDate(purchaseDate),
        bird_count: quantity ? parseInt(quantity, 10) : null,
        loaded_weight_kg: w,
        rate_per_kg: rateNum > 0 ? rateNum : null,
        total_amount: netPayable > 0 ? netPayable : null,
        paid_amount: paidNum > 0 ? paidNum : null,
        payment_method: paymentMethod,
        remarks: remarks.trim() || null,
      };

      if (isEditing) {
        await api.patch(`/admin/farm-loads/${loadId}`, payload);
      } else {
        await api.post("/admin/farm-loads", payload);
      }
      queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "farms"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] });
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to record farm load");
      setLoading(false);
    }
  }

  const selectedFarmName = farms.find(f => f.id === selectedFarm)?.name || "Select Farm";
  const selectedItemName = items.find(i => i.id === selectedItem)?.name || "Select Item";

  return (
    <SafeAreaView className="flex-1 bg-[#f9fafb]" edges={["top", "bottom"]}>
      {/* Header */}
      <View className="bg-[#0e6832] px-3 pt-1 pb-2 flex-row items-center">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Button"
          className="w-10 h-10 -ml-2 items-center justify-center rounded-full active:bg-white/10 mr-2"
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="white" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-white font-headline-sm font-semibold tracking-tight">
            {isEditing ? "Edit Purchase Order" : "New Farm Purchase"}
          </Text>
        </View>
      </View>

      <KeyboardAwareScrollView 
        enableOnAndroid={true}
        keyboardShouldPersistTaps="handled"
        className="flex-1 px-4 pt-4" 
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {error && (
          <Text className="px-3 py-2 mb-4 text-red-600 text-center bg-red-50 rounded-lg font-semibold">
            {error}
          </Text>
        )}

        <View className="bg-white rounded-2xl border border-gray-200 p-4 mb-4 shadow-sm z-50">
          <View className="flex-row gap-4 mb-4 z-50">
            <View className="flex-1 relative z-50">
              <Text className="text-gray-700 text-[13px] mb-1.5 font-medium">Farm</Text>
              <Pressable
                accessibilityRole="button"
                className="h-[46px] border border-gray-200 rounded-lg px-3 flex-row items-center justify-between bg-white"
                onPress={() => setShowFarmDropdown(!showFarmDropdown)}
              >
                <Text className={`text-sm ${selectedFarm ? 'text-gray-900' : 'text-gray-400'}`}>
                  {selectedFarmName}
                </Text>
                <MaterialIcons name="keyboard-arrow-down" size={20} color="#9ca3af" />
              </Pressable>
              {showFarmDropdown && (
                <View className="absolute top-[70px] left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-hidden">
                  <ScrollView nestedScrollEnabled className="max-h-48">
                    {farms.length > 0 ? (
                      farms.map((farm) => (
                        <Pressable
                          key={farm.id}
                          className="px-4 py-3 border-b border-gray-100"
                          onPress={() => {
                            setSelectedFarm(farm.id);
                            setShowFarmDropdown(false);
                          }}
                        >
                          <Text className="text-gray-900 font-medium">{farm.name}</Text>
                        </Pressable>
                      ))
                    ) : (
                      <Text className="p-4 text-center text-gray-500">No farms</Text>
                    )}
                  </ScrollView>
                </View>
              )}
            </View>

            <View className="flex-1 relative z-40">
              <Text className="text-gray-700 text-[13px] mb-1.5 font-medium">
                Vehicle <Text className="text-gray-400 font-normal">(Optional)</Text>
              </Text>
              <Pressable
                className="h-[46px] border border-gray-200 rounded-lg px-3 flex-row items-center justify-between bg-white"
                onPress={() => setShowVehicleDropdown(!showVehicleDropdown)}
              >
                <Text className={`text-sm ${selectedVehicle ? 'text-gray-900' : 'text-gray-400'}`} numberOfLines={1}>
                  {vehicles.find((v) => v.id === selectedVehicle)?.number || "Select Vehicle (optional)"}
                </Text>
                <MaterialIcons name="keyboard-arrow-down" size={20} color="#9ca3af" />
              </Pressable>
              {showVehicleDropdown && (
                <View className="absolute top-[70px] left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-hidden">
                  <ScrollView nestedScrollEnabled className="max-h-48">
                    <Pressable
                      className="px-4 py-3 border-b border-gray-100"
                      onPress={() => { setSelectedVehicle(""); setShowVehicleDropdown(false); }}
                    >
                      <Text className="text-gray-500">— No vehicle —</Text>
                    </Pressable>
                    {vehicles.map((v) => (
                      <Pressable
                        key={v.id}
                        className="px-4 py-3 border-b border-gray-100"
                        onPress={() => { setSelectedVehicle(v.id); setShowVehicleDropdown(false); }}
                      >
                        <Text className="text-gray-900 font-medium">{v.number}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          </View>

          <View className="flex-row gap-4 mb-2 z-30">
            <View className="flex-1 relative z-30">
              <Text className="text-gray-700 text-[13px] mb-1.5 font-medium">Item</Text>
              <Pressable
                className="h-[46px] border border-gray-200 rounded-lg px-3 flex-row items-center justify-between bg-white"
                onPress={() => setShowItemDropdown(!showItemDropdown)}
              >
                <Text className={`text-sm ${selectedItem ? 'text-gray-900' : 'text-gray-400'}`}>
                  {selectedItemName}
                </Text>
                <MaterialIcons name="keyboard-arrow-down" size={20} color="#9ca3af" />
              </Pressable>
              {showItemDropdown && (
                <View className="absolute top-[70px] left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-hidden">
                  <ScrollView nestedScrollEnabled className="max-h-48">
                    {items.map((item) => (
                      <Pressable
                        key={item.id}
                        className="px-4 py-3 border-b border-gray-100"
                        onPress={() => { setSelectedItem(item.id); setShowItemDropdown(false); }}
                      >
                        <Text className="text-gray-900 font-medium">{item.name}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
            
            <View className="flex-1 z-20">
              <Text className="text-gray-700 text-[13px] mb-1.5 font-medium">
                Purchase Date <Text className="text-gray-400 font-normal text-[10px]"></Text>
              </Text>
              <DatePickerField 
                value={purchaseDate} 
                onChange={setPurchaseDate} 
                maximumDate={new Date()} 
                containerStyle=""
                inputStyle="h-[46px] border border-gray-200 rounded-lg px-3 bg-white"
                showIcon={true}
              />
            </View>
          </View>
        </View>

        <View className="bg-white rounded-2xl border border-gray-200 p-4 mb-4 shadow-sm z-10">
          <View className="flex-row items-center mb-4">
            <Text className="text-[#0e6832] font-bold text-base mr-3">Bird & Weight</Text>
            <View className="flex-1 h-[1px] bg-gray-200" />
          </View>

          <View className="flex-row gap-4 mb-4">
            <View className="flex-1">
              <Text className="text-gray-700 text-[13px] mb-1.5 font-medium">Quantity (Boxes)</Text>
              <TextInput
                className="h-[46px] border border-gray-200 rounded-lg px-3 text-sm text-gray-900 bg-white"
                placeholder="Enter quantity"
                placeholderTextColor="#9ca3af"
                keyboardType="number-pad"
                value={quantity}
                onChangeText={setQuantity}
              />
            </View>
            <View className="flex-1">
              <Text className="text-gray-700 text-[13px] mb-1.5 font-medium">Total Weight (KG)</Text>
              <TextInput
                className="h-[46px] border border-gray-200 rounded-lg px-3 text-sm text-gray-900 bg-white"
                placeholder="Enter total weight"
                placeholderTextColor="#9ca3af"
                keyboardType="decimal-pad"
                value={weight}
                onChangeText={setWeight}
              />
            </View>
          </View>

          <View className="w-1/2 pr-2">
            <Text className="text-gray-700 text-[13px] mb-1.5 font-medium">Rate (₹ per KG)</Text>
            <TextInput
              className="h-[46px] border border-gray-200 rounded-lg px-3 text-sm text-gray-900 bg-white"
              placeholder="Enter rate per kg"
              placeholderTextColor="#9ca3af"
              keyboardType="decimal-pad"
              value={rate}
              onChangeText={setRate}
            />
          </View>
        </View>

        <View className="bg-white rounded-2xl border border-gray-200 p-4 mb-4 shadow-sm z-0">
          <View className="flex-row items-center mb-4">
            <Text className="text-[#0e6832] font-bold text-base mr-3">Payment</Text>
            <View className="flex-1 h-[1px] bg-gray-200" />
          </View>

          <View className="flex-row flex-wrap gap-2 mb-4">
            {["Bank Transfer", "UPI", "Cash", "Credit"].map((method) => (
              <Pressable
                key={method}
                className={`h-11 rounded-lg border flex-row items-center justify-center px-4 flex-1 min-w-[70px] ${
                  paymentMethod === method 
                    ? "border-[#0e6832] bg-[#f0f9f3]" 
                    : "border-gray-200 bg-white"
                }`}
                onPress={() => setPaymentMethod(method)}
              >
                <Text className={`text-sm ${
                  paymentMethod === method ? "text-gray-900 font-medium" : "text-gray-600"
                }`}>
                  {method}
                </Text>
                {paymentMethod === method && (
                  <View className="absolute top-1 right-1 bg-white rounded-full">
                    <MaterialIcons name="check-circle" size={14} color="#0e6832" />
                  </View>
                )}
              </Pressable>
            ))}
          </View>

          <View className="flex-row gap-4 mb-4">
            <View className="flex-1">
              <Text className="text-gray-700 text-[13px] mb-1.5 font-medium">Paid Amount (₹)</Text>
              <TextInput
                className="h-[46px] border border-gray-200 rounded-lg px-3 text-sm text-gray-900 bg-white"
                placeholder="Enter paid amount"
                placeholderTextColor="#9ca3af"
                keyboardType="decimal-pad"
                value={paidAmount}
                onChangeText={setPaidAmount}
              />
            </View>
            <View className="flex-1">
              <Text className="text-gray-700 text-[13px] mb-1.5 font-medium">Balance Amount</Text>
              <View className="h-[46px] bg-[#f0f9f3] rounded-lg px-3 justify-center border border-transparent">
                <Text className="text-[#0e6832] font-bold text-base">
                  ₹{balanceAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                </Text>
              </View>
            </View>
          </View>

          <View>
            <Text className="text-gray-700 text-[13px] mb-1.5 font-medium">Remarks</Text>
            <TextInput
              className="h-[80px] border border-gray-200 rounded-lg px-3 py-3 text-sm text-gray-900 bg-white"
              placeholder="Add any remarks (optional)"
              placeholderTextColor="#9ca3af"
              multiline
              textAlignVertical="top"
              value={remarks}
              onChangeText={setRemarks}
            />
          </View>
        </View>

        <View className="bg-white border border-gray-200 rounded-2xl p-4 mb-8 shadow-sm">
          <Text className="text-[#0e6832] font-bold text-base mb-4">Purchase Summary</Text>

          <View className="flex-row gap-3">
            <View className="flex-1 border border-gray-200 rounded-lg p-3 items-center">
              <Text className="text-gray-700 text-[11px] mb-1 font-medium">Total Weight</Text>
              <Text className="text-[#0e6832] font-bold text-[15px]">
                {weightNum > 0 ? weightNum.toLocaleString("en-IN", { maximumFractionDigits: 3 }) : "0"} KG
              </Text>
            </View>
            <View className="flex-1 border border-gray-200 rounded-lg p-3 items-center">
              <Text className="text-gray-700 text-[11px] mb-1 font-medium">Rate</Text>
              <Text className="text-[#0e6832] font-bold text-[15px]">
                ₹{rateNum > 0 ? rateNum.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "0"}
              </Text>
            </View>
            <View className="flex-1 bg-[#f0f9f3] border border-transparent rounded-lg p-3 items-center">
              <Text className="text-gray-900 text-[11px] font-medium mb-1">Net Payable</Text>
              <Text className="text-[#0e6832] font-bold text-[15px]">
                ₹{netPayable > 0 ? netPayable.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "0"}
              </Text>
            </View>
          </View>

          <Pressable
            className="w-full bg-[#0e6832] h-14 rounded-xl flex items-center justify-center active:bg-[#0a4f26] mb-4 shadow-sm"
            onPress={onSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-white font-bold text-lg">{isEditing ? "Update Load" : "Create Load"}</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
