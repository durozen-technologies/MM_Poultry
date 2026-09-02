import React, { useCallback, useState, useMemo } from "react";
import { FlatList, ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { createDeliveryUser, deleteDeliveryUser, listDeliveryUsers } from "../../api/users";
import type { User } from "../../types/api";

import { AdminScreenContainer } from "../../components/admin/admin-screen-container";
import { AdminHeader } from "../../components/admin/admin-header";
import { AdminCard } from "../../components/admin/admin-card";

export function AdminDeliveryUsersScreen({ navigation }: { navigation: any }) {
  const [users, setUsers] = useState<User[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await listDeliveryUsers());
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Failed to load users", ok: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  async function onAdd() {
    if (!username.trim() || !password) {
      setMsg({ text: "Username and password are required", ok: false });
      return;
    }
    
    setCreating(true);
    setMsg(null);
    try {
      await createDeliveryUser({
        username: username.trim(),
        password,
        full_name: fullName.trim() || null,
        mobile_number: mobile.trim() || null,
      });
      setUsername("");
      setPassword("");
      setFullName("");
      setMobile("");
      setShowForm(false);
      setMsg({ text: "Delivery user created successfully", ok: true });
      setTimeout(() => setMsg(null), 3000);
      await refresh();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Failed to create user", ok: false });
    } finally {
      setCreating(false);
    }
  }

  async function onRemove(user: User) {
    try {
      await deleteDeliveryUser(user.id);
      setMsg({ text: "User removed successfully", ok: true });
      setTimeout(() => setMsg(null), 3000);
      await refresh();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Failed to remove user", ok: false });
    }
  }

  const activeUsers = useMemo(() => users.filter(u => u.is_active).length, [users]);

  return (
    <AdminScreenContainer
      noScroll
      header={
        <AdminHeader 
          title="Delivery Users" 
          subtitle="Manage app logins for drivers"
          onBack={() => navigation.goBack()} 
          rightContent={
            <View className="flex-row gap-2">
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
              {!showForm && (
                <Pressable
                  accessibilityRole="button"
                  className="h-10 px-4 rounded-full flex-row items-center justify-center bg-primary active:bg-primary/90 shadow-sm shadow-primary/30"
                  onPress={() => setShowForm(true)}
                >
                  <MaterialIcons name="person-add" size={20} color="white" className="mr-1.5" />
                  <Text className="text-label-md text-white font-bold">Add</Text>
                </Pressable>
              )}
            </View>
          }
        />
      }
    >
      <FlatList
        data={users}
        keyExtractor={(u) => u.id}
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
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

              {/* KPI Banner */}
              {!showForm && users.length > 0 && (
                <View className="bg-primary/10 rounded-2xl p-4 border border-primary/20 flex-row items-center justify-between mb-6 shadow-sm">
                  <View className="flex-row items-center gap-3">
                    <View className="w-10 h-10 rounded-full bg-primary/20 items-center justify-center">
                      <MaterialIcons name="local-shipping" size={20} className="text-primary" />
                    </View>
                    <View>
                      <Text className="font-label-md text-primary font-bold tracking-wider uppercase mb-0.5">Active Drivers</Text>
                      <View className="flex-row items-end gap-1">
                        <Text className="font-display-sm text-primary font-black leading-tight">{activeUsers}</Text>
                        <Text className="font-body-md text-primary/80 font-bold mb-0.5">/ {users.length}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {/* Add User Form */}
              {showForm && (
                <View className="mb-6">
                  <AdminCard title="New Delivery User" icon="person-add" iconColorClass="text-secondary" iconBgClass="bg-secondary/10" containerClass="relative">
                    <Pressable 
                      className="absolute top-4 right-4 w-8 h-8 rounded-full bg-surface-variant/30 items-center justify-center z-10"
                      onPress={() => setShowForm(false)}
                    >
                      <MaterialIcons name="close" size={16} className="text-on-surface-variant" />
                    </Pressable>
                    
                    <View className="flex-col gap-4">
                      <View>
                        <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1">Username <Text className="text-error">*</Text></Text>
                        <View className="relative flex-row items-center">
                          <View className="absolute left-4 z-10">
                            <MaterialIcons name="account-circle" size={20} className="text-on-surface-variant" />
                          </View>
                          <TextInput 
                            className="w-full bg-surface-container-lowest h-14 rounded-xl border border-outline-variant/50 pl-12 pr-4 font-body-lg text-on-surface focus:border-primary" 
                            placeholder="e.g. driver_01" 
                            value={username} 
                            onChangeText={setUsername} 
                            autoCapitalize="none" 
                            placeholderTextColor="#9ca3af" 
                          />
                        </View>
                      </View>

                      <View>
                        <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1">Password <Text className="text-error">*</Text></Text>
                        <View className="relative flex-row items-center">
                          <View className="absolute left-4 z-10">
                            <MaterialIcons name="lock" size={20} className="text-on-surface-variant" />
                          </View>
                          <TextInput 
                            className="flex-1 bg-surface-container-lowest h-14 rounded-xl border border-outline-variant/50 pl-12 pr-12 font-body-lg text-on-surface focus:border-primary" 
                            placeholder="Secure password" 
                            value={password} 
                            onChangeText={setPassword} 
                            secureTextEntry={!showPassword} 
                            placeholderTextColor="#9ca3af" 
                          />
                          <Pressable 
                            accessibilityRole="button" 
                            onPress={() => setShowPassword(!showPassword)} 
                            className="absolute right-2 p-2 w-10 h-10 items-center justify-center rounded-full active:bg-surface-variant/50"
                          >
                            <MaterialIcons name={showPassword ? "visibility" : "visibility-off"} size={22} className="text-on-surface-variant" />
                          </Pressable>
                        </View>
                      </View>

                      <View className="h-px bg-outline-variant/30 my-1" />

                      <View>
                        <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1">Full Name (Optional)</Text>
                        <View className="relative flex-row items-center">
                          <View className="absolute left-4 z-10">
                            <MaterialIcons name="badge" size={20} className="text-on-surface-variant" />
                          </View>
                          <TextInput 
                            className="w-full bg-surface-container-lowest h-14 rounded-xl border border-outline-variant/50 pl-12 pr-4 font-body-lg text-on-surface focus:border-primary" 
                            placeholder="John Doe" 
                            value={fullName} 
                            onChangeText={setFullName} 
                            placeholderTextColor="#9ca3af" 
                          />
                        </View>
                      </View>

                      <View>
                        <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1">Mobile (Optional)</Text>
                        <View className="relative flex-row items-center">
                          <View className="absolute left-4 z-10">
                            <MaterialIcons name="phone" size={20} className="text-on-surface-variant" />
                          </View>
                          <TextInput 
                            className="w-full bg-surface-container-lowest h-14 rounded-xl border border-outline-variant/50 pl-12 pr-4 font-body-lg text-on-surface focus:border-primary" 
                            placeholder="+91 9876543210" 
                            value={mobile} 
                            onChangeText={setMobile} 
                            keyboardType="phone-pad" 
                            placeholderTextColor="#9ca3af" 
                          />
                        </View>
                      </View>

                      <Pressable 
                        className={`h-13 mt-2 rounded-xl flex-row items-center justify-center gap-2 active:scale-[0.98] transition-transform ${
                          !username || !password ? "bg-surface-variant" : "bg-primary shadow-sm shadow-primary/30"
                        }`}
                        onPress={onAdd}
                        disabled={creating || !username || !password}
                      >
                        {creating ? (
                          <ActivityIndicator color="#ffffff" />
                        ) : (
                          <>
                            <MaterialIcons name="person-add" size={18} color={!username || !password ? "#717973" : "white"} />
                            <Text className={`font-bold text-label-lg ${!username || !password ? "text-on-surface-variant" : "text-white"}`}>
                              Create User
                            </Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                  </AdminCard>
                </View>
              )}

              {/* List Header */}
              <View className="flex-row items-center justify-between ml-1 mb-3">
                <Text className="font-title-lg text-on-surface font-bold">User Directory</Text>
                {!showForm && users.length > 0 && (
                  <View className="bg-surface-container-highest px-3 py-1 rounded-full">
                    <Text className="font-label-sm text-on-surface-variant font-bold">{users.length} Users</Text>
                  </View>
                )}
              </View>

            </View>
          </>
        }
        ListEmptyComponent={
          loading ? (
            <View className="py-12 items-center">
              <ActivityIndicator size="large" className="text-primary mb-4" />
              <Text className="text-on-surface-variant font-medium">Loading users...</Text>
            </View>
          ) : (
            <View className="bg-surface-container-lowest rounded-3xl p-8 border border-dashed border-outline-variant/50 items-center justify-center mb-6 mt-2">
              <View className="w-16 h-16 bg-surface-variant/30 rounded-full items-center justify-center mb-4">
                <MaterialIcons name="group-off" size={32} className="text-on-surface-variant/70" />
              </View>
              <Text className="font-title-md text-on-surface font-bold mb-1">No Delivery Users</Text>
              <Text className="font-body-md text-on-surface-variant text-center mb-6">
                You haven't added any delivery drivers yet. Create an account for them to use the delivery app.
              </Text>
              {!showForm && (
                <Pressable
                  className="bg-primary px-6 py-3 rounded-full flex-row items-center"
                  onPress={() => setShowForm(true)}
                >
                  <MaterialIcons name="add" size={20} color="white" className="mr-2" />
                  <Text className="text-white font-bold">Create First User</Text>
                </Pressable>
              )}
            </View>
          )
        }
        ItemSeparatorComponent={ItemSeparator}
        renderItem={({ item: u }) => <DeliveryUserCard user={u} onRemove={onRemove} />}
      />
    </AdminScreenContainer>
  );
}

const ItemSeparator = React.memo(() => <View className="h-3" />);

const DeliveryUserCard = React.memo(({ user: u, onRemove }: { user: User; onRemove: (u: User) => void }) => {
  return (
    <View className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant/20 flex-row justify-between items-center relative overflow-hidden">
      <View className={`absolute top-0 left-0 w-1.5 h-full ${u.is_active ? 'bg-primary' : 'bg-error'}`} />
      
      <View className="flex-row items-center gap-4 ml-1">
        <View className={`w-12 h-12 rounded-full items-center justify-center ${u.is_active ? 'bg-primary/10' : 'bg-error/10'}`}>
          <MaterialIcons name="local-shipping" size={24} className={u.is_active ? 'text-primary' : 'text-error'} />
        </View>
        
        <View>
          <Text className="font-title-md text-on-surface font-bold">{u.username}</Text>
          <View className="flex-row items-center gap-1 mt-0.5">
            <View className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-primary' : 'bg-error'}`} />
            <Text className={`font-label-sm font-bold uppercase tracking-wider ${u.is_active ? "text-primary" : "text-error"}`}>
              {u.is_active ? "Active" : "Inactive"}
            </Text>
          </View>
        </View>
      </View>

      {u.is_active && (
        <Pressable 
          accessibilityRole="button" 
          onPress={() => onRemove(u)} 
          className="w-10 h-10 rounded-full bg-error/5 items-center justify-center active:bg-error/20 border border-error/10"
        >
          <MaterialIcons name="person-remove" size={20} className="text-error" />
        </Pressable>
      )}
    </View>
  );
});
