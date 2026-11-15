// ==============================================================================
// Nittoo Shared Server-Side Barcode Core (Edge & Node compatible)
// Pure validation, CORS origin filtering, Supabase JWT verification, and UPCitemdb lookup
// ==============================================================================

import { validateBarcode } from '../lib/discovery/barcode';
import {
  normalizeUpcItemDbProducts,
  fetchWithTimeout,
  DEFAULT_PROVIDER_TIMEOUT_MS,
  type RawUpcItemDbResponse,
} from '../lib/discovery/provider';
import type { DiscoveryProduct } from '../lib/discovery/types';

const UPCITEMDB_BASE_URL = 'https://api.upcitemdb.com/prod/trial/lookup';
const DEFAULT_PRODUCTION_ORIGIN = 'https://nittoo.vercel.app';

export function isAllowedOrigin(
  origin: string | null | undefined,
  allowedProductionOrigin: string = DEFAULT_PRODUCTION_ORIGIN
): boolean {
  if (!origin) return false;
  if (origin === allowedProductionOrigin) return true;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
    return true;
  }
  return false;
}

export function getCorsHeaders(
  origin?: string | null,
  allowedProductionOrigin: string = DEFAULT_PRODUCTION_ORIGIN
): Record<string, string> {
  const allowed = isAllowedOrigin(origin, allowedProductionOrigin)
    ? (origin as string)
    : allowedProductionOrigin;

  return {
    'Access-Control-Allow-Origin': allowed,
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization',
  };
}

export async function verifySupabaseAccessToken(
  authHeader: string | null | undefined,
  supabaseUrl?: string,
  supabaseAnonKey?: string
): Promise<{ valid: boolean; userId?: string; error?: string }> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Authorization Bearer token is required.' };
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return { valid: false, error: 'Authorization Bearer token is empty.' };
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return { valid: false, error: 'Supabase verification environment is not configured.' };
  }

  try {
    const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
      method: 'GET',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      return { valid: false, error: 'Invalid or expired Supabase session token.' };
    }

    const user = (await res.json()) as { id?: string } | null;
    if (!user?.id) {
      return { valid: false, error: 'Authenticated user ID missing.' };
    }

    return { valid: true, userId: user.id };
  } catch {
    return { valid: false, error: 'Failed to verify Supabase access token.' };
  }
}

export async function lookupUpcItemDbServer(
  barcode: string,
  options?: { timeoutMs?: number; signal?: AbortSignal; apiKey?: string }
): Promise<DiscoveryProduct | null> {
  const validation = validateBarcode(barcode);
  if (!validation.valid || !validation.normalized) {
    throw new Error(validation.error || 'Invalid barcode format');
  }

  const canonicalBarcode = validation.normalized;
  const timeoutMs = options?.timeoutMs || DEFAULT_PROVIDER_TIMEOUT_MS;

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (options?.apiKey) {
    headers['user_key'] = options.apiKey;
    headers['key_type'] = '3';
  }

  const queryUpc = async (code: string): Promise<RawUpcItemDbResponse | null> => {
    const url = `${UPCITEMDB_BASE_URL}?upc=${encodeURIComponent(code)}`;
    const response = await fetchWithTimeout(
      fetch,
      url,
      {
        method: 'GET',
        headers,
        signal: options?.signal,
      },
      timeoutMs
    );

    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`UPCitemdb server fetch failed with status ${response.status}`);
    }
    return (await response.json()) as RawUpcItemDbResponse;
  };

  let data = await queryUpc(canonicalBarcode);

  if (
    (!data || data.total === 0 || !data.items || data.items.length === 0) &&
    canonicalBarcode.length === 13 &&
    canonicalBarcode.startsWith('0')
  ) {
    const upc12 = canonicalBarcode.slice(1);
    const fallbackData = await queryUpc(upc12);
    if (
      fallbackData &&
      fallbackData.total &&
      fallbackData.total > 0 &&
      fallbackData.items &&
      fallbackData.items.length > 0
    ) {
      data = fallbackData;
    }
  }

  if (!data || data.total === 0 || !data.items || data.items.length === 0) {
    return null;
  }

  const normalized = normalizeUpcItemDbProducts(data.items, 'upcitemdb', canonicalBarcode);
  return normalized[0] || null;
}
