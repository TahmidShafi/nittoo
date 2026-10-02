// ==============================================================================
// Nittoo Server-side Barcode Lookup Handler
// Server-side proxy for UPCitemdb to avoid browser CORS restrictions
// ==============================================================================

import type { IncomingMessage, ServerResponse } from 'http';
import { validateBarcode } from '../lib/discovery/barcode';
import {
  normalizeUpcItemDbProducts,
  fetchWithTimeout,
  DEFAULT_PROVIDER_TIMEOUT_MS,
  type RawUpcItemDbResponse,
} from '../lib/discovery/provider';
import type { DiscoveryProduct } from '../lib/discovery/types';

const UPCITEMDB_BASE_URL = 'https://api.upcitemdb.com/prod/trial/lookup';

/**
 * Server-side lookup for UPCitemdb.
 * Enforces GS1 check digit validation, 7-second timeout, and safe normalization.
 * Credentials (if configured) remain strictly server-side.
 */
export async function lookupUpcItemDbServer(
  barcode: string,
  options?: { timeoutMs?: number; signal?: AbortSignal }
): Promise<DiscoveryProduct | null> {
  // 1. Strict validation & normalization
  const validation = validateBarcode(barcode);
  if (!validation.valid || !validation.normalized) {
    throw new Error(validation.error || 'Invalid barcode format');
  }

  const canonicalBarcode = validation.normalized;
  const timeoutMs = options?.timeoutMs || DEFAULT_PROVIDER_TIMEOUT_MS;

  // 2. Prepare headers (support server-side API key if provided in environment)
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  const apiKey = typeof process !== 'undefined' ? process.env?.UPCITEMDB_API_KEY : undefined;
  if (apiKey) {
    headers['user_key'] = apiKey;
    headers['key_type'] = '3';
  }

  // Helper to fetch from UPCitemdb server-side
  const queryUpc = async (code: string): Promise<RawUpcItemDbResponse | null> => {
    const url = `${UPCITEMDB_BASE_URL}?upc=${encodeURIComponent(code)}`;
    const response = await fetchWithTimeout(fetch, url, {
      method: 'GET',
      headers,
      signal: options?.signal,
    }, timeoutMs);

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`UPCitemdb server fetch failed with status ${response.status}`);
    }

    const data = (await response.json()) as RawUpcItemDbResponse;
    return data;
  };

  // 3. Query UPCitemdb with canonical barcode
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

  // 4. Safely normalize and return only the fields Nittoo needs
  const normalized = normalizeUpcItemDbProducts(data.items, 'upcitemdb', canonicalBarcode);
  return normalized[0] || null;
}

/**
 * Universal HTTP request handler for both Vercel Serverless Functions and Vite Dev Server middleware.
 */
export async function handleBarcodeApiRequest(
  req: IncomingMessage & { body?: any; query?: any },
  res: ServerResponse
): Promise<void> {
  // Set CORS headers for safe local/preview access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  let barcode = '';

  if (req.method === 'GET') {
    const parsedUrl = new URL(req.url || '', 'http://localhost');
    barcode = parsedUrl.searchParams.get('barcode') || (req.query?.barcode as string) || '';
  } else if (req.method === 'POST') {
    if (req.body && typeof req.body === 'object') {
      barcode = req.body.barcode || '';
    } else {
      // Buffer request stream
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
      const rawBody = Buffer.concat(chunks).toString('utf-8');
      if (rawBody) {
        try {
          const parsed = JSON.parse(rawBody);
          barcode = parsed.barcode || '';
        } catch {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Invalid JSON body' }));
          return;
        }
      }
    }
  } else {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const cleanBarcode = barcode.trim();
  if (!cleanBarcode) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Barcode parameter is required' }));
    return;
  }

  try {
    const product = await lookupUpcItemDbServer(cleanBarcode);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ product }));
  } catch (err: unknown) {
    const msg = (err as Error)?.message || 'UPCitemdb server lookup error';
    const isValidation = msg.includes('barcode') || msg.includes('check digit');
    res.statusCode = isValidation ? 400 : 502;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: msg }));
  }
}

export default handleBarcodeApiRequest;
