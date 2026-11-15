// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockInvoke = vi.fn();
const mockSignOut = vi.fn();
const mockGetSession = vi.fn();
const mockResetUserData = vi.fn();

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

vi.mock('../lib/dataSource', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/dataSource')>();
  return {
    ...actual,
    db: {
      ...actual.db,
      resetUserData: (...args: unknown[]) => mockResetUserData(...args),
    },
  };
});

import {
  AuthProvider,
  generateDeterministicMockUserId,
  withAuthTimeout,
  type AuthContextType,
} from './AuthContext';
import { useAuth } from '../hooks/useAuth';
import { DEFAULT_MOCK_USER_ID } from '../lib/mock-db';

describe('AuthContext', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    window.localStorage.clear();
    mockInvoke.mockReset();
    mockSignOut.mockReset();
    mockGetSession.mockReset();
    mockResetUserData.mockReset();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it('generates deterministic mock user IDs and maps demo-user@nittoo.local', () => {
    expect(generateDeterministicMockUserId('demo-user@nittoo.local')).toBe(DEFAULT_MOCK_USER_ID);
    expect(generateDeterministicMockUserId('  DEMO-USER@NITTOO.LOCAL ')).toBe(DEFAULT_MOCK_USER_ID);
    const id1 = generateDeterministicMockUserId('alice.smith@example.com');
    const id2 = generateDeterministicMockUserId('alice.smith@example.com');
    const bobId = generateDeterministicMockUserId('bob@example.com');
    expect(id1).toBe(id2);
    expect(id1).not.toBe(bobId);
  });

  it('withAuthTimeout rejects hanging promises within timeout without unhandled rejections', async () => {
    let unhandled = false;
    const handler = () => {
      unhandled = true;
    };
    process.on('unhandledRejection', handler);
    try {
      const hanging = new Promise<string>(() => {});
      await expect(withAuthTimeout(hanging, 30)).rejects.toThrow(/timed out/i);

      const fast = Promise.resolve('ok');
      await expect(withAuthTimeout(fast, 100)).resolves.toBe('ok');
      expect(unhandled).toBe(false);
    } finally {
      process.off('unhandledRejection', handler);
    }
  });

  it('deleteAccount keeps user signed in on 401/500 failure and signs out ONLY after 200 success', async () => {
    const sessionUser = {
      id: 'user-123',
      email: 'user@example.com',
      created_at: '2026-01-01T00:00:00Z',
    };
    mockGetSession.mockResolvedValue({ data: { session: { user: sessionUser } }, error: null });
    mockResetUserData.mockResolvedValue(undefined);

    const authHolder: { current: AuthContextType | null } = { current: null };
    const Probe: React.FC = () => {
      authHolder.current = useAuth();
      return null;
    };

    await act(async () => {
      root.render(
        <AuthProvider>
          <Probe />
        </AuthProvider>
      );
    });

    expect(authHolder.current?.user?.id).toBe('user-123');

    // Case 1: 401 / 500 failure -> error thrown, signOut NOT called, user stays signed in
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: 'Unauthorized (401)' },
    });

    await expect(authHolder.current!.deleteAccount()).rejects.toThrow(/Unauthorized/i);
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(authHolder.current?.user?.id).toBe('user-123');

    // Case 2: 200 { success: true } -> signOut called AFTER invoke, user cleared
    const callOrder: string[] = [];
    mockInvoke.mockImplementationOnce(async () => {
      callOrder.push('invoke');
      return { data: { success: true }, error: null };
    });
    mockSignOut.mockImplementationOnce(async () => {
      callOrder.push('signOut');
      return { error: null };
    });

    await act(async () => {
      await authHolder.current!.deleteAccount();
    });

    expect(callOrder).toEqual(['invoke', 'signOut']);
    expect(authHolder.current?.user).toBeNull();
  });
});
