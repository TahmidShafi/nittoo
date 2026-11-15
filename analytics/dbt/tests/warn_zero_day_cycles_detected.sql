{{ config(severity='warn') }}
-- Surface zero-day completed cycles flagged in dbt
select
    usage_period_id,
    user_id,
    product_id,
    opened_date,
    finished_date,
    duration_days
from {{ ref('fact_consumption_cycle') }}
where is_zero_day = true
