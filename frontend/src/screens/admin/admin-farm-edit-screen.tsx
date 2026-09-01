import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "@react-navigation/native";
import { getFarm, updateFarm } from "../../api/farms";
import type { FarmOut } from "../../types/api";

export function AdminFarmEditScreen({ route, navigation }: { route: any; navigation: any }) {
  const { farmId } = route.params;
  const queryClient = useQueryClient();
  const [farm, setFarm] = useState<FarmOut | null>(null);
  
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");
  const [village, setVillage] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getFarm(farmId);
      setFarm(data);
      setName(data.name);
      setMobile(data.contact_phone || "");
      setAddress(data.address || "");
      setVillage(data.location || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load farm");
    } finally {
      setLoading(false);
    }
  }, [farmId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function onSave() {
    if (!name.trim()) {
      setError("Farm Name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateFarm(farmId, {
        name: name.trim(),
        contact_phone: mobile.trim() || null,
        address: address.trim() || null,
        location: village.trim() || null,
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "farms"] });
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update farm");
      setSaving(false);
    }
  }

  if (loading || !farm) {
    return (
      <SafeAreaView className="flex-1 max-w-3xl mx-auto w-full bg-background items-center justify-center">
        <ActivityIndicator className="text-primary" />
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
          Edit Farm
        </Text>
      </View>

      <KeyboardAwareScrollView enableOnAndroid={true} keyboardShouldPersistTaps="handled" className="flex-1 px-4 py-4 flex-col" contentContainerStyle={{ paddingBottom: 100 }}>
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
        </View>

        {/* Submit Button */}
        <Pressable accessibilityRole="button" accessibilityLabel="Button"
          className="w-full bg-primary h-14 rounded-2xl flex-row items-center justify-center active:scale-95 mb-6 shadow-md shadow-primary/30"
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
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
