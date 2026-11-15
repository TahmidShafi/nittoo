select
    usage_period_id,
    user_id,
    product_id,
    purchase_id,
    opened_date,
    finished_date,
    status,
    duration_days,
    size_value,
    size_unit,
    consumption_rate_per_day,
    purchase_price,
    cost_per_day
from {{ ref('int_usage_enriched') }}
