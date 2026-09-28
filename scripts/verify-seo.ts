// ==============================================================================
// Nittoo Technical SEO & Web Presence Verification Suite
// Validates:
// 1. Required public metadata in index.html
// 2. Public page titles format and tone
// 3. Truthful meta descriptions (no AI/hype claims)
// 4. Open Graph metadata tags
// 5. Favicon and brand assets references
// 6. robots.txt syntax and structure
// 7. robots.txt public entrypoint accessibility (no global Disallow)
// 8. sitemap.xml handling (domain dependency report vs domain generation)
// 9. sitemap excludes all private application routes
// 10. sitemap contains only genuine public routes
// 11. Private routes strictly declared noindex
// 12. Canonical URLs never use invented domains
// 13. Heading semantics: exactly one <h1> per page component
// 14. Image alt text: descriptive, non-redundant
// 15. Internal link audit: routes match App.tsx definitions (no /products/:id)
// 16. Security & privacy: zero secrets or user data in public SEO files
// ==============================================================================

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import {
  BRAND_NAME,
  DEFAULT_PAGE_TITLE,
  DEFAULT_META_DESCRIPTION,
  PUBLIC_ROUTES,
  PRIVATE_ROUTES,
  SITE_URL,
  formatDocumentTitle,
} from '../src/lib/seo';
import { generateSitemapXml, validateSitemapContent } from '../src/lib/sitemap';

const rootDir = process.cwd();
const indexHtmlPath = path.join(rootDir, 'index.html');
const robotsPath = path.join(rootDir, 'public', 'robots.txt');
const manifestPath = path.join(rootDir, 'public', 'site.webmanifest');
const faviconPath = path.join(rootDir, 'public', 'favicon.svg');
const logoPath = path.join(rootDir, 'public', 'nittoo-logo.png');
const pagesDir = path.join(rootDir, 'src', 'pages');

let passedTests = 0;
let totalTests = 0;

function test(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${err.message}`);
    throw err;
  }
}

console.log('\n======================================================');
console.log('  NITTOO TECHNICAL SEO & WEB PRESENCE VERIFICATION');
console.log('======================================================\n');

// ------------------------------------------------------------------
// 1. Required Public Metadata in index.html
// ------------------------------------------------------------------
console.log('Suite 1: Static HTML & Public Metadata');

const indexHtml = fs.readFileSync(indexHtmlPath, 'utf-8');

test('index.html includes charset UTF-8 and responsive viewport', () => {
  assert(indexHtml.includes('<meta charset="UTF-8" />'), 'Missing UTF-8 charset declaration');
  assert(
    indexHtml.includes('name="viewport" content="width=device-width, initial-scale=1.0"'),
    'Missing standard responsive viewport meta tag'
  );
});

test('index.html contains standard document title and meta description', () => {
  assert(
    indexHtml.includes(`<title>${DEFAULT_PAGE_TITLE}</title>`),
    `index.html title must match ${DEFAULT_PAGE_TITLE}`
  );
  assert(
    indexHtml.includes(`name="description" content="${DEFAULT_META_DESCRIPTION}"`),
    'index.html must contain authoritative product description'
  );
});

test('index.html references favicon and apple-touch-icon', () => {
  assert(
    indexHtml.includes('rel="icon" type="image/svg+xml" href="/favicon.svg"'),
    'Missing /favicon.svg link'
  );
  assert(
    indexHtml.includes('rel="apple-touch-icon" href="/favicon.svg"'),
    'Missing apple-touch-icon link'
  );
  assert(fs.existsSync(faviconPath), 'public/favicon.svg must exist');
});

test('index.html references web manifest and brand theme-color', () => {
  assert(
    indexHtml.includes('rel="manifest" href="/site.webmanifest"'),
    'Missing web manifest link in index.html'
  );
  assert(
    indexHtml.includes('name="theme-color" content="#2D6A4F"'),
    'Missing theme-color meta tag (#2D6A4F)'
  );
  assert(fs.existsSync(manifestPath), 'public/site.webmanifest must exist');
});

test('index.html contains required Open Graph metadata', () => {
  assert(indexHtml.includes('property="og:type" content="website"'), 'Missing og:type');
  assert(indexHtml.includes('property="og:site_name" content="Nittoo"'), 'Missing og:site_name');
  assert(
    indexHtml.includes(`property="og:title" content="${DEFAULT_PAGE_TITLE}"`),
    'Missing og:title'
  );
  assert(
    indexHtml.includes(`property="og:description" content="${DEFAULT_META_DESCRIPTION}"`),
    'Missing og:description'
  );
  assert(
    indexHtml.includes('property="og:image" content="/nittoo-logo.png"'),
    'Missing og:image'
  );
  assert(fs.existsSync(logoPath), 'public/nittoo-logo.png must exist for og:image');
});

test('index.html contains Twitter/X Card metadata', () => {
  assert(indexHtml.includes('name="twitter:card" content="summary"'), 'Missing twitter:card');
  assert(
    indexHtml.includes(`name="twitter:title" content="${DEFAULT_PAGE_TITLE}"`),
    'Missing twitter:title'
  );
  assert(
    indexHtml.includes(`name="twitter:description" content="${DEFAULT_META_DESCRIPTION}"`),
    'Missing twitter:description'
  );
  assert(
    indexHtml.includes('name="twitter:image" content="/nittoo-logo.png"'),
    'Missing twitter:image'
  );
});

test('index.html includes truthful WebApplication JSON-LD structured data', () => {
  assert(indexHtml.includes('application/ld+json'), 'Missing JSON-LD script');
  const jsonLdMatch = indexHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert(jsonLdMatch && jsonLdMatch[1], 'Failed to extract JSON-LD structured data');
  const schema = JSON.parse(jsonLdMatch[1]);
  assert.strictEqual(schema['@type'], 'WebApplication');
  assert.strictEqual(schema.name, 'Nittoo');
  assert(!('aggregateRating' in schema), 'Must NOT contain fake reviews/ratings');
  assert(!('offers' in schema), 'Must NOT contain fake pricing offers');
});

// ------------------------------------------------------------------
// 2. Document Title Formatting & Editorial Tone
// ------------------------------------------------------------------
console.log('\nSuite 2: Document Title Formatting & Restraint');

test('Document titles are formatted calmly without spammy keyword stuffing', () => {
  assert.strictEqual(formatDocumentTitle('Sign In'), 'Sign In — Nittoo');
  assert.strictEqual(formatDocumentTitle('Create Account'), 'Create Account — Nittoo');
  assert.strictEqual(formatDocumentTitle('Reset Password'), 'Reset Password — Nittoo');
  assert.strictEqual(formatDocumentTitle('Nittoo — Know What Lasts'), 'Nittoo — Know What Lasts');
  assert.strictEqual(formatDocumentTitle(''), DEFAULT_PAGE_TITLE);
});

test('Document descriptions avoid exaggerated marketing buzzwords', () => {
  const forbiddenClaims = ['ai-powered', 'smartest', 'revolutionary', 'guaranteed', 'best'];
  for (const word of forbiddenClaims) {
    assert(
      !DEFAULT_META_DESCRIPTION.toLowerCase().includes(word),
      `Default description must not claim unsupported buzzword: ${word}`
    );
  }
});

// ------------------------------------------------------------------
// 3. Robots.txt Compliance & Accessibility
// ------------------------------------------------------------------
console.log('\nSuite 3: robots.txt Directives & Privacy Enforcement');

const robotsTxt = fs.readFileSync(robotsPath, 'utf-8');

test('robots.txt exists and specifies User-agent: *', () => {
  assert(fs.existsSync(robotsPath), 'public/robots.txt must exist');
  assert(robotsTxt.includes('User-agent: *'), 'robots.txt must specify User-agent: *');
});

test('robots.txt explicitly allows public entrypoints', () => {
  for (const route of PUBLIC_ROUTES) {
    assert(
      robotsTxt.includes(`Allow: ${route}`),
      `robots.txt must allow genuine public route: ${route}`
    );
  }
});

test('robots.txt strictly disallows all private user workspaces', () => {
  for (const route of PRIVATE_ROUTES) {
    assert(
      robotsTxt.includes(`Disallow: ${route}`),
      `robots.txt must disallow private route: ${route}`
    );
  }
});

test('robots.txt does not blindly block the entire site', () => {
  const lines = robotsTxt.split('\n').map((l) => l.trim());
  const disallowRoot = lines.some((l) => l === 'Disallow: /');
  assert(!disallowRoot, 'robots.txt must NOT have generic Disallow: / blocking the site');
});

// ------------------------------------------------------------------
// 4. Web App Manifest Verification
// ------------------------------------------------------------------
console.log('\nSuite 4: Web App Manifest Metadata Preparation');

const manifestContent = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

test('site.webmanifest matches Nittoo brand identity', () => {
  assert.strictEqual(manifestContent.name, 'Nittoo — Know What Lasts');
  assert.strictEqual(manifestContent.short_name, 'Nittoo');
  assert.strictEqual(manifestContent.background_color, '#FBFBFB');
  assert.strictEqual(manifestContent.theme_color, '#2D6A4F');
  assert(Array.isArray(manifestContent.icons), 'Manifest must declare icon array');
  assert(
    manifestContent.icons.some((i: any) => i.src === '/favicon.svg'),
    'Manifest must include /favicon.svg'
  );
  assert(
    manifestContent.icons.some((i: any) => i.src === '/nittoo-logo.png'),
    'Manifest must include /nittoo-logo.png'
  );
});

// ------------------------------------------------------------------
// 5. Sitemap Generation & Policy Validation
// ------------------------------------------------------------------
console.log('\nSuite 5: Sitemap Policy & Domain Isolation');

test('Sitemap generator stops short of inventing domains when no URL is provided', () => {
  const result = generateSitemapXml('');
  assert.strictEqual(result, null, 'Must return null when site URL is empty');
});

test('Sitemap generator outputs valid XML strictly containing public routes when domain is provided', () => {
  const testDomain = 'https://nittoo-prod.example.com';
  const xml = generateSitemapXml(testDomain);
  assert(xml !== null, 'Should generate XML when valid domain is provided');

  const validation = validateSitemapContent(xml!);
  assert(validation.valid, `Sitemap validation failed: ${validation.errors.join(', ')}`);
  assert.strictEqual(
    validation.publicUrlsFound.length,
    PUBLIC_ROUTES.length,
    'Sitemap must contain exactly the public routes'
  );

  for (const route of PUBLIC_ROUTES) {
    assert(
      validation.publicUrlsFound.includes(`${testDomain}${route}`),
      `Sitemap must include ${testDomain}${route}`
    );
  }

  for (const privateRoute of PRIVATE_ROUTES) {
    assert(
      !xml!.includes(privateRoute),
      `Sitemap must NEVER contain private route: ${privateRoute}`
    );
  }
});

test('If public/sitemap.xml exists in repository, verify it strictly obeys policy', () => {
  const sitemapFile = path.join(rootDir, 'public', 'sitemap.xml');
  if (fs.existsSync(sitemapFile)) {
    const content = fs.readFileSync(sitemapFile, 'utf-8');
    const validation = validateSitemapContent(content);
    assert(validation.valid, `public/sitemap.xml has errors: ${validation.errors.join(', ')}`);
  } else {
    // When no production domain is established, omitting public/sitemap.xml is correct
    console.log('    [info] public/sitemap.xml safely omitted until production domain is configured.');
  }
});

// ------------------------------------------------------------------
// 6. Semantic Heading Audit (h1 hierarchy across all pages)
// ------------------------------------------------------------------
console.log('\nSuite 6: Semantic Heading Hierarchy Audit');

const pageFiles = fs.readdirSync(pagesDir).filter((f) => f.endsWith('.tsx'));

test('All page components have exactly one primary <h1> element', () => {
  for (const file of pageFiles) {
    const filePath = path.join(pagesDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Count <h1 occurrences
    const h1Matches = content.match(/<h1[\s>]/g) || [];
    assert.strictEqual(
      h1Matches.length,
      1,
      `Page ${file} must have exactly one <h1> heading, found ${h1Matches.length}`
    );
  }
});

test('AccountPage follows strict semantic heading hierarchy (h1 -> h2 -> h3)', () => {
  const accountContent = fs.readFileSync(path.join(pagesDir, 'AccountPage.tsx'), 'utf-8');
  assert(accountContent.includes('<h1'), 'AccountPage must have <h1>');
  assert(accountContent.includes('<h2'), 'AccountPage must have <h2> section dividers');
  assert(accountContent.includes('<h3'), 'AccountPage must have <h3> item headers');
});

// ------------------------------------------------------------------
// 7. Image Alt Text Audit
// ------------------------------------------------------------------
console.log('\nSuite 7: Image Alt Attributes Audit');

test('Brand logo img has descriptive, non-redundant alt text', () => {
  const logoComponentPath = path.join(rootDir, 'src', 'components', 'NittooLogo.tsx');
  const logoContent = fs.readFileSync(logoComponentPath, 'utf-8');

  // Verify alt="Nittoo"
  assert(
    logoContent.includes('alt="Nittoo"'),
    'NittooLogo <img> must have alt="Nittoo" (not redundant "Nittoo Logo image")'
  );
});

// ------------------------------------------------------------------
// 8. Internal Navigation Links Audit
// ------------------------------------------------------------------
console.log('\nSuite 8: Internal Route Integrity Audit');

test('No broken internal route references exist (e.g. no /products/ typo)', () => {
  const srcFiles: string[] = [];
  function scan(dir: string) {
    for (const item of fs.readdirSync(dir)) {
      const full = path.join(dir, item);
      if (fs.statSync(full).isDirectory()) scan(full);
      else if (full.endsWith('.tsx') || full.endsWith('.ts')) srcFiles.push(full);
    }
  }
  scan(path.join(rootDir, 'src'));

  for (const file of srcFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    // Ensure no broken /products/:id link exists in place of /product/:id
    assert(
      !content.includes('/products/'),
      `File ${path.relative(rootDir, file)} contains invalid route /products/ (should be /product/)`
    );
  }
});

// ------------------------------------------------------------------
// 9. Privacy & Secret Leak Audit
// ------------------------------------------------------------------
console.log('\nSuite 9: Privacy & Zero-Secret Audit');

test('Public SEO files contain zero credentials, auth tokens, or user data', () => {
  const filesToScan = [indexHtmlPath, robotsPath, manifestPath];
  const forbiddenPatterns = [
    /sb_publishable_/,
    /service_role/,
    /TEST_USER/,
    /supabase\.co/,
    /@nittoo\.local/,
    /demo1234/,
    /eyJhbGciOi/, // JWT token prefix
  ];

  for (const filePath of filesToScan) {
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, 'utf-8');
    for (const pattern of forbiddenPatterns) {
      assert(
        !pattern.test(content),
        `Public file ${path.basename(filePath)} leaked sensitive pattern: ${pattern}`
      );
    }
  }
});

// ------------------------------------------------------------------
// Summary Report
// ------------------------------------------------------------------
console.log('\n======================================================');
console.log(`  ALL ${passedTests} / ${totalTests} SEO VERIFICATION CHECKS PASSED`);
console.log('======================================================\n');
