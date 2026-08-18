import { useCallback, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View, Alert } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { api } from "../../api/client";
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
  const [slug, setSlug] = useState("");
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
    if (!name || !slug) {
      showMessage("Name and slug are required.", true);
      return;
    }
    try {
      await api.post("/super-admin/organizations", { name, slug });
      setName("");
      setSlug("");
      showMessage("Organization created successfully.");
      await refresh();
    } catch (e) {
      showMessage(e instanceof Error ? e.message : "Failed to create organization", true);
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
              showMessage(e?.response?.data?.detail || "Delete failed (Database constraints may prevent this).", true);
            }
          }
        }
      ]
    );
  }

  return (
    <View className="flex-1 bg-background p-lg pt-12">
      {/* Header */}
      <View className="flex-row justify-between items-center mb-lg">
        <Text className="text-display-lg font-display-lg text-on-background">Platform Orgs</Text>
        <Pressable 
          onPress={() => logout()}
          className="bg-surface-container-highest px-md py-xs rounded-full border border-outline-variant active:opacity-70"
        >
          <Text className="text-on-surface-variant font-label-md">Logout</Text>
        </Pressable>
      </View>

      {/* Creation Form */}
      <View className="bg-surface rounded-xl p-md mb-xl shadow-sm border border-outline-variant">
        <Text className="text-headline-sm font-headline-sm text-on-surface mb-md">New Organization</Text>
        
        {msg ? (
          <View className={`mb-md p-sm rounded-lg ${isError ? 'bg-error-container' : 'bg-primary-container'}`}>
            <Text className={`text-body-md ${isError ? 'text-on-error-container' : 'text-on-primary-container'}`}>
              {msg}
            </Text>
          </View>
        ) : null}

        <TextInput
          className="bg-surface-container-low border border-outline-variant rounded-lg px-md py-sm mb-sm text-on-surface font-body-md"
          placeholder="Organization Name"
          placeholderTextColor="#717973"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          className="bg-surface-container-low border border-outline-variant rounded-lg px-md py-sm mb-md text-on-surface font-body-md"
          placeholder="Organization Slug (e.g., demo)"
          placeholderTextColor="#717973"
          autoCapitalize="none"
          value={slug}
          onChangeText={setSlug}
        />
        <Pressable 
          className="bg-primary rounded-full py-sm items-center active:opacity-80" 
          onPress={createOrg}
        >
          <Text className="text-on-primary font-label-md">Create Organization</Text>
        </Pressable>
      </View>

      {/* Organization List */}
      <Text className="text-headline-md font-headline-md text-on-background mb-md">Active Tenants</Text>
      <FlatList
        data={orgs}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View className={`bg-surface rounded-xl p-md mb-sm shadow-sm border border-outline-variant ${!item.is_active ? 'opacity-60' : ''}`}>
            <View className="flex-row justify-between items-start mb-sm">
              <View className="flex-1">
                {editingId === item.id ? (
                  <TextInput
                    className="bg-surface-container-low border border-outline-variant rounded-lg px-sm py-xs text-on-surface font-body-md mb-xs"
                    value={editName}
                    onChangeText={setEditName}
                  />
                ) : (
                  <Text className="text-headline-sm font-headline-sm text-on-surface mb-base">{item.name}</Text>
                )}
                <Text className="text-body-md text-on-surface-variant">
                  Slug: <Text className="font-semibold">{item.slug}</Text> · Schema: <Text className="font-semibold">{item.schema_name}</Text>
                </Text>
              </View>
              
              <View className="flex-row gap-2 items-center ml-sm">
                <Pressable 
                  className={`px-sm py-base rounded border ${item.is_active ? 'border-error text-error' : 'border-primary text-primary'}`}
                  onPress={() => toggleOrgStatus(item.id, item.is_active)}
                >
                  <Text className={`font-label-md ${item.is_active ? 'text-error' : 'text-primary'}`}>
                    {item.is_active ? 'Deactivate' : 'Activate'}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Actions Footer */}
            <View className="flex-row justify-between items-center mt-sm border-t border-outline-variant pt-sm">
              <View className="flex-row gap-3">
                {editingId === item.id ? (
                  <>
                    <Pressable onPress={() => updateOrg(item.id)}>
                      <Text className="text-primary font-label-md">Save</Text>
                    </Pressable>
                    <Pressable onPress={() => { setEditingId(null); setEditName(""); }}>
                      <Text className="text-on-surface-variant font-label-md">Cancel</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Pressable onPress={() => { setEditingId(item.id); setEditName(item.name); }}>
                      <Text className="text-tertiary font-label-md">Edit Name</Text>
                    </Pressable>
                    <Pressable onPress={() => confirmDelete(item.id, item.name)}>
                      <Text className="text-error font-label-md">Delete</Text>
                    </Pressable>
                  </>
                )}
              </View>

              <Pressable 
                className="bg-primary-container px-sm py-base rounded-full active:opacity-80"
                onPress={() => navigation.navigate("SuperAdminOrgAdmins", { orgId: item.id, orgName: item.name })}
              >
                <Text className="text-on-primary-container font-label-md">Manage Admins &rarr;</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
    </View>
  );
}
