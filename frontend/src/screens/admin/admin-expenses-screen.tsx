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
 className="h-10 px-4 rounded-lg flex-row items-center justify-center bg-[#2E7D32] active:bg-[#2E7D32]/90"
 onPress={() => navigation.navigate("AddExpense")}
 >
 <MaterialIcons name="add"size={20} color="white"className="mr-1.5"/>
 <Text className="text-sm font-bold text-white font-bold">Add</Text>
 </Pressable>
 }
 />
 }
 >
 <View className="flex-1 px-4 pt-2">
 {isLoading ? (
 <View className="flex-1 items-center justify-center">
 <ActivityIndicator className="text-[#2E7D32]"size="large"/>
 <Text className="text-[#5f6368] font-medium mt-4">Loading expenses...</Text>
 </View>
 ) : data?.items?.length === 0 ? (
 <View className="bg-white rounded-lg p-8 border border-dashed border-[#e5e7eb] items-center justify-center mt-4">
 <View className="w-16 h-16 bg-[#f7f8fa] rounded-lg items-center justify-center mb-4">
 <MaterialIcons name="receipt-long"size={32} className="text-[#5f6368]"/>
 </View>
 <Text className="text-base font-bold text-[#5f6368] text-[#202124] mb-2">No Expenses Found</Text>
 <Text className="text-base text-[#5f6368] text-[#5f6368] text-center max-w-[250px] mb-6">
 You haven't recorded any business expenses yet. Click Add to create one.
 </Text>
 <Pressable
 className="bg-[#2E7D32]/10 px-6 py-3 rounded-lg border border-[#2E7D32]/20 flex-row items-center"
 onPress={() => navigation.navigate("AddExpense")}
 >
 <MaterialIcons name="add-circle"size={18} className="text-[#2E7D32] mr-2"/>
 <Text className="text-[#2E7D32]">Record First Expense</Text>
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
 <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#115E29"/>
 }
 />
 )}
 </View>
 </AdminScreenContainer>
 );
}

const ItemSeparator = React.memo(() => <View className="h-3"/>);

const ExpenseListItem = React.memo(({ item }: { item: Expense }) => {
 return (
 <View className="bg-white rounded-lg p-4 border border-[#e5e7eb] flex-row justify-between items-center relative overflow-hidden">
 <View className="absolute top-0 left-0 w-1.5 h-full bg-error"/>
 
 <View className="flex-1 ml-2 mr-4 flex-row items-center gap-3">
 <View className="w-10 h-10 rounded-lg bg-error/10 items-center justify-center border border-error/20">
 <MaterialIcons name="receipt-long"size={20} className="text-error"/>
 </View>
 <View className="flex-1">
 <Text className="text-sm font-bold text-[#5f6368] text-[#202124] mb-0.5">
 {item.category_name || "Uncategorized"}
 </Text>
 <View className="flex-row items-center gap-1.5 flex-wrap">
 <Text className="text-xs font-bold text-[#5f6368] font-medium">
 {item.expense_date}
 </Text>
 <View className="w-1 h-1 rounded-lg bg-outline-variant"/>
 <Text className="text-xs font-bold text-[#5f6368] font-medium">
 {item.payment_method || "N/A"}
 </Text>
 </View>
 {item.notes ? (
 <Text className="text-sm text-[#5f6368] text-[#5f6368]/80 italic mt-1"numberOfLines={1}>{item.notes}</Text>
 ) : null}
 </View>
 </View>
 
 <View className="items-end bg-error-container/30 px-3 py-2 rounded-lg border border-error/10">
 <Text className="text-2xl font-bold font-black text-error">
 -₹{item.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
 </Text>
 <Text className="text-xs font-bold text-[#5f6368] mt-0.5 uppercase tracking-wider text-[9px]">
 By {item.created_by_user_name || "System"}
 </Text>
 </View>
 </View>
 );
});
