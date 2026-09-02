import { useState } from "react";
import {
  Text,
  TextInput,
  View,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";

import { AdminScreenContainer } from "../../components/admin/admin-screen-container";
import { AdminHeader } from "../../components/admin/admin-header";
import { AdminCard } from "../../components/admin/admin-card";
import { AdminActionFooter } from "../../components/admin/admin-action-footer";
import { MaterialIcons } from "@expo/vector-icons";

export function AdminAddFarmScreen({ navigation }: { navigation: any }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");
  const [village, setVillage] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    if (!name.trim()) {
      setError("Farm Name is required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.post("/admin/farms", {
        name: name.trim(),
        contact_phone: mobile.trim() || null,
        address: address.trim() || null,
        location: village.trim() || null,
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "farms"] });
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add farm");
      setLoading(false);
    }
  }

  return (
    <AdminScreenContainer
      header={
        <AdminHeader 
          title="Add New Farm" 
          subtitle="Register a new farm for purchasing"
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

      <AdminCard title="Farm Details" icon="store">
        <View className="flex-col gap-4">
          <View>
            <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1">
              Farm Name <Text className="text-error">*</Text>
            </Text>
            <TextInput 
              className="h-14 border border-outline-variant/50 rounded-xl px-4 text-body-lg text-on-surface font-medium bg-surface-container-lowest focus:border-primary"
              placeholder="Enter farm name"
              placeholderTextColor="#9ca3af"
              value={name}
              onChangeText={setName}
            />
          </View>
          <View>
            <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1">
              Mobile Number
            </Text>
            <TextInput 
              className="h-14 border border-outline-variant/50 rounded-xl px-4 text-body-lg text-on-surface font-medium bg-surface-container-lowest focus:border-primary"
              placeholder="Enter mobile number"
              placeholderTextColor="#9ca3af"
              keyboardType="phone-pad"
              value={mobile}
              onChangeText={setMobile}
            />
          </View>
          <View>
            <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1">
              Address
            </Text>
            <TextInput 
              className="h-24 border border-outline-variant/50 rounded-xl p-4 text-body-md text-on-surface bg-surface-container-lowest focus:border-primary"
              placeholder="Enter full address"
              placeholderTextColor="#9ca3af"
              multiline
              textAlignVertical="top"
              value={address}
              onChangeText={setAddress}
            />
          </View>
          <View>
            <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1">
              Location (City/Region)
            </Text>
            <TextInput 
              className="h-14 border border-outline-variant/50 rounded-xl px-4 text-body-lg text-on-surface font-medium bg-surface-container-lowest focus:border-primary"
              placeholder="Enter village or city"
              placeholderTextColor="#9ca3af"
              value={village}
              onChangeText={setVillage}
            />
          </View>
        </View>
      </AdminCard>

      <AdminActionFooter
        primaryLabel="Save Farm"
        primaryIcon="save"
        onPrimaryPress={onSubmit}
        isPrimaryLoading={loading}
      />
    </AdminScreenContainer>
  );
}
