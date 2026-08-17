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
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");
  const [creditLimit, setCreditLimit] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    if (!name.trim() || !contactName.trim() || !mobile.trim()) {
      setError("Please fill required fields (Name, Owner, Mobile)");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.post("/admin/retailers", {
        name: name.trim(),
        code: code.trim() || null,
        contact_name: contactName.trim() || null,
        mobile: mobile.trim() || null,
        address: address.trim() || null,
        credit_limit: creditLimit ? parseFloat(creditLimit) : null,
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
              Retailer ID / Code
            </Text>
            <View className="relative flex-row items-center">
              <View className="absolute left-3 z-10">
                <MaterialIcons name="badge" size={18} color="#717973" />
              </View>
              <TextInput
                className="w-full bg-surface h-12 rounded-lg border border-surface-variant pl-10 pr-4 font-body-md text-body-md text-on-surface"
                placeholder="e.g. RET-1024"
                placeholderTextColor="#717973"
                value={code}
                onChangeText={setCode}
              />
            </View>
          </View>

          <View className="flex-col gap-2">
            <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
              Shop Name <Text className="text-error">*</Text>
            </Text>
            <TextInput
              className="w-full bg-surface h-12 rounded-lg border border-surface-variant px-4 font-body-md text-body-md text-on-surface"
              placeholder="Enter shop name"
              placeholderTextColor="#717973"
              value={name}
              onChangeText={setName}
            />
          </View>

          <View className="flex-col gap-2">
            <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
              Owner Name <Text className="text-error">*</Text>
            </Text>
            <View className="relative flex-row items-center">
              <View className="absolute left-3 z-10">
                <MaterialIcons name="person" size={18} color="#717973" />
              </View>
              <TextInput
                className="w-full bg-surface h-12 rounded-lg border border-surface-variant pl-10 pr-4 font-body-md text-body-md text-on-surface"
                placeholder="Enter owner name"
                placeholderTextColor="#717973"
                value={contactName}
                onChangeText={setContactName}
              />
            </View>
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
              Mobile Number <Text className="text-error">*</Text>
            </Text>
            <View className="relative flex-row items-center">
              <View className="absolute left-3 z-10">
                <MaterialIcons name="phone-iphone" size={18} color="#717973" />
              </View>
              <TextInput
                className="w-full bg-surface h-12 rounded-lg border border-surface-variant pl-10 pr-4 font-body-md text-body-md text-on-surface"
                placeholder="10-digit number"
                placeholderTextColor="#717973"
                keyboardType="phone-pad"
                value={mobile}
                onChangeText={setMobile}
              />
            </View>
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
