// ==============================================================================
// Nittoo Product Card Component
// High-density, Linear-inspired personal consumption card
// Clear typographic hierarchy, thin data-viz progress track, tactile controls
// ==============================================================================

import React from 'react';
import { Link } from 'react-router-dom';
import { usePrediction } from '../hooks/usePrediction';
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
    costPerDay,
    progressPercent,
    isOverdue,
    overdueDays,
    urgencyState,
  } = usePrediction(product);

  const latestPurchase = product.latest_purchase;

  return (
    <div className="bg-white border border-[#E8ECE9] rounded-xl p-5 shadow-xs card-interactive hover:border-[#2D6A4F]/35 transition-all flex flex-col justify-between group">
      <div>
        {/* Top: Category label */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-[10px] uppercase font-semibold tracking-wider text-neutral-400">
            {product.category}
          </span>
          {isOverdue && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              Overdue
            </span>
          )}
        </div>

        {/* 1. PRODUCT IDENTITY */}
        <div>
          <Link
            to={`/product/${product.id}`}
            className="font-semibold text-neutral-900 text-base group-hover:text-[#2D6A4F] transition-colors line-clamp-1 tracking-tight"
          >
            {product.name}
          </Link>
          <p className="text-xs text-neutral-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
            {product.brand && (
              <span className="font-medium text-neutral-600">{product.brand}</span>
            )}
            {product.brand && (product.size_value || latestPurchase) && (
              <span className="text-neutral-300">·</span>
            )}
            {product.size_value && (
              <span>
                {product.size_value} {product.size_unit}
              </span>
            )}
            {latestPurchase && (
              <>
                <span className="text-neutral-300">·</span>
                <span>৳{latestPurchase.price}</span>
              </>
            )}
          </p>
        </div>

        {/* 2. CURRENT STATUS */}
        <div className="mt-4 pt-3 border-t border-[#F0F2F1]">
          {urgencyState === 'overdue' ? (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
              <span className="text-sm font-bold text-rose-600 tracking-tight">
                Overdue by {overdueDays} day{overdueDays === 1 ? '' : 's'}
              </span>
            </div>
          ) : urgencyState === 'running_soon' && predictedRemainingDays !== null ? (
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  predictedRemainingDays < 14 ? 'bg-amber-500' : 'bg-[#2D6A4F]'
                }`}
              />
              <span className="text-sm font-bold text-neutral-900 tracking-tight">
                {predictedRemainingDays} day{predictedRemainingDays === 1 ? '' : 's'} left
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-300 shrink-0" />
              <span className="text-xs font-medium text-neutral-400">
                First Cycle · Learning
              </span>
            </div>
          )}

          {/* 3. REFINED THIN PROGRESS INDICATOR */}
          <div className="h-[3px] w-full bg-neutral-100 rounded-full overflow-hidden mt-2.5">
            {progressPercent !== null ? (
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isOverdue
                    ? 'bg-rose-500 w-full'
                    : predictedRemainingDays !== null && predictedRemainingDays < 14
                    ? 'bg-amber-500'
                    : 'bg-[#2D6A4F]'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            ) : (
              <div className="h-full w-full bg-neutral-200/40 rounded-full" />
            )}
          </div>
        </div>

        {/* 4. LIFESPAN & COST */}
        <div className="mt-3.5 flex items-baseline justify-between gap-2">
          <div className="text-xs text-neutral-500">
            {averageLifespan !== null ? (
              <span>
                <strong className="font-semibold text-neutral-800">{averageLifespan}-day</strong> avg
                <span className="text-neutral-300 mx-1.5">·</span>
                Day {daysUsed}
              </span>
            ) : (
              <span>Day <strong className="font-semibold text-neutral-800">{daysUsed}</strong> in use</span>
            )}
          </div>

          <div className="text-right">
            {costPerDay !== null ? (
              <div className="flex items-baseline gap-0.5 justify-end">
                <span className="text-base font-bold text-neutral-900 tracking-tight">
                  ৳{costPerDay}
                </span>
                <span className="text-xs text-neutral-500 font-normal">/day</span>
              </div>
            ) : (
              <span className="text-xs text-neutral-400 italic">Not enough data</span>
            )}
          </div>
        </div>
      </div>

      {/* 5. ACTIONS */}
      <div className="mt-4 pt-3 border-t border-[#F0F2F1] flex items-center justify-between gap-2">
        <Link
          to={`/product/${product.id}`}
          className="btn-press text-xs font-medium text-neutral-600 hover:text-[#2D6A4F] transition-colors flex items-center gap-1 py-1"
        >
          <span>View Report</span>
          <span className="text-neutral-400 text-[11px]">→</span>
        </Link>
        <button
          type="button"
          onClick={() => onMarkFinished(product)}
          className="btn-press text-xs px-3 py-1.5 rounded-md bg-neutral-100/90 hover:bg-neutral-200/80 text-neutral-700 font-medium transition-colors cursor-pointer"
        >
          Finish
        </button>
      </div>
    </div>
  );
};
