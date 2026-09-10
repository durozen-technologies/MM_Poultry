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
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

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
      setPhone(retailer.phone || "");
      setEmail(retailer.email || "");
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
        phone: phone.trim() || null,
        email: email.trim() || null,
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
              placeholderTextColor="#717973"
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
              placeholderTextColor="#717973"
              value={shopName}
              onChangeText={setShopName}
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
                placeholderTextColor="#717973"
                keyboardType="phone-pad"
                maxLength={10}
                value={phone}
                onChangeText={setPhone}
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
                placeholderTextColor="#717973"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>
          </View>
        </View>
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
