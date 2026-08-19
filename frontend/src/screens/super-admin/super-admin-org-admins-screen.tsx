import { useCallback, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View, Alert, RefreshControl, KeyboardAvoidingView, Platform } from "react-native";
import { useFocusEffect, useRoute, useNavigation } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api, getApiErrorMessage } from "../../api/client";
import { User, TenantAdminCreate, TenantAdminUpdate } from "../../types/api";

export function SuperAdminOrgAdminsScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const { orgId, orgName } = route.params;

  const [admins, setAdmins] = useState<User[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

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
    setLoading(true);
    try {
      const payload: TenantAdminCreate = { username, password };
      await api.post(`/super-admin/organizations/${orgId}/admins`, payload);
      setUsername("");
      setPassword("");
      showMessage("Admin created successfully.");
      await refresh();
    } catch (e) {
      showMessage(e instanceof Error ? e.message : "Failed to create", true);
    } finally {
      setLoading(false);
    }
  }

  async function updateAdminPassword(adminId: string) {
    if (!editPassword) return;
    try {
      const payload: TenantAdminUpdate = { password: editPassword };
      await api.patch(`/super-admin/organizations/${orgId}/admins/${adminId}`, payload);
      setEditingId(null);
      setEditPassword("");
      showMessage("Password updated successfully.");
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
      `Are you sure you want to completely delete "${adminUsername}"? This action cannot be undone.`,
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
              showMessage(getApiErrorMessage(e), true);
            }
          }
        }
      ]
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-background">
      <View className="flex-1 p-lg pt-12">
        {/* Header */}
        <View className="flex-row items-center mb-lg">
          <Pressable accessibilityRole="button" accessibilityLabel="Button" 
            onPress={() => navigation.goBack()}
            className="bg-surface-container-highest w-10 h-10 rounded-full mr-md items-center justify-center border border-outline-variant active:opacity-70"
          >
            <MaterialCommunityIcons name="arrow-left" size={20} className="text-on-surface" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-display-lg font-display-lg text-on-background" numberOfLines={1}>
              {orgName}
            </Text>
            <Text className="text-body-md text-on-surface-variant mt-1">Tenant Administrators</Text>
          </View>
        </View>

        {/* Creation Form */}
        <View className="bg-surface rounded-2xl p-md mb-xl shadow-sm border border-outline-variant/50">
          <View className="flex-row items-center mb-md">
            <View className="bg-primary-container w-8 h-8 rounded-full items-center justify-center mr-sm">
              <MaterialCommunityIcons name="account-plus" size={18} className="text-primary" />
            </View>
            <Text className="text-headline-sm font-headline-sm text-on-surface">New Tenant Admin</Text>
          </View>
          
          {msg ? (
            <View className={`mb-md p-sm rounded-lg flex-row items-center ${isError ? 'bg-error-container' : 'bg-primary-container'}`}>
              <MaterialCommunityIcons name={isError ? "alert-circle" : "check-circle"} size={16} color={isError ? "#93000a" : "#86af99"} className="mr-2" />
              <Text className={`text-body-md flex-1 ${isError ? 'text-on-error-container' : 'text-on-primary-container'}`}>
                {msg}
              </Text>
            </View>
          ) : null}

          <View className="flex-row items-center bg-surface-container-low border border-outline-variant rounded-xl px-md mb-sm h-12">
            <MaterialCommunityIcons name="account" size={20} className="text-on-surface-variant mr-sm" />
            <TextInput
              className="flex-1 text-on-surface font-body-md h-full placeholder:text-on-surface-variant"
              placeholder="Admin Username"
              autoCapitalize="none"
              value={username}
              onChangeText={setUsername}
 />
          </View>
          <View className="flex-row items-center bg-surface-container-low border border-outline-variant rounded-xl px-md mb-md h-12">
            <MaterialCommunityIcons name="lock-outline" size={20} className="text-on-surface-variant mr-sm" />
            <TextInput
              className="flex-1 text-on-surface font-body-md h-full placeholder:text-on-surface-variant"
              placeholder="Password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
 />
          </View>
          
          <Pressable accessibilityRole="button" accessibilityLabel="Button" 
            className="bg-primary rounded-xl h-12 flex-row items-center justify-center active:opacity-80" 
            onPress={createAdmin}
            disabled={loading}
          >
            {loading ? (
              <Text className="text-on-primary font-label-md">Adding...</Text>
            ) : (
              <>
                <MaterialCommunityIcons name="plus" size={20} className="text-white mr-1" />
                <Text className="text-on-primary font-label-md">Add Administrator</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Admins List */}
        <Text className="text-headline-md font-headline-md text-on-background mb-md">Current Admins ({admins.length})</Text>
        <FlatList
          data={admins}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ paddingBottom: 100, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#012d1d" colors={['#012d1d']} />
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-xl mt-xl">
              <MaterialCommunityIcons name="account-group-outline" size={64} className="text-surface-variant mb-md opacity-50" />
              <Text className="text-headline-sm font-headline-sm text-on-surface-variant text-center">No Admins Assigned</Text>
              <Text className="text-body-md text-outline mt-sm text-center px-lg">This organization has no administrators. Create one above to grant them access.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View className={`bg-surface rounded-2xl p-md mb-md shadow-sm border border-outline-variant/30 ${!item.is_active ? 'opacity-60' : ''}`}>
              <View className="flex-row justify-between items-center mb-sm">
                <View className="flex-row items-center flex-1">
                  <View className="bg-tertiary-container w-12 h-12 rounded-full items-center justify-center mr-md">
                    <Text className="text-on-tertiary-container font-headline-sm">
                      {item.username.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View>
                    <Text className="text-headline-sm font-headline-sm text-on-surface mb-1">{item.username}</Text>
                    <View className="flex-row items-center">
                      <MaterialCommunityIcons name="shield-check" size={14} className="text-primary-container mr-1" />
                      <Text className="text-sm text-outline font-medium">Tenant Admin</Text>
                    </View>
                  </View>
                </View>
                <View className="flex-row gap-2">
                  <Pressable accessibilityRole="button" accessibilityLabel="Button" 
                    className={`px-3 py-1.5 rounded-full border ${item.is_active ? 'border-error/30 bg-error/10' : 'border-primary/30 bg-primary/10'}`}
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
                <View className="flex-row gap-2 mt-md border-t border-outline-variant/30 pt-md">
                  <View className="flex-1 flex-row items-center bg-surface-container-low border border-outline-variant rounded-xl px-sm h-10">
                    <MaterialCommunityIcons name="lock-reset" size={18} className="text-on-surface-variant mr-1" />
                    <TextInput
                      className="flex-1 text-on-surface font-body-md h-full placeholder:text-on-surface-variant"
                      placeholder="New password"
                      secureTextEntry
                      value={editPassword}
                      onChangeText={setEditPassword}
                      autoFocus
 />
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel="Button" 
                    className="bg-primary rounded-xl px-4 justify-center active:opacity-80"
                    onPress={() => updateAdminPassword(item.id)}
                  >
                    <Text className="text-on-primary font-label-md">Save</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel="Button" 
                    className="bg-surface-container-highest rounded-xl px-4 justify-center border border-outline-variant active:opacity-80"
                    onPress={() => { setEditingId(null); setEditPassword(""); }}
                  >
                    <Text className="text-on-surface-variant font-label-md">Cancel</Text>
                  </Pressable>
                </View>
              ) : (
                <View className="flex-row gap-4 mt-md border-t border-outline-variant/30 pt-sm">
                  <Pressable accessibilityRole="button" accessibilityLabel="Button" onPress={() => { setEditingId(item.id); setEditPassword(""); }} className="flex-row items-center py-2">
                    <MaterialCommunityIcons name="key-outline" size={16} className="text-primary mr-1" />
                    <Text className="text-tertiary font-label-md">Change Password</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel="Button" onPress={() => confirmDelete(item.id, item.username)} className="flex-row items-center py-2">
                    <MaterialCommunityIcons name="delete-outline" size={16} className="text-error mr-1" />
                    <Text className="text-error font-label-md">Delete User</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
