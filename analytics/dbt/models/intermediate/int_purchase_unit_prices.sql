select
    p.purchase_id,
    p.user_id,
    p.product_id,
    p.product_name,
    p.brand,
    p.category,
    p.purchase_date,
    p.purchase_month,
    p.price,
    p.currency,
    p.vendor_name,
    lower(replace(p.vendor_name, ' ', '_')) as vendor_key,
    coalesce(p.size_value, pr.size_value) as size_value,
    coalesce(p.size_unit, pr.size_unit) as size_unit,
    case
        when coalesce(p.size_value, pr.size_value) is not null
            and coalesce(p.size_value, pr.size_value) > 0
            then round(p.price / coalesce(p.size_value, pr.size_value), 4)
        else null
    end as unit_price
from {{ ref('stg_purchases') }} as p
left join {{ ref('stg_products') }} as pr
    on p.product_id = pr.product_id
