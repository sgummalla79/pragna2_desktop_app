import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders } from '@/__tests__/renderWithProviders';
import type { Agent } from '@/domain/types/agent.types';
import { AgentPicker } from './AgentPicker';

/**
 * AgentPicker is built on the Radix-based shadcn `Select`. Opening it in jsdom
 * can infinite-loop (documented setup caveat — see ModelPicker.test), so these
 * tests assert the closed trigger state + the disabled flag only. The
 * open-menu / option-click path is left to manual / e2e.
 */

function agent(over: Partial<Agent> & Pick<Agent, 'id' | 'displayName'>): Agent {
  return {
    apiName: 'a',
    description: null,
    systemPrompt: '',
    tools: [],
    isDefault: false,
    status: 'active',
    metadata: {},
    createdAt: '2026-01-01T00:00:00Z',
    modifiedAt: '2026-01-01T00:00:00Z',
    ...over,
  };
}

/** Mock the agents list query the picker reads via useAgents. */
function servicesFor(agents: Agent[]) {
  return {
    agentService: { list: vi.fn().mockResolvedValue(agents) },
  } as never;
}

describe('AgentPicker', () => {
  it('renders nothing while the agents query is loading', () => {
    const services = {
      agentService: { list: vi.fn().mockReturnValue(new Promise(() => {})) },
    } as never;
    const { container } = renderWithProviders(
      <AgentPicker agentId={null} onAgentChange={vi.fn()} />,
      { services },
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the user has no active agents', async () => {
    const { container } = renderWithProviders(
      <AgentPicker agentId={null} onAgentChange={vi.fn()} />,
      { services: servicesFor([agent({ id: '1', displayName: 'Parked', status: 'inactive' })]) },
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the trigger with the pinned agent when its id is active', async () => {
    const { findByLabelText } = renderWithProviders(
      <AgentPicker agentId="2" onAgentChange={vi.fn()} />,
      {
        services: servicesFor([
          agent({ id: '1', displayName: 'Sales', isDefault: true }),
          agent({ id: '2', displayName: 'Service' }),
        ]),
      },
    );
    const trigger = await findByLabelText('Switch agent');
    expect(trigger).toHaveTextContent('Service');
  });

  it('soft-defaults the trigger to the default agent when no id is pinned', async () => {
    const { findByLabelText } = renderWithProviders(
      <AgentPicker agentId={null} onAgentChange={vi.fn()} />,
      {
        services: servicesFor([
          agent({ id: '1', displayName: 'Sales' }),
          agent({ id: '2', displayName: 'Service', isDefault: true }),
        ]),
      },
    );
    const trigger = await findByLabelText('Switch agent');
    expect(trigger).toHaveTextContent('Service');
  });

  it('soft-defaults to the default agent when the pinned id is not active', async () => {
    const { findByLabelText } = renderWithProviders(
      <AgentPicker agentId="archived-1" onAgentChange={vi.fn()} />,
      {
        services: servicesFor([
          agent({ id: '1', displayName: 'Sales', isDefault: true }),
          agent({ id: '2', displayName: 'Service' }),
        ]),
      },
    );
    const trigger = await findByLabelText('Switch agent');
    expect(trigger).toHaveTextContent('Sales');
  });

  it('disables the trigger while a run is in flight', async () => {
    const { findByLabelText } = renderWithProviders(
      <AgentPicker agentId="1" onAgentChange={vi.fn()} disabled />,
      { services: servicesFor([agent({ id: '1', displayName: 'Sales', isDefault: true })]) },
    );
    const trigger = await findByLabelText('Switch agent');
    expect(trigger).toBeDisabled();
  });
});
