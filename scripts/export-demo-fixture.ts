import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildDemoSeedData } from '../src/lib/demo/seed';
import { InMemoryStorageAdapter, MockDatabase } from '../src/lib/mock-db';
import { buildExportData } from '../src/lib/export/normalizer';
import { generateJsonBackup } from '../src/lib/export/json';

const FIXED_USER_ID = 'demo-fixture-user';
const FIXED_USER_EMAIL = 'demo@nittoo.local';
const FIXED_REFERENCE_DATE = '2026-11-15';
const OUTPUT_PATH = resolve(process.cwd(), 'analytics/fixtures/demo_export.json');

async function main() {
  const storage = new InMemoryStorageAdapter();
  const db = new MockDatabase(storage);
  // Clear default seed for FIXED_USER_ID (MockDatabase only seeds DEFAULT_MOCK_USER_ID)
  await db.resetUserData(FIXED_USER_ID);

  const bundle = buildDemoSeedData(FIXED_USER_ID, FIXED_REFERENCE_DATE);
  await db.importUserData(FIXED_USER_ID, {
    products: bundle.products,
    purchases: bundle.purchases,
    usage_periods: bundle.usage_periods,
    restock_plans: bundle.restock_plans,
  });

  const exportData = await buildExportData(
    FIXED_USER_ID,
    FIXED_USER_EMAIL,
    db,
    FIXED_REFERENCE_DATE
  );

  const jsonString = generateJsonBackup(exportData);
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, `${jsonString}\n`, 'utf-8');
  console.log(
    `Wrote ${OUTPUT_PATH} (${exportData.products.length} products, ${exportData.purchases.length} purchases, ${exportData.usage_history.length} usage_periods, ${exportData.restock_plans?.length ?? 0} restock_plans)`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
