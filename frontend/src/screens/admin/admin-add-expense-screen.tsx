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
 <AdminCard title="Expense Details"icon="receipt-long">
 <View className="flex-col gap-4">
 <View>
 <Text className="text-[#5f6368] text-sm font-bold font-semibold mb-1.5 ml-1">Category <Text className="text-error">*</Text></Text>
 <View className="flex-row flex-wrap gap-2">
 {isLoadingCats ? (
 <Text className="text-[#5f6368] font-medium ml-1">Loading categories...</Text>
 ) : (
 categoryOptions.map(opt => (
 <Pressable
 key={opt.value}
 onPress={() => setCategoryId(opt.value)}
 className={`px-4 py-2 rounded-lg border flex-row items-center justify-center active:scale-95 transition-colors ${
 categoryId === opt.value 
 ? 'bg-[#2E7D32]/10/20 border-[#2E7D32]' 
 : 'bg-white border-[#e5e7eb]'
 }`}
 >
 <Text className={`font-semibold text-base text-[#202124] ${categoryId === opt.value ? 'text-[#2E7D32]' : 'text-[#5f6368]'}`}>
 {opt.label}
 </Text>
 </Pressable>
 ))
 )}
 </View>
 </View>

 <View className="flex-row gap-4">
 <View className="flex-1">
 <Text className="text-[#5f6368] text-sm font-bold font-semibold mb-1.5 ml-1">Amount (₹) <Text className="text-error">*</Text></Text>
 <TextInput
 className="h-14 border border-[#e5e7eb] rounded-lg px-4 text-lg text-[#202124] text-[#202124] font-medium bg-white focus:border-[#2E7D32]"
 value={amount}
 onChangeText={setAmount}
 placeholder="0.00"
 placeholderTextColor="#717973"
 keyboardType="decimal-pad"
 />
 </View>
 <View className="flex-1 z-30">
 <Text className="text-[#5f6368] text-sm font-bold font-semibold mb-1.5 ml-1">Date <Text className="text-error">*</Text></Text>
 <DatePickerField 
 value={expenseDate} 
 onChange={setExpenseDate} 
 maximumDate={new Date()} 
 inputStyle="h-14 border border-[#e5e7eb] rounded-lg px-4 bg-white"
 showIcon={false}
 />
 </View>
 </View>

 <View>
 <Text className="text-[#5f6368] text-sm font-bold font-semibold mb-1.5 ml-1">Payment Method</Text>
 <View className="flex-row gap-3">
 {["Cash", "UPI", "Bank Transfer"].map(method => (
 <Pressable
 key={method}
 onPress={() => setPaymentMethod(method)}
 className={`h-12 rounded-lg border flex-row items-center justify-center px-4 flex-1 active:scale-95 transition-colors ${
 paymentMethod === method 
 ? "border-[#2E7D32] bg-[#2E7D32]/10/20"
 : "border-[#e5e7eb] bg-white"
 }`}
 >
 <Text className={`font-semibold text-base text-[#202124] ${paymentMethod === method ? "text-[#2E7D32]": "text-[#5f6368]"}`}>
 {method}
 </Text>
 </Pressable>
 ))}
 </View>
 </View>

 <View>
 <Text className="text-[#5f6368] text-sm font-bold font-semibold mb-1.5 ml-1">Notes</Text>
 <TextInput
 className="h-24 border border-[#e5e7eb] rounded-lg px-4 py-3 text-base text-[#202124] text-[#202124] bg-white focus:border-[#2E7D32]"
 value={notes}
 onChangeText={setNotes}
 placeholder="Optional notes or reference..."
 placeholderTextColor="#717973"
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
