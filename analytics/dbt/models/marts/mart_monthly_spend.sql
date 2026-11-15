select
    p.user_id,
    p.purchase_month as spend_month,
    pr.category,
    count(*) as purchase_count,
    round(sum(p.price), 2) as total_spend_bdt
from {{ ref('fact_purchase') }} as p
inner join {{ ref('dim_product') }} as pr
    on p.product_id = pr.product_id
group by 1, 2, 3
