// ==============================================================================
// Nittoo Barcode Normalization & Validation
// Pure, deterministic validation for EAN-13, UPC-A, EAN-8, and GTIN-14
// ==============================================================================

export type BarcodeFormat = 'EAN-8' | 'UPC-A' | 'EAN-13' | 'GTIN-14';

export interface BarcodeValidationResult {
  valid: boolean;
  normalized?: string;
  format?: BarcodeFormat;
  error?: string;
}

/**
 * Normalizes raw barcode input:
 * - Trims whitespace
 * - Removes harmless formatting spaces and hyphens
 * - Preserves leading zeros as a string (never converts to Number)
 */
export function normalizeBarcode(input: string | null | undefined): string {
  if (!input) return '';
  return input.trim().replace(/[\s-]+/g, '');
}

/**
 * Calculates GS1 Modulo-10 check digit for standard numeric barcodes.
 * Multiplies digits from right-to-left with alternating weights of 3 and 1,
 * then computes (10 - (sum % 10)) % 10.
 */
export function calculateGs1CheckDigit(digitsWithoutCheck: string): number {
  let sum = 0;
  let weight = 3;
  for (let i = digitsWithoutCheck.length - 1; i >= 0; i--) {
    const digit = parseInt(digitsWithoutCheck[i], 10);
    sum += digit * weight;
    weight = weight === 3 ? 1 : 3;
  }
  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}

/**
 * Validates check digit of a normalized numeric barcode string against the GS1 standard.
 */
export function validateBarcodeCheckDigit(barcode: string): boolean {
  if (!/^\d+$/.test(barcode) || barcode.length < 8) return false;
  const data = barcode.slice(0, -1);
  const expectedCheck = calculateGs1CheckDigit(data);
  const actualCheck = parseInt(barcode.slice(-1), 10);
  return expectedCheck === actualCheck;
}

/**
 * Validates barcode format, length, and check digit.
 * Supported standard formats:
 * - EAN-8 (8 digits)
 * - UPC-A (12 digits)
 * - EAN-13 (13 digits)
 * - GTIN-14 (14 digits)
 */
export function validateBarcode(input: string | null | undefined): BarcodeValidationResult {
  const normalized = normalizeBarcode(input);

  if (!normalized) {
    return { valid: false, error: 'Please enter a barcode number.' };
  }

  // Reject non-numeric characters
  if (!/^\d+$/.test(normalized)) {
    return { valid: false, error: 'Barcode must contain numeric digits only.' };
  }

  let format: BarcodeFormat;
  switch (normalized.length) {
    case 8:
      format = 'EAN-8';
      break;
    case 12:
      format = 'UPC-A';
      break;
    case 13:
      format = 'EAN-13';
      break;
    case 14:
      format = 'GTIN-14';
      break;
    default:
      return {
        valid: false,
        error: `Invalid barcode length (${normalized.length} digits). Supported formats are UPC-A (12 digits), EAN-13 (13 digits), EAN-8 (8 digits), or GTIN-14 (14 digits).`,
      };
  }

  // Validate GS1 check digit
  if (!validateBarcodeCheckDigit(normalized)) {
    return {
      valid: false,
      normalized,
      format,
      error: `Invalid check digit for ${format} barcode. Please verify the numbers on the packaging.`,
    };
  }

  return {
    valid: true,
    normalized,
    format,
  };
}
