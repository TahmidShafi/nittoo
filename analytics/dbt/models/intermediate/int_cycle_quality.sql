-- Cycle-level data quality flags computed in dbt rather than rejected at ingestion.
-- Outlier detection is strictly per-(user_id, product_id) using consumption_rate_per_day:
--   1. Hard >= 1000-day guard (is_extreme_duration_1000d).
--   2. When a household-product has >= min_cycles_for_mad completed positive-duration
--      cycles (< 1000d), use MAD modified z-score (0.6745 * |x - median| / max(mad, 0.05 * median)).
--   3. Below min_cycles_for_mad, fall back to physical plausibility bounds per (category, size_unit).
with base as (
    select *
    from {{ ref('int_usage_enriched') }}
),
group_medians as (
    select
        user_id,
        product_id,
        count(*) as cycle_count,
        median(consumption_rate_per_day) as median_rate
    from base
    where status = 'completed'
      and duration_days is not null
      and duration_days > 0
      and duration_days < 1000
      and consumption_rate_per_day is not null
    group by 1, 2
),
group_mads as (
    select
        b.user_id,
        b.product_id,
        m.cycle_count,
        m.median_rate,
        greatest(
            median(abs(b.consumption_rate_per_day - m.median_rate)),
            {{ var('mad_floor_frac', 0.10) }} * m.median_rate
        ) as mad_rate
    from base as b
    inner join group_medians as m
        on b.user_id = m.user_id
       and b.product_id = m.product_id
    where b.status = 'completed'
      and b.duration_days is not null
      and b.duration_days > 0
      and b.duration_days < 1000
      and b.consumption_rate_per_day is not null
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
            when b.duration_days is not null and b.duration_days >= 1000
                then true
            else false
        end as is_extreme_duration_1000d,
        case
            when b.status = 'completed'
             and b.duration_days is not null
             and b.duration_days > 0
             and b.duration_days < 1000
             and b.consumption_rate_per_day is not null
             and gm.cycle_count >= {{ var('min_cycles_for_mad', 4) }}
             and gm.mad_rate is not null
             and gm.mad_rate > 0
                then round(0.6745 * abs(b.consumption_rate_per_day - gm.median_rate) / gm.mad_rate, 3)
            else null
        end as mad_z_score,
        case
            when b.status = 'completed'
             and b.duration_days is not null
             and b.duration_days > 0
             and b.duration_days < 1000
             and b.consumption_rate_per_day is not null
             and gm.cycle_count >= {{ var('min_cycles_for_mad', 4) }}
             and gm.mad_rate is not null
             and gm.mad_rate > 0
                then (0.6745 * abs(b.consumption_rate_per_day - gm.median_rate) / gm.mad_rate) > {{ var('mad_z_threshold', 4.5) }}
            when b.status = 'completed'
             and b.duration_days is not null
             and b.duration_days > 0
             and b.duration_days < 1000
             and b.consumption_rate_per_day is not null
             and coalesce(gm.cycle_count, 0) < {{ var('min_cycles_for_mad', 4) }}
             and bounds.min_plausible_rate is not null
                then (
                    b.consumption_rate_per_day < bounds.min_plausible_rate
                    or b.consumption_rate_per_day > bounds.max_plausible_rate
                )
            else false
        end as is_rate_outlier
    from base as b
    left join group_mads as gm
        on b.user_id = gm.user_id
       and b.product_id = gm.product_id
    left join {{ ref('category_rate_bounds') }} as bounds
        on b.category = bounds.category
       and b.effective_size_unit = bounds.size_unit
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
    is_extreme_duration_1000d,
    is_rate_outlier,
    (is_extreme_duration_1000d or is_rate_outlier) as is_duration_outlier,
    mad_z_score,
    (not is_zero_day and not (is_extreme_duration_1000d or is_rate_outlier)) as is_valid_for_forecasting
from scored
