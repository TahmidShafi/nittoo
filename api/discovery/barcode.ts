// ==============================================================================
// Vercel Serverless / Edge Function: /api/discovery/barcode
// Handles barcode discovery lookup requests server-side for UPCitemdb
// Avoids browser CORS restrictions and keeps any API keys strictly server-side
// ==============================================================================

import type { ProductCategory, SizeUnit } from '../../src/types';
import type { DiscoveryProduct } from '../../src/lib/discovery/types';

export const config = {
  runtime: 'edge',
};

const UPCITEMDB_BASE_URL = 'https://api.upcitemdb.com/prod/trial/lookup';
const DEFAULT_TIMEOUT_MS = 7000;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
};

// --- Barcode Validation Logic ---

function normalizeBarcode(input: string | null | undefined): string {
  if (!input) return '';
  return input.trim().replace(/[\s-]+/g, '');
}

function calculateGs1CheckDigit(digitsWithoutCheck: string): number {
  if (!digitsWithoutCheck || !/^\d+$/.test(digitsWithoutCheck)) {
    return -1;
  }
  let sum = 0;
  let weight = 3;
  for (let i = digitsWithoutCheck.length - 1; i >= 0; i--) {
    const digit = parseInt(digitsWithoutCheck[i], 10);
    sum += digit * weight;
    weight = weight === 3 ? 1 : 3;
  }
  return (10 - (sum % 10)) % 10;
}

function validateBarcodeCheckDigit(barcode: string): boolean {
  if (!/^\d+$/.test(barcode) || barcode.length < 8) return false;
  const data = barcode.slice(0, -1);
  const expectedCheck = calculateGs1CheckDigit(data);
  const actualCheck = parseInt(barcode.slice(-1), 10);
  return expectedCheck === actualCheck;
}

function validateBarcode(input: string | null | undefined): { valid: boolean; normalized?: string; error?: string } {
  const normalized = normalizeBarcode(input);
  if (!normalized) {
    return { valid: false, error: 'Please enter a barcode number.' };
  }
  if (!/^\d+$/.test(normalized)) {
    return { valid: false, error: 'Barcode must contain numeric digits only.' };
  }
  if (![8, 12, 13, 14].includes(normalized.length)) {
    return {
      valid: false,
      error: `Invalid barcode length (${normalized.length} digits). Supported formats are UPC-A (12 digits), EAN-13 (13 digits), EAN-8 (8 digits), or GTIN-14 (14 digits).`,
    };
  }
  if (!validateBarcodeCheckDigit(normalized)) {
    return {
      valid: false,
      normalized,
      error: 'Invalid check digit for barcode. Check the number and try again.',
    };
  }
  return { valid: true, normalized };
}

// --- Text & Category Normalization ---

function normalizeText(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function parseSize(rawSize: string | null | undefined): { sizeValue?: number; sizeUnit?: SizeUnit } {
  if (!rawSize) return {};
  const clean = normalizeText(rawSize).toLowerCase();
  if (!clean) return {};

  const parenthesizedMatch = clean.match(/\(([^)]+)\)/);
  const targetStr = parenthesizedMatch ? parenthesizedMatch[1] : clean;

  const mlMatch = targetStr.match(/(\d+(?:[.,]\d+)?)\s*(?:ml|milliliter|millilitre|millilitres|milliliters)\b/i);
  if (mlMatch) {
    const val = parseFloat(mlMatch[1].replace(',', '.'));
    if (!isNaN(val) && val > 0) return { sizeValue: val, sizeUnit: 'ml' };
  }

  const gMatch = targetStr.match(/(\d+(?:[.,]\d+)?)\s*(?:g|gram|grams|gramme|grammes)\b/i);
  if (gMatch) {
    const val = parseFloat(gMatch[1].replace(',', '.'));
    if (!isNaN(val) && val > 0) return { sizeValue: val, sizeUnit: 'g' };
  }

  const countMatch = targetStr.match(
    /(\d+(?:[.,]\d+)?)\s*(?:count|ct|pcs|pieces|tablets|capsules|softgels|gummies|lozenges|bar|bars)\b/i
  );
  if (countMatch) {
    const val = parseFloat(countMatch[1].replace(',', '.'));
    if (!isNaN(val) && val > 0) return { sizeValue: Math.round(val), sizeUnit: 'count' };
  }

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

  return {};
}

function mapCategory(rawCategories: string | string[] | null | undefined): ProductCategory | undefined {
  if (!rawCategories) return undefined;
  const tags: string[] = Array.isArray(rawCategories) ? rawCategories : rawCategories.split(/[,;>]/);
  const normalized = tags.map((t) => t.toLowerCase().replace(/^[a-z]{2}:/, '').trim()).filter(Boolean);

  for (const tag of normalized) {
    if (tag.includes('toothpaste') || tag.includes('oral') || tag.includes('mouthwash')) return 'Oral Care';
    if (tag.includes('shampoo') || tag.includes('conditioner') || tag.includes('hair')) return 'Haircare';
    if (tag.includes('skin') || tag.includes('cleanser') || tag.includes('cream') || tag.includes('lotion')) return 'Skincare';
    if (tag.includes('body') || tag.includes('shower') || tag.includes('soap') || tag.includes('bath')) return 'Body Care';
    if (tag.includes('shav') || tag.includes('razor') || tag.includes('beard')) return 'Shaving & Grooming';
    if (tag.includes('deodorant') || tag.includes('antiperspirant') || tag.includes('hygiene') || tag.includes('perfume')) return 'Personal Hygiene';
    if (tag.includes('supplement') || tag.includes('vitamin')) return 'Supplements';
    if (tag.includes('laundry')) return 'Laundry';
    if (tag.includes('cleaner') || tag.includes('cleaning') || tag.includes('detergent')) return 'Household Cleaning';
    if (tag.includes('food') || tag.includes('beverage') || tag.includes('snack')) return 'Food & Beverage';
    if (tag.includes('baby') || tag.includes('diaper')) return 'Baby Care';
    if (tag.includes('pet') || tag.includes('dog') || tag.includes('cat')) return 'Pet Care';
  }
  return undefined;
}

function sanitizeImageUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (trimmed.startsWith('https://')) return trimmed;
  return undefined;
}

interface RawUpcItemDbItem {
  ean?: string;
  title?: string;
  brand?: string;
  size?: string;
  category?: string;
  images?: string[];
  upc?: string;
}

interface RawUpcItemDbResponse {
  code?: string;
  total?: number;
  items?: RawUpcItemDbItem[];
}

function normalizeUpcItemDbProducts(
  rawItems: RawUpcItemDbItem[] | undefined,
  source: string,
  requestedBarcode: string
): DiscoveryProduct[] {
  if (!Array.isArray(rawItems)) return [];
  const results: DiscoveryProduct[] = [];

  for (const item of rawItems) {
    if (!item || typeof item !== 'object') continue;
    const name = normalizeText(item.title);
    if (!name) continue;

    const brand = normalizeText(item.brand) || undefined;
    const rawCategory = item.category ? normalizeText(item.category) : undefined;
    const category = mapCategory(item.category);

    const parsedSizeFromRaw = parseSize(item.size);
    const parsedSizeFromTitle = parseSize(item.title);
    const sizeValue = parsedSizeFromRaw.sizeValue ?? parsedSizeFromTitle.sizeValue;
    const sizeUnit = parsedSizeFromRaw.sizeUnit ?? parsedSizeFromTitle.sizeUnit;
    const rawSize = item.size ? normalizeText(item.size) : undefined;

    const firstImage = Array.isArray(item.images) && item.images.length > 0 ? item.images[0] : undefined;
    const imageUrl = sanitizeImageUrl(firstImage);

    const barcode = requestedBarcode || (item.ean ? normalizeText(item.ean) : undefined) || (item.upc ? normalizeText(item.upc) : undefined);
    const externalId = item.ean || item.upc || `${source}-${results.length}-${name.toLowerCase()}`;

    results.push({
      externalId,
      source,
      name,
      brand,
      category,
      rawCategory,
      sizeValue,
      sizeUnit,
      rawSize,
      imageUrl,
      barcode,
    });
  }

  return results;
}

// --- Fetch with Timeout Helper ---

async function fetchWithTimeout(url: string, headers: Record<string, string>, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}

// --- Core Lookup Function ---

export async function lookupUpcItemDbServer(
  barcode: string,
  options?: { timeoutMs?: number }
): Promise<DiscoveryProduct | null> {
  const validation = validateBarcode(barcode);
  if (!validation.valid || !validation.normalized) {
    throw new Error(validation.error || 'Invalid barcode format');
  }

  const canonicalBarcode = validation.normalized;
  const timeoutMs = options?.timeoutMs || DEFAULT_TIMEOUT_MS;

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  const apiKey = typeof process !== 'undefined' ? process.env?.UPCITEMDB_API_KEY : undefined;
  if (apiKey) {
    headers['user_key'] = apiKey;
    headers['key_type'] = '3';
  }

  const queryUpc = async (code: string): Promise<RawUpcItemDbResponse | null> => {
    const url = `${UPCITEMDB_BASE_URL}?upc=${encodeURIComponent(code)}`;
    const response = await fetchWithTimeout(url, headers, timeoutMs);

    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`UPCitemdb server fetch failed with status ${response.status}`);
    }

    return (await response.json()) as RawUpcItemDbResponse;
  };

  let data = await queryUpc(canonicalBarcode);

  // If 13-digit EAN starting with '0' yielded no results, fallback to 12-digit UPC
  if (
    (!data || data.total === 0 || !data.items || data.items.length === 0) &&
    canonicalBarcode.length === 13 &&
    canonicalBarcode.startsWith('0')
  ) {
    const upc12 = canonicalBarcode.slice(1);
    const fallbackData = await queryUpc(upc12);
    if (fallbackData && fallbackData.total && fallbackData.total > 0 && fallbackData.items && fallbackData.items.length > 0) {
      data = fallbackData;
    }
  }

  if (!data || data.total === 0 || !data.items || data.items.length === 0) {
    return null;
  }

  const normalized = normalizeUpcItemDbProducts(data.items, 'upcitemdb', canonicalBarcode);
  return normalized[0] || null;
}

// --- Universal Handler (Edge + Node) ---

export default async function handler(req: any, res?: any): Promise<Response | void> {
  // Check if running in Node Serverless mode (req: IncomingMessage, res: ServerResponse)
  const isNode = Boolean(res && typeof res.setHeader === 'function');

  const sendResponse = (status: number, data: any) => {
    if (isNode) {
      res.statusCode = status;
      for (const [k, v] of Object.entries(CORS_HEADERS)) {
        res.setHeader(k, v);
      }
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
      return;
    }
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
      },
    });
  };

  // CORS preflight
  const method = req.method || 'GET';
  if (method === 'OPTIONS') {
    if (isNode) {
      res.statusCode = 204;
      for (const [k, v] of Object.entries(CORS_HEADERS)) {
        res.setHeader(k, v);
      }
      res.end();
      return;
    }
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }

  let barcode = '';

  if (method === 'GET') {
    if (isNode) {
      const parsedUrl = new URL(req.url || '', 'http://localhost');
      barcode = parsedUrl.searchParams.get('barcode') || parsedUrl.searchParams.get('upc') || (req.query?.barcode as string) || (req.query?.upc as string) || '';
    } else {
      const parsedUrl = new URL(req.url);
      barcode = parsedUrl.searchParams.get('barcode') || parsedUrl.searchParams.get('upc') || '';
    }
  } else if (method === 'POST') {
    if (isNode) {
      if (req.body && typeof req.body === 'object') {
        barcode = req.body.barcode || req.body.upc || '';
      } else {
        const chunks: any[] = [];
        for await (const chunk of req) {
          chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
        }
        const rawBody = Buffer.concat(chunks).toString('utf-8');
        if (rawBody) {
          try {
            const parsed = JSON.parse(rawBody);
            barcode = parsed.barcode || parsed.upc || '';
          } catch {
            return sendResponse(400, { error: 'Invalid JSON body' });
          }
        }
      }
    } else {
      try {
        const body = await req.json();
        barcode = body?.barcode || body?.upc || '';
      } catch {
        return sendResponse(400, { error: 'Invalid JSON body' });
      }
    }
  } else {
    return sendResponse(405, { error: 'Method not allowed' });
  }

  const cleanBarcode = barcode.trim();
  if (!cleanBarcode) {
    return sendResponse(400, { error: 'Barcode parameter is required' });
  }

  try {
    const product = await lookupUpcItemDbServer(cleanBarcode);
    return sendResponse(200, { product });
  } catch (err: unknown) {
    const msg = (err as Error)?.message || 'UPCitemdb server lookup error';
    const isValidation = msg.includes('barcode') || msg.includes('check digit');
    return sendResponse(isValidation ? 400 : 502, { error: msg });
  }
}
