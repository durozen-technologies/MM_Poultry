import React, { useCallback, useState, useMemo } from "react";
import { 
  FlatList, 
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View, 
  Alert
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { createVehicle, deleteVehicle, listVehicles } from "../../api/vehicles";
import { createDeliveryUser } from "../../api/users";
import type { Vehicle } from "../../types/api";

import { AdminScreenContainer } from "../../components/admin/admin-screen-container";
import { AdminHeader } from "../../components/admin/admin-header";
import { AdminCard } from "../../components/admin/admin-card";

export function AdminVehiclesScreen({ navigation }: { navigation: any }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [driverUsername, setDriverUsername] = useState("");
  const [driverPassword, setDriverPassword] = useState("");
  const [driverName, setDriverName] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setVehicles(await listVehicles());
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Failed to load vehicles", type: 'error' });
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
    if (!number.trim() || !driverUsername.trim() || !driverPassword.trim()) {
      setMsg({ text: "Vehicle number, username, and password are required", type: 'error' });
      return;
    }
    
    setActionLoading(true);
    try {
      const user = await createDeliveryUser({
        username: driverUsername.trim(),
        password: driverPassword.trim(),
        full_name: driverName.trim() || null,
      });

      await createVehicle({
        name: name.trim() || undefined,
        number: number.trim(),
        driver_name: driverName.trim() || undefined,
        driver_id: user.id,
      });
      setName("");
      setNumber("");
      setDriverUsername("");
      setDriverPassword("");
      setDriverName("");
      setIsAdding(false);
      setMsg({ text: "Vehicle added successfully", type: 'success' });
      
      // Auto-hide success message
      setTimeout(() => setMsg(null), 3000);
      
      await refresh();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Failed to add vehicle", type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  function confirmDeactivate(vehicle: Vehicle) {
    Alert.alert(
      "Deactivate Vehicle",
      `Are you sure you want to deactivate ${vehicle.number}? This will remove it from active lists.`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Deactivate", 
          style: "destructive", 
          onPress: () => onDeactivate(vehicle)
        }
      ]
    );
  }

  async function onDeactivate(vehicle: Vehicle) {
    try {
      await deleteVehicle(vehicle.id);
      setMsg({ text: "Vehicle deactivated successfully", type: 'success' });
      setTimeout(() => setMsg(null), 3000);
      await refresh();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Failed to remove vehicle", type: 'error' });
    }
  }

  const sortedVehicles = useMemo(() => {
    const active = vehicles.filter(v => v.is_active);
    const inactive = vehicles.filter(v => !v.is_active);
    return [...active, ...inactive];
  }, [vehicles]);
  
  const activeCount = useMemo(() => vehicles.filter(v => v.is_active).length, [vehicles]);

  return (
    <AdminScreenContainer
      noScroll
      header={
        <AdminHeader 
          title="Delivery Vehicles" 
          subtitle="Manage your fleet and drivers"
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
              {!isAdding && (
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
        data={sortedVehicles}
        keyExtractor={(v) => v.id}
        className="flex-1 px-4 pt-2"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        ListHeaderComponent={
          <>
            {msg && (
              <View className={`p-4 rounded-xl mb-4 flex-row items-center border ${
                msg.type === 'success' 
                  ? 'bg-primary-container/30 border-primary/20' 
                  : 'bg-error-container/30 border-error/20'
              }`}>
                <MaterialIcons 
                  name={msg.type === 'success' ? "check-circle" : "error-outline"} 
                  size={20} 
                  className={msg.type === 'success' ? "text-primary mr-2" : "text-error mr-2"} 
                />
                <Text className={`font-label-md font-semibold flex-1 ${
                  msg.type === 'success' ? 'text-primary' : 'text-error'
                }`}>
                  {msg.text}
                </Text>
              </View>
            )}

            {isAdding && (
              <View className="mb-6">
                <AdminCard 
                  title="New Vehicle" 
                  icon="local-shipping" 
                  iconColorClass="text-secondary" 
                  iconBgClass="bg-secondary/10" 
                  containerClass="relative"
                >
                  <Pressable 
                    className="absolute top-4 right-4 w-8 h-8 rounded-full bg-surface-variant/30 items-center justify-center z-10"
                    onPress={() => setIsAdding(false)}
                  >
                    <MaterialIcons name="close" size={16} className="text-on-surface-variant" />
                  </Pressable>
                  
                  <View className="flex-col gap-4">
                    <View>
                      <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1 uppercase tracking-wider">Vehicle Name</Text>
                      <View className="relative flex-row items-center">
                        <View className="absolute left-4 z-10">
                          <MaterialIcons name="directions-car" size={20} className="text-on-surface-variant" />
                        </View>
                        <TextInput 
                          className="w-full bg-surface-container-lowest h-14 rounded-xl border border-outline-variant/50 pl-12 pr-4 font-title-md text-on-surface focus:border-primary" 
                          placeholder="e.g. Tata Ace 1" 
                          value={name} 
                          onChangeText={setName} 
                          placeholderTextColor="#9ca3af" 
                        />
                      </View>
                    </View>

                    <View>
                      <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1 uppercase tracking-wider">Vehicle Number <Text className="text-error">*</Text></Text>
                      <View className="relative flex-row items-center">
                        <View className="absolute left-4 z-10">
                          <MaterialIcons name="pin" size={20} className="text-on-surface-variant" />
                        </View>
                        <TextInput 
                          className="w-full bg-surface-container-lowest h-14 rounded-xl border border-outline-variant/50 pl-12 pr-4 font-title-md text-on-surface focus:border-primary uppercase" 
                          placeholder="e.g. MH 12 AB 1234" 
                          value={number} 
                          onChangeText={setNumber} 
                          placeholderTextColor="#9ca3af" 
                          autoCapitalize="characters"
                        />
                      </View>
                    </View>
                    
                    <View className="flex-row gap-4">
                      <View className="flex-[1.5]">
                        <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1 uppercase tracking-wider">Default Driver Name</Text>
                        <View className="relative flex-row items-center">
                          <View className="absolute left-4 z-10">
                            <MaterialIcons name="person" size={20} className="text-on-surface-variant" />
                          </View>
                          <TextInput 
                            className="w-full bg-surface-container-lowest h-14 rounded-xl border border-outline-variant/50 pl-12 pr-4 font-body-lg text-on-surface focus:border-primary" 
                            placeholder="Optional" 
                            value={driverName} 
                            onChangeText={setDriverName} 
                            placeholderTextColor="#9ca3af" 
                          />
                        </View>
                      </View>
                    </View>

                    <View className="flex-row gap-4 mt-2">
                      <View className="flex-1">
                        <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1 uppercase tracking-wider">Login Username <Text className="text-error">*</Text></Text>
                        <View className="relative flex-row items-center">
                          <View className="absolute left-4 z-10">
                            <MaterialIcons name="account-circle" size={20} className="text-on-surface-variant" />
                          </View>
                          <TextInput 
                            className="w-full bg-surface-container-lowest h-14 rounded-xl border border-outline-variant/50 pl-12 pr-4 font-body-lg text-on-surface focus:border-primary" 
                            placeholder="username" 
                            value={driverUsername} 
                            onChangeText={setDriverUsername} 
                            placeholderTextColor="#9ca3af"
                            autoCapitalize="none"
                          />
                        </View>
                      </View>
                      <View className="flex-1">
                        <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1 uppercase tracking-wider">Login Password <Text className="text-error">*</Text></Text>
                        <View className="relative flex-row items-center">
                          <View className="absolute left-4 z-10">
                            <MaterialIcons name="lock" size={20} className="text-on-surface-variant" />
                          </View>
                          <TextInput 
                            className="w-full bg-surface-container-lowest h-14 rounded-xl border border-outline-variant/50 pl-12 pr-4 font-body-lg text-on-surface focus:border-primary" 
                            placeholder="password" 
                            value={driverPassword} 
                            onChangeText={setDriverPassword} 
                            placeholderTextColor="#9ca3af"
                            secureTextEntry
                          />
                        </View>
                      </View>
                    </View>

                    <Pressable 
                      className={`h-13 mt-2 rounded-xl flex-row items-center justify-center gap-2 active:scale-[0.98] transition-transform ${
                        !number.trim() ? "bg-surface-variant" : "bg-primary shadow-sm shadow-primary/30"
                      }`}
                      onPress={onAdd}
                      disabled={actionLoading || !number.trim()}
                    >
                      {actionLoading ? (
                        <ActivityIndicator color="#ffffff" />
                      ) : (
                        <>
                          <MaterialIcons name="add-circle" size={18} color={!number.trim() ? "#717973" : "white"} />
                          <Text className={`font-bold text-label-lg ${!number.trim() ? "text-on-surface-variant" : "text-white"}`}>
                            Register Vehicle
                          </Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                </AdminCard>
              </View>
            )}

            {/* KPI Banner */}
            {!isAdding && vehicles.length > 0 && (
              <View className="bg-primary/10 rounded-2xl p-4 border border-primary/20 flex-row items-center justify-between mb-6 shadow-sm">
                <View className="flex-row items-center gap-3">
                  <View className="w-10 h-10 rounded-full bg-primary/20 items-center justify-center">
                    <MaterialIcons name="directions-car" size={20} className="text-primary" />
                  </View>
                  <View>
                    <Text className="font-label-md text-primary font-bold tracking-wider uppercase mb-0.5">Active Fleet</Text>
                    <View className="flex-row items-end gap-1">
                      <Text className="font-display-sm text-primary font-black leading-tight">{activeCount}</Text>
                      <Text className="font-body-md text-primary/80 font-bold mb-0.5">/ {vehicles.length}</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            <View className="flex-row items-center justify-between ml-1 mb-3">
              <Text className="font-title-lg text-on-surface font-bold">Registered Vehicles</Text>
            </View>
          </>
        }
        ListEmptyComponent={
          loading ? (
            <View className="py-12 items-center">
              <ActivityIndicator size="large" className="text-primary mb-4" />
              <Text className="text-on-surface-variant font-medium">Loading fleet data...</Text>
            </View>
          ) : (
            <View className="bg-surface-container-lowest rounded-3xl p-8 border border-dashed border-outline-variant/50 items-center justify-center mb-6 mt-2">
              <View className="w-16 h-16 bg-surface-variant/30 rounded-full items-center justify-center mb-4">
                <MaterialIcons name="no-crash" size={32} className="text-on-surface-variant/70" />
              </View>
              <Text className="font-title-md text-on-surface font-bold mb-1">No Vehicles Found</Text>
              <Text className="font-body-md text-on-surface-variant text-center mb-6">
                You haven't added any vehicles to your delivery fleet yet.
              </Text>
              {!isAdding && (
                <Pressable
                  className="bg-primary px-6 py-3 rounded-full flex-row items-center"
                  onPress={() => setIsAdding(true)}
                >
                  <MaterialIcons name="add" size={20} color="white" className="mr-2" />
                  <Text className="text-white font-bold">Add First Vehicle</Text>
                </Pressable>
              )}
            </View>
          )
        }
        ItemSeparatorComponent={ItemSeparator}
        renderItem={({ item: v }) => <VehicleListItem v={v} confirmDeactivate={confirmDeactivate} />}
      />
    </AdminScreenContainer>
  );
}

const ItemSeparator = React.memo(() => <View className="h-3" />);

const VehicleListItem = React.memo(({ v, confirmDeactivate }: { v: Vehicle; confirmDeactivate: (v: Vehicle) => void }) => {
  return (
    <View className={`bg-surface-container-lowest rounded-2xl shadow-sm border flex-row justify-between items-center relative overflow-hidden ${
      v.is_active ? 'border-outline-variant/20' : 'border-outline-variant/10 opacity-70'
    }`}>
      <View className={`absolute top-0 left-0 w-1.5 h-full z-10 ${v.is_active ? 'bg-primary' : 'bg-surface-variant'}`} />
      
      <View className="p-4 pl-5 flex-1 flex-row items-center gap-4">
        <View className={`w-12 h-12 rounded-full items-center justify-center ${v.is_active ? 'bg-primary/10' : 'bg-surface-variant/30'}`}>
          <MaterialIcons name="local-shipping" size={24} className={v.is_active ? 'text-primary' : 'text-on-surface-variant'} />
        </View>
        
        <View className="flex-1 pr-2">
          <View className="flex-row items-center gap-2 mb-1">
            <Text className={`font-title-md font-bold uppercase tracking-wide ${v.is_active ? 'text-on-surface' : 'text-on-surface-variant'}`}>
              {v.name ? `${v.name} (${v.number})` : v.number}
            </Text>
            {!v.is_active && (
              <View className="bg-surface-variant/50 px-2 py-0.5 rounded-full">
                <Text className="text-on-surface-variant text-[10px] uppercase font-bold tracking-wider">Inactive</Text>
              </View>
            )}
          </View>
          
          <View className="flex-row items-center gap-x-3 gap-y-1 flex-wrap">
            <View className="flex-row items-center gap-1">
              <MaterialIcons name="person" size={14} className="text-on-surface-variant" />
              <Text className="font-body-md text-on-surface-variant">
                {v.driver_name || "Unassigned"}
              </Text>
            </View>
            
            {v.driver_id && (
              <View className="flex-row items-center gap-1 bg-surface-container-highest px-2 py-0.5 rounded-md">
                <MaterialIcons name="lock" size={12} className="text-on-surface-variant" />
                <Text className="font-label-sm font-bold text-on-surface-variant">
                  Linked Account
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {v.is_active && (
        <Pressable 
          accessibilityRole="button" 
          onPress={() => confirmDeactivate(v)} 
          className="w-12 h-12 rounded-full items-center justify-center mr-2 active:bg-error-container/50 transition-colors"
        >
          <MaterialIcons name="delete-outline" size={20} className="text-error" />
        </Pressable>
      )}
    </View>
  );
});
