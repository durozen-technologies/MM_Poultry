import { useCallback, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View, Alert, RefreshControl, KeyboardAvoidingView, Platform } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api, getApiErrorMessage } from "../../api/client";
import { useAuthStore } from "../../store/auth-store";
import { OrganizationOut, OrganizationUpdate } from "../../types/api";

type SuperAdminStackParamList = {
  SuperAdminHome: undefined;
  SuperAdminOrgAdmins: { orgId: string; orgName: string };
};

type NavigationProp = NativeStackNavigationProp<SuperAdminStackParamList, "SuperAdminHome">;

export function SuperAdminHomeScreen() {
  const logout = useAuthStore((s) => s.logout);
  const navigation = useNavigation<NavigationProp>();
  const [orgs, setOrgs] = useState<OrganizationOut[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get<OrganizationOut[]>("/super-admin/organizations");
      setOrgs(data);
    } catch (e) {
      console.warn("Failed to fetch orgs", e);
    }
  }, []);

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

  async function createOrg() {
    if (!name) {
      showMessage("Name is required.", true);
      return;
    }
    setLoading(true);
    try {
      const generatedSlug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      await api.post("/super-admin/organizations", { name, slug: generatedSlug });
      setName("");
      showMessage("Organization created successfully.");
      await refresh();
    } catch (e) {
      showMessage(e instanceof Error ? e.message : "Failed to create organization", true);
    } finally {
      setLoading(false);
    }
  }

  async function updateOrg(orgId: string) {
    if (!editName) return;
    try {
      const payload: OrganizationUpdate = { name: editName };
      await api.patch(`/super-admin/organizations/${orgId}`, payload);
      setEditingId(null);
      showMessage("Organization updated.");
      await refresh();
    } catch (e) {
      showMessage("Failed to update organization.", true);
    }
  }

  async function toggleOrgStatus(orgId: string, currentStatus: boolean) {
    try {
      const payload: OrganizationUpdate = { is_active: !currentStatus };
      await api.patch(`/super-admin/organizations/${orgId}`, payload);
      showMessage(`Organization ${currentStatus ? "deactivated" : "activated"}.`);
      await refresh();
    } catch (e) {
      showMessage("Failed to update status.", true);
    }
  }

  function confirmDelete(orgId: string, orgName: string) {
    Alert.alert(
      "Delete Organization",
      `Are you sure you want to completely delete "${orgName}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: async () => {
            try {
              await api.delete(`/super-admin/organizations/${orgId}`);
              showMessage("Organization deleted.");
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
        <View className="flex-row justify-between items-center mb-lg">
          <View>
            <Text className="text-display-lg font-display-lg text-on-background">Tenants</Text>
            <Text className="text-body-md text-on-surface-variant mt-1">Manage wholesale organizations</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Button" 
            onPress={() => logout()}
            className="bg-surface-container-highest w-10 h-10 rounded-full items-center justify-center border border-outline-variant active:opacity-70"
          >
            <MaterialCommunityIcons name="logout-variant" size={20} className="text-on-surface" />
          </Pressable>
        </View>

        {/* Creation Form */}
        <View className="bg-surface rounded-2xl p-md mb-xl shadow-sm border border-outline-variant/50">
          <View className="flex-row items-center mb-md">
            <View className="bg-primary-container w-8 h-8 rounded-full items-center justify-center mr-sm">
              <MaterialCommunityIcons name="domain-plus" size={18} className="text-primary" />
            </View>
            <Text className="text-headline-sm font-headline-sm text-on-surface">New Organization</Text>
          </View>
          
          {msg ? (
            <View className={`mb-md p-sm rounded-lg flex-row items-center ${isError ? 'bg-error-container' : 'bg-primary-container'}`}>
              <MaterialCommunityIcons name={isError ? "alert-circle" : "check-circle"} size={16} color={isError ? "#93000a" : "#86af99"} className="mr-2" />
              <Text className={`text-body-md flex-1 ${isError ? 'text-on-error-container' : 'text-on-primary-container'}`}>
                {msg}
              </Text>
            </View>
          ) : null}

          <View className="flex-row items-center bg-surface-container-low border border-outline-variant rounded-xl px-md mb-md h-12">
            <MaterialCommunityIcons name="office-building" size={20} className="text-on-surface-variant mr-sm" />
            <TextInput
              className="flex-1 text-on-surface font-body-md h-full placeholder:text-on-surface-variant"
              placeholder="Enter Organization Name"
              value={name}
              onChangeText={setName}
 />
          </View>
          
          <Pressable accessibilityRole="button" accessibilityLabel="Button" 
            className="bg-primary rounded-xl h-12 flex-row items-center justify-center active:opacity-80" 
            onPress={createOrg}
            disabled={loading}
          >
            {loading ? (
              <Text className="text-on-primary font-label-md">Creating...</Text>
            ) : (
              <>
                <MaterialCommunityIcons name="plus" size={20} className="text-white mr-1" />
                <Text className="text-on-primary font-label-md">Create Organization</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Organization List */}
        <Text className="text-headline-md font-headline-md text-on-background mb-md">Active Tenants ({orgs.length})</Text>
        <FlatList
          data={orgs}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ paddingBottom: 100, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#012d1d" colors={['#012d1d']} />
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-xl mt-xl">
              <MaterialCommunityIcons name="domain-off" size={64} className="text-surface-variant mb-md opacity-50" />
              <Text className="text-headline-sm font-headline-sm text-on-surface-variant text-center">No Active Organizations</Text>
              <Text className="text-body-md text-outline mt-sm text-center px-lg">Create a new organization above to get started with the platform.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View className={`bg-surface rounded-2xl p-md mb-md shadow-sm border border-outline-variant/30 ${!item.is_active ? 'opacity-60' : ''}`}>
              <View className="flex-row justify-between items-start mb-sm">
                <View className="flex-1 flex-row items-start">
                  <View className="bg-surface-container-highest w-10 h-10 rounded-full items-center justify-center mr-md mt-1">
                    <Text className="text-on-surface font-headline-sm">{item.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View className="flex-1">
                    {editingId === item.id ? (
                      <TextInput
                        className="bg-surface-container-low border border-outline-variant rounded-lg px-sm py-xs text-on-surface font-body-md mb-xs"
                        value={editName}
                        onChangeText={setEditName}
                        autoFocus
                      />
                    ) : (
                      <Text className="text-headline-sm font-headline-sm text-on-surface mb-1">{item.name}</Text>
                    )}
                    <View className="flex-row items-center">
                      <MaterialCommunityIcons name="database-outline" size={14} className="text-on-surface-variant mr-1" />
                      <Text className="text-sm text-outline font-medium">{item.schema_name}</Text>
                    </View>
                  </View>
                </View>
                
                <View className="flex-row gap-2 items-center ml-sm">
                  <Pressable accessibilityRole="button" accessibilityLabel="Button" 
                    className={`px-3 py-1.5 rounded-full border ${item.is_active ? 'border-error/30 bg-error/10' : 'border-primary/30 bg-primary/10'}`}
                    onPress={() => toggleOrgStatus(item.id, item.is_active)}
                  >
                    <Text className={`font-label-md ${item.is_active ? 'text-error' : 'text-primary'}`}>
                      {item.is_active ? 'Deactivate' : 'Activate'}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Actions Footer */}
              <View className="flex-row justify-between items-center mt-md border-t border-outline-variant/30 pt-sm">
                <View className="flex-row gap-4">
                  {editingId === item.id ? (
                    <>
                      <Pressable accessibilityRole="button" accessibilityLabel="Button" onPress={() => updateOrg(item.id)} className="flex-row items-center py-2">
                        <MaterialCommunityIcons name="check" size={16} className="text-primary mr-1" />
                        <Text className="text-primary font-label-md">Save</Text>
                      </Pressable>
                      <Pressable accessibilityRole="button" accessibilityLabel="Button" onPress={() => { setEditingId(null); setEditName(""); }} className="flex-row items-center py-2">
                        <MaterialCommunityIcons name="close" size={16} className="text-on-surface mr-1" />
                        <Text className="text-on-surface-variant font-label-md">Cancel</Text>
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <Pressable accessibilityRole="button" accessibilityLabel="Button" onPress={() => { setEditingId(item.id); setEditName(item.name); }} className="flex-row items-center py-2">
                        <MaterialCommunityIcons name="pencil-outline" size={16} className="text-primary mr-1" />
                        <Text className="text-tertiary font-label-md">Edit</Text>
                      </Pressable>
                      <Pressable accessibilityRole="button" accessibilityLabel="Button" onPress={() => confirmDelete(item.id, item.name)} className="flex-row items-center py-2">
                        <MaterialCommunityIcons name="delete-outline" size={16} className="text-error mr-1" />
                        <Text className="text-error font-label-md">Delete</Text>
                      </Pressable>
                    </>
                  )}
                </View>

                <Pressable accessibilityRole="button" accessibilityLabel="Button" 
                  className="bg-primary-container px-4 py-2 rounded-full active:opacity-80 flex-row items-center"
                  onPress={() => navigation.navigate("SuperAdminOrgAdmins", { orgId: item.id, orgName: item.name })}
                >
                  <MaterialCommunityIcons name="shield-account-outline" size={16} className="text-primary mr-1.5" />
                  <Text className="text-on-primary-container font-label-md">Admins</Text>
                  <MaterialCommunityIcons name="chevron-right" size={16} className="text-primary ml-1" />
                </Pressable>
              </View>
            </View>
          )}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
