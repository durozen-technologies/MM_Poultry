import { useState } from "react";
import { View, Text, FlatList, ActivityIndicator, Pressable, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { getExpenses, Expense } from "../../api/expenses";


export function AdminExpensesScreen({ navigation }: any) {
  const [page, setPage] = useState(1);
  const size = 50;

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["expenses", page, size],
    queryFn: () => getExpenses({ page, size }),
  });

  const renderItem = ({ item }: { item: Expense }) => (
    <View className="bg-white p-4 mb-3 rounded-2xl flex-row justify-between items-center shadow-sm">
      <View className="flex-1 mr-4">
        <Text className="text-base font-semibold text-text mb-1">
          {item.category_name || "Uncategorized"}
        </Text>
        <Text className="text-sm text-text-muted">
          {item.expense_date} • {item.payment_method || "N/A"}
        </Text>
        {item.notes ? (
          <Text className="text-xs text-text-muted mt-1 italic">{item.notes}</Text>
        ) : null}
      </View>
      <View className="items-end">
        <Text className="text-lg font-bold text-red-600">
          - ₹{item.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </Text>
        <Text className="text-xs text-text-muted mt-1">
          By {item.created_by_user_name || "System"}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="h-16 px-4 flex-row items-center justify-between bg-surface/80">
        <View className="flex-row items-center gap-2">
          <Pressable accessibilityRole="button"
            className="w-11 h-11 -ml-2 flex items-center justify-center rounded-full active:bg-surface-variant/50"
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="arrow-back" size={24} className="text-on-surface" />
          </Pressable>
          <Text className="font-headline-sm text-headline-sm text-primary font-semibold">
            Expenses
          </Text>
        </View>
      </View>
      
      <View className="flex-1 px-4 pt-4">
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator className="text-primary" size="large" />
          </View>
        ) : data?.items?.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <MaterialIcons name="receipt-long" size={64} color="#d1d5db" />
            <Text className="text-text-muted text-lg mt-4">No expenses found</Text>
            <Text className="text-text-muted text-sm mt-2 text-center max-w-[250px]">
              Click the button below to add your first expense record.
            </Text>
          </View>
        ) : (
          <FlatList
            data={data?.items || []}
            keyExtractor={(i) => i.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
            }
          />
        )}
      </View>

      <View className="absolute bottom-6 right-6">
        <Pressable
          onPress={() => navigation.navigate("AddExpense")}
          className="w-14 h-14 bg-primary rounded-full items-center justify-center shadow-lg active:scale-95"
        >
          <MaterialIcons name="add" size={28} color="white" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
