// ==============================================================================
// Nittoo Shared Domain & Data Types
// Single Source of Truth for Data Models, Inputs, and IDataSource Interface
// ==============================================================================

export type UsageStatus = 'active' | 'finished';

export type ProductCategory =
  | 'Skincare'
  | 'Haircare'
  | 'Oral Care'
  | 'Household'
  | 'Other';

export type SizeUnit = 'ml' | 'g' | 'count';

export interface Product {
  id: string;
  user_id: string;
  name: string;
  category: ProductCategory;
  brand?: string | null;
  size_value?: number | null;
  size_unit?: SizeUnit | null;
  created_at: string;
}

export interface Purchase {
  id: string;
  product_id: string;
  purchase_date: string; // ISO format: YYYY-MM-DD
  price: number;
  currency: string; // Defaults to 'BDT'
  created_at: string;
}

export interface UsagePeriod {
  id: string;
  product_id: string;
  purchase_id: string;
  opened_date: string; // ISO format: YYYY-MM-DD
  finished_date?: string | null; // ISO format: YYYY-MM-DD
  status: UsageStatus;
  created_at: string;
}

// ------------------------------------------------------------------------------
// Input Data Types for Data Operations
// ------------------------------------------------------------------------------

export interface CreateProductInput {
  name: string;
  category: ProductCategory;
  brand?: string | null;
  size_value?: number | null;
  size_unit?: SizeUnit | null;
}

export interface CreatePurchaseInput {
  product_id: string;
  purchase_date: string; // YYYY-MM-DD
  price: number;
  currency?: string; // Default: 'BDT'
}

export interface StartUsagePeriodInput {
  product_id: string;
  purchase_id: string;
  opened_date: string; // YYYY-MM-DD
}

export interface FinishUsagePeriodInput {
  usage_period_id: string;
  finished_date: string; // YYYY-MM-DD
}

export interface UpdateProductInput {
  name: string;
  category: ProductCategory;
  brand?: string | null;
  size_value?: number | null;
  size_unit?: SizeUnit | null;
}

export interface UpdatePurchaseInput {
  purchase_date: string; // YYYY-MM-DD
  price: number;
  currency?: string;
}

export interface UpdateUsagePeriodInput {
  opened_date: string; // YYYY-MM-DD
}

// ------------------------------------------------------------------------------
// Relational & Aggregated Application Types
// ------------------------------------------------------------------------------

export interface ProductWithDetails extends Product {
  active_usage?: UsagePeriod | null;
  latest_purchase?: Purchase | null;
  active_purchase?: Purchase | null;
  finished_count?: number;
  finished_periods?: UsagePeriod[];
  unopened_count?: number;
}

export interface HistoricalUsageEntry {
  usage: UsagePeriod;
  purchase: Purchase;
  duration_days: number;
  cost_per_day: number;
}

export interface ProductWithHistory {
  product: Product;
  purchases: Purchase[];
  usage_periods: UsagePeriod[];
  active_usage: UsagePeriod | null;
  finished_periods: UsagePeriod[];
  unopened_purchases: Purchase[];
}

export interface ActiveProductCardData {
  product_id: string;
  name: string;
  category: ProductCategory;
  brand?: string | null;
  size_value?: number | null;
  size_unit?: SizeUnit | null;
  active_usage_id: string;
  purchase_id: string;
  purchase_price: number;
  purchase_date: string;
  opened_date: string;
  days_used: number;
  predicted_remaining_days: number | null;
  average_lifespan: number | null;
  cost_per_day: number | null;
  price_per_unit: number | null;
  progress_percent: number | null;
  has_enough_data: boolean;
}

export interface UnopenedInventoryItem {
  purchase: Purchase;
  product: Product;
}

export interface UserInventory {
  active: ProductWithDetails[];
  unopened: UnopenedInventoryItem[];
}

// ------------------------------------------------------------------------------
// Shared IDataSource Interface
// Implemented by both real Supabase (db.ts) and Mock Storage (mock-db.ts)
// ------------------------------------------------------------------------------

export interface IDataSource {
  createProduct(
    userId: string,
    input: CreateProductInput
  ): Promise<Product>;

  createPurchase(
    userId: string,
    input: CreatePurchaseInput
  ): Promise<Purchase>;

  startUsagePeriod(
    userId: string,
    input: StartUsagePeriodInput
  ): Promise<UsagePeriod>;

  finishUsagePeriod(
    userId: string,
    usagePeriodId: string,
    finishedDate: string
  ): Promise<UsagePeriod>;

  updateProduct(
    userId: string,
    productId: string,
    input: UpdateProductInput
  ): Promise<Product>;

  updatePurchase(
    userId: string,
    purchaseId: string,
    input: UpdatePurchaseInput
  ): Promise<Purchase>;

  updateUsagePeriod(
    userId: string,
    usagePeriodId: string,
    input: UpdateUsagePeriodInput
  ): Promise<UsagePeriod>;

  getActiveProducts(
    userId: string
  ): Promise<ProductWithDetails[]>;

  getProductHistory(
    productId: string,
    userId: string
  ): Promise<ProductWithHistory | null>;

  getAllUserProducts(
    userId: string
  ): Promise<Product[]>;

  getUserInventory(
    userId: string
  ): Promise<UserInventory>;

  resetUserData(
    userId: string
  ): Promise<void>;
}
