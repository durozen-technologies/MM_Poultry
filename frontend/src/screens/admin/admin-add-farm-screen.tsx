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

export function AdminAddFarmScreen({ navigation }: { navigation: any }) {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");
  const [village, setVillage] = useState("");
  const [capacity, setCapacity] = useState("");

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
        capacity: capacity ? parseInt(capacity, 10) : null,
      });
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add farm");
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
          Farm Information
        </Text>
      </View>

      <ScrollView className="flex-1 px-4 py-4 flex-col" contentContainerStyle={{ paddingBottom: 100 }}>
        {error && (
          <Text className="px-4 py-2 mb-4 text-error text-center text-label-md bg-error-container rounded-lg font-semibold">
            {error}
          </Text>
        )}

        {/* Basic Details Card */}
        <View className="bg-surface-container-lowest rounded-xl shadow-sm p-4 flex-col gap-4 border border-outline-variant/30 mb-6">
          <View className="flex-col gap-2">
            <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
              Farm Name <Text className="text-error">*</Text>
            </Text>
            <TextInput placeholderTextColor="#737373"
              className="w-full bg-surface h-12 rounded-lg border border-surface-variant px-4 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant"
              placeholder="Enter farm name"
              value={name}
              onChangeText={setName}
 />
          </View>
        </View>

        {/* Contact Information */}
        <Text className="font-headline-sm text-on-surface mb-3 font-semibold">Contact Information</Text>
        <View className="bg-surface-container-lowest rounded-xl shadow-sm p-4 flex-col gap-4 border border-outline-variant/30 mb-6">
          <View className="flex-col gap-2">
            <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
              Mobile Number
            </Text>
            <TextInput placeholderTextColor="#737373"
              className="w-full bg-surface h-12 rounded-lg border border-surface-variant px-4 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant"
              placeholder="Enter mobile number"
              keyboardType="phone-pad"
              value={mobile}
              onChangeText={setMobile}
 />
          </View>
        </View>

        {/* Farm Location */}
        <Text className="font-headline-sm text-on-surface mb-3 font-semibold">Farm Location & Details</Text>
        <View className="bg-surface-container-lowest rounded-xl shadow-sm p-4 flex-col gap-4 border border-outline-variant/30 mb-6">
          <View className="flex-col gap-2">
            <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
              Address
            </Text>
            <TextInput placeholderTextColor="#737373"
              className="w-full bg-surface rounded-lg border border-surface-variant p-4 font-body-md text-body-md text-on-surface min-h-[100px] placeholder:text-on-surface-variant"
              placeholder="Enter full address"
              multiline
              textAlignVertical="top"
              value={address}
              onChangeText={setAddress}
 />
          </View>
          <View className="flex-col gap-2">
            <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
              Location (City/Region)
            </Text>
            <TextInput placeholderTextColor="#737373"
              className="w-full bg-surface h-12 rounded-lg border border-surface-variant px-4 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant"
              placeholder="Enter village or city"
              value={village}
              onChangeText={setVillage}
 />
          </View>
          <View className="flex-col gap-2">
            <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
              Capacity (Number of Birds)
            </Text>
            <TextInput placeholderTextColor="#737373"
              className="w-full bg-surface h-12 rounded-lg border border-surface-variant px-4 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant"
              placeholder="e.g. 5000"
              keyboardType="number-pad"
              value={capacity}
              onChangeText={setCapacity}
 />
          </View>
        </View>

        {/* Submit Button */}
        <Pressable accessibilityRole="button" accessibilityLabel="Button"
          className="w-full bg-primary h-14 rounded-2xl flex-row items-center justify-center active:scale-95 mb-6 shadow-md shadow-primary/30"
          onPress={onSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator className="text-white" />
          ) : (
            <>
              <MaterialIcons name="save" size={20} className="text-white" />
              <Text className="font-label-md text-label-md text-on-primary font-semibold ml-2">
                Save Farm
              </Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
