import { useCallback, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View, Alert, RefreshControl, KeyboardAvoidingView, Platform, Dimensions } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeOutUp, FadeInUp, LinearTransition, withSpring, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { api, getApiErrorMessage } from "../../api/client";
import { useAuthStore } from "../../store/auth-store";
import { OrganizationOut, OrganizationUpdate } from "../../types/api";

type SuperAdminStackParamList = {
  SuperAdminHome: undefined;
  SuperAdminOrgAdmins: { orgId: string; orgName: string };
};

type NavigationProp = NativeStackNavigationProp<SuperAdminStackParamList, "SuperAdminHome">;

const { height } = Dimensions.get('window');

function OrganizationCard({ 
  item, 
  index, 
  onUpdate, 
  onToggleStatus, 
  onDelete, 
  onNavigateAdmins 
}: { 
  item: OrganizationOut; 
  index: number;
  onUpdate: (id: string, name: string) => void;
  onToggleStatus: (id: string, currentStatus: boolean) => void;
  onDelete: (id: string, name: string) => void;
  onNavigateAdmins: (id: string, name: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const [showOptions, setShowOptions] = useState(false);

  return (
    <Animated.View 
      entering={FadeInUp.delay(index * 100).springify().damping(22).stiffness(200)}
      layout={LinearTransition.springify().damping(22)}
      className="bg-surface rounded-[28px] p-5 mb-lg shadow-sm border border-black/5 elevation-sm overflow-hidden"
    >
      <View className="flex-row justify-between items-start mb-4">
        <View className="flex-1 flex-row items-center">
          <View className="w-14 h-14 bg-brand-ink/5 rounded-full items-center justify-center mr-4 border border-brand-ink/10">
            <Text className="text-brand-ink font-headline-md">{item.name.charAt(0).toUpperCase()}</Text>
          </View>
          <View className="flex-1 justify-center">
            {isEditing ? (
              <TextInput
                className="bg-surface-container-low rounded-xl px-3 py-2 text-on-surface font-body-lg mb-1 border border-brand-ink/20"
                value={editName}
                onChangeText={setEditName}
                autoFocus
              />
            ) : (
              <Text className="text-headline-sm font-headline-sm text-brand-ink mb-1">{item.name}</Text>
            )}
            <View className="flex-row items-center">
              <MaterialCommunityIcons name="database-outline" size={14} className="text-on-surface-variant/70 mr-1.5" />
              <Text className="text-body-sm font-medium text-on-surface-variant/70">{item.schema_name}</Text>
            </View>
          </View>
        </View>
        
        <View className="items-end ml-2 mt-1">
          <View className={`px-2.5 py-1.5 rounded-full border ${item.is_active ? 'bg-[#e8f5e9] border-[#c8e6c9]' : 'bg-[#ffebee] border-[#ffcdd2]'}`}>
            <Text className={`text-[10px] font-bold tracking-wider ${item.is_active ? 'text-[#2e7d32]' : 'text-[#c62828]'}`}>
              {item.is_active ? 'ACTIVE' : 'INACTIVE'}
            </Text>
          </View>
        </View>
      </View>

      {/* Actions Footer */}
      <View className="flex-row items-center justify-between mt-2">
        {isEditing ? (
          <View className="flex-row gap-3 flex-1">
            <Pressable accessibilityRole="button" onPress={() => { onUpdate(item.id, editName); setIsEditing(false); }} className="bg-brand-ink flex-1 h-12 rounded-full flex-row items-center justify-center active:opacity-80">
              <MaterialCommunityIcons name="check" size={18} className="text-white mr-1.5" />
              <Text className="text-white font-label-md">Save Changes</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => { setIsEditing(false); setEditName(item.name); }} className="bg-surface-container-highest w-12 h-12 rounded-full items-center justify-center active:opacity-80">
              <MaterialCommunityIcons name="close" size={20} className="text-on-surface-variant" />
            </Pressable>
          </View>
        ) : (
          <View className="flex-row items-center w-full">
            {/* Context Menu Toggle */}
            <View className="flex-row items-center bg-surface-container-low rounded-full mr-3 h-12 px-1">
              <Pressable accessibilityRole="button" onPress={() => setIsEditing(true)} className="w-10 h-10 rounded-full items-center justify-center active:opacity-70">
                <MaterialCommunityIcons name="pencil-outline" size={18} className="text-on-surface-variant" />
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => onToggleStatus(item.id, item.is_active)} className="w-10 h-10 rounded-full items-center justify-center active:opacity-70">
                <MaterialCommunityIcons name={item.is_active ? "pause-circle-outline" : "play-circle-outline"} size={18} className={item.is_active ? "text-error" : "text-primary"} />
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => onDelete(item.id, item.name)} className="w-10 h-10 rounded-full items-center justify-center active:opacity-70">
                <MaterialCommunityIcons name="trash-can-outline" size={18} className="text-error" />
              </Pressable>
            </View>

            <Pressable accessibilityRole="button" 
              className="bg-brand-ink flex-1 h-12 rounded-full active:opacity-80 flex-row items-center justify-center pl-4 pr-3"
              onPress={() => onNavigateAdmins(item.id, item.name)}
            >
              <Text className="text-white font-label-md mr-1.5">Manage Admins</Text>
              <MaterialCommunityIcons name="arrow-right" size={18} className="text-white" />
            </Pressable>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

export function SuperAdminHomeScreen() {
  const logout = useAuthStore((s) => s.logout);
  const navigation = useNavigation<NavigationProp>();
  const [orgs, setOrgs] = useState<OrganizationOut[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isFormVisible, setIsFormVisible] = useState(false);

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
      setIsFormVisible(false);
      showMessage("Organization created successfully.");
      await refresh();
    } catch (e) {
      showMessage(e instanceof Error ? e.message : "Failed to create organization", true);
    } finally {
      setLoading(false);
    }
  }

  async function updateOrg(orgId: string, newName: string) {
    if (!newName) return;
    try {
      const payload: OrganizationUpdate = { name: newName };
      await api.patch(`/super-admin/organizations/${orgId}`, payload);
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
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-background relative">
      {/* Background Architectural Header */}
      <View className="absolute top-0 left-0 right-0 h-[280px] bg-brand-ink rounded-b-[48px] overflow-hidden" />

      <View className="flex-1 px-lg pt-16 z-10">
        {/* Header Section */}
        <View className="flex-row justify-between items-start mb-8">
          <View className="flex-1">
            <Text className="text-[36px] leading-[44px] tracking-tight font-bold text-white mb-1">Tenants</Text>
            <Text className="text-white/70 text-body-lg font-medium">Platform orchestration</Text>
          </View>
          <View className="flex-row gap-3">
            <Pressable accessibilityRole="button"
              onPress={() => setIsFormVisible(!isFormVisible)}
              className={`w-12 h-12 rounded-full items-center justify-center active:opacity-70 shadow-sm ${isFormVisible ? 'bg-white' : 'bg-white/20'}`}
            >
              <MaterialCommunityIcons name={isFormVisible ? "close" : "plus"} size={24} className={isFormVisible ? "text-brand-ink" : "text-white"} />
            </Pressable>
            <Pressable accessibilityRole="button"
              onPress={() => logout()}
              className="bg-white/10 border border-white/10 w-12 h-12 rounded-full items-center justify-center active:opacity-70"
            >
              <MaterialCommunityIcons name="logout-variant" size={20} className="text-white" />
            </Pressable>
          </View>
        </View>

        {msg ? (
          <Animated.View entering={FadeInDown} exiting={FadeOutUp} className={`mb-lg p-4 rounded-2xl flex-row items-center border ${isError ? 'bg-error-container border-error/20' : 'bg-[#e8f5e9] border-[#c8e6c9]'}`}>
            <MaterialCommunityIcons name={isError ? "alert-circle" : "check-circle"} size={22} color={isError ? "#ba1a1a" : "#2e7d32"} className="mr-3" />
            <Text className={`text-body-md font-medium flex-1 ${isError ? 'text-on-error-container' : 'text-[#1b5e20]'}`}>
              {msg}
            </Text>
          </Animated.View>
        ) : null}

        {/* Collapsible Form */}
        {isFormVisible && (
          <Animated.View 
            entering={FadeInDown.springify().damping(22).stiffness(200)} 
            exiting={FadeOutUp.springify().damping(22).stiffness(200)}
            className="bg-white rounded-[32px] p-6 mb-8 shadow-sm border border-black/5 elevation-md"
          >
            <View className="flex-row items-center mb-6">
              <View className="bg-brand-ink/5 w-12 h-12 rounded-full items-center justify-center mr-4">
                <MaterialCommunityIcons name="domain-plus" size={24} className="text-brand-ink" />
              </View>
              <View>
                <Text className="text-headline-sm font-headline-sm text-brand-ink">New Tenant</Text>
                <Text className="text-body-sm text-on-surface-variant/70 mt-0.5">Provision a new organization space</Text>
              </View>
            </View>

            <View className="flex-row items-center bg-surface-container-low rounded-2xl px-4 mb-6 h-[56px] border border-outline-variant/30 focus:border-brand-ink">
              <MaterialCommunityIcons name="office-building" size={22} className="text-on-surface-variant/70 mr-3" />
              <TextInput
                className="flex-1 text-on-surface font-body-lg h-full placeholder:text-on-surface-variant/50"
                placeholder="Organization Name"
                value={name}
                onChangeText={setName}
                autoFocus
              />
            </View>
            
            <Pressable accessibilityRole="button"
              className="bg-brand-ink rounded-full h-[56px] flex-row items-center justify-center active:opacity-80" 
              onPress={createOrg}
              disabled={loading}
            >
              {loading ? (
                <Text className="text-white font-label-lg tracking-wide">PROVISIONING...</Text>
              ) : (
                <Text className="text-white font-label-lg tracking-wide">CREATE TENANT</Text>
              )}
            </Pressable>
          </Animated.View>
        )}

        {/* Organization List */}
        <FlatList
          data={orgs}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ paddingBottom: 100, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={isFormVisible ? "#012D1D" : "#ffffff"} colors={['#012D1D']} />}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-2xl mt-12 bg-white/5 rounded-[40px]">
              <View className="bg-white/10 w-28 h-28 rounded-full items-center justify-center mb-6 border border-white/10">
                <MaterialCommunityIcons name="domain-off" size={48} className="text-white/60" />
              </View>
              <Text className="text-[24px] font-bold text-white text-center mb-2">No Tenants Found</Text>
              <Text className="text-body-lg text-white/60 text-center px-lg">Click the bright + button above to provision your first tenant organization.</Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <OrganizationCard 
              item={item} 
              index={index} 
              onUpdate={updateOrg}
              onToggleStatus={toggleOrgStatus}
              onDelete={confirmDelete}
              onNavigateAdmins={(id, name) => navigation.navigate("SuperAdminOrgAdmins", { orgId: id, orgName: name })}
            />
          )}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
