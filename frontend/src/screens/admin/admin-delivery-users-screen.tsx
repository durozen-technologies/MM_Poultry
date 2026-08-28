import { useCallback, useState } from "react";
import { FlatList, ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View, } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { createDeliveryUser, deleteDeliveryUser, listDeliveryUsers } from "../../api/users";
import type { User } from "../../types/api";

export function AdminDeliveryUsersScreen({ navigation }: { navigation: any }) {
  const [users, setUsers] = useState<User[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await listDeliveryUsers());
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to load users");
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
    if (!username.trim() || !password) return;
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
      setMsg("Delivery user created");
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to create user");
    }
  }

  async function onRemove(user: User) {
    try {
      await deleteDeliveryUser(user.id);
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to remove user");
    }
  }

  return (
    <SafeAreaView className="flex-1 max-w-3xl mx-auto w-full bg-background" edges={["top", "bottom"]}>
      <View className="h-16 px-4 flex-row items-center bg-surface/90 border-b border-outline-variant/20">
        <Pressable accessibilityRole="button" accessibilityLabel="Button" className="w-11 h-11 -ml-2 items-center justify-center rounded-full" onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} className="text-on-surface" />
        </Pressable>
        <Text className="font-headline-sm text-on-surface font-semibold ml-2">Delivery Users</Text>
      </View>

      <FlatList
        data={users}
        keyExtractor={(u) => u.id}
        className="flex-1 px-4 py-4"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {msg ? <Text className="text-error mb-3 font-semibold">{msg}</Text> : null}

            <View className="bg-surface-container-lowest rounded-2xl p-4 mb-4 border border-outline-variant/20 flex-col gap-3">
              <Text className="font-label-md text-on-surface-variant uppercase font-semibold">New Delivery User</Text>
              <TextInput className="bg-surface h-12 border border-outline-variant rounded-lg px-3 text-on-surface placeholder:text-on-surface-variant" placeholder="Username" value={username} onChangeText={setUsername} autoCapitalize="none" placeholderTextColor="#737373" />
              <View className="flex-row items-center bg-surface h-12 border border-outline-variant rounded-lg pr-1">
                <TextInput className="flex-1 px-3 text-on-surface placeholder:text-on-surface-variant" placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} placeholderTextColor="#737373" />
                <Pressable accessibilityRole="button" onPress={() => setShowPassword(!showPassword)} className="p-2 h-full justify-center">
                  <MaterialIcons name={showPassword ? "visibility" : "visibility-off"} size={22} className="text-on-surface-variant" />
                </Pressable>
              </View>
              <TextInput className="bg-surface h-12 border border-outline-variant rounded-lg px-3 text-on-surface placeholder:text-on-surface-variant" placeholder="Full name (optional)" value={fullName} onChangeText={setFullName} placeholderTextColor="#737373" />
              <TextInput className="bg-surface h-12 border border-outline-variant rounded-lg px-3 text-on-surface placeholder:text-on-surface-variant" placeholder="Mobile (optional)" value={mobile} onChangeText={setMobile} keyboardType="phone-pad" placeholderTextColor="#737373" />
              <Pressable accessibilityRole="button" accessibilityLabel="Button" className="bg-primary h-11 rounded-lg items-center justify-center" onPress={onAdd}>
                <Text className="text-on-primary font-semibold">Create User</Text>
              </Pressable>
            </View>

            {loading ? (
              <ActivityIndicator className="text-primary" />
            ) : users.length === 0 ? (
              <Text className="text-on-surface-variant text-center py-8">No delivery users yet.</Text>
            ) : null}
          </>
        }
        renderItem={({ item: u }) => (
          <View className="bg-surface-container-lowest rounded-xl p-4 mb-2 border border-outline-variant/20 flex-row justify-between items-center">
            <View>
              <Text className="font-headline-sm text-on-surface font-semibold">{u.username}</Text>
              <Text className={`font-label-md mt-1 ${u.is_active ? "text-primary" : "text-error"}`}>
                {u.is_active ? "Active" : "Inactive"}
              </Text>
            </View>
            {u.is_active ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Button" onPress={() => onRemove(u)} className="p-2">
                <MaterialIcons name="person-remove" size={22} className="text-error" />
              </Pressable>
            ) : null}
          </View>
        )}
      />
    </SafeAreaView>
  );
}
