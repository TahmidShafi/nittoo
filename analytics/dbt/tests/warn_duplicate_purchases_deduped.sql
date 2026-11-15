{{ config(severity='warn') }}
-- Surface duplicate purchase rows removed during staging deduplication
select
    raw_row_id,
    purchase_id,
    source_file,
    duplicate_rank
from {{ ref('stg_purchase_duplicates') }}
