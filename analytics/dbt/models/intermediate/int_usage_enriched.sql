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
    pr.size_value,
    pr.size_unit,
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
            and pr.size_value is not null
            and pr.size_value > 0
            then round(
                pr.size_value / cast(date_diff('day', u.opened_date, u.finished_date) as double),
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
