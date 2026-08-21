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
import { createVehicle, deleteVehicle, listVehicles } from "../../api/vehicles";
import type { Vehicle } from "../../types/api";

export function AdminVehiclesScreen({ navigation }: { navigation: any }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [number, setNumber] = useState("");
  const [capacity, setCapacity] = useState("");
  const [driverName, setDriverName] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setVehicles(await listVehicles());
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to load vehicles");
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
    if (!number.trim()) return;
    try {
      await createVehicle({
        number: number.trim(),
        capacity_kg: capacity || null,
        driver_name: driverName.trim() || null,
      });
      setNumber("");
      setCapacity("");
      setDriverName("");
      setMsg("Vehicle added");
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to add vehicle");
    }
  }

  async function onDeactivate(vehicle: Vehicle) {
    try {
      await deleteVehicle(vehicle.id);
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to remove vehicle");
    }
  }

  return (
    <SafeAreaView className="flex-1 max-w-3xl mx-auto w-full bg-background" edges={["top", "bottom"]}>
      <View className="h-16 px-4 flex-row items-center bg-surface/90 border-b border-outline-variant/20">
        <Pressable accessibilityRole="button" accessibilityLabel="Button" className="w-11 h-11 -ml-2 items-center justify-center rounded-full" onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} className="text-on-surface" />
        </Pressable>
        <Text className="font-headline-sm text-on-surface font-semibold ml-2">Vehicles</Text>
      </View>

      <FlatList
        data={vehicles}
        keyExtractor={(v) => v.id}
        className="flex-1 px-4 py-4"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {msg ? <Text className="text-error mb-3 font-semibold">{msg}</Text> : null}

            <View className="bg-surface-container-lowest rounded-2xl p-4 mb-4 border border-outline-variant/20 flex-col gap-3">
              <Text className="font-label-md text-on-surface-variant uppercase font-semibold">Add Vehicle</Text>
              <TextInput placeholderTextColor="#737373" className="bg-surface h-12 border border-outline-variant rounded-lg px-3 text-on-surface" placeholder="Vehicle number" value={number} onChangeText={setNumber} />
              <TextInput placeholderTextColor="#737373" className="bg-surface h-12 border border-outline-variant rounded-lg px-3 text-on-surface" placeholder="Capacity (kg)" value={capacity} onChangeText={setCapacity} keyboardType="decimal-pad" />
              <TextInput placeholderTextColor="#737373" className="bg-surface h-12 border border-outline-variant rounded-lg px-3 text-on-surface" placeholder="Driver name" value={driverName} onChangeText={setDriverName} />
              <Pressable accessibilityRole="button" accessibilityLabel="Button" className="bg-primary h-11 rounded-lg items-center justify-center" onPress={onAdd}>
                <Text className="text-on-primary font-semibold">Add Vehicle</Text>
              </Pressable>
            </View>

            {loading ? (
              <ActivityIndicator className="text-primary" />
            ) : vehicles.length === 0 ? (
              <Text className="text-on-surface-variant text-center py-8">No vehicles yet.</Text>
            ) : null}
          </>
        }
        renderItem={({ item: v }) => (
          <View className="bg-surface-container-lowest rounded-xl p-4 mb-2 border border-outline-variant/20 flex-row justify-between items-center">
            <View>
              <Text className="font-headline-sm text-on-surface font-semibold">{v.number}</Text>
              <Text className="font-body-md text-on-surface-variant">
                {v.driver_name || "No driver"} · {v.capacity_kg ? `${v.capacity_kg} kg` : "—"}
              </Text>
              <Text className={`font-label-md mt-1 ${v.is_active ? "text-primary" : "text-error"}`}>
                {v.is_active ? "Active" : "Inactive"}
              </Text>
            </View>
            {v.is_active ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Button" onPress={() => onDeactivate(v)} className="p-2">
                <MaterialIcons name="delete-outline" size={22} className="text-error" />
              </Pressable>
            ) : null}
          </View>
        )}
      />
    </SafeAreaView>
  );
}
