// ==============================================================================
// Nittoo Data Source Selector
// Single Source of Truth for Database Access Across Entire Application
// Automatically routes to mockDb or realDb based on Supabase credentials
// ==============================================================================

import type { IDataSource } from '../types';
import { isSupabaseConfigured } from './supabase';
import { mockDb } from './mock-db';
import { realDb } from './db';

/**
 * Flag indicating whether the application is running in dev mock mode
 */
export const isMockMode = !isSupabaseConfigured;

/**
 * Singleton database client instance conforming to IDataSource.
 * All UI pages, components, and hooks must access data exclusively through this object.
 */
export const db: IDataSource = isSupabaseConfigured ? realDb : mockDb;

export { isSupabaseConfigured };
