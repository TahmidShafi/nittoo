// ==============================================================================
// Nittoo ProtectedRoute Guard
// Guards private routes, preserves intended destination in location state
// ==============================================================================

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FBFBFB] flex flex-col justify-center items-center p-6">
        <div className="w-full max-w-md space-y-4">
          <div className="w-10 h-10 skeleton-shimmer rounded-xl mx-auto mb-6" />
          <div className="h-6 skeleton-shimmer rounded w-3/4 mx-auto" />
          <div className="h-4 skeleton-shimmer rounded w-1/2 mx-auto" />
          <div className="h-28 skeleton-shimmer rounded-xl mt-6" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
