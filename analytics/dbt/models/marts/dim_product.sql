select
    product_id,
    user_id,
    product_name,
    brand,
    category,
    size_value,
    size_unit,
    created_at
from {{ ref('stg_products') }}
