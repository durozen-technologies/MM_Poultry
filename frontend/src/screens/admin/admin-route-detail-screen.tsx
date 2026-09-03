import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import {
  deactivateRoute,
  fetchAllUnassignedRetailers,
  getRoute,
  listRoutes,
  replaceRouteRetailers,
  updateRoute,
} from "../../api/routes";
import type { RouteDetail, RouteRetailer, Retailer } from "../../types/api";
import { AdminScreenContainer } from "../../components/admin/admin-screen-container";
import { AdminHeader } from "../../components/admin/admin-header";
import { AdminCard } from "../../components/admin/admin-card";
import { AdminActionFooter } from "../../components/admin/admin-action-footer";

export function AdminRouteDetailScreen({ navigation, route: navRoute }: { navigation: any; route: any }) {
  const routeId: string | undefined = navRoute.params?.routeId;
  const unassignedMode = navRoute.params?.mode === "unassigned";

  const [detail, setDetail] = useState<RouteDetail | null>(null);
  const [unassigned, setUnassigned] = useState<Retailer[]>([]);
  const [allRoutes, setAllRoutes] = useState<{ id: string; name: string }[]>([]);
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pickRouteId, setPickRouteId] = useState(routeId || "");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const routes = await listRoutes();
      setAllRoutes(routes.filter((r) => r.is_active).map((r) => ({ id: r.id, name: r.name })));
      const un = await fetchAllUnassignedRetailers();
      setUnassigned(un);

      if (routeId) {
        const d = await getRoute(routeId);
        setDetail(d);
        setName(d.name);
        setArea(d.area || "");
        setDescription(d.description || "");
        setSortOrder(d.sort_order != null ? String(d.sort_order) : "");
        const ids = new Set(d.retailers.map((r) => r.id));
        setMemberIds(ids);
        setSelectedIds(new Set());
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [routeId]);

  useEffect(() => {
    if (!routeId && !unassignedMode) {
      navigation.goBack();
      return;
    }
    void refresh();
  }, [refresh, routeId, unassignedMode, navigation]);

  const pool = useMemo(() => {
    if (unassignedMode) return unassigned;
    const members: RouteRetailer[] = detail?.retailers || [];
    return [...members, ...unassigned.filter((u) => !memberIds.has(u.id))];
  }, [unassignedMode, unassigned, detail, memberIds]);

  const filteredPool = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pool;
    return pool.filter(
      (r) =>
        (r.shop_name || r.name).toLowerCase().includes(q) ||
        (r.area || "").toLowerCase().includes(q)
    );
  }, [pool, search]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function saveMetadata() {
    if (!routeId || !name.trim()) return;
    setSaving(true);
    try {
      await updateRoute(routeId, {
        name: name.trim(),
        area: area.trim() || null,
        description: description.trim() || null,
        sort_order: sortOrder ? Number(sortOrder) : null,
      });
      setMsg("Route updated");
      await refresh();
    } catch (e: any) {
      setMsg(e?.response?.data?.detail || e.message || "Update failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveMembers() {
    if (!routeId) return;
    setSaving(true);
    try {
      const next = new Set(memberIds);
      selectedIds.forEach((id) => next.add(id));
      await replaceRouteRetailers(routeId, Array.from(next));
      setSelectedIds(new Set());
      setMsg("Retailers updated");
      await refresh();
    } catch (e: any) {
      const m = e?.response?.data?.detail || e?.response?.data?.error?.message || e.message;
      setMsg(typeof m === "string" ? m : "Failed to assign retailers");
    } finally {
      setSaving(false);
    }
  }

  function removeMember(id: string) {
    setMemberIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  async function saveMemberList() {
    if (!routeId) return;
    setSaving(true);
    try {
      await replaceRouteRetailers(routeId, Array.from(memberIds));
      setMsg("Membership saved");
      await refresh();
    } catch (e: any) {
      setMsg(e?.response?.data?.detail || e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function assignSelectedToRoute() {
    if (!pickRouteId || selectedIds.size === 0) return;
    setSaving(true);
    try {
      const target = await getRoute(pickRouteId);
      const next = new Set(target.retailers.map((r) => r.id));
      selectedIds.forEach((id) => next.add(id));
      await replaceRouteRetailers(pickRouteId, Array.from(next));
      setSelectedIds(new Set());
      setMsg("Assigned to route");
      if (routeId === pickRouteId) await refresh();
      else navigation.replace("AdminRouteDetail", { routeId: pickRouteId });
    } catch (e: any) {
      setMsg(e?.response?.data?.detail || e.message || "Assign failed");
    } finally {
      setSaving(false);
    }
  }

  function confirmDeactivate() {
    if (!routeId) return;
    Alert.alert("Deactivate route", "Retailers will be unassigned.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Deactivate",
        style: "destructive",
        onPress: async () => {
          await deactivateRoute(routeId);
          navigation.goBack();
        },
      },
    ]);
  }

  if (loading) {
    return (
      <AdminScreenContainer header={<AdminHeader title="Route" onBack={() => navigation.goBack()} />}>
        <ActivityIndicator className="mt-8" />
      </AdminScreenContainer>
    );
  }

  if (unassignedMode) {
    return (
      <AdminScreenContainer
        noScroll
        header={
          <AdminHeader
            title="Unassigned retailers"
            subtitle="Select and assign to a route"
            onBack={() => navigation.goBack()}
          />
        }
      >
        <View className="px-4 pt-2 flex-1">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
            {allRoutes.map((r) => (
              <Pressable
                key={r.id}
                onPress={() => setPickRouteId(r.id)}
                className={`px-4 py-2 rounded-full mr-2 ${pickRouteId === r.id ? "bg-primary" : "bg-surface-container"}`}
              >
                <Text className={pickRouteId === r.id ? "text-on-primary font-semibold" : "text-on-surface"}>
                  {r.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <FlatList
            data={unassigned}
            keyExtractor={(r) => r.id}
            ListEmptyComponent={<Text className="text-center text-on-surface-variant py-8">All retailers assigned</Text>}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => toggleSelect(item.id)}
                className={`p-3 mb-2 rounded-xl border flex-row justify-between items-center ${
                  selectedIds.has(item.id) ? "border-primary bg-primary/5" : "border-outline-variant/30"
                }`}
              >
                <Text className="font-semibold text-on-surface">{item.shop_name || item.name}</Text>
                {selectedIds.has(item.id) ? (
                  <MaterialIcons name="check-circle" size={20} className="text-primary" />
                ) : null}
              </Pressable>
            )}
          />
          {selectedIds.size > 0 && pickRouteId ? (
            <AdminActionFooter
              primaryLabel={`Assign ${selectedIds.size} to route`}
              onPrimaryPress={assignSelectedToRoute}
              isPrimaryLoading={saving}
            />
          ) : null}
        </View>
      </AdminScreenContainer>
    );
  }

  return (
    <AdminScreenContainer header={<AdminHeader title={detail?.name || "Route"} onBack={() => navigation.goBack()} />}>
      {msg ? (
        <View className="mx-4 mb-3 p-3 bg-surface-container rounded-xl">
          <Text className="text-on-surface">{msg}</Text>
        </View>
      ) : null}

      <AdminCard title="Route details" icon="route" containerClass="mx-4 mb-4">
        <TextInput className="border border-outline-variant rounded-lg px-3 py-2 mb-2 bg-surface text-on-surface" placeholderTextColor="#737373" value={name} onChangeText={setName} placeholder="Name *" />
        <TextInput className="border border-outline-variant rounded-lg px-3 py-2 mb-2 bg-surface text-on-surface" placeholderTextColor="#737373" value={area} onChangeText={setArea} placeholder="Area (optional)" />
        <TextInput className="border border-outline-variant rounded-lg px-3 py-2 mb-2 bg-surface text-on-surface" placeholderTextColor="#737373" value={description} onChangeText={setDescription} placeholder="Description" />
        <TextInput className="border border-outline-variant rounded-lg px-3 py-2 mb-3 bg-surface text-on-surface" placeholderTextColor="#737373" value={sortOrder} onChangeText={setSortOrder} placeholder="Sort order" keyboardType="number-pad" />
        <Pressable accessibilityRole="button" className="bg-primary rounded-lg py-2 items-center mb-2" onPress={saveMetadata} disabled={saving}>
          <Text className="text-on-primary font-semibold">Save details</Text>
        </Pressable>
        <Pressable accessibilityRole="button" className="border border-error rounded-lg py-2 items-center" onPress={confirmDeactivate}>
          <Text className="text-error font-semibold">Deactivate route</Text>
        </Pressable>
      </AdminCard>

      <View className="px-4 mb-2">
        <Text className="font-bold text-on-surface mb-2">Assigned retailers ({memberIds.size})</Text>
        <TextInput
          className="border border-outline-variant rounded-lg px-3 py-2 mb-2 bg-surface text-on-surface"
          placeholder="Search..."
          placeholderTextColor="#737373"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {Array.from(memberIds).map((id) => {
        const r = detail?.retailers.find((x) => x.id === id);
        if (!r) return null;
        if (search && !(r.shop_name || r.name).toLowerCase().includes(search.toLowerCase())) return null;
        return (
          <View key={id} className="mx-4 mb-2 p-3 rounded-xl border border-outline-variant/30 flex-row justify-between items-center">
            <Text className="text-on-surface font-medium">{r.shop_name || r.name}</Text>
            <Pressable onPress={() => removeMember(id)}>
              <MaterialIcons name="remove-circle-outline" size={22} className="text-error" />
            </Pressable>
          </View>
        );
      })}

      <View className="px-4 mt-4 mb-2 flex-row justify-between items-center">
        <Text className="font-bold text-on-surface">Add from unassigned</Text>
        {selectedIds.size > 0 ? (
          <Pressable onPress={saveMembers} className="bg-primary px-3 py-1 rounded-full">
            <Text className="text-on-primary font-semibold">Add {selectedIds.size}</Text>
          </Pressable>
        ) : null}
      </View>

      {filteredPool
        .filter((r) => !memberIds.has(r.id))
        .map((item) => (
          <Pressable
            key={item.id}
            onPress={() => toggleSelect(item.id)}
            className={`mx-4 mb-2 p-3 rounded-xl border flex-row justify-between ${
              selectedIds.has(item.id) ? "border-primary bg-primary/5" : "border-outline-variant/30"
            }`}
          >
            <View>
              <Text className="font-semibold text-on-surface">{item.shop_name || item.name}</Text>
              {item.area ? <Text className="text-sm text-on-surface-variant">{item.area}</Text> : null}
            </View>
            {selectedIds.has(item.id) ? <MaterialIcons name="check-circle" size={20} className="text-primary" /> : null}
          </Pressable>
        ))}
      {routeId ? (
        <AdminActionFooter
          primaryLabel="Save retailers"
          onPrimaryPress={saveMemberList}
          isPrimaryLoading={saving}
        />
      ) : null}
    </AdminScreenContainer>
  );
}
