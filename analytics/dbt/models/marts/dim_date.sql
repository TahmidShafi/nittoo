with all_dates as (
    select purchase_date as date_day from {{ ref('stg_purchases') }}
    union
    select opened_date as date_day from {{ ref('stg_usage_periods') }}
    union
    select finished_date as date_day from {{ ref('stg_usage_periods') }} where finished_date is not null
)
select
    date_day,
    extract(year from date_day)::integer as year,
    extract(month from date_day)::integer as month,
    extract(quarter from date_day)::integer as quarter,
    extract(dow from date_day)::integer as day_of_week,
    cast(date_trunc('month', date_day) as date) as month_start
from all_dates
where date_day is not null
