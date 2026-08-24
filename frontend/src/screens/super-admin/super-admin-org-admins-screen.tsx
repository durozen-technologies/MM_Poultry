import { useCallback, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View, Alert, RefreshControl, KeyboardAvoidingView, Platform, Dimensions } from "react-native";
import { useFocusEffect, useRoute, useNavigation } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeOutUp, FadeInUp, LinearTransition } from "react-native-reanimated";
import { api, getApiErrorMessage } from "../../api/client";
import { User, TenantAdminCreate, TenantAdminUpdate } from "../../types/api";

function AdminCard({
  item,
  index,
  onUpdatePassword,
  onToggleStatus,
  onDelete
}: {
  item: User;
  index: number;
  onUpdatePassword: (id: string, newPass: string) => void;
  onToggleStatus: (id: string, currentStatus: boolean) => void;
  onDelete: (id: string, username: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editPassword, setEditPassword] = useState("");

  return (
    <Animated.View 
      entering={FadeInUp.delay(index * 100).springify().damping(22).stiffness(200)}
      layout={LinearTransition.springify().damping(22)}
      className="bg-surface rounded-[28px] p-5 mb-lg shadow-sm border border-black/5 elevation-sm overflow-hidden"
    >
      <View className="flex-row justify-between items-start mb-4">
        <View className="flex-1 flex-row items-center">
          <View className="w-14 h-14 bg-[rgba(1,45,29,0.05)] rounded-full items-center justify-center mr-4 border border-[rgba(1,45,29,0.1)]">
            <Text className="text-brand-ink font-headline-md">{item.username.charAt(0).toUpperCase()}</Text>
          </View>
          <View className="flex-1 justify-center">
            <Text className="text-headline-sm font-headline-sm text-brand-ink mb-1" numberOfLines={1}>{item.username}</Text>
            <View className="flex-row items-center">
              <MaterialCommunityIcons name="shield-account-outline" size={14} className="text-[rgba(65,72,68,0.7)] mr-1.5" />
              <Text className="text-body-sm font-medium text-[rgba(65,72,68,0.7)]">Tenant Admin</Text>
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
          <View className="w-full flex-row gap-3">
            <View className="flex-1 flex-row items-center bg-surface-container-low rounded-full px-4 h-12 border border-[rgba(1,45,29,0.2)]">
              <MaterialCommunityIcons name="lock-reset" size={18} className="text-[rgba(65,72,68,0.7)] mr-2" />
              <TextInput
                className="flex-1 text-on-surface font-body-lg h-full placeholder:text-[rgba(65,72,68,0.5)]"
                placeholder="New password"
                secureTextEntry
                value={editPassword}
                onChangeText={setEditPassword}
                autoFocus
              />
            </View>
            <Pressable accessibilityRole="button" onPress={() => { onUpdatePassword(item.id, editPassword); setIsEditing(false); }} className="bg-brand-ink w-12 h-12 rounded-full items-center justify-center active:opacity-80">
              <MaterialCommunityIcons name="check" size={20} className="text-white" />
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => { setIsEditing(false); setEditPassword(""); }} className="bg-surface-container-highest w-12 h-12 rounded-full items-center justify-center active:opacity-80">
              <MaterialCommunityIcons name="close" size={20} className="text-on-surface-variant" />
            </Pressable>
          </View>
        ) : (
          <View className="flex-row items-center w-full">
            <View className="flex-row items-center bg-surface-container-low rounded-full mr-3 h-12 px-1">
              <Pressable accessibilityRole="button" onPress={() => onToggleStatus(item.id, item.is_active)} className="w-10 h-10 rounded-full items-center justify-center active:opacity-70">
                <MaterialCommunityIcons name={item.is_active ? "pause-circle-outline" : "play-circle-outline"} size={18} className={item.is_active ? "text-error" : "text-primary"} />
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => onDelete(item.id, item.username)} className="w-10 h-10 rounded-full items-center justify-center active:opacity-70">
                <MaterialCommunityIcons name="trash-can-outline" size={18} className="text-error" />
              </Pressable>
            </View>

            <Pressable accessibilityRole="button" 
              className="bg-[rgba(1,45,29,0.1)] border border-[rgba(1,45,29,0.2)] flex-1 h-12 rounded-full active:opacity-80 flex-row items-center justify-center pl-4 pr-3"
              onPress={() => setIsEditing(true)}
            >
              <MaterialCommunityIcons name="key-outline" size={18} className="text-brand-ink mr-2" />
              <Text className="text-brand-ink font-label-md">Reset Password</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

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
  const [isFormVisible, setIsFormVisible] = useState(false);

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
      setIsFormVisible(false);
      showMessage("Admin created successfully.");
      await refresh();
    } catch (e) {
      showMessage(e instanceof Error ? e.message : "Failed to create", true);
    } finally {
      setLoading(false);
    }
  }

  async function updateAdminPassword(adminId: string, newPassword: string) {
    if (!newPassword) return;
    try {
      const payload: TenantAdminUpdate = { password: newPassword };
      await api.patch(`/super-admin/organizations/${orgId}/admins/${adminId}`, payload);
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
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-background relative">
      {/* Background Architectural Header */}
      <View className="absolute top-0 left-0 right-0 h-[280px] bg-brand-ink rounded-b-[48px] overflow-hidden" />

      <View className="flex-1 px-lg pt-16 z-10">
        {/* Header Section */}
        <View className="flex-row items-center justify-between mb-8">
          <View className="flex-row items-center flex-1 pr-4">
            <Pressable accessibilityRole="button"
              onPress={() => navigation.goBack()}
              className="bg-[rgba(255,255,255,0.1)] border border-[rgba(255,255,255,0.1)] w-12 h-12 rounded-full mr-4 items-center justify-center active:opacity-70 shadow-sm"
            >
              <MaterialCommunityIcons name="arrow-left" size={20} className="text-white" />
            </Pressable>
            <View className="flex-1">
              <Text className="text-[28px] leading-[36px] tracking-tight font-bold text-white mb-1" numberOfLines={1}>
                {orgName}
              </Text>
              <Text className="text-[rgba(255,255,255,0.7)] text-body-lg font-medium">Tenant Administrators</Text>
            </View>
          </View>
          
          <Pressable accessibilityRole="button"
            onPress={() => setIsFormVisible(!isFormVisible)}
            className={`w-12 h-12 rounded-full items-center justify-center active:opacity-70 shadow-sm ${isFormVisible ? 'bg-white' : 'bg-[rgba(255,255,255,0.2)]'}`}
          >
            <MaterialCommunityIcons name={isFormVisible ? "close" : "plus"} size={24} className={isFormVisible ? "text-brand-ink" : "text-white"} />
          </Pressable>
        </View>

        {msg ? (
          <Animated.View entering={FadeInDown} exiting={FadeOutUp} className={`mb-lg p-4 rounded-2xl flex-row items-center border ${isError ? 'bg-error-container border-error/20' : 'bg-[#e8f5e9] border-[#c8e6c9]'}`}>
            <MaterialCommunityIcons name={isError ? "alert-circle" : "check-circle"} size={22} color={isError ? "#ba1a1a" : "#2e7d32"} className="mr-3" />
            <Text className={`text-body-md font-medium flex-1 ${isError ? 'text-on-error-container' : 'text-[#1b5e20]'}`}>
              {msg}
            </Text>
          </Animated.View>
        ) : null}

        {/* Collapsible Creation Form */}
        {isFormVisible && (
          <Animated.View 
            entering={FadeInDown.springify().damping(22).stiffness(200)} 
            exiting={FadeOutUp.springify().damping(22).stiffness(200)}
            className="bg-white rounded-[32px] p-6 mb-8 shadow-sm border border-black/5 elevation-md"
          >
            <View className="flex-row items-center mb-6">
              <View className="bg-[rgba(1,45,29,0.05)] w-12 h-12 rounded-full items-center justify-center mr-4">
                <MaterialCommunityIcons name="account-plus" size={24} className="text-brand-ink" />
              </View>
              <View>
                <Text className="text-headline-sm font-headline-sm text-brand-ink">New Admin</Text>
                <Text className="text-body-sm text-[rgba(65,72,68,0.7)] mt-0.5">Create credentials for this tenant</Text>
              </View>
            </View>

            <View className="flex-row items-center bg-surface-container-low rounded-2xl px-4 mb-4 h-[56px] border border-outline-variant/30 focus:border-brand-ink">
              <MaterialCommunityIcons name="account" size={22} className="text-[rgba(65,72,68,0.7)] mr-3" />
              <TextInput
                className="flex-1 text-on-surface font-body-lg h-full placeholder:text-[rgba(65,72,68,0.5)]"
                placeholder="Admin Username"
                autoCapitalize="none"
                value={username}
                onChangeText={setUsername}
              />
            </View>
            <View className="flex-row items-center bg-surface-container-low rounded-2xl px-4 mb-6 h-[56px] border border-outline-variant/30 focus:border-brand-ink">
              <MaterialCommunityIcons name="lock-outline" size={22} className="text-[rgba(65,72,68,0.7)] mr-3" />
              <TextInput
                className="flex-1 text-on-surface font-body-lg h-full placeholder:text-[rgba(65,72,68,0.5)]"
                placeholder="Secure Password"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>
            
            <Pressable accessibilityRole="button" 
              className="bg-brand-ink rounded-full h-[56px] flex-row items-center justify-center active:opacity-80" 
              onPress={createAdmin}
              disabled={loading}
            >
              {loading ? (
                <Text className="text-white font-label-lg tracking-wide">PROVISIONING...</Text>
              ) : (
                <Text className="text-white font-label-lg tracking-wide">GRANT ACCESS</Text>
              )}
            </Pressable>
          </Animated.View>
        )}

        {/* Admins List */}
        <FlatList
          data={admins}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ paddingBottom: 100, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={isFormVisible ? "#012d1d" : "#ffffff"} colors={['#012d1d']} />}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-2xl mt-12 bg-[rgba(255,255,255,0.05)] rounded-[40px]">
              <View className="bg-[rgba(255,255,255,0.1)] w-28 h-28 rounded-full items-center justify-center mb-6 border border-[rgba(255,255,255,0.1)]">
                <MaterialCommunityIcons name="account-group-outline" size={48} className="text-[rgba(255,255,255,0.6)]" />
              </View>
              <Text className="text-[24px] font-bold text-white text-center mb-2">No Admins Assigned</Text>
              <Text className="text-body-lg text-[rgba(255,255,255,0.6)] text-center px-lg">This organization has no administrators. Click the bright + button to grant access.</Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <AdminCard 
              item={item} 
              index={index} 
              onUpdatePassword={updateAdminPassword} 
              onToggleStatus={toggleAdminStatus} 
              onDelete={confirmDelete} 
            />
          )}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
