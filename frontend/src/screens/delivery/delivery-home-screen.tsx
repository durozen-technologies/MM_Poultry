import { useState } from "react";
import { View, Text, FlatList, Pressable, TextInput, RefreshControl, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../../store/auth-store";
import { formatIstDate } from "../../utils/ist-date";
import { apiItems } from "../../api/items";
import { useDeliveryRun } from "../../hooks/use-delivery-run";
import { PrinterSetupModal } from "../../components/printer-setup-modal";
import { usePrinterStore } from "../../store/printer-store";

export function DeliveryHomeScreen() {
  const logout = useAuthStore((s) => s.logout);
  const {
    run,
    activeStop,
    setActiveStop,
    weights,
    setWeights,
    deliveredBoxes,
    setDeliveredBoxes,
    emptyBoxWeights,
    setEmptyBoxWeights,
    cash,
    setCash,
    upi,
    setUpi,
    msg,
    lastBill,
    billing,
    onStartRun,
    onCompleteRun,
    simulateScale,
    weighAndBill,
    onSkipStop,
    shareBill,
    refresh,
  } = useDeliveryRun();
  const [refreshing, setRefreshing] = useState(false);
  const [printerModalVisible, setPrinterModalVisible] = useState(false);
  const connectedPrinter = usePrinterStore((s) => s.connectedPrinter);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const { data: itemsPage } = useQuery({
    queryKey: ["delivery_items"],
    queryFn: () => apiItems.list(true),
  });
  const allItems = itemsPage?.items || [];
  const getItemName = (id: string) => allItems.find((i: { id: string; name: string }) => i.id === id)?.name || "Unknown Item";

  return (
    <SafeAreaView className="flex-1 max-w-3xl mx-auto w-full bg-background" edges={["top", "bottom"]}>
      <View className="px-4 py-3 flex-row justify-between items-center bg-primary">
        <Text className="text-on-primary text-headline-sm font-semibold">Delivery</Text>
        <View className="flex-row items-center gap-3">
          <Pressable accessibilityRole="button" onPress={() => setPrinterModalVisible(true)} className="p-1">
            <MaterialIcons name="print" size={24} color={connectedPrinter ? "#4ade80" : "#ffffff"} />
          </Pressable>
          <Pressable accessibilityRole="button" onPress={handleRefresh} className="p-1">
            <MaterialIcons name="refresh" size={24} className="text-on-primary" />
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => logout()} className="px-3 py-1 rounded-full bg-primary-container/30">
            <Text className="text-on-primary font-semibold">Logout</Text>
          </Pressable>
        </View>
      </View>

      <View className="p-4 flex-1">
        {msg ? <Text className="text-error mb-2 font-semibold">{msg}</Text> : null}
        {!run ? (
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: "center", alignItems: "center" }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          >
            <View className="bg-surface-container-lowest rounded-2xl p-6 items-center border border-outline-variant/20 w-full">
              <MaterialIcons name="local-shipping" size={40} className="text-on-surface-variant" />
              <Text className="text-on-surface-variant mt-3 text-center">No active delivery run. Ask admin to build one.</Text>
            </View>
          </ScrollView>
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
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
              ListEmptyComponent={<Text className="text-on-surface-variant text-center py-4">No stops in this run</Text>}
              renderItem={({ item }) => {
                const totalReq = item.items?.reduce((sum, it) => sum + Number(it.ordered_kg || 0), 0) || 0;
                return (
                  <Pressable accessibilityRole="button"
                    className={`bg-surface-container-lowest rounded-xl p-4 shadow-sm elevation-sm mb-3 border relative overflow-hidden ${
                      activeStop?.id === item.id ? "border-primary" : "border-outline-variant/20"
                    }`}
                    onPress={() => { setActiveStop(item); setWeights({}); }}
                  >
                    {/* Left indicator bar */}
                    <View className={`absolute top-0 left-0 w-1 h-full ${activeStop?.id === item.id ? 'bg-primary' : 'bg-transparent'}`} />

                    <View className="flex-row items-center justify-between mb-2">
                      <View className="flex-row items-center gap-2">
                        <View className={`w-8 h-8 rounded-full items-center justify-center ${activeStop?.id === item.id ? 'bg-primary' : 'bg-surface-variant'}`}>
                          <Text className={`font-bold ${activeStop?.id === item.id ? 'text-on-primary' : 'text-on-surface-variant'}`}>{item.sequence}</Text>
                        </View>
                        <Text className="font-headline-sm text-on-surface font-bold">
                          {item.retailer_name}
                        </Text>
                      </View>
                      <View className={`px-3 py-1 rounded-full ${item.status === 'PENDING' ? 'bg-error-container' : 'bg-primary-container'}`}>
                        <Text className={`font-label-md font-semibold ${item.status === 'PENDING' ? 'text-error' : 'text-on-primary-container'}`}>
                          {item.status}
                        </Text>
                      </View>
                    </View>
                    
                    <View className="flex-row items-center gap-2 mt-1 pl-10">
                      <MaterialIcons name="inventory-2" size={16} className="text-on-surface-variant" />
                      <Text className="font-body-md text-on-surface-variant">
                        Ordered <Text className="font-bold text-on-surface">{totalReq} kg</Text>
                      </Text>
                    </View>
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
              keyExtractor={(i) => `${activeStop.id}-${i.item_id}`}
              className="mb-2"
              ListEmptyComponent={<Text className="text-on-surface-variant text-center py-2">No items for this stop</Text>}
              renderItem={({ item }) => {
                const gross = Number(weights[item.item_id] || 0);
                const boxes = Number(deliveredBoxes[item.item_id] || 0);
                const emptyWt = Number(emptyBoxWeights[item.item_id] || 0);
                const net = gross - (boxes * emptyWt);

                return (
                  <View className="mb-3 p-3 bg-surface border border-outline-variant/30 rounded-xl">
                    <Text className="font-semibold text-on-surface mb-2">{getItemName(item.item_id)}</Text>
                    <Text className="text-sm text-on-surface-variant mb-2">Req: {item.ordered_kg} kg @ ₹{item.rate_per_kg}/kg</Text>
                    
                    <View className="flex-row items-center gap-2 mb-2">
                      <Pressable accessibilityRole="button" className="bg-primary/10 rounded-lg p-2 items-center justify-center flex-[0.5]" onPress={() => simulateScale(item.item_id)}>
                        <MaterialIcons name="bluetooth" size={20} className="text-primary" />
                      </Pressable>
                      <TextInput
                        className="border border-outline-variant rounded-lg px-3 py-2 bg-surface text-on-surface flex-1"
                        value={weights[item.item_id] || ""}
                        onChangeText={(v) => setWeights(prev => ({ ...prev, [item.item_id]: v }))}
                        placeholder="Gross Wt (kg)"
                        keyboardType="decimal-pad"
                      />
                    </View>

                    <View className="flex-row items-center gap-2 mb-2">
                      <TextInput
                        className="border border-outline-variant rounded-lg px-3 py-2 bg-surface text-on-surface flex-1"
                        value={deliveredBoxes[item.item_id] || ""}
                        onChangeText={(v) => setDeliveredBoxes(prev => ({ ...prev, [item.item_id]: v }))}
                        placeholder="Delivered Boxes"
                        keyboardType="number-pad"
                      />
                      <TextInput
                        className="border border-outline-variant rounded-lg px-3 py-2 bg-surface text-on-surface flex-1"
                        value={emptyBoxWeights[item.item_id] || ""}
                        onChangeText={(v) => setEmptyBoxWeights(prev => ({ ...prev, [item.item_id]: v }))}
                        placeholder="Empty Box Wt (kg)"
                        keyboardType="decimal-pad"
                      />
                    </View>

                    {gross > 0 && (
                      <View className="bg-primary-container/30 px-3 py-2 rounded-lg flex-row justify-between items-center mt-1">
                        <Text className="text-sm font-semibold text-on-surface">Calculated Net Weight:</Text>
                        <Text className={`text-sm font-bold ${net > 0 ? "text-primary" : "text-error"}`}>{net > 0 ? net.toFixed(2) : "Invalid"} kg</Text>
                      </View>
                    )}
                  </View>
                );
              }}
            />

            <View className="flex-row gap-2 mb-2 pt-2 border-t border-outline-variant/20">
              <TextInput className="flex-1 border border-outline-variant rounded-lg px-3 py-2 bg-surface" value={cash} onChangeText={setCash} placeholder="Cash" keyboardType="decimal-pad" />
              <TextInput className="flex-1 border border-outline-variant rounded-lg px-3 py-2 bg-surface" value={upi} onChangeText={setUpi} placeholder="UPI" keyboardType="decimal-pad" />
            </View>
            <Pressable accessibilityRole="button" className={`rounded-lg py-3 items-center mb-2 ${billing ? "bg-primary/50" : "bg-primary"}`} onPress={weighAndBill} disabled={billing}>
              <Text className="text-on-primary font-semibold">{billing ? "Billing..." : "Weigh → Commit → Print"}</Text>
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

      <PrinterSetupModal
        visible={printerModalVisible}
        onClose={() => setPrinterModalVisible(false)}
      />
    </SafeAreaView>
  );
}
