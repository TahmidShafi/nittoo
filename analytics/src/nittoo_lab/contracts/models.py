from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ProductCategory = Literal[
    "Skincare",
    "Haircare",
    "Body Care",
    "Oral Care",
    "Supplements",
    "Personal Hygiene",
    "Shaving & Grooming",
    "Household Cleaning",
    "Laundry",
    "Home Essentials",
    "Food & Beverage",
    "Fitness",
    "Pet Care",
    "Baby Care",
    "Other",
]

SizeUnit = Literal["ml", "g", "count"]


class ExportUser(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    email: str


class ExportCategoryBreakdown(BaseModel):
    model_config = ConfigDict(extra="forbid")

    category: str
    activeCount: int = Field(ge=0)
    estimatedMonthlyCost: float = Field(ge=0)
    percentage: float = Field(ge=0, le=100)


class ExportSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    total_products: int = Field(ge=0)
    total_purchases: int = Field(ge=0)
    active_essentials: int = Field(ge=0)
    unopened_purchases: int = Field(ge=0)
    completed_usage_cycles: int = Field(ge=0)
    estimated_monthly_consumption: float | None = Field(default=None, ge=0)
    categories: list[str]
    category_breakdown: list[ExportCategoryBreakdown]


class ExportProductItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    brand: str
    category: ProductCategory
    size: float | None = Field(default=None, gt=0)
    unit: SizeUnit | None = None
    created_at: datetime


class ExportPurchaseItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    product_id: str = Field(min_length=1)
    product_name: str
    brand: str
    category: ProductCategory
    purchase_date: date
    price: float = Field(ge=0)
    currency: str = Field(min_length=1)
    store_vendor: str | None = None
    size_value: float | None = Field(default=None, gt=0)
    size_unit: SizeUnit | None = None


class ExportUsageItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    product_id: str = Field(min_length=1)
    product_name: str
    purchase_id: str = Field(min_length=1)
    opened_date: date
    finished_date: date | None = None
    status: Literal["completed", "active"]
    days_used: int = Field(ge=0)
    purchase_price: float = Field(ge=0)
    currency: str = Field(min_length=1)
    cost_per_day: float | None = Field(default=None, ge=0)


class ExportInventoryItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_id: str = Field(min_length=1)
    product_name: str
    brand: str
    category: ProductCategory
    inventory_status: Literal["Active", "Unopened"]
    purchase_date: date
    price: float = Field(ge=0)
    currency: str = Field(min_length=1)
    opened_date: date | None = None
    days_used: int | None = Field(default=None, ge=0)
    predicted_remaining_days: int | None = None
    backup_count: int = Field(ge=0)


class ExportAnalyticsItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_id: str = Field(min_length=1)
    product_name: str
    brand: str
    category: ProductCategory
    observed_average_lifespan: float | None = Field(default=None, gt=0)
    completed_cycles: int = Field(ge=0)
    observed_cost_per_day: float | None = Field(default=None, ge=0)
    estimated_monthly_consumption: float | None = Field(default=None, ge=0)
    predicted_finish_date: date | None = None
    predicted_remaining_days: int | None = None
    confidence_state: str
    confidence_label: str


class ExportRestockPlanItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    product_id: str = Field(min_length=1)
    product_name: str
    usage_period_id: str = Field(min_length=1)
    mode: Literal["relative", "custom"]
    days_before_finish: int | None = None
    reminder_date: date
    status: Literal["planned", "completed", "dismissed"]
    created_at: datetime


class NittooExportBackup(BaseModel):
    """Exact mirror of `generateJsonBackup` in `src/lib/export/json.ts`."""

    model_config = ConfigDict(extra="forbid")

    version: Literal["1.0.0", "1.1.0"]
    exported_at: datetime
    user: ExportUser
    summary: ExportSummary
    products: list[ExportProductItem]
    purchases: list[ExportPurchaseItem]
    usage_periods: list[ExportUsageItem]
    inventory: list[ExportInventoryItem]
    analytics: list[ExportAnalyticsItem]
    insights: list[str]
    restock_plans: list[ExportRestockPlanItem] = Field(default_factory=list)
