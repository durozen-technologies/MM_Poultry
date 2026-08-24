import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { listRetailers, createRetailerPortalUser } from "../../api/retailers";
import type { Retailer } from "../../types/api";

export function AdminRetailerPortalAccessScreen({ navigation }: { navigation: any }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Retailer | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "retailers", "portal-list"],
    queryFn: () => listRetailers(undefined, 200),
  });

  const retailers = data?.items ?? [];
  const filtered = search.trim()
    ? retailers.filter((r) =>
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.phone?.includes(search)
      )
    : retailers;

  function selectRetailer(r: Retailer) {
    setSelected(r);
    setUsername("");
    setPassword("");
    setMessage(null);
  }

  async function createAccount() {
    if (!selected) return;
    if (!username.trim() || !password.trim()) {
      setMessage({ text: "Username and Password are required", ok: false });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      await createRetailerPortalUser(selected.id, {
        username: username.trim(),
        password: password.trim(),
      });
      setMessage({ text: "Portal account created successfully!", ok: true });
      setUsername("");
      setPassword("");
    } catch (e: any) {
      if (e?.response?.status === 409) {
        setMessage({ text: "This retailer already has a portal account.", ok: false });
      } else {
        setMessage({ text: e instanceof Error ? e.message : "Failed to create portal account.", ok: false });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 max-w-3xl mx-auto w-full bg-background" edges={["top", "bottom"]}>
      {/* Header */}
      <View className="h-16 px-4 flex-row items-center bg-surface/80">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="w-11 h-11 -ml-2 flex items-center justify-center rounded-full active:bg-surface-variant/50 mr-2"
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} className="text-on-surface" />
        </Pressable>
        <Text className="font-headline-sm text-headline-sm text-primary font-semibold">
          Portal Access
        </Text>
      </View>

      <View className="flex-1 px-4 pt-4 flex-col gap-4">
        {/* Step 1: pick retailer */}
        {!selected ? (
          <>
            <Text className="font-label-md text-on-surface-variant font-semibold">
              Select a retailer to manage portal access
            </Text>

            {/* Search */}
            <View className="relative flex-row items-center">
              <View className="absolute left-3 z-10">
                <MaterialIcons name="search" size={20} className="text-on-surface-variant" />
              </View>
              <TextInput
                placeholderTextColor="#737373"
                className="w-full bg-surface h-12 rounded-xl border border-surface-variant pl-10 pr-4 font-body-md text-on-surface"
                placeholder="Search by name or phone..."
                value={search}
                onChangeText={setSearch}
                autoCorrect={false}
              />
            </View>

            {isLoading ? (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator color="#012d1d" />
              </View>
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={(r) => r.id}
                contentContainerStyle={{ paddingBottom: 40 }}
                renderItem={({ item }) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${item.name}`}
                    className="bg-surface-container-lowest rounded-2xl p-4 mb-3 flex-row items-center gap-3 border active:bg-surface-container"
                    style={{ borderColor: 'rgba(193, 200, 194, 0.2)' }}
                    onPress={() => selectRetailer(item)}
                  >
                    <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: 'rgba(27, 67, 50, 0.3)' }}>
                      <MaterialIcons name="store" size={20} className="text-primary" />
                    </View>
                    <View className="flex-1">
                      <Text className="font-headline-sm text-on-surface font-semibold">{item.name}</Text>
                      <Text className="font-body-md text-on-surface-variant">{item.phone || "—"}</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={20} className="text-on-surface-variant" />
                  </Pressable>
                )}
                ListEmptyComponent={
                  <Text className="text-on-surface-variant text-center py-8">No retailers found.</Text>
                }
              />
            )}
          </>
        ) : (
          /* Step 2: create/manage portal for selected retailer */
          <View className="flex-col gap-4">
            {/* Selected retailer chip */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change retailer"
              className="flex-row items-center gap-3 rounded-2xl p-4 border active:opacity-80"
              style={{ backgroundColor: 'rgba(27, 67, 50, 0.2)', borderColor: 'rgba(1, 45, 29, 0.2)' }}
              onPress={() => { setSelected(null); setMessage(null); }}
            >
              <MaterialIcons name="store" size={20} className="text-primary" />
              <View className="flex-1">
                <Text className="font-headline-sm text-on-surface font-semibold">{selected.name}</Text>
                <Text className="font-body-md text-on-surface-variant">{selected.phone || "—"}</Text>
              </View>
              <View className="flex-row items-center gap-1">
                <Text className="font-label-md text-primary font-semibold">Change</Text>
                <MaterialIcons name="swap-horiz" size={18} className="text-primary" />
              </View>
            </Pressable>

            {/* Portal access form */}
            <View className="bg-surface-container-lowest rounded-2xl p-4 flex-col gap-4 border" style={{ borderColor: 'rgba(193, 200, 194, 0.2)' }}>
              <View className="flex-row items-center gap-2">
                <MaterialIcons name="security" size={20} className="text-primary" />
                <Text className="font-headline-sm text-on-surface font-semibold">
                  Create / Update Portal Login
                </Text>
              </View>

              <Text className="font-body-md text-on-surface-variant text-sm">
                Set a username and password for this retailer to access the portal. If they already have an account, use this to create a new one.
              </Text>

              {message && (
                <View className={`p-3 rounded-xl ${message.ok ? "bg-primary-container" : "bg-error-container"}`}>
                  <Text className={`font-label-md font-semibold ${message.ok ? "text-on-primary-container" : "text-error"}`}>
                    {message.text}
                  </Text>
                </View>
              )}

              <View className="flex-col gap-3">
                <View className="relative flex-row items-center">
                  <View className="absolute left-3 z-10">
                    <MaterialIcons name="account-circle" size={18} className="text-on-surface-variant" />
                  </View>
                  <TextInput
                    placeholderTextColor="#737373"
                    className="w-full bg-surface h-12 rounded-xl border border-surface-variant pl-10 pr-4 font-body-md text-on-surface"
                    placeholder="Username"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={username}
                    onChangeText={setUsername}
                  />
                </View>

                <View className="relative flex-row items-center">
                  <View className="absolute left-3 z-10">
                    <MaterialIcons name="lock" size={18} className="text-on-surface-variant" />
                  </View>
                  <TextInput
                    placeholderTextColor="#737373"
                    className="w-full bg-surface h-12 rounded-xl border border-surface-variant pl-10 pr-4 font-body-md text-on-surface"
                    placeholder="Password"
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={password}
                    onChangeText={setPassword}
                  />
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Create portal account"
                  className="w-full bg-primary h-13 rounded-xl flex-row items-center justify-center gap-2 mt-1 active:scale-95"
                  onPress={createAccount}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <MaterialIcons name="vpn-key" size={18} color="#fff" />
                      <Text className="text-on-primary font-semibold font-label-md">
                        Create Login Account
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
