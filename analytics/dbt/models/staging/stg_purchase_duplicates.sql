-- Duplicate purchase rows removed during staging deduplication.
with ranked as (
    select
        raw_row_id,
        id as purchase_id,
        user_id,
        product_id,
        product_name,
        cast(purchase_date as date) as purchase_date,
        cast(price as double) as price,
        currency,
        source_file,
        row_number() over (
            partition by id
            order by source_file asc, raw_row_id asc
        ) as _rn
    from {{ source('raw', 'purchases') }}
)
select
    raw_row_id,
    purchase_id,
    user_id,
    product_id,
    product_name,
    purchase_date,
    price,
    currency,
    source_file,
    _rn as duplicate_rank
from ranked
where _rn > 1
