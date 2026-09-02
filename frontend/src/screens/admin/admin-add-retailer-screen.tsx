import { useState } from "react";
import {
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { api, getApiErrorMessage } from "../../api/client";

import { AdminScreenContainer } from "../../components/admin/admin-screen-container";
import { AdminHeader } from "../../components/admin/admin-header";
import { AdminCard } from "../../components/admin/admin-card";
import { AdminActionFooter } from "../../components/admin/admin-action-footer";

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
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
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
    const phoneDigits = phone.trim().replace(/\D/g, "");
    if (!/^\d{10,15}$/.test(phoneDigits)) {
      setError("Phone number must be 10-15 digits");
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
        email: email.trim() || null,
        notes: notes.trim() || null,
        opening_balance: openingBalance ? (Number.isFinite(parseFloat(openingBalance)) ? parseFloat(openingBalance) : 0) : 0,
        preferred_delivery_time: preferredDeliveryTime.trim() || null,
        username: username.trim(),
        password: password.trim(),
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "retailers"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      navigation.goBack();
    } catch (e) {
      setError(getApiErrorMessage(e));
      setLoading(false);
    }
  }

  return (
    <AdminScreenContainer
      header={
        <AdminHeader 
          title="Add Retailer" 
          subtitle="Onboard a new wholesale or retail customer"
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
          <View>
            <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1">
              Notes / Remarks
            </Text>
            <TextInput
              className="h-24 border border-outline-variant/50 rounded-xl px-4 py-3 text-body-md text-on-surface bg-surface-container-lowest focus:border-primary"
              placeholder="Any additional notes..."
              placeholderTextColor="#9ca3af"
              multiline
              textAlignVertical="top"
              value={notes}
              onChangeText={setNotes}
            />
          </View>
        </View>
      </AdminCard>

      {/* Contact Details Card */}
      <AdminCard title="Contact Details" icon="contacts" iconColorClass="text-secondary" iconBgClass="bg-secondary/10">
        <View className="flex-col gap-4">
          <View>
            <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1">
              Primary Phone <Text className="text-error">*</Text>
            </Text>
            <View className="relative flex-row items-center">
              <View className="absolute left-4 z-10">
                <MaterialIcons name="phone-iphone" size={20} className="text-on-surface-variant" />
              </View>
              <TextInput
                className="w-full h-14 border border-outline-variant/50 rounded-xl pl-12 pr-4 text-body-lg text-on-surface font-medium bg-surface-container-lowest focus:border-primary"
                placeholder="10-digit primary number"
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
            </View>
          </View>
          <View>
            <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1">
              WhatsApp
            </Text>
            <View className="relative flex-row items-center">
              <View className="absolute left-4 z-10">
                <MaterialIcons name="chat" size={20} className="text-on-surface-variant" />
              </View>
              <TextInput
                className="w-full h-14 border border-outline-variant/50 rounded-xl pl-12 pr-4 text-body-lg text-on-surface font-medium bg-surface-container-lowest focus:border-primary"
                placeholder="WhatsApp number"
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
                value={whatsapp}
                onChangeText={setWhatsapp}
              />
            </View>
          </View>
          <View>
            <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1">
              Alternate Phone
            </Text>
            <View className="relative flex-row items-center">
              <View className="absolute left-4 z-10">
                <MaterialIcons name="phone" size={20} className="text-on-surface-variant" />
              </View>
              <TextInput
                className="w-full h-14 border border-outline-variant/50 rounded-xl pl-12 pr-4 text-body-lg text-on-surface font-medium bg-surface-container-lowest focus:border-primary"
                placeholder="Other phone number"
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
                value={alternatePhone}
                onChangeText={setAlternatePhone}
              />
            </View>
          </View>
        </View>
      </AdminCard>

      {/* Location & Delivery Card */}
      <AdminCard title="Location & Delivery" icon="location-on" iconColorClass="text-tertiary" iconBgClass="bg-tertiary/10">
        <View className="flex-col gap-4">
          <View className="flex-row gap-4">
            <View className="flex-1">
              <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1">
                Area
              </Text>
              <TextInput
                className="h-14 border border-outline-variant/50 rounded-xl px-4 text-body-lg text-on-surface font-medium bg-surface-container-lowest focus:border-primary"
                placeholder="e.g. Downtown"
                placeholderTextColor="#9ca3af"
                value={area}
                onChangeText={setArea}
              />
            </View>
            <View className="flex-1">
              <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1">
                Route Name
              </Text>
              <TextInput
                className="h-14 border border-outline-variant/50 rounded-xl px-4 text-body-lg text-on-surface font-medium bg-surface-container-lowest focus:border-primary"
                placeholder="e.g. Route A"
                placeholderTextColor="#9ca3af"
                value={routeName}
                onChangeText={setRouteName}
              />
            </View>
          </View>
          <View>
            <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1">
              Preferred Delivery Time
            </Text>
            <TextInput
              className="h-14 border border-outline-variant/50 rounded-xl px-4 text-body-lg text-on-surface font-medium bg-surface-container-lowest focus:border-primary"
              placeholder="e.g. Morning 6 AM"
              placeholderTextColor="#9ca3af"
              value={preferredDeliveryTime}
              onChangeText={setPreferredDeliveryTime}
            />
          </View>
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
        </View>
      </AdminCard>

      {/* Portal Access Card */}
      <AdminCard title="Portal Access" icon="security" iconColorClass="text-error" iconBgClass="bg-error/10">
        <View className="flex-col gap-4">
          <View>
            <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1">
              Username <Text className="text-error">*</Text>
            </Text>
            <View className="relative flex-row items-center">
              <View className="absolute left-4 z-10">
                <MaterialIcons name="account-circle" size={20} className="text-on-surface-variant" />
              </View>
              <TextInput
                className="w-full h-14 border border-outline-variant/50 rounded-xl pl-12 pr-4 text-body-lg text-on-surface font-medium bg-surface-container-lowest focus:border-primary"
                placeholder="Unique login username"
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
                autoCorrect={false}
                value={username}
                onChangeText={setUsername}
              />
            </View>
          </View>
          <View>
            <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1">
              Password <Text className="text-error">*</Text>
            </Text>
            <View className="relative flex-row items-center">
              <View className="absolute left-4 z-10">
                <MaterialIcons name="lock" size={20} className="text-on-surface-variant" />
              </View>
              <TextInput
                className="w-full h-14 border border-outline-variant/50 rounded-xl pl-12 pr-4 text-body-lg text-on-surface font-medium bg-surface-container-lowest focus:border-primary"
                placeholder="Secure password"
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>
          </View>
        </View>
      </AdminCard>

      <AdminActionFooter
        primaryLabel="Save Retailer"
        primaryIcon="save"
        onPrimaryPress={onSubmit}
        isPrimaryLoading={loading}
      />
    </AdminScreenContainer>
  );
}
