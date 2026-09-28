// ==============================================================================
// Nittoo App Root Router
// Integrates AuthProvider, ProtectedRoute guards, and PublicOnlyRoute guards
// ==============================================================================

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicOnlyRoute } from './components/PublicOnlyRoute';
import { Layout } from './components/Layout';

// ==============================================================================
// Lazy-Loaded Page Components (Route-Level Code Splitting)
// Prevents downloading heavy page bundles (e.g. charts, compare, details)
// on initial entry to login or auth routes.
// ==============================================================================
const LoginPage = React.lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const SignupPage = React.lazy(() => import('./pages/SignupPage').then((m) => ({ default: m.SignupPage })));
const ForgotPasswordPage = React.lazy(() => import('./pages/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = React.lazy(() => import('./pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })));
const AccountPage = React.lazy(() => import('./pages/AccountPage').then((m) => ({ default: m.AccountPage })));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const ProductDetailPage = React.lazy(() => import('./pages/ProductDetailPage').then((m) => ({ default: m.ProductDetailPage })));
const AddProductPage = React.lazy(() => import('./pages/AddProductPage').then((m) => ({ default: m.AddProductPage })));
const AnalyticsPage = React.lazy(() => import('./pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })));
const InventoryPage = React.lazy(() => import('./pages/InventoryPage').then((m) => ({ default: m.InventoryPage })));
const AddInventoryPage = React.lazy(() => import('./pages/AddInventoryPage').then((m) => ({ default: m.AddInventoryPage })));
const ProductComparisonPage = React.lazy(() => import('./pages/ProductComparisonPage').then((m) => ({ default: m.ProductComparisonPage })));

const PageLoadingFallback: React.FC = () => (
  <div className="min-h-screen bg-[#FBFBFB] flex flex-col justify-center items-center p-6">
    <div className="w-full max-w-md space-y-4 animate-pulse">
      <div className="w-10 h-10 bg-neutral-200 rounded-xl mx-auto mb-6" />
      <div className="h-6 bg-neutral-200 rounded w-3/4 mx-auto" />
      <div className="h-4 bg-neutral-100 rounded w-1/2 mx-auto" />
      <div className="h-28 bg-neutral-100 rounded-xl mt-6" />
    </div>
  </div>
);

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <React.Suspense fallback={<PageLoadingFallback />}>
        <Routes>
        {/* Public-Only Auth Routes (Redirect to /dashboard if already logged in) */}
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <LoginPage />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicOnlyRoute>
              <SignupPage />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <PublicOnlyRoute>
              <ForgotPasswordPage />
            </PublicOnlyRoute>
          }
        />

        {/* Password Recovery Endpoint (Open during recovery flow) */}
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Protected Application Routes (Redirect to /login if unauthenticated) */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Layout>
                <DashboardPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/product/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <ProductDetailPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/add-product"
          element={
            <ProtectedRoute>
              <Layout>
                <AddProductPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory"
          element={
            <ProtectedRoute>
              <Layout>
                <InventoryPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/add-inventory"
          element={
            <ProtectedRoute>
              <Layout>
                <AddInventoryPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/compare"
          element={
            <ProtectedRoute>
              <Layout>
                <ProductComparisonPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute>
              <Layout>
                <AnalyticsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/account"
          element={
            <ProtectedRoute>
              <Layout>
                <AccountPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Fallback & Root Redirection */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </React.Suspense>
    </AuthProvider>
  );
};

export default App;
