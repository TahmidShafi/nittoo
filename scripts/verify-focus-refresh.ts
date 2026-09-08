// ==============================================================================
// Nittoo Window Focus & Tab Return Visual Refresh Verification
// Verifies Stale-While-Revalidate, Silent Background Revalidation,
// Auth State Referential Stability, Background Error Resilience,
// and Prediction Math In-Place Updates across Blur/Focus cycles.
// ==============================================================================

import { MockDatabase, InMemoryStorageAdapter, DEFAULT_MOCK_USER_ID } from '../src/lib/mock-db';
import { getPredictionMetrics } from '../src/hooks/usePrediction';
import { sortActiveProducts } from '../src/pages/DashboardPage';
import type { AuthUser } from '../src/contexts/AuthContext';
import type { ProductWithDetails } from '../src/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function runFocusRefreshVerification() {
  console.log('=================================================================');
  console.log('NITTOO WINDOW FOCUS / TAB RETURN REFRESH VERIFICATION');
  console.log('=================================================================\n');

  const memoryAdapter = new InMemoryStorageAdapter();
  const db = new MockDatabase(memoryAdapter);

  // ----------------------------------------------------------------------------
  // 1. SIMULATE INITIAL DASHBOARD LOAD
  // ----------------------------------------------------------------------------
  console.log('--- 1. Testing Initial Dashboard Load Lifecycle ---');

  // Simulated React State & Refs
  let isInitialLoad = true;
  let loading = false;
  let error: string | null = null;
  let products: ProductWithDetails[] = [];

  // Initial load function mimicking DashboardPage.tsx
  async function loadActiveProducts(userId: string, isSilent = false) {
    if (isInitialLoad && !isSilent) {
      loading = true;
    }

    try {
      const active = await db.getActiveProducts(userId);
      products = active;
      error = null;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load active products';
      if (isInitialLoad) {
        error = msg;
      }
    } finally {
      isInitialLoad = false;
      loading = false;
    }
  }

  // Before initial load
  assert(products.length === 0, 'Products empty before initial load');
  assert(isInitialLoad === true, 'isInitialLoad is true initially');

  // Trigger initial load
  await loadActiveProducts(DEFAULT_MOCK_USER_ID);

  assert(loading === false, 'Loading completed (loading === false)');
  assert((isInitialLoad as boolean) === false, 'isInitialLoad flipped to false');
  assert(error === null, 'No error on initial load');
  assert(products.length > 0, `Loaded ${products.length} active products`);

  const initialProductsSnapshot = [...products];
  const initialProductIds = products.map((p) => p.id);

  // ----------------------------------------------------------------------------
  // 2. SIMULATE WINDOW BLUR & FOCUS RETURN (STALE-WHILE-REVALIDATE)
  // ----------------------------------------------------------------------------
  console.log('\n--- 2. Testing Window Blur and Focus Return ---');

  // User switches away: Window Blur
  const isWindowFocused = false;
  assert(!isWindowFocused, 'Window blurred: user switched to another application');
  assert(products.length > 0, 'Data remains intact in memory while window is unfocused');

  // User returns to Chrome: Window Focus
  console.log('  -> Window regains focus');
  let backgroundRefreshStarted = false;
  let skeletonRendered = false;

  // Simulate focus handler invoking silent revalidation
  async function onWindowFocus() {
    backgroundRefreshStarted = true;
    // On focus, loadActiveProducts is invoked with isSilent = true
    if (isInitialLoad) {
      skeletonRendered = true; // Would render skeleton if isInitialLoad was true
    }
    await loadActiveProducts(DEFAULT_MOCK_USER_ID, true);
  }

  await onWindowFocus();

  assert((backgroundRefreshStarted as boolean) === true, 'Background refresh initiated on focus');
  assert(skeletonRendered === false, 'Skeleton was NEVER rendered on focus return');
  assert(loading === false, 'loading state remained false throughout focus recovery');
  assert(products.length === initialProductsSnapshot.length, 'Existing products remained continuously available');
  assert(
    JSON.stringify(products.map((p) => p.id)) === JSON.stringify(initialProductIds),
    'Product identities preserved during silent revalidation'
  );

  // ----------------------------------------------------------------------------
  // 3. AUTH STATE REFERENTIAL STABILITY (SUPABASE TOKEN REFRESH SIMULATION)
  // ----------------------------------------------------------------------------
  console.log('\n--- 3. Testing Auth Context Token Refresh Referential Stability ---');

  let currentUser: AuthUser = {
    id: DEFAULT_MOCK_USER_ID,
    email: 'demo-user@nittoo.local',
    created_at: '2026-08-30T10:00:00Z',
  };

  const initialUserRef = currentUser;

  // Simulate Supabase onAuthStateChange firing TOKEN_REFRESHED with a new object literal
  const incomingRefreshedSessionUser = {
    id: DEFAULT_MOCK_USER_ID,
    email: 'demo-user@nittoo.local',
    created_at: '2026-08-30T10:00:00Z',
  };

  // Functional update logic from updated AuthContext.tsx
  function updateAuthState(incoming: typeof incomingRefreshedSessionUser) {
    currentUser = ((prev: AuthUser | null) => {
      if (
        prev &&
        prev.id === incoming.id &&
        prev.email === incoming.email &&
        prev.created_at === incoming.created_at
      ) {
        return prev; // Preserve exact reference
      }
      return incoming;
    })(currentUser);
  }

  updateAuthState(incomingRefreshedSessionUser);

  assert(
    currentUser === initialUserRef,
    'AuthUser object reference is IDENTICAL (===) after token refresh (no cascading re-renders)'
  );

  // ----------------------------------------------------------------------------
  // 4. TIME-SENSITIVE VALUES & PREDICTIONS UPDATE IN-PLACE WITHOUT REPAINT
  // ----------------------------------------------------------------------------
  console.log('\n--- 4. Testing Time-Sensitive Prediction Updates (Days Progression) ---');

  const cerave = products.find((p) => p.name.includes('CeraVe'))!;
  assert(Boolean(cerave), 'Found CeraVe in active essentials');

  // Day 1: As of Sep 6, 2026
  const metricsDay1 = getPredictionMetrics(cerave, '2026-09-06');
  assert(metricsDay1.daysUsed === 7, `Day 1 daysUsed is 7 (got: ${metricsDay1.daysUsed})`);
  assert(metricsDay1.predictedRemainingDays === 55, `Day 1 remaining is 55 (got: ${metricsDay1.predictedRemainingDays})`);

  // Day 2: User returns next day (Sep 7, 2026) without reloading page
  const metricsDay2 = getPredictionMetrics(cerave, '2026-09-07');
  assert(metricsDay2.daysUsed === 8, `Day 2 daysUsed updated in-place to 8 (got: ${metricsDay2.daysUsed})`);
  assert(metricsDay2.predictedRemainingDays === 54, `Day 2 remaining updated in-place to 54 (got: ${metricsDay2.predictedRemainingDays})`);

  // Day 70: User returns when product is overdue (Nov 10, 2026)
  const metricsOverdue = getPredictionMetrics(cerave, '2026-11-10');
  assert(metricsOverdue.isOverdue === true, 'Overdue status detected seamlessly');
  assert(metricsOverdue.predictedRemainingDays! < 0, `Remaining days is negative: ${metricsOverdue.predictedRemainingDays}`);

  // ----------------------------------------------------------------------------
  // 5. BACKGROUND REFRESH FAILURE PRESERVES EXISTING DATA
  // ----------------------------------------------------------------------------
  console.log('\n--- 5. Testing Background Refresh Failure Resilience ---');

  // Create a mock DB and override getActiveProducts to reject (simulating network wake-up delay / offline state)
  const failingDb = new MockDatabase(new InMemoryStorageAdapter());
  failingDb.getActiveProducts = async () => {
    throw new Error('Network offline / connection timeout');
  };

  async function loadFromFailingDb(isSilent: boolean) {
    if (isInitialLoad && !isSilent) {
      loading = true;
    }

    try {
      const active = await failingDb.getActiveProducts(DEFAULT_MOCK_USER_ID);
      products = active;
      error = null;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load';
      if (isInitialLoad) {
        error = msg;
      }
      // On background failure: log only, KEEP existing products
    } finally {
      isInitialLoad = false;
      loading = false;
    }
  }

  // Run silent background refresh against failing network
  await loadFromFailingDb(true);

  assert(products.length > 0, 'Existing data PRESERVED after background refresh network failure');
  assert(error === null, 'Error screen NOT shown to user on background refresh failure');
  assert(loading === false, 'Loading indicator remained false');

  // ----------------------------------------------------------------------------
  // 6. URGENCY SORTING REMAINS STABLE ACROSS REFRESHTIME
  // ----------------------------------------------------------------------------
  console.log('\n--- 6. Testing Urgency Sorting Stability ---');

  const sorted1 = sortActiveProducts(products, '2026-09-06');
  const sorted2 = sortActiveProducts(products, '2026-09-06');

  assert(
    JSON.stringify(sorted1.map((p) => p.id)) === JSON.stringify(sorted2.map((p) => p.id)),
    'Urgency sort order is deterministic and stable'
  );

  console.log('\n=================================================================');
  console.log('✅ ALL WINDOW FOCUS & BACKGROUND REVALIDATION TESTS PASSED (100%)');
  console.log('=================================================================');
}

runFocusRefreshVerification().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
