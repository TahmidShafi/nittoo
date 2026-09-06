// ==============================================================================
// Nittoo Supabase Client Initialization
// Safe initialization with fallback check for placeholder/missing environment variables
// Supports both Vite (import.meta.env) and Node.js testing (process.env)
// ==============================================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const getEnvVar = (key: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key] as string;
  }
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key] as string;
  }
  return '';
};

const rawUrl = getEnvVar('VITE_SUPABASE_URL').trim();
const rawKey = getEnvVar('VITE_SUPABASE_ANON_KEY').trim();

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
