-- Completed consumption cycles in marts must have strictly positive duration_days
select
    usage_period_id,
    duration_days
from {{ ref('fact_consumption_cycle') }}
where status = 'completed'
  and (duration_days is null or duration_days <= 0)
