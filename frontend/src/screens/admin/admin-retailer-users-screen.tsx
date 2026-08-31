import { useCallback, useState } from "react";
import { FlatList, ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { deleteRetailerUser, listRetailerUsers, updateRetailerUser } from "../../api/users";
import { getApiErrorMessage } from "../../api/client";
import type { User } from "../../types/api";

export function AdminRetailerUsersScreen({ navigation }: { navigation: any }) {
  const queryClient = useQueryClient();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await listRetailerUsers());
    } catch (e) {
      setMsg(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      setUsers(await listRetailerUsers());
    } catch (e) {
      setMsg(getApiErrorMessage(e));
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
      await refresh();
    } catch (e) {
      setMsg(getApiErrorMessage(e));
    }
  }

  async function onRemove(user: User) {
    try {
      await deleteRetailerUser(user.id);
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "retailers"] });
      await refresh();
    } catch (e) {
      setMsg(getApiErrorMessage(e));
    }
  }

  return (
    <SafeAreaView className="flex-1 max-w-3xl mx-auto w-full bg-background" edges={["top", "bottom"]}>
      <View className="h-16 px-4 flex-row items-center bg-surface/90 border-b border-outline-variant/20">
        <Pressable accessibilityRole="button" accessibilityLabel="Button" className="w-11 h-11 -ml-2 items-center justify-center rounded-full" onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} className="text-on-surface" />
        </Pressable>
        <Text className="font-headline-sm text-on-surface font-semibold ml-2">Retailer Portal Users</Text>
      </View>

      <FlatList
        data={users}
        keyExtractor={(u) => u.id}
        className="flex-1 px-4 py-4"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <>
            {msg ? <Text className="text-error mb-3 font-semibold">{msg}</Text> : null}
            {loading && users.length === 0 ? (
              <ActivityIndicator color="#012d1d" />
            ) : null}
          </>
        }
        ListEmptyComponent={
          !loading ? <Text className="text-on-surface-variant text-center py-8">No retailer portal users yet.</Text> : null
        }
        renderItem={({ item: u }) => <RetailerUserCard user={u} onToggleStatus={onToggleStatus} onRemove={onRemove} />}
      />
    </SafeAreaView>
  );
}

function RetailerUserCard({ user, onToggleStatus, onRemove }: { user: User; onToggleStatus: (u: User) => void; onRemove: (u: User) => void }) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onUpdatePassword() {
    if (!newPassword.trim()) return;
    try {
      await updateRetailerUser(user.id, { password: newPassword });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "retailers"] });
      setNewPassword("");
      setIsEditing(false);
      setMsg("Password updated");
      setTimeout(() => setMsg(null), 3000);
    } catch (e) {
      setMsg(getApiErrorMessage(e));
      setTimeout(() => setMsg(null), 3000);
    }
  }

  return (
    <View className="bg-surface-container-lowest rounded-xl p-4 mb-3 border border-outline-variant/20">
      <View className="flex-row justify-between items-start">
        <View className="flex-1 mr-2">
          <Text className="font-headline-sm text-on-surface font-semibold">{user.username}</Text>
          <Text className="font-body-md text-on-surface-variant mt-1">Retailer: {user.retailer_shop_name || user.retailer_name || "Unknown"}</Text>
          <Text className={`font-label-md mt-1 font-semibold ${user.is_active ? "text-primary" : "text-error"}`}>
            {user.is_active ? "ACTIVE" : "INACTIVE"}
          </Text>
        </View>
        <View className="flex-row gap-2">
          <Pressable accessibilityRole="button" onPress={() => setIsEditing(!isEditing)} className="p-2 bg-surface-container rounded-full active:opacity-70">
            <MaterialIcons name="vpn-key" size={20} className="text-on-surface" />
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => onToggleStatus(user)} className={`p-2 rounded-full active:opacity-70 ${user.is_active ? "bg-error-container" : "bg-primary-container"}`}>
            <MaterialIcons name={user.is_active ? "block" : "check-circle"} size={20} className={user.is_active ? "text-on-error-container" : "text-on-primary-container"} />
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => onRemove(user)} className="p-2 bg-error-container rounded-full active:opacity-70">
            <MaterialIcons name="delete-outline" size={20} className="text-error" />
          </Pressable>
        </View>
      </View>

      {msg ? <Text className="text-primary font-label-md mt-2">{msg}</Text> : null}

      {isEditing && (
        <View className="mt-4 flex-row gap-2 items-center">
          <View className="flex-1 flex-row items-center bg-surface-container h-12 rounded-lg border border-outline-variant/50 px-3">
            <TextInput
              className="flex-1 text-on-surface font-body-md h-full placeholder:text-on-surface-variant/50 pr-2"
              placeholder="New password"
              secureTextEntry={!showPassword}
              value={newPassword}
              onChangeText={setNewPassword}
              autoCapitalize="none"
              autoFocus
            />
            <Pressable accessibilityRole="button" onPress={() => setShowPassword(!showPassword)} className="p-2 -mr-2 active:opacity-70">
              <MaterialCommunityIcons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} className="text-[rgba(65,72,68,0.7)]" />
            </Pressable>
          </View>
          <Pressable accessibilityRole="button" onPress={onUpdatePassword} className="bg-primary h-12 w-12 rounded-lg items-center justify-center active:scale-95">
            <MaterialIcons name="check" size={24} className="text-on-primary" />
          </Pressable>
        </View>
      )}
    </View>
  );
}
