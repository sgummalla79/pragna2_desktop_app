/**
 * Edit-connector modal. Reuses {@link ConnectorDetailsForm} in edit mode,
 * pre-filled from the connector. The BE `PATCH /api/mcp-connectors/{id}` can
 * change name / description / auth method / credentials but NOT the URL or
 * transport (a different URL is a different server) — so those render read-only.
 *
 * Credential inputs start blank ("leave blank to keep the current credentials").
 * The form's `clearCredentials` (true when auth switched to none/oauth) is
 * forwarded so stale credentials are wiped when they no longer apply.
 */

import { Dialog } from 'radix-ui';
import { useState } from 'react';

import { ConnectorsIcon } from '@/presentation/components/icons/ConnectorsIcon';
import { ERRORS } from '@/constants/errors';
import { useDirtyDialog } from '@/presentation/hooks/useDirtyDialog';
import { useUpdateMcpConnector } from '@/presentation/hooks/mcp-connectors/useMcpConnectors';
import { ConnectorDetailsForm, type DetailsSubmit } from './ConnectorDetailsForm';
import type { McpConnector } from '@/domain/types/mcp.types';

interface Props {
  connector: McpConnector;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Modal that edits an existing connector's mutable fields. */
export function EditConnectorModal({ connector, open, onOpenChange }: Props) {
  const update = useUpdateMcpConnector();
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const guard = useDirtyDialog(open && dirty);

  const url =
    typeof connector.config?.url === 'string' ? connector.config.url : '';

  async function handleSubmit(p: DetailsSubmit) {
    setError(null);
    try {
      await update.mutateAsync({
        id: connector.id,
        payload: {
          displayName: p.displayName,
          // Empty string clears the description; the field reflects intent.
          description: p.description ?? '',
          authType: p.authType,
          // Only send credentials when the user entered some (blank = keep).
          credentials: p.credentials,
          clearCredentials: p.clearCredentials,
        },
      });
      setDirty(false);
      onOpenChange(false);
    } catch (err) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? ERRORS.CON_003.message;
      setError(String(detail));
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[700] bg-foreground/40 backdrop-blur-sm" />
        <Dialog.Content
          className="
            fixed left-1/2 top-1/2 z-[701] -translate-x-1/2 -translate-y-1/2
            w-[640px] max-w-[calc(100vw-32px)]
            flex flex-col gap-3
            rounded-xl border border-border
            bg-popover p-5 shadow-2xl
            max-h-[90vh] overflow-y-auto
          "
          {...guard.contentProps}
        >
          <div className="flex flex-col items-center gap-1.5 pb-0">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500 text-white">
              <ConnectorsIcon size={22} aria-hidden="true" />
            </span>
            <Dialog.Title className="text-base font-semibold">
              Edit connector
            </Dialog.Title>
            <Dialog.Description className="sr-only">
              Edit this MCP connector's name, description, and authentication.
            </Dialog.Description>
          </div>

          <ConnectorDetailsForm
            mode="edit"
            urlReadOnly
            initial={{
              displayName: connector.displayName,
              description: connector.description ?? '',
              url,
              transport: connector.transport,
              authType: connector.authType,
            }}
            submitting={update.isPending}
            error={error}
            submitLabel="Save changes"
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
            onDirtyChange={setDirty}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
