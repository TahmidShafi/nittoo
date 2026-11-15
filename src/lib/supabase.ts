// ==============================================================================
// Nittoo Supabase Client Initialization
// Safe initialization with fallback check for placeholder/missing environment variables
// Supports both Vite (import.meta.env) and Node.js testing (process.env)
// ==============================================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const metaEnv = typeof import.meta !== 'undefined'
  ? (import.meta as unknown as { env?: Record<string, string | undefined> }).env
  : undefined;
const viteUrl = metaEnv?.VITE_SUPABASE_URL;
const viteKey = metaEnv?.VITE_SUPABASE_ANON_KEY;

const nodeUrl = typeof process !== 'undefined' && process.env ? process.env.VITE_SUPABASE_URL : undefined;
const nodeKey = typeof process !== 'undefined' && process.env ? process.env.VITE_SUPABASE_ANON_KEY : undefined;

const rawUrl = (viteUrl || nodeUrl || '').trim();
const rawKey = (viteKey || nodeKey || '').trim();

/**
 * Returns true only if valid non-placeholder Supabase credentials exist.
 */
export const isSupabaseConfigured = Boolean(
  rawUrl &&
  rawKey &&
  !rawUrl.includes('YOUR_SUPABASE_URL') &&
  !rawKey.includes('YOUR_SUPABASE_ANON_KEY') &&
  (rawUrl.startsWith('https://') || rawUrl.startsWith('http://'))
);

/**
 * Singleton Supabase client instance, or null if unconfigured.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(rawUrl, rawKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;
