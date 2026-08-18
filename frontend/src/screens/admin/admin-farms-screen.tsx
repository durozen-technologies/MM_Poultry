import { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
  ScrollView,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../api/client";
import type { FarmOut } from "../../types/api";

export function AdminFarmsScreen({ navigation }: { navigation: any }) {
  const insets = useSafeAreaInsets();
  const [farms, setFarms] = useState<FarmOut[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"All" | "Active" | "Inactive">("All");
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/farms");
      setFarms(data);
    } catch (e) {
      console.warn("Failed to fetch farms", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const filteredFarms = farms.filter((f) => {
    if (searchQuery && !f.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filter === "Active" && !f.is_active) return false;
    if (filter === "Inactive" && f.is_active) return false;
    return true;
  });

  const activeCount = farms.filter(f => f.is_active).length;
  const inactiveCount = farms.length - activeCount;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      {/* Header */}
      <View className="h-16 px-4 flex-row items-center justify-between bg-surface/90 z-20">
        <View className="flex-row items-center gap-2">
          <Pressable
            className="w-11 h-11 -ml-2 flex items-center justify-center rounded-full active:bg-surface-variant/50"
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="arrow-back" size={24} color="#181c20" />
          </Pressable>
          <Text className="font-headline-sm text-headline-sm text-primary font-semibold">
            Farms
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Pressable
            className="h-10 px-3 flex-row items-center justify-center rounded-xl bg-primary shadow-sm active:bg-primary/90"
            onPress={() => navigation.navigate("AddFarm")}
          >
            <MaterialIcons name="add" size={20} color="#ffffff" style={{ marginRight: 4 }} />
            <Text className="text-label-md text-on-primary font-semibold">Add</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Summary Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-3 mb-4">
          <View className="flex-row items-center gap-2 bg-surface-container px-3 py-2 rounded-full">
            <Text className="text-label-md text-on-surface-variant uppercase tracking-wider font-semibold">
              Total
            </Text>
            <Text className="text-headline-sm text-primary font-semibold">{farms.length}</Text>
          </View>
          <View className="flex-row items-center gap-2 bg-primary-container/20 px-3 py-2 rounded-full">
            <View className="w-2 h-2 rounded-full bg-primary" />
            <Text className="text-label-md text-on-surface-variant uppercase tracking-wider font-semibold">
              Active
            </Text>
            <Text className="text-headline-sm text-primary font-semibold">{activeCount}</Text>
          </View>
          <View className="flex-row items-center gap-2 bg-error-container/40 px-3 py-2 rounded-full">
            <View className="w-2 h-2 rounded-full bg-error" />
            <Text className="text-label-md text-on-surface-variant uppercase tracking-wider font-semibold">
              Inactive
            </Text>
            <Text className="text-headline-sm text-error font-semibold">{inactiveCount}</Text>
          </View>
        </ScrollView>

        {/* Search & Filters */}
        <View className="flex-col gap-3 mb-6">
          <View className="relative flex-row items-center">
            <View className="absolute left-4 z-10">
              <MaterialIcons name="search" size={20} color="#717973" />
            </View>
            <TextInput
              className="flex-1 h-12 pl-12 pr-4 bg-surface-container-lowest border border-surface-variant rounded-2xl text-body-md text-on-surface"
              placeholder="Search farms..."
              placeholderTextColor="#717973"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <View className="flex-row gap-2">
            {(["All", "Active", "Inactive"] as const).map((f) => (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                className={`h-10 px-4 rounded-full flex items-center justify-center ${
                  filter === f ? "bg-primary" : "bg-surface-container"
                }`}
              >
                <Text
                  className={`font-label-md text-label-md font-semibold ${
                    filter === f ? "text-on-primary" : "text-on-surface"
                  }`}
                >
                  {f}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Farm List */}
        <View className="flex-col gap-4">
          {filteredFarms.length === 0 && !loading ? (
            <View className="flex-col items-center justify-center p-8 mt-4">
              <MaterialIcons name="agriculture" size={48} color="#717973" />
              <Text className="font-headline-md text-on-surface mb-2 mt-4 font-semibold">
                No farms found
              </Text>
              <Text className="font-body-md text-on-surface-variant text-center">
                Add a new farm to start recording farm loads.
              </Text>
            </View>
          ) : (
            filteredFarms.map((farm) => (
              <View
                key={farm.id}
                className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm flex-col gap-3 border border-outline-variant/20"
              >
                <View className="flex-row justify-between items-start">
                  <View className="flex-col flex-1">
                    <View className="flex-row items-center gap-2 flex-wrap">
                      <Text className="text-headline-sm text-on-surface font-semibold">
                        {farm.name}
                      </Text>
                      <View
                        className={`px-2 py-1 rounded-full flex-row items-center gap-1 ${
                          farm.is_active ? "bg-primary-container/30" : "bg-surface-variant"
                        }`}
                      >
                        <View
                          className={`w-1.5 h-1.5 rounded-full ${
                            farm.is_active ? "bg-primary" : "bg-outline"
                          }`}
                        />
                        <Text
                          className={`text-[10px] uppercase font-bold ${
                            farm.is_active ? "text-primary" : "text-on-surface-variant"
                          }`}
                        >
                          {farm.is_active ? "Active" : "Inactive"}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-label-md text-outline font-mono mt-1">
                      {farm.id.split("-")[0].toUpperCase()}
                    </Text>
                  </View>
                  <Pressable className="w-8 h-8 rounded-full flex items-center justify-center text-outline active:bg-surface-container">
                    <MaterialIcons name="more-vert" size={20} color="#717973" />
                  </Pressable>
                </View>

                <View className="flex-col gap-2 mt-2">
                  <View className="flex-row items-center gap-2">
                    <MaterialIcons name="call" size={16} color="#717973" />
                    <Text className="text-body-md text-primary font-semibold">
                      {farm.contact_phone || "No Contact"}
                    </Text>
                  </View>
                  <View className="flex-row items-start mt-3 pt-3 border-t border-gray-100">
                    <MaterialIcons name="location-on" size={16} color="#64748b" />
                    <Text className="flex-1 ml-2 text-sm text-gray-600">
                      {farm.address || farm.location || "No address provided"}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <MaterialIcons name="warehouse" size={16} color="#717973" />
                    <Text className="text-body-md text-on-surface-variant">
                      Capacity: {farm.capacity ? `${farm.capacity} Birds` : "Unknown"}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Bottom Navigation Bar */}
      <View className="absolute bottom-0 inset-x-0 bg-surface/90 border-t border-outline-variant/20 flex-row justify-around items-center px-2 z-40 px-2 pt-2" style={{ paddingBottom: Math.max(insets.bottom, 12), height: 60 + Math.max(insets.bottom, 12) }}>
        <Pressable 
          className="flex-col items-center justify-center gap-1 w-20"
          onPress={() => navigation.navigate("AdminHome")}
        >
          <MaterialIcons name="grid-view" size={24} color="#414844" />
          <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
            Dashboard
          </Text>
        </Pressable>
        <Pressable 
          className="flex-col items-center justify-center gap-1 w-20"
          onPress={() => navigation.navigate("Retailers")}
        >
          <MaterialIcons name="group" size={24} color="#414844" />
          <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
            Retailers
          </Text>
        </Pressable>
        <Pressable className="flex-col items-center justify-center gap-1 w-20">
          <View className="bg-primary-container/30 px-4 py-1 rounded-full mb-1">
            <MaterialIcons name="agriculture" size={24} color="#012d1d" />
          </View>
          <Text className="font-label-md text-label-md text-primary font-semibold -mt-1">
            Farms
          </Text>
        </Pressable>
        <Pressable 
          className="flex-col items-center justify-center gap-1 w-20"
          onPress={() => navigation.navigate("Orders")}
        >
          <MaterialIcons name="shopping-cart" size={24} color="#414844" />
          <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
            Orders
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
