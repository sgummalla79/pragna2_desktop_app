import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/__tests__/renderWithProviders';
import type { Model } from '@/domain/types/model.types';
import { ModelPicker } from './ModelPicker';

/**
 * ModelPicker is built on the Radix-based shadcn `Select`. Opening it in jsdom
 * can infinite-loop (documented setup caveat), so these tests assert the closed
 * trigger state only — the trigger label reflects the active model. The
 * open-menu / option-click path is left to Tier 2 / manual.
 */

function model(over: Partial<Model> & Pick<Model, 'id' | 'displayName'>): Model {
  return {
    userProviderId: 'p1',
    modelName: 'm',
    costPerInputToken: '0',
    costPerOutputToken: '0',
    enabled: true,
    availableForChat: true,
    availableForFlows: false,
    archived: false,
    metadata: {},
    supportsVision: false,
    supportsPdf: false,
    ...over,
  };
}

/** Mock the shared models query the picker reads via useChatModels. */
function servicesFor(models: Model[]) {
  return {
    modelService: { list: vi.fn().mockResolvedValue(models) },
  } as never;
}

describe('ModelPicker', () => {
  it('renders nothing while the models query is loading', () => {
    // A never-resolving list keeps useModels in the loading state.
    const services = {
      modelService: { list: vi.fn().mockReturnValue(new Promise(() => {})) },
    } as never;
    const { container } = renderWithProviders(
      <ModelPicker userModelId={null} onModelChange={vi.fn()} />,
      { services },
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when there are no chat-eligible models', async () => {
    // Model exists but is not chat-eligible (availableForChat false → filtered out).
    const { container } = renderWithProviders(
      <ModelPicker userModelId={null} onModelChange={vi.fn()} />,
      { services: servicesFor([model({ id: '1', displayName: 'GPT', availableForChat: false })]) },
    );
    // Wait a tick for the query to resolve, then assert still empty.
    await new Promise((r) => setTimeout(r, 0));
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the trigger with the pinned model when its id is eligible', async () => {
    const { findByLabelText } = renderWithProviders(
      <ModelPicker userModelId="2" onModelChange={vi.fn()} />,
      {
        services: servicesFor([
          model({ id: '1', displayName: 'Claude Sonnet' }),
          model({ id: '2', displayName: 'Claude Opus' }),
        ]),
      },
    );
    const trigger = await findByLabelText('Switch model');
    expect(trigger).toHaveTextContent('Claude Opus');
  });

  it('soft-defaults the trigger to the first option when the pinned id is not eligible', async () => {
    const { findByLabelText } = renderWithProviders(
      <ModelPicker userModelId="missing" onModelChange={vi.fn()} />,
      {
        services: servicesFor([
          model({ id: '1', displayName: 'Claude Sonnet' }),
          model({ id: '2', displayName: 'Claude Opus' }),
        ]),
      },
    );
    const trigger = await findByLabelText('Switch model');
    expect(trigger).toHaveTextContent('Claude Sonnet');
  });

  it('soft-defaults the trigger to the first option when no id is pinned', async () => {
    renderWithProviders(<ModelPicker userModelId={null} onModelChange={vi.fn()} />, {
      services: servicesFor([
        model({ id: '1', displayName: 'Claude Sonnet' }),
        model({ id: '2', displayName: 'Claude Opus' }),
      ]),
    });
    expect(await screen.findByText('Claude Sonnet')).toBeInTheDocument();
  });
});
