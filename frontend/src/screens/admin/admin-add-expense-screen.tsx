import { useState } from "react";
import { View, Text, TextInput, Alert, Pressable } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MaterialIcons } from "@expo/vector-icons";
import { AdminScreenContainer } from "../../components/admin/admin-screen-container";
import { AdminHeader } from "../../components/admin/admin-header";
import { AdminCard } from "../../components/admin/admin-card";
import { AdminActionFooter } from "../../components/admin/admin-action-footer";
import { getExpenseCategories, createExpense } from "../../api/expenses";
import { DatePickerField } from "../../components/date-picker-field";
import { toApiDate, todayIstDate } from "../../utils/ist-date";

export function AdminAddExpenseScreen({ navigation }: any) {
  const queryClient = useQueryClient();
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(todayIstDate());
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
      expense_date: toApiDate(expenseDate) || "",
      payment_method: paymentMethod,
      notes,
    });
  };

  return (
    <AdminScreenContainer
      header={
        <AdminHeader 
          title="Log Expense" 
          subtitle="Record a new business expense"
          onBack={() => navigation.goBack()} 
        />
      }
    >
      <AdminCard title="Expense Details" icon="receipt-long">
        <View className="flex-col gap-4">
          <View>
            <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1">Category <Text className="text-error">*</Text></Text>
            <View className="flex-row flex-wrap gap-2">
              {isLoadingCats ? (
                <Text className="text-on-surface-variant font-medium ml-1">Loading categories...</Text>
              ) : (
                categoryOptions.map(opt => (
                  <Pressable
                    key={opt.value}
                    onPress={() => setCategoryId(opt.value)}
                    className={`px-4 py-2 rounded-xl border flex-row items-center justify-center active:scale-95 transition-colors ${
                      categoryId === opt.value 
                        ? 'bg-primary-container/20 border-primary' 
                        : 'bg-surface-container-lowest border-outline-variant/50'
                    }`}
                  >
                    <Text className={`font-semibold text-body-md ${categoryId === opt.value ? 'text-primary' : 'text-on-surface-variant'}`}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))
              )}
            </View>
          </View>

          <View className="flex-row gap-4">
            <View className="flex-1">
              <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1">Amount (₹) <Text className="text-error">*</Text></Text>
              <TextInput
                className="h-14 border border-outline-variant/50 rounded-xl px-4 text-body-lg text-on-surface font-medium bg-surface-container-lowest focus:border-primary"
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor="#9ca3af"
                keyboardType="decimal-pad"
              />
            </View>
            <View className="flex-1 z-30">
              <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1">Date <Text className="text-error">*</Text></Text>
              <DatePickerField 
                value={expenseDate} 
                onChange={setExpenseDate} 
                maximumDate={new Date()} 
                inputStyle="h-14 border border-outline-variant/50 rounded-xl px-4 bg-surface-container-lowest"
                showIcon={false}
              />
            </View>
          </View>

          <View>
            <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1">Payment Method</Text>
            <View className="flex-row gap-3">
              {["Cash", "UPI", "Bank Transfer"].map(method => (
                <Pressable
                  key={method}
                  onPress={() => setPaymentMethod(method)}
                  className={`h-12 rounded-xl border flex-row items-center justify-center px-4 flex-1 active:scale-95 transition-colors ${
                    paymentMethod === method 
                      ? "border-primary bg-primary-container/20" 
                      : "border-outline-variant/50 bg-surface-container-lowest"
                  }`}
                >
                  <Text className={`font-semibold text-body-md ${paymentMethod === method ? "text-primary" : "text-on-surface-variant"}`}>
                    {method}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View>
            <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1">Notes</Text>
            <TextInput
              className="h-24 border border-outline-variant/50 rounded-xl px-4 py-3 text-body-md text-on-surface bg-surface-container-lowest focus:border-primary"
              value={notes}
              onChangeText={setNotes}
              placeholder="Optional notes or reference..."
              placeholderTextColor="#9ca3af"
              multiline
              textAlignVertical="top"
            />
          </View>
        </View>
      </AdminCard>

      <AdminActionFooter
        primaryLabel="Save Expense"
        primaryIcon="save"
        onPrimaryPress={handleSave}
        isPrimaryLoading={isPending}
      />
    </AdminScreenContainer>
  );
}
