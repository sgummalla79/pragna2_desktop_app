import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/__tests__/renderWithProviders';
import type { Flow } from '@/domain/types/flow.types';
import type { FlowMeta } from './editorTypes';
import { useFlowEditorStore } from './useFlowEditorStore';
import { FlowMetaBar } from './FlowMetaBar';

/**
 * FlowMetaBar owns the editor's top control bar. Tests cover its own logic:
 * the Description edit flows into the store (Save-gated). Slash exposure + the
 * slash name (and the /slash pill) are managed on the flow card on the main
 * list — NOT in the editor — so the bar must not render them. Save / Cancel
 * live in FlowEditor's footer; Enabled/Disabled lives on the flow card.
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

/** Minimal flowService stub — FlowMetaBar only reads store state, no service calls. */
function services() {
  return {
    flowService: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      validateYaml: vi.fn(),
      saveFromYaml: vi.fn(),
      saveFromYamlById: vi.fn(),
      updateFlow: vi.fn(),
      updateSlashExposure: vi.fn(),
    },
  } as never;
}

beforeEach(() => useFlowEditorStore.getState().reset());

describe('FlowMetaBar', () => {
  it('writes the Description into the store meta (Save-gated)', async () => {
    seedMeta();
    renderWithProviders(
      <FlowMetaBar flow={makeFlow()} dirty={false} />,
      { services: services() },
    );
    await userEvent.type(screen.getByLabelText('Description'), 'Researches accounts');
    expect(useFlowEditorStore.getState().meta.description).toBe('Researches accounts');
  });

  it('does not render slash-exposure controls — they live on the flow card', () => {
    seedMeta({ exposedAsSlash: true, slashApiName: 'do-research' });
    renderWithProviders(
      <FlowMetaBar
        flow={makeFlow({ exposedAsSlash: true, slashApiName: 'do-research' })}
        dirty={false}
      />,
      { services: services() },
    );
    expect(
      screen.queryByRole('checkbox', { name: /Expose as \/slash/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Slash name')).not.toBeInTheDocument();
  });

  it('shows Unsaved pill when dirty, Saved pill when clean', () => {
    seedMeta();
    const { rerender } = renderWithProviders(
      <FlowMetaBar flow={makeFlow()} dirty={false} />,
      { services: services() },
    );
    expect(screen.getByText('Saved')).toBeInTheDocument();
    rerender(<FlowMetaBar flow={makeFlow()} dirty />);
    expect(screen.getByText('Unsaved')).toBeInTheDocument();
  });

  it('shows the flow identity (name + api_name pill) but no slash pill', () => {
    seedMeta();
    renderWithProviders(
      <FlowMetaBar
        flow={makeFlow({ exposedAsSlash: true, slashApiName: 'do-research' })}
        dirty={false}
      />,
      { services: services() },
    );
    expect(screen.getByText('Research')).toBeInTheDocument(); // display name
    expect(screen.getByText('research')).toBeInTheDocument(); // api_name pill
    // Slash exposure is shown on the flow card, not in the editor.
    expect(screen.queryByText('/do-research')).not.toBeInTheDocument();
  });
});
