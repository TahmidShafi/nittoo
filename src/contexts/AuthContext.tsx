// ==============================================================================
// Nittoo Auth Context
// Dual-Mode Authentication: LocalStorage Mock Mode & Supabase Cloud Auth
// ==============================================================================

import React, { createContext, useState, useEffect, useCallback } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { DEFAULT_MOCK_USER_ID } from '../lib/mock-db';
import { db } from '../lib/dataSource';

export interface AuthUser {
  id: string;
  email: string;
  created_at: string;
}

export interface SignUpResult {
  requiresEmailConfirmation: boolean;
}

export interface UpdateEmailResult {
  requiresConfirmation: boolean;
  message: string;
}

export interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password?: string) => Promise<void>;
  signUp: (email: string, password?: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  sendMagicLink: (email: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (newPassword: string) => Promise<void>;
  updateEmail: (newEmail: string) => Promise<UpdateEmailResult>;
  updatePassword: (newPassword: string) => Promise<void>;
  signOutAllSessions: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

export const MOCK_SESSION_KEY = 'nittoo_auth_session';

/**
 * Generates a deterministic, collision-resistant mock user ID for any email address.
 * Guarantees that demo-user@nittoo.local maps to default-mock-user.
 */
export function generateDeterministicMockUserId(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (normalized === 'demo-user@nittoo.local') {
    return DEFAULT_MOCK_USER_ID;
  }

  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  const slug = normalized.split('@')[0].replace(/[^a-z0-9]/g, '').substring(0, 10);
  return `mock-user-${slug}-${hex}`;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // ----------------------------------------------------------------------------
  // Session Restoration & Listener
  // ----------------------------------------------------------------------------
  useEffect(() => {
    let mounted = true;
    let authSubscription: { unsubscribe: () => void } | null = null;

    async function initializeAuth() {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: { session }, error } = await supabase.auth.getSession();
          if (error) throw error;

          if (mounted && session?.user) {
            setUser((prev) => {
              if (
                prev &&
                prev.id === session.user.id &&
                prev.email === (session.user.email ?? '') &&
                prev.created_at === session.user.created_at
              ) {
                return prev;
              }
              return {
                id: session.user.id,
                email: session.user.email ?? '',
                created_at: session.user.created_at,
              };
            });
          }
        } catch (err) {
          console.error('Failed to restore Supabase session:', err);
        } finally {
          if (mounted) setLoading(false);
        }

        // Listen for Supabase auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          (_event, session) => {
            if (!mounted) return;
            if (session?.user) {
              setUser((prev) => {
                if (
                  prev &&
                  prev.id === session.user.id &&
                  prev.email === (session.user.email ?? '') &&
                  prev.created_at === session.user.created_at
                ) {
                  return prev;
                }
                return {
                  id: session.user.id,
                  email: session.user.email ?? '',
                  created_at: session.user.created_at,
                };
              });
            } else {
              setUser(null);
            }
            setLoading(false);
          }
        );

        authSubscription = subscription;
      } else {
        // Mock mode session restoration
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            const rawSession = window.localStorage.getItem(MOCK_SESSION_KEY);
            if (rawSession) {
              const parsed = JSON.parse(rawSession);
              if (parsed?.user?.id && parsed?.user?.email) {
                if (mounted) {
                  setUser((prev) => {
                    if (
                      prev &&
                      prev.id === parsed.user.id &&
                      prev.email === parsed.user.email &&
                      prev.created_at === parsed.user.created_at
                    ) {
                      return prev;
                    }
                    return parsed.user;
                  });
                }
              }
            }
          }
        } catch (err) {
          console.error('Failed to parse stored mock session:', err);
        } finally {
          if (mounted) setLoading(false);
        }
      }
    }

    initializeAuth();

    return () => {
      mounted = false;
      authSubscription?.unsubscribe();
    };
  }, []);

  // ----------------------------------------------------------------------------
  // Sign In
  // ----------------------------------------------------------------------------
  const signIn = useCallback(async (email: string, password?: string) => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      throw new Error('Please enter a valid email address');
    }

    if (isSupabaseConfigured && supabase) {
      if (!password) throw new Error('Password is required');
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (error) throw error;
      if (data.user) {
        setUser({
          id: data.user.id,
          email: data.user.email ?? trimmedEmail,
          created_at: data.user.created_at,
        });
      }
    } else {
      // Mock Sign In: any valid email + password allowed
      if (!password || password.length < 4) {
        throw new Error('Password must be at least 4 characters');
      }
      const mockId = generateDeterministicMockUserId(trimmedEmail);
      const mockUser: AuthUser = {
        id: mockId,
        email: trimmedEmail.toLowerCase(),
        created_at: new Date().toISOString(),
      };

      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(
          MOCK_SESSION_KEY,
          JSON.stringify({ user: mockUser })
        );
      }
      setUser(mockUser);
    }
  }, []);

  // ----------------------------------------------------------------------------
  // Sign Up
  // ----------------------------------------------------------------------------
  const signUp = useCallback(async (email: string, password?: string): Promise<SignUpResult> => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      throw new Error('Please enter a valid email address');
    }
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
      });
      if (error) throw error;
      if (data.session && data.user) {
        setUser({
          id: data.user.id,
          email: data.user.email ?? trimmedEmail,
          created_at: data.user.created_at,
        });
        return { requiresEmailConfirmation: false };
      }
      // When email confirmation is required, Supabase returns data.user with session === null
      return { requiresEmailConfirmation: true };
    } else {
      // Mock Sign Up: automatically creates and persists user
      const mockId = generateDeterministicMockUserId(trimmedEmail);
      const mockUser: AuthUser = {
        id: mockId,
        email: trimmedEmail.toLowerCase(),
        created_at: new Date().toISOString(),
      };

      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(
          MOCK_SESSION_KEY,
          JSON.stringify({ user: mockUser })
        );
      }
      setUser(mockUser);
      return { requiresEmailConfirmation: false };
    }
  }, []);

  // ----------------------------------------------------------------------------
  // Sign Out
  // ----------------------------------------------------------------------------
  const signOut = useCallback(async () => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } else {
      // Mock Sign Out: clears session token only, leaves user product data untouched
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(MOCK_SESSION_KEY);
      }
    }
    setUser(null);
  }, []);

  // ----------------------------------------------------------------------------
  // Magic Link
  // ----------------------------------------------------------------------------
  const sendMagicLink = useCallback(async (email: string) => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      throw new Error('Please enter a valid email address');
    }

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : undefined,
        },
      });
      if (error) throw error;
    } else {
      // Mock mode: simulate success
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }, []);

  // ----------------------------------------------------------------------------
  // Request Password Reset
  // ----------------------------------------------------------------------------
  const requestPasswordReset = useCallback(async (email: string) => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      throw new Error('Please enter a valid email address');
    }

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined,
      });
      if (error) throw error;
    } else {
      // Mock mode: simulate dispatch
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }, []);

  // ----------------------------------------------------------------------------
  // Reset Password
  // ----------------------------------------------------------------------------
  const resetPassword = useCallback(async (newPassword: string) => {
    if (!newPassword || newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters');
    }

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
    } else {
      // Mock mode: simulate success
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }, []);

  // ----------------------------------------------------------------------------
  // Update Email (Stage 13 / Account Settings)
  // ----------------------------------------------------------------------------
  const updateEmail = useCallback(
    async (newEmail: string): Promise<UpdateEmailResult> => {
      const trimmed = newEmail.trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!trimmed || !emailRegex.test(trimmed)) {
        throw new Error('Please enter a valid email address.');
      }
      if (user && trimmed.toLowerCase() === user.email.toLowerCase()) {
        throw new Error('New email address must differ from your current email.');
      }

      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.auth.updateUser({ email: trimmed });
        if (error) {
          const lowerMsg = error.message.toLowerCase();
          if (lowerMsg.includes('already registered') || lowerMsg.includes('unique')) {
            throw new Error('This email address is already in use by another account.');
          }
          throw new Error("Couldn't update your email. Please try again later.");
        }
        return {
          requiresConfirmation: true,
          message: 'Check your new email to confirm the change.',
        };
      } else {
        // Mock mode: updates mock session and informs user
        if (user) {
          const updated: AuthUser = { ...user, email: trimmed.toLowerCase() };
          setUser(updated);
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(
              MOCK_SESSION_KEY,
              JSON.stringify({ user: updated })
            );
          }
        }
        return {
          requiresConfirmation: true,
          message: 'Check your new email to confirm the change.',
        };
      }
    },
    [user]
  );

  // ----------------------------------------------------------------------------
  // Update Password (Stage 13 / Account Settings)
  // ----------------------------------------------------------------------------
  const updatePassword = useCallback(async (newPassword: string): Promise<void> => {
    if (!newPassword || newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) {
        const lower = error.message.toLowerCase();
        if (lower.includes('reauthenticate') || (error as { status?: number }).status === 401) {
          throw new Error('Please sign out and sign back in to update your password.');
        }
        throw new Error("Couldn't update your password. Please try again later.");
      }
    } else {
      // Mock mode: simulate success
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }, []);

  // ----------------------------------------------------------------------------
  // Sign Out All Sessions (Stage 13 / Account Settings)
  // ----------------------------------------------------------------------------
  const signOutAllSessions = useCallback(async () => {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut({ scope: 'global' });
      } catch (err) {
        console.error('Failed to sign out all sessions globally:', err);
      }
    } else {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(MOCK_SESSION_KEY);
      }
    }
    setUser(null);
  }, []);

  // ----------------------------------------------------------------------------
  // Delete Account (Stage 13 / Account Settings)
  // ----------------------------------------------------------------------------
  const deleteAccount = useCallback(async () => {
    if (!user) return;
    try {
      // 1. Permanently delete all user data (products, purchases, usage periods)
      await db.resetUserData(user.id, true);

      // 2. Global sign-out / session clear
      if (isSupabaseConfigured && supabase) {
        await supabase.auth.signOut({ scope: 'global' });
      } else {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(MOCK_SESSION_KEY);
        }
      }
    } finally {
      setUser(null);
    }
  }, [user]);

  const value: AuthContextType = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    sendMagicLink,
    requestPasswordReset,
    resetPassword,
    updateEmail,
    updatePassword,
    signOutAllSessions,
    deleteAccount,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
