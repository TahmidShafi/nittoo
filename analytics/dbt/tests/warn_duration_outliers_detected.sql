{{ config(severity='warn') }}
-- Surface duration outlier cycles flagged by MAD z-score / >=1000-day guard in dbt
select
    usage_period_id,
    user_id,
    product_id,
    duration_days,
    mad_z_score
from {{ ref('fact_consumption_cycle') }}
where is_duration_outlier = true
