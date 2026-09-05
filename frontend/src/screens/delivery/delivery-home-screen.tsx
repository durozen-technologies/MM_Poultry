import React, { useState, useCallback } from "react";
import { View, Text, FlatList, Pressable, TextInput, RefreshControl, ScrollView, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../../store/auth-store";
import { formatIstDate } from "../../utils/ist-date";
import { apiItems } from "../../api/items";
import { useDeliveryRun } from "../../hooks/use-delivery-run";
import { PrinterSetupModal } from "../../components/printer-setup-modal";
import { PrimaryButton } from "../../components/ui/primary-button";
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
    onReconcile,
    reconcileVisible,
    setReconcileVisible,
    returnedKg,
    setReturnedKg,
    wastageKg,
    setWastageKg,
    onFailStop,
    failReason,
    setFailReason,
    showFail,
    setShowFail,
    simulateScale,
    weighAndBill,
    onSkipStop,
    shareBill,
    refresh,
  } = useDeliveryRun();
  const [refreshing, setRefreshing] = useState(false);
  const [printerModalVisible, setPrinterModalVisible] = useState(false);
  const [skipPrint, setSkipPrint] = useState(false);
  const [skipScale, setSkipScale] = useState(false);
  const connectedPrinter = usePrinterStore((s) => s.connectedPrinter);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const { data: itemsPage } = useQuery({
    queryKey: ["delivery_items"],
    queryFn: () => apiItems.list(true),
  });
  const allItems = itemsPage?.items || [];
  const getItemName = useCallback((id: string) => allItems.find((i: { id: string; name: string }) => i.id === id)?.name || "Unknown Item", [allItems]);

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
                <Pressable accessibilityRole="button" className="bg-tertiary px-4 py-2 rounded-lg flex-1 items-center" onPress={() => setReconcileVisible(true)}>
                  <Text className="text-on-tertiary font-semibold">Reconcile</Text>
                </Pressable>
                <Pressable accessibilityRole="button" className="bg-error px-4 py-2 rounded-lg flex-1 items-center" onPress={onCompleteRun}>
                  <Text className="text-on-error font-semibold">Complete</Text>
                </Pressable>
              </View>
              {run.reconciled_at ? (
                <Text className="text-xs text-primary mt-2">Reconciled</Text>
              ) : null}
            </View>
            <FlatList
              data={run.stops}
              keyExtractor={(s) => s.id}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
              ListEmptyComponent={<Text className="text-on-surface-variant text-center py-4">No stops in this run</Text>}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
              removeClippedSubviews={true}
              renderItem={({ item }) => (
                <StopListItem 
                  item={item} 
                  isActive={activeStop?.id === item.id} 
                  onPress={() => { setActiveStop(item); setWeights({}); }} 
                />
              )}
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
                      <View className="mb-3 bg-surface-variant/30 p-2 rounded-lg">
                        <Text className="text-sm font-semibold text-on-surface">Admin Assigned: <Text className="font-bold">{item.ordered_kg} kg</Text></Text>
                        <Text className="text-sm text-on-surface-variant">
                          Retailer Requested: {item.original_requested_kg ? `${item.original_requested_kg} kg` : "N/A"} 
                          {item.original_total_boxes ? ` / ${item.original_total_boxes} boxes` : ""}
                        </Text>
                        {item.remaining_kg != null && item.remaining_kg !== item.ordered_kg ? (
                          <Text className="text-sm text-on-surface-variant mt-1">Remaining to deliver: {item.remaining_kg} kg</Text>
                        ) : null}
                      </View>
                    
                    <View className="mb-3">
                      <Text className="text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Gross Wt (kg) / Scale Value</Text>
                      <View className="flex-row items-center gap-2">
                        {!skipScale && (
                          <Pressable accessibilityRole="button" className="bg-primary/10 rounded-lg p-2 items-center justify-center flex-[0.2]" onPress={() => simulateScale(item.item_id)}>
                            <MaterialIcons name="bluetooth" size={20} className="text-primary" />
                          </Pressable>
                        )}
                        <TextInput
                          className="border border-outline-variant rounded-lg px-3 py-2 bg-surface text-on-surface flex-1"
                          value={weights[item.item_id] || ""}
                          onChangeText={(v) => setWeights(prev => ({ ...prev, [item.item_id]: v }))}
                          placeholder="e.g. 55.5"
                          placeholderTextColor="#9ca3af"
                          keyboardType="decimal-pad"
                        />
                      </View>
                    </View>

                    <View className="flex-row items-center gap-2 mb-2">
                      <View className="flex-1">
                        <Text className="text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Total Boxes</Text>
                        <TextInput
                          className="border border-outline-variant rounded-lg px-3 py-2 bg-surface text-on-surface"
                          value={deliveredBoxes[item.item_id] || ""}
                          onChangeText={(v) => setDeliveredBoxes(prev => ({ ...prev, [item.item_id]: v }))}
                          placeholder="e.g. 5"
                          placeholderTextColor="#9ca3af"
                          keyboardType="number-pad"
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Box Wt (kg)</Text>
                        <TextInput
                          className="border border-outline-variant rounded-lg px-3 py-2 bg-surface text-on-surface"
                          value={emptyBoxWeights[item.item_id] || ""}
                          onChangeText={(v) => setEmptyBoxWeights(prev => ({ ...prev, [item.item_id]: v }))}
                          placeholder="e.g. 1.2"
                          placeholderTextColor="#9ca3af"
                          keyboardType="decimal-pad"
                        />
                      </View>
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
              <View className="flex-1">
                <Text className="text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Cash (₹)</Text>
                <TextInput className="border border-outline-variant rounded-lg px-3 py-2 bg-surface text-on-surface" value={cash} onChangeText={setCash} placeholder="0" placeholderTextColor="#9ca3af" keyboardType="decimal-pad" />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">UPI (₹)</Text>
                <TextInput className="border border-outline-variant rounded-lg px-3 py-2 bg-surface text-on-surface" value={upi} onChangeText={setUpi} placeholder="0" placeholderTextColor="#9ca3af" keyboardType="decimal-pad" />
              </View>
            </View>

            <View className="flex-row justify-between items-center mb-4 mt-2 px-1">
              <View className="flex-row items-center gap-2">
                <Switch value={!skipScale} onValueChange={(v) => setSkipScale(!v)} />
                <Text className="text-on-surface text-sm">Bluetooth Scale</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Switch value={!skipPrint} onValueChange={(v) => setSkipPrint(!v)} />
                <Text className="text-on-surface text-sm">Print Receipt</Text>
              </View>
            </View>

            <PrimaryButton
              className="mb-3"
              variant={billing ? "secondary" : "primary"}
              onPress={() => weighAndBill({ skipPrint, skipScale })}
              disabled={billing}
              loading={billing}
              title={billing ? "Billing..." : (!skipScale && !skipPrint ? "Weigh → Commit → Print" : (!skipScale ? "Weigh → Commit" : (!skipPrint ? "Commit → Print" : "Commit")))}
            />
            
            <PrimaryButton
              className="mb-3"
              variant="error"
              onPress={() => setShowFail(true)}
              title="Fail Delivery"
            />
            
            <PrimaryButton
              variant="secondary"
              onPress={onSkipStop}
              title="Skip Stop"
            />
          </View>
        ) : null}

        {reconcileVisible ? (
          <View className="bg-surface-container-lowest rounded-xl p-4 border border-primary/30 mt-2">
            <Text className="font-bold text-on-surface mb-2">Trip reconciliation</Text>
            <View className="mb-2">
              <Text className="text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Returned (kg)</Text>
              <TextInput className="border border-outline-variant rounded-lg px-3 py-2 bg-surface text-on-surface" value={returnedKg} onChangeText={setReturnedKg} placeholder="0" placeholderTextColor="#9ca3af" keyboardType="decimal-pad" />
            </View>
            <View className="mb-2">
              <Text className="text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Wastage (kg)</Text>
              <TextInput className="border border-outline-variant rounded-lg px-3 py-2 bg-surface text-on-surface" value={wastageKg} onChangeText={setWastageKg} placeholder="0" placeholderTextColor="#9ca3af" keyboardType="decimal-pad" />
            </View>
            <PrimaryButton className="mt-2" onPress={onReconcile} title="Save reconciliation" />
          </View>
        ) : null}

        {showFail && activeStop ? (
          <View className="bg-surface-container-lowest rounded-xl p-4 border border-error/30 mt-2">
            <Text className="font-bold text-on-surface mb-2">Failure reason (required)</Text>
            <View className="mb-2">
              <TextInput className="border border-outline-variant rounded-lg px-3 py-2 bg-surface text-on-surface" value={failReason} onChangeText={setFailReason} placeholder="e.g. Shop closed" placeholderTextColor="#9ca3af" />
            </View>
            <PrimaryButton className="mt-2" variant="error" onPress={onFailStop} title="Confirm Failed Delivery" />
          </View>
        ) : null}

        {lastBill ? (
          <PrimaryButton className="mt-4" variant="secondary" onPress={shareBill} title="Share Bill on WhatsApp" />
        ) : null}
      </View>

      <PrinterSetupModal
        visible={printerModalVisible}
        onClose={() => setPrinterModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const StopListItem = React.memo(({ item, isActive, onPress }: { item: any, isActive: boolean, onPress: () => void }) => {
  const totalReq = item.items?.reduce((sum: number, it: any) => sum + Number(it.ordered_kg || 0), 0) || 0;
  return (
    <Pressable accessibilityRole="button"
      className={`bg-surface-container-lowest rounded-xl p-4 shadow-sm elevation-sm mb-3 border relative overflow-hidden ${
        isActive ? "border-primary" : "border-outline-variant/20"
      }`}
      onPress={onPress}
    >
      <View className={`absolute top-0 left-0 w-1 h-full ${isActive ? 'bg-primary' : 'bg-transparent'}`} />

      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center gap-2 flex-1 mr-2">
          <View className={`w-8 h-8 rounded-full items-center justify-center ${isActive ? 'bg-primary' : 'bg-surface-variant'}`}>
            <Text className={`font-bold ${isActive ? 'text-on-primary' : 'text-on-surface-variant'}`}>{item.sequence}</Text>
          </View>
          <View className="flex-1">
            <Text className="font-headline-sm text-on-surface font-bold" numberOfLines={1}>
              {item.shop_name || item.retailer_name}
            </Text>
            {item.shop_name ? (
              <Text className="font-body-sm text-on-surface-variant" numberOfLines={1}>
                {item.retailer_name}
              </Text>
            ) : null}
          </View>
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
});
