import React from 'react';
import { computeLifespanTrackLayout, type RunOutRange } from '../lib/prediction';

interface LifespanBarProps {
  daysUsed: number;
  expectedLifespan: number | null;
  runOutRange: RunOutRange | null;
  isOverdue: boolean;
  predictedRemainingDays: number | null;
  heightClass?: string;
}

/**
 * Renders the lifespan progress bar on a shared [0 .. max(highDays, daysUsed)] scale,
 * with a subtle P10-P90 forecast range band, expected tick, and today marker (`aria-hidden`).
 */
export const LifespanBar: React.FC<LifespanBarProps> = ({
  daysUsed,
  expectedLifespan,
  runOutRange,
  isOverdue,
  predictedRemainingDays,
  heightClass = 'h-1.5',
}) => {
  const layout = computeLifespanTrackLayout({
    daysUsed,
    expectedLifespan,
    runOutRange,
  });

  if (!layout) {
    return (
      <div className={`${heightClass} w-full bg-neutral-100 rounded-full overflow-hidden`} aria-hidden="true">
        <div className="h-full w-full bg-neutral-200/50 rounded-full" />
      </div>
    );
  }

  const fillColor = isOverdue
    ? 'bg-status-critical-fill'
    : predictedRemainingDays !== null && predictedRemainingDays < 14
    ? 'bg-status-attention-fill'
    : 'bg-status-healthy-fill';

  return (
    <div
      className={`relative ${heightClass} w-full bg-neutral-100 rounded-full overflow-hidden`}
      aria-hidden="true"
    >
      {/* P10-P90 Forecast Range Band */}
      {layout.bandStartPercent !== null && layout.bandWidthPercent !== null && (
        <div
          className="absolute inset-y-0 bg-primary-200/55 animate-range-band"
          style={{
            left: `${layout.bandStartPercent}%`,
            width: `${layout.bandWidthPercent}%`,
          }}
        />
      )}

      {/* Days Used Progress Fill */}
      <div
        className={`relative h-full rounded-full animate-progress-fill ${fillColor}`}
        style={{ width: `${layout.fillPercent}%` }}
      />

      {/* Expected Lifespan Tick */}
      <div
        className="absolute inset-y-0 w-0.5 bg-neutral-500/70 animate-range-band"
        style={{ left: `calc(${layout.expectedPercent}% - 1px)` }}
      />

      {/* Today Marker */}
      {layout.fillPercent > 0 && layout.fillPercent < 100 && (
        <div
          className="absolute inset-y-0 w-0.5 bg-neutral-900/80 animate-range-band"
          style={{ left: `calc(${layout.fillPercent}% - 1px)` }}
        />
      )}
    </div>
  );
};
