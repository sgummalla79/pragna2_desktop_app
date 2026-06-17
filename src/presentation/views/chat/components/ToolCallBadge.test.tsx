import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToolCallBadge } from './ToolCallBadge';
import type { ChatToolCall } from '@/presentation/views/chat/hooks/useChatSession';

function call(overrides: Partial<ChatToolCall> = {}): ChatToolCall {
  return {
    id: 't1',
    name: 'mcp_tavily_tavily_search',
    argsBuffer: '',
    args: { query: 'current trends in AI 2024', time_range: 'month', max_results: 5 },
    complete: true,
    ...overrides,
  };
}

describe('ToolCallBadge', () => {
  it('shows a friendly label + primary argument, never the raw internal name', () => {
    render(<ToolCallBadge call={call()} />);
    expect(
      screen.getByText('Tavily Search · current trends in AI 2024'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/mcp_tavily_tavily_search/)).toBeNull();
  });

  it('collapsed by default: hides the arguments', () => {
    render(<ToolCallBadge call={call()} />);
    expect(screen.queryByText('Time range:')).toBeNull();
    expect(screen.queryByText('Done')).toBeNull();
  });

  it('expands into readable key/value args — no raw JSON, no result', async () => {
    const raw = '{"results":[{"url":"https://example.com"}]}';
    render(<ToolCallBadge call={call({ result: raw })} />);
    await userEvent.click(screen.getByRole('button'));

    expect(screen.getByText('Query:')).toBeInTheDocument();
    expect(screen.getByText('Time range:')).toBeInTheDocument();
    expect(screen.getByText('month')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
    // The raw result payload must never be rendered (the URL inside it, nor any
    // JSON braces from the result blob).
    expect(screen.queryByText(/example\.com/)).toBeNull();
    expect(screen.queryByText(/"results"/)).toBeNull();
  });

  it('summarizes array args by count instead of dumping JSON', async () => {
    render(
      <ToolCallBadge
        call={call({ args: { query: 'x', include_domains: ['a.com', 'b.com'] } })}
      />,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByText('2 items')).toBeInTheDocument();
    expect(screen.queryByText(/a\.com/)).toBeNull();
  });

  it('shows a "Working…" footer while the call is still streaming', async () => {
    render(<ToolCallBadge call={call({ complete: false })} />);
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Working…')).toBeInTheDocument();
  });
});
