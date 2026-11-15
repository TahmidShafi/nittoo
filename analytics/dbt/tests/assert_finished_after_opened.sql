-- Completed consumption cycles must satisfy finished_date >= opened_date
select
    usage_period_id,
    opened_date,
    finished_date
from {{ ref('fact_consumption_cycle') }}
where status = 'completed'
  and (finished_date is null or finished_date < opened_date)
