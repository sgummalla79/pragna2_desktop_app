import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/__tests__/renderWithProviders';
import type { Model } from '@/domain/types/model.types';
import type { Agent } from '@/domain/types/agent.types';
import { ROUTES } from '@/constants/routes';
import ChatLandingView from './ChatLandingView';

/**
 * ChatLandingView: gating (needs a chat-eligible model AND a default agent),
 * the setup banner, and the eager-create → stash → navigate handoff on send.
 * Streaming and the session view are out of scope (Tier 2). Navigation is
 * asserted via a mocked useNavigate.
 */

const navigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigate };
});

beforeEach(() => {
  navigate.mockReset();
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
});

function chatModel(over: Partial<Model> & Pick<Model, 'id' | 'displayName'>): Model {
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

function fullAgent(over: Partial<Agent> & Pick<Agent, 'id'>): Agent {
  return {
    apiName: 'a',
    displayName: over.id,
    description: null,
    systemPrompt: '',
    tools: [],
    isDefault: false,
    status: 'active',
    metadata: {},
    createdAt: '2026-01-01T00:00:00Z',
    modifiedAt: '2026-01-01T00:00:00Z',
    ...over,
  } as Agent;
}

const defaultAgent = fullAgent({ id: 'agent-1', isDefault: true });

interface ServiceOpts {
  models?: Model[];
  agent?: Agent | null;
  agents?: Agent[];
  create?: ReturnType<typeof vi.fn>;
}

function makeServices(opts: ServiceOpts = {}) {
  const create = opts.create ?? vi.fn().mockResolvedValue({ id: 'conv-1' });
  // `??` would swallow an intentional `null`, so test for the key's presence.
  const agent = 'agent' in opts ? opts.agent : defaultAgent;
  return {
    services: {
      conversationService: { create },
      agentService: {
        getDefault: vi.fn().mockResolvedValue(agent),
        // The composer's AgentPicker reads this; default to empty so the
        // gating/handoff tests stay focused. Override via `agents` to exercise
        // the create-time agent pin.
        list: vi.fn().mockResolvedValue(opts.agents ?? []),
      },
      modelService: {
        list: vi.fn().mockResolvedValue(opts.models ?? [chatModel({ id: 'm1', displayName: 'Sonnet' })]),
      },
      pragnaFlowService: { listSlashFlows: vi.fn().mockResolvedValue([]) },
    } as never,
    create,
  };
}

describe('ChatLandingView', () => {
  it('renders a time-of-day greeting and the composer placeholder when ready', async () => {
    const { services } = makeServices();
    renderWithProviders(<ChatLandingView />, { services });

    expect(screen.getByRole('heading')).toHaveTextContent(/Good (morning|afternoon|evening)/);
    expect(await screen.findByPlaceholderText('Ask Pragna anything…')).toBeInTheDocument();
  });

  it('shows the setup banner and disables sending when there is no chat-eligible model', async () => {
    const { services } = makeServices({ models: [] });
    renderWithProviders(<ChatLandingView />, { services });

    expect(
      await screen.findByText('Connect a provider and enable a chat model to start chatting.'),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Connect a model to start chatting…')).toBeDisabled();
  });

  it('shows the setup banner when there is no default agent', async () => {
    const { services } = makeServices({ agent: null });
    renderWithProviders(<ChatLandingView />, { services });

    expect(
      await screen.findByText('Connect a provider and enable a chat model to start chatting.'),
    ).toBeInTheDocument();
  });

  it('eager-creates the conversation and navigates to /chat/{id} on send', async () => {
    const { services, create } = makeServices();
    renderWithProviders(<ChatLandingView />, { services });

    const textarea = await screen.findByPlaceholderText('Ask Pragna anything…');
    await userEvent.type(textarea, 'Plan my trip');
    await userEvent.click(screen.getByRole('button', { name: 'Send message' }));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    const arg = create.mock.calls[0][0];
    expect(arg).toMatchObject({ userModelId: null, thinkingEnabled: false });
    expect(typeof arg.threadId).toBe('string');

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith(`${ROUTES.CHAT}/${arg.threadId}`),
    );
  });

  it('pins the resolved default agent at create even when the picker is untouched', async () => {
    // Two active agents → the picker shows (and defaults to) agent-1; the user
    // never touches it, yet create must carry that concrete agent, not null.
    const { services, create } = makeServices({
      agents: [defaultAgent, fullAgent({ id: 'agent-2' })],
    });
    renderWithProviders(<ChatLandingView />, { services });

    const textarea = await screen.findByPlaceholderText('Ask Pragna anything…');
    await userEvent.type(textarea, 'Hello');
    await userEvent.click(screen.getByRole('button', { name: 'Send message' }));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create.mock.calls[0][0]).toMatchObject({ agentId: 'agent-1' });
  });

  it('surfaces a retry error and does not navigate when create fails', async () => {
    const create = vi.fn().mockRejectedValue(new Error('nope'));
    const { services } = makeServices({ create });
    renderWithProviders(<ChatLandingView />, { services });

    const textarea = await screen.findByPlaceholderText('Ask Pragna anything…');
    await userEvent.type(textarea, 'Hello');
    await userEvent.click(screen.getByRole('button', { name: 'Send message' }));

    expect(await screen.findByText(/Could not start chat: nope/)).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });
});
