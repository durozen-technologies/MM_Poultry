import { useState } from "react";
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
import { api } from "../../api/client";

export function AdminAddRetailerScreen({ navigation }: { navigation: any }) {
  const [name, setName] = useState("");
  const [shopName, setShopName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [alternatePhone, setAlternatePhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [address, setAddress] = useState("");
  const [area, setArea] = useState("");
  const [routeName, setRouteName] = useState("");
  const [category, setCategory] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [preferredDeliveryTime, setPreferredDeliveryTime] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    if (!name.trim() || !phone.trim()) {
      setError("Please fill required fields (Name, Primary Phone)");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.post("/admin/retailers", {
        name: name.trim(),
        shop_name: shopName.trim() || null,
        owner_name: ownerName.trim() || null,
        phone: phone.trim() || null,
        alternate_phone: alternatePhone.trim() || null,
        whatsapp: whatsapp.trim() || null,
        address: address.trim() || null,
        area: area.trim() || null,
        route_name: routeName.trim() || null,
        category: category.trim() || null,
        credit_limit: creditLimit ? parseFloat(creditLimit) : 0,
        preferred_delivery_time: preferredDeliveryTime.trim() || null,
      });
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create retailer");
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      {/* Header */}
      <View className="h-16 px-4 flex-row items-center bg-surface/80">
        <Pressable
          className="w-11 h-11 -ml-2 flex items-center justify-center rounded-full active:bg-surface-variant/50 mr-2"
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#181c20" />
        </Pressable>
        <Text className="font-headline-sm text-headline-sm text-primary font-semibold">
          Add Retailer
        </Text>
      </View>

      <ScrollView className="flex-1 px-4 py-6 flex-col" contentContainerStyle={{ paddingBottom: 100 }}>
        {error && (
          <Text className="px-4 py-2 mb-4 text-error text-center text-label-md bg-error-container rounded-lg">
            {error}
          </Text>
        )}

        {/* Basic Details Card */}
        <View className="bg-surface-container-lowest rounded-xl shadow-sm p-4 flex-col gap-4 border border-outline-variant/30 mb-6">
          <View className="flex-row items-center gap-2">
            <MaterialIcons name="storefront" size={20} color="#012d1d" />
            <Text className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Basic Details
            </Text>
          </View>
          
          <View className="flex-col gap-2">
            <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
              Company / Business Name <Text className="text-error">*</Text>
            </Text>
            <TextInput
              className="w-full bg-surface h-12 rounded-lg border border-surface-variant px-4 font-body-md text-body-md text-on-surface"
              placeholder="Enter Retailer/Company Name"
              placeholderTextColor="#717973"
              value={name}
              onChangeText={setName}
            />
          </View>

          <View className="flex-col gap-2">
            <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
              Shop Name
            </Text>
            <TextInput
              className="w-full bg-surface h-12 rounded-lg border border-surface-variant px-4 font-body-md text-body-md text-on-surface"
              placeholder="e.g. SR Chicken Center"
              placeholderTextColor="#717973"
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
                <MaterialIcons name="person" size={18} color="#717973" />
              </View>
              <TextInput
                className="w-full bg-surface h-12 rounded-lg border border-surface-variant pl-10 pr-4 font-body-md text-body-md text-on-surface"
                placeholder="Enter owner name"
                placeholderTextColor="#717973"
                value={ownerName}
                onChangeText={setOwnerName}
              />
            </View>
          </View>

          <View className="flex-col gap-2">
            <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
              Category
            </Text>
            <TextInput
              className="w-full bg-surface h-12 rounded-lg border border-surface-variant px-4 font-body-md text-body-md text-on-surface"
              placeholder="e.g. Wholesale, Retail"
              placeholderTextColor="#717973"
              value={category}
              onChangeText={setCategory}
            />
          </View>
        </View>

        {/* Contact Details Card */}
        <View className="bg-surface-container-lowest rounded-xl shadow-sm p-4 flex-col gap-4 border border-outline-variant/30 mb-6">
          <View className="flex-row items-center gap-2">
            <MaterialIcons name="contacts" size={20} color="#012d1d" />
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
                <MaterialIcons name="phone-iphone" size={18} color="#717973" />
              </View>
              <TextInput
                className="w-full bg-surface h-12 rounded-lg border border-surface-variant pl-10 pr-4 font-body-md text-body-md text-on-surface"
                placeholder="10-digit primary number"
                placeholderTextColor="#717973"
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
                <MaterialIcons name="chat" size={18} color="#717973" />
              </View>
              <TextInput
                className="w-full bg-surface h-12 rounded-lg border border-surface-variant pl-10 pr-4 font-body-md text-body-md text-on-surface"
                placeholder="WhatsApp number"
                placeholderTextColor="#717973"
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
                <MaterialIcons name="phone" size={18} color="#717973" />
              </View>
              <TextInput
                className="w-full bg-surface h-12 rounded-lg border border-surface-variant pl-10 pr-4 font-body-md text-body-md text-on-surface"
                placeholder="Other phone number"
                placeholderTextColor="#717973"
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
            <MaterialIcons name="location-on" size={20} color="#012d1d" />
            <Text className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Location & Delivery
            </Text>
          </View>

          <View className="flex-col gap-2">
            <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
              Area
            </Text>
            <TextInput
              className="w-full bg-surface h-12 rounded-lg border border-surface-variant px-4 font-body-md text-body-md text-on-surface"
              placeholder="e.g. Downtown"
              placeholderTextColor="#717973"
              value={area}
              onChangeText={setArea}
            />
          </View>

          <View className="flex-col gap-2">
            <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
              Route Name
            </Text>
            <TextInput
              className="w-full bg-surface h-12 rounded-lg border border-surface-variant px-4 font-body-md text-body-md text-on-surface"
              placeholder="e.g. Route A"
              placeholderTextColor="#717973"
              value={routeName}
              onChangeText={setRouteName}
            />
          </View>

          <View className="flex-col gap-2">
            <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
              Preferred Delivery Time
            </Text>
            <TextInput
              className="w-full bg-surface h-12 rounded-lg border border-surface-variant px-4 font-body-md text-body-md text-on-surface"
              placeholder="e.g. Morning 6 AM"
              placeholderTextColor="#717973"
              value={preferredDeliveryTime}
              onChangeText={setPreferredDeliveryTime}
            />
          </View>

          <View className="flex-col gap-2">
            <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
              Full Address
            </Text>
            <TextInput
              className="w-full bg-surface rounded-lg border border-surface-variant p-4 font-body-md text-body-md text-on-surface min-h-[100px]"
              placeholder="Enter complete address"
              placeholderTextColor="#717973"
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
            <MaterialIcons name="payments" size={20} color="#012d1d" />
            <Text className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Financial Details
            </Text>
          </View>

          <View className="flex-col gap-2">
            <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
              Credit Limit (₹)
            </Text>
            <TextInput
              className="w-full bg-surface h-12 rounded-lg border border-surface-variant px-4 font-body-md text-body-md text-on-surface"
              placeholder="e.g. 50000"
              placeholderTextColor="#717973"
              keyboardType="decimal-pad"
              value={creditLimit}
              onChangeText={setCreditLimit}
            />
          </View>
        </View>

        <Pressable
          className="w-full bg-primary h-14 rounded-2xl flex-row items-center justify-center active:scale-95 mb-6"
          onPress={onSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <MaterialIcons name="save" size={20} color="#ffffff" />
              <Text className="font-label-md text-label-md text-on-primary font-semibold ml-2">
                Save Retailer
              </Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
