-- Deduplicate raw.purchases deterministically by purchase id.
-- Keeps the earliest (source_file, raw_row_id) row; removed duplicates are
-- surfaced in stg_purchase_duplicates.
with ranked as (
    select
        raw_row_id,
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
        cast(size_value as double) as size_value,
        size_unit,
        source_file,
        row_number() over (
            partition by id
            order by source_file asc, raw_row_id asc
        ) as _rn
    from {{ source('raw', 'purchases') }}
)
select
    purchase_id,
    user_id,
    product_id,
    product_name,
    brand,
    category,
    purchase_date,
    purchase_month,
    price,
    currency,
    vendor_name,
    size_value,
    size_unit,
    source_file
from ranked
where _rn = 1
