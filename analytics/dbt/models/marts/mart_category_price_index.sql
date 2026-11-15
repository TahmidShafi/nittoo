with monthly as (
    select
        pr.category,
        p.size_unit,
        p.purchase_month as price_month,
        count(*) as purchase_count,
        round(avg(p.unit_price), 4) as avg_unit_price,
        round(median(p.unit_price), 4) as median_unit_price
    from {{ ref('fact_purchase') }} as p
    inner join {{ ref('dim_product') }} as pr
        on p.product_id = pr.product_id
    where p.unit_price is not null
      and p.size_unit is not null
    group by 1, 2, 3
),
with_base as (
    select
        *,
        first_value(avg_unit_price) over (
            partition by category, size_unit
            order by price_month
        ) as base_unit_price
    from monthly
)
select
    category,
    size_unit,
    price_month,
    purchase_count,
    avg_unit_price,
    median_unit_price,
    case
        when base_unit_price > 0
            then round((avg_unit_price / base_unit_price) * 100.0, 2)
        else null
    end as price_index_base_100
from with_base
