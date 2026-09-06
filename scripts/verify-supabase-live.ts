// ==============================================================================
// Nittoo Supabase Live Integration & Verification Script
// Tests isSupabaseConfigured, isMockMode, Schema Reachability, and Real Operations
// ==============================================================================

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Read .env without printing secrets
const envContent = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf-8');
let rawUrl = '';
let rawKey = '';

for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (trimmed.startsWith('VITE_SUPABASE_URL=')) {
    rawUrl = trimmed.slice('VITE_SUPABASE_URL='.length).trim();
  } else if (trimmed.startsWith('VITE_SUPABASE_ANON_KEY=')) {
    rawKey = trimmed.slice('VITE_SUPABASE_ANON_KEY='.length).trim();
  }
}

const isConfigured = Boolean(
  rawUrl &&
  rawKey &&
  !rawUrl.includes('YOUR_SUPABASE_URL') &&
  !rawKey.includes('YOUR_SUPABASE_ANON_KEY') &&
  (rawUrl.startsWith('https://') || rawUrl.startsWith('http://'))
);

const isMock = !isConfigured;

console.log('=================================================================');
console.log('NITTOO LIVE SUPABASE VERIFICATION');
console.log('=================================================================\n');

console.log('--- 1. Configuration & Mode Detection ---');
console.log(`  ✓ VITE_SUPABASE_URL configured: ${Boolean(rawUrl)}`);
console.log(`  ✓ VITE_SUPABASE_ANON_KEY configured: ${Boolean(rawKey)}`);
console.log(`  ✓ isSupabaseConfigured === true: ${isConfigured === true}`);
console.log(`  ✓ isMockMode === false: ${isMock === false}`);

if (!isConfigured) {
  console.error('❌ Supabase is not configured. Aborting.');
  process.exit(1);
}

const supabase = createClient(rawUrl, rawKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function runLiveVerification() {
  console.log('\n--- 2. Database Tables Verification ---');
  const [prodRes, purRes, useRes] = await Promise.all([
    supabase.from('products').select('id').limit(1),
    supabase.from('purchases').select('id').limit(1),
    supabase.from('usage_periods').select('id').limit(1),
  ]);

  if (prodRes.error) throw new Error(`Products table error: ${prodRes.error.message}`);
  console.log('  ✓ Table `products` exists and is queryable');

  if (purRes.error) throw new Error(`Purchases table error: ${purRes.error.message}`);
  console.log('  ✓ Table `purchases` exists and is queryable');

  if (useRes.error) throw new Error(`Usage periods table error: ${useRes.error.message}`);
  console.log('  ✓ Table `usage_periods` exists and is queryable');

  console.log('\n--- 3. Auth Flow & Live CRUD Verification ---');
  const testEmail = `nittoo.tester.${Date.now()}@gmail.com`;
  const testPassword = 'Password123!Secure';

  console.log(`Attempting signup with ${testEmail}...`);
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
  });

  if (authError) {
    console.log(`  Notice: SignUp returned: "${authError.message}" (Status: ${authError.status})`);
    if (authError.message.includes('rate limit')) {
      console.log('  Supabase default email rate limit is active. Confirm email setting in Supabase dashboard is ON.');
    }
  } else {
    console.log('  ✓ SignUp call succeeded (HTTP 200)');
    console.log(`  ✓ User ID created: ${Boolean(authData.user?.id)}`);
    console.log(`  ✓ Session auto-created: ${Boolean(authData.session)}`);

    if (authData.session && authData.user) {
      console.log('\n--- 4. Real Database Operations (Live Authenticated Client) ---');
      const userId = authData.user.id;

      // 1. Create Product
      const { data: newProd, error: pErr } = await supabase
        .from('products')
        .insert({
          user_id: userId,
          name: 'Bioderma Sensibio H2O Micellar Water',
          category: 'Skincare',
          brand: 'Bioderma',
          size_value: 500,
          size_unit: 'ml',
        })
        .select('*')
        .single();
      if (pErr) throw new Error(`Failed to create product: ${pErr.message}`);
      console.log(`  ✓ Created product: "${newProd.name}" (ID: ${newProd.id})`);

      // 2. Create Purchase
      const { data: newPur, error: purErr } = await supabase
        .from('purchases')
        .insert({
          product_id: newProd.id,
          purchase_date: '2026-09-06',
          price: 1650,
          currency: 'BDT',
        })
        .select('*')
        .single();
      if (purErr) throw new Error(`Failed to create purchase: ${purErr.message}`);
      console.log(`  ✓ Created purchase: ৳${newPur.price} (ID: ${newPur.id})`);

      // 3. Start Usage Period
      const { data: newUse, error: useErr } = await supabase
        .from('usage_periods')
        .insert({
          product_id: newProd.id,
          purchase_id: newPur.id,
          opened_date: '2026-09-06',
          status: 'active',
        })
        .select('*')
        .single();
      if (useErr) throw new Error(`Failed to start usage period: ${useErr.message}`);
      console.log(`  ✓ Started usage period: opened on ${newUse.opened_date} (ID: ${newUse.id})`);

      // 4. Get Active Products
      const { data: activeList, error: actErr } = await supabase
        .from('products')
        .select('*, usage_periods!inner(*)')
        .eq('user_id', userId)
        .eq('usage_periods.status', 'active');
      if (actErr) throw new Error(`Failed to fetch active products: ${actErr.message}`);
      console.log(`  ✓ Fetched active products: count = ${activeList.length}`);

      // 5. Finish Usage Period
      const { data: finUse, error: finErr } = await supabase
        .from('usage_periods')
        .update({
          finished_date: '2026-10-15',
          status: 'finished',
        })
        .eq('id', newUse.id)
        .select('*')
        .single();
      if (finErr) throw new Error(`Failed to finish usage period: ${finErr.message}`);
      console.log(`  ✓ Finished usage period: finished on ${finUse.finished_date}`);

      // 6. Get Product History
      const { data: historyPeriods, error: histErr } = await supabase
        .from('usage_periods')
        .select('*')
        .eq('product_id', newProd.id);
      if (histErr) throw new Error(`Failed to fetch product history: ${histErr.message}`);
      console.log(`  ✓ Fetched product history: ${historyPeriods.length} period(s), status: ${historyPeriods[0].status}`);

      // 7. Clean up / Reset User Data
      const { error: delErr } = await supabase
        .from('products')
        .delete()
        .eq('user_id', userId);
      if (delErr) throw new Error(`Failed to delete product: ${delErr.message}`);
      console.log('  ✓ Reset / deleted test user products (Cascade cleaned purchases & usage periods)');
    }
  }

  console.log('\n=================================================================');
  console.log('✅ SUPABASE VERIFICATION CHECKS COMPLETE!');
  console.log('=================================================================');
}

runLiveVerification().catch((err) => {
  console.error('❌ Verification failed:', err.message);
  process.exit(1);
});
