import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { ProtectedRoute } from './ProtectedRoute';
import { GuestOnlyRoute } from './GuestOnlyRoute';
import { SettingsLayout } from '@/presentation/components/settings/SettingsLayout/SettingsLayout';

// ── Auth pages ──────────────────────────────────────────────────────────────
const LoginView = lazy(() => import('@/presentation/views/auth/LoginView'));
const RegisterView = lazy(() => import('@/presentation/views/auth/RegisterView'));

// ── Settings views ────────────────────────────────────────────────────────────
const ProvidersView = lazy(() => import('@/presentation/views/settings/ProvidersView/ProvidersView'));
const PlaceholderView = lazy(() => import('@/presentation/views/settings/PlaceholderView'));

// Post-login placeholder home (kept for when chat becomes the landing).
const HomeView = lazy(() => import('@/presentation/views/HomeView'));

export function AppRoutes() {
  return (
    <Suspense fallback={null}>
      <Routes>
        {/* ── Guest-only ── */}
        <Route path={ROUTES.LOGIN} element={<GuestOnlyRoute><LoginView /></GuestOnlyRoute>} />
        <Route path={ROUTES.REGISTER} element={<GuestOnlyRoute><RegisterView /></GuestOnlyRoute>} />

        {/* ── Settings (2-panel layout) — the current post-login landing ── */}
        <Route path={ROUTES.SETTINGS} element={<ProtectedRoute><SettingsLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to={ROUTES.SETTINGS_PROVIDERS} replace />} />
          <Route path={ROUTES.SETTINGS_PROVIDERS} element={<ProvidersView />} />
          <Route path={ROUTES.SETTINGS_CONFIGURATION} element={<PlaceholderView />} />
          <Route path={ROUTES.SETTINGS_CONNECTORS} element={<PlaceholderView />} />
          <Route path={ROUTES.SETTINGS_KNOWLEDGE} element={<PlaceholderView />} />
          <Route path={ROUTES.SETTINGS_AGENTS} element={<PlaceholderView />} />
          <Route path={ROUTES.SETTINGS_FLOWS} element={<PlaceholderView />} />
          <Route path={ROUTES.SETTINGS_APPEARANCE} element={<PlaceholderView />} />
          <Route path={ROUTES.SETTINGS_PROFILE} element={<PlaceholderView />} />
        </Route>

        {/* ── Protected placeholder home (chat lands here later) ── */}
        <Route path={ROUTES.CHAT} element={<ProtectedRoute><HomeView /></ProtectedRoute>} />

        {/* ── Fallback ── */}
        <Route path="*" element={<Navigate to={ROUTES.LOGIN} replace />} />
      </Routes>
    </Suspense>
  );
}
