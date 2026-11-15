-- Consumption rate per day on completed cycles must lie within plausible bounds (0, 500]
select
    usage_period_id,
    consumption_rate_per_day
from {{ ref('fact_consumption_cycle') }}
where status = 'completed'
  and consumption_rate_per_day is not null
  and (consumption_rate_per_day <= 0 or consumption_rate_per_day > 500)
