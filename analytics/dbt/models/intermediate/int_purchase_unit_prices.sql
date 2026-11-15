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
    pr.size_value,
    pr.size_unit,
    case
        when pr.size_value is not null and pr.size_value > 0
            then round(p.price / pr.size_value, 4)
        else null
    end as unit_price
from {{ ref('stg_purchases') }} as p
left join {{ ref('stg_products') }} as pr
    on p.product_id = pr.product_id
