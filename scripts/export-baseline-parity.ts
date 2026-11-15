import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  calculatePredictedRemainingDays,
  calculateUsageDuration,
  legacyAverageLifespan,
} from '../src/lib/prediction';
import type { UsagePeriod } from '../src/types';

interface DemoUsageItem {
  id: string;
  product_id: string;
  purchase_id: string;
  opened_date: string;
  finished_date: string | null;
  status: 'completed' | 'active';
}

interface DemoExport {
  products: { id: string; name: string }[];
  usage_periods: DemoUsageItem[];
}

const INPUT_PATH = resolve(process.cwd(), 'analytics/fixtures/demo_export.json');
const OUTPUT_PATH = resolve(process.cwd(), 'analytics/fixtures/baseline_parity.json');

function toUsagePeriod(item: DemoUsageItem): UsagePeriod {
  return {
    id: item.id,
    product_id: item.product_id,
    purchase_id: item.purchase_id,
    opened_date: item.opened_date,
    finished_date: item.finished_date,
    status: item.status === 'completed' ? 'finished' : 'active',
    created_at: `${item.opened_date}T00:00:00.000Z`,
  };
}

function main() {
  const raw = JSON.parse(readFileSync(INPUT_PATH, 'utf-8')) as DemoExport;
  const byProduct = new Map<string, UsagePeriod[]>();

  for (const item of raw.usage_periods) {
    const list = byProduct.get(item.product_id) ?? [];
    list.push(toUsagePeriod(item));
    byProduct.set(item.product_id, list);
  }

  const cases: {
    product_id: string;
    k: number;
    history_durations: number[];
    average_lifespan: number | null;
    predicted_duration: number | null;
  }[] = [];

  for (const product of raw.products) {
    const periods = (byProduct.get(product.id) ?? []).sort((a, b) => {
      const cmp = a.opened_date.localeCompare(b.opened_date);
      return cmp !== 0 ? cmp : a.id.localeCompare(b.id);
    });
    const finished = periods.filter((p) => p.status === 'finished' && p.finished_date !== null);
    for (let k = 1; k <= finished.length; k += 1) {
      const prefix = finished.slice(0, k);
      const durations = prefix.map((p) => calculateUsageDuration(p) ?? 0);
      const avg = legacyAverageLifespan(prefix);
      const pred = calculatePredictedRemainingDays(avg, 0);
      cases.push({
        product_id: product.id,
        k,
        history_durations: durations,
        average_lifespan: avg,
        predicted_duration: pred,
      });
    }
  }

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, `${JSON.stringify({ cases }, null, 2)}\n`, 'utf-8');
  console.log(`Wrote ${OUTPUT_PATH} (${cases.length} prefix cases across ${raw.products.length} products)`);
}

main();
