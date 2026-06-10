import { useState } from 'react';
import {
  useLlmProvidersWithRegistrations,
  useRegisterProvider,
  useRefreshModels,
  useDeleteProvider,
  useToggleProvider,
} from '@/presentation/hooks/providers/useProviders';
import { serializeCredentials } from '@/constants/providers';
import { ERRORS } from '@/constants/errors';
import { detailOr, statusOf } from '@/lib/httpError';
import type { RefreshModelsResult } from '@/domain/types/model.types';
import { EntityIcon } from '@/presentation/components/icons/EntityIcon';
import { ProviderTile } from './ProviderTile';
import { ProviderModal } from './ProviderModal';

/**
 * Providers settings page.
 *
 * Stores only `selectedId` — the selected provider is derived from the live
 * query result on every render, so the modal always reflects fresh data after
 * any mutation (toggle, refresh, connect, disconnect).
 */
export default function ProvidersView() {
  const { data: providers = [], isLoading, isError } = useLlmProvidersWithRegistrations();

  const registerProvider = useRegisterProvider();
  const refreshModels = useRefreshModels();
  const deleteProvider = useDeleteProvider();
  const toggleProvider = useToggleProvider();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [credentialValues, setCredentialValues] = useState<Record<string, string>>({});
  const [connectError, setConnectError] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState('');
  const [disconnecting, setDisconnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const [refreshInfo, setRefreshInfo] = useState('');
  const [toggleError, setToggleError] = useState('');
  const [modelEditsDirty, setModelEditsDirty] = useState(false);

  const selected = selectedId ? (providers.find((p) => p.id === selectedId) ?? null) : null;

  function openModal(id: string) {
    setSelectedId(id);
    setCredentialValues({});
    setConnectError('');
    setDisconnectError('');
    setRefreshError('');
    setRefreshInfo('');
  }

  function closeModal() {
    setSelectedId(null);
    setCredentialValues({});
    setConnectError('');
    setDisconnectError('');
    setRefreshError('');
    setRefreshInfo('');
  }

  async function handleConnect() {
    if (!selected) return;
    setConnectError('');
    setConnecting(true);
    try {
      const apiKey = serializeCredentials(selected.credentialKind, credentialValues);
      await registerProvider.mutateAsync({ llmProviderId: selected.id, apiKey });
      setCredentialValues({});
    } catch (err) {
      // A 409 means the provider is already registered — use the specific code;
      // otherwise prefer the backend's reason over the generic catalog message.
      setConnectError(
        statusOf(err) === 409
          ? ERRORS.PRV_002.message
          : detailOr(err, ERRORS.PRV_003.message),
      );
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    const userProvider = selected?.userProviders[0];
    if (!userProvider) return;
    setDisconnectError('');
    setDisconnecting(true);
    try {
      await deleteProvider.mutateAsync(userProvider.id);
      closeModal();
    } catch {
      setDisconnectError(ERRORS.PRV_004.message);
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleRefresh() {
    const userProvider = selected?.userProviders[0];
    if (!userProvider) return;
    setRefreshing(true);
    setRefreshError('');
    setRefreshInfo('');
    try {
      const result = await refreshModels.mutateAsync(userProvider.id);
      setRefreshInfo(summarizeRefresh(result));
    } catch (err) {
      setRefreshError(detailOr(err, ERRORS.PRV_006.message));
    } finally {
      setRefreshing(false);
    }
  }

  function handleToggle(id: string, enabled: boolean) {
    setToggleError('');
    toggleProvider.mutate(
      { id, enabled },
      { onError: (err) => setToggleError(detailOr(err, ERRORS.PRV_007.message)) },
    );
  }

  const activeUserProvider = selected?.userProviders[0] ?? null;
  const modalModels = activeUserProvider?.models ?? [];

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto flex flex-col gap-7">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2.5">
          <EntityIcon entity="providers" size="lg" />
          Providers
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Connect your LLM providers. Click a tile to manage credentials and models.
        </p>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground" aria-live="polite">Loading providers…</p>
      )}
      {isError && (
        <p role="alert" className="text-sm text-destructive">{ERRORS.PRV_005.message}</p>
      )}

      {toggleError && (
        <p role="alert" className="text-sm text-destructive">{toggleError}</p>
      )}

      {!isLoading && !isError && providers.length > 0 && (
        <div className="flex flex-wrap gap-3.5">
          {providers.map((item) => {
            const up = item.userProviders[0];
            return (
              <ProviderTile
                key={item.id}
                llmProvider={item}
                connected={!!up}
                providerEnabled={up?.enabled}
                onToggleEnabled={up ? () => handleToggle(up.id, !up.enabled) : undefined}
                onClick={() => openModal(item.id)}
              />
            );
          })}
        </div>
      )}

      {!isLoading && !isError && providers.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <p className="text-base font-semibold text-foreground">No providers available</p>
          <p className="text-sm text-muted-foreground">Contact your administrator to enable providers.</p>
        </div>
      )}

      <ProviderModal
        llmProvider={selected}
        userProvider={activeUserProvider}
        models={modalModels}
        open={selectedId !== null}
        onClose={closeModal}
        connecting={connecting}
        connectError={connectError}
        credentialValues={credentialValues}
        onCredentialChange={(key, val) => setCredentialValues((prev) => ({ ...prev, [key]: val }))}
        onConnect={handleConnect}
        disconnecting={disconnecting}
        disconnectError={disconnectError}
        onDisconnect={handleDisconnect}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        refreshError={refreshError}
        refreshInfo={refreshInfo}
        modelEditsDirty={modelEditsDirty}
        onModelEditsDirtyChange={setModelEditsDirty}
      />
    </div>
  );
}

/** One-line summary of a model refresh ("2 added · 1 archived · 1 restored"). */
function summarizeRefresh(result: RefreshModelsResult): string {
  const parts: string[] = [];
  if (result.created.length) parts.push(`${result.created.length} added`);
  if (result.archived.length) parts.push(`${result.archived.length} archived`);
  if (result.unarchived.length) parts.push(`${result.unarchived.length} restored`);
  return parts.length ? parts.join(' · ') : 'No changes — models are up to date.';
}
