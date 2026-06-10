import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { useServices } from '@/presentation/providers/ServiceContext';
import { renderWithProviders } from './renderWithProviders';

/** A probe component that reads an injected service + the router location, so
 *  the test asserts the renderer actually wires both. */
function Probe() {
  const { agentService } = useServices();
  const location = useLocation();
  return (
    <div>
      <span data-testid="path">{location.pathname}</span>
      <span data-testid="has-service">{typeof agentService.list === 'function' ? 'yes' : 'no'}</span>
    </div>
  );
}

describe('renderWithProviders', () => {
  it('injects the supplied services and the router context', () => {
    renderWithProviders(<Probe />, {
      services: { agentService: { list: vi.fn() } as never },
      initialEntries: ['/agents'],
    });
    expect(screen.getByTestId('path')).toHaveTextContent('/agents');
    expect(screen.getByTestId('has-service')).toHaveTextContent('yes');
  });

  it('defaults the route to "/" and returns the query client', () => {
    const { queryClient } = renderWithProviders(
      <span data-testid="ok">ok</span>,
    );
    expect(screen.getByTestId('ok')).toBeInTheDocument();
    expect(queryClient.getDefaultOptions().queries?.retry).toBe(false);
  });
});
