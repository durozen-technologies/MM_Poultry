import React, { useState, useMemo, useCallback } from "react";
import { View, Text, FlatList, ActivityIndicator, Pressable, TextInput, Switch } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiItems } from "../../api/items";
import type { Item } from "../../types/api";

import { AdminScreenContainer } from "../../components/admin/admin-screen-container";
import { AdminHeader } from "../../components/admin/admin-header";
import { AdminCard } from "../../components/admin/admin-card";

export function AdminItemsScreen({ navigation }: { navigation: any }) {
  const queryClient = useQueryClient();
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  const { data: page, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["admin_items"],
    queryFn: () => apiItems.list(),
  });

  const createMutation = useMutation({
    mutationFn: apiItems.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_items"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...payload }: any) => apiItems.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_items"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] });
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

  const items = useMemo(() => page?.items || [], [page?.items]);
  const activeCount = useMemo(() => items.filter((i: Item) => i.is_active).length, [items]);

  return (
    <AdminScreenContainer
      noScroll
      header={
        <AdminHeader 
          title="Product Items" 
          subtitle="Manage inventory item categories"
          onBack={() => navigation.goBack()} 
          rightContent={
            <View className="flex-row gap-2">
              <Pressable
                accessibilityRole="button"
                className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container-highest active:bg-surface-variant"
                onPress={() => refetch()}
              >
                {isRefetching ? (
                  <ActivityIndicator size="small" className="text-primary" />
                ) : (
                  <MaterialIcons name="refresh" size={22} className="text-on-surface" />
                )}
              </Pressable>
              {!isAdding && !editingItem && (
                <Pressable
                  accessibilityRole="button"
                  className="h-10 px-4 rounded-full flex-row items-center justify-center bg-primary active:bg-primary/90 shadow-sm shadow-primary/30"
                  onPress={() => setIsAdding(true)}
                >
                  <MaterialIcons name="add" size={20} color="white" className="mr-1.5" />
                  <Text className="text-label-md text-white font-bold">Add</Text>
                </Pressable>
              )}
            </View>
          }
        />
      }
    >
      <FlatList
        data={items}
        contentContainerStyle={{ paddingBottom: 40 }}
        keyExtractor={(item) => item.id}
        refreshing={isLoading}
        onRefresh={refetch}
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        ListHeaderComponent={
          <>
            <View className="pt-2">
              {/* Form Card */}
              {(isAdding || editingItem) && (
                <View className="mb-6">
                  <AdminCard 
                    title={editingItem ? "Edit Item" : "New Item"} 
                    icon={editingItem ? "edit" : "add-circle"} 
                    iconColorClass="text-secondary" 
                    iconBgClass="bg-secondary/10" 
                    containerClass="relative"
                  >
                    <Pressable 
                      className="absolute top-4 right-4 w-8 h-8 rounded-full bg-surface-variant/30 items-center justify-center z-10"
                      onPress={resetForm}
                    >
                      <MaterialIcons name="close" size={16} className="text-on-surface-variant" />
                    </Pressable>
                    
                    <View className="flex-col gap-4">
                      <View>
                        <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1">Item Name <Text className="text-error">*</Text></Text>
                        <View className="relative flex-row items-center">
                          <View className="absolute left-4 z-10">
                            <MaterialIcons name="inventory" size={20} className="text-on-surface-variant" />
                          </View>
                          <TextInput 
                            className="w-full bg-surface-container-lowest h-14 rounded-xl border border-outline-variant/50 pl-12 pr-4 font-body-lg text-on-surface focus:border-primary" 
                            placeholder="e.g. Broiler Chicken" 
                            value={name} 
                            onChangeText={setName} 
                            placeholderTextColor="#9ca3af" 
                          />
                        </View>
                      </View>
                      
                      <View>
                        <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1">Description (Optional)</Text>
                        <View className="relative flex-row items-center">
                          <View className="absolute left-4 z-10">
                            <MaterialIcons name="description" size={20} className="text-on-surface-variant" />
                          </View>
                          <TextInput 
                            className="w-full bg-surface-container-lowest h-14 rounded-xl border border-outline-variant/50 pl-12 pr-4 font-body-lg text-on-surface focus:border-primary" 
                            placeholder="Brief description of the item" 
                            value={description} 
                            onChangeText={setDescription} 
                            placeholderTextColor="#9ca3af" 
                          />
                        </View>
                      </View>

                      {editingItem && (
                        <View className="flex-row items-center justify-between p-3 bg-surface-container-highest/30 rounded-xl border border-outline-variant/10">
                          <View className="flex-row items-center gap-2">
                            <MaterialIcons name={isActive ? "check-circle" : "cancel"} size={20} className={isActive ? "text-primary" : "text-on-surface-variant"} />
                            <Text className="font-label-md font-bold text-on-surface">Active Status</Text>
                          </View>
                          <Switch 
                            value={isActive} 
                            onValueChange={setIsActive} 
                            trackColor={{ false: "#e0e3e8", true: "#115E29" }} 
                            thumbColor={isActive ? "#ffffff" : "#717973"} 
                          />
                        </View>
                      )}

                      <Pressable 
                        className={`h-13 mt-2 rounded-xl flex-row items-center justify-center gap-2 active:scale-[0.98] transition-transform ${
                          !name.trim() ? "bg-surface-variant" : "bg-primary shadow-sm shadow-primary/30"
                        }`}
                        onPress={handleSave}
                        disabled={createMutation.isPending || updateMutation.isPending || !name.trim()}
                      >
                        {createMutation.isPending || updateMutation.isPending ? (
                          <ActivityIndicator color="#ffffff" />
                        ) : (
                          <>
                            <MaterialIcons name={editingItem ? "save" : "add-circle"} size={18} color={!name.trim() ? "#717973" : "white"} />
                            <Text className={`font-bold text-label-lg ${!name.trim() ? "text-on-surface-variant" : "text-white"}`}>
                              {editingItem ? "Save Changes" : "Create Item"}
                            </Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                  </AdminCard>
                </View>
              )}

              {/* KPI Banner */}
              {!isAdding && !editingItem && items.length > 0 && (
                <View className="bg-primary/10 rounded-2xl p-4 border border-primary/20 flex-row items-center justify-between mb-6 shadow-sm">
                  <View className="flex-row items-center gap-3">
                    <View className="w-10 h-10 rounded-full bg-primary/20 items-center justify-center">
                      <MaterialIcons name="category" size={20} className="text-primary" />
                    </View>
                    <View>
                      <Text className="font-label-md text-primary font-bold tracking-wider uppercase mb-0.5">Active Items</Text>
                      <View className="flex-row items-end gap-1">
                        <Text className="font-display-sm text-primary font-black leading-tight">{activeCount}</Text>
                        <Text className="font-body-md text-primary/80 font-bold mb-0.5">/ {items.length}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {/* List Header */}
              <View className="flex-row items-center justify-between ml-1 mb-3">
                <Text className="font-title-lg text-on-surface font-bold">All Items</Text>
              </View>

            </View>
          </>
        }
        ListEmptyComponent={
          isLoading ? (
            <View className="py-12 items-center">
              <ActivityIndicator size="large" className="text-primary mb-4" />
              <Text className="text-on-surface-variant font-medium">Loading items...</Text>
            </View>
          ) : (
            <View className="bg-surface-container-lowest rounded-3xl p-8 border border-dashed border-outline-variant/50 items-center justify-center mb-6 mt-2">
              <View className="w-16 h-16 bg-surface-variant/30 rounded-full items-center justify-center mb-4">
                <MaterialIcons name="inventory-2" size={32} className="text-on-surface-variant/70" />
              </View>
              <Text className="font-title-md text-on-surface font-bold mb-1">No Items Found</Text>
              <Text className="font-body-md text-on-surface-variant text-center mb-6">
                You haven't defined any product items yet. Create your first item to start managing inventory.
              </Text>
              {!isAdding && !editingItem && (
                <Pressable
                  className="bg-primary px-6 py-3 rounded-full flex-row items-center"
                  onPress={() => setIsAdding(true)}
                >
                  <MaterialIcons name="add" size={20} color="white" className="mr-2" />
                  <Text className="text-white font-bold">Add First Item</Text>
                </Pressable>
              )}
            </View>
          )
        }
        ItemSeparatorComponent={ItemSeparator}
        renderItem={({ item }) => <ItemListItem item={item} onEdit={handleEdit} />}
      />
    </AdminScreenContainer>
  );
}

const ItemSeparator = React.memo(() => <View className="h-3" />);

const ItemListItem = React.memo(({ item, onEdit }: { item: Item; onEdit: (item: Item) => void }) => {
  return (
    <View className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/20 flex-row justify-between items-center relative overflow-hidden">
      <View className={`absolute top-0 left-0 w-1.5 h-full z-10 ${item.is_active ? 'bg-primary' : 'bg-surface-variant'}`} />
      
      <View className="p-4 pl-5 flex-1 flex-row items-center gap-4">
        <View className={`w-12 h-12 rounded-full items-center justify-center ${item.is_active ? 'bg-primary/10' : 'bg-surface-variant/30'}`}>
          <MaterialIcons name="inventory" size={24} className={item.is_active ? 'text-primary' : 'text-on-surface-variant'} />
        </View>
        
        <View className="flex-1 pr-2">
          <View className="flex-row items-center gap-2 mb-1">
            <Text className="font-title-md text-on-surface font-bold">{item.name}</Text>
            {!item.is_active && (
              <View className="bg-surface-variant/50 px-2 py-0.5 rounded-full">
                <Text className="text-on-surface-variant text-[10px] uppercase font-bold tracking-wider">Inactive</Text>
              </View>
            )}
          </View>
          {item.description ? (
            <Text className="font-body-md text-on-surface-variant truncate" numberOfLines={1}>
              {item.description}
            </Text>
          ) : (
            <Text className="font-body-sm text-on-surface-variant/50 italic">No description</Text>
          )}
        </View>
      </View>

      <Pressable 
        accessibilityRole="button" 
        onPress={() => onEdit(item)} 
        className="w-12 h-12 rounded-full items-center justify-center mr-2 active:bg-surface-container-highest transition-colors"
      >
        <MaterialIcons name="edit" size={20} className="text-on-surface-variant" />
      </Pressable>
    </View>
  );
});
