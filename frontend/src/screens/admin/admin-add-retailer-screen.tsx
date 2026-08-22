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
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";

export function AdminAddRetailerScreen({ navigation }: { navigation: any }) {
  const queryClient = useQueryClient();
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
  const [notes, setNotes] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [preferredDeliveryTime, setPreferredDeliveryTime] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    if (!name.trim() || !phone.trim() || !username.trim() || !password.trim()) {
      setError("Please fill all required fields (Name, Phone, Username, Password)");
      return;
    }
    if (phone.trim().length < 10) {
      setError("Phone number must be at least 10 digits");
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
        notes: notes.trim() || null,
        credit_limit: creditLimit ? parseFloat(creditLimit) : 0,
        preferred_delivery_time: preferredDeliveryTime.trim() || null,
        username: username.trim(),
        password: password.trim(),
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "retailers"] });
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create retailer");
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 max-w-3xl mx-auto w-full bg-background" edges={["top", "bottom"]}>
      {/* Header */}
      <View className="h-16 px-4 flex-row items-center bg-surface/80">
        <Pressable accessibilityRole="button" accessibilityLabel="Button"
          className="w-11 h-11 -ml-2 flex items-center justify-center rounded-full active:bg-surface-variant/50 mr-2"
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} className="text-on-surface" />
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

        {/* Portal Access Card */}
        <View className="bg-surface-container-lowest rounded-xl shadow-sm p-4 flex-col gap-4 border border-outline-variant/30 mb-6">
          <View className="flex-row items-center gap-2">
            <MaterialIcons name="security" size={20} className="text-primary" />
            <Text className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Portal Access
            </Text>
          </View>

          <View className="flex-col gap-2">
            <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
              Username <Text className="text-error">*</Text>
            </Text>
            <View className="relative flex-row items-center">
              <View className="absolute left-3 z-10">
                <MaterialIcons name="account-circle" size={18} className="text-on-surface-variant" />
              </View>
              <TextInput placeholderTextColor="#737373"
                className="w-full bg-surface h-12 rounded-lg border border-surface-variant pl-10 pr-4 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant"
                placeholder="Unique login username"
                autoCapitalize="none"
                autoCorrect={false}
                value={username}
                onChangeText={setUsername}
 />
            </View>
          </View>

          <View className="flex-col gap-2">
            <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
              Password <Text className="text-error">*</Text>
            </Text>
            <View className="relative flex-row items-center">
              <View className="absolute left-3 z-10">
                <MaterialIcons name="lock" size={18} className="text-on-surface-variant" />
              </View>
              <TextInput placeholderTextColor="#737373"
                className="w-full bg-surface h-12 rounded-lg border border-surface-variant pl-10 pr-4 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant"
                placeholder="Secure password"
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
 />
            </View>
          </View>
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel="Button"
          className="w-full bg-primary h-14 rounded-2xl flex-row items-center justify-center active:scale-95 mb-6"
          onPress={onSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator className="text-white" />
          ) : (
            <>
              <MaterialIcons name="save" size={20} className="text-white" />
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
