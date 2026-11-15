// ==============================================================================
// Nittoo PublicOnlyRoute Guard
// Prevents authenticated users from seeing auth pages (redirects to /dashboard)
// ==============================================================================

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface PublicOnlyRouteProps {
  children: React.ReactNode;
}

export const PublicOnlyRoute: React.FC<PublicOnlyRouteProps> = ({ children }) => {
  const { user } = useAuth();

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  // Render public landing/login immediately without blocking on auth network init.
  // If a session resolves in the background, `user` updates and redirects to /dashboard.
  return <>{children}</>;
};
