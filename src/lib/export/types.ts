// ==============================================================================
// Nittoo Data Export Types
// Unified export model consumed identically across Excel, CSV, PDF, and JSON
// ==============================================================================

export type ExportFormat = 'excel' | 'csv' | 'pdf' | 'json';

export interface ExportCategoryBreakdown {
  category: string;
  activeCount: number;
  estimatedMonthlyCost: number;
  percentage: number;
}

export interface ExportSummary {
  total_products: number;
  total_purchases: number;
  active_essentials: number;
  unopened_purchases: number;
  completed_usage_cycles: number;
  estimated_monthly_consumption: number | null;
  categories: string[];
  category_breakdown: ExportCategoryBreakdown[];
}

export interface ExportProductItem {
  id: string;
  name: string;
  brand: string;
  category: string;
  size: number | null;
  unit: string | null;
  created_at: string;
}

export interface ExportPurchaseItem {
  id: string;
  product_id: string;
  product_name: string;
  brand: string;
  category: string;
  purchase_date: string;
  price: number;
  currency: string;
  store_vendor: string | null;
}

export interface ExportUsageItem {
  id: string;
  product_id: string;
  product_name: string;
  purchase_id: string;
  opened_date: string;
  finished_date: string | null;
  status: 'completed' | 'active';
  days_used: number;
  purchase_price: number;
  currency: string;
  cost_per_day: number | null;
}

export interface ExportInventoryItem {
  product_id: string;
  product_name: string;
  brand: string;
  category: string;
  inventory_status: 'Active' | 'Unopened';
  purchase_date: string;
  price: number;
  currency: string;
  opened_date: string | null;
  days_used: number | null;
  predicted_remaining_days: number | null;
  backup_count: number;
}

export interface ExportAnalyticsItem {
  product_id: string;
  product_name: string;
  brand: string;
  category: string;
  observed_average_lifespan: number | null;
  completed_cycles: number;
  observed_cost_per_day: number | null;
  estimated_monthly_consumption: number | null;
  predicted_finish_date: string | null;
  predicted_remaining_days: number | null;
  confidence_state: string;
  confidence_label: string;
}

export interface NittooExportData {
  version: string;
  exported_at: string;
  user: {
    id: string;
    email: string;
  };
  summary: ExportSummary;
  products: ExportProductItem[];
  purchases: ExportPurchaseItem[];
  usage_history: ExportUsageItem[];
  inventory: ExportInventoryItem[];
  analytics: ExportAnalyticsItem[];
  insights: string[];
}
