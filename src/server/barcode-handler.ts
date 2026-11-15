// ==============================================================================
// Nittoo Node HTTP Barcode Middleware Handler (Vite Dev / Preview)
// Imports shared validation, CORS, JWT verification, and lookup from barcode-core
// ==============================================================================

import type { IncomingMessage, ServerResponse } from 'http';
import {
  getCorsHeaders,
  verifySupabaseAccessToken,
  lookupUpcItemDbServer,
} from './barcode-core';

export { lookupUpcItemDbServer };

export async function handleBarcodeApiRequest(
  req: IncomingMessage & { body?: any; query?: any },
  res: ServerResponse
): Promise<void> {
  const originHeader = Array.isArray(req.headers.origin)
    ? req.headers.origin[0]
    : req.headers.origin;
  const allowedOrigin = process.env.ALLOWED_ORIGIN || process.env.VITE_APP_URL;
  const corsHeaders = getCorsHeaders(originHeader, allowedOrigin);

  for (const [k, v] of Object.entries(corsHeaders)) {
    res.setHeader(k, v);
  }

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const sendJson = (status: number, payload: unknown) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(payload));
  };

  // Require valid Supabase access token
  const authHeader = Array.isArray(req.headers.authorization)
    ? req.headers.authorization[0]
    : req.headers.authorization;
  const authResult = await verifySupabaseAccessToken(
    authHeader,
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  );

  if (!authResult.valid) {
    sendJson(401, { error: authResult.error || 'Unauthorized' });
    return;
  }

  let barcode = '';

  if (req.method === 'GET') {
    const parsedUrl = new URL(req.url || '', 'http://localhost');
    barcode =
      parsedUrl.searchParams.get('barcode') ||
      parsedUrl.searchParams.get('upc') ||
      (req.query?.barcode as string) ||
      (req.query?.upc as string) ||
      '';
  } else if (req.method === 'POST') {
    if (req.body && typeof req.body === 'object') {
      barcode = req.body.barcode || req.body.upc || '';
    } else {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
      const rawBody = Buffer.concat(chunks).toString('utf-8');
      if (rawBody) {
        try {
          const parsed = JSON.parse(rawBody);
          barcode = parsed.barcode || parsed.upc || '';
        } catch {
          sendJson(400, { error: 'Invalid JSON body' });
          return;
        }
      }
    }
  } else {
    sendJson(405, { error: 'Method not allowed' });
    return;
  }

  const cleanBarcode = barcode.trim();
  if (!cleanBarcode) {
    sendJson(400, { error: 'Barcode parameter is required' });
    return;
  }

  try {
    const product = await lookupUpcItemDbServer(cleanBarcode, {
      apiKey: process.env.UPCITEMDB_API_KEY,
    });
    sendJson(200, { product });
  } catch (err: unknown) {
    const msg = (err as Error)?.message || 'UPCitemdb server lookup error';
    const isValidation = msg.includes('barcode') || msg.includes('check digit');
    sendJson(isValidation ? 400 : 502, { error: msg });
  }
}

export default handleBarcodeApiRequest;
