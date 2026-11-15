select
    id as restock_plan_id,
    user_id,
    product_id,
    product_name,
    usage_period_id,
    mode,
    days_before_finish,
    cast(reminder_date as date) as reminder_date,
    status,
    created_at,
    source_file
from {{ source('raw', 'restock_plans') }}
