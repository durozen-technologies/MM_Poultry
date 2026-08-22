import { api as apiClient } from './client';

export interface ExpenseCategory {
  id: string;
  name: string;
  is_active: boolean;
}

export interface Expense {
  id: string;
  category_id: string;
  amount: number;
  expense_date: string;
  payment_method: string | null;
  notes: string | null;
  created_by_user_id: string | null;
  created_by_user_name: string | null;
  category_name: string | null;
  created_at: string;
}

export interface ExpensePage {
  items: Expense[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export const getExpenseCategories = async (active_only: boolean = true) => {
  const res = await apiClient.get<ExpenseCategory[]>('/admin/expense-categories', {
    params: { active_only },
  });
  return res.data;
};

export const createExpenseCategory = async (data: { name: string; is_active: boolean }) => {
  const res = await apiClient.post<ExpenseCategory>('/admin/expense-categories', data);
  return res.data;
};

export const getExpenses = async (params: { page: number; size: number; from_date?: string; to_date?: string }) => {
  const res = await apiClient.get<ExpensePage>('/admin/expenses', { params });
  return res.data;
};

export const createExpense = async (data: {
  category_id: string;
  amount: number;
  expense_date: string;
  payment_method?: string;
  notes?: string;
}) => {
  const res = await apiClient.post<Expense>('/admin/expenses', data);
  return res.data;
};

export const deleteExpense = async (id: string) => {
  const res = await apiClient.delete(`/admin/expenses/${id}`);
  return res.data;
};
