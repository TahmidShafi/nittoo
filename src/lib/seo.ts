// ==============================================================================
// Nittoo Technical SEO & Web Presence Configuration
// Pure TypeScript domain metadata, route classifications, and head tag helpers
// Zero external dependencies — respects strict privacy and noindex boundaries
// ==============================================================================

export const BRAND_NAME = 'Nittoo';
export const DEFAULT_TAGLINE = 'Know What Lasts';
export const DEFAULT_PAGE_TITLE = 'Nittoo — Know What Lasts';
export const DEFAULT_META_DESCRIPTION =
  "Nittoo helps you track everyday essentials, learn how long they last, understand cost per day, and predict when you'll need the next one.";

/**
 * Public routes that are intentionally indexable for web discovery.
 */
export const PUBLIC_ROUTES = [
  '/login',
  '/signup',
  '/forgot-password',
] as const;

export type PublicRoute = (typeof PUBLIC_ROUTES)[number];

/**
 * Private routes containing user-specific data or single-use tokens.
 * These MUST remain strictly `noindex, nofollow` and excluded from public sitemaps.
 */
export const PRIVATE_ROUTES = [
  '/dashboard',
  '/inventory',
  '/analytics',
  '/product',
  '/compare',
  '/account',
  '/add-product',
  '/add-inventory',
  '/reset-password',
] as const;

export type PrivateRoute = (typeof PRIVATE_ROUTES)[number];

/**
 * Production site origin URL if configured in environment.
 * If VITE_SITE_URL is not set, defaults to empty string to avoid inventing a domain.
 */
export const SITE_URL: string = (
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SITE_URL) ||
  (typeof process !== 'undefined' && process.env?.VITE_SITE_URL) ||
  ''
).replace(/\/+$/, '');

export interface PageMetadataInput {
  title?: string;
  description?: string;
  noindex?: boolean;
  canonicalPath?: string;
}

/**
 * Formats a clean, restrained Nittoo document title.
 * Avoids keyword stuffing and maintains editorial calm.
 */
export function formatDocumentTitle(title?: string): string {
  if (!title || title.trim() === '') {
    return DEFAULT_PAGE_TITLE;
  }
  const cleanTitle = title.trim();
  if (cleanTitle.toLowerCase().includes('nittoo')) {
    return cleanTitle;
  }
  return `${cleanTitle} — ${BRAND_NAME}`;
}

/**
 * Safely updates or creates a meta tag in document.head.
 */
function updateOrCreateMetaTag(
  selector: string,
  attributeName: string,
  attributeValue: string,
  content: string
): void {
  if (typeof document === 'undefined') return;

  let el = document.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attributeName, attributeValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/**
 * Updates or removes the canonical link element.
 */
function updateCanonicalLink(canonicalUrl?: string): void {
  if (typeof document === 'undefined') return;

  const existing = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');

  if (canonicalUrl && canonicalUrl.trim() !== '') {
    const link = existing || document.createElement('link');
    link.setAttribute('rel', 'canonical');
    link.setAttribute('href', canonicalUrl.trim());
    if (!existing) {
      document.head.appendChild(link);
    }
  } else if (existing) {
    existing.remove();
  }
}

/**
 * Pure DOM updater for page metadata (title, description, robots, canonical).
 * Guaranteed zero re-renders of the React component tree.
 */
export function setPageMetadata(input: PageMetadataInput): void {
  if (typeof document === 'undefined') return;

  // 1. Document title
  const resolvedTitle = formatDocumentTitle(input.title);
  document.title = resolvedTitle;

  // 2. Meta description
  const resolvedDescription = input.description?.trim() || DEFAULT_META_DESCRIPTION;
  updateOrCreateMetaTag('meta[name="description"]', 'name', 'description', resolvedDescription);

  // 3. Robots directive (strict privacy enforcement)
  const isNoIndex = input.noindex === true;
  const robotsContent = isNoIndex ? 'noindex, nofollow' : 'index, follow';
  updateOrCreateMetaTag('meta[name="robots"]', 'name', 'robots', robotsContent);

  // 4. Open Graph mirror for public views
  updateOrCreateMetaTag('meta[property="og:title"]', 'property', 'og:title', resolvedTitle);
  updateOrCreateMetaTag('meta[property="og:description"]', 'property', 'og:description', resolvedDescription);
  updateOrCreateMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', resolvedTitle);
  updateOrCreateMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description', resolvedDescription);

  // 5. Canonical URL
  // Only emit canonical for public, indexable pages when a verified SITE_URL is configured.
  // Never emit canonicals with invented domains or for private user pages.
  if (!isNoIndex && SITE_URL && input.canonicalPath) {
    const cleanPath = input.canonicalPath.startsWith('/')
      ? input.canonicalPath
      : `/${input.canonicalPath}`;
    updateCanonicalLink(`${SITE_URL}${cleanPath}`);
  } else {
    updateCanonicalLink(undefined);
  }
}
