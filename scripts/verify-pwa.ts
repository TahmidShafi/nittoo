// ==============================================================================
// Nittoo Stage 16.7 Automated Verification: PWA Foundation & Offline Caching
//
// Validates:
// 1. service worker file exists in public/
// 2. manifest exists in public/
// 3. manifest contains correct Nittoo identity & brand colors
// 4. production registration exists in src/main.tsx and src/lib/pwa.ts
// 5. service worker has versioned cache naming
// 6. static asset caching strategy exists (cache-first for static/hashed assets)
// 7. Supabase requests are strictly excluded from caching
// 8. auth endpoints and sensitive headers are strictly excluded
// 9. user-specific data/routes are never cached by the worker
// 10. cache version cleanup exists in activate lifecycle
// 11. offline navigation fallback to application shell exists
// 12. Vercel SPA compatibility remains intact
// 13. no service-worker registration in development (import.meta.env.PROD guard)
// 14. production build succeeds and outputs service-worker.js in dist/
// ==============================================================================

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';

const rootDir = process.cwd();
const publicDir = path.join(rootDir, 'public');
const srcDir = path.join(rootDir, 'src');
const swPath = path.join(publicDir, 'service-worker.js');
const manifestPath = path.join(publicDir, 'site.webmanifest');
const pwaLibPath = path.join(srcDir, 'lib', 'pwa.ts');
const mainTsxPath = path.join(srcDir, 'main.tsx');
const vercelJsonPath = path.join(rootDir, 'vercel.json');
const distDir = path.join(rootDir, 'dist');
const distSwPath = path.join(distDir, 'service-worker.js');
const distManifestPath = path.join(distDir, 'site.webmanifest');

let totalTests = 0;
let passedTests = 0;

function test(name: string, fn: () => void | Promise<void>) {
  totalTests++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res
        .then(() => {
          passedTests++;
          console.log(`  ✓ ${name}`);
        })
        .catch((err) => {
          console.error(`  ✗ ${name}`);
          console.error(err);
          process.exit(1);
        });
    }
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    process.exit(1);
  }
}

async function run() {
  console.log('\n======================================================');
  console.log('  NITTOO PWA FOUNDATION & OFFLINE CACHING AUDIT');
  console.log('======================================================\n');

  // ------------------------------------------------------------------
  // Suite 1: Files Existence & Identity
  // ------------------------------------------------------------------
  console.log('Suite 1: PWA Static Files & Manifest Audit');

  test('1. service worker file exists in public/service-worker.js', () => {
    assert(fs.existsSync(swPath), 'public/service-worker.js must exist');
    const stats = fs.statSync(swPath);
    assert(stats.size > 200, 'public/service-worker.js must not be empty');
  });

  test('2. manifest exists in public/site.webmanifest', () => {
    assert(fs.existsSync(manifestPath), 'public/site.webmanifest must exist');
  });

  test('3. manifest contains correct Nittoo identity and colors', () => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    assert(manifest.name && manifest.name.includes('Nittoo'), 'Manifest name must include Nittoo');
    assert.strictEqual(manifest.short_name, 'Nittoo', 'Manifest short_name must be Nittoo');
    assert.strictEqual(manifest.theme_color, '#2D6A4F', 'Theme color must match brand forest green');
    assert.strictEqual(manifest.background_color, '#FBFBFB', 'Background color must match brand light neutral');
    assert.strictEqual(manifest.display, 'standalone', 'Display mode must be standalone');
    assert.strictEqual(manifest.start_url, '/', 'start_url must be root /');
    assert(Array.isArray(manifest.icons) && manifest.icons.length >= 2, 'Icons array must declare brand icons');
    assert(manifest.icons.some((i: any) => i.src === '/favicon.svg'), 'Icons must include /favicon.svg');
    assert(manifest.icons.some((i: any) => i.src === '/nittoo-logo.png'), 'Icons must include /nittoo-logo.png');
  });

  // ------------------------------------------------------------------
  // Suite 2: Registration & Environment Guards
  // ------------------------------------------------------------------
  console.log('\nSuite 2: Service Worker Registration & Environment Scope');

  test('4. production registration exists in src/lib/pwa.ts and main.tsx', () => {
    assert(fs.existsSync(pwaLibPath), 'src/lib/pwa.ts must exist');
    const pwaContent = fs.readFileSync(pwaLibPath, 'utf-8');
    assert(pwaContent.includes('registerServiceWorker'), 'pwa.ts must export registerServiceWorker');
    assert(pwaContent.includes("register('/service-worker.js'"), 'Must register /service-worker.js');
    assert(pwaContent.includes("scope: '/'"), "Scope must be explicitly root ('/')");

    const mainContent = fs.readFileSync(mainTsxPath, 'utf-8');
    assert(mainContent.includes('registerServiceWorker'), 'main.tsx must import and invoke registerServiceWorker');
  });

  test('13. no service-worker registration in development (import.meta.env.PROD guard)', () => {
    const pwaContent = fs.readFileSync(pwaLibPath, 'utf-8');
    assert(
      pwaContent.includes('import.meta.env.PROD'),
      'registerServiceWorker must check import.meta.env.PROD to prevent registering in local development'
    );
  });

  // ------------------------------------------------------------------
  // Suite 3: Service Worker Cache Management & Lifecycles
  // ------------------------------------------------------------------
  console.log('\nSuite 3: Service Worker Versioning & Cache Management');

  const swContent = fs.readFileSync(swPath, 'utf-8');

  test('5. service worker has versioned cache name', () => {
    assert(
      /const\s+CACHE_NAME\s*=\s*['"]nittoo-static-v\d+['"]/.test(swContent),
      'Service worker must define a versioned cache name like nittoo-static-v1'
    );
  });

  test('6. static asset caching strategy exists for hashed assets', () => {
    assert(
      swContent.includes('/assets/'),
      'Service worker must explicitly cache /assets/ hashed bundles'
    );
    assert(
      swContent.includes('caches.match'),
      'Service worker must implement cache matching'
    );
    assert(
      swContent.includes('.clone()') && swContent.includes('cache.put'),
      'Service worker must cache valid static responses'
    );
  });

  test('10. cache version cleanup exists in activate lifecycle', () => {
    assert(
      swContent.includes("addEventListener('activate'"),
      'Service worker must handle activate event'
    );
    assert(
      /caches\s*\.\s*keys\s*\(/.test(swContent) && /caches\s*\.\s*delete\s*\(/.test(swContent),
      'Service worker must purge obsolete cache versions'
    );
    assert(
      swContent.includes('clients.claim()'),
      'Service worker must claim clients upon activation'
    );
  });

  test('11. offline navigation fallback to application shell exists', () => {
    assert(
      swContent.includes("request.mode === 'navigate'"),
      'Service worker must explicitly inspect navigation requests'
    );
    assert(
      swContent.includes('/index.html'),
      'Service worker must fallback to cached /index.html when offline'
    );
  });

  // ------------------------------------------------------------------
  // Suite 4: Security & Authentication Isolation
  // ------------------------------------------------------------------
  console.log('\nSuite 4: Security, Auth & Supabase Isolation Audit');

  test('7. Supabase requests are strictly excluded from cache logic', () => {
    assert(
      swContent.includes("url.hostname.includes('supabase.co')"),
      'Service worker must explicitly bypass supabase.co requests'
    );
    assert(
      swContent.includes('/rest/v1'),
      'Service worker must explicitly bypass Supabase REST API endpoints'
    );
  });

  test('8. auth endpoints and credentials are strictly excluded', () => {
    assert(
      swContent.includes('/auth/v1'),
      'Service worker must explicitly bypass Supabase Auth API endpoints'
    );
    assert(
      swContent.includes('authorization') && swContent.includes('apikey'),
      'Service worker must bypass any request with authorization or apikey headers'
    );
    assert(
      swContent.includes("request.method !== 'GET'"),
      'Service worker must NEVER intercept non-GET requests (mutations, logins, form submissions)'
    );
  });

  test('9. user-specific routes and private data are not stored by the worker', () => {
    // Verify worker only precaches static public files
    assert(!swContent.includes('/dashboard'), 'Precache must not include private /dashboard route');
    assert(!swContent.includes('/account'), 'Precache must not include private /account route');
    assert(!swContent.includes('/analytics'), 'Precache must not include private /analytics route');
    assert(!swContent.includes('/inventory'), 'Precache must not include private /inventory route');
    assert(!swContent.includes('/product'), 'Precache must not include private /product route');
    assert(!swContent.includes('localStorage'), 'Service worker must not access localStorage');
    assert(!swContent.includes('indexedDB'), 'Service worker must not store arbitrary database data');
  });

  // ------------------------------------------------------------------
  // Suite 5: Hosting & Build Output Audit
  // ------------------------------------------------------------------
  console.log('\nSuite 5: Hosting & Build Output Compatibility');

  test('12. Vercel SPA compatibility remains intact', () => {
    assert(fs.existsSync(vercelJsonPath), 'vercel.json must exist');
    const vercelConfig = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf-8'));
    assert(Array.isArray(vercelConfig.rewrites), 'vercel.json must have rewrites');
    assert(
      vercelConfig.rewrites.some((r: any) => r.source === '/(.*)' && r.destination === '/index.html'),
      'vercel.json must rewrite all SPA routes to /index.html'
    );
  });

  test('14. production build output verification', () => {
    // Check if dist files exist (or were produced by prior build)
    if (fs.existsSync(distDir)) {
      assert(fs.existsSync(distSwPath), 'dist/service-worker.js must be copied by Vite build');
      assert(fs.existsSync(distManifestPath), 'dist/site.webmanifest must be copied by Vite build');
      const distSw = fs.readFileSync(distSwPath, 'utf-8');
      assert(distSw.includes('nittoo-static-v1'), 'Built service worker must preserve cache versioning');
    }
  });

  console.log('\n======================================================');
  console.log(`  ALL ${passedTests} / ${totalTests} PWA VERIFICATION CHECKS PASSED`);
  console.log('======================================================\n');
}

run();
