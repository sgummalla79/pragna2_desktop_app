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
  /** Instance label for the multi-instance connect form. */
  const [label, setLabel] = useState('');
  /** Which registration's model grid is open in the multi-instance modal. */
  const [selectedRegistrationId, setSelectedRegistrationId] = useState<string | null>(null);
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

  function resetModalState() {
    setCredentialValues({});
    setLabel('');
    setSelectedRegistrationId(null);
    setConnectError('');
    setDisconnectError('');
    setRefreshError('');
    setRefreshInfo('');
  }

  function openModal(id: string) {
    setSelectedId(id);
    resetModalState();
  }

  function closeModal() {
    setSelectedId(null);
    resetModalState();
  }

  async function handleConnect() {
    if (!selected) return;
    const isMulti = selected.allowsMultipleRegistrations;
    setConnectError('');
    setConnecting(true);
    try {
      const apiKey = serializeCredentials(selected.credentialKind, credentialValues);
      await registerProvider.mutateAsync({
        llmProviderId: selected.id,
        apiKey,
        // Label only travels for multi-instance providers; the backend ignores
        // it elsewhere, but we omit it to keep single-instance requests clean.
        label: isMulti ? label.trim() || undefined : undefined,
      });
      setCredentialValues({});
      if (isMulti) setLabel('');
    } catch (err) {
      // A 409 means a duplicate (provider already registered, or label already
      // used for a multi-instance provider) — use the specific code; otherwise
      // prefer the backend's reason over the generic catalog message.
      setConnectError(
        statusOf(err) === 409
          ? ERRORS.PRV_002.message
          : detailOr(err, ERRORS.PRV_003.message),
      );
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect(registrationId: string) {
    setDisconnectError('');
    setDisconnecting(true);
    try {
      await deleteProvider.mutateAsync(registrationId);
      // Multi-instance: return to the list so the user can manage the rest.
      // Single-instance: nothing left to manage — close the modal.
      if (selected?.allowsMultipleRegistrations) {
        setSelectedRegistrationId(null);
      } else {
        closeModal();
      }
    } catch {
      setDisconnectError(ERRORS.PRV_004.message);
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleRefresh(registrationId: string) {
    setRefreshing(true);
    setRefreshError('');
    setRefreshInfo('');
    try {
      const result = await refreshModels.mutateAsync(registrationId);
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
            const isMulti = item.allowsMultipleRegistrations;
            const count = item.userProviders.length;
            return (
              <ProviderTile
                key={item.id}
                llmProvider={item}
                connected={isMulti ? count > 0 : !!up}
                // Per-registration enable/disable lives in the multi-instance
                // modal; the tile-level pill only applies to single-instance.
                providerEnabled={isMulti ? undefined : up?.enabled}
                onToggleEnabled={
                  isMulti ? undefined : up ? () => handleToggle(up.id, !up.enabled) : undefined
                }
                connectedLabel={
                  isMulti && count > 0
                    ? `${count} connected`
                    : undefined
                }
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
        registrations={selected?.userProviders ?? []}
        open={selectedId !== null}
        onClose={closeModal}
        connecting={connecting}
        connectError={connectError}
        credentialValues={credentialValues}
        onCredentialChange={(key, val) => setCredentialValues((prev) => ({ ...prev, [key]: val }))}
        onConnect={handleConnect}
        label={label}
        onLabelChange={setLabel}
        selectedRegistrationId={selectedRegistrationId}
        onSelectRegistration={setSelectedRegistrationId}
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
