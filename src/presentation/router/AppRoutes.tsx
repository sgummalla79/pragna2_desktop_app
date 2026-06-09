import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { ProtectedRoute } from './ProtectedRoute';
import { GuestOnlyRoute } from './GuestOnlyRoute';

// ── Auth pages ──────────────────────────────────────────────────────────────
const LoginView    = lazy(() => import('@/presentation/views/auth/LoginView'));
const RegisterView = lazy(() => import('@/presentation/views/auth/RegisterView'));

// ── Post-login placeholder ────────────────────────────────────────────────────
// The full chat surface is not yet ported into the desktop app; this minimal
// view confirms an authenticated session and offers logout.
const HomeView = lazy(() => import('@/presentation/views/HomeView'));

export function AppRoutes() {
  return (
    <Suspense fallback={null}>
      <Routes>
        {/* ── Guest-only ── */}
        <Route path={ROUTES.LOGIN}    element={<GuestOnlyRoute><LoginView /></GuestOnlyRoute>} />
        <Route path={ROUTES.REGISTER} element={<GuestOnlyRoute><RegisterView /></GuestOnlyRoute>} />

        {/* ── Protected landing ── */}
        <Route path={ROUTES.CHAT} element={<ProtectedRoute><HomeView /></ProtectedRoute>} />

        {/* ── Fallback ── */}
        <Route path="*" element={<Navigate to={ROUTES.LOGIN} replace />} />
      </Routes>
    </Suspense>
  );
}
