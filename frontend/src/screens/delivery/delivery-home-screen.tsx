import { View, Text, FlatList, Pressable, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../../store/auth-store";
import { formatIstDate } from "../../utils/ist-date";
import { apiItems } from "../../api/items";
import { useDeliveryRun } from "../../hooks/use-delivery-run";

export function DeliveryHomeScreen() {
  const logout = useAuthStore((s) => s.logout);
  const {
    run,
    activeStop,
    setActiveStop,
    weights,
    setWeights,
    cash,
    setCash,
    upi,
    setUpi,
    msg,
    lastBill,
    onStartRun,
    onCompleteRun,
    simulateScale,
    weighAndBill,
    onSkipStop,
    shareBill,
  } = useDeliveryRun();

  const { data: itemsPage } = useQuery({
    queryKey: ["retailer_items"],
    queryFn: () => apiItems.list(),
  });
  const allItems = itemsPage?.items || [];
  const getItemName = (id: string) => allItems.find((i: any) => i.id === id)?.name || "Unknown Item";

  return (
    <SafeAreaView className="flex-1 max-w-3xl mx-auto w-full bg-background" edges={["top", "bottom"]}>
      <View className="px-4 py-3 flex-row justify-between items-center bg-primary">
        <Text className="text-on-primary text-headline-sm font-semibold">Delivery</Text>
        <Pressable accessibilityRole="button" onPress={() => logout()} className="px-3 py-1 rounded-full bg-primary-container/30">
          <Text className="text-on-primary font-semibold">Logout</Text>
        </Pressable>
      </View>

      <View className="p-4 flex-1">
        {msg ? <Text className="text-error mb-2 font-semibold">{msg}</Text> : null}
        {!run ? (
          <View className="bg-surface-container-lowest rounded-2xl p-6 items-center border border-outline-variant/20">
            <MaterialIcons name="local-shipping" size={40} className="text-on-surface-variant" />
            <Text className="text-on-surface-variant mt-3 text-center">No active delivery run. Ask admin to build one.</Text>
          </View>
        ) : (
          <>
            <View className="bg-surface-container-lowest rounded-2xl p-4 mb-3 border border-outline-variant/20">
              <Text className="font-headline-sm text-on-surface font-semibold">
                Run {run.status} · {formatIstDate(run.run_date)}
              </Text>
              <View className="flex-row gap-2 mt-3">
                <Pressable accessibilityRole="button" className="bg-primary px-4 py-2 rounded-lg flex-1 items-center" onPress={onStartRun}>
                  <Text className="text-on-primary font-semibold">Start</Text>
                </Pressable>
                <Pressable accessibilityRole="button" className="bg-error px-4 py-2 rounded-lg flex-1 items-center" onPress={onCompleteRun}>
                  <Text className="text-on-error font-semibold">Complete</Text>
                </Pressable>
              </View>
            </View>
            <FlatList
              data={run.stops}
              keyExtractor={(s) => s.id}
              renderItem={({ item }) => {
                const totalReq = item.items?.reduce((sum, it) => sum + Number(it.ordered_kg || 0), 0) || 0;
                return (
                  <Pressable accessibilityRole="button"
                    className={`rounded-xl p-3 mb-2 border ${
                      activeStop?.id === item.id ? "bg-primary-container/20 border-primary" : "bg-surface-container-lowest border-outline-variant/20"
                    }`}
                    onPress={() => { setActiveStop(item); setWeights({}); }}
                  >
                    <Text className="font-semibold text-on-surface">
                      #{item.sequence} {item.retailer_name}
                    </Text>
                    <Text className="text-on-surface-variant">
                      Ordered {totalReq} kg · {item.status}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </>
        )}

        {activeStop ? (
          <View className="bg-surface-container-lowest rounded-xl p-4 border border-primary/40 mt-2 max-h-[60%]">
            <Text className="font-bold mb-2 text-on-surface">Stop · {activeStop.retailer_name}</Text>
            
            <FlatList
              data={activeStop.items || []}
              keyExtractor={(i) => i.item_id}
              className="mb-2"
              renderItem={({ item }) => (
                <View className="mb-3 p-3 bg-surface border border-outline-variant/30 rounded-xl">
                  <Text className="font-semibold text-on-surface mb-2">{getItemName(item.item_id)}</Text>
                  <Text className="text-sm text-on-surface-variant mb-2">Req: {item.ordered_kg} kg @ ₹{item.rate_per_kg}/kg</Text>
                  <View className="flex-row items-center gap-2">
                    <Pressable accessibilityRole="button" className="bg-primary/10 rounded-lg p-2 items-center justify-center flex-1" onPress={() => simulateScale(item.item_id)}>
                      <MaterialIcons name="bluetooth" size={20} className="text-primary" />
                    </Pressable>
                    <TextInput
                      className="border border-outline-variant rounded-lg px-3 py-2 bg-surface text-on-surface flex-[3]"
                      value={weights[item.item_id] || ""}
                      onChangeText={(v) => setWeights(prev => ({ ...prev, [item.item_id]: v }))}
                      placeholder="Delivered kg"
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
              )}
            />

            <View className="flex-row gap-2 mb-2 pt-2 border-t border-outline-variant/20">
              <TextInput className="flex-1 border border-outline-variant rounded-lg px-3 py-2 bg-surface" value={cash} onChangeText={setCash} placeholder="Cash" keyboardType="decimal-pad" />
              <TextInput className="flex-1 border border-outline-variant rounded-lg px-3 py-2 bg-surface" value={upi} onChangeText={setUpi} placeholder="UPI" keyboardType="decimal-pad" />
            </View>
            <Pressable accessibilityRole="button" className="bg-primary rounded-lg py-3 items-center mb-2" onPress={weighAndBill}>
              <Text className="text-on-primary font-semibold">Weigh → Commit → Print</Text>
            </Pressable>
            <Pressable accessibilityRole="button" className="border border-error rounded-lg py-3 items-center" onPress={onSkipStop}>
              <Text className="text-error font-semibold">Skip Stop</Text>
            </Pressable>
          </View>
        ) : null}

        {lastBill ? (
          <Pressable accessibilityRole="button" className="mt-3 border border-primary rounded-lg py-3 items-center bg-surface-container-lowest" onPress={shareBill}>
            <Text className="text-primary font-semibold">Share bill on WhatsApp</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
