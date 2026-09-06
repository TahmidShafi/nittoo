// ==============================================================================
// Nittoo Product Card Component
// Displays active essential metrics, urgency badge, progress bar, and finish action
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
    pricePerUnit,
    progressPercent,
    isOverdue,
    overdueDays,
    urgencyState,
  } = usePrediction(product);

  const latestPurchase = product.latest_purchase;

  return (
    <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-xs hover:border-[#2D6A4F]/40 transition-all flex flex-col justify-between group">
      <div>
        {/* Card Header: Category & Urgency Badges */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="text-xs font-medium px-2 py-0.5 rounded bg-neutral-100 text-neutral-600">
            {product.category}
          </span>

          {urgencyState === 'overdue' ? (
            <span className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full">
              Overdue by {overdueDays} day{overdueDays === 1 ? '' : 's'}
            </span>
          ) : urgencyState === 'running_soon' ? (
            <span
              className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                predictedRemainingDays !== null && predictedRemainingDays < 14
                  ? 'text-amber-800 bg-amber-50 border-amber-200'
                  : 'text-[#2D6A4F] bg-[#EBF4F0] border-[#2D6A4F]/20'
              }`}
            >
              {predictedRemainingDays} day{predictedRemainingDays === 1 ? '' : 's'} left
            </span>
          ) : (
            <span className="text-xs font-medium text-neutral-500 bg-neutral-100 px-2.5 py-0.5 rounded-full">
              First Cycle
            </span>
          )}
        </div>

        {/* Product Name & Details */}
        <h3 className="font-semibold text-neutral-900 text-base group-hover:text-[#2D6A4F] transition-colors line-clamp-1">
          {product.name}
        </h3>
        <p className="text-xs text-neutral-500 mt-0.5">
          {[
            product.brand,
            product.size_value ? `${product.size_value} ${product.size_unit}` : null,
            latestPurchase ? `Purchased ৳${latestPurchase.price}` : null,
          ]
            .filter(Boolean)
            .join(' • ')}
        </p>

        {/* Progress Section */}
        <div className="mt-4 space-y-1.5">
          <div className="flex justify-between items-center text-xs text-neutral-500">
            <span>Used {daysUsed} day{daysUsed === 1 ? '' : 's'}</span>
            {averageLifespan !== null ? (
              <span className="font-medium text-neutral-700">
                Avg: {averageLifespan} days
              </span>
            ) : (
              <span className="italic text-neutral-400">Not enough data</span>
            )}
          </div>

          {/* Visual Progress Bar */}
          <div className="h-2 w-full bg-neutral-100 rounded-full overflow-hidden">
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
              /* Indeterminate / Neutral State when no finished lifespan exists */
              <div className="h-full w-full bg-neutral-200/60 rounded-full opacity-60" />
            )}
          </div>
        </div>

        {/* Cost & Unit Rate Metrics */}
        <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs">
          <div>
            <span className="text-neutral-500 block text-[11px]">Est. Cost / day:</span>
            {costPerDay !== null ? (
              <span className="font-semibold text-neutral-900">৳{costPerDay} / day</span>
            ) : (
              <span className="italic text-neutral-400 text-[11px]">Not enough data</span>
            )}
          </div>

          {pricePerUnit !== null && (
            <div className="text-right">
              <span className="text-neutral-500 block text-[11px]">Unit rate:</span>
              <span className="font-medium text-neutral-700">
                ৳{pricePerUnit} / {product.size_unit}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Card Actions */}
      <div className="mt-5 pt-3 border-t border-neutral-100 flex items-center justify-between gap-2">
        <Link
          to={`/product/${product.id}`}
          className="text-xs font-medium text-[#2D6A4F] hover:underline"
        >
          View History →
        </Link>
        <button
          type="button"
          onClick={() => onMarkFinished(product)}
          className="text-xs px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium transition-colors"
        >
          Mark Finished
        </button>
      </div>
    </div>
  );
};
