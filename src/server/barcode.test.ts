import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  isAllowedOrigin,
  getCorsHeaders,
  verifySupabaseAccessToken,
} from './barcode-core';
import { handleBarcodeApiRequest } from './barcode-handler';

function createMockResponse() {
  const headers: Record<string, string> = {};
  let body = '';
  const res = {
    statusCode: 200,
    setHeader(name: string, value: string | number | readonly string[]) {
      headers[name] = Array.isArray(value) ? value.join(', ') : String(value);
      return this;
    },
    end(chunk?: unknown) {
      if (chunk !== undefined) {
        body += typeof chunk === 'string' ? chunk : String(chunk);
      }
      return this;
    },
  } as unknown as ServerResponse;

  return {
    res,
    headers,
    getBody: () => body,
    getJson: () => (body ? JSON.parse(body) : null),
  };
}

function createMockRequest(options: {
  method: string;
  url?: string;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
}) {
  return {
    method: options.method,
    url: options.url ?? '/api/barcode',
    headers: options.headers ?? {},
    body: options.body,
  } as unknown as IncomingMessage & {
    body?: Record<string, unknown>;
    query?: Record<string, string | string[] | undefined>;
  };
}

describe('Barcode Proxy Security & Handler', () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.VITE_SUPABASE_URL = 'https://mock-proj.supabase.co';
    process.env.VITE_SUPABASE_ANON_KEY = 'mock-anon-key';
    delete process.env.ALLOWED_ORIGIN;
    delete process.env.VITE_APP_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('Origin & CORS policy', () => {
    it.each([
      ['https://nittoo.vercel.app', true],
      ['http://localhost:5173', true],
      ['http://127.0.0.1:4173', true],
      ['https://evil.example.com', false],
      [undefined, false],
    ])('isAllowedOrigin(%s) -> %s', (origin, expected) => {
      expect(isAllowedOrigin(origin)).toBe(expected);
    });

    it('rejects disallowed Origin without echoing it in Access-Control-Allow-Origin', () => {
      const headers = getCorsHeaders('https://evil.example.com');
      expect(headers['Access-Control-Allow-Origin']).not.toBe('https://evil.example.com');
      expect(headers['Access-Control-Allow-Origin']).toBe('https://nittoo.vercel.app');
      expect(headers['Vary']).toBe('Origin');
    });

    it('OPTIONS preflight returns 204 with CORS allow headers for allowed origin', async () => {
      const req = createMockRequest({
        method: 'OPTIONS',
        headers: { origin: 'http://localhost:5173' },
      });
      const mockRes = createMockResponse();

      await handleBarcodeApiRequest(req, mockRes.res);

      expect(mockRes.res.statusCode).toBe(204);
      expect(mockRes.headers['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
      expect(mockRes.headers['Access-Control-Allow-Methods']).toBe('GET, POST, OPTIONS');
      expect(mockRes.headers['Access-Control-Allow-Headers']).toContain('Authorization');
      expect(mockRes.headers['Vary']).toBe('Origin');
    });
  });

  describe('JWT authentication gate', () => {
    it('returns 401 when Authorization header is missing and never calls UPCitemdb', async () => {
      const fetchMock = vi.fn();
      globalThis.fetch = fetchMock as typeof fetch;

      const req = createMockRequest({
        method: 'GET',
        url: '/api/barcode?barcode=8901030865299',
        headers: { origin: 'http://localhost:5173' },
      });
      const mockRes = createMockResponse();

      await handleBarcodeApiRequest(req, mockRes.res);

      expect(mockRes.res.statusCode).toBe(401);
      expect(mockRes.getJson().error).toMatch(/Bearer token/i);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns 401 when Supabase rejects the JWT and never calls UPCitemdb', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Invalid JWT' }), { status: 401 })
      );
      globalThis.fetch = fetchMock as typeof fetch;

      const req = createMockRequest({
        method: 'GET',
        url: '/api/barcode?barcode=8901030865299',
        headers: {
          origin: 'http://localhost:5173',
          authorization: 'Bearer bad-jwt-token',
        },
      });
      const mockRes = createMockResponse();

      await handleBarcodeApiRequest(req, mockRes.res);

      expect(mockRes.res.statusCode).toBe(401);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(String(fetchMock.mock.calls[0][0])).toContain('/auth/v1/user');
      expect(
        fetchMock.mock.calls.some(([url]) => String(url).includes('upcitemdb.com'))
      ).toBe(false);
    });

    it('verifySupabaseAccessToken returns valid: true with userId for valid token', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ id: 'user-123' }), { status: 200 })
      ) as typeof fetch;

      const result = await verifySupabaseAccessToken(
        'Bearer valid-token',
        'https://mock-proj.supabase.co',
        'mock-anon-key'
      );

      expect(result).toEqual({ valid: true, userId: 'user-123' });
    });
  });

  describe('Authorized barcode lookup', () => {
    it('returns 200 with normalized product when JWT and origin are valid', async () => {
      const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/auth/v1/user')) {
          return new Response(JSON.stringify({ id: 'user-123' }), { status: 200 });
        }
        if (url.includes('api.upcitemdb.com')) {
          return new Response(
            JSON.stringify({
              code: 'OK',
              total: 1,
              items: [
                {
                  ean: '8901030865299',
                  title: 'Dove Cream Beauty Bathing Bar 100g',
                  brand: 'Dove',
                  category: 'Personal Care',
                },
              ],
            }),
            { status: 200 }
          );
        }
        return new Response('Not found', { status: 404 });
      });
      globalThis.fetch = fetchMock as typeof fetch;

      const req = createMockRequest({
        method: 'GET',
        url: '/api/barcode?barcode=8901030865299',
        headers: {
          origin: 'http://localhost:5173',
          authorization: 'Bearer valid-jwt',
        },
      });
      const mockRes = createMockResponse();

      await handleBarcodeApiRequest(req, mockRes.res);

      expect(mockRes.res.statusCode).toBe(200);
      expect(mockRes.headers['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
      const json = mockRes.getJson();
      expect(json.product).toBeTruthy();
      expect(json.product.barcode).toBe('8901030865299');
      expect(json.product.brand).toBe('Dove');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});
