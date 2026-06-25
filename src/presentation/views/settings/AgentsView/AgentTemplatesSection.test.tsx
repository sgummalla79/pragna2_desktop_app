import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/__tests__/renderWithProviders';
import { ERRORS } from '@/constants/errors';
import type { Services } from '@/presentation/providers/ServiceContext';
import type {
  ActivatedAgentTemplate,
  AgentTemplate,
} from '@/domain/types/agentTemplate.types';
import { AgentTemplatesSection } from './AgentTemplatesSection';

/**
 * Tests for the "System agent templates" section.
 *
 * Focus: the loading / error / empty / list branches, the activatable vs
 * already-activated rendering, and the activation flow's user feedback
 * (success toast + the knowledge note only when knowledge was not seeded).
 */

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));
vi.mock('sonner', () => ({ toast }));

/** Build an AgentTemplate with sensible defaults. */
function template(overrides: Partial<AgentTemplate> = {}): AgentTemplate {
  return {
    key: 'nexus-kit-help',
    apiName: 'nexus-kit-help',
    displayName: 'Help & Setup Assistant',
    description: 'Helps you set up Nexus Kit.',
    systemPrompt: 'You help.',
    tools: [],
    activatable: true,
    ...overrides,
  };
}

/** Build an activation result with sensible defaults. */
function activated(
  overrides: Partial<ActivatedAgentTemplate> = {},
): ActivatedAgentTemplate {
  return {
    agent: {
      id: 'a9',
      apiName: 'nexus-kit-help',
      displayName: 'Help & Setup Assistant',
      description: null,
      systemPrompt: 'You help.',
      tools: [],
      isDefault: false,
      status: 'active',
      metadata: {},
      createdAt: 'c',
      modifiedAt: 'm',
    },
    created: true,
    knowledgeSeeded: true,
    knowledgeNote: null,
    ...overrides,
  };
}

/** Section reads only `agentTemplateService` (list, activate). */
function services(
  list: () => Promise<AgentTemplate[]>,
  activate: () => Promise<ActivatedAgentTemplate> = () =>
    Promise.resolve(activated()),
): Partial<Services> {
  return {
    agentTemplateService: { list, activate, get: vi.fn() } as never,
  };
}

beforeEach(() => {
  toast.success.mockReset();
  toast.error.mockReset();
  toast.info.mockReset();
});

describe('AgentTemplatesSection', () => {
  it('shows the loading state while the templates query is pending', () => {
    renderWithProviders(<AgentTemplatesSection />, {
      services: services(() => new Promise(() => {})),
    });
    expect(screen.getByText('Loading templates…')).toBeInTheDocument();
  });

  it('shows the load error when the templates query rejects', async () => {
    renderWithProviders(<AgentTemplatesSection />, {
      services: services(() => Promise.reject(new Error('boom'))),
    });
    expect(await screen.findByText(ERRORS.AGT_008.message)).toBeInTheDocument();
  });

  it('renders nothing when there are no templates', async () => {
    const { container } = renderWithProviders(<AgentTemplatesSection />, {
      services: services(() => Promise.resolve([])),
    });
    await waitFor(() =>
      expect(screen.queryByText('Loading templates…')).not.toBeInTheDocument(),
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('lists a template with its handle and an Activate button', async () => {
    renderWithProviders(<AgentTemplatesSection />, {
      services: services(() => Promise.resolve([template()])),
    });
    expect(await screen.findByText('Help & Setup Assistant')).toBeInTheDocument();
    expect(screen.getByText('nexus-kit-help')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Activate Help & Setup Assistant' }),
    ).toBeInTheDocument();
  });

  it('shows an Activated badge and no Activate button when not activatable', async () => {
    renderWithProviders(<AgentTemplatesSection />, {
      services: services(() => Promise.resolve([template({ activatable: false })])),
    });
    expect(await screen.findByText('Activated')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Activate/ }),
    ).not.toBeInTheDocument();
  });

  it('activates on click and shows a success toast', async () => {
    const activate = vi.fn().mockResolvedValue(activated({ created: true }));
    renderWithProviders(<AgentTemplatesSection />, {
      services: services(() => Promise.resolve([template()]), activate),
    });
    await userEvent.click(
      await screen.findByRole('button', { name: 'Activate Help & Setup Assistant' }),
    );
    expect(activate).toHaveBeenCalledWith('nexus-kit-help');
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Help & Setup Assistant activated.'),
    );
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('surfaces the knowledge note when knowledge was not seeded', async () => {
    const note = 'No embedding key; running from built-in overview.';
    const activate = vi
      .fn()
      .mockResolvedValue(activated({ knowledgeSeeded: false, knowledgeNote: note }));
    renderWithProviders(<AgentTemplatesSection />, {
      services: services(() => Promise.resolve([template()]), activate),
    });
    await userEvent.click(
      await screen.findByRole('button', { name: 'Activate Help & Setup Assistant' }),
    );
    await waitFor(() => expect(toast.info).toHaveBeenCalledWith(note));
  });

  it('shows an error toast when activation fails', async () => {
    const activate = vi.fn().mockRejectedValue(new Error('nope'));
    renderWithProviders(<AgentTemplatesSection />, {
      services: services(() => Promise.resolve([template()]), activate),
    });
    await userEvent.click(
      await screen.findByRole('button', { name: 'Activate Help & Setup Assistant' }),
    );
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(ERRORS.AGT_009.message),
    );
  });
});
