select
    purchase_id,
    user_id,
    product_id,
    vendor_key,
    purchase_date,
    purchase_month,
    price,
    currency,
    size_value,
    size_unit,
    unit_price
from {{ ref('int_purchase_unit_prices') }}
