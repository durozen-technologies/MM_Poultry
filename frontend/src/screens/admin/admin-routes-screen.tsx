import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { createRoute, listRoutes, listUnassignedRetailers } from "../../api/routes";
import type { Route } from "../../types/api";
import { AdminScreenContainer } from "../../components/admin/admin-screen-container";
import { AdminHeader } from "../../components/admin/admin-header";
import { AdminCard } from "../../components/admin/admin-card";

export function AdminRoutesScreen({ navigation }: { navigation: any }) {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [unassignedCount, setUnassignedCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [routeList, unassigned] = await Promise.all([
        listRoutes(),
        listUnassignedRetailers(),
      ]);
      setRoutes(routeList);
      setUnassignedCount(unassigned.total_count ?? unassigned.items.length);
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Failed to load routes", ok: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return routes.filter((r) => r.is_active);
    return routes.filter(
      (r) =>
        r.is_active &&
        (r.name.toLowerCase().includes(q) || (r.area || "").toLowerCase().includes(q))
    );
  }, [routes, search]);

  async function onCreate() {
    if (!name.trim()) {
      setMsg({ text: "Route name is required", ok: false });
      return;
    }
    setActionLoading(true);
    try {
      await createRoute({ name: name.trim(), area: area.trim() || null });
      setName("");
      setArea("");
      setIsAdding(false);
      setMsg({ text: "Route created", ok: true });
      await refresh();
    } catch (e: any) {
      const m = e?.response?.data?.error?.message || e?.response?.data?.detail || e.message;
      setMsg({ text: typeof m === "string" ? m : "Failed to create route", ok: false });
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <AdminScreenContainer
      noScroll
      header={
        <AdminHeader
          title="Routes"
          subtitle="Group retailers for delivery"
          onBack={() => navigation.goBack()}
          rightContent={
            <Pressable
              accessibilityRole="button"
              className="w-10 h-10 items-center justify-center rounded-full bg-surface-container-highest"
              onPress={refresh}
            >
              {loading ? (
                <ActivityIndicator size="small" />
              ) : (
                <MaterialIcons name="refresh" size={22} className="text-on-surface" />
              )}
            </Pressable>
          }
        />
      }
    >
      <FlatList
        data={filtered}
        keyExtractor={(r) => r.id}
        className="flex-1 px-4 pt-2"
        contentContainerStyle={{ paddingBottom: 40 }}
        ListHeaderComponent={
          <>
            {msg ? (
              <View className={`p-3 rounded-xl mb-3 ${msg.ok ? "bg-primary-container/30" : "bg-error-container/30"}`}>
                <Text className={msg.ok ? "text-primary font-semibold" : "text-error font-semibold"}>{msg.text}</Text>
              </View>
            ) : null}

            <View className="h-12 bg-surface-container-high rounded-full flex-row items-center px-4 mb-3">
              <MaterialIcons name="search" size={20} className="text-on-surface-variant" />
              <TextInput
                className="flex-1 ml-2 text-on-surface"
                placeholder="Search routes..."
                placeholderTextColor="#737373"
                value={search}
                onChangeText={setSearch}
              />
            </View>

            <Pressable
              accessibilityRole="button"
              className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 mb-4 flex-row items-center justify-between"
              onPress={() => navigation.navigate("AdminRouteDetail", { mode: "unassigned" })}
            >
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-full bg-tertiary/10 items-center justify-center">
                  <MaterialIcons name="person-off" size={22} className="text-tertiary" />
                </View>
                <View>
                  <Text className="font-semibold text-on-surface">Unassigned retailers</Text>
                  <Text className="text-sm text-on-surface-variant">Tap to view and assign</Text>
                </View>
              </View>
              <View className="bg-error-container px-3 py-1 rounded-full">
                <Text className="text-error font-bold">{unassignedCount}</Text>
              </View>
            </Pressable>

            {!isAdding ? (
              <Pressable
                accessibilityRole="button"
                className="bg-primary rounded-xl py-3 items-center mb-4"
                onPress={() => setIsAdding(true)}
              >
                <Text className="text-on-primary font-semibold">Add Route</Text>
              </Pressable>
            ) : (
              <AdminCard title="New Route" icon="add-road" containerClass="mb-4">
                <TextInput
                  className="border border-outline-variant rounded-lg px-3 py-2 mb-2 bg-surface text-on-surface"
                  placeholder="Route name *"
                  placeholderTextColor="#737373"
                  value={name}
                  onChangeText={setName}
                />
                <TextInput
                  className="border border-outline-variant rounded-lg px-3 py-2 mb-3 bg-surface text-on-surface"
                  placeholder="Area (optional)"
                  placeholderTextColor="#737373"
                  value={area}
                  onChangeText={setArea}
                />
                <View className="flex-row gap-2">
                  <Pressable
                    accessibilityRole="button"
                    className="flex-1 border border-outline-variant rounded-lg py-2 items-center"
                    onPress={() => setIsAdding(false)}
                  >
                    <Text className="text-on-surface-variant">Cancel</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    className="flex-1 bg-primary rounded-lg py-2 items-center"
                    onPress={onCreate}
                    disabled={actionLoading}
                  >
                    <Text className="text-on-primary font-semibold">{actionLoading ? "Saving..." : "Save"}</Text>
                  </Pressable>
                </View>
              </AdminCard>
            )}
          </>
        }
        ListEmptyComponent={
          !loading ? (
            <Text className="text-center text-on-surface-variant py-8">No routes yet</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            className="bg-surface-container-lowest rounded-xl p-4 mb-3 border border-outline-variant/20"
            onPress={() => navigation.navigate("AdminRouteDetail", { routeId: item.id })}
          >
            <View className="flex-row justify-between items-start">
              <View className="flex-1">
                <Text className="font-bold text-on-surface text-lg">{item.name}</Text>
                {item.area ? (
                  <Text className="text-on-surface-variant mt-1">{item.area}</Text>
                ) : null}
              </View>
              <View className="bg-primary-container px-3 py-1 rounded-full">
                <Text className="text-on-primary-container font-semibold">{item.retailer_count} shops</Text>
              </View>
            </View>
          </Pressable>
        )}
      />
    </AdminScreenContainer>
  );
}
