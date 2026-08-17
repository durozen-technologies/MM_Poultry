import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../../api/client";
import { DatePickerField } from "../../components/date-picker-field";
import { toApiDate, todayIstDate } from "../../utils/ist-date";
import type { FarmOut } from "../../types/api";

export function AdminFarmPurchaseScreen({ navigation }: { navigation: any }) {
  const [farms, setFarms] = useState<FarmOut[]>([]);
  const [selectedFarm, setSelectedFarm] = useState<string>("");
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

  const fetchFarms = useCallback(async () => {
    try {
      const { data } = await api.get("/admin/farms");
      setFarms(data);
    } catch (e) {
      console.warn("Failed to fetch farms", e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void fetchFarms();
    }, [fetchFarms])
  );

  async function onSubmit() {
    if (!selectedFarm) {
      setError("Please select a farm");
      return;
    }
    if (!weight) {
      setError("Total Weight is required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.post("/admin/farm-loads", {
        farm_id: selectedFarm,
        load_date: toApiDate(purchaseDate),
        bird_count: quantity ? parseInt(quantity, 10) : null,
        loaded_weight_kg: parseFloat(weight),
        rate_per_kg: rateNum > 0 ? rateNum : null,
        total_amount: netPayable > 0 ? netPayable : null,
        paid_amount: paidNum > 0 ? paidNum : null,
        payment_method: paymentMethod,
        remarks: remarks.trim() || null,
      });
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to record farm load");
      setLoading(false);
    }
  }

  const selectedFarmName = farms.find(f => f.id === selectedFarm)?.name || "Select Farm";

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      {/* Header */}
      <View className="h-16 px-4 flex-row items-center bg-surface/90 border-b border-surface-variant/30">
        <Pressable
          className="w-11 h-11 -ml-2 flex items-center justify-center rounded-full active:bg-surface-container"
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#181c20" />
        </Pressable>
        <Text className="font-headline-sm text-headline-sm text-on-surface font-semibold ml-2">
          Farm Purchase
        </Text>
      </View>

      <ScrollView className="flex-1 px-4 py-6 flex-col" contentContainerStyle={{ paddingBottom: 100 }}>
        {error && (
          <Text className="px-4 py-2 mb-4 text-error text-center text-label-md bg-error-container rounded-lg font-semibold">
            {error}
          </Text>
        )}

        {/* Purchase Info */}
        <View className="bg-surface-container-lowest rounded-2xl shadow-sm p-4 flex-col gap-4 mb-6">
          <Text className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider font-semibold">
            Purchase Info
          </Text>

          <View className="flex-col gap-2">
            <Text className="font-body-md text-body-md text-on-surface-variant">Farm</Text>
            <View className="relative z-10">
              <Pressable 
                className="bg-surface-container-lowest rounded-2xl px-4 h-12 flex-row items-center justify-between shadow-sm border border-outline-variant/30 active:bg-surface-container"
                onPress={() => setShowFarmDropdown(!showFarmDropdown)}
              >
                <View className="flex-row items-center gap-3">
                  <MaterialIcons name="agriculture" size={20} color="#5c5f60" />
                  <Text className={`font-body-lg text-body-lg ${selectedFarm ? 'text-on-surface' : 'text-secondary'}`}>
                    {selectedFarmName}
                  </Text>
                </View>
                <MaterialIcons name={showFarmDropdown ? "arrow-drop-up" : "arrow-drop-down"} size={24} color="#414844" />
              </Pressable>
              
              {showFarmDropdown && (
                <View className="absolute top-14 left-0 right-0 bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/30 z-50 max-h-48 overflow-hidden">
                  <ScrollView nestedScrollEnabled>
                    {farms.map((farm) => (
                      <Pressable 
                        key={farm.id}
                        className="px-4 py-3 border-b border-surface-variant/50 active:bg-surface-container"
                        onPress={() => {
                          setSelectedFarm(farm.id);
                          setShowFarmDropdown(false);
                        }}
                      >
                        <Text className="font-body-md text-on-surface">{farm.name}</Text>
                      </Pressable>
                    ))}
                    {farms.length === 0 && (
                      <Text className="p-4 text-center text-on-surface-variant">No farms found.</Text>
                    )}
                  </ScrollView>
                </View>
              )}
            </View>
          </View>

          <View className="flex-col gap-2 relative z-0">
            <DatePickerField label="Purchase Date" value={purchaseDate} onChange={setPurchaseDate} />
          </View>
        </View>

        {/* Bird & Weight */}
        <View className="bg-surface-container-lowest rounded-2xl shadow-sm p-4 flex-col gap-4 mb-6 relative z-0">
          <Text className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider font-semibold">
            Bird & Weight
          </Text>
          
          <View className="flex-row gap-4">
            <View className="flex-col gap-2 flex-1">
              <Text className="font-body-md text-body-md text-on-surface-variant">Quantity (Birds)</Text>
              <View className="bg-surface-container-lowest rounded-2xl px-4 py-2 border border-outline-variant/30 shadow-sm">
                <TextInput
                  className="bg-transparent font-headline-md-mobile text-headline-md-mobile text-on-surface h-10 w-full"
                  placeholder="0"
                  placeholderTextColor="#c5c7c8"
                  keyboardType="number-pad"
                  value={quantity}
                  onChangeText={setQuantity}
                />
              </View>
            </View>
            
            <View className="flex-col gap-2 flex-1">
              <Text className="font-body-md text-body-md text-primary font-semibold">Total Weight (KG)</Text>
              <View className="bg-primary/5 rounded-2xl px-4 py-2 border border-primary/20 shadow-sm">
                <TextInput
                  className="bg-transparent font-display-lg text-[24px] font-bold text-primary h-10 w-full"
                  placeholder="0.00"
                  placeholderTextColor="#a5d0b9"
                  keyboardType="decimal-pad"
                  value={weight}
                  onChangeText={setWeight}
                />
              </View>
            </View>
          </View>
          <View className="flex-col gap-2 mt-4">
            <Text className="font-body-md text-body-md text-on-surface-variant">Rate (₹ per KG)</Text>
            <View className="bg-surface-container-lowest rounded-2xl px-4 py-2 border border-outline-variant/30 shadow-sm">
              <TextInput
                className="bg-transparent font-headline-md-mobile text-headline-md-mobile text-on-surface h-10 w-full"
                placeholder="0.00"
                placeholderTextColor="#c5c7c8"
                keyboardType="decimal-pad"
                value={rate}
                onChangeText={setRate}
              />
            </View>
          </View>
        </View>

        {/* Payment */}
        <View className="bg-surface-container-lowest rounded-2xl shadow-sm p-4 flex-col gap-4 mb-6 relative z-0">
          <Text className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider font-semibold">
            Payment
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="pb-2 -mx-4 px-4 snap-x">
            {["Bank Transfer", "UPI", "Cash", "Credit"].map((method) => (
              <Pressable
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
            <View className="bg-surface-container-lowest rounded-2xl px-4 py-2 border border-outline-variant/30 shadow-sm">
              <TextInput
                className="bg-transparent font-headline-md-mobile text-headline-md-mobile text-on-surface h-10 w-full"
                placeholder="0.00"
                placeholderTextColor="#c5c7c8"
                keyboardType="decimal-pad"
                value={paidAmount}
                onChangeText={setPaidAmount}
              />
            </View>
          </View>

          <View className="flex-row items-center justify-between pt-2">
            <Text className="font-body-lg text-body-lg text-on-surface-variant">Balance Amount</Text>
            <Text className="font-headline-md-mobile text-headline-md-mobile text-error">
              ₹{balanceAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </Text>
          </View>
        </View>

        {/* Remarks */}
        <View className="bg-surface-container-lowest rounded-2xl shadow-sm p-4 flex-col gap-4 mb-6 relative z-0">
          <Text className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider font-semibold">
            Remarks
          </Text>
          <TextInput
            className="w-full bg-surface-container-lowest rounded-2xl p-4 min-h-[100px] border border-outline-variant/30 font-body-md text-body-md text-on-surface"
            placeholder="Add any notes here..."
            placeholderTextColor="#717973"
            multiline
            textAlignVertical="top"
            value={remarks}
            onChangeText={setRemarks}
          />
        </View>

        {/* Summary Card */}
        <View className="bg-surface-container rounded-2xl p-4 flex-col gap-2 mb-6">
          <Text className="font-headline-sm text-headline-sm text-on-surface mb-2 font-semibold">Summary</Text>
          
          <View className="flex-row justify-between items-center py-2 border-b border-surface-variant/50">
            <Text className="font-body-md text-body-md text-on-surface-variant">Farm</Text>
            <Text className="font-body-md text-body-md text-on-surface font-semibold">{selectedFarmName}</Text>
          </View>
          
          <View className="flex-row justify-between items-center py-2 border-b border-surface-variant/50">
            <Text className="font-body-md text-body-md text-on-surface-variant">Total Weight</Text>
            <Text className="font-body-md text-body-md text-on-surface font-semibold">{weightNum.toLocaleString("en-IN", { maximumFractionDigits: 3 })} KG</Text>
          </View>
          
          <View className="flex-row justify-between items-center py-2 border-b border-surface-variant/50">
            <Text className="font-body-md text-body-md text-on-surface-variant">Rate</Text>
            <Text className="font-body-md text-body-md text-on-surface font-semibold">₹{rateNum.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</Text>
          </View>
          
          <View className="flex-row justify-between items-center pt-2">
            <Text className="font-body-lg text-body-lg text-on-surface font-bold">Net Payable</Text>
            <Text className="font-headline-sm text-headline-sm text-primary font-bold">₹{netPayable.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</Text>
          </View>
        </View>

      </ScrollView>

      {/* Sticky Bottom Actions */}
      <View className="absolute bottom-0 left-0 right-0 bg-surface/90 border-t border-surface-variant/30 p-4 flex-row gap-4 z-40">
        <Pressable 
          className="flex-1 bg-transparent border-2 border-primary rounded-2xl py-3 items-center justify-center active:bg-primary/5"
          onPress={() => navigation.goBack()}
        >
          <Text className="font-headline-sm text-headline-sm text-primary font-semibold">Cancel</Text>
        </Pressable>
        <Pressable 
          className="flex-[2] bg-primary rounded-2xl py-3 items-center justify-center active:scale-95 shadow-md shadow-primary/20"
          onPress={onSubmit}
          disabled={loading}
        >
          {loading ? (
             <ActivityIndicator color="#ffffff" />
          ) : (
            <Text className="font-headline-sm text-headline-sm text-on-primary font-semibold">Save Purchase</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
