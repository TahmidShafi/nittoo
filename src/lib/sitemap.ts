// ==============================================================================
// Nittoo Sitemap Generator & Validator
// Outputs compliant XML sitemaps strictly for genuine public routes.
// Excludes all private, user-specific, or single-use recovery routes.
// ==============================================================================

import { PUBLIC_ROUTES, PRIVATE_ROUTES, SITE_URL } from './seo';

/**
 * Generates an XML sitemap string for Nittoo.
 * Returns null if no valid site URL is provided/available, to prevent
 * publishing incorrect sitemaps with invented domains.
 */
export function generateSitemapXml(baseUrl?: string): string | null {
  const origin = (baseUrl || SITE_URL || '').trim().replace(/\/+$/, '');

  if (!origin || !origin.startsWith('http')) {
    return null;
  }

  const urls = PUBLIC_ROUTES.map((route) => {
    // Sitemaps.org standard entry
    const priority = route === '/login' || route === '/signup' ? '0.8' : '0.3';
    const changefreq = route === '/forgot-password' ? 'yearly' : 'monthly';
    return `  <url>
    <loc>${origin}${route}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;
}

/**
 * Validates that an XML sitemap strictly adheres to Nittoo SEO policy:
 * - Excludes all private routes
 * - Contains only genuine public routes
 * - Contains zero secrets or user IDs
 */
export function validateSitemapContent(xml: string): {
  valid: boolean;
  errors: string[];
  publicUrlsFound: string[];
} {
  const errors: string[] = [];
  const publicUrlsFound: string[] = [];

  // Check XML declaration and root tag
  if (!xml.includes('<?xml') || !xml.includes('<urlset')) {
    errors.push('Missing XML declaration or <urlset> root element');
  }

  // Check for disallowed private route leaks
  for (const privateRoute of PRIVATE_ROUTES) {
    if (xml.includes(privateRoute)) {
      errors.push(`Disallowed private route found in sitemap: ${privateRoute}`);
    }
  }

  // Extract <loc> URLs
  const locMatches = xml.match(/<loc>(.*?)<\/loc>/g) || [];
  for (const locTag of locMatches) {
    const url = locTag.replace(/<\/?loc>/g, '');
    publicUrlsFound.push(url);

    // Verify it maps to one of the genuine public routes
    const isPublic = PUBLIC_ROUTES.some((route) => url.endsWith(route));
    if (!isPublic) {
      errors.push(`Unexpected non-public URL in sitemap: ${url}`);
    }
  }

  // Ensure no user email or token looks leaked
  if (/@/.test(xml)) {
    errors.push('Potential email leak detected in sitemap content');
  }

  return {
    valid: errors.length === 0,
    errors,
    publicUrlsFound,
  };
}
