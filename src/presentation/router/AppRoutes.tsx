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
const ConfigurationView = lazy(() => import('@/presentation/views/settings/ConfigurationView/ConfigurationView'));
const ConnectorsView = lazy(() => import('@/presentation/views/settings/ConnectorsView/ConnectorsView'));
const LocalServersView = lazy(() => import('@/presentation/views/settings/LocalServersView/LocalServersView'));
const KnowledgeView = lazy(() => import('@/presentation/views/settings/KnowledgeView/KnowledgeView'));
const AgentsView = lazy(() => import('@/presentation/views/settings/AgentsView/AgentsView'));
const FlowsView = lazy(() => import('@/presentation/views/settings/FlowsView/FlowsView'));
const FlowDetailView = lazy(() => import('@/presentation/views/settings/FlowDetailView/FlowDetailView'));
const AppearanceView = lazy(() => import('@/presentation/views/settings/AppearanceView/AppearanceView'));
const PlaceholderView = lazy(() => import('@/presentation/views/settings/PlaceholderView'));

// ── Chat ────────────────────────────────────────────────────────────────────
const ChatView = lazy(() => import('@/presentation/views/chat/ChatView'));
const ChatLandingView = lazy(() => import('@/presentation/views/chat/ChatLandingView'));
const ChatSessionView = lazy(() => import('@/presentation/views/chat/ChatSessionView'));
const ChatsBrowserView = lazy(() => import('@/presentation/views/chat/ChatsBrowserView'));

export function AppRoutes() {
  return (
    <Suspense fallback={null}>
      <Routes>
        {/* ── Guest-only ── */}
        <Route path={ROUTES.LOGIN} element={<GuestOnlyRoute><LoginView /></GuestOnlyRoute>} />
        <Route path={ROUTES.REGISTER} element={<GuestOnlyRoute><RegisterView /></GuestOnlyRoute>} />

        {/* ── Settings (2-panel layout) — the current post-login landing ── */}
        <Route path={ROUTES.SETTINGS} element={<ProtectedRoute><SettingsLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to={ROUTES.SETTINGS_CONFIGURATION} replace />} />
          <Route path={ROUTES.SETTINGS_PROVIDERS} element={<ProvidersView />} />
          <Route path={ROUTES.SETTINGS_CONFIGURATION} element={<ConfigurationView />} />
          <Route path={ROUTES.SETTINGS_CONNECTORS} element={<ConnectorsView />} />
          <Route path={ROUTES.SETTINGS_LOCAL_SERVERS} element={<LocalServersView />} />
          <Route path={ROUTES.SETTINGS_KNOWLEDGE} element={<KnowledgeView />} />
          <Route path={ROUTES.SETTINGS_AGENTS} element={<AgentsView />} />
          <Route path={ROUTES.SETTINGS_FLOWS} element={<FlowsView />} />
          <Route path={ROUTES.SETTINGS_FLOW_DETAIL} element={<FlowDetailView />} />
          <Route path={ROUTES.SETTINGS_APPEARANCE} element={<AppearanceView />} />
          {/* Profile page not yet implemented — see pragna2-tracker TD-031. */}
          <Route path={ROUTES.SETTINGS_PROFILE} element={<PlaceholderView />} />
        </Route>

        {/* ── Chat (sidebar + conversation) — the post-login landing ── */}
        <Route path={ROUTES.CHAT} element={<ProtectedRoute><ChatView /></ProtectedRoute>}>
          <Route index element={<ChatLandingView />} />
          {/* Static `history` ranks above the dynamic `:id` in React Router. */}
          <Route path="history" element={<ChatsBrowserView />} />
          <Route path=":id" element={<ChatSessionView />} />
        </Route>

        {/* ── Fallback ── */}
        <Route path="*" element={<Navigate to={ROUTES.LOGIN} replace />} />
      </Routes>
    </Suspense>
  );
}
