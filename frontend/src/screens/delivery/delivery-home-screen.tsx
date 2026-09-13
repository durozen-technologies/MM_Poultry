import React, { useState, useCallback } from "react";
import { View, Text, FlatList, Pressable, RefreshControl, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import { shareWhatsAppBill, deliveryBillToPrintPayload } from "../../services/printer";
import { markWhatsAppShared } from "../../api/delivery";
import { getApiErrorMessage } from "../../api/client";

export function DeliveryHomeScreen() {
  const logout = useAuthStore((s) => s.logout);
  const organizationName = useAuthStore((s) => s.user?.organization_name);
  const {
    run,
    msg,
    lastBill,
    refresh,
  } = useDeliveryRun();
  const [refreshing, setRefreshing] = useState(false);
  const [printerModalVisible, setPrinterModalVisible] = useState(false);
  const connectedPrinter = usePrinterStore((s) => s.connectedPrinter);
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

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
      if (!stop) return;
      await shareWhatsAppBill(
        deliveryBillToPrintPayload(lastBill, stop, getItemName, { organizationName })
      );
      await markWhatsAppShared(lastBill.id);
      alert("WhatsApp share marked");
    } catch (e) {
      alert(getApiErrorMessage(e));
    }
  };

  return (
    <View className="flex-1 max-w-3xl mx-auto w-full bg-background" style={{ paddingTop: insets.top }}>
      <View className="h-16 px-4 flex-row justify-between items-center bg-surface-container-lowest border-b border-outline-variant/20">
        <View className="flex-row items-center gap-2">
          <View className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center">
            <MaterialIcons name="local-shipping" size={18} className="text-primary" />
          </View>
          <Text className="text-on-surface text-headline-sm font-bold tracking-tight">Delivery Run</Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Pressable 
            accessibilityRole="button" 
            onPress={() => setPrinterModalVisible(true)} 
            className="w-10 h-10 rounded-full items-center justify-center active:bg-surface-variant/50 transition-colors"
          >
            <MaterialIcons name="print" size={22} className={connectedPrinter ? "text-primary" : "text-on-surface-variant"} />
          </Pressable>
          <Pressable 
            accessibilityRole="button" 
            onPress={handleRefresh} 
            className="w-10 h-10 rounded-full items-center justify-center active:bg-surface-variant/50 transition-colors"
          >
            <MaterialIcons name="refresh" size={22} className="text-on-surface-variant" />
          </Pressable>
          <Pressable 
            accessibilityRole="button" 
            onPress={logout} 
            className="w-10 h-10 rounded-full items-center justify-center active:bg-error/10 transition-colors ml-1"
          >
            <MaterialIcons name="logout" size={22} className="text-error" />
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
                  onPress={() => navigation.navigate("DeliveryWeighing", { stop: item })}
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
    </View>
  );
}

const StopListItem = React.memo(({ item, isActive, getItemName, onPress }: { item: any, isActive: boolean, getItemName: (id: string) => string, onPress: () => void }) => {
  const isWeighed = item.status === "WEIGHED" || item.status === "BILLED";
  
  return (
    <Pressable accessibilityRole="button"
      accessibilityLabel={`Open stop ${item.sequence}, ${item.shop_name || item.retailer_name}`}
      className={`bg-white rounded-xl p-4 shadow-sm elevation-sm mb-3 border relative overflow-hidden active:opacity-90 ${
        isActive ? "border-[#0052CC]" : "border-[#E5E7EB]"
      }`}
      onPress={onPress}
    >
      <View className={`absolute top-0 left-0 w-1 h-full ${isActive ? 'bg-[#0052CC]' : 'bg-transparent'}`} />

      <View className="flex-row items-center justify-between mb-1">
        <View className="flex-row items-center gap-3 flex-1 mr-2">
          <View className={`w-8 h-8 rounded-full items-center justify-center ${isActive ? 'bg-[#0052CC]' : 'bg-[#E5E7EB]'}`}>
            <Text className={`font-bold text-[15px] ${isActive ? 'text-white' : 'text-[#202124]'}`}>{item.sequence}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-[16px] text-[#202124] font-bold" numberOfLines={1}>
              {item.shop_name || item.retailer_name}
            </Text>
            {(item.shop_name || item.retailer_mobile) ? (
              <Text className="text-[14px] text-[#5F6368]" numberOfLines={1}>
                {item.shop_name ? `${item.retailer_name} ` : ""}
                {item.retailer_mobile ? (item.shop_name ? `• ${item.retailer_mobile}` : item.retailer_mobile) : ""}
              </Text>
            ) : null}
          </View>
        </View>
        <View className="flex-row items-center gap-2">
          <View className={`px-3 py-1 rounded-full ${item.status === 'PENDING' ? 'bg-[#FFEBEE]' : 'bg-[#115E29]'}`}>
            <Text className={`text-[12px] font-bold tracking-wider ${item.status === 'PENDING' ? 'text-[#C62828]' : 'text-white'}`}>
              {item.status}
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} className="text-[#5F6368]" />
        </View>
      </View>

      {item.items && item.items.length > 0 && (
        <View className="mt-3 flex-row items-center bg-[#F7F8FA] rounded-lg p-2.5">
          {item.items.map((it: any, index: number) => {
            const boxes = isWeighed ? (it.delivered_boxes ?? it.original_total_boxes ?? 0) : (it.original_total_boxes || 0);
            const isLast = index === item.items.length - 1;
            return (
              <View key={it.item_id} className={`flex-1 flex-row items-center justify-between px-2 ${!isLast ? 'border-r border-[#E5E7EB]' : ''}`}>
                <Text className="text-[14px] text-[#202124] mr-2 flex-1" numberOfLines={1}>
                  {getItemName(it.item_id)}
                </Text>
                <View className="bg-[#2E7D32]/15 px-2 py-0.5 rounded-md">
                  <Text className="text-[13px] text-[#115E29] font-bold">
                    {boxes} boxes
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </Pressable>
  );
});
