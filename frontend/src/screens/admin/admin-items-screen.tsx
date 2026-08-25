import React, { useState } from "react";
import { View, Text, FlatList, ActivityIndicator, Pressable, TextInput, Switch } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiItems } from "../../api/items";
import type { Item } from "../../types/api";
import { Ionicons } from "@expo/vector-icons";

export function AdminItemsScreen() {
  const queryClient = useQueryClient();
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [defaultPrice, setDefaultPrice] = useState("");
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
    setDefaultPrice("");
    setIsActive(true);
  };

  const handleEdit = (item: Item) => {
    setEditingItem(item);
    setName(item.name);
    setDescription(item.description || "");
    setDefaultPrice(item.default_price);
    setIsActive(item.is_active);
    setIsAdding(false);
  };

  const handleSave = () => {
    if (!name || !defaultPrice) return;
    
    if (editingItem) {
      updateMutation.mutate({
        id: editingItem.id,
        name,
        description,
        default_price: defaultPrice,
        is_active: isActive,
      });
    } else {
      createMutation.mutate({
        name,
        description,
        default_price: defaultPrice,
      });
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-gray-900">
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-900 p-4">
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-2xl font-bold text-gray-900 dark:text-white">Items</Text>
        {!isAdding && !editingItem && (
          <Pressable
            onPress={() => setIsAdding(true)}
            className="bg-blue-600 px-4 py-2 rounded-lg flex-row items-center"
          >
            <Ionicons name="add" size={20} color="white" />
            <Text className="text-white font-medium ml-1">Add Item</Text>
          </Pressable>
        )}
      </View>

      {(isAdding || editingItem) && (
        <View className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm mb-4">
          <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {editingItem ? "Edit Item" : "New Item"}
          </Text>
          
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Broiler Chicken"
              className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-gray-900 dark:text-white"
            />
          </View>
          
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Optional description"
              className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-gray-900 dark:text-white"
            />
          </View>
          
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Default Price (₹/kg)</Text>
            <TextInput
              value={defaultPrice}
              onChangeText={setDefaultPrice}
              keyboardType="decimal-pad"
              placeholder="e.g. 150.00"
              className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-gray-900 dark:text-white"
            />
          </View>

          {editingItem && (
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">Active</Text>
              <Switch value={isActive} onValueChange={setIsActive} />
            </View>
          )}

          <View className="flex-row space-x-3">
            <Pressable
              onPress={resetForm}
              className="flex-1 bg-gray-200 dark:bg-gray-700 p-3 rounded-lg items-center"
            >
              <Text className="text-gray-700 dark:text-gray-200 font-medium">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending || !name || !defaultPrice}
              className={`flex-1 p-3 rounded-lg items-center ${
                !name || !defaultPrice ? "bg-blue-400" : "bg-blue-600"
              }`}
            >
              {createMutation.isPending || updateMutation.isPending ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-medium">Save</Text>
              )}
            </Pressable>
          </View>
        </View>
      )}

      <FlatList
        data={page?.items || []}
        keyExtractor={(item) => item.id}
        refreshing={isLoading}
        onRefresh={refetch}
        renderItem={({ item }) => (
          <View className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm mb-3 flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-lg font-semibold text-gray-900 dark:text-white">
                {item.name}
              </Text>
              {item.description ? (
                <Text className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {item.description}
                </Text>
              ) : null}
              <View className="flex-row mt-2">
                <View className="bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded">
                  <Text className="text-blue-700 dark:text-blue-400 text-xs font-medium">
                    ₹{item.default_price}/kg
                  </Text>
                </View>
                {!item.is_active && (
                  <View className="bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded ml-2">
                    <Text className="text-red-700 dark:text-red-400 text-xs font-medium">Inactive</Text>
                  </View>
                )}
              </View>
            </View>
            <Pressable
              onPress={() => handleEdit(item)}
              className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full"
            >
              <Ionicons name="pencil" size={18} color="#4b5563" />
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <View className="items-center justify-center py-8">
            <Ionicons name="cube-outline" size={48} color="#9ca3af" />
            <Text className="text-gray-500 dark:text-gray-400 mt-4">No items found.</Text>
          </View>
        }
      />
    </View>
  );
}
