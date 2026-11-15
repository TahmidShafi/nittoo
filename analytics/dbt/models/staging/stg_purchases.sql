select
    id as purchase_id,
    user_id,
    product_id,
    product_name,
    coalesce(nullif(trim(brand), ''), 'Unknown') as brand,
    category,
    cast(purchase_date as date) as purchase_date,
    cast(date_trunc('month', cast(purchase_date as date)) as date) as purchase_month,
    cast(price as double) as price,
    currency,
    coalesce(nullif(trim(store_vendor), ''), 'Unspecified') as vendor_name,
    source_file
from {{ source('raw', 'purchases') }}
