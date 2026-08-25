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
  full_name?: string | null;
  mobile_number?: string | null;
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
  alternate_phone?: string | null;
  whatsapp?: string | null;
  address?: string | null;
  area?: string | null;
  route_name?: string | null;
  category?: string | null;
  notes?: string | null;
  opening_balance: string;
  credit_balance: string;
  credit_limit?: string;
  preferred_delivery_time?: string | null;
  is_active: boolean;
};

export type Item = {
  id: string;
  name: string;
  description?: string | null;
  default_price: string;
  is_active: boolean;
};

export type OrderStatus =
  | "PLACED"
  | "ACKNOWLEDGED"
  | "PARTIAL"
  | "FULFILLED"
  | "CANCELLED";

export type OrderItem = {
  id: string;
  daily_order_id: string;
  item_id: string;
  requested_kg: string;
  bird_size?: string | null;
  notes?: string | null;
};

export type DailyOrder = {
  id: string;
  retailer_id: string;
  order_date: string;
  order_number?: string | null;
  status: OrderStatus;
  retailer_name?: string | null;
  shop_name?: string | null;
  items: OrderItem[];
};

export type DailyOrderOut = DailyOrder;

export type TodayOrdersResponse = {
  items: DailyOrder[];
  total_requested_kg: string;
  has_more: boolean;
  next_cursor: string | null;
};

export type FarmOut = {
  id: string;
  name: string;
  owner_name?: string | null;
  location: string | null;
  address?: string | null;
  contact_phone: string | null;
  capacity?: number | null;
  is_active: boolean;
};

export type FarmLoad = {
  id: string;
  load_date: string;
  farm_id?: string | null;
  loaded_weight_kg: string;
  vehicle_id?: string | null;
  vehicle_number: string | null;
  driver_name: string | null;
  bird_count?: number | null;
  rate_per_kg?: string | null;
  total_amount?: string | null;
  paid_amount?: string | null;
  payment_method?: string | null;
  remarks?: string | null;
  status: string;
};

export type Rate = {
  id: string;
  item_id: string;
  retailer_id: string | null;
  rate_per_kg: string;
  effective_from: string;
  effective_to?: string | null;
};

export type OrganizationOut = {
  id: string;
  name: string;
  slug: string;
  schema_name: string;
  is_active: boolean;
};

export type OrganizationUpdate = {
  name?: string | null;
  is_active?: boolean | null;
};

export type TenantAdminCreate = {
  username: string;
  password: string;
};

export type TenantAdminUpdate = {
  is_active?: boolean | null;
  password?: string | null;
};

export type DeliveryUserCreate = {
  username: string;
  password: string;
  full_name?: string | null;
  mobile_number?: string | null;
};

export type Vehicle = {
  id: string;
  number: string;
  capacity_kg: string | null;
  driver_name: string | null;
  is_active: boolean;
};

export type DeliveryStopItem = {
  id: string;
  delivery_stop_id: string;
  item_id: string;
  ordered_kg: string;
  delivered_weight_kg: string | null;
  rate_per_kg: string;
  gross_amount: string | null;
  delivered_bird_count?: number | null;
};

export type DeliveryStop = {
  id: string;
  delivery_run_id: string;
  retailer_id: string;
  daily_order_id?: string | null;
  sequence: number;
  status: string;
  retailer_name?: string | null;
  shop_name?: string | null;
  items: DeliveryStopItem[];
};

export type DeliveryRun = {
  id: string;
  farm_load_id: string;
  run_date: string;
  status: string;
  started_at?: string | null;
  completed_at?: string | null;
  stops: DeliveryStop[];
};

export type DeliveryBillItem = {
  id: string;
  delivery_bill_id: string;
  item_id: string;
  weight_kg: string;
  rate_per_kg: string;
  amount: string;
};

export type DeliveryBill = {
  id: string;
  bill_number: string;
  checkout_id: string;
  delivery_stop_id?: string;
  retailer_id?: string;
  bill_date?: string;
  total_amount: string;
  cash_payment: string;
  upi_payment: string;
  balance_amount: string;
  print_status: string;
  whatsapp_shared_at: string | null;
  items: DeliveryBillItem[];
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

export type OrderTrackingStage = {
  key: string;
  label: string;
  completed: boolean;
  active: boolean;
};

export type RetailerOrderDetail = DailyOrder & {
  estimated_delivery_date: string;
  tracking_stages: OrderTrackingStage[];
};

export type RetailerOrdersPage = {
  items: DailyOrder[];
  has_more: boolean;
  next_cursor: string | null;
};

export type RetailerBillsSummary = {
  count: number;
  total_amount: string;
  total_paid: string;
  outstanding: string;
};

export type RetailerBillsPage = {
  items: DeliveryBill[];
  summary: RetailerBillsSummary;
  has_more: boolean;
  next_cursor: string | null;
};

export type RetailerLastPayment = {
  amount: string;
  payment_date: string;
  method: string | null;
};

export type RetailerDashboard = {
  today_order: DailyOrder | null;
  outstanding: string;
  last_payment: RetailerLastPayment | null;
  month_purchase_total: string;
  month_payment_total: string;
};

export type RetailerProfile = {
  retailer: Retailer;
  username: string;
};

export type OrderItemCreate = {
  item_id: string;
  requested_kg: string;
  bird_size?: string | null;
  notes?: string | null;
};

export type DailyOrderCreate = {
  items: OrderItemCreate[];
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
