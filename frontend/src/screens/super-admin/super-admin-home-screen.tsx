import { useCallback, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../../api/client";
import { useAuthStore } from "../../store/auth-store";

type Org = { id: string; name: string; slug: string; schema_name: string; is_active: boolean };

export function SuperAdminHomeScreen() {
  const logout = useAuthStore((s) => s.logout);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data } = await api.get<Org[]>("/super-admin/organizations");
    setOrgs(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  async function createOrg() {
    try {
      await api.post("/super-admin/organizations", { name, slug });
      setName("");
      setSlug("");
      setMsg("Organization created");
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <View className="flex-1 bg-brand-sand p-4 pt-12">
      <View className="flex-row justify-between mb-4">
        <Text className="text-2xl font-bold">Super Admin</Text>
        <Pressable onPress={() => logout()}>
          <Text>Logout</Text>
        </Pressable>
      </View>
      {msg ? <Text className="text-brand-clay mb-2">{msg}</Text> : null}
      <TextInput
        className="bg-white border rounded px-3 py-2 mb-2"
        placeholder="Org name"
        value={name}
        onChangeText={setName}
      />
      <TextInput
        className="bg-white border rounded px-3 py-2 mb-2"
        placeholder="slug"
        autoCapitalize="none"
        value={slug}
        onChangeText={setSlug}
      />
      <Pressable className="bg-brand-leaf rounded py-3 items-center mb-4" onPress={createOrg}>
        <Text className="text-white font-semibold">Create org</Text>
      </Pressable>
      <FlatList
        data={orgs}
        keyExtractor={(o) => o.id}
        renderItem={({ item }) => (
          <View className="bg-white rounded p-3 mb-2">
            <Text className="font-semibold">{item.name}</Text>
            <Text>
              {item.slug} · {item.schema_name}
            </Text>
          </View>
        )}
      />
    </View>
  );
}
