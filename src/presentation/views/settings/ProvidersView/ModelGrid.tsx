import { DataGrid, type GridColumn } from '@/components/ui/data-grid';
import { formatUsd } from '@/domain/utils/formatCost';
import type { Model, UpdateModelPayload } from '@/domain/types/model.types';

function perMillion(tokenCost: string): string {
  const n = parseFloat(tokenCost);
  return isFinite(n) && n > 0 ? formatUsd(n * 1_000_000) : '$0.00';
}

/** Column definitions for the model grid — add/reorder columns here. */
const MODEL_COLUMNS: GridColumn<Model>[] = [
  {
    type: 'readonly',
    key: 'modelName',
    header: 'Model',
    render: (m) => (
      <span className="whitespace-nowrap font-mono text-sm text-muted-foreground">{m.modelName}</span>
    ),
  },
  {
    type: 'editable',
    key: 'displayName',
    header: 'Display name',
    getValue: (m) => m.displayName,
    buildPayload: (value) => ({ displayName: value.trim() }),
    isValid: (v) => v.trim().length > 0,
  },
  {
    type: 'readonly',
    key: 'costIn',
    header: '$/1M in',
    align: 'right',
    render: (m) => (
      <span className="whitespace-nowrap font-mono text-sm text-muted-foreground">{perMillion(m.costPerInputToken)}</span>
    ),
  },
  {
    type: 'readonly',
    key: 'costOut',
    header: '$/1M out',
    align: 'right',
    render: (m) => (
      <span className="whitespace-nowrap font-mono text-sm text-muted-foreground">{perMillion(m.costPerOutputToken)}</span>
    ),
  },
  {
    type: 'toggle',
    key: 'enabled',
    header: 'Enabled',
    align: 'center',
    getValue: (m) => m.enabled,
    buildPayload: (m) => ({ enabled: !m.enabled }),
    isDisabled: (m) => m.archived,
  },
  {
    type: 'toggle',
    key: 'availableForChat',
    header: 'Chat',
    align: 'center',
    getValue: (m) => m.availableForChat,
    buildPayload: (m) => ({ availableForChat: !m.availableForChat }),
    isDisabled: (m) => m.archived,
  },
  {
    type: 'toggle',
    key: 'availableForFlows',
    header: 'Flows',
    align: 'center',
    getValue: (m) => m.availableForFlows,
    buildPayload: (m) => ({ availableForFlows: !m.availableForFlows }),
    isDisabled: (m) => m.archived,
  },
];

interface ModelGridProps {
  models: Model[];
  /** Called on blur (editable) or click (toggle) — parent buffers and persists. */
  onCellChange: (id: string, payload: UpdateModelPayload) => void;
  className?: string;
}

/** Model management grid for the provider modal — configured by MODEL_COLUMNS. */
export function ModelGrid({ models, onCellChange, className }: ModelGridProps) {
  return (
    <DataGrid
      className={className}
      columns={MODEL_COLUMNS}
      rows={models}
      getRowId={(m) => m.id}
      onUpdate={(id, payload) => onCellChange(id, payload as UpdateModelPayload)}
      isRowDisabled={(m) => m.archived}
      emptyMessage="No models yet — click Refresh to discover models."
    />
  );
}
