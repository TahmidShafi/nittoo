-- Consumption rate per day on forecasting-valid completed cycles must lie within plausible bounds (0, 500]
select
    usage_period_id,
    consumption_rate_per_day
from {{ ref('fact_consumption_cycle') }}
where is_valid_for_forecasting = true
  and status = 'completed'
  and consumption_rate_per_day is not null
  and (consumption_rate_per_day <= 0 or consumption_rate_per_day > 500)
