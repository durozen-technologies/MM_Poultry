import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { getRetailer, updateRetailer } from "../../api/retailers";
import type { Retailer } from "../../types/api";

export function AdminRetailerEditScreen({ route, navigation }: { route: any; navigation: any }) {
  const { retailerId } = route.params;
  const [retailer, setRetailer] = useState<Retailer | null>(null);
  const [name, setName] = useState("");
  const [shopName, setShopName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [area, setArea] = useState("");
  const [routeName, setRouteName] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getRetailer(retailerId);
      setRetailer(data);
      setName(data.name);
      setShopName(data.shop_name || "");
      setOwnerName(data.owner_name || "");
      setPhone(data.phone || "");
      setAddress(data.address || "");
      setArea(data.area || "");
      setRouteName(data.route_name || "");
      setCreditLimit(data.credit_limit || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load retailer");
    } finally {
      setLoading(false);
    }
  }, [retailerId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function onSave() {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateRetailer(retailerId, {
        name: name.trim(),
        shop_name: shopName.trim() || null,
        owner_name: ownerName.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        area: area.trim() || null,
        route_name: routeName.trim() || null,
        credit_limit: creditLimit ? parseFloat(creditLimit) : undefined,
      });
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
      setSaving(false);
    }
  }

  if (loading || !retailer) {
    return (
      <SafeAreaView className="flex-1 max-w-3xl mx-auto w-full bg-background items-center justify-center">
        <ActivityIndicator className="text-primary" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 max-w-3xl mx-auto w-full bg-background" edges={["top", "bottom"]}>
      <View className="h-16 px-4 flex-row items-center bg-surface/90">
        <Pressable accessibilityRole="button" accessibilityLabel="Button" className="w-11 h-11 -ml-2 items-center justify-center rounded-full" onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} className="text-on-surface" />
        </Pressable>
        <Text className="font-headline-sm text-on-surface font-semibold ml-2">Edit Retailer</Text>
      </View>

      <ScrollView className="flex-1 px-4 py-4" contentContainerStyle={{ paddingBottom: 100 }}>
        {error ? (
          <Text className="text-error bg-error-container rounded-lg p-3 mb-4 text-center">{error}</Text>
        ) : null}

        <Field label="Name" value={name} onChangeText={setName} />
        <Field label="Shop Name" value={shopName} onChangeText={setShopName} />
        <Field label="Owner Name" value={ownerName} onChangeText={setOwnerName} />
        <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Field label="Address" value={address} onChangeText={setAddress} />
        <Field label="Area" value={area} onChangeText={setArea} />
        <Field label="Route" value={routeName} onChangeText={setRouteName} />
        <Field label="Credit Limit (₹)" value={creditLimit} onChangeText={setCreditLimit} keyboardType="decimal-pad" />
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 bg-surface/90 border-t border-outline-variant/20 p-4">
        <Pressable accessibilityRole="button" accessibilityLabel="Button" className="bg-primary h-12 rounded-xl items-center justify-center" onPress={onSave} disabled={saving}>
          {saving ? <ActivityIndicator className="text-white" /> : <Text className="text-on-primary font-semibold">Save Changes</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: "default" | "phone-pad" | "decimal-pad";
}) {
  return (
    <View className="mb-4">
      <Text className="font-label-md text-on-surface-variant mb-1">{label}</Text>
      <TextInput
        className="bg-surface-container-lowest h-12 border border-outline-variant rounded-lg px-3 text-body-md"
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
      />
    </View>
  );
}
