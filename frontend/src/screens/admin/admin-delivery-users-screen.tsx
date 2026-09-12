import React, { useCallback, useState, useMemo } from "react";
import { FlatList, ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { createDeliveryUser, listDeliveryUsers, updateDeliveryUser } from "../../api/users";
import type { User } from "../../types/api";

import { AdminScreenContainer } from "../../components/admin/admin-screen-container";
import { AdminHeader } from "../../components/admin/admin-header";
import { AdminCard } from "../../components/admin/admin-card";

export function AdminDeliveryUsersScreen({ navigation }: { navigation: any }) {
  const [users, setUsers] = useState<User[]>([]);
  const [vehicleName, setVehicleName] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

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

  const isFormValid = Boolean(
    vehicleName.trim() &&
    vehicleNumber.trim() &&
    driverName.trim() &&
    username.trim() &&
    (editingUser ? true : password)
  );

  function openAddForm() {
    setEditingUser(null);
    setVehicleName("");
    setVehicleNumber("");
    setDriverName("");
    setUsername("");
    setPassword("");
    setShowForm(true);
  }

  function openEditForm(user: User) {
    setEditingUser(user);
    setVehicleName(user.vehicle_name || "");
    setVehicleNumber(user.mobile_number || "");
    setDriverName(user.full_name || "");
    setUsername(user.username);
    setPassword("");
    setShowForm(true);
  }

  async function onSubmit() {
    if (!isFormValid) {
      setMsg({ text: "Please fill in all required fields", ok: false });
      return;
    }
    
    setCreating(true);
    setMsg(null);
    try {
      if (editingUser) {
        await updateDeliveryUser(editingUser.id, {
          vehicle_name: vehicleName.trim() || null,
          mobile_number: vehicleNumber.trim() || null,
          full_name: driverName.trim() || null,
          ...(password ? { password } : {})
        });
        setMsg({ text: "Delivery user updated successfully", ok: true });
      } else {
        await createDeliveryUser({
          username: username.trim(),
          password,
          vehicle_name: vehicleName.trim() || null,
          mobile_number: vehicleNumber.trim() || null,
          full_name: driverName.trim() || null,
        });
        setMsg({ text: "Delivery user created successfully", ok: true });
      }

      setVehicleName("");
      setVehicleNumber("");
      setDriverName("");
      setUsername("");
      setPassword("");
      setShowForm(false);
      setEditingUser(null);
      setTimeout(() => setMsg(null), 3000);
      await refresh();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Failed to save user", ok: false });
    } finally {
      setCreating(false);
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
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#f7f8fa] active:bg-[#f7f8fa]"
                onPress={refresh}
              >
                {loading ? (
                  <ActivityIndicator size="small" className="text-[#2E7D32]" />
                ) : (
                  <MaterialIcons name="refresh" size={22} className="text-[#202124]" />
                )}
              </Pressable>
              {!showForm && (
                <Pressable
                  accessibilityRole="button"
                  className="h-10 px-4 rounded-lg flex-row items-center justify-center bg-[#2E7D32] active:bg-[#2E7D32]/90"
                  onPress={openAddForm}
                >
                  <MaterialIcons name="person-add" size={20} color="white" className="mr-1.5" />
                  <Text className="text-sm font-bold text-white font-bold">Add</Text>
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
                <View className={`p-4 rounded-lg mb-4 flex-row items-center ${msg.ok ? "bg-[#2E7D32]/10/80" : "bg-error-container/80"}`}>
                  <MaterialIcons name={msg.ok ? "check-circle" : "error-outline"} size={20} className={`${msg.ok ? "text-on-primary-container" : "text-error"} mr-2`} />
                  <Text className={`text-sm font-bold text-[#5f6368] font-semibold flex-1 ${msg.ok ? "text-on-primary-container" : "text-error"}`}>
                    {msg.text}
                  </Text>
                </View>
              )}

              {/* KPI Banner */}
              {!showForm && users.length > 0 && (
                <View className="bg-[#2E7D32]/10 rounded-lg p-4 border border-[#2E7D32]/20 flex-row items-center justify-between mb-6">
                  <View className="flex-row items-center gap-3">
                    <View className="w-10 h-10 rounded-lg bg-[#2E7D32]/20 items-center justify-center">
                      <MaterialIcons name="local-shipping" size={20} className="text-[#2E7D32]" />
                    </View>
                    <View>
                      <Text className="text-sm font-bold text-[#5f6368] text-[#2E7D32] tracking-wider uppercase mb-0.5">Active Drivers</Text>
                      <View className="flex-row items-end gap-1">
                        <Text className="text-2xl font-bold text-[#2E7D32] font-black leading-tight">{activeUsers}</Text>
                        <Text className="text-base text-[#5f6368] text-[#2E7D32]/80 mb-0.5">/ {users.length}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {/* Form */}
              {showForm && (
                <View className="mb-6">
                  <AdminCard 
                    title={editingUser ? "Edit Delivery User" : "New Delivery User"}
                    icon={editingUser ? "edit" : "person-add"}
                    iconColorClass="text-secondary"
                    iconBgClass="bg-[#f7f8fa] border border-[#e5e7eb]"
                    rightAction={
                      <Pressable 
                        accessibilityRole="button"
                        className="w-8 h-8 rounded-lg bg-[#f7f8fa] items-center justify-center active:bg-[#f7f8fa]"
                        onPress={() => setShowForm(false)}
                      >
                        <MaterialIcons name="close" size={18} className="text-[#5f6368]" />
                      </Pressable>
                    }
                  >
                    {/* 1. Vehicle Name */}
                    <View>
                      <Text className="text-[#5f6368] text-sm font-bold font-semibold mb-1.5 ml-1">Vehicle Name <Text className="text-error">*</Text></Text>
                      <View className="relative flex-row items-center">
                        <View className="absolute left-4 z-10">
                          <MaterialIcons name="local-shipping" size={20} className="text-[#5f6368]" />
                        </View>
                        <TextInput 
                          className="w-full bg-white h-14 rounded-lg border border-[#e5e7eb] pl-12 pr-4 text-lg text-[#5f6368] text-[#202124] focus:border-[#2E7D32]"
                          placeholder="e.g. Tata Ace / Bolero"
                          value={vehicleName} 
                          onChangeText={setVehicleName} 
                          placeholderTextColor="#717973"
                        />
                      </View>
                    </View>

                    {/* 2. Vehicle Number */}
                    <View>
                      <Text className="text-[#5f6368] text-sm font-bold font-semibold mb-1.5 ml-1">Vehicle Number <Text className="text-error">*</Text></Text>
                      <View className="relative flex-row items-center">
                        <View className="absolute left-4 z-10">
                          <MaterialIcons name="pin" size={20} className="text-[#5f6368]" />
                        </View>
                        <TextInput 
                          className="w-full bg-white h-14 rounded-lg border border-[#e5e7eb] pl-12 pr-4 text-lg text-[#5f6368] text-[#202124] focus:border-[#2E7D32]"
                          placeholder="e.g. TN 01 AB 1234"
                          value={vehicleNumber} 
                          onChangeText={setVehicleNumber} 
                          autoCapitalize="characters"
                          placeholderTextColor="#717973"
                        />
                      </View>
                    </View>

                    {/* 3. Driver Name */}
                    <View>
                      <Text className="text-[#5f6368] text-sm font-bold font-semibold mb-1.5 ml-1">Driver Name <Text className="text-error">*</Text></Text>
                      <View className="relative flex-row items-center">
                        <View className="absolute left-4 z-10">
                          <MaterialIcons name="badge" size={20} className="text-[#5f6368]" />
                        </View>
                        <TextInput 
                          className="w-full bg-white h-14 rounded-lg border border-[#e5e7eb] pl-12 pr-4 text-lg text-[#5f6368] text-[#202124] focus:border-[#2E7D32]"
                          placeholder="e.g. Ravi Kumar"
                          value={driverName} 
                          onChangeText={setDriverName} 
                          placeholderTextColor="#717973"
                        />
                      </View>
                    </View>

                    <View className="h-px bg-outline-variant/30 my-1" />

                    {/* 4. Username */}
                    <View>
                      <Text className="text-[#5f6368] text-sm font-bold font-semibold mb-1.5 ml-1">Username <Text className="text-error">*</Text></Text>
                      <View className="relative flex-row items-center">
                        <View className="absolute left-4 z-10">
                          <MaterialIcons name="account-circle" size={20} className="text-[#5f6368]" />
                        </View>
                        <TextInput 
                          className={`w-full bg-white h-14 rounded-lg border border-[#e5e7eb] pl-12 pr-4 text-lg text-[#5f6368] ${editingUser ? 'text-[#5f6368]/50 bg-[#f7f8fa]' : 'text-[#202124] focus:border-[#2E7D32]'}`}
                          placeholder="e.g. driver_01"
                          value={username} 
                          onChangeText={setUsername} 
                          autoCapitalize="none"
                          editable={!editingUser}
                          placeholderTextColor="#717973"
                        />
                      </View>
                    </View>

                    {/* 5. Password */}
                    <View>
                      <Text className="text-[#5f6368] text-sm font-bold font-semibold mb-1.5 ml-1">Password {!editingUser && <Text className="text-error">*</Text>}</Text>
                      <View className="relative flex-row items-center">
                        <View className="absolute left-4 z-10">
                          <MaterialIcons name="lock" size={20} className="text-[#5f6368]" />
                        </View>
                        <TextInput 
                          className="flex-1 bg-white h-14 rounded-lg border border-[#e5e7eb] pl-12 pr-12 text-lg text-[#5f6368] text-[#202124] focus:border-[#2E7D32]"
                          placeholder={editingUser ? "Leave blank to keep current" : "Secure password"}
                          value={password} 
                          onChangeText={setPassword} 
                          secureTextEntry={!showPassword} 
                          placeholderTextColor="#717973"
                        />
                        <Pressable 
                          accessibilityRole="button"
                          onPress={() => setShowPassword(!showPassword)} 
                          className="absolute right-2 p-2 w-10 h-10 items-center justify-center rounded-lg active:bg-[#f7f8fa]"
                        >
                          <MaterialIcons name={showPassword ? "visibility" : "visibility-off"} size={22} className="text-[#5f6368]" />
                        </Pressable>
                      </View>
                    </View>

                    <Pressable 
                      className={`h-14 mt-2 rounded-lg flex-row items-center justify-center gap-2 active:scale-[0.98] transition-transform ${
                        !isFormValid ? "bg-[#f7f8fa]" : "bg-[#2E7D32]"
                      }`}
                      onPress={onSubmit}
                      disabled={creating || !isFormValid}
                    >
                      {creating ? (
                        <ActivityIndicator color="#ffffff" />
                      ) : (
                        <>
                          <MaterialIcons name={editingUser ? "save" : "person-add"} size={18} color={!isFormValid ? "#717973" : "white"} />
                          <Text className={`text-base font-bold ${!isFormValid ? "text-[#5f6368]" : "text-white font-bold"}`}>
                            {editingUser ? "Save Changes" : "Create User"}
                          </Text>
                        </>
                      )}
                    </Pressable>
                  </AdminCard>
                </View>
              )}

              {/* List Header */}
              <View className="flex-row items-center justify-between ml-1 mb-3">
                <Text className="text-2xl font-bold text-[#202124]">User Directory</Text>
                {!showForm && users.length > 0 && (
                  <View className="bg-[#f7f8fa] px-3 py-1 rounded-lg">
                    <Text className="text-xs font-bold text-[#5f6368]">{users.length} Users</Text>
                  </View>
                )}
              </View>

            </View>
          </>
        }
        ListEmptyComponent={
          loading ? (
            <View className="py-12 items-center">
              <ActivityIndicator size="large" className="text-[#2E7D32] mb-4" />
              <Text className="text-[#5f6368] font-medium">Loading users...</Text>
            </View>
          ) : (
            <View className="bg-white rounded-lg p-8 border border-dashed border-[#e5e7eb] items-center justify-center mb-6 mt-2">
              <View className="w-16 h-16 bg-[#f7f8fa] rounded-lg items-center justify-center mb-4">
                <MaterialIcons name="group-off" size={32} className="text-[#5f6368]" />
              </View>
              <Text className="text-base font-bold text-[#5f6368] text-[#202124] mb-1">No Delivery Users</Text>
              <Text className="text-base text-[#5f6368] text-[#5f6368] text-center mb-6">
                You haven't added any delivery drivers yet. Create an account for them to use the delivery app.
              </Text>
              {!showForm && (
                <Pressable
                  className="bg-[#2E7D32] px-6 py-3 rounded-lg flex-row items-center"
                  onPress={openAddForm}
                >
                  <MaterialIcons name="add" size={20} color="white" className="mr-2" />
                  <Text className="text-white font-bold">Create First User</Text>
                </Pressable>
              )}
            </View>
          )
        }
        ItemSeparatorComponent={ItemSeparator}
        renderItem={({ item: u }) => <DeliveryUserCard user={u} onEdit={openEditForm} />}
      />
    </AdminScreenContainer>
  );
}

const ItemSeparator = React.memo(() => <View className="h-3" />);

const DeliveryUserCard = React.memo(({ user: u, onEdit }: { user: User; onEdit: (u: User) => void }) => {
  return (
    <Pressable 
      onPress={() => onEdit(u)}
      className="bg-white rounded-lg p-4 border border-[#e5e7eb] flex-row justify-between items-center relative overflow-hidden active:bg-[#f7f8fa]"
    >
      <View className={`absolute top-0 left-0 w-1.5 h-full ${u.is_active ? 'bg-[#2E7D32]' : 'bg-error'}`} />
      
      <View className="flex-row items-center gap-4 ml-1 flex-1">
        <View className={`w-12 h-12 rounded-lg items-center justify-center ${u.is_active ? 'bg-[#2E7D32]/10' : 'bg-error/10'}`}>
          <MaterialIcons name="local-shipping" size={24} className={u.is_active ? 'text-[#2E7D32]' : 'text-error'} />
        </View>
        
        <View className="flex-1">
          <Text className="text-base font-bold text-[#5f6368] text-[#202124]">
            {u.vehicle_name ? `${u.vehicle_name} (${u.username})` : u.username}
          </Text>
          {u.mobile_number && (
            <View className="flex-row items-center gap-1 mt-0.5">
              <MaterialIcons name="local-shipping" size={13} className="text-[#5f6368]" />
              <Text className="text-xs font-bold text-[#5f6368] tracking-wider">{u.mobile_number}</Text>
            </View>
          )}
          {u.full_name && (
            <View className="flex-row items-center gap-1 mt-0.5">
              <MaterialIcons name="badge" size={13} className="text-[#5f6368]" />
              <Text className="text-xs font-bold text-[#5f6368]">{u.full_name}</Text>
            </View>
          )}
          <View className="flex-row items-center gap-1 mt-0.5">
            <View className={`w-1.5 h-1.5 rounded-lg ${u.is_active ? 'bg-[#2E7D32]' : 'bg-error'}`} />
            <Text className={`text-xs font-bold uppercase tracking-wider ${u.is_active ? "text-[#2E7D32]" : "text-error"}`}>
              {u.is_active ? "Active" : "Inactive"}
            </Text>
          </View>
        </View>
      </View>

      <MaterialIcons name="chevron-right" size={24} className="text-[#5f6368]" />
    </Pressable>
  );
});
