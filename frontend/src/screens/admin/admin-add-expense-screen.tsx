import { useState } from "react";
import { View, Text, TextInput, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MaterialIcons } from "@expo/vector-icons";

import { Pressable } from "react-native";
import { getExpenseCategories, createExpense } from "../../api/expenses";

export function AdminAddExpenseScreen({ navigation }: any) {
  const queryClient = useQueryClient();
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [notes, setNotes] = useState("");

  const { data: categories, isLoading: isLoadingCats } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: () => getExpenseCategories(true),
  });

  const categoryOptions = categories?.map((c) => ({ label: c.name, value: c.id })) || [];

  const { mutate, isPending } = useMutation({
    mutationFn: createExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      navigation.goBack();
    },
    onError: (error: any) => {
      Alert.alert(
        "Error",
        error?.response?.data?.error?.message || "Failed to add expense."
      );
    },
  });

  const handleSave = () => {
    if (!categoryId) return Alert.alert("Validation", "Please select a category.");
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return Alert.alert("Validation", "Please enter a valid amount.");
    }
    
    mutate({
      category_id: categoryId,
      amount: Number(amount),
      expense_date: expenseDate,
      payment_method: paymentMethod,
      notes,
    });
  };

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
            Log Expense
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false}>
        <View className="mb-4">
          <Text className="text-sm font-medium text-text mb-1">Category</Text>
          <View className="flex-row flex-wrap gap-2">
            {isLoadingCats ? (
              <Text className="text-on-surface-variant">Loading categories...</Text>
            ) : (
              categoryOptions.map(opt => (
                <Pressable
                  key={opt.value}
                  onPress={() => setCategoryId(opt.value)}
                  className={`px-4 py-2 rounded-full border ${categoryId === opt.value ? 'bg-primary border-primary' : 'bg-surface border-outline-variant'}`}
                >
                  <Text className={categoryId === opt.value ? 'text-on-primary' : 'text-on-surface'}>{opt.label}</Text>
                </Pressable>
              ))
            )}
          </View>
        </View>

        <View className="mb-4">
          <Text className="text-sm font-medium text-text mb-1">Amount (₹)</Text>
          <TextInput
            className="w-full bg-white border border-border rounded-xl px-4 py-3 text-base text-text"
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            keyboardType="decimal-pad"
          />
        </View>

        <View className="mb-4">
          <Text className="text-sm font-medium text-text mb-1">Date (YYYY-MM-DD)</Text>
          <TextInput
            className="w-full bg-white border border-border rounded-xl px-4 py-3 text-base text-text"
            value={expenseDate}
            onChangeText={setExpenseDate}
            placeholder="YYYY-MM-DD"
          />
        </View>

        <View className="mb-4">
          <Text className="text-sm font-medium text-text mb-1">Payment Method</Text>
          <View className="flex-row gap-2">
            {["Cash", "UPI", "Bank Transfer"].map(method => (
              <Pressable
                key={method}
                onPress={() => setPaymentMethod(method)}
                className={`px-4 py-2 rounded-full border ${paymentMethod === method ? 'bg-primary border-primary' : 'bg-surface border-outline-variant'}`}
              >
                <Text className={paymentMethod === method ? 'text-on-primary' : 'text-on-surface'}>{method}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View className="mb-8">
          <Text className="text-sm font-medium text-text mb-1">Notes</Text>
          <TextInput
            className="w-full bg-white border border-border rounded-xl px-4 py-3 text-base text-text min-h-[100px]"
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional notes or reference..."
            placeholderTextColor="#9ca3af"
            multiline
            textAlignVertical="top"
          />
        </View>
      </ScrollView>

      <View className="p-4 bg-white border-t border-border">
        <Pressable
          accessibilityRole="button"
          className="w-full bg-primary h-12 rounded-lg flex items-center justify-center active:scale-95"
          onPress={handleSave}
          disabled={isPending}
        >
          <Text className="text-on-primary font-semibold text-lg">{isPending ? "Saving..." : "Save Expense"}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
