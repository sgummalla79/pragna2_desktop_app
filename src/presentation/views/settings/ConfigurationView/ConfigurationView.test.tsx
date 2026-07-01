import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/__tests__/renderWithProviders';
import ConfigurationView from './ConfigurationView';

/**
 * Tier 1 tests for the Configuration page.
 *
 * ConfigurationView itself just composes the section cards, so the meaningful
 * coverage is the per-browser chat-action toggles (localStorage via
 * useChatPreferences). The Embeddings — Voyage card moved to the Knowledge
 * page; its behaviour is covered by
 * `KnowledgeView/EmbeddingKeySection.test.tsx`. The chat-actions section uses
 * only localStorage, so no service mocks are needed here.
 */

beforeEach(() => {
  localStorage.clear();
});

describe('ConfigurationView', () => {
  it('renders the page heading and the Chat actions section', () => {
    renderWithProviders(<ConfigurationView />);

    expect(
      screen.getByRole('heading', { name: 'Configuration', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText('Chat actions')).toBeInTheDocument();
  });

  it('renders both chat-action toggles checked by default after expanding', async () => {
    renderWithProviders(<ConfigurationView />);

    // Chat actions section is collapsed by default — expand it first.
    await userEvent.click(screen.getByTestId('chat-actions-toggle'));

    const regen = screen.getByRole('checkbox', {
      name: /Regenerate with a different model/,
    });
    const branch = screen.getByRole('checkbox', { name: /Branch from a user message/ });
    expect(regen).toBeChecked();
    expect(branch).toBeChecked();
  });

  it('persists a chat-action toggle to localStorage when unchecked', async () => {
    renderWithProviders(<ConfigurationView />);

    // Expand the chat actions accordion first.
    await userEvent.click(screen.getByTestId('chat-actions-toggle'));

    const branch = screen.getByRole('checkbox', { name: /Branch from a user message/ });
    await userEvent.click(branch);

    expect(branch).not.toBeChecked();
    const stored = JSON.parse(localStorage.getItem('pragna:chat-prefs') ?? '{}');
    expect(stored.branchEnabled).toBe(false);
  });
});
