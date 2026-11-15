// ==============================================================================
// Nittoo Product Card Component
// Displays active essential metrics, urgency badge, refined progress, and finish action
// High visual hierarchy with tactile interaction states
// ==============================================================================

import React from 'react';
import { Link } from 'react-router-dom';
import { usePrediction } from '../hooks/usePrediction';
import { calculateConfidence } from '../lib/confidence';
import { formatRunOutRange, getEffectiveSize } from '../lib/prediction';
import type { ProductWithDetails } from '../types';

interface ProductCardProps {
  product: ProductWithDetails;
  onMarkFinished: (product: ProductWithDetails) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onMarkFinished,
}) => {
  const {
    daysUsed,
    averageLifespan,
    predictedRemainingDays,
    runOutRange,
    validCompletedCycles,
    costPerDay,
    pricePerUnit,
    progressPercent,
    isOverdue,
    overdueDays,
    urgencyState,
  } = usePrediction(product);

  const latestPurchase = product.latest_purchase;
  const confidence = calculateConfidence(validCompletedCycles);

  return (
    <div className="h-full bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-xs card-interactive hover:border-[#2D6A4F]/40 flex flex-col justify-between group">
      <div>
        {/* Card Header: Category Pill & Status Badge */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-md bg-neutral-100/90 text-neutral-600">
            {product.category}
          </span>

          {urgencyState === 'overdue' ? (
            <span className="text-xs font-semibold text-status-critical-text bg-status-critical-bg border border-status-critical-border px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-status-critical-fill animate-pulse" />
              <span>Overdue by {overdueDays}d</span>
            </span>
          ) : urgencyState === 'running_soon' ? (
            <span
              className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${
                predictedRemainingDays !== null && predictedRemainingDays < 14
                  ? 'text-status-attention-text bg-status-attention-bg border-status-attention-border'
                  : 'text-[#2D6A4F] bg-[#EBF4F0] border-[#2D6A4F]/20'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${predictedRemainingDays !== null && predictedRemainingDays < 14 ? 'bg-status-attention-fill' : 'bg-[#2D6A4F]'}`} />
              <span>{predictedRemainingDays}d left</span>
            </span>
          ) : (
            <span className="text-xs font-medium text-neutral-500 bg-neutral-100/80 border border-neutral-200/50 px-2.5 py-0.5 rounded-full">
              First cycle • Learning
            </span>
          )}
        </div>

        {/* Product Identity */}
        <div>
          <h3 className="font-bold text-neutral-900 text-base sm:text-lg group-hover:text-[#2D6A4F] transition-colors line-clamp-1 tracking-tight">
            {product.name}
          </h3>
          <p className="text-xs text-neutral-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
            {product.brand && (
              <span className="font-medium text-neutral-700">{product.brand}</span>
            )}
            {(() => {
              const eff = getEffectiveSize(
                product.active_purchase ?? product.latest_purchase,
                product
              );
              return (
                <>
                  {product.brand && (eff.size_value || latestPurchase) && (
                    <span className="text-neutral-300">•</span>
                  )}
                  {eff.size_value && (
                    <span>
                      {eff.size_value} {eff.size_unit}
                    </span>
                  )}
                </>
              );
            })()}
            {latestPurchase && (
              <>
                <span className="text-neutral-300">•</span>
                <span>৳{latestPurchase.price}</span>
              </>
            )}
            {Boolean(product.unopened_count && product.unopened_count > 0) && (
              <>
                <span className="text-neutral-300">•</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 font-medium text-[10px]">
                  {product.unopened_count} backup{product.unopened_count! > 1 ? 's' : ''}
                </span>
              </>
            )}
          </p>
        </div>

        {/* Refined Lifespan Progress Section */}
        <div className="mt-4 pt-3 border-t border-neutral-100/80 space-y-1.5">
          <div className="flex justify-between items-center text-xs text-neutral-500">
            <span>
              Day <strong className="font-semibold text-neutral-800">{daysUsed}</strong> in use
            </span>
            {averageLifespan !== null ? (
              <span
                className="text-neutral-600 font-medium text-xs cursor-help"
                title={`${confidence.label} • ${confidence.supportingText}`}
              >
                {averageLifespan}-day avg · {validCompletedCycles} {validCompletedCycles === 1 ? 'cycle' : 'cycles'}
              </span>
            ) : (
              <span className="text-neutral-400 italic text-[11px]">No history yet</span>
            )}
          </div>

          {runOutRange && (
            <p className="text-[11px] text-neutral-500 font-medium">
              {formatRunOutRange(runOutRange)}
            </p>
          )}

          {/* Slim Visual Progress Line */}
          <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
            {progressPercent !== null ? (
              <div
                className={`h-full rounded-full animate-progress-fill ${
                  isOverdue
                    ? 'bg-status-critical-fill w-full'
                    : predictedRemainingDays !== null && predictedRemainingDays < 14
                    ? 'bg-status-attention-fill'
                    : 'bg-[#2D6A4F]'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            ) : (
              <div className="h-full w-full bg-neutral-200/50 rounded-full" />
            )}
          </div>
        </div>

        {/* Prominent Daily Cost & Unit Rate */}
        <div className="mt-4 pt-3 border-t border-neutral-100/80 flex items-baseline justify-between">
          <div>
            <span className="text-[11px] font-medium text-neutral-500 block mb-0.5">
              Cost per day
            </span>
            {costPerDay !== null ? (
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-neutral-900 tracking-tight">
                  ৳{costPerDay}
                </span>
                <span className="text-xs text-neutral-500 font-normal">/ day</span>
              </div>
            ) : (
              <span className="text-xs text-neutral-400 italic">Calculating...</span>
            )}
          </div>

          {pricePerUnit !== null && (
            <div className="text-right">
              <span className="text-[11px] font-medium text-neutral-500 block mb-0.5">
                Unit rate
              </span>
              <span className="text-xs font-medium text-neutral-600">
                ৳{pricePerUnit} / {getEffectiveSize(product.active_purchase ?? product.latest_purchase, product).size_unit}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Card Actions */}
      <div className="mt-5 pt-3 border-t border-neutral-100 flex items-center justify-between gap-2">
        <Link
          to={`/product/${product.id}`}
          className="btn-press text-xs font-semibold text-[#2D6A4F] hover:text-[#24563F] hover:underline flex items-center gap-1"
        >
          <span>View Report</span>
          <span>→</span>
        </Link>
        <button
          type="button"
          onClick={() => onMarkFinished(product)}
          className="btn-press text-xs px-3.5 py-1.5 rounded-lg bg-neutral-100/80 hover:bg-neutral-200/70 text-neutral-700 font-medium transition-colors cursor-pointer"
        >
          Mark Finished
        </button>
      </div>
    </div>
  );
};
