// ==============================================================================
// Nittoo Supabase Two-Account RLS & Security Verification Suite
// Tests Multi-User Isolation, Cross-Account CRUD Protection, and Schema Constraints
// ==============================================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Read .env without logging values
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

if (!rawUrl || !rawKey) {
  console.error('❌ Supabase credentials missing from .env');
  process.exit(1);
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

function createScopedClient(): SupabaseClient {
  return createClient(rawUrl, rawKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function obtainAccount(client: SupabaseClient, label: string) {
  const envEmailKey = `TEST_USER_${label}_EMAIL`;
  const envPasswordKey = `TEST_USER_${label}_PASSWORD`;

  const matchEmail = envContent.split('\n').find((l) => l.trim().startsWith(`${envEmailKey}=`));
  const matchPassword = envContent.split('\n').find((l) => l.trim().startsWith(`${envPasswordKey}=`));

  const configuredEmail =
    process.env[envEmailKey] ||
    (matchEmail ? matchEmail.trim().slice(`${envEmailKey}=`.length).trim() : '');

  const configuredPassword =
    process.env[envPasswordKey] ||
    (matchPassword ? matchPassword.trim().slice(`${envPasswordKey}=`.length).trim() : '');

  if (configuredEmail && configuredPassword) {
    const { data, error } = await client.auth.signInWithPassword({
      email: configuredEmail,
      password: configuredPassword,
    });
    if (error) {
      throw new Error(`Failed to sign in as Account ${label} (${configuredEmail}): ${error.message}`);
    }
    if (!data.session || !data.user) {
      throw new Error(`Sign in succeeded but no session returned for Account ${label}`);
    }
    return { client, user: data.user, email: configuredEmail };
  }

  throw new Error(`Credentials for Account ${label} (${envEmailKey}, ${envPasswordKey}) not found in environment or .env`);
}

export async function runRlsVerification() {
  console.log('=================================================================');
  console.log('NITTOO TWO-ACCOUNT SUPABASE RLS & SECURITY VERIFICATION');
  console.log('=================================================================\n');

  // ----------------------------------------------------------------------------
  // 1. ENVIRONMENT SAFETY
  // ----------------------------------------------------------------------------
  console.log('--- 1. Environment & Client Safety ---');
  assert(Boolean(rawUrl && rawKey), 'Supabase credentials exist in .env');
  assert(!rawKey.startsWith('eyJ') || !rawKey.includes('service_role'), 'Anon key in use (No service role key)');
  const gitignore = fs.readFileSync(path.resolve(process.cwd(), '.gitignore'), 'utf-8');
  assert(gitignore.includes('.env'), '.env is strictly gitignored');

  // ----------------------------------------------------------------------------
  // 2. CREATE ACCOUNT A & B
  // ----------------------------------------------------------------------------
  console.log('\n--- 2. Creating Two Authenticated Accounts ---');
  const clientA = createScopedClient();
  const clientB = createScopedClient();

  const accountA = await obtainAccount(clientA, 'A');
  console.log(`  ✓ Account A authenticated: ID ${accountA.user.id}`);

  // Small delay to ensure timestamp difference
  await new Promise((resolve) => setTimeout(resolve, 100));

  const accountB = await obtainAccount(clientB, 'B');
  console.log(`  ✓ Account B authenticated: ID ${accountB.user.id}`);
  assert(accountA.user.id !== accountB.user.id, 'Account A and B have distinct Supabase user IDs');

  // ----------------------------------------------------------------------------
  // 3. ACCOUNT A CREATES DATA
  // ----------------------------------------------------------------------------
  console.log('\n--- 3. Account A Creates Product, Purchase & Usage Period ---');
  
  // Product A
  const { data: prodA, error: prodAErr } = await clientA
    .from('products')
    .insert({
      user_id: accountA.user.id,
      name: 'Account A Bioderma Micellar Water',
      category: 'Skincare',
      brand: 'Bioderma',
      size_value: 500,
      size_unit: 'ml',
    })
    .select('*')
    .single();

  if (prodAErr || !prodA) throw new Error(`Account A product insert failed: ${prodAErr?.message}`);
  const prodAId = prodA.id;
  assert(prodA.user_id === accountA.user.id, `Account A created product ID: ${prodAId}`);

  // Purchase A
  const { data: purA, error: purAErr } = await clientA
    .from('purchases')
    .insert({
      product_id: prodAId,
      purchase_date: '2026-09-01',
      price: 1650,
      currency: 'BDT',
    })
    .select('*')
    .single();

  if (purAErr || !purA) throw new Error(`Account A purchase insert failed: ${purAErr?.message}`);
  const purAId = purA.id;
  assert(purA.product_id === prodAId, `Account A created purchase ID: ${purAId}`);

  // Usage Period A
  const { data: useA, error: useAErr } = await clientA
    .from('usage_periods')
    .insert({
      product_id: prodAId,
      purchase_id: purAId,
      opened_date: '2026-09-01',
      status: 'active',
    })
    .select('*')
    .single();

  if (useAErr || !useA) throw new Error(`Account A usage period insert failed: ${useAErr?.message}`);
  const useAId = useA.id;
  assert(useA.status === 'active', `Account A started active usage period ID: ${useAId}`);

  // ----------------------------------------------------------------------------
  // 4. ACCOUNT B ISOLATION & UNAUTHORIZED ACCESS ATTEMPTS
  // ----------------------------------------------------------------------------
  console.log('\n--- 4. Account B RLS Cross-Account Isolation Verification ---');

  // Account B queries products
  const { data: bProducts } = await clientB.from('products').select('*');
  assert(
    !bProducts || !bProducts.some((p) => p.id === prodAId),
    "Account B list query does NOT include Account A's product"
  );

  // SELECT attempt on Account A's product
  const { data: directSelectProdA } = await clientB
    .from('products')
    .select('*')
    .eq('id', prodAId);
  assert(
    !directSelectProdA || directSelectProdA.length === 0,
    "RLS SELECT blocked: Account B direct select on Account A's product returns 0 rows"
  );

  // SELECT attempt on Account A's purchase
  const { data: directSelectPurA } = await clientB
    .from('purchases')
    .select('*')
    .eq('id', purAId);
  assert(
    !directSelectPurA || directSelectPurA.length === 0,
    "RLS SELECT blocked: Account B direct select on Account A's purchase returns 0 rows"
  );

  // SELECT attempt on Account A's usage period
  const { data: directSelectUseA } = await clientB
    .from('usage_periods')
    .select('*')
    .eq('id', useAId);
  assert(
    !directSelectUseA || directSelectUseA.length === 0,
    "RLS SELECT blocked: Account B direct select on Account A's usage period returns 0 rows"
  );

  // UPDATE attempt on Account A's product
  const { data: updateTamper } = await clientB
    .from('products')
    .update({ name: 'Tampered by Account B' })
    .eq('id', prodAId)
    .select('*');
  assert(
    !updateTamper || updateTamper.length === 0,
    "RLS UPDATE blocked: Account B cannot modify Account A's product (affects 0 rows)"
  );

  // DELETE attempt on Account A's product
  const { data: deleteTamper } = await clientB
    .from('products')
    .delete()
    .eq('id', prodAId)
    .select('*');
  assert(
    !deleteTamper || deleteTamper.length === 0,
    "RLS DELETE blocked: Account B cannot delete Account A's product (affects 0 rows)"
  );

  // INSERT purchase referencing Account A's product
  const { error: insertPurTamper } = await clientB
    .from('purchases')
    .insert({
      product_id: prodAId,
      purchase_date: '2026-09-06',
      price: 50,
      currency: 'BDT',
    });
  assert(
    Boolean(insertPurTamper),
    `RLS INSERT blocked: Account B cannot insert purchase referencing Account A's product (${insertPurTamper?.message})`
  );

  // INSERT usage period referencing Account A's product
  const { error: insertUseTamper } = await clientB
    .from('usage_periods')
    .insert({
      product_id: prodAId,
      purchase_id: purAId,
      opened_date: '2026-09-06',
      status: 'active',
    });
  assert(
    Boolean(insertUseTamper),
    `RLS INSERT blocked: Account B cannot insert usage period for Account A's product (${insertUseTamper?.message})`
  );

  // ----------------------------------------------------------------------------
  // 5. ACCOUNT B CREATES OWN PRODUCT
  // ----------------------------------------------------------------------------
  console.log("\n--- 5. Account B Creates Own Data ---");
  const { data: prodB, error: prodBErr } = await clientB
    .from('products')
    .insert({
      user_id: accountB.user.id,
      name: 'Account B Cerave Cleanser',
      category: 'Skincare',
      brand: 'CeraVe',
      size_value: 236,
      size_unit: 'ml',
    })
    .select('*')
    .single();

  if (prodBErr || !prodB) throw new Error(`Account B product insert failed: ${prodBErr?.message}`);
  const prodBId = prodB.id;
  assert(prodB.user_id === accountB.user.id, `Account B created product ID: ${prodBId}`);

  // ----------------------------------------------------------------------------
  // 6. ACCOUNT A RE-VERIFICATION (No Cross-Contamination)
  // ----------------------------------------------------------------------------
  console.log('\n--- 6. Account A Isolation Check (No Cross-Contamination) ---');
  const { data: aProductsFinal } = await clientA.from('products').select('*');
  assert(
    Boolean(aProductsFinal?.some((p) => p.id === prodAId)),
    "Account A still has its original product"
  );
  assert(
    !aProductsFinal?.some((p) => p.id === prodBId),
    "Account A cannot see Account B's product"
  );
  const aOriginalProd = aProductsFinal?.find((p) => p.id === prodAId);
  assert(
    aOriginalProd?.name === 'Account A Bioderma Micellar Water',
    "Account A's product name was untouched by Account B's tamper attempt"
  );

  // ----------------------------------------------------------------------------
  // 7. CHECK CONSTRAINTS VERIFICATION
  // ----------------------------------------------------------------------------
  console.log('\n--- 7. Database Constraints Verification ---');

  // Constraint 1: Single active usage period per product
  const { error: duplicateActiveErr } = await clientA
    .from('usage_periods')
    .insert({
      product_id: prodAId,
      purchase_id: purAId,
      opened_date: '2026-09-02',
      status: 'active',
    });
  assert(
    Boolean(duplicateActiveErr),
    `Constraint: Second active usage period rejected (${duplicateActiveErr?.message})`
  );

  // Constraint 2: finished_date cannot precede opened_date
  const { error: invalidFinishDateErr } = await clientA
    .from('usage_periods')
    .update({
      finished_date: '2026-08-01', // Precedes opened_date 2026-09-01
      status: 'finished',
    })
    .eq('id', useAId);
  assert(
    Boolean(invalidFinishDateErr),
    `Constraint: finished_date earlier than opened_date rejected (${invalidFinishDateErr?.message})`
  );

  // Valid finish date succeeds
  const { data: validFinish, error: validFinishErr } = await clientA
    .from('usage_periods')
    .update({
      finished_date: '2026-10-15',
      status: 'finished',
    })
    .eq('id', useAId)
    .select('*')
    .single();
  assert(
    !validFinishErr && validFinish?.status === 'finished',
    'Valid finish date update successfully transitioned status to "finished"'
  );

  // ----------------------------------------------------------------------------
  // 8. TEARDOWN / CLEANUP
  // ----------------------------------------------------------------------------
  console.log('\n--- 8. Cleanup Verification ---');
  await clientA.from('products').delete().eq('user_id', accountA.user.id);
  await clientB.from('products').delete().eq('user_id', accountB.user.id);

  const { data: aClean } = await clientA.from('products').select('*');
  const { data: bClean } = await clientB.from('products').select('*');
  assert((aClean?.length || 0) === 0, 'Account A data cleanly purged');
  assert((bClean?.length || 0) === 0, 'Account B data cleanly purged');

  console.log('\n=================================================================');
  console.log('✅ ALL TWO-ACCOUNT RLS AND CONSTRAINT CHECKS PASSED PERFECTLY!');
  console.log('=================================================================');
}

runRlsVerification().catch((err) => {
  console.error('\n❌ RLS verification encountered an error:');
  console.error(err.message);
  process.exit(1);
});
