import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { LedgerPage } from './pages/LedgerPage';
import { ReportsPage } from './pages/ReportsPage';
import { UsersPage } from './pages/UsersPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { AccessDeniedPage, NotFoundPage } from './pages/Placeholders';

// Global TanStack Query Client with sensible caching (UI-2, UI-D13)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true, // Refresh when tab regains focus (UI-D13)
      retry: 1,                   // Retry once on failure before showing error state
      staleTime: 30000,           // 30 seconds fresh cache
    },
  },
});

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                {/* Public Route */}
                <Route path="/login" element={<LoginPage />} />

                {/* Protected Application Routes */}
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<DashboardPage />} />
                  <Route path="transactions" element={<TransactionsPage />} />
                  <Route path="ledger" element={<LedgerPage />} />
                  <Route path="reports" element={<ReportsPage />} />

                  {/* Admin Only Routes (FR-RBAC-3) */}
                  <Route
                    path="categories"
                    element={
                      <ProtectedRoute adminOnly>
                        <CategoriesPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="users"
                    element={
                      <ProtectedRoute adminOnly>
                        <UsersPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="audit-log"
                    element={
                      <ProtectedRoute adminOnly>
                        <AuditLogPage />
                      </ProtectedRoute>
                    }
                  />

                  <Route path="access-denied" element={<AccessDeniedPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
