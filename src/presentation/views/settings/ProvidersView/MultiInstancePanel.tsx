import { Button } from '@/components/ui/button';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { ProviderConnectForm } from './ProviderConnectForm';
import { ConnectedPanel } from './ConnectedPanel';
import type { CredentialKind, UserProviderWithModels } from '@/domain/types/provider.types';

interface MultiInstancePanelProps {
  /** Human label of the catalogue provider (e.g. "LLM Gateway"). */
  providerDisplayName: string;
  credentialKind: CredentialKind;
  /** The user's active registrations of this provider. May be empty. */
  registrations: UserProviderWithModels[];

  /** Which registration's detail (model management) is open; null = list view. */
  selectedRegistrationId: string | null;
  onSelectRegistration: (id: string | null) => void;

  // ── Add-another connect form ──
  credentialValues: Record<string, string>;
  onCredentialChange: (key: string, value: string) => void;
  label: string;
  onLabelChange: (value: string) => void;
  connecting: boolean;
  connectError: string;
  onConnect: () => void;

  // ── Per-registration actions (act on the open registration) ──
  onDisconnect: (id: string) => void;
  disconnecting: boolean;
  disconnectError: string;
  onRefresh: (id: string) => void;
  refreshing: boolean;
  refreshError?: string;
  refreshInfo?: string;

  modelEditsDirty: boolean;
  onModelEditsDirtyChange: (dirty: boolean) => void;
}

/**
 * Modal body for a provider that allows multiple concurrent registrations
 * (e.g. an LLM gateway). Master-detail: the list view shows every registration
 * by label plus an "add another" form; selecting one drills into its model
 * grid. Only one ConnectedPanel is mounted at a time, so the modal's
 * dirty-guard tracks a single panel exactly as the single-instance path does.
 */
export function MultiInstancePanel({
  providerDisplayName,
  credentialKind,
  registrations,
  selectedRegistrationId,
  onSelectRegistration,
  credentialValues,
  onCredentialChange,
  label,
  onLabelChange,
  connecting,
  connectError,
  onConnect,
  onDisconnect,
  disconnecting,
  disconnectError,
  onRefresh,
  refreshing,
  refreshError,
  refreshInfo,
  modelEditsDirty,
  onModelEditsDirtyChange,
}: MultiInstancePanelProps) {
  const selected =
    selectedRegistrationId != null
      ? registrations.find((r) => r.id === selectedRegistrationId) ?? null
      : null;

  // ── Detail view: manage one registration's models ──
  if (selected) {
    return (
      <div className="flex flex-col gap-4 flex-1 min-h-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onSelectRegistration(null)}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-muted-foreground bg-transparent border-0 cursor-pointer transition-colors hover:text-accent-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            ← All {providerDisplayName} connections
          </button>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="xs"
              onClick={() => onRefresh(selected.id)}
              disabled={refreshing || disconnecting}
              aria-busy={refreshing}
            >
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </Button>
            <ConfirmButton
              size="xs"
              disabled={disconnecting}
              aria-busy={disconnecting}
              confirmTitle={`Disconnect "${labelOf(selected)}"?`}
              confirmDescription="This archives this connection and disables every model under it. Your usage history is preserved. You can re-connect at any time."
              confirmLabel="Yes, disconnect"
              onConfirm={() => onDisconnect(selected.id)}
            >
              {disconnecting ? 'Removing…' : 'Disconnect'}
            </ConfirmButton>
          </div>
        </div>
        <div>
          <span className="text-sm font-bold text-foreground">{labelOf(selected)}</span>
        </div>
        {refreshError && <p role="alert" className="text-xs text-destructive">{refreshError}</p>}
        {!refreshError && refreshInfo && (
          <p className="text-xs text-muted-foreground" aria-live="polite">{refreshInfo}</p>
        )}
        <ConnectedPanel
          models={selected.models}
          error={disconnectError}
          onDirtyChange={onModelEditsDirtyChange}
        />
      </div>
    );
  }

  // ── List view: registrations + add-another ──
  // Guard against navigating away from a dirty detail panel into the list with
  // unsaved edits silently lost — the parent modal still blocks closing while
  // dirty, and the detail panel is unmounted here so its cleanup clears dirty.
  void modelEditsDirty;

  return (
    <div className="flex flex-col gap-5 flex-1 min-h-0 overflow-y-auto">
      {registrations.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-bold text-foreground">
            Connected
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {registrations.length}{' '}
              {registrations.length === 1 ? 'connection' : 'connections'}
            </span>
          </span>
          <ul className="flex flex-col gap-2 list-none p-0 m-0">
            {registrations.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3.5 py-2.5"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold text-foreground">
                    {labelOf(r)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {r.models.length} {r.models.length === 1 ? 'model' : 'models'}
                    {!r.enabled && ' · disabled'}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => onSelectRegistration(r.id)}
                >
                  Manage
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <span className="text-sm font-bold text-foreground">
          {registrations.length > 0 ? 'Add another connection' : 'Connect'}
        </span>
        <ProviderConnectForm
          credentialKind={credentialKind}
          values={credentialValues}
          onValuesChange={onCredentialChange}
          error={connectError}
          connecting={connecting}
          onConnect={onConnect}
          showLabel
          label={label}
          onLabelChange={onLabelChange}
        />
      </div>
    </div>
  );
}

/** Display label for a registration, with a fallback for the unlabeled case. */
function labelOf(r: UserProviderWithModels): string {
  return r.label && r.label.trim() !== '' ? r.label : 'Unlabeled connection';
}
