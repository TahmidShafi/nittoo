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
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FBFBFB] flex flex-col justify-center items-center p-6">
        <div className="w-full max-w-sm space-y-4 animate-pulse">
          <div className="w-10 h-10 bg-neutral-200 rounded-xl mx-auto mb-6" />
          <div className="h-6 bg-neutral-200 rounded w-2/3 mx-auto" />
          <div className="h-4 bg-neutral-100 rounded w-1/2 mx-auto" />
          <div className="h-48 bg-neutral-100 rounded-xl mt-6" />
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
