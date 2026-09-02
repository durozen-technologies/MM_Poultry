import React, { useCallback, useState, useMemo } from "react";
import { FlatList, ActivityIndicator, Pressable, Text, TextInput, View, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { deleteRetailerUser, listRetailerUsers, updateRetailerUser } from "../../api/users";
import { getApiErrorMessage } from "../../api/client";
import type { User } from "../../types/api";

import { AdminScreenContainer } from "../../components/admin/admin-screen-container";
import { AdminHeader } from "../../components/admin/admin-header";

export function AdminRetailerUsersScreen({ navigation }: { navigation: any }) {
  const queryClient = useQueryClient();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await listRetailerUsers());
    } catch (e) {
      setMsg({ text: getApiErrorMessage(e), ok: false });
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      setUsers(await listRetailerUsers());
    } catch (e) {
      setMsg({ text: getApiErrorMessage(e), ok: false });
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  async function onToggleStatus(user: User) {
    try {
      await updateRetailerUser(user.id, { is_active: !user.is_active });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "retailers"] });
      setMsg({ text: `User ${user.username} ${!user.is_active ? 'activated' : 'deactivated'}`, ok: true });
      setTimeout(() => setMsg(null), 3000);
      await refresh();
    } catch (e) {
      setMsg({ text: getApiErrorMessage(e), ok: false });
    }
  }

  async function onRemove(user: User) {
    try {
      await deleteRetailerUser(user.id);
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "retailers"] });
      setMsg({ text: `User ${user.username} removed`, ok: true });
      setTimeout(() => setMsg(null), 3000);
      await refresh();
    } catch (e) {
      setMsg({ text: getApiErrorMessage(e), ok: false });
    }
  }

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (searchQuery) {
        const search = searchQuery.toLowerCase();
        return (
          u.username.toLowerCase().includes(search) || 
          (u.retailer_shop_name && u.retailer_shop_name.toLowerCase().includes(search)) ||
          (u.retailer_name && u.retailer_name.toLowerCase().includes(search))
        );
      }
      return true;
    });
  }, [users, searchQuery]);

  const activeUsers = useMemo(() => users.filter(u => u.is_active).length, [users]);

  return (
    <AdminScreenContainer
      noScroll
      header={
        <AdminHeader 
          title="Retailer Users" 
          subtitle="Manage app access for retailers"
          onBack={() => navigation.goBack()} 
          rightContent={
            <Pressable
              accessibilityRole="button"
              className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container-highest active:bg-surface-variant"
              onPress={refresh}
            >
              {loading ? (
                <ActivityIndicator size="small" className="text-primary" />
              ) : (
                <MaterialIcons name="refresh" size={22} className="text-on-surface" />
              )}
            </Pressable>
          }
        />
      }
    >
      <FlatList
        data={filteredUsers}
        keyExtractor={(u) => u.id}
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#012d1d"]} />}
        ListHeaderComponent={
          <>
            <View className="pt-2">
              {msg && (
                <View className={`p-4 rounded-xl mb-4 flex-row items-center ${msg.ok ? "bg-primary-container/80" : "bg-error-container/80"}`}>
                  <MaterialIcons name={msg.ok ? "check-circle" : "error-outline"} size={20} className={`${msg.ok ? "text-on-primary-container" : "text-error"} mr-2`} />
                  <Text className={`font-label-md font-semibold flex-1 ${msg.ok ? "text-on-primary-container" : "text-error"}`}>
                    {msg.text}
                  </Text>
                </View>
              )}

              {users.length > 0 && (
                <View className="flex-col gap-4 mb-6">
                  {/* KPI Banner */}
                  <View className="bg-primary/10 rounded-2xl p-4 border border-primary/20 flex-row items-center justify-between shadow-sm">
                    <View className="flex-row items-center gap-3">
                      <View className="w-10 h-10 rounded-full bg-primary/20 items-center justify-center">
                        <MaterialIcons name="storefront" size={20} className="text-primary" />
                      </View>
                      <View>
                        <Text className="font-label-md text-primary font-bold tracking-wider uppercase mb-0.5">Active Portals</Text>
                        <View className="flex-row items-end gap-1">
                          <Text className="font-display-sm text-primary font-black leading-tight">{activeUsers}</Text>
                          <Text className="font-body-md text-primary/80 font-bold mb-0.5">/ {users.length}</Text>
                        </View>
                      </View>
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
                      placeholder="Search users or retailers..."
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      autoCapitalize="none"
                    />
                    {searchQuery.length > 0 && (
                      <Pressable 
                        className="absolute right-4 p-1 z-10"
                        onPress={() => setSearchQuery("")}
                      >
                        <MaterialIcons name="close" size={16} className="text-on-surface-variant" />
                      </Pressable>
                    )}
                  </View>
                </View>
              )}

              <View className="flex-row items-center justify-between ml-1 mb-3">
                <Text className="font-title-lg text-on-surface font-bold">User Directory</Text>
                {users.length > 0 && (
                  <View className="bg-surface-container-highest px-3 py-1 rounded-full">
                    <Text className="font-label-sm text-on-surface-variant font-bold">{filteredUsers.length} Users</Text>
                  </View>
                )}
              </View>
            </View>
          </>
        }
        ListEmptyComponent={
          loading && users.length === 0 ? (
            <View className="py-12 items-center">
              <ActivityIndicator size="large" className="text-primary mb-4" />
              <Text className="text-on-surface-variant font-medium">Loading users...</Text>
            </View>
          ) : (
            <View className="bg-surface-container-lowest rounded-3xl p-8 border border-dashed border-outline-variant/50 items-center justify-center mb-6 mt-2">
              <View className="w-16 h-16 bg-surface-variant/30 rounded-full items-center justify-center mb-4">
                <MaterialIcons name="person-off" size={32} className="text-on-surface-variant/70" />
              </View>
              <Text className="font-title-md text-on-surface font-bold mb-1">
                {searchQuery ? "No matching users" : "No Retailer Users"}
              </Text>
              <Text className="font-body-md text-on-surface-variant text-center">
                {searchQuery 
                  ? "Try a different search term" 
                  : "Retailer portal accounts are created when you add a new retailer to the system."}
              </Text>
            </View>
          )
        }
        ItemSeparatorComponent={ItemSeparator}
        renderItem={({ item: u }) => <RetailerUserCard user={u} onToggleStatus={onToggleStatus} onRemove={onRemove} />}
      />
    </AdminScreenContainer>
  );
}

const ItemSeparator = React.memo(() => <View className="h-3" />);

const RetailerUserCard = React.memo(({ user, onToggleStatus, onRemove }: { user: User; onToggleStatus: (u: User) => void; onRemove: (u: User) => void }) => {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  async function onUpdatePassword() {
    if (!newPassword.trim()) return;
    setIsUpdating(true);
    setMsg(null);
    try {
      await updateRetailerUser(user.id, { password: newPassword });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "retailers"] });
      setNewPassword("");
      setIsEditing(false);
      setMsg({ text: "Password updated successfully", ok: true });
      setTimeout(() => setMsg(null), 3000);
    } catch (e) {
      setMsg({ text: getApiErrorMessage(e), ok: false });
      setTimeout(() => setMsg(null), 4000);
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <View className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/20 relative overflow-hidden">
      {/* Left border status indicator */}
      <View className={`absolute top-0 left-0 w-1.5 h-full z-10 ${user.is_active ? 'bg-primary' : 'bg-surface-variant'}`} />

      <View className="p-4 pl-5">
        <View className="flex-row justify-between items-start mb-3">
          <View className="flex-1 pr-2">
            <View className="flex-row items-center gap-2 mb-1">
              <Text className="font-title-lg text-on-surface font-bold">{user.username}</Text>
              <View className={`px-2 py-0.5 rounded-full border ${
                user.is_active ? "bg-primary/10 border-primary/20" : "bg-surface-variant/30 border-outline-variant/20"
              }`}>
                <Text className={`font-label-sm uppercase tracking-widest font-bold ${
                  user.is_active ? "text-primary" : "text-on-surface-variant"
                }`}>
                  {user.is_active ? "Active" : "Inactive"}
                </Text>
              </View>
            </View>
            
            <View className="flex-row items-center mt-1">
              <MaterialIcons name="storefront" size={14} className="text-on-surface-variant mr-1.5" />
              <Text className="font-body-md text-on-surface-variant font-medium">
                {user.retailer_shop_name || user.retailer_name || "Unknown Retailer"}
              </Text>
            </View>
          </View>
          
          <View className="flex-row gap-2">
            <Pressable 
              accessibilityRole="button" 
              onPress={() => setIsEditing(!isEditing)} 
              className={`w-9 h-9 rounded-full items-center justify-center transition-colors ${
                isEditing ? "bg-primary text-white" : "bg-surface-container-high active:bg-surface-variant"
              }`}
            >
              <MaterialIcons name="vpn-key" size={18} color={isEditing ? "white" : undefined} className={isEditing ? "" : "text-on-surface"} />
            </Pressable>
            <Pressable 
              accessibilityRole="button" 
              onPress={() => onToggleStatus(user)} 
              className={`w-9 h-9 rounded-full items-center justify-center border ${
                user.is_active ? "bg-error/5 border-error/20 active:bg-error/10" : "bg-primary/5 border-primary/20 active:bg-primary/10"
              }`}
            >
              <MaterialIcons name={user.is_active ? "block" : "check-circle"} size={18} className={user.is_active ? "text-error" : "text-primary"} />
            </Pressable>
          </View>
        </View>

        {msg && (
          <View className={`mb-3 p-2 rounded-lg flex-row items-center ${msg.ok ? "bg-primary/10" : "bg-error/10"}`}>
            <MaterialIcons name={msg.ok ? "check-circle" : "error-outline"} size={14} className={`${msg.ok ? "text-primary" : "text-error"} mr-1.5`} />
            <Text className={`font-label-sm font-bold flex-1 ${msg.ok ? "text-primary" : "text-error"}`}>
              {msg.text}
            </Text>
          </View>
        )}

        {isEditing && (
          <View className="mt-2 pt-3 border-t border-outline-variant/20 flex-col gap-3">
            <Text className="font-label-md font-bold text-on-surface">Reset Password</Text>
            <View className="flex-row gap-2 items-center">
              <View className="flex-1 flex-row items-center bg-surface-container-highest h-12 rounded-xl border border-outline-variant/50 px-3 focus:border-primary">
                <TextInput
                  className="flex-1 text-on-surface font-body-lg h-full placeholder:text-on-surface-variant/70 pr-2"
                  placeholder="New password"
                  secureTextEntry={!showPassword}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  autoCapitalize="none"
                  autoFocus
                />
                <Pressable accessibilityRole="button" onPress={() => setShowPassword(!showPassword)} className="p-2 -mr-2 active:opacity-70">
                  <MaterialCommunityIcons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} className="text-on-surface-variant" />
                </Pressable>
              </View>
              <Pressable 
                accessibilityRole="button" 
                onPress={onUpdatePassword} 
                disabled={isUpdating || !newPassword.trim()}
                className={`h-12 w-12 rounded-xl items-center justify-center active:scale-95 transition-transform ${
                  !newPassword.trim() ? "bg-surface-variant/50" : "bg-primary shadow-sm shadow-primary/30"
                }`}
              >
                {isUpdating ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <MaterialIcons name="check" size={22} color={!newPassword.trim() ? "#9ca3af" : "white"} />
                )}
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </View>
  );
});
