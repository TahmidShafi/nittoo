import React from 'react';
import { useCountUp } from '../hooks/useCountUp';

interface CountUpValueProps {
  value: number | null | undefined;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  localeFormat?: boolean;
  className?: string;
}

function formatNumber(
  num: number,
  decimals: number,
  localeFormat: boolean,
  prefix: string,
  suffix: string
): string {
  const formatted = localeFormat
    ? num.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : decimals > 0
    ? num.toFixed(decimals)
    : String(Math.round(num));
  return `${prefix}${formatted}${suffix}`;
}

/**
 * Renders a KPI number with a one-shot count-up animation and `tabular-nums`,
 * while exposing the final formatted value to assistive technology via `aria-label`.
 */
export const CountUpValue: React.FC<CountUpValueProps> = ({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  localeFormat = true,
  className = '',
}) => {
  const animated = useCountUp(value, { decimals });

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  const finalFormatted = formatNumber(value, decimals, localeFormat, prefix, suffix);
  const currentFormatted = formatNumber(
    animated ?? value,
    decimals,
    localeFormat,
    prefix,
    suffix
  );

  return (
    <span className={`tabular-nums ${className}`.trim()} aria-label={finalFormatted}>
      <span aria-hidden="true">{currentFormatted}</span>
    </span>
  );
};
