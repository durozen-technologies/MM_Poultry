import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  FlatList,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { DatePickerField } from "../../components/date-picker-field";
import { toApiDate, todayIstDate } from "../../utils/ist-date";
import type { FarmOut, Item } from "../../types/api";

export function AdminFarmPurchaseScreen({ navigation }: { navigation: any }) {
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
    } catch (e) {
      console.warn("Failed to fetch data", e);
    }
  }, []);

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
      await api.post("/admin/farm-loads", {
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
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "farms"] });
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to record farm load");
      setLoading(false);
    }
  }

  const selectedFarmName = farms.find(f => f.id === selectedFarm)?.name || "Select Farm";
  const selectedItemName = items.find(i => i.id === selectedItem)?.name || "Select Item";

  return (
    <SafeAreaView className="flex-1 max-w-3xl mx-auto w-full bg-background" edges={["top", "bottom"]}>
      {/* Header */}
      <View className="h-16 px-4 flex-row items-center bg-surface/90 border-b border-surface-variant/30">
        <Pressable accessibilityRole="button" accessibilityLabel="Button"
          className="w-11 h-11 -ml-2 flex items-center justify-center rounded-full active:bg-surface-container"
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} className="text-on-surface" />
        </Pressable>
        <Text className="font-headline-sm text-headline-sm text-on-surface font-semibold ml-2">
          Farm Purchase
        </Text>
      </View>

      <ScrollView className="flex-1 px-4 pt-6 flex-col" contentContainerStyle={{ paddingBottom: 32 }}>
        {error && (
          <Text className="px-4 py-2 mb-4 text-error text-center text-label-md bg-error-container rounded-lg font-semibold">
            {error}
          </Text>
        )}

        {/* Purchase Info */}
        <View className="bg-surface-container-lowest rounded-3xl shadow-sm border border-outline-variant/20 p-5 flex-col gap-5 mb-6 z-50">
          <View className="flex-row items-center gap-2 border-b border-surface-variant/30 pb-3">
            <MaterialIcons name="info-outline" size={20} className="text-primary" />
            <Text className="font-label-lg text-label-lg text-on-surface uppercase tracking-wider font-bold">
              Purchase Info
            </Text>
          </View>

          <View className="flex-col gap-2">
            <Text className="font-body-md text-body-md text-on-surface-variant">Farm</Text>
            <View className="relative z-20">
              <Pressable accessibilityRole="button" accessibilityLabel="Button" 
                className="bg-surface-container-lowest rounded-2xl px-4 h-12 flex-row items-center justify-between shadow-sm border border-outline-variant/30 active:bg-surface-container"
                onPress={() => setShowFarmDropdown(!showFarmDropdown)}
              >
                <View className="flex-row items-center gap-3">
                  <MaterialIcons name="agriculture" size={20} color="#5c5f60" />
                  <Text className={`font-body-lg text-body-lg ${selectedFarm ? 'text-on-surface' : 'text-secondary'}`}>
                    {selectedFarmName}
                  </Text>
                </View>
                <MaterialIcons name={showFarmDropdown ? "arrow-drop-up" : "arrow-drop-down"} size={24} className="text-on-surface" />
              </Pressable>
              
              {showFarmDropdown && (
                <View className="absolute top-14 left-0 right-0 bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/30 z-50 max-h-48 overflow-hidden">
                  <ScrollView nestedScrollEnabled className="w-full max-h-48">
                    {farms.length > 0 ? (
                      farms.map((farm) => (
                        <Pressable accessibilityRole="button" accessibilityLabel="Button" 
                          key={farm.id}
                          className="px-4 py-3 border-b border-surface-variant/50 active:bg-surface-container"
                          onPress={() => {
                            setSelectedFarm(farm.id);
                            setShowFarmDropdown(false);
                          }}
                        >
                          <Text className="font-body-md text-body-md text-on-surface font-semibold">{farm.name}</Text>
                          <Text className="font-label-md text-label-md text-on-surface-variant mt-0.5">{farm.owner_name} • {farm.contact_phone}</Text>
                        </Pressable>
                      ))
                    ) : (
                      <Text className="p-4 text-center text-on-surface-variant">No farms found.</Text>
                    )}
                  </ScrollView>
                </View>
              )}
            </View>
          </View>

          <View className="flex-col gap-2 z-[9] mt-2">
            <Text className="font-body-md text-body-md text-on-surface-variant">Vehicle (Optional)</Text>
            <View className="relative z-15">
              <Pressable
                className="bg-surface-container-lowest rounded-2xl px-4 h-12 flex-row items-center justify-between shadow-sm border border-outline-variant/30 active:bg-surface-container"
                onPress={() => setShowVehicleDropdown(!showVehicleDropdown)}
              >
                <View className="flex-row items-center gap-3">
                  <MaterialIcons name="local-shipping" size={20} color="#5c5f60" />
                  <Text className={`font-body-lg ${selectedVehicle ? "text-on-surface" : "text-secondary"}`}>
                    {vehicles.find((v) => v.id === selectedVehicle)?.number || "Select Vehicle (optional)"}
                  </Text>
                </View>
                <MaterialIcons name={showVehicleDropdown ? "arrow-drop-up" : "arrow-drop-down"} size={24} className="text-on-surface" />
              </Pressable>
              {showVehicleDropdown && (
                <View className="absolute top-14 left-0 right-0 bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/30 z-50 max-h-48 overflow-hidden elevation-10">
                  <ScrollView nestedScrollEnabled className="w-full max-h-48">
                    <Pressable className="px-4 py-3 border-b border-surface-variant/50 active:bg-surface-container" onPress={() => { setSelectedVehicle(""); setShowVehicleDropdown(false); }}>
                      <Text className="text-on-surface-variant">— No vehicle —</Text>
                    </Pressable>
                    {vehicles.map((v) => (
                      <Pressable key={v.id} className="px-4 py-3 border-b border-surface-variant/50 active:bg-surface-container" onPress={() => { setSelectedVehicle(v.id); setShowVehicleDropdown(false); }}>
                        <Text className="font-semibold text-on-surface">{v.number}</Text>
                        <Text className="text-on-surface-variant text-sm">{v.capacity_kg ? `${v.capacity_kg} kg` : "No capacity"} {v.driver_name ? `· ${v.driver_name}` : ""}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          </View>

          <View className="flex-col gap-2 z-[9] mt-2">
            <Text className="font-body-md text-body-md text-on-surface-variant">Item</Text>
            <View className="relative z-10">
              <Pressable accessibilityRole="button" accessibilityLabel="Button" 
                className="bg-surface-container-lowest rounded-2xl px-4 h-12 flex-row items-center justify-between shadow-sm border border-outline-variant/30 active:bg-surface-container"
                onPress={() => setShowItemDropdown(!showItemDropdown)}
              >
                <View className="flex-row items-center gap-3">
                  <MaterialIcons name="category" size={20} color="#5c5f60" />
                  <Text className={`font-body-lg text-body-lg ${selectedItem ? 'text-on-surface' : 'text-secondary'}`}>
                    {selectedItemName}
                  </Text>
                </View>
                <MaterialIcons name={showItemDropdown ? "arrow-drop-up" : "arrow-drop-down"} size={24} className="text-on-surface" />
              </Pressable>
              
              {showItemDropdown && (
                <View className="absolute top-14 left-0 right-0 bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/30 z-50 max-h-48 overflow-hidden">
                  <ScrollView nestedScrollEnabled className="w-full max-h-48">
                    {items.length > 0 ? (
                      items.map((item) => (
                        <Pressable accessibilityRole="button" accessibilityLabel="Button" 
                          key={item.id}
                          className="px-4 py-3 border-b border-surface-variant/50 active:bg-surface-container"
                          onPress={() => {
                            setSelectedItem(item.id);
                            setShowItemDropdown(false);
                          }}
                        >
                          <Text className="font-body-md text-body-md text-on-surface font-semibold">{item.name}</Text>
                        </Pressable>
                      ))
                    ) : (
                      <Text className="p-4 text-center text-on-surface-variant">No items found.</Text>
                    )}
                  </ScrollView>
                </View>
              )}
            </View>
          </View>

          <View className="flex-col gap-2 relative z-[8] mt-2">
            <DatePickerField label="Purchase Date" value={purchaseDate} onChange={setPurchaseDate} maximumDate={new Date()} />
          </View>
        </View>

        {/* Bird & Weight */}
        <View className="bg-surface-container-lowest rounded-3xl shadow-sm border border-outline-variant/20 p-5 flex-col gap-5 mb-6 relative z-0">
          <View className="flex-row items-center gap-2 border-b border-surface-variant/30 pb-3">
            <MaterialIcons name="monitor-weight" size={20} className="text-primary" />
            <Text className="font-label-lg text-label-lg text-on-surface uppercase tracking-wider font-bold">
              Bird & Weight
            </Text>
          </View>
          
          <View className="flex-row gap-4">
            <View className="flex-col gap-2 flex-1">
              <Text className="font-body-md text-body-md text-on-surface-variant">Quantity (Birds)</Text>
              <View className="bg-surface-container-lowest rounded-2xl px-4 min-h-[52px] justify-center border border-outline-variant/30 shadow-sm">
                <TextInput placeholderTextColor="#737373"
                  className="bg-transparent font-headline-md-mobile text-headline-md-mobile text-on-surface p-0 m-0 flex-1 w-full placeholder:text-on-surface-variant"
                  placeholder="0"
                  keyboardType="number-pad"
                  value={quantity}
                  onChangeText={setQuantity}
 />
              </View>
            </View>
            
            <View className="flex-col gap-2 flex-1">
              <Text className="font-body-md text-body-md text-primary font-bold tracking-wide">Total Weight (KG)</Text>
              <View className="bg-primary/10 rounded-2xl px-4 min-h-[56px] justify-center border-2 border-primary/30 shadow-sm">
                <TextInput placeholderTextColor="#737373"
                  className="bg-transparent font-display-lg text-[28px] font-black text-primary p-0 m-0 flex-1 w-full placeholder:text-on-surface-variant"
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  value={weight}
                  onChangeText={setWeight}
 />
              </View>
            </View>
          </View>
          <View className="flex-col gap-2 mt-4">
            <Text className="font-body-md text-body-md text-on-surface-variant">Rate (₹ per KG)</Text>
            <View className="bg-surface-container-lowest rounded-2xl px-4 min-h-[52px] justify-center border border-outline-variant/30 shadow-sm">
              <TextInput placeholderTextColor="#737373"
                className="bg-transparent font-headline-md-mobile text-headline-md-mobile text-on-surface p-0 m-0 flex-1 w-full placeholder:text-on-surface-variant"
                placeholder="0.00"
                keyboardType="decimal-pad"
                value={rate}
                onChangeText={setRate}
 />
            </View>
          </View>
        </View>

        {/* Payment */}
        <View className="bg-surface-container-lowest rounded-3xl shadow-sm border border-outline-variant/20 p-5 flex-col gap-5 mb-6 relative z-0">
          <View className="flex-row items-center gap-2 border-b border-surface-variant/30 pb-3">
            <MaterialIcons name="payments" size={20} className="text-primary" />
            <Text className="font-label-lg text-label-lg text-on-surface uppercase tracking-wider font-bold">
              Payment
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="pb-2 -mx-4 px-4 snap-x">
            {["Bank Transfer", "UPI", "Cash", "Credit"].map((method) => (
              <Pressable accessibilityRole="button" accessibilityLabel="Button"
                key={method}
                className={`snap-start shrink-0 rounded-full px-5 py-2 mr-2 shadow-sm ${paymentMethod === method ? "bg-primary" : "bg-surface-container"}`}
                onPress={() => setPaymentMethod(method)}
              >
                <Text className={`font-label-md text-label-md ${paymentMethod === method ? "text-on-primary" : "text-on-surface"}`}>
                  {method}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <View className="flex-col gap-2 mt-2">
            <Text className="font-body-md text-body-md text-on-surface-variant">Paid Amount (₹)</Text>
            <View className="bg-surface-container-lowest rounded-2xl px-4 min-h-[52px] justify-center border border-outline-variant/30 shadow-sm">
              <TextInput placeholderTextColor="#737373"
                className="bg-transparent font-headline-md-mobile text-headline-md-mobile text-on-surface p-0 m-0 flex-1 w-full placeholder:text-on-surface-variant"
                placeholder="0.00"
                keyboardType="decimal-pad"
                value={paidAmount}
                onChangeText={setPaidAmount}
 />
            </View>
          </View>

          <View className="flex-row items-center justify-between pt-4 mt-2 border-t border-surface-variant/30">
            <Text className="font-title-md text-title-md text-on-surface font-semibold">Balance Amount</Text>
            <Text className={`font-headline-sm text-headline-sm font-bold ${balanceAmount > 0 ? 'text-error' : 'text-primary'}`}>
              ₹{balanceAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </Text>
          </View>
        </View>

        {/* Remarks */}
        <View className="bg-surface-container-lowest rounded-3xl shadow-sm border border-outline-variant/20 p-5 flex-col gap-5 mb-6 relative z-0">
          <View className="flex-row items-center gap-2 border-b border-surface-variant/30 pb-3">
            <MaterialIcons name="notes" size={20} className="text-primary" />
            <Text className="font-label-lg text-label-lg text-on-surface uppercase tracking-wider font-bold">
              Remarks
            </Text>
          </View>
          <TextInput placeholderTextColor="#737373"
            className="w-full bg-surface-container-lowest rounded-2xl p-4 min-h-[100px] border border-outline-variant/30 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant"
            placeholder="Add any notes here..."
            multiline
            textAlignVertical="top"
            value={remarks}
            onChangeText={setRemarks}
 />
        </View>

        {/* Summary Card */}
        <View className="bg-primary/5 rounded-3xl p-6 flex-col gap-3 mb-6 border border-primary/20 shadow-sm">
          <View className="flex-row items-center gap-2 mb-2">
            <MaterialIcons name="receipt-long" size={24} className="text-primary" />
            <Text className="font-headline-sm text-headline-sm text-primary font-bold">Purchase Summary</Text>
          </View>
          
          <View className="flex-row justify-between items-center py-2 border-b border-primary/10">
            <Text className="font-body-md text-body-md text-on-surface-variant">Farm</Text>
            <Text className="font-body-md text-body-md text-on-surface font-semibold">{selectedFarmName}</Text>
          </View>
          
          <View className="flex-row justify-between items-center py-2 border-b border-primary/10">
            <Text className="font-body-md text-body-md text-on-surface-variant">Total Weight</Text>
            <Text className="font-body-md text-body-md text-on-surface font-semibold">{weightNum.toLocaleString("en-IN", { maximumFractionDigits: 3 })} KG</Text>
          </View>
          
          <View className="flex-row justify-between items-center py-2 border-b border-primary/10">
            <Text className="font-body-md text-body-md text-on-surface-variant">Rate</Text>
            <Text className="font-body-md text-body-md text-on-surface font-semibold">₹{rateNum.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</Text>
          </View>
          
          <View className="flex-row justify-between items-center pt-4 mt-2">
            <Text className="font-title-lg text-title-lg text-on-surface font-bold">Net Payable</Text>
            <Text className="font-display-sm text-display-sm text-primary font-black tracking-tight">₹{netPayable.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</Text>
          </View>
        </View>

      </ScrollView>

      {/* Bottom Actions */}
      <View className="bg-surface/90 border-t border-surface-variant/30 p-4 flex-row gap-4">
        <Pressable accessibilityRole="button" accessibilityLabel="Button" 
          className="flex-1 bg-transparent border-2 border-primary rounded-2xl py-3 items-center justify-center active:bg-primary/5"
          onPress={() => navigation.goBack()}
        >
          <Text className="font-headline-sm text-headline-sm text-primary font-semibold">Cancel</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Button" 
          className="flex-[2] bg-primary rounded-2xl py-3 items-center justify-center active:scale-95 shadow-md shadow-primary/20"
          onPress={onSubmit}
          disabled={loading}
        >
          {loading ? (
             <ActivityIndicator className="text-white" />
          ) : (
            <Text className="font-headline-sm text-headline-sm text-on-primary font-semibold">Save Purchase</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
