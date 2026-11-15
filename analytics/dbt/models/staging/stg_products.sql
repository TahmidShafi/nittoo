select
    id as product_id,
    user_id,
    name as product_name,
    coalesce(nullif(trim(brand), ''), 'Unknown') as brand,
    category,
    size as size_value,
    unit as size_unit,
    created_at,
    source_file
from {{ source('raw', 'products') }}
