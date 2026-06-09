import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { useBulkUpdateModels } from '@/presentation/hooks/models/useModels';
import { ModelGrid } from './ModelGrid';
import type { Model, UpdateModelPayload } from '@/domain/types/model.types';

interface ConnectedPanelProps {
  models: Model[];
  /** Surface for errors raised by the disconnect button (rendered in the modal header). */
  error: string;
  /** Notified when the pending-changes buffer transitions empty ↔ non-empty. */
  onDirtyChange?: (dirty: boolean) => void;
}

/**
 * Modal panel shown when the provider is already connected. Owns a
 * `pendingChanges` buffer keyed by model id; the toolbar exposes Save (bulk
 * PATCH in one transaction) and Cancel (discard + remount the grid).
 */
export function ConnectedPanel({ models, error, onDirtyChange }: ConnectedPanelProps) {
  const [pendingChanges, setPendingChanges] = useState<Record<string, UpdateModelPayload>>({});
  const [resetKey, setResetKey] = useState(0);

  const bulkUpdate = useBulkUpdateModels();

  const effectiveModels = useMemo<Model[]>(() => {
    const sorted = [...models].sort((a, b) => {
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
      return a.displayName.localeCompare(b.displayName);
    });
    return sorted.map((m) => ({ ...m, ...applyPending(m, pendingChanges[m.id]) }));
  }, [models, pendingChanges]);

  const dirtyCount = Object.keys(pendingChanges).length;
  const isDirty = dirtyCount > 0;
  const saving = bulkUpdate.isPending;

  useEffect(() => {
    onDirtyChange?.(isDirty);
    return () => onDirtyChange?.(false);
  }, [isDirty, onDirtyChange]);

  function handleCellChange(id: string, payload: UpdateModelPayload) {
    setPendingChanges((prev) => {
      const merged = { ...(prev[id] ?? {}), ...payload };
      const original = models.find((m) => m.id === id);
      if (original && isNoOp(original, merged)) {
        const { [id]: _drop, ...rest } = prev;
        void _drop;
        return rest;
      }
      return { ...prev, [id]: merged };
    });
  }

  function handleCancel() {
    setPendingChanges({});
    setResetKey((v) => v + 1);
  }

  async function handleSave() {
    if (!isDirty || saving) return;
    const updates = Object.entries(pendingChanges).map(([id, payload]) => ({ id, ...payload }));
    await bulkUpdate.mutateAsync(updates);
    setPendingChanges({});
    setResetKey((v) => v + 1);
  }

  return (
    <div className="flex flex-col gap-5 flex-1 min-h-0">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-bold text-foreground">
            Models
            {models.length > 0 && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {models.length} discovered
              </span>
            )}
            {isDirty && (
              <span className="ml-2 text-xs font-normal text-primary">
                · {dirtyCount} unsaved {dirtyCount === 1 ? 'change' : 'changes'}
              </span>
            )}
          </span>
          <span className="text-xs text-muted-foreground">
            Click display name to rename · Dots toggle on/off · Save commits all changes at once
          </span>
        </div>
        <div className="flex items-center gap-2 [&>button]:min-w-[80px]">
          <ConfirmButton
            variant="destructive"
            size="xs"
            disabled={!isDirty || saving}
            confirmTitle="Discard unsaved changes?"
            confirmDescription={`${dirtyCount} ${dirtyCount === 1 ? 'row' : 'rows'} will be reverted to their saved state. This cannot be undone.`}
            confirmLabel="Yes, discard"
            onConfirm={handleCancel}
          >
            Cancel
          </ConfirmButton>
          <Button
            variant="default"
            size="xs"
            onClick={handleSave}
            disabled={!isDirty || saving}
            aria-busy={saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      <ModelGrid key={resetKey} models={effectiveModels} onCellChange={handleCellChange} className="flex-1 min-h-0" />
    </div>
  );
}

/** Reduce a partial payload to only the keys present (used to apply pending edits over a model). */
function applyPending(_model: Model, partial: UpdateModelPayload | undefined): Partial<Model> {
  if (!partial) return {};
  const out: Partial<Model> = {};
  if (partial.enabled !== undefined) out.enabled = partial.enabled;
  if (partial.availableForChat !== undefined) out.availableForChat = partial.availableForChat;
  if (partial.availableForFlows !== undefined) out.availableForFlows = partial.availableForFlows;
  if (partial.displayName !== undefined) out.displayName = partial.displayName;
  if (partial.metadata !== undefined) out.metadata = partial.metadata;
  return out;
}

/** True when every field in `partial` matches the corresponding field on `original`. */
function isNoOp(original: Model, partial: UpdateModelPayload): boolean {
  if (partial.enabled !== undefined && partial.enabled !== original.enabled) return false;
  if (partial.availableForChat !== undefined && partial.availableForChat !== original.availableForChat) return false;
  if (partial.availableForFlows !== undefined && partial.availableForFlows !== original.availableForFlows) return false;
  if (partial.displayName !== undefined && partial.displayName !== original.displayName) return false;
  if (partial.metadata !== undefined) return false;
  return true;
}
