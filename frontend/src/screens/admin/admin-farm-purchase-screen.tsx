import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
  ScrollView,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";

import { api } from "../../api/client";
import { DatePickerField } from "../../components/date-picker-field";
import { toApiDate, todayIstDate, parseIstDate } from "../../utils/ist-date";
import type { FarmOut, Item } from "../../types/api";

import { AdminScreenContainer } from "../../components/admin/admin-screen-container";
import { AdminHeader } from "../../components/admin/admin-header";
import { AdminCard } from "../../components/admin/admin-card";
import { AdminActionFooter } from "../../components/admin/admin-action-footer";

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
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [paidAmount, setPaidAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dropdown states
  const [showFarmDropdown, setShowFarmDropdown] = useState(false);
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);
  const [showItemDropdown, setShowItemDropdown] = useState(false);

  // Derived values
  const weightNum = parseFloat(weight) || 0;
  const rateNum = parseFloat(rate) || 0;
  const netPayable = weightNum * rateNum;
  const paidNum = parseFloat(paidAmount) || 0;
  const balanceAmount = netPayable - paidNum;

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
        setPaymentMethod(loadData.payment_method || "UPI");
        setPaidAmount(loadData.paid_amount != null ? String(loadData.paid_amount) : "");
        setRemarks(loadData.remarks || "");
      }
    } catch (e) {
      console.warn("Failed to fetch data", e);
    }
  }, [loadId]);

  useFocusEffect(
    useCallback(() => {
      void fetchData();
    }, [fetchData])
  );

  async function onSubmit() {
    if (!selectedFarm) return setError("Please select a farm");
    if (!selectedItem) return setError("Please select an item");
    if (!weight) return setError("Total Weight is required");
    const w = parseFloat(weight);
    if (!Number.isFinite(w) || w <= 0) return setError("Weight must be a positive number");
    
    if (selectedVehicle) {
      const v = vehicles.find((x) => x.id === selectedVehicle);
      if (v?.capacity_kg && w > parseFloat(v.capacity_kg)) {
        return setError(`Weight ${w}kg exceeds vehicle capacity ${v.capacity_kg}kg`);
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
    <AdminScreenContainer
      header={
        <AdminHeader 
          title={isEditing ? "Edit Purchase" : "New Purchase"} 
          subtitle="Record a new farm load securely"
          onBack={() => navigation.goBack()} 
        />
      }
    >
      {error && (
        <View className="bg-error-container/90 px-4 py-3 rounded-xl flex-row items-center mb-4">
          <MaterialIcons name="error-outline" size={20} className="text-on-error-container mr-2" />
          <Text className="text-on-error-container text-body-sm font-medium flex-1">{error}</Text>
        </View>
      )}

      {/* Logistics Card */}
      <AdminCard title="Logistics" icon="local-shipping" containerClass="z-50">
        <View className="flex-col gap-4">
          <View className="relative z-50">
            <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1">Farm Source <Text className="text-error">*</Text></Text>
            <Pressable
              className="h-14 border border-outline-variant/50 rounded-xl px-4 flex-row items-center justify-between bg-surface-container-lowest active:bg-surface-variant/30"
              onPress={() => setShowFarmDropdown(!showFarmDropdown)}
            >
              <Text className={`text-body-lg font-medium ${selectedFarm ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                {selectedFarmName}
              </Text>
              <MaterialIcons name="keyboard-arrow-down" size={24} className="text-on-surface-variant" />
            </Pressable>
            {showFarmDropdown && (
              <View className="absolute top-[80px] left-0 right-0 bg-surface-container-highest border border-outline-variant/30 rounded-xl shadow-lg z-50 max-h-48 overflow-hidden elevation-md">
                <ScrollView nestedScrollEnabled>
                  {farms.length > 0 ? (
                    farms.map((farm) => (
                      <Pressable
                        key={farm.id}
                        className="px-5 py-4 border-b border-outline-variant/20 active:bg-surface-variant/50"
                        onPress={() => { setSelectedFarm(farm.id); setShowFarmDropdown(false); }}
                      >
                        <Text className="text-on-surface font-medium text-body-lg">{farm.name}</Text>
                      </Pressable>
                    ))
                  ) : (
                    <Text className="p-5 text-center text-on-surface-variant text-body-md">No farms available</Text>
                  )}
                </ScrollView>
              </View>
            )}
          </View>

          <View className="flex-row gap-4 z-40">
            <View className="flex-1 relative z-40">
              <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1">Vehicle</Text>
              <Pressable
                className="h-14 border border-outline-variant/50 rounded-xl px-4 flex-row items-center justify-between bg-surface-container-lowest active:bg-surface-variant/30"
                onPress={() => setShowVehicleDropdown(!showVehicleDropdown)}
              >
                <Text className={`text-body-md font-medium ${selectedVehicle ? 'text-on-surface' : 'text-on-surface-variant'}`} numberOfLines={1}>
                  {vehicles.find((v) => v.id === selectedVehicle)?.number || "Optional"}
                </Text>
                <MaterialIcons name="keyboard-arrow-down" size={20} className="text-on-surface-variant" />
              </Pressable>
              {showVehicleDropdown && (
                <View className="absolute top-[80px] left-0 right-0 bg-surface-container-highest border border-outline-variant/30 rounded-xl shadow-lg z-50 max-h-48 overflow-hidden elevation-md">
                  <ScrollView nestedScrollEnabled>
                    <Pressable
                      className="px-5 py-4 border-b border-outline-variant/20 active:bg-surface-variant/50"
                      onPress={() => { setSelectedVehicle(""); setShowVehicleDropdown(false); }}
                    >
                      <Text className="text-on-surface-variant font-medium text-body-md">— None —</Text>
                    </Pressable>
                    {vehicles.map((v) => (
                      <Pressable
                        key={v.id}
                        className="px-5 py-4 border-b border-outline-variant/20 active:bg-surface-variant/50"
                        onPress={() => { setSelectedVehicle(v.id); setShowVehicleDropdown(false); }}
                      >
                        <Text className="text-on-surface font-medium text-body-md">{v.number}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            <View className="flex-1 z-30">
              <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1">Date</Text>
              <DatePickerField 
                value={purchaseDate} 
                onChange={setPurchaseDate} 
                maximumDate={new Date()} 
                containerStyle=""
                inputStyle="h-14 border border-outline-variant/50 rounded-xl px-4 bg-surface-container-lowest"
                showIcon={false}
              />
            </View>
          </View>
        </View>
      </AdminCard>

      {/* Load Details Card */}
      <AdminCard title="Load Details" icon="scale" iconColorClass="text-tertiary" iconBgClass="bg-tertiary/10" containerClass="z-20">
        <View className="flex-col gap-4">
          <View className="relative z-20">
            <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1">Item <Text className="text-error">*</Text></Text>
            <Pressable
              className="h-14 border border-outline-variant/50 rounded-xl px-4 flex-row items-center justify-between bg-surface-container-lowest active:bg-surface-variant/30"
              onPress={() => setShowItemDropdown(!showItemDropdown)}
            >
              <Text className={`text-body-lg font-medium ${selectedItem ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                {selectedItemName}
              </Text>
              <MaterialIcons name="keyboard-arrow-down" size={24} className="text-on-surface-variant" />
            </Pressable>
            {showItemDropdown && (
              <View className="absolute top-[80px] left-0 right-0 bg-surface-container-highest border border-outline-variant/30 rounded-xl shadow-lg z-50 max-h-48 overflow-hidden elevation-md">
                <ScrollView nestedScrollEnabled>
                  {items.map((item) => (
                    <Pressable
                      key={item.id}
                      className="px-5 py-4 border-b border-outline-variant/20 active:bg-surface-variant/50"
                      onPress={() => { setSelectedItem(item.id); setShowItemDropdown(false); }}
                    >
                      <Text className="text-on-surface font-medium text-body-lg">{item.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          <View className="flex-row gap-4">
            <View className="flex-1">
              <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1">Quantity (Boxes)</Text>
              <TextInput
                className="h-14 border border-outline-variant/50 rounded-xl px-4 text-body-lg text-on-surface font-medium bg-surface-container-lowest focus:border-primary"
                placeholder="0"
                placeholderTextColor="#9ca3af"
                keyboardType="number-pad"
                value={quantity}
                onChangeText={setQuantity}
              />
            </View>
            <View className="flex-1">
              <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1">Total Weight (KG) <Text className="text-error">*</Text></Text>
              <TextInput
                className="h-14 border border-outline-variant/50 rounded-xl px-4 text-body-lg text-on-surface font-medium bg-surface-container-lowest focus:border-primary"
                placeholder="0.00"
                placeholderTextColor="#9ca3af"
                keyboardType="decimal-pad"
                value={weight}
                onChangeText={setWeight}
              />
            </View>
          </View>
          <View className="w-1/2 pr-2">
            <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1">Rate (₹ / KG)</Text>
            <TextInput
              className="h-14 border border-outline-variant/50 rounded-xl px-4 text-body-lg text-on-surface font-medium bg-surface-container-lowest focus:border-primary"
              placeholder="0.00"
              placeholderTextColor="#9ca3af"
              keyboardType="decimal-pad"
              value={rate}
              onChangeText={setRate}
            />
          </View>
        </View>
      </AdminCard>

      {/* Payment Card */}
      <AdminCard title="Payment" icon="payments" iconColorClass="text-secondary" iconBgClass="bg-secondary/10" containerClass="z-10">
        <View className="flex-col gap-5">
          <View>
            <Text className="text-on-surface-variant text-label-md font-semibold mb-2 ml-1">Method</Text>
            <View className="flex-row gap-3">
              {["UPI", "Cash"].map((method) => (
                <Pressable
                  key={method}
                  className={`h-12 rounded-xl border flex-row items-center justify-center px-6 flex-1 active:scale-95 transition-colors ${
                    paymentMethod === method 
                      ? "border-primary bg-primary-container/20" 
                      : "border-outline-variant/50 bg-surface-container-lowest"
                  }`}
                  onPress={() => setPaymentMethod(method)}
                >
                  <Text className={`font-semibold text-body-md ${
                    paymentMethod === method ? "text-primary" : "text-on-surface-variant"
                  }`}>
                    {method}
                  </Text>
                  {paymentMethod === method && (
                    <View className="absolute right-3 bg-white rounded-full">
                      <MaterialIcons name="check-circle" size={16} className="text-primary" />
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          </View>

          <View className="flex-row gap-4">
            <View className="flex-1">
              <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1">Amount Paid (₹)</Text>
              <TextInput
                className="h-14 border border-outline-variant/50 rounded-xl px-4 text-body-lg text-on-surface font-medium bg-surface-container-lowest focus:border-primary"
                placeholder="0.00"
                placeholderTextColor="#9ca3af"
                keyboardType="decimal-pad"
                value={paidAmount}
                onChangeText={setPaidAmount}
              />
            </View>
            <View className="flex-1">
              <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1">Balance</Text>
              <View className="h-14 bg-error-container/20 rounded-xl px-4 justify-center border border-error-container/30">
                <Text className="text-on-surface font-bold text-body-lg">
                  ₹{balanceAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                </Text>
              </View>
            </View>
          </View>

          <View>
            <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1">Remarks</Text>
            <TextInput
              className="h-24 border border-outline-variant/50 rounded-xl px-4 py-3 text-body-md text-on-surface bg-surface-container-lowest focus:border-primary"
              placeholder="Optional notes..."
              placeholderTextColor="#9ca3af"
              multiline
              textAlignVertical="top"
              value={remarks}
              onChangeText={setRemarks}
            />
          </View>
        </View>
      </AdminCard>

      <AdminActionFooter
        primaryLabel={isEditing ? "Update Purchase" : "Confirm Purchase"}
        primaryIcon={isEditing ? "update" : "check-circle"}
        onPrimaryPress={onSubmit}
        isPrimaryLoading={loading}
        leftContent={
          <View>
            <Text className="text-on-surface-variant text-label-lg font-medium mb-1">Net Payable</Text>
            <Text className="text-primary font-headline-md font-bold">
              ₹{netPayable > 0 ? netPayable.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "0.00"}
            </Text>
          </View>
        }
        rightContent={
          <View className="items-end">
            <Text className="text-on-surface-variant text-label-md font-medium mb-1">{weightNum > 0 ? weightNum.toLocaleString("en-IN", { maximumFractionDigits: 3 }) : "0"} kg</Text>
            <Text className="text-on-surface-variant text-label-md font-medium">@ ₹{rateNum > 0 ? rateNum.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "0"}</Text>
          </View>
        }
      />
    </AdminScreenContainer>
  );
}
