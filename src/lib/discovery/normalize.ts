// ==============================================================================
// Nittoo Product Discovery Normalization
// Pure functions for sanitizing text, safely parsing units, and category mapping
// ==============================================================================

import { PRODUCT_CATEGORIES, type ProductCategory, type SizeUnit } from '../../types';

/**
 * Normalizes user and provider text by trimming, collapsing spaces,
 * and stripping any unexpected HTML tags to guarantee plain text.
 */
export function normalizeText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim();
}

/**
 * Safely parses volume / size specifications from raw external strings.
 * Adheres strictly to Nittoo's supported units: 'ml' | 'g' | 'count'.
 * Does NOT guess densities or fabricate values for unsupported units.
 */
export function parseSize(rawSize: string | null | undefined): {
  sizeValue?: number;
  sizeUnit?: SizeUnit;
} {
  if (!rawSize) return {};

  const clean = normalizeText(rawSize).toLowerCase();
  if (!clean) return {};

  // Check for metric inside parentheses first, e.g. "3 FL OZ (87ml)" or "(100 g)"
  const parenthesizedMatch = clean.match(/\(([^)]+)\)/);
  const targetStr = parenthesizedMatch ? parenthesizedMatch[1] : clean;

  // 1. Check for ml (milliliters / millilitres)
  const mlMatch = targetStr.match(/(\d+(?:[.,]\d+)?)\s*(?:ml|milliliter|millilitre|millilitres|milliliters)\b/i);
  if (mlMatch) {
    const val = parseFloat(mlMatch[1].replace(',', '.'));
    if (!isNaN(val) && val > 0) {
      return { sizeValue: val, sizeUnit: 'ml' };
    }
  }

  // 2. Check for g (grams / gramme)
  const gMatch = targetStr.match(/(\d+(?:[.,]\d+)?)\s*(?:g|gram|grams|gramme|grammes)\b/i);
  if (gMatch) {
    const val = parseFloat(gMatch[1].replace(',', '.'));
    if (!isNaN(val) && val > 0) {
      return { sizeValue: val, sizeUnit: 'g' };
    }
  }

  // 3. Check for count (capsules, tablets, softgels, count, pcs, pieces)
  const countMatch = targetStr.match(
    /(\d+(?:[.,]\d+)?)\s*(?:count|ct|pcs|pieces|tablets|capsules|softgels|gummies|lozenges|bar|bars)\b/i
  );
  if (countMatch) {
    const val = parseFloat(countMatch[1].replace(',', '.'));
    if (!isNaN(val) && val > 0) {
      return { sizeValue: Math.round(val), sizeUnit: 'count' };
    }
  }

  // If no metric in parentheses, check the whole string for ml/g/count
  if (parenthesizedMatch) {
    const wholeMl = clean.match(/(\d+(?:[.,]\d+)?)\s*(?:ml|milliliter|millilitre)\b/i);
    if (wholeMl) {
      const val = parseFloat(wholeMl[1].replace(',', '.'));
      if (!isNaN(val) && val > 0) return { sizeValue: val, sizeUnit: 'ml' };
    }
    const wholeG = clean.match(/(\d+(?:[.,]\d+)?)\s*(?:g|gram|grams)\b/i);
    if (wholeG) {
      const val = parseFloat(wholeG[1].replace(',', '.'));
      if (!isNaN(val) && val > 0) return { sizeValue: val, sizeUnit: 'g' };
    }
  }

  // Unsupported or unparseable unit (e.g. "8 fl oz" without metric) -> leave undefined
  return {};
}

/**
 * Deterministic mapping layer from raw external category tags / strings
 * to Nittoo's authoritative ProductCategory taxonomy.
 * Returns undefined if no confident mapping exists.
 */
export function mapCategory(rawCategories: string | string[] | null | undefined): ProductCategory | undefined {
  if (!rawCategories) return undefined;

  const tags: string[] = Array.isArray(rawCategories)
    ? rawCategories
    : rawCategories.split(/[,;]/);

  const normalized = tags
    .map((t) => t.toLowerCase().replace(/^[a-z]{2}:/, '').trim()) // remove language prefix like 'en:', 'fr:'
    .filter(Boolean);

  if (normalized.length === 0) return undefined;

  // Exact match to known Nittoo categories first
  for (const tag of normalized) {
    const directMatch = PRODUCT_CATEGORIES.find((cat) => cat.toLowerCase() === tag);
    if (directMatch) return directMatch;
  }

  // Semantic keyword mapping
  for (const tag of normalized) {
    // Oral Care
    if (
      tag.includes('toothpaste') ||
      tag.includes('dentifrice') ||
      tag.includes('mouthwash') ||
      tag.includes('toothbrush') ||
      tag.includes('oral') ||
      tag.includes('bain-de-bouche')
    ) {
      return 'Oral Care';
    }

    // Haircare
    if (
      tag.includes('shampoo') ||
      tag.includes('conditioner') ||
      tag.includes('hair') ||
      tag.includes('cheveux') ||
      tag.includes('apres-shampooing') ||
      tag.includes('capillaire')
    ) {
      return 'Haircare';
    }

    // Skincare
    if (
      tag.includes('skin') ||
      tag.includes('visage') ||
      tag.includes('face') ||
      tag.includes('cleanser') ||
      tag.includes('moisturiz') ||
      tag.includes('serum') ||
      tag.includes('cream') ||
      tag.includes('creme') ||
      tag.includes('lotion') ||
      tag.includes('sunscreen') ||
      tag.includes('solaire') ||
      tag.includes('dermato') ||
      tag.includes('baume')
    ) {
      return 'Skincare';
    }

    // Body Care
    if (
      tag.includes('body') ||
      tag.includes('corps') ||
      tag.includes('shower') ||
      tag.includes('douche') ||
      tag.includes('soap') ||
      tag.includes('savon') ||
      tag.includes('bath') ||
      tag.includes('bain')
    ) {
      return 'Body Care';
    }

    // Shaving & Grooming
    if (
      tag.includes('shav') ||
      tag.includes('rasage') ||
      tag.includes('razor') ||
      tag.includes('beard') ||
      tag.includes('barbe')
    ) {
      return 'Shaving & Grooming';
    }

    // Personal Hygiene
    if (
      tag.includes('deodorant') ||
      tag.includes('antiperspirant') ||
      tag.includes('hygiene') ||
      tag.includes('sanitizer')
    ) {
      return 'Personal Hygiene';
    }

    // Supplements
    if (
      tag.includes('supplement') ||
      tag.includes('vitamin') ||
      tag.includes('dietary') ||
      tag.includes('mineral') ||
      tag.includes('complement-alimentaire')
    ) {
      return 'Supplements';
    }

    // Household Cleaning / Laundry
    if (tag.includes('laundry') || tag.includes('lessive')) {
      return 'Laundry';
    }
    if (
      tag.includes('cleaner') ||
      tag.includes('cleaning') ||
      tag.includes('detergent') ||
      tag.includes('dishwash') ||
      tag.includes('nettoyant-menager')
    ) {
      return 'Household Cleaning';
    }

    // Food & Beverage
    if (
      tag.includes('food') ||
      tag.includes('beverage') ||
      tag.includes('snack') ||
      tag.includes('coffee') ||
      tag.includes('tea') ||
      tag.includes('boisson')
    ) {
      return 'Food & Beverage';
    }

    // Baby Care
    if (tag.includes('baby') || tag.includes('bebe') || tag.includes('diaper')) {
      return 'Baby Care';
    }

    // Pet Care
    if (tag.includes('pet') || tag.includes('dog') || tag.includes('cat') || tag.includes('animal')) {
      return 'Pet Care';
    }
  }

  // No confident mapping found
  return undefined;
}

/**
 * Validates external image URL to guarantee it is a secure HTTPS link.
 * Prevents mixed-content issues or script-based URIs.
 */
export function sanitizeImageUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (trimmed.startsWith('https://')) {
    return trimmed;
  }
  return undefined;
}
