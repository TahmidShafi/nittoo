select
    id as usage_period_id,
    user_id,
    product_id,
    product_name,
    purchase_id,
    cast(opened_date as date) as opened_date,
    cast(finished_date as date) as finished_date,
    status,
    cast(days_used as integer) as days_used_reported,
    cast(purchase_price as double) as purchase_price,
    currency,
    cast(cost_per_day as double) as cost_per_day_reported,
    source_file
from {{ source('raw', 'usage_periods') }}
