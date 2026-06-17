import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/__tests__/renderWithProviders';
import type { Flow } from '@/domain/types/flow.types';
import type { FlowMeta } from './editorTypes';
import { useFlowEditorStore } from './useFlowEditorStore';
import { FlowMetaBar } from './FlowMetaBar';

/**
 * FlowMetaBar owns the editor's top control bar. Tests cover its own logic:
 * graph-meta edits flow into the store (Save-gated), the enabled toggle is an
 * immediate PATCH, and the "description required before exposing" hint.
 */

function makeFlow(over: Partial<Flow> = {}): Flow {
  return {
    id: 'f1',
    apiName: 'research',
    displayName: 'Research',
    description: null,
    enabled: true,
    slashApiName: null,
    exposedAsSlash: false,
    metadata: {},
    definition: null,
    nodes: [],
    edges: [],
    ...over,
  };
}

function seedMeta(over: Partial<FlowMeta> = {}): void {
  act(() =>
    useFlowEditorStore.getState().hydrate({
      meta: {
        apiName: 'research',
        displayName: 'Research',
        description: null,
        slashApiName: null,
        exposedAsSlash: false,
        metadata: {},
        ...over,
      },
      nodes: [],
      edges: [],
    }),
  );
}

/** flowService stub — only updateFlow is exercised here. */
function services(updateFlow = vi.fn(() => Promise.resolve(makeFlow()))) {
  return {
    flowService: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      validateYaml: vi.fn(),
      saveFromYaml: vi.fn(),
      saveFromYamlById: vi.fn(),
      updateFlow,
      updateSlashExposure: vi.fn(),
    },
  } as never;
}

beforeEach(() => useFlowEditorStore.getState().reset());

describe('FlowMetaBar', () => {
  it('writes the Description into the store meta (Save-gated)', async () => {
    seedMeta();
    renderWithProviders(
      <FlowMetaBar flow={makeFlow()} dirty={false} isSaving={false} onSave={vi.fn()} />,
      { services: services() },
    );
    await userEvent.type(screen.getByLabelText('Description'), 'Researches accounts');
    expect(useFlowEditorStore.getState().meta.description).toBe('Researches accounts');
  });

  it('toggling Enabled fires an immediate updateFlow PATCH with the flipped value', async () => {
    seedMeta();
    const updateFlow = vi.fn(() => Promise.resolve(makeFlow({ enabled: false })));
    renderWithProviders(
      <FlowMetaBar flow={makeFlow({ enabled: true })} dirty={false} isSaving={false} onSave={vi.fn()} />,
      { services: services(updateFlow) },
    );
    await userEvent.click(screen.getByRole('button', { name: 'Enabled' }));
    await waitFor(() =>
      expect(updateFlow).toHaveBeenCalledWith('f1', { enabled: false }),
    );
  });

  it('warns that a description is required when exposing without one', async () => {
    seedMeta({ description: null, exposedAsSlash: false });
    renderWithProviders(
      <FlowMetaBar flow={makeFlow()} dirty={false} isSaving={false} onSave={vi.fn()} />,
      { services: services() },
    );
    await userEvent.click(screen.getByRole('checkbox', { name: /Expose as \/slash/ }));
    expect(screen.getByText(/Add a description before exposing/)).toBeInTheDocument();
  });

  it('Save is gated on dirty and calls onSave', async () => {
    seedMeta();
    const onSave = vi.fn();
    const { rerender } = renderWithProviders(
      <FlowMetaBar flow={makeFlow()} dirty={false} isSaving={false} onSave={onSave} />,
      { services: services() },
    );
    expect(screen.getByRole('button', { name: /Save/ })).toBeDisabled();
    rerender(<FlowMetaBar flow={makeFlow()} dirty isSaving={false} onSave={onSave} />);
    await userEvent.click(screen.getByRole('button', { name: /Save/ }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('shows the flow identity (name + api_name pill, slash pill when exposed)', () => {
    seedMeta();
    renderWithProviders(
      <FlowMetaBar
        flow={makeFlow({ exposedAsSlash: true, slashApiName: 'do-research' })}
        dirty={false}
        isSaving={false}
        onSave={vi.fn()}
      />,
      { services: services() },
    );
    expect(screen.getByText('Research')).toBeInTheDocument(); // display name
    expect(screen.getByText('research')).toBeInTheDocument(); // api_name pill
    expect(screen.getByText('/do-research')).toBeInTheDocument(); // slash pill
  });
});
