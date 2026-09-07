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
import { useNavigation } from "@react-navigation/native";
import { shareWhatsAppBill } from "../../services/printer";
import { markWhatsAppShared } from "../../api/delivery";
import { getApiErrorMessage } from "../../api/client";

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
    billing,
    startingRun,
    onStartRun,
    onCompleteRun,
    onFailStop,
    failReason,
    setFailReason,
    showFail,
    setShowFail,
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
  const navigation = useNavigation<any>();

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
  const getItemName = useCallback((id: string) => allItems.find((i: any) => i.id === id)?.name || id.slice(0, 8), [allItems]);

  const handleShareBill = async () => {
    if (!lastBill || !run) return;
    try {
      const stop = run.stops?.find((s: any) => s.id === lastBill.delivery_stop_id);
      const totalWeight = lastBill.items?.reduce((sum: number, it: any) => sum + Number(it.weight_kg), 0) || 0;
      
      const payload = {
        shopName: stop?.shop_name || stop?.retailer_name || "MM Broilers",
        billNumber: lastBill.bill_number || "Draft",
        retailerName: stop?.retailer_name || "Retailer",
        weightKg: String(totalWeight),
        rate: lastBill.items?.[0]?.rate_per_kg || "0",
        total: String(lastBill.total_amount),
        cash: String(lastBill.cash_payment || 0),
        upi: String(lastBill.upi_payment || 0),
        balance: String(lastBill.balance_amount || 0),
        items: (lastBill.items || []).map((it: any) => ({
          name: getItemName(it.item_id),
          weightKg: String(it.weight_kg),
          rate: String(it.rate_per_kg),
          amount: String(it.amount),
        }))
      };

      await shareWhatsAppBill(payload);
      await markWhatsAppShared(lastBill.id);
      alert("WhatsApp share marked");
    } catch (e) {
      alert(getApiErrorMessage(e));
    }
  };

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
                  isActive={false} 
                  getItemName={getItemName}
                  onPress={() => {
                    if (item.status === "PENDING" || item.status === "PRINT_PENDING") {
                      navigation.navigate("DeliveryWeighing", { stop: item });
                    }
                  }}
                />
              )}
            />
          </>
        )}

        {lastBill ? (
          <PrimaryButton className="mt-4" variant="secondary" onPress={handleShareBill} title="Share Bill on WhatsApp" />
        ) : null}
      </View>

      <PrinterSetupModal
        visible={printerModalVisible}
        onClose={() => setPrinterModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const StopListItem = React.memo(({ item, isActive, getItemName, onPress }: { item: any, isActive: boolean, getItemName: (id: string) => string, onPress: () => void }) => {
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
          Total: <Text className="font-bold text-on-surface">{totalReq} kg</Text>
        </Text>
      </View>

      {item.items && item.items.length > 0 && (
        <View className="mt-3 pl-10 border-t border-outline-variant/10 pt-2">
          {item.items.map((it: any) => (
            <View key={it.item_id} className="flex-row justify-between items-center py-1">
              <Text className="font-body-sm text-on-surface font-semibold flex-1" numberOfLines={1}>
                {getItemName(it.item_id)}
              </Text>
              <View className="flex-row gap-3">
                <Text className="font-body-sm text-on-surface-variant">
                  {it.original_total_boxes || 0} boxes
                </Text>
                <Text className="font-body-sm text-on-surface font-semibold">
                  {it.ordered_kg || 0} kg
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
});
