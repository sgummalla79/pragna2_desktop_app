import { Dialog } from 'radix-ui';
import { cn } from '@/lib/utils';
import { providerColor, providerInitial } from '@/constants/providers';
import { PROVIDER_LOGO_URLS, MONO_BLACK_PROVIDERS } from '@/assets/providerLogos';
import { Button } from '@/components/ui/button';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { useDirtyDialog } from '@/presentation/hooks/useDirtyDialog';
import { ProviderConnectForm } from './ProviderConnectForm';
import { ConnectedPanel } from './ConnectedPanel';
import { MultiInstancePanel } from './MultiInstancePanel';
import type {
  LlmProvider,
  UserProvider,
  UserProviderWithModels,
} from '@/domain/types/provider.types';
import type { Model } from '@/domain/types/model.types';

interface ProviderModalProps {
  llmProvider: LlmProvider | null;
  /** The single-instance registration (provider has one active row). */
  userProvider: UserProvider | null;
  models: Model[];
  /** All active registrations — used for the multi-instance master-detail view. */
  registrations: UserProviderWithModels[];
  open: boolean;
  onClose: () => void;

  disconnecting: boolean;
  disconnectError: string;
  /** Archive a registration by id (single-instance passes its sole id). */
  onDisconnect: (id: string) => void;

  credentialValues: Record<string, string>;
  onCredentialChange: (key: string, value: string) => void;
  connectError: string;
  connecting: boolean;
  onConnect: () => void;
  /** Instance label (multi-instance connect form only). */
  label: string;
  onLabelChange: (value: string) => void;

  /** Which registration's model grid is open (multi-instance); null = list view. */
  selectedRegistrationId: string | null;
  onSelectRegistration: (id: string | null) => void;

  refreshing: boolean;
  /** Re-discover models for a registration by id. */
  onRefresh: (id: string) => void;
  /** Error from the last refresh, if any (rendered under the refresh action). */
  refreshError?: string;
  /** Success summary from the last refresh (e.g. "2 added · 1 archived"). */
  refreshInfo?: string;

  modelEditsDirty: boolean;
  onModelEditsDirtyChange: (dirty: boolean) => void;
}

/**
 * Modal dialog for a single LLM provider. Dispatches to the connect form or the
 * connected panel based on whether the user has registered the provider.
 */
export function ProviderModal({
  llmProvider,
  userProvider,
  models,
  registrations,
  open,
  onClose,
  disconnecting,
  disconnectError,
  onDisconnect,
  credentialValues,
  onCredentialChange,
  connectError,
  connecting,
  onConnect,
  label,
  onLabelChange,
  selectedRegistrationId,
  onSelectRegistration,
  refreshing,
  onRefresh,
  refreshError,
  refreshInfo,
  modelEditsDirty,
  onModelEditsDirtyChange,
}: ProviderModalProps) {
  // Escape + overlay click blocked when the model grid has unsaved edits.
  const guard = useDirtyDialog(modelEditsDirty);

  if (!llmProvider) return null;

  // Multi-instance providers (e.g. an LLM gateway) render the master-detail
  // panel; their per-registration actions live inside it, not the header.
  const multi = llmProvider.allowsMultipleRegistrations;

  const { bg, fg } = providerColor(llmProvider.name);
  const logoUrl = PROVIDER_LOGO_URLS[llmProvider.name];
  const isMonoBlack = MONO_BLACK_PROVIDERS.has(llmProvider.name);

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[600] bg-foreground/40 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[601] -translate-x-1/2 -translate-y-1/2 w-[1100px] max-w-[calc(100vw-32px)] max-h-[90vh] overflow-hidden flex flex-col gap-[18px] rounded-xl border border-border bg-popover p-7 shadow-2xl"
          aria-describedby={undefined}
          {...guard.contentProps}
        >
          {/* Header */}
          <div className="flex flex-shrink-0 items-start gap-3.5">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={llmProvider.name}
                className={cn('h-9 w-9 flex-shrink-0 rounded-md object-contain', isMonoBlack && 'invert')}
              />
            ) : (
              <div
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-base font-bold"
                style={{ background: bg, color: fg }}
                aria-hidden="true"
              >
                {providerInitial(llmProvider.name)}
              </div>
            )}

            <div className="flex flex-1 min-w-0 flex-col gap-1">
              <div className="flex items-center gap-2">
                <Dialog.Title className="text-base font-bold text-foreground m-0">
                  {llmProvider.displayName}
                </Dialog.Title>
                {!multi && userProvider && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
                    aria-label="Connected"
                  >
                    <span aria-hidden="true">✓</span>
                    Connected
                  </span>
                )}
                {multi && registrations.length > 0 && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
                    aria-label="Connected count"
                  >
                    {registrations.length} connected
                  </span>
                )}
              </div>
              <Dialog.Description className="text-xs text-muted-foreground m-0">
                {multi
                  ? 'Manage your connections — add as many as you need.'
                  : userProvider
                    ? 'Manage your connected provider.'
                    : 'Enter your credentials to connect.'}
              </Dialog.Description>
              {!multi && userProvider && (
                <div className="mt-1 flex items-center gap-2">
                  <ConfirmButton
                    size="xs"
                    disabled={disconnecting}
                    aria-busy={disconnecting}
                    confirmTitle={`Disconnect ${llmProvider.displayName}?`}
                    confirmDescription="This archives your registration and disables every model under it. Your usage history is preserved. You can re-connect at any time."
                    confirmLabel="Yes, disconnect"
                    onConfirm={() => onDisconnect(userProvider.id)}
                  >
                    {disconnecting ? 'Removing…' : 'Disconnect'}
                  </ConfirmButton>
                  <Button
                    variant="default"
                    size="xs"
                    onClick={() => onRefresh(userProvider.id)}
                    disabled={refreshing || disconnecting}
                    aria-busy={refreshing}
                  >
                    {refreshing ? 'Refreshing…' : 'Refresh'}
                  </Button>
                </div>
              )}
              {!multi && userProvider && refreshError && (
                <p role="alert" className="mt-1 text-xs text-destructive">{refreshError}</p>
              )}
              {!multi && userProvider && !refreshError && refreshInfo && (
                <p className="mt-1 text-xs text-muted-foreground" aria-live="polite">{refreshInfo}</p>
              )}
            </div>

            <div className="flex flex-shrink-0 items-center gap-2">
              <Dialog.Close
                className="rounded-md px-1.5 py-0.5 text-base text-muted-foreground border-0 bg-transparent cursor-pointer transition-colors duration-150 hover:text-accent-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Close"
              >
                ✕
              </Dialog.Close>
            </div>
          </div>

          {/* Body */}
          {multi ? (
            <MultiInstancePanel
              providerDisplayName={llmProvider.displayName}
              credentialKind={llmProvider.credentialKind}
              registrations={registrations}
              selectedRegistrationId={selectedRegistrationId}
              onSelectRegistration={onSelectRegistration}
              credentialValues={credentialValues}
              onCredentialChange={onCredentialChange}
              label={label}
              onLabelChange={onLabelChange}
              connecting={connecting}
              connectError={connectError}
              onConnect={onConnect}
              onDisconnect={onDisconnect}
              disconnecting={disconnecting}
              disconnectError={disconnectError}
              onRefresh={onRefresh}
              refreshing={refreshing}
              refreshError={refreshError}
              refreshInfo={refreshInfo}
              modelEditsDirty={modelEditsDirty}
              onModelEditsDirtyChange={onModelEditsDirtyChange}
            />
          ) : userProvider ? (
            <ConnectedPanel
              models={models}
              error={disconnectError}
              onDirtyChange={onModelEditsDirtyChange}
            />
          ) : (
            <ProviderConnectForm
              credentialKind={llmProvider.credentialKind}
              values={credentialValues}
              onValuesChange={onCredentialChange}
              error={connectError}
              connecting={connecting}
              onConnect={onConnect}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
