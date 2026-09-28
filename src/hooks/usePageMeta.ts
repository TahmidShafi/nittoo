// ==============================================================================
// Nittoo usePageMeta Hook
// Sets document title, description, robots directives, and canonical tags
// Reverts to default title & description on component unmount
// ==============================================================================

import { useEffect } from 'react';
import { setPageMetadata, PageMetadataInput, DEFAULT_PAGE_TITLE, DEFAULT_META_DESCRIPTION } from '../lib/seo';

export function usePageMeta(options: PageMetadataInput): void {
  useEffect(() => {
    setPageMetadata(options);

    return () => {
      // Revert to brand defaults on unmount
      setPageMetadata({
        title: DEFAULT_PAGE_TITLE,
        description: DEFAULT_META_DESCRIPTION,
        noindex: false,
      });
    };
  }, [options.title, options.description, options.noindex, options.canonicalPath]);
}
