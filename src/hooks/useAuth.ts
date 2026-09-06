// ==============================================================================
// Nittoo useAuth Hook
// Consumes AuthContext with runtime guard
// ==============================================================================

import { useContext } from 'react';
import { AuthContext, type AuthContextType } from '../contexts/AuthContext';

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export type { AuthUser } from '../contexts/AuthContext';
