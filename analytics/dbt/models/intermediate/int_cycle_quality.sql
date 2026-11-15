-- Cycle-level data quality flags computed in dbt rather than rejected at ingestion.
-- Outlier detection uses the modified z-score (0.6745 * |x - median| / MAD) per
-- (product_name, size_value, size_unit) group, plus a hard >= 1000-day guard.
with base as (
    select *
    from {{ ref('int_usage_enriched') }}
),
group_medians as (
    select
        product_name,
        effective_size_value,
        effective_size_unit,
        median(duration_days) as median_days
    from base
    where status = 'completed'
      and duration_days is not null
      and duration_days > 0
      and duration_days < 1000
    group by 1, 2, 3
),
group_mads as (
    select
        b.product_name,
        b.effective_size_value,
        b.effective_size_unit,
        m.median_days,
        median(abs(b.duration_days - m.median_days)) as mad_days
    from base as b
    inner join group_medians as m
        on b.product_name = m.product_name
       and b.effective_size_value is not distinct from m.effective_size_value
       and b.effective_size_unit is not distinct from m.effective_size_unit
    where b.status = 'completed'
      and b.duration_days is not null
      and b.duration_days > 0
      and b.duration_days < 1000
    group by 1, 2, 3, 4
),
scored as (
    select
        b.*,
        case
            when b.status = 'completed' and (b.duration_days is null or b.duration_days <= 0)
                then true
            else false
        end as is_zero_day,
        case
            when b.status = 'completed'
             and b.duration_days is not null
             and b.duration_days > 0
             and gm.mad_days is not null
             and gm.mad_days > 0
                then round(0.6745 * abs(b.duration_days - gm.median_days) / gm.mad_days, 3)
            else null
        end as mad_z_score,
        case
            when b.duration_days is not null and b.duration_days >= 1000
                then true
            when b.status = 'completed'
             and b.duration_days is not null
             and b.duration_days > 0
             and gm.mad_days is not null
             and gm.mad_days > 0
             and (0.6745 * abs(b.duration_days - gm.median_days) / gm.mad_days) > 3.5
                then true
            else false
        end as is_duration_outlier
    from base as b
    left join group_mads as gm
        on b.product_name = gm.product_name
       and b.effective_size_value is not distinct from gm.effective_size_value
       and b.effective_size_unit is not distinct from gm.effective_size_unit
)
select
    usage_period_id,
    user_id,
    product_id,
    product_name,
    purchase_id,
    opened_date,
    finished_date,
    status,
    brand,
    category,
    effective_size_value,
    effective_size_unit,
    size_changed_from_previous,
    purchase_price,
    currency,
    duration_days,
    consumption_rate_per_day,
    cost_per_day,
    is_zero_day,
    is_duration_outlier,
    mad_z_score,
    (not is_zero_day and not is_duration_outlier) as is_valid_for_forecasting
from scored
