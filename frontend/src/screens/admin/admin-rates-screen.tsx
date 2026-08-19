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
import { listRates, upsertRate } from "../../api/rates";
import type { Rate } from "../../types/api";

export function AdminRatesScreen({ navigation }: { navigation: any }) {
  const [rates, setRates] = useState<Rate[]>([]);
  const [defaultRate, setDefaultRate] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listRates();
      setRates(data);
      const global = data.find((r) => !r.retailer_id);
      if (global) setDefaultRate(global.rate_per_kg);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to load rates");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  async function saveDefaultRate() {
    if (!defaultRate) return;
    try {
      await upsertRate({ retailer_id: null, rate_per_kg: defaultRate });
      setMsg("Default rate saved");
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to save");
    }
  }

  return (
    <SafeAreaView className="flex-1 max-w-3xl mx-auto w-full bg-background" edges={["top", "bottom"]}>
      <View className="h-16 px-4 flex-row items-center bg-surface/90 border-b border-outline-variant/20">
        <Pressable accessibilityRole="button" accessibilityLabel="Button" className="w-11 h-11 -ml-2 items-center justify-center rounded-full" onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} className="text-on-surface" />
        </Pressable>
        <Text className="font-headline-sm text-on-surface font-semibold ml-2">Rates</Text>
      </View>

      <FlatList
        data={rates}
        keyExtractor={(r) => r.id}
        className="flex-1 px-4 py-4"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {msg ? <Text className="text-error mb-3 font-semibold">{msg}</Text> : null}

            <View className="bg-surface-container-lowest rounded-2xl p-4 mb-4 border border-outline-variant/20">
              <Text className="font-label-md text-on-surface-variant uppercase font-semibold mb-3">Default Rate (₹/kg)</Text>
              <TextInput
                className="bg-surface h-12 border border-outline-variant rounded-lg px-3 text-body-md mb-3"
                value={defaultRate}
                onChangeText={setDefaultRate}
                placeholder="0.00"
                keyboardType="decimal-pad"
              />
              <Pressable accessibilityRole="button" accessibilityLabel="Button" className="bg-primary h-11 rounded-lg items-center justify-center" onPress={saveDefaultRate}>
                <Text className="text-on-primary font-semibold">Save Default Rate</Text>
              </Pressable>
            </View>

            <Text className="font-headline-sm text-on-surface font-semibold mb-3">All Rates</Text>
            {loading ? (
              <ActivityIndicator className="text-primary" />
            ) : rates.length === 0 ? (
              <Text className="text-on-surface-variant text-center py-8">No rates configured yet.</Text>
            ) : null}
          </>
        }
        renderItem={({ item: rate }) => (
          <View className="bg-surface-container-lowest rounded-xl p-4 mb-2 border border-outline-variant/20">
            <Text className="font-body-md text-on-surface font-semibold">
              {rate.retailer_id ? `Retailer ${rate.retailer_id.slice(0, 8)}` : "Default (all retailers)"}
            </Text>
            <Text className="font-headline-sm text-primary mt-1">₹{rate.rate_per_kg}/kg</Text>
            <Text className="font-label-md text-on-surface-variant mt-1">From {rate.effective_from}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
