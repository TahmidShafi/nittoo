with joined as (
    select
        u.usage_period_id,
        u.user_id,
        u.product_id,
        u.product_name,
        u.purchase_id,
        u.opened_date,
        u.finished_date,
        u.status,
        pr.brand,
        pr.category,
        coalesce(pu.size_value, pr.size_value) as effective_size_value,
        coalesce(pu.size_unit, pr.size_unit) as effective_size_unit,
        u.purchase_price,
        u.currency,
        case
            when u.status = 'completed' and u.finished_date is not null
                then date_diff('day', u.opened_date, u.finished_date)
            else u.days_used_reported
        end as duration_days,
        case
            when u.status = 'completed'
                and u.finished_date is not null
                and date_diff('day', u.opened_date, u.finished_date) > 0
                and coalesce(pu.size_value, pr.size_value) is not null
                and coalesce(pu.size_value, pr.size_value) > 0
                then round(
                    coalesce(pu.size_value, pr.size_value)
                    / cast(date_diff('day', u.opened_date, u.finished_date) as double),
                    4
                )
            else null
        end as consumption_rate_per_day,
        case
            when u.status = 'completed'
                and u.finished_date is not null
                and date_diff('day', u.opened_date, u.finished_date) > 0
                then round(
                    u.purchase_price / cast(date_diff('day', u.opened_date, u.finished_date) as double),
                    2
                )
            else null
        end as cost_per_day
    from {{ ref('stg_usage_periods') }} as u
    left join {{ ref('stg_products') }} as pr
        on u.product_id = pr.product_id
    left join {{ ref('stg_purchases') }} as pu
        on u.purchase_id = pu.purchase_id
),
with_prev as (
    select
        *,
        lag(effective_size_value) over (
            partition by product_id
            order by opened_date asc, usage_period_id asc
        ) as prev_effective_size_value
    from joined
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
    case
        when prev_effective_size_value is not null
            and effective_size_value is distinct from prev_effective_size_value
            then true
        else false
    end as size_changed_from_previous,
    purchase_price,
    currency,
    duration_days,
    consumption_rate_per_day,
    cost_per_day
from with_prev
