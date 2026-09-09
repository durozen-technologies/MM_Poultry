import React, { useCallback } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { getDispatchToday } from "../../api/delivery";
import type { DispatchRouteBucket } from "../../types/api";
import { AdminScreenContainer } from "../../components/admin/admin-screen-container";
import { AdminHeader } from "../../components/admin/admin-header";
import { DispatchItemSummaryList } from "../../components/admin/dispatch-item-lines";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  partial_assigned: "Partial",
  assigned: "Assigned",
  in_progress: "In progress",
  completed: "Done",
};

export function AdminDeliveryRunsScreen({ navigation }: { navigation: any }) {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["admin", "dispatch", "today"],
    queryFn: getDispatchToday,
  });

  const refresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const shortfall =
    data && Number(data.total_confirmed_kg) > Number(data.available_stock_kg);

  const renderRoute = ({ item }: { item: DispatchRouteBucket }) => (
    <Pressable
      className="bg-surface rounded-2xl p-4 mb-3 border border-outline-variant/20 flex-row items-center justify-between"
      onPress={() =>
        navigation.navigate("RouteDispatch", {
          routeId: item.route_id,
          routeName: item.route_name,
        })
      }
    >
      <View className="flex-1">
        <View className="flex-row items-center gap-2 mb-1">
          <Text className="font-headline-sm font-bold text-on-surface">{item.route_name}</Text>
          <View className="bg-surface-variant px-2 py-0.5 rounded-full">
            <Text className="text-xs text-on-surface-variant">
              {STATUS_LABEL[item.route_status] ?? item.route_status}
            </Text>
          </View>
        </View>
        <DispatchItemSummaryList
          items={item.confirmed_items}
          className="gap-0.5 mb-1"
          emptyLabel="No confirmed orders"
        />
        {item.unassigned_items.length > 0 ? (
          <Text className="text-xs text-primary mt-1">
            Unassigned:{" "}
            {item.unassigned_items
              .map((i) => `${i.item_name ?? "Item"} ${i.total_boxes} Box · ${Number(i.total_kg).toFixed(1)} kg`)
              .join(" · ")}
          </Text>
        ) : null}
        {item.runs.length > 0 ? (
          <Text className="text-xs text-on-surface-variant mt-1">
            {item.runs.length} run(s) today
          </Text>
        ) : null}
      </View>
      <MaterialIcons name="chevron-right" size={24} className="text-on-surface-variant" />
    </Pressable>
  );

  return (
    <AdminScreenContainer
      noScroll
      header={
        <AdminHeader
          title="Route Dispatch"
          subtitle="Assign confirmed orders to routes"
          showBackButton={false}
        />
      }
    >
      {isLoading ? (
        <ActivityIndicator className="mt-8" />
      ) : (
        <FlatList
          className="flex-1 px-4 pt-2"
          data={data?.routes ?? []}
          keyExtractor={(item) => item.route_id ?? "unassigned"}
          renderItem={renderRoute}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refresh} />}
          ListHeaderComponent={
            <View className="bg-surface-container-low rounded-2xl p-4 mb-3 border border-outline-variant/20">
              <Text className="font-label-md font-semibold text-on-surface mb-2">Available stock</Text>
              <DispatchItemSummaryList
                items={data?.available_items ?? []}
                emptyLabel="No stock on hand"
                className="gap-1 mb-3"
              />
              <Text className="font-label-md font-semibold text-on-surface mb-2">Total confirmed</Text>
              <DispatchItemSummaryList
                items={data?.confirmed_items ?? []}
                emptyLabel="No confirmed orders"
                className="gap-1 mb-3"
              />
              <Text className="font-label-md font-semibold text-on-surface mb-2">Unassigned</Text>
              <DispatchItemSummaryList
                items={data?.unassigned_items ?? []}
                emptyLabel="All orders assigned"
                className="gap-1"
              />
              {shortfall ? (
                <Text className="text-tertiary text-sm mt-3">
                  Orders exceed stock — informational only; dispatch is not blocked.
                </Text>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <Text className="text-center text-on-surface-variant py-8">No routes configured</Text>
          }
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </AdminScreenContainer>
  );
}
