export type UserRole = "SUPER_ADMIN" | "ADMIN" | "DELIVERY" | "RETAILER";

export type User = {
  id: string;
  username: string;
  role: UserRole;
  organization_id: string | null;
  retailer_id: string | null;
  is_active: boolean;
  organization_slug?: string | null;
  organization_name?: string | null;
};

export type LoginResponse = {
  access_token: string;
  token_type: string;
  user: User;
};

export type Retailer = {
  id: string;
  name: string;
  shop_name: string | null;
  owner_name?: string | null;
  phone: string | null;
  whatsapp?: string | null;
  area?: string | null;
  route_name?: string | null;
  category?: string | null;
  opening_balance: string;
  credit_balance: string;
  credit_limit?: string;
  is_active: boolean;
};

export type DailyOrder = {
  id: string;
  retailer_id: string;
  order_date: string;
  requested_kg: string;
  notes: string | null;
  status: string;
  retailer_name?: string | null;
  shop_name?: string | null;
};

export type FarmLoad = {
  id: string;
  load_date: string;
  loaded_weight_kg: string;
  vehicle_id?: string | null;
  vehicle_number: string | null;
  driver_name: string | null;
  bird_count?: number | null;
  status: string;
};

export type Vehicle = {
  id: string;
  number: string;
  capacity_kg: string | null;
  driver_name: string | null;
  is_active: boolean;
};

export type DeliveryStop = {
  id: string;
  delivery_run_id: string;
  retailer_id: string;
  sequence: number;
  ordered_kg: string;
  delivered_weight_kg: string | null;
  rate_per_kg: string;
  gross_amount: string | null;
  status: string;
  delivered_bird_count?: number | null;
  retailer_name?: string | null;
  shop_name?: string | null;
};

export type DeliveryRun = {
  id: string;
  farm_load_id: string;
  run_date: string;
  status: string;
  stops: DeliveryStop[];
};

export type DeliveryBill = {
  id: string;
  bill_number: string;
  checkout_id: string;
  weight_kg: string;
  rate_per_kg: string;
  total_amount: string;
  cash_payment: string;
  upi_payment: string;
  balance_amount: string;
  print_status: string;
  whatsapp_shared_at: string | null;
};

export type OpsDashboard = {
  order_count: number;
  ordered_kg: string;
  loaded_kg: string;
  delivered_kg: string;
  pending_kg: string;
  total_sales: string;
  total_collection: string;
  outstanding: string;
  loss_kg: string;
  loss_pct: string;
  loss_status: string;
  retailer_count: number;
  completed_deliveries: number;
  pending_deliveries: number;
  skipped_deliveries: number;
  weight_loss_warn_pct: string;
  weight_loss_alert_pct: string;
};

export type LedgerOut = {
  retailer: Retailer;
  opening_balance: string;
  credit_balance: string;
  entries: Array<{
    entry_type: string;
    entry_date: string;
    reference?: string | null;
    debit: string;
    credit: string;
    balance_after?: string | null;
    notes?: string | null;
  }>;
};

export type TripWeightLoss = {
  loaded_kg: string;
  delivered_kg: string;
  loss_kg: string;
  loss_pct: string;
};

export type ReportSummary = {
  period_start: string;
  period_end: string;
  total_ordered_kg: string;
  total_delivered_kg: string;
  total_sales_amount: string;
  total_collections: string;
  total_loss_kg: string;
};
