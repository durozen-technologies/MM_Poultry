import React, { useState, useMemo, useCallback } from "react";
import {
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
  ScrollView,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useAdminFarms } from "../../hooks/use-queries";
import type { FarmOut } from "../../types/api";
import { updateFarm } from "../../api/farms";

import { AdminScreenContainer } from "../../components/admin/admin-screen-container";
import { AdminHeader } from "../../components/admin/admin-header";

export function AdminFarmsInfoScreen({ navigation }: { navigation: any }) {
  const { data, isLoading, refetch } = useAdminFarms();

  const farms = data?.farms || [];
  const [openMenuFarmId, setOpenMenuFarmId] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"All" | "Active" | "Inactive">("All");

  const filteredFarms = useMemo(() => {
    return farms.filter((f) => {
      if (searchQuery && !f.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (filter === "Active" && !f.is_active) return false;
      if (filter === "Inactive" && f.is_active) return false;
      return true;
    });
  }, [farms, searchQuery, filter]);

  const activeCount = useMemo(() => farms.filter(f => f.is_active).length, [farms]);

  return (
    <AdminScreenContainer
      noScroll
      header={
        <AdminHeader 
          title="Farms Info" 
          subtitle="Manage your supplier farms"
          onBack={() => navigation.goBack()} 
          rightContent={
            <Pressable
              accessibilityRole="button"
              className="h-10 px-4 rounded-full flex-row items-center justify-center bg-primary active:bg-primary/90 shadow-sm shadow-primary/30"
              onPress={() => navigation.navigate("AddFarm")}
            >
              <MaterialIcons name="add" size={20} color="white" className="mr-1" />
              <Text className="text-label-md text-white font-bold">Add</Text>
            </Pressable>
          }
        />
      }
    >
      <FlatList
        data={filteredFarms}
        keyExtractor={(item) => item.id}
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        onScroll={() => setOpenMenuFarmId(null)}
        scrollEventThrottle={16}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        ListHeaderComponent={
          <>
            <View className="flex-col gap-4 mb-6 pt-2">
              {/* Summary Cards */}
              <View className="flex-row gap-4 mb-2">
                <View className="flex-1 bg-primary rounded-2xl p-4 shadow-sm relative overflow-hidden">
                  <View className="absolute -right-4 -top-4 w-16 h-16 bg-white/10 rounded-full" />
                  <Text className="font-label-md text-primary-fixed font-bold mb-1 uppercase tracking-wider">Total Farms</Text>
                  <Text className="font-display-md text-white font-bold">{farms.length}</Text>
                </View>
                <View className="flex-1 bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant/30 relative overflow-hidden">
                  <View className="absolute right-3 top-3 w-8 h-8 bg-primary/10 rounded-full items-center justify-center">
                    <MaterialIcons name="agriculture" size={16} className="text-primary" />
                  </View>
                  <Text className="font-label-md text-on-surface-variant font-bold mb-1 uppercase tracking-wider">Active</Text>
                  <Text className="font-display-md text-primary font-bold">{activeCount}</Text>
                </View>
              </View>

              {/* Search Box */}
              <View className="relative flex-row items-center">
                <View className="absolute left-4 z-10">
                  <MaterialIcons name="search" size={20} className="text-on-surface-variant" />
                </View>
                <TextInput
                  placeholderTextColor="#9ca3af"
                  className="flex-1 h-13 pl-12 pr-4 bg-surface-container-lowest border border-outline-variant/50 rounded-xl text-body-lg text-on-surface focus:border-primary shadow-sm"
                  placeholder="Search farms..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>

              {/* Filters */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row overflow-visible">
                {(["All", "Active", "Inactive"] as const).map((f) => (
                  <Pressable
                    key={f}
                    onPress={() => setFilter(f)}
                    className={`h-10 px-5 rounded-full flex items-center justify-center border mr-3 transition-colors ${
                      filter === f 
                        ? "bg-primary border-primary" 
                        : "bg-surface-container-lowest border-outline-variant/30"
                    }`}
                  >
                    <Text
                      className={`font-label-md font-bold ${
                        filter === f ? "text-white" : "text-on-surface-variant"
                      }`}
                    >
                      {f}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </>
        }
        ListEmptyComponent={
          !isLoading ? (
            <View className="flex-col items-center justify-center py-12 px-4 border border-dashed border-outline-variant/50 rounded-3xl mt-4">
              <View className="w-16 h-16 bg-surface-variant/30 rounded-full items-center justify-center mb-4">
                <MaterialIcons name="agriculture" size={32} className="text-on-surface-variant/70" />
              </View>
              <Text className="font-title-lg text-on-surface mb-2 font-bold text-center">
                No farms found
              </Text>
              <Text className="text-body-md text-on-surface-variant text-center max-w-[250px]">
                {searchQuery || filter !== "All" 
                  ? "Try adjusting your search or filters." 
                  : "Add a new farm to start recording farm loads."}
              </Text>
            </View>
          ) : null
        }
        ItemSeparatorComponent={ItemSeparator}
        renderItem={({ item: farm }) => (
          <FarmInfoListItem 
            farm={farm}
            isOpen={openMenuFarmId === farm.id}
            onToggleMenu={() => setOpenMenuFarmId(openMenuFarmId === farm.id ? null : farm.id)}
            onCloseMenu={() => setOpenMenuFarmId(null)}
            navigation={navigation}
            refetch={refetch}
          />
        )}
      />
    </AdminScreenContainer>
  );
}

const ItemSeparator = React.memo(() => <View className="h-4" />);

const FarmInfoListItem = React.memo(({ 
  farm, 
  isOpen, 
  onToggleMenu, 
  onCloseMenu, 
  navigation, 
  refetch 
}: { 
  farm: FarmOut; 
  isOpen: boolean; 
  onToggleMenu: () => void; 
  onCloseMenu: () => void; 
  navigation: any; 
  refetch: () => void; 
}) => {
  return (
    <View
      className={`bg-surface-container-lowest rounded-3xl p-5 shadow-sm border ${farm.is_active ? 'border-primary/20' : 'border-outline-variant/20'} flex-col relative overflow-hidden`}
      style={{ zIndex: isOpen ? 50 : 0, elevation: isOpen ? 10 : 0 }}
    >
      {farm.is_active && (
        <View className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
      )}
      
      <View className="flex-row justify-between items-start mb-4 ml-1">
        <View className="flex-col flex-1 pr-4">
          <Text className="text-title-lg text-on-surface font-bold tracking-tight mb-1">
            {farm.name}
          </Text>
          <View className="flex-row items-center">
            <View
              className={`w-2 h-2 rounded-full mr-2 ${
                farm.is_active ? "bg-primary" : "bg-outline-variant"
              }`}
            />
            <Text
              className={`font-label-sm font-bold uppercase tracking-wider ${
                farm.is_active ? "text-primary" : "text-on-surface-variant"
              }`}
            >
              {farm.is_active ? "Active" : "Inactive"}
            </Text>
          </View>
        </View>

        <View className="relative z-50">
          <Pressable
            accessibilityRole="button"
            className="w-10 h-10 rounded-full flex items-center justify-center bg-surface-variant/30 active:bg-surface-variant/70 transition-colors"
            onPress={onToggleMenu}
          >
            <MaterialIcons name="more-vert" size={20} className="text-on-surface-variant" />
          </Pressable>

          {isOpen && (
            <View className="absolute top-12 right-0 bg-surface-container-lowest rounded-2xl shadow-md border border-outline-variant/20 overflow-hidden w-48 z-50" style={{ elevation: 10 }}>
              <Pressable 
                className="flex-row items-center gap-3 px-4 py-3.5 active:bg-surface-variant/50"
                onPress={() => {
                  onCloseMenu();
                  navigation.navigate("AdminEditFarm", { farmId: farm.id });
                }}
              >
                <MaterialIcons name="edit" size={20} className="text-on-surface" />
                <Text className="font-label-md text-on-surface font-semibold">Edit Farm</Text>
              </Pressable>
              
              <Pressable 
                className="flex-row items-center gap-3 px-4 py-3.5 active:bg-surface-variant/50 border-t border-surface-variant/30"
                onPress={async () => {
                  onCloseMenu();
                  try {
                    await updateFarm(farm.id, { is_active: !farm.is_active });
                    refetch();
                  } catch (e) {
                    console.error("Failed to toggle active status", e);
                  }
                }}
              >
                <MaterialIcons 
                  name={farm.is_active ? "block" : "check-circle-outline"} 
                  size={20} 
                  className={farm.is_active ? "text-error" : "text-primary"} 
                />
                <Text className={`font-label-md font-semibold ${farm.is_active ? "text-error" : "text-primary"}`}>
                  {farm.is_active ? "Mark Inactive" : "Mark Active"}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>

      <View className="bg-surface-container-highest/30 rounded-2xl p-4 ml-1 border border-outline-variant/10">
        <View className="flex-row items-center gap-3 mb-3">
          <View className="w-8 h-8 rounded-full bg-secondary/10 items-center justify-center">
            <MaterialIcons name="call" size={16} className="text-secondary" />
          </View>
          <Text className="text-body-lg text-on-surface font-bold">
            {farm.contact_phone || "No Contact"}
          </Text>
        </View>
        
        <View className="flex-row items-start gap-3">
          <View className="w-8 h-8 rounded-full bg-tertiary/10 items-center justify-center mt-0.5">
            <MaterialIcons name="location-on" size={16} className="text-tertiary" />
          </View>
          <Text className="flex-1 text-body-md text-on-surface-variant font-medium leading-relaxed">
            {farm.address || farm.location || "No address provided"}
          </Text>
        </View>
      </View>
    </View>
  );
});
