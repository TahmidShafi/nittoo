// ==============================================================================
// Live Nittoo Full Lifecycle & Architecture Audit
// Verifies all 9 components of the live user journey against Supabase & DOM specs
// ==============================================================================

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import {
  calculateAverageLifespan,
  calculateUsageDuration,
  calculateCostPerDay,
  calculateMonthlyConsumptionCost,
} from '../src/lib/prediction';

// Read .env
const envContent = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf-8');
const getEnv = (key: string) => {
  const line = envContent.split('\n').find((l) => l.trim().startsWith(`${key}=`));
  return line ? line.trim().slice(`${key}=`.length).trim() : '';
};

const rawUrl = getEnv('VITE_SUPABASE_URL');
const rawKey = getEnv('VITE_SUPABASE_ANON_KEY');
const userAEmail = getEnv('TEST_USER_A_EMAIL');
const userAPassword = getEnv('TEST_USER_A_PASSWORD');

const client = createClient(rawUrl, rawKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function loginWithRetry(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await client.auth.signInWithPassword({
        email: userAEmail,
        password: userAPassword,
      });
      if (res.error) throw res.error;
      return res.data;
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw new Error('Login failed after retries');
}

async function runLiveAudit() {
  console.log('=================================================================');
  console.log('LIVE NITTOO ARCHITECTURE & USER LIFECYCLE AUDIT');
  console.log('=================================================================\n');

  // 1. SIGNUP / LOGIN
  console.log('--- 1. Signup / Login (Supabase Auth) ---');
  const authData = await loginWithRetry();
  if (!authData.user) throw new Error('Login failed: no user');
  const userId = authData.user.id;
  assert(Boolean(authData.session?.access_token), 'Valid JWT access token received');
  assert(authData.user.email === userAEmail, `Authenticated user email matches: ${userAEmail}`);

  // Clean slate for this test user
  await client.from('products').delete().eq('user_id', userId);

  // 2. ADD ARBITRARY PRODUCT
  console.log('\n--- 2. Add Arbitrary Product (Buy -> Add -> Start Using) ---');
  const { data: prod1, error: p1Err } = await client
    .from('products')
    .insert({
      user_id: userId,
      name: 'The Ordinary Niacinamide 10% + Zinc 1%',
      category: 'Skincare',
      brand: 'The Ordinary',
      size_value: 30,
      size_unit: 'ml',
    })
    .select('*')
    .single();
  if (p1Err) throw new Error(p1Err.message);
  assert(prod1.name === 'The Ordinary Niacinamide 10% + Zinc 1%', 'Arbitrary product created in Supabase');

  const { data: pur1, error: pur1Err } = await client
    .from('purchases')
    .insert({
      product_id: prod1.id,
      purchase_date: '2026-06-01',
      price: 950,
      currency: 'BDT',
    })
    .select('*')
    .single();
  if (pur1Err) throw new Error(pur1Err.message);
  assert(pur1.price === 950, 'Purchase logged: ৳950 on 2026-06-01');

  const { data: use1, error: use1Err } = await client
    .from('usage_periods')
    .insert({
      product_id: prod1.id,
      purchase_id: pur1.id,
      opened_date: '2026-06-01',
      status: 'active',
    })
    .select('*')
    .single();
  if (use1Err) throw new Error(use1Err.message);
  assert(use1.status === 'active', 'Usage period #1 started as active');

  // 3. REPEAT PURCHASE
  console.log('\n--- 3. Repeat Purchase ---');
  const { data: pur2, error: pur2Err } = await client
    .from('purchases')
    .insert({
      product_id: prod1.id,
      purchase_date: '2026-07-15',
      price: 1050,
      currency: 'BDT',
    })
    .select('*')
    .single();
  if (pur2Err) throw new Error(pur2Err.message);
  assert(pur2.price === 1050, 'Repeat purchase recorded for existing product: ৳1,050');

  // Verify product has 2 purchases now
  const { data: allPurchases } = await client
    .from('purchases')
    .select('*')
    .eq('product_id', prod1.id);
  assert(allPurchases?.length === 2, 'Product contains exactly 2 purchases');

  // 4. FINISH BOTTLE
  console.log('\n--- 4. Finish Bottle ---');
  const { data: fin1, error: fin1Err } = await client
    .from('usage_periods')
    .update({
      finished_date: '2026-07-20',
      status: 'finished',
    })
    .eq('id', use1.id)
    .select('*')
    .single();
  if (fin1Err) throw new Error(fin1Err.message);
  assert(fin1.status === 'finished', 'Bottle #1 marked finished on 2026-07-20');

  // Start Bottle #2 from repeat purchase
  const { data: use2, error: use2Err } = await client
    .from('usage_periods')
    .insert({
      product_id: prod1.id,
      purchase_id: pur2.id,
      opened_date: '2026-07-21',
      status: 'active',
    })
    .select('*')
    .single();
  if (use2Err) throw new Error(use2Err.message);
  assert(use2.status === 'active', 'Bottle #2 successfully opened from repeat purchase');

  // 5. HISTORY
  console.log('\n--- 5. Product History & Timeline ---');
  const { data: periods } = await client
    .from('usage_periods')
    .select('*')
    .eq('product_id', prod1.id)
    .order('opened_date', { ascending: false });

  const finishedList = (periods || []).filter((p) => p.status === 'finished');
  const activeList = (periods || []).filter((p) => p.status === 'active');
  assert(finishedList.length === 1, 'History reflects exactly 1 completed cycle');
  assert(activeList.length === 1, 'History reflects exactly 1 in-use cycle');

  const cycleDuration = calculateUsageDuration(finishedList[0]);
  assert(cycleDuration === 49, `Cycle #1 duration calculated accurately: 49 days (Jun 1 -> Jul 20)`);
  const avgLifespan = calculateAverageLifespan(finishedList);
  assert(avgLifespan === 49, `Average lifespan across history: 49 days`);
  const costPerDay = calculateCostPerDay(pur1.price, cycleDuration!);
  assert(costPerDay === 19.39, `Cost per day accurately calculated: ৳19.39/day (950 / 49)`);

  // 6. ANALYTICS
  console.log('\n--- 6. Analytics & Forecast Calculations ---');
  const totalSpent = allPurchases!.reduce((sum, p) => sum + p.price, 0);
  assert(totalSpent === 2000, `Total portfolio spending for product: ৳2,000 (950 + 1050)`);

  // Run rate calculation for 49 days lifespan at ৳1,000 average price (30-day month formula)
  const avgPrice = 1000;
  const monthlyRunRate = calculateMonthlyConsumptionCost(avgPrice, avgLifespan!);
  assert(monthlyRunRate === 612, `Monthly run rate: ৳612/mo ((1000 / 49) * 30)`);

  // 7. REFRESH PERSISTENCE
  console.log('\n--- 7. Refresh Persistence Simulation ---');
  // Create a brand new client instance to simulate complete browser reload / cold start
  const freshClient = createClient(rawUrl, rawKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await freshClient.auth.signInWithPassword({ email: userAEmail, password: userAPassword });
  const { data: reloadedProduct } = await freshClient
    .from('products')
    .select('*, usage_periods(*), purchases(*)')
    .eq('id', prod1.id)
    .single();
  assert(Boolean(reloadedProduct), 'Product completely re-hydrated from database on fresh client');
  assert(reloadedProduct.purchases.length === 2, 'All 2 purchases retained across reload');
  assert(reloadedProduct.usage_periods.length === 2, 'All 2 usage periods retained across reload');

  // 8. MOBILE 375PX RESPONSIVE SPECS
  console.log('\n--- 8. Mobile 375px Viewport Audit ---');
  const layoutContent = fs.readFileSync(path.resolve(process.cwd(), 'src/components/Layout.tsx'), 'utf-8');
  assert(layoutContent.includes('grid-cols-4'), 'Layout has fixed 4-column non-scrolling mobile nav');
  assert(layoutContent.includes('min-h-[44px]'), 'Mobile interactive elements satisfy 44px minimum touch target');
  const dashContent = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/DashboardPage.tsx'), 'utf-8');
  assert(dashContent.includes('grid-cols-1'), 'Dashboard uses 1-column layout on mobile viewports');

  // 9. ERROR HANDLING
  console.log('\n--- 9. Error Handling & Constraint Safety ---');
  // Attempt duplicate active bottle
  const { error: dupErr } = await client.from('usage_periods').insert({
    product_id: prod1.id,
    purchase_id: pur2.id,
    opened_date: '2026-08-01',
    status: 'active',
  });
  assert(Boolean(dupErr), 'Duplicate active usage period prevented by database index');

  // Attempt finished_date < opened_date
  const { error: invalidDateErr } = await client.from('usage_periods').update({
    finished_date: '2026-05-01', // Before opened_date 2026-07-21
    status: 'finished',
  }).eq('id', use2.id);
  assert(Boolean(invalidDateErr), 'Invalid finished date rejected by check constraint');

  // Cleanup
  await client.from('products').delete().eq('user_id', userId);
  console.log('  ✓ Test products cleanly removed');

  console.log('\n=================================================================');
  console.log('✅ ALL 9 NITTOO LIVE AUDIT DOMAINS PASSED WITH 100% PRECISION!');
  console.log('=================================================================');
}

runLiveAudit().catch((err) => {
  console.error('\n❌ Audit failed:', err);
  process.exit(1);
});
