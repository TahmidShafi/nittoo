select distinct
    vendor_key,
    vendor_name
from {{ ref('int_purchase_unit_prices') }}
