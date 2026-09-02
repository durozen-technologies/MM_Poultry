import React, { useState } from "react";
import { View, Text, FlatList, ActivityIndicator, Pressable, RefreshControl } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { getExpenses, Expense } from "../../api/expenses";

import { AdminScreenContainer } from "../../components/admin/admin-screen-container";
import { AdminHeader } from "../../components/admin/admin-header";

export function AdminExpensesScreen({ navigation }: any) {
  const [page, setPage] = useState(1);
  const size = 50;

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["expenses", page, size],
    queryFn: () => getExpenses({ page, size }),
  });



  return (
    <AdminScreenContainer
      noScroll
      header={
        <AdminHeader 
          title="Business Expenses" 
          subtitle="Track and manage company spending"
          onBack={() => navigation.goBack()} 
          rightContent={
            <Pressable
              accessibilityRole="button"
              className="h-10 px-4 rounded-full flex-row items-center justify-center bg-primary active:bg-primary/90 shadow-sm shadow-primary/30"
              onPress={() => navigation.navigate("AddExpense")}
            >
              <MaterialIcons name="add" size={20} color="white" className="mr-1.5" />
              <Text className="text-label-md text-white font-bold">Add</Text>
            </Pressable>
          }
        />
      }
    >
      <View className="flex-1 px-4 pt-2">
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator className="text-primary" size="large" />
            <Text className="text-on-surface-variant font-medium mt-4">Loading expenses...</Text>
          </View>
        ) : data?.items?.length === 0 ? (
          <View className="bg-surface-container-lowest rounded-3xl p-8 border border-dashed border-outline-variant/50 items-center justify-center mt-4">
            <View className="w-16 h-16 bg-surface-variant/30 rounded-full items-center justify-center mb-4">
              <MaterialIcons name="receipt-long" size={32} className="text-on-surface-variant/70" />
            </View>
            <Text className="font-title-md text-on-surface font-bold mb-2">No Expenses Found</Text>
            <Text className="font-body-md text-on-surface-variant text-center max-w-[250px] mb-6">
              You haven't recorded any business expenses yet. Click Add to create one.
            </Text>
            <Pressable
              className="bg-primary/10 px-6 py-3 rounded-full border border-primary/20 flex-row items-center"
              onPress={() => navigation.navigate("AddExpense")}
            >
              <MaterialIcons name="add-circle" size={18} className="text-primary mr-2" />
              <Text className="text-primary font-bold">Record First Expense</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={data?.items || []}
            keyExtractor={(i) => i.id}
            renderItem={({ item }) => <ExpenseListItem item={item} />}
            contentContainerStyle={{ paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={true}
            ItemSeparatorComponent={ItemSeparator}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#115E29" />
            }
          />
        )}
      </View>
    </AdminScreenContainer>
  );
}

const ItemSeparator = React.memo(() => <View className="h-3" />);

const ExpenseListItem = React.memo(({ item }: { item: Expense }) => {
  return (
    <View className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant/20 flex-row justify-between items-center relative overflow-hidden">
      <View className="absolute top-0 left-0 w-1.5 h-full bg-error" />
      
      <View className="flex-1 ml-2 mr-4 flex-row items-center gap-3">
        <View className="w-10 h-10 rounded-full bg-error/10 items-center justify-center border border-error/20">
          <MaterialIcons name="receipt-long" size={20} className="text-error" />
        </View>
        <View className="flex-1">
          <Text className="font-title-sm text-on-surface font-bold mb-0.5">
            {item.category_name || "Uncategorized"}
          </Text>
          <View className="flex-row items-center gap-1.5 flex-wrap">
            <Text className="font-label-sm text-on-surface-variant font-medium">
              {item.expense_date}
            </Text>
            <View className="w-1 h-1 rounded-full bg-outline-variant" />
            <Text className="font-label-sm text-on-surface-variant font-medium">
              {item.payment_method || "N/A"}
            </Text>
          </View>
          {item.notes ? (
            <Text className="font-body-sm text-on-surface-variant/80 italic mt-1" numberOfLines={1}>{item.notes}</Text>
          ) : null}
        </View>
      </View>
      
      <View className="items-end bg-error-container/30 px-3 py-2 rounded-xl border border-error/10">
        <Text className="font-title-lg font-black text-error">
          -₹{item.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </Text>
        <Text className="font-label-sm font-bold text-on-surface-variant mt-0.5 uppercase tracking-wider text-[9px]">
          By {item.created_by_user_name || "System"}
        </Text>
      </View>
    </View>
  );
});
