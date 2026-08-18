import { useCallback, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View, Alert } from "react-native";
import { useFocusEffect, useRoute, useNavigation } from "@react-navigation/native";
import { api } from "../../api/client";
import { User, TenantAdminCreate, TenantAdminUpdate } from "../../types/api";

export function SuperAdminOrgAdminsScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const { orgId, orgName } = route.params;

  const [admins, setAdmins] = useState<User[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  // For inline update
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPassword, setEditPassword] = useState("");

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get<User[]>(`/super-admin/organizations/${orgId}/admins`);
      setAdmins(data);
    } catch (e) {
      console.warn("Failed to fetch admins", e);
    }
  }, [orgId]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  function showMessage(text: string, error: boolean = false) {
    setMsg(text);
    setIsError(error);
    setTimeout(() => setMsg(null), 3000);
  }

  async function createAdmin() {
    if (!username || !password) {
      showMessage("Username and password required.", true);
      return;
    }
    try {
      const payload: TenantAdminCreate = { username, password };
      await api.post(`/super-admin/organizations/${orgId}/admins`, payload);
      setUsername("");
      setPassword("");
      showMessage("Admin created.");
      await refresh();
    } catch (e) {
      showMessage(e instanceof Error ? e.message : "Failed to create", true);
    }
  }

  async function updateAdminPassword(adminId: string) {
    if (!editPassword) return;
    try {
      const payload: TenantAdminUpdate = { password: editPassword };
      await api.patch(`/super-admin/organizations/${orgId}/admins/${adminId}`, payload);
      setEditingId(null);
      setEditPassword("");
      showMessage("Password updated.");
    } catch (e) {
      showMessage("Update failed.", true);
    }
  }

  async function toggleAdminStatus(adminId: string, currentStatus: boolean) {
    try {
      const payload: TenantAdminUpdate = { is_active: !currentStatus };
      await api.patch(`/super-admin/organizations/${orgId}/admins/${adminId}`, payload);
      showMessage(`Admin ${currentStatus ? "deactivated" : "activated"}.`);
      await refresh();
    } catch (e) {
      showMessage("Status update failed.", true);
    }
  }

  function confirmDelete(adminId: string, adminUsername: string) {
    Alert.alert(
      "Delete Admin",
      `Are you sure you want to completely delete "${adminUsername}"?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: async () => {
            try {
              await api.delete(`/super-admin/organizations/${orgId}/admins/${adminId}`);
              showMessage("Admin deleted.");
              await refresh();
            } catch (e: any) {
              showMessage(e?.response?.data?.detail || "Delete failed.", true);
            }
          }
        }
      ]
    );
  }

  return (
    <View className="flex-1 bg-background p-lg pt-12">
      {/* Header */}
      <View className="flex-row items-center mb-lg">
        <Pressable 
          onPress={() => navigation.goBack()}
          className="bg-surface-container-highest p-sm rounded-full mr-md border border-outline-variant active:opacity-70"
        >
          <Text className="text-on-surface-variant font-label-md">&larr; Back</Text>
        </Pressable>
        <Text className="text-display-lg font-display-lg text-on-background flex-1" numberOfLines={1}>
          {orgName} Admins
        </Text>
      </View>

      {/* Creation Form */}
      <View className="bg-surface rounded-xl p-md mb-xl shadow-sm border border-outline-variant">
        <Text className="text-headline-sm font-headline-sm text-on-surface mb-md">New Tenant Admin</Text>
        
        {msg ? (
          <View className={`mb-md p-sm rounded-lg ${isError ? 'bg-error-container' : 'bg-primary-container'}`}>
            <Text className={`text-body-md ${isError ? 'text-on-error-container' : 'text-on-primary-container'}`}>
              {msg}
            </Text>
          </View>
        ) : null}

        <TextInput
          className="bg-surface-container-low border border-outline-variant rounded-lg px-md py-sm mb-sm text-on-surface font-body-md"
          placeholder="Admin Username"
          placeholderTextColor="#717973"
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
        />
        <TextInput
          className="bg-surface-container-low border border-outline-variant rounded-lg px-md py-sm mb-md text-on-surface font-body-md"
          placeholder="Password"
          placeholderTextColor="#717973"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <Pressable 
          className="bg-primary rounded-full py-sm items-center active:opacity-80" 
          onPress={createAdmin}
        >
          <Text className="text-on-primary font-label-md">Add Admin</Text>
        </Pressable>
      </View>

      {/* Admins List */}
      <Text className="text-headline-md font-headline-md text-on-background mb-md">Current Admins</Text>
      <FlatList
        data={admins}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View className={`bg-surface rounded-xl p-md mb-sm shadow-sm border border-outline-variant ${!item.is_active ? 'opacity-60' : ''}`}>
            <View className="flex-row justify-between items-center mb-sm">
              <View className="flex-row items-center flex-1">
                <View className="bg-tertiary-container w-10 h-10 rounded-full items-center justify-center mr-sm">
                  <Text className="text-on-tertiary-container font-headline-sm">
                    {item.username.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View>
                  <Text className="text-headline-sm font-headline-sm text-on-surface">{item.username}</Text>
                  <Text className="text-body-md text-on-surface-variant">Role: {item.role}</Text>
                </View>
              </View>
              <View className="flex-row gap-2">
                <Pressable 
                  className={`px-sm py-base rounded border ${item.is_active ? 'border-error text-error' : 'border-primary text-primary'}`}
                  onPress={() => toggleAdminStatus(item.id, item.is_active)}
                >
                  <Text className={`font-label-md ${item.is_active ? 'text-error' : 'text-primary'}`}>
                    {item.is_active ? 'Deactivate' : 'Activate'}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Actions Footer */}
            {editingId === item.id ? (
              <View className="flex-row gap-2 mt-sm border-t border-outline-variant pt-sm">
                <TextInput
                  className="flex-1 bg-surface-container-low border border-outline-variant rounded-lg px-sm py-xs text-on-surface font-body-md"
                  placeholder="New password"
                  placeholderTextColor="#717973"
                  secureTextEntry
                  value={editPassword}
                  onChangeText={setEditPassword}
                />
                <Pressable 
                  className="bg-primary rounded-lg px-sm justify-center active:opacity-80"
                  onPress={() => updateAdminPassword(item.id)}
                >
                  <Text className="text-on-primary font-label-md">Save</Text>
                </Pressable>
                <Pressable 
                  className="bg-surface-container-highest rounded-lg px-sm justify-center border border-outline-variant active:opacity-80"
                  onPress={() => { setEditingId(null); setEditPassword(""); }}
                >
                  <Text className="text-on-surface-variant font-label-md">Cancel</Text>
                </Pressable>
              </View>
            ) : (
              <View className="flex-row gap-4 mt-sm border-t border-outline-variant pt-sm">
                <Pressable onPress={() => { setEditingId(item.id); setEditPassword(""); }}>
                  <Text className="text-tertiary font-label-md underline">Change Password</Text>
                </Pressable>
                <Pressable onPress={() => confirmDelete(item.id, item.username)}>
                  <Text className="text-error font-label-md underline">Delete</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={
          <View className="items-center py-xl">
            <Text className="text-on-surface-variant font-body-lg">No tenant admins yet.</Text>
          </View>
        }
      />
    </View>
  );
}
