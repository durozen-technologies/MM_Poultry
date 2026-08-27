import { useEffect, useState } from "react";
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";

export function AdminEditRetailerScreen({ navigation, route }: { navigation: any; route: any }) {
  const { retailerId } = route.params;
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
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [preferredDeliveryTime, setPreferredDeliveryTime] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: retailer, isLoading: isFetching } = useQuery({
    queryKey: ["admin", "retailers", retailerId],
    queryFn: async () => {
      const { data } = await api.get(`/admin/retailers/${retailerId}`);
      return data;
    },
  });

  useEffect(() => {
    if (retailer) {
      setName(retailer.name || "");
      setShopName(retailer.shop_name || "");
      setOwnerName(retailer.owner_name || "");
      setPhone(retailer.phone || "");
      setAlternatePhone(retailer.alternate_phone || "");
      setWhatsapp(retailer.whatsapp || "");
      setAddress(retailer.address || "");
      setArea(retailer.area || "");
      setRouteName(retailer.route_name || "");
      setCategory(retailer.category || "");
      setEmail(retailer.email || "");
      setNotes(retailer.notes || "");
      setPreferredDeliveryTime(retailer.preferred_delivery_time || "");
    }
  }, [retailer]);

  async function onSubmit() {
    if (!name.trim() || !phone.trim()) {
      setError("Please fill all required fields (Name, Phone)");
      return;
    }
    if (phone.trim().length < 10) {
      setError("Phone number must be at least 10 digits");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.patch(`/admin/retailers/${retailerId}`, {
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
        email: email.trim() || null,
        notes: notes.trim() || null,
        preferred_delivery_time: preferredDeliveryTime.trim() || null,
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "retailers"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "retailers", retailerId] });
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update retailer");
      setLoading(false);
    }
  }

  if (isFetching) {
    return (
      <SafeAreaView className="flex-1 max-w-3xl mx-auto w-full bg-background justify-center items-center">
        <ActivityIndicator size="large" className="text-primary" />
      </SafeAreaView>
    );
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
          Edit Retailer
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
        </View>

        {/* Contact Info Card */}
        <View className="bg-surface-container-lowest rounded-xl shadow-sm p-4 flex-col gap-4 border border-outline-variant/30 mb-6">
          <View className="flex-row items-center gap-2">
            <MaterialIcons name="contacts" size={20} className="text-primary" />
            <Text className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Contact Information
            </Text>
          </View>
          
          <View className="flex-col gap-2">
            <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
              Primary Phone <Text className="text-error">*</Text>
            </Text>
            <View className="relative flex-row items-center">
              <View className="absolute left-3 z-10 flex-row items-center gap-1 border-r border-outline-variant pr-2">
                <MaterialIcons name="call" size={16} className="text-on-surface-variant" />
                <Text className="text-on-surface-variant font-body-md">+91</Text>
              </View>
              <TextInput placeholderTextColor="#737373"
                className="w-full bg-surface h-12 rounded-lg border border-surface-variant pl-20 pr-4 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant"
                placeholder="10 digit number"
                keyboardType="phone-pad"
                maxLength={10}
                value={phone}
                onChangeText={setPhone}
              />
            </View>
          </View>

          <View className="flex-col gap-2">
            <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
              Alternate Phone
            </Text>
            <View className="relative flex-row items-center">
              <View className="absolute left-3 z-10 flex-row items-center gap-1 border-r border-outline-variant pr-2">
                <Text className="text-on-surface-variant font-body-md">+91</Text>
              </View>
              <TextInput placeholderTextColor="#737373"
                className="w-full bg-surface h-12 rounded-lg border border-surface-variant pl-14 pr-4 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant"
                placeholder="10 digit number (optional)"
                keyboardType="phone-pad"
                maxLength={10}
                value={alternatePhone}
                onChangeText={setAlternatePhone}
              />
            </View>
          </View>

          <View className="flex-col gap-2">
            <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
              WhatsApp Number
            </Text>
            <View className="relative flex-row items-center">
              <View className="absolute left-3 z-10 flex-row items-center gap-1 border-r border-outline-variant pr-2">
                <Text className="text-on-surface-variant font-body-md">+91</Text>
              </View>
              <TextInput placeholderTextColor="#737373"
                className="w-full bg-surface h-12 rounded-lg border border-surface-variant pl-14 pr-4 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant"
                placeholder="10 digit number (optional)"
                keyboardType="phone-pad"
                maxLength={10}
                value={whatsapp}
                onChangeText={setWhatsapp}
              />
            </View>
          </View>

          <View className="flex-col gap-2">
            <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
              Email Address
            </Text>
            <View className="relative flex-row items-center">
              <View className="absolute left-3 z-10">
                <MaterialIcons name="email" size={18} className="text-on-surface-variant" />
              </View>
              <TextInput placeholderTextColor="#737373"
                className="w-full bg-surface h-12 rounded-lg border border-surface-variant pl-10 pr-4 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant"
                placeholder="Enter email (optional)"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
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
              Full Address
            </Text>
            <TextInput placeholderTextColor="#737373"
              className="w-full bg-surface rounded-lg border border-surface-variant p-4 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant min-h-[80px]"
              placeholder="Enter complete address"
              multiline
              textAlignVertical="top"
              value={address}
              onChangeText={setAddress}
            />
          </View>

          <View className="flex-row gap-3">
            <View className="flex-col gap-2 flex-1">
              <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
                Area/Locality
              </Text>
              <TextInput placeholderTextColor="#737373"
                className="w-full bg-surface h-12 rounded-lg border border-surface-variant px-4 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant"
                placeholder="e.g. MG Road"
                value={area}
                onChangeText={setArea}
              />
            </View>
            <View className="flex-col gap-2 flex-1">
              <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
                Route Name
              </Text>
              <TextInput placeholderTextColor="#737373"
                className="w-full bg-surface h-12 rounded-lg border border-surface-variant px-4 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant"
                placeholder="e.g. North Route"
                value={routeName}
                onChangeText={setRouteName}
              />
            </View>
          </View>

          <View className="flex-col gap-2">
            <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
              Preferred Delivery Time
            </Text>
            <View className="relative flex-row items-center">
              <View className="absolute left-3 z-10">
                <MaterialIcons name="schedule" size={18} className="text-on-surface-variant" />
              </View>
              <TextInput placeholderTextColor="#737373"
                className="w-full bg-surface h-12 rounded-lg border border-surface-variant pl-10 pr-4 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant"
                placeholder="e.g. Morning 6-8 AM"
                value={preferredDeliveryTime}
                onChangeText={setPreferredDeliveryTime}
              />
            </View>
          </View>
        </View>

        {/* Additional Details Card */}
        <View className="bg-surface-container-lowest rounded-xl shadow-sm p-4 flex-col gap-4 border border-outline-variant/30 mb-8">
          <View className="flex-row items-center gap-2">
            <MaterialIcons name="note" size={20} className="text-primary" />
            <Text className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Additional Notes
            </Text>
          </View>

          <View className="flex-col gap-2">
            <TextInput placeholderTextColor="#737373"
              className="w-full bg-surface rounded-lg border border-surface-variant p-4 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant min-h-[80px]"
              placeholder="Any special instructions or notes about this retailer..."
              multiline
              textAlignVertical="top"
              value={notes}
              onChangeText={setNotes}
            />
          </View>
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel="Button"
          className={`w-full h-14 rounded-full flex items-center justify-center mb-10 ${loading ? "bg-primary/70" : "bg-primary active:scale-[0.98]"}`}
          onPress={onSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="font-label-lg text-label-lg text-on-primary font-bold tracking-wide">
              Save Changes
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
