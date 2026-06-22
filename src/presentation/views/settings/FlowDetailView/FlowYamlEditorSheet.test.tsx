import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/__tests__/renderWithProviders';
import type { YamlError } from '@/domain/types/flowYaml.types';
import { FlowYamlEditorSheet } from './FlowYamlEditorSheet';
import { useFlowEditorStore } from './useFlowEditorStore';
import { NODE_TYPE_AGENT } from './editorTypes';

// CodeMirror is not under test — stub it to a plain textarea so we can drive the
// draft value and exercise the validate / apply logic deterministically in jsdom.
vi.mock('@uiw/react-codemirror', () => ({
  default: ({ value, onChange }: { value: string; onChange?: (v: string) => void }) => (
    <textarea aria-label="YAML editor" value={value} onChange={(e) => onChange?.(e.target.value)} />
  ),
}));
vi.mock('@codemirror/lang-yaml', () => ({ yaml: () => [] }));

// A minimal, parseable flow YAML with one agent node so an Apply-to-Canvas
// hydrate produces an observable node on the canvas.
const GOOD_YAML = `api_name: research
display_name: Research
exposed_as_slash: false
metadata:
  positions:
    __start__: {x: 0, y: 0}
    intake: {x: 100, y: 100}
    __end__: {x: 200, y: 200}
flow:
  nodes:
    - api_name: intake
      display_name: Intake
      system_prompt: Do it.
  edges:
    - from: __start__
      to: intake
    - from: intake
      to: __end__
`;

interface ValidateResult {
  valid: boolean;
  errors: YamlError[];
}

function services(validateYaml?: (def: string) => Promise<ValidateResult>) {
  return {
    flowService: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      validateYaml:
        validateYaml ?? vi.fn(() => Promise.resolve({ valid: true, errors: [] })),
      saveFromYamlById: vi.fn(),
      saveFromYaml: vi.fn(),
      updateSlashExposure: vi.fn(),
    },
  } as never;
}

beforeEach(() => useFlowEditorStore.getState().reset());

describe('FlowYamlEditorSheet', () => {
  it('lists validation errors by path in a collapsible block, and folds them away', async () => {
    const validateYaml = vi.fn(() =>
      Promise.resolve({
        valid: false,
        errors: [
          { path: "flow.nodes['scope'].user_model", message: "Unknown user_model '<CHAT_MODEL>'." },
        ],
      }),
    );
    renderWithProviders(
      <FlowYamlEditorSheet open onOpenChange={vi.fn()} apiName="research" initialYaml={GOOD_YAML} />,
      { services: services(validateYaml) },
    );

    await userEvent.click(screen.getByRole('button', { name: /Validate/ }));

    expect(await screen.findByText(/Unknown user_model/)).toBeInTheDocument();
    const summary = screen.getByText('1 issue blocking save');
    expect(summary).toBeInTheDocument();

    // Collapsible: clicking the summary folds the list away (Radix unmounts it).
    await userEvent.click(summary);
    await waitFor(() =>
      expect(screen.queryByText(/Unknown user_model/)).not.toBeInTheDocument(),
    );
  });

  it('Apply to Canvas replaces the canvas (marks dirty + closes) WITHOUT saving', async () => {
    const onOpenChange = vi.fn();
    const saveFromYamlById = vi.fn();
    renderWithProviders(
      <FlowYamlEditorSheet open onOpenChange={onOpenChange} apiName="research" initialYaml={GOOD_YAML} />,
      {
        services: {
          flowService: {
            list: vi.fn(),
            get: vi.fn(),
            create: vi.fn(),
            delete: vi.fn(),
            validateYaml: vi.fn(),
            saveFromYamlById,
            saveFromYaml: vi.fn(),
            updateSlashExposure: vi.fn(),
          },
        } as never,
      },
    );

    await userEvent.click(screen.getByRole('button', { name: /Apply to Canvas/ }));

    // Canvas hydrated from the YAML, marked dirty, sheet closed — and NO save.
    await waitFor(() =>
      expect(
        useFlowEditorStore.getState().nodes.some((n) => n.type === NODE_TYPE_AGENT),
      ).toBe(true),
    );
    expect(useFlowEditorStore.getState().dirty).toBe(true);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(saveFromYamlById).not.toHaveBeenCalled();
  });

  it('shows a parse error and stays open when the YAML is malformed', async () => {
    const onOpenChange = vi.fn();
    // Unterminated double-quoted scalar — js-yaml rejects it, so buildEditorGraph
    // throws and Apply to Canvas surfaces the parse error instead of closing.
    renderWithProviders(
      <FlowYamlEditorSheet
        open
        onOpenChange={onOpenChange}
        apiName="research"
        initialYaml={'api_name: "unterminated'}
      />,
      { services: services() },
    );

    await userEvent.click(screen.getByRole('button', { name: /Apply to Canvas/ }));

    expect(await screen.findByRole('status')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
