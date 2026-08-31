import React, { useState } from "react";
import { View, Text, FlatList, ActivityIndicator, Pressable, TextInput, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiItems } from "../../api/items";
import type { Item } from "../../types/api";
import { Ionicons } from "@expo/vector-icons";

export function AdminItemsScreen({ navigation }: { navigation: any }) {
  const queryClient = useQueryClient();
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  const { data: page, isLoading, refetch } = useQuery({
    queryKey: ["admin_items"],
    queryFn: () => apiItems.list(),
  });

  const createMutation = useMutation({
    mutationFn: apiItems.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_items"] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...payload }: any) => apiItems.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_items"] });
      resetForm();
    },
  });

  const resetForm = () => {
    setEditingItem(null);
    setIsAdding(false);
    setName("");
    setDescription("");
    setIsActive(true);
  };

  const handleEdit = (item: Item) => {
    setEditingItem(item);
    setName(item.name);
    setDescription(item.description || "");
    setIsActive(item.is_active);
    setIsAdding(false);
  };

  const handleSave = () => {
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    if (!trimmedName) return;
    if (editingItem) {
      updateMutation.mutate({
        id: editingItem.id,
        name: trimmedName,
        description: trimmedDescription || null,
        is_active: isActive,
      });
    } else {
      createMutation.mutate({
        name: trimmedName,
        description: trimmedDescription || undefined,
      });
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background" edges={["top", "bottom"]}>
        <ActivityIndicator size="large" className="text-primary" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="h-16 px-4 flex-row items-center justify-between bg-surface/90 border-b border-outline-variant/20">
        <View className="flex-row items-center">
          <Pressable accessibilityRole="button" className="w-11 h-11 -ml-2 items-center justify-center rounded-full active:bg-surface-variant/50" onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={24} className="text-on-surface" />
          </Pressable>
          <Text className="font-headline-sm text-on-surface font-semibold ml-2">Items</Text>
        </View>
        {!isAdding && !editingItem && (
          <Pressable
            onPress={() => setIsAdding(true)}
            className="bg-primary px-4 h-10 rounded-full flex-row items-center active:scale-95"
          >
            <MaterialIcons name="add" size={20} className="text-on-primary" />
            <Text className="text-on-primary font-semibold ml-1">Add Item</Text>
          </Pressable>
        )}
      </View>

      <View className="flex-1 p-4">
        {(isAdding || editingItem) && (
          <View className="bg-surface-container-lowest p-4 rounded-2xl shadow-sm mb-4 border border-outline-variant/20">
            <Text className="font-headline-sm text-on-surface mb-4">
              {editingItem ? "Edit Item" : "New Item"}
            </Text>
            
            <View className="mb-4">
              <Text className="font-label-md text-on-surface-variant mb-1 uppercase font-semibold">Name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Broiler Chicken"
                placeholderTextColor="#717973"
                className="bg-surface border border-outline-variant rounded-lg p-3 text-on-surface font-body-md h-12"
              />
            </View>
            
            <View className="mb-4">
              <Text className="font-label-md text-on-surface-variant mb-1 uppercase font-semibold">Description</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Optional description"
                placeholderTextColor="#717973"
                className="bg-surface border border-outline-variant rounded-lg p-3 text-on-surface font-body-md h-12"
              />
            </View>

            {editingItem && (
              <View className="flex-row items-center justify-between mb-4">
                <Text className="font-label-md text-on-surface-variant uppercase font-semibold">Active</Text>
                <Switch value={isActive} onValueChange={setIsActive} trackColor={{ false: "#e0e3e8", true: "#1B4332" }} thumbColor={isActive ? "#ffffff" : "#717973"} />
              </View>
            )}

            <View className="flex-row gap-3">
              <Pressable
                onPress={resetForm}
                className="flex-1 bg-surface-variant p-3 rounded-xl items-center justify-center active:scale-95 h-12"
              >
                <Text className="text-on-surface-variant font-semibold">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending || !name}
                className={`flex-1 p-3 rounded-xl items-center justify-center h-12 active:scale-95 ${
                  !name ? "bg-surface-variant opacity-50" : "bg-primary"
                }`}
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className={`font-semibold ${!name ? "text-on-surface-variant" : "text-on-primary"}`}>Save</Text>
                )}
              </Pressable>
            </View>
          </View>
        )}

        <FlatList
          data={page?.items || []}
          contentContainerStyle={{ paddingBottom: 80 }}
          keyExtractor={(item) => item.id}
          refreshing={isLoading}
          onRefresh={refetch}
          renderItem={({ item }) => (
            <View className="bg-surface-container-lowest p-4 rounded-2xl shadow-sm mb-3 flex-row items-center justify-between border border-outline-variant/20">
              <View className="flex-1">
                <Text className="font-headline-sm text-on-surface">
                  {item.name}
                </Text>
                {item.description ? (
                  <Text className="font-body-md text-on-surface-variant mt-1">
                    {item.description}
                  </Text>
                ) : null}
                <View className="flex-row mt-2">
                  {!item.is_active && (
                    <View className="bg-error-container px-2 py-1 rounded-md">
                      <Text className="text-on-error-container text-[10px] uppercase font-semibold">Inactive</Text>
                    </View>
                  )}
                </View>
              </View>
              <Pressable
                onPress={() => handleEdit(item)}
                className="p-3 bg-primary-container/10 rounded-full active:bg-primary-container/30"
              >
                <Ionicons name="pencil" size={18} className="text-primary" />
              </Pressable>
            </View>
          )}
          ListEmptyComponent={
            <View className="items-center justify-center py-8">
              <Ionicons name="cube-outline" size={48} className="text-outline" />
              <Text className="font-body-md text-on-surface-variant mt-4">No items found.</Text>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}
