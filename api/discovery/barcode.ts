// ==============================================================================
// Vercel Edge Function: /api/discovery/barcode
// Pure Web Standard Request/Response handler (no Node-only Buffer/IncomingMessage)
// ==============================================================================

import {
  getCorsHeaders,
  verifySupabaseAccessToken,
  lookupUpcItemDbServer,
} from '../../src/server/barcode-core';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request): Promise<Response> {
  const origin = req.headers.get('origin');
  const allowedOrigin = process.env.ALLOWED_ORIGIN || process.env.VITE_APP_URL;
  const corsHeaders = getCorsHeaders(origin, allowedOrigin);

  const jsonResponse = (status: number, data: unknown) =>
    new Response(JSON.stringify(data), {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Require valid Supabase access token
  const authResult = await verifySupabaseAccessToken(
    req.headers.get('authorization'),
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  );

  if (!authResult.valid) {
    return jsonResponse(401, { error: authResult.error || 'Unauthorized' });
  }

  let barcode = '';

  if (req.method === 'GET') {
    const parsedUrl = new URL(req.url);
    barcode = parsedUrl.searchParams.get('barcode') || parsedUrl.searchParams.get('upc') || '';
  } else if (req.method === 'POST') {
    try {
      const body = (await req.json()) as { barcode?: string; upc?: string } | null;
      barcode = body?.barcode || body?.upc || '';
    } catch {
      return jsonResponse(400, { error: 'Invalid JSON body' });
    }
  } else {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const cleanBarcode = barcode.trim();
  if (!cleanBarcode) {
    return jsonResponse(400, { error: 'Barcode parameter is required' });
  }

  try {
    const product = await lookupUpcItemDbServer(cleanBarcode, {
      apiKey: process.env.UPCITEMDB_API_KEY,
    });
    return jsonResponse(200, { product });
  } catch (err: unknown) {
    const msg = (err as Error)?.message || 'UPCitemdb server lookup error';
    const isValidation = msg.includes('barcode') || msg.includes('check digit');
    return jsonResponse(isValidation ? 400 : 502, { error: msg });
  }
}
