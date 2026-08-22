import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { getRetailer, updateRetailer } from "../../api/retailers";
import type { Retailer } from "../../types/api";

export function AdminRetailerEditScreen({ route, navigation }: { route: any; navigation: any }) {
  const { retailerId } = route.params;
  const [retailer, setRetailer] = useState<Retailer | null>(null);
  
  const [name, setName] = useState("");
  const [shopName, setShopName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");
  
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [alternatePhone, setAlternatePhone] = useState("");
  
  const [address, setAddress] = useState("");
  const [area, setArea] = useState("");
  const [routeName, setRouteName] = useState("");
  const [preferredDeliveryTime, setPreferredDeliveryTime] = useState("");
  
  const [creditLimit, setCreditLimit] = useState("");
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getRetailer(retailerId);
      setRetailer(data);
      setName(data.name);
      setShopName(data.shop_name || "");
      setOwnerName(data.owner_name || "");
      setCategory(data.category || "");
      setNotes(data.notes || "");
      setPhone(data.phone || "");
      setWhatsapp(data.whatsapp || "");
      setAlternatePhone(data.alternate_phone || "");
      setAddress(data.address || "");
      setArea(data.area || "");
      setRouteName(data.route_name || "");
      setPreferredDeliveryTime(data.preferred_delivery_time || "");
      setCreditLimit(data.credit_limit || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load retailer");
    } finally {
      setLoading(false);
    }
  }, [retailerId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function onSave() {
    if (!name.trim() || !phone.trim()) {
      setError("Name and Phone are required");
      return;
    }
    if (phone.trim().length < 10) {
      setError("Phone number must be at least 10 digits");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateRetailer(retailerId, {
        name: name.trim(),
        shop_name: shopName.trim() || null,
        owner_name: ownerName.trim() || null,
        category: category.trim() || null,
        notes: notes.trim() || null,
        phone: phone.trim() || null,
        whatsapp: whatsapp.trim() || null,
        alternate_phone: alternatePhone.trim() || null,
        address: address.trim() || null,
        area: area.trim() || null,
        route_name: routeName.trim() || null,
        preferred_delivery_time: preferredDeliveryTime.trim() || null,
        credit_limit: creditLimit ? parseFloat(creditLimit) : undefined,
      });
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
      setSaving(false);
    }
  }

  if (loading || !retailer) {
    return (
      <SafeAreaView className="flex-1 max-w-3xl mx-auto w-full bg-background items-center justify-center">
        <ActivityIndicator className="text-primary" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 max-w-3xl mx-auto w-full bg-background" edges={["top", "bottom"]}>
      {/* Header */}
      <View className="h-16 px-4 flex-row items-center bg-surface/90 border-b border-outline-variant/10">
        <Pressable accessibilityRole="button" accessibilityLabel="Button"
          className="w-11 h-11 -ml-2 flex items-center justify-center rounded-full active:bg-surface-variant/50 mr-2"
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} className="text-on-surface" />
        </Pressable>
        <Text className="font-headline-sm text-headline-sm text-primary font-semibold">
          Edit Retailer
        </Text>
      </View>

      <ScrollView className="flex-1 px-4 py-6 flex-col" contentContainerStyle={{ paddingBottom: 120 }}>
        {error && (
          <Text className="px-4 py-2 mb-4 text-error text-center text-label-md bg-error-container rounded-lg font-semibold">
            {error}
          </Text>
        )}

        {/* Basic Details Card */}
        <View className="bg-surface-container-lowest rounded-xl shadow-sm p-4 flex-col gap-4 border border-outline-variant/30 mb-6">
          <View className="flex-row items-center gap-2">
            <MaterialIcons name="storefront" size={20} className="text-primary" />
            <Text className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Basic Details
            </Text>
          </View>
          
          <View className="flex-col gap-2">
            <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
              Company / Business Name <Text className="text-error">*</Text>
            </Text>
            <TextInput placeholderTextColor="#737373"
              className="w-full bg-surface h-12 rounded-lg border border-surface-variant px-4 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant"
              placeholder="Enter Retailer/Company Name"
              value={name}
              onChangeText={setName}
            />
          </View>

          <View className="flex-col gap-2">
            <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
              Shop Name
            </Text>
            <TextInput placeholderTextColor="#737373"
              className="w-full bg-surface h-12 rounded-lg border border-surface-variant px-4 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant"
              placeholder="e.g. SR Chicken Center"
              value={shopName}
              onChangeText={setShopName}
            />
          </View>

          <View className="flex-col gap-2">
            <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
              Owner Name
            </Text>
            <View className="relative flex-row items-center">
              <View className="absolute left-3 z-10">
                <MaterialIcons name="person" size={18} className="text-on-surface-variant" />
              </View>
              <TextInput placeholderTextColor="#737373"
                className="w-full bg-surface h-12 rounded-lg border border-surface-variant pl-10 pr-4 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant"
                placeholder="Enter owner name"
                value={ownerName}
                onChangeText={setOwnerName}
              />
            </View>
          </View>

          <View className="flex-col gap-2">
            <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
              Category
            </Text>
            <TextInput placeholderTextColor="#737373"
              className="w-full bg-surface h-12 rounded-lg border border-surface-variant px-4 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant"
              placeholder="e.g. Wholesale, Retail"
              value={category}
              onChangeText={setCategory}
            />
          </View>

          <View className="flex-col gap-2">
            <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
              Notes / Remarks
            </Text>
            <TextInput placeholderTextColor="#737373"
              className="w-full bg-surface rounded-lg border border-surface-variant p-4 font-body-md text-body-md text-on-surface min-h-[80px] placeholder:text-on-surface-variant"
              placeholder="Any additional notes..."
              multiline
              textAlignVertical="top"
              value={notes}
              onChangeText={setNotes}
            />
          </View>
        </View>

        {/* Contact Details Card */}
        <View className="bg-surface-container-lowest rounded-xl shadow-sm p-4 flex-col gap-4 border border-outline-variant/30 mb-6">
          <View className="flex-row items-center gap-2">
            <MaterialIcons name="contacts" size={20} className="text-primary" />
            <Text className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Contact Details
            </Text>
          </View>

          <View className="flex-col gap-2">
            <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
              Primary Phone <Text className="text-error">*</Text>
            </Text>
            <View className="relative flex-row items-center">
              <View className="absolute left-3 z-10">
                <MaterialIcons name="phone-iphone" size={18} className="text-on-surface-variant" />
              </View>
              <TextInput placeholderTextColor="#737373"
                className="w-full bg-surface h-12 rounded-lg border border-surface-variant pl-10 pr-4 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant"
                placeholder="10-digit primary number"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
            </View>
          </View>

          <View className="flex-col gap-2">
            <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
              WhatsApp
            </Text>
            <View className="relative flex-row items-center">
              <View className="absolute left-3 z-10">
                <MaterialIcons name="chat" size={18} className="text-on-surface-variant" />
              </View>
              <TextInput placeholderTextColor="#737373"
                className="w-full bg-surface h-12 rounded-lg border border-surface-variant pl-10 pr-4 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant"
                placeholder="WhatsApp number"
                keyboardType="phone-pad"
                value={whatsapp}
                onChangeText={setWhatsapp}
              />
            </View>
          </View>

          <View className="flex-col gap-2">
            <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
              Alternate Phone
            </Text>
            <View className="relative flex-row items-center">
              <View className="absolute left-3 z-10">
                <MaterialIcons name="phone" size={18} className="text-on-surface-variant" />
              </View>
              <TextInput placeholderTextColor="#737373"
                className="w-full bg-surface h-12 rounded-lg border border-surface-variant pl-10 pr-4 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant"
                placeholder="Other phone number"
                keyboardType="phone-pad"
                value={alternatePhone}
                onChangeText={setAlternatePhone}
              />
            </View>
          </View>
        </View>

        {/* Location & Delivery Card */}
        <View className="bg-surface-container-lowest rounded-xl shadow-sm p-4 flex-col gap-4 border border-outline-variant/30 mb-6">
          <View className="flex-row items-center gap-2">
            <MaterialIcons name="location-on" size={20} className="text-primary" />
            <Text className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Location & Delivery
            </Text>
          </View>

          <View className="flex-col gap-2">
            <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
              Area
            </Text>
            <TextInput placeholderTextColor="#737373"
              className="w-full bg-surface h-12 rounded-lg border border-surface-variant px-4 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant"
              placeholder="e.g. Downtown"
              value={area}
              onChangeText={setArea}
            />
          </View>

          <View className="flex-col gap-2">
            <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
              Route Name
            </Text>
            <TextInput placeholderTextColor="#737373"
              className="w-full bg-surface h-12 rounded-lg border border-surface-variant px-4 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant"
              placeholder="e.g. Route A"
              value={routeName}
              onChangeText={setRouteName}
            />
          </View>

          <View className="flex-col gap-2">
            <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
              Preferred Delivery Time
            </Text>
            <TextInput placeholderTextColor="#737373"
              className="w-full bg-surface h-12 rounded-lg border border-surface-variant px-4 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant"
              placeholder="e.g. Morning 6 AM"
              value={preferredDeliveryTime}
              onChangeText={setPreferredDeliveryTime}
            />
          </View>

          <View className="flex-col gap-2">
            <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
              Full Address
            </Text>
            <TextInput placeholderTextColor="#737373"
              className="w-full bg-surface rounded-lg border border-surface-variant p-4 font-body-md text-body-md text-on-surface min-h-[100px] placeholder:text-on-surface-variant"
              placeholder="Enter complete address"
              multiline
              textAlignVertical="top"
              value={address}
              onChangeText={setAddress}
            />
          </View>
        </View>

        {/* Financial Details Card */}
        <View className="bg-surface-container-lowest rounded-xl shadow-sm p-4 flex-col gap-4 border border-outline-variant/30 mb-6">
          <View className="flex-row items-center gap-2">
            <MaterialIcons name="payments" size={20} className="text-primary" />
            <Text className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Financial Details
            </Text>
          </View>

          <View className="flex-col gap-2">
            <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
              Credit Limit (₹)
            </Text>
            <TextInput placeholderTextColor="#737373"
              className="w-full bg-surface h-12 rounded-lg border border-surface-variant px-4 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant"
              placeholder="e.g. 50000"
              keyboardType="decimal-pad"
              value={creditLimit}
              onChangeText={setCreditLimit}
            />
          </View>
        </View>
      </ScrollView>

      {/* Floating Save Button Area */}
      <View className="absolute bottom-0 left-0 right-0 bg-surface/95 border-t border-outline-variant/20 p-4 pb-8">
        <Pressable accessibilityRole="button" accessibilityLabel="Button"
          className="w-full bg-primary h-14 rounded-2xl flex-row items-center justify-center active:scale-95"
          onPress={onSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator className="text-white" />
          ) : (
            <>
              <MaterialIcons name="save" size={20} className="text-white" />
              <Text className="font-label-md text-label-md text-on-primary font-semibold ml-2">
                Save Changes
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
