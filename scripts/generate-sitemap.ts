// ==============================================================================
// Nittoo Sitemap Generation Script
// Usage: tsx scripts/generate-sitemap.ts
// Generates public/sitemap.xml if a verified production domain is provided via
// VITE_SITE_URL or SITE_URL environment variable.
// If no domain is configured, gracefully reports the missing dependency.
// ==============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { generateSitemapXml, validateSitemapContent } from '../src/lib/sitemap';

const siteUrl = process.env.VITE_SITE_URL || process.env.SITE_URL || '';
const publicDir = path.resolve(process.cwd(), 'public');
const sitemapPath = path.join(publicDir, 'sitemap.xml');

if (!siteUrl || !siteUrl.startsWith('http')) {
  console.log('[nittoo-sitemap] No valid production domain provided (VITE_SITE_URL).');
  console.log('[nittoo-sitemap] Stopping short of creating sitemap with invented domain.');
  console.log('[nittoo-sitemap] To generate a sitemap, set VITE_SITE_URL=https://your-domain.com');
  process.exit(0);
}

const xml = generateSitemapXml(siteUrl);

if (!xml) {
  console.error('[nittoo-sitemap] Failed to generate XML from domain:', siteUrl);
  process.exit(1);
}

const validation = validateSitemapContent(xml);
if (!validation.valid) {
  console.error('[nittoo-sitemap] Sitemap validation failed:', validation.errors);
  process.exit(1);
}

fs.writeFileSync(sitemapPath, xml, 'utf-8');
console.log(`[nittoo-sitemap] Successfully generated ${sitemapPath} for ${siteUrl}`);
console.log(`[nittoo-sitemap] URLs included:`, validation.publicUrlsFound);
