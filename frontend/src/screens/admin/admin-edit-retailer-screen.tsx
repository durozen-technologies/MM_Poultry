import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";

import { AdminScreenContainer } from "../../components/admin/admin-screen-container";
import { AdminHeader } from "../../components/admin/admin-header";
import { AdminCard } from "../../components/admin/admin-card";
import { AdminActionFooter } from "../../components/admin/admin-action-footer";

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
      <View className="flex-1 bg-surface justify-center items-center">
        <ActivityIndicator size="large" className="text-primary" />
      </View>
    );
  }

  return (
    <AdminScreenContainer
      header={
        <AdminHeader 
          title="Edit Retailer" 
          subtitle="Update wholesale or retail customer details"
          onBack={() => navigation.goBack()} 
        />
      }
    >
      {error && (
        <View className="bg-error-container/90 px-4 py-3 rounded-xl flex-row items-center">
          <MaterialIcons name="error-outline" size={20} className="text-on-error-container mr-2" />
          <Text className="text-on-error-container text-body-sm font-medium flex-1">{error}</Text>
        </View>
      )}

      {/* Basic Details Card */}
      <AdminCard title="Basic Details" icon="storefront">
        <View className="flex-col gap-4">
          <View>
            <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1">
              Company / Business Name <Text className="text-error">*</Text>
            </Text>
            <TextInput
              className="h-14 border border-outline-variant/50 rounded-xl px-4 text-body-lg text-on-surface font-medium bg-surface-container-lowest focus:border-primary"
              placeholder="Enter Retailer/Company Name"
              placeholderTextColor="#9ca3af"
              value={name}
              onChangeText={setName}
            />
          </View>
          <View>
            <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1">
              Shop Name
            </Text>
            <TextInput
              className="h-14 border border-outline-variant/50 rounded-xl px-4 text-body-lg text-on-surface font-medium bg-surface-container-lowest focus:border-primary"
              placeholder="e.g. SR Chicken Center"
              placeholderTextColor="#9ca3af"
              value={shopName}
              onChangeText={setShopName}
            />
          </View>
          <View>
            <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1">
              Owner Name
            </Text>
            <View className="relative flex-row items-center">
              <View className="absolute left-4 z-10">
                <MaterialIcons name="person" size={20} className="text-on-surface-variant" />
              </View>
              <TextInput
                className="w-full h-14 border border-outline-variant/50 rounded-xl pl-12 pr-4 text-body-lg text-on-surface font-medium bg-surface-container-lowest focus:border-primary"
                placeholder="Enter owner name"
                placeholderTextColor="#9ca3af"
                value={ownerName}
                onChangeText={setOwnerName}
              />
            </View>
          </View>
          <View>
            <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1">
              Category
            </Text>
            <TextInput
              className="h-14 border border-outline-variant/50 rounded-xl px-4 text-body-lg text-on-surface font-medium bg-surface-container-lowest focus:border-primary"
              placeholder="e.g. Wholesale, Retail"
              placeholderTextColor="#9ca3af"
              value={category}
              onChangeText={setCategory}
            />
          </View>
        </View>
      </AdminCard>

      {/* Contact Info Card */}
      <AdminCard title="Contact Information" icon="contacts" iconColorClass="text-secondary" iconBgClass="bg-secondary/10">
        <View className="flex-col gap-4">
          <View>
            <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1">
              Primary Phone <Text className="text-error">*</Text>
            </Text>
            <View className="relative flex-row items-center">
              <View className="absolute left-4 z-10 flex-row items-center gap-1">
                <MaterialIcons name="call" size={18} className="text-on-surface-variant" />
                <Text className="text-on-surface-variant font-medium text-body-md border-r border-outline-variant/30 pr-2 ml-1">+91</Text>
              </View>
              <TextInput
                className="w-full h-14 border border-outline-variant/50 rounded-xl pl-[72px] pr-4 text-body-lg text-on-surface font-medium bg-surface-container-lowest focus:border-primary"
                placeholder="10 digit number"
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
                maxLength={10}
                value={phone}
                onChangeText={setPhone}
              />
            </View>
          </View>
          <View>
            <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1">
              Alternate Phone
            </Text>
            <View className="relative flex-row items-center">
              <View className="absolute left-4 z-10 flex-row items-center gap-1">
                <Text className="text-on-surface-variant font-medium text-body-md border-r border-outline-variant/30 pr-2">+91</Text>
              </View>
              <TextInput
                className="w-full h-14 border border-outline-variant/50 rounded-xl pl-16 pr-4 text-body-lg text-on-surface font-medium bg-surface-container-lowest focus:border-primary"
                placeholder="10 digit number (optional)"
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
                maxLength={10}
                value={alternatePhone}
                onChangeText={setAlternatePhone}
              />
            </View>
          </View>
          <View>
            <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1">
              WhatsApp Number
            </Text>
            <View className="relative flex-row items-center">
              <View className="absolute left-4 z-10 flex-row items-center gap-1">
                <Text className="text-on-surface-variant font-medium text-body-md border-r border-outline-variant/30 pr-2">+91</Text>
              </View>
              <TextInput
                className="w-full h-14 border border-outline-variant/50 rounded-xl pl-16 pr-4 text-body-lg text-on-surface font-medium bg-surface-container-lowest focus:border-primary"
                placeholder="10 digit number (optional)"
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
                maxLength={10}
                value={whatsapp}
                onChangeText={setWhatsapp}
              />
            </View>
          </View>
          <View>
            <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1">
              Email Address
            </Text>
            <View className="relative flex-row items-center">
              <View className="absolute left-4 z-10">
                <MaterialIcons name="email" size={20} className="text-on-surface-variant" />
              </View>
              <TextInput
                className="w-full h-14 border border-outline-variant/50 rounded-xl pl-12 pr-4 text-body-lg text-on-surface font-medium bg-surface-container-lowest focus:border-primary"
                placeholder="Enter email (optional)"
                placeholderTextColor="#9ca3af"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>
          </View>
        </View>
      </AdminCard>

      {/* Location & Delivery Card */}
      <AdminCard title="Location & Delivery" icon="location-on" iconColorClass="text-tertiary" iconBgClass="bg-tertiary/10">
        <View className="flex-col gap-4">
          <View>
            <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1">
              Full Address
            </Text>
            <TextInput
              className="h-24 border border-outline-variant/50 rounded-xl px-4 py-3 text-body-md text-on-surface bg-surface-container-lowest focus:border-primary"
              placeholder="Enter complete address"
              placeholderTextColor="#9ca3af"
              multiline
              textAlignVertical="top"
              value={address}
              onChangeText={setAddress}
            />
          </View>
          <View className="flex-row gap-4">
            <View className="flex-1">
              <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1">
                Area/Locality
              </Text>
              <TextInput
                className="h-14 border border-outline-variant/50 rounded-xl px-4 text-body-lg text-on-surface font-medium bg-surface-container-lowest focus:border-primary"
                placeholder="e.g. MG Road"
                placeholderTextColor="#9ca3af"
                value={area}
                onChangeText={setArea}
              />
            </View>
          </View>

          <View>
            <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1">
              Preferred Delivery Time
            </Text>
            <View className="relative flex-row items-center">
              <View className="absolute left-4 z-10">
                <MaterialIcons name="schedule" size={20} className="text-on-surface-variant" />
              </View>
              <TextInput
                className="w-full h-14 border border-outline-variant/50 rounded-xl pl-12 pr-4 text-body-lg text-on-surface font-medium bg-surface-container-lowest focus:border-primary"
                placeholder="e.g. Morning 6-8 AM"
                placeholderTextColor="#9ca3af"
                value={preferredDeliveryTime}
                onChangeText={setPreferredDeliveryTime}
              />
            </View>
          </View>
        </View>
      </AdminCard>

      {/* Additional Details Card */}
      <AdminCard title="Additional Notes" icon="note">
        <TextInput
          className="h-24 border border-outline-variant/50 rounded-xl px-4 py-3 text-body-md text-on-surface bg-surface-container-lowest focus:border-primary"
          placeholder="Any special instructions or notes about this retailer..."
          placeholderTextColor="#9ca3af"
          multiline
          textAlignVertical="top"
          value={notes}
          onChangeText={setNotes}
        />
      </AdminCard>

      <AdminActionFooter
        primaryLabel="Save Changes"
        primaryIcon="save"
        onPrimaryPress={onSubmit}
        isPrimaryLoading={loading}
      />
    </AdminScreenContainer>
  );
}
