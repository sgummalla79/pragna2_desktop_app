import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectorDetailsForm } from './ConnectorDetailsForm';

// Radix Select can infinite-loop / be hard to drive in jsdom. Replace the
// design-system Select wrappers with a single native <select> that preserves
// the same value/onValueChange contract so the auth-type discriminator branches
// and the transport picker can be exercised deterministically. The <select> is
// rendered at the Select root and contains the SelectItem <option>s directly so
// userEvent.selectOptions works; the trigger's aria-label/testid are carried via
// context so getByLabelText still resolves it.
vi.mock('@/components/ui/select', async () => {
  const React = await import('react');
  type Ctx = {
    value: string;
    onValueChange: (v: string) => void;
    label?: string;
    testid?: string;
    id?: string;
  };
  const SelectCtx = React.createContext<Ctx | null>(null);

  function Select({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (v: string) => void;
    children: React.ReactNode;
  }) {
    // Discover the trigger's a11y attributes from the child tree so the native
    // <select> carries them.
    let label: string | undefined;
    let testid: string | undefined;
    let id: string | undefined;
    React.Children.forEach(children, (child) => {
      if (React.isValidElement(child) && (child.type as { __isTrigger?: boolean }).__isTrigger) {
        const p = child.props as Record<string, string>;
        label = p['aria-label'];
        testid = p['data-testid'];
        id = p.id;
      }
    });
    return (
      <SelectCtx.Provider value={{ value, onValueChange, label, testid, id }}>
        <SelectNative>{children}</SelectNative>
      </SelectCtx.Provider>
    );
  }

  function SelectNative({ children }: { children: React.ReactNode }) {
    const ctx = React.useContext(SelectCtx)!;
    return (
      <select
        aria-label={ctx.label}
        data-testid={ctx.testid}
        id={ctx.id}
        value={ctx.value}
        onChange={(e) => ctx.onValueChange(e.target.value)}
      >
        {children}
      </select>
    );
  }

  function SelectTrigger() {
    // Rendered only for attribute discovery (see Select); emits nothing itself.
    return null;
  }
  SelectTrigger.__isTrigger = true;

  function SelectValue() {
    return null;
  }
  function SelectContent({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
  }
  function SelectItem({
    value,
    children,
  }: {
    value: string;
    children: React.ReactNode;
  }) {
    return <option value={value}>{children}</option>;
  }
  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
});

function baseProps() {
  return {
    mode: 'create' as const,
    submitting: false,
    error: null,
    submitLabel: 'Connect',
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
  };
}

describe('ConnectorDetailsForm', () => {
  // The name/url inputs also carry the native `required` attribute, so a real
  // click-submit is gated by the browser's constraint validation before the
  // component's handler runs. To exercise the component's *own* validation
  // branch (setLocalError), dispatch the submit event directly on the <form>,
  // bypassing the native gate — that's the only reliable path in jsdom.
  it('blocks submit and shows a name-required error when the name is blank', () => {
    const onSubmit = vi.fn();
    const { container } = render(
      <ConnectorDetailsForm {...baseProps()} onSubmit={onSubmit} />,
    );

    fireEvent.submit(container.querySelector('form')!);

    expect(screen.getByText('Name is required.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('blocks submit and shows a URL-required error when the URL is blank', async () => {
    const onSubmit = vi.fn();
    const { container } = render(
      <ConnectorDetailsForm {...baseProps()} onSubmit={onSubmit} />,
    );

    await userEvent.type(screen.getByLabelText('Name'), 'My Server');
    fireEvent.submit(container.querySelector('form')!);

    expect(screen.getByText('Server URL is required.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a "none" auth connector with no credentials and clearCredentials true', async () => {
    const onSubmit = vi.fn();
    render(<ConnectorDetailsForm {...baseProps()} onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Name'), 'Public Server');
    await userEvent.type(
      screen.getByLabelText('Server URL'),
      'https://mcp.example.com',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }));

    expect(onSubmit).toHaveBeenCalledWith({
      displayName: 'Public Server',
      description: undefined,
      url: 'https://mcp.example.com',
      transport: 'http',
      authType: 'none',
      credentials: undefined,
      clearCredentials: true,
    });
  });

  it('does not render auth-specific fields for the "none" method', () => {
    render(<ConnectorDetailsForm {...baseProps()} />);

    expect(screen.queryByLabelText('API key name')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Add your access token')).not.toBeInTheDocument();
  });

  it('renders the bearer token field and builds an Authorization injection', async () => {
    const onSubmit = vi.fn();
    render(<ConnectorDetailsForm {...baseProps()} onSubmit={onSubmit} />);

    await userEvent.selectOptions(
      screen.getByLabelText('Authentication method'),
      'bearer',
    );
    await userEvent.type(screen.getByLabelText('Name'), 'Stripe');
    await userEvent.type(screen.getByLabelText('Server URL'), 'https://mcp.stripe.com');
    await userEvent.type(
      screen.getByPlaceholderText('Add your access token'),
      'sk_test_123',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        authType: 'bearer',
        clearCredentials: false,
        credentials: {
          injections: [
            { location: 'header', name: 'Authorization', value: 'Bearer sk_test_123' },
          ],
        },
      }),
    );
  });

  it('toggles the bearer token visibility', async () => {
    render(<ConnectorDetailsForm {...baseProps()} />);

    await userEvent.selectOptions(
      screen.getByLabelText('Authentication method'),
      'bearer',
    );
    const tokenInput = screen.getByPlaceholderText('Add your access token');
    expect(tokenInput).toHaveAttribute('type', 'password');

    await userEvent.click(screen.getByRole('button', { name: 'Show token' }));
    expect(tokenInput).toHaveAttribute('type', 'text');
  });

  it('renders api_key fields and builds the injection with the chosen location/name', async () => {
    const onSubmit = vi.fn();
    render(<ConnectorDetailsForm {...baseProps()} onSubmit={onSubmit} />);

    await userEvent.selectOptions(
      screen.getByLabelText('Authentication method'),
      'api_key',
    );
    await userEvent.type(screen.getByLabelText('Name'), 'Tavily');
    await userEvent.type(screen.getByLabelText('Server URL'), 'https://mcp.tavily.com');
    await userEvent.type(screen.getByLabelText('API key name'), 'X-API-Key');
    await userEvent.type(screen.getByLabelText('API key value'), 'secret');
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        authType: 'api_key',
        clearCredentials: false,
        credentials: {
          injections: [{ location: 'header', name: 'X-API-Key', value: 'secret' }],
        },
      }),
    );
  });

  it('renders custom-header rows and builds a header injection per filled row', async () => {
    const onSubmit = vi.fn();
    render(<ConnectorDetailsForm {...baseProps()} onSubmit={onSubmit} />);

    await userEvent.selectOptions(
      screen.getByLabelText('Authentication method'),
      'headers',
    );
    await userEvent.type(screen.getByLabelText('Name'), 'Custom');
    await userEvent.type(screen.getByLabelText('Server URL'), 'https://mcp.example.com');

    // One header row is present by default.
    await userEvent.type(screen.getByPlaceholderText('header'), 'X-Custom');
    await userEvent.type(screen.getByPlaceholderText('value'), 'abc');
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        authType: 'headers',
        credentials: {
          injections: [{ location: 'header', name: 'X-Custom', value: 'abc' }],
        },
      }),
    );
  });

  it('adds and removes custom-header rows', async () => {
    render(<ConnectorDetailsForm {...baseProps()} />);

    await userEvent.selectOptions(
      screen.getByLabelText('Authentication method'),
      'headers',
    );
    expect(screen.getAllByPlaceholderText('header')).toHaveLength(1);

    await userEvent.click(screen.getByRole('button', { name: 'Add header' }));
    expect(screen.getAllByPlaceholderText('header')).toHaveLength(2);

    await userEvent.click(screen.getAllByRole('button', { name: 'Remove header' })[0]);
    expect(screen.getAllByPlaceholderText('header')).toHaveLength(1);
  });

  it('shows the oauth hint, no credential fields, and clearCredentials true on submit', async () => {
    const onSubmit = vi.fn();
    render(<ConnectorDetailsForm {...baseProps()} onSubmit={onSubmit} />);

    await userEvent.selectOptions(
      screen.getByLabelText('Authentication method'),
      'oauth',
    );
    expect(screen.getByText(/You'll connect with OAuth after creating/)).toBeInTheDocument();
    expect(screen.queryByLabelText('API key name')).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Name'), 'Gmail');
    await userEvent.type(screen.getByLabelText('Server URL'), 'https://mcp.gmail.com');
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        authType: 'oauth',
        credentials: undefined,
        clearCredentials: true,
      }),
    );
  });

  it('pre-fills fields from `initial` (preset path)', () => {
    render(
      <ConnectorDetailsForm
        {...baseProps()}
        initial={{
          displayName: 'Tavily',
          url: 'https://mcp.tavily.com',
          transport: 'streamable_http',
          authType: 'api_key',
          apiKeyName: 'tavilyApiKey',
          apiKeyLocation: 'query_param',
        }}
      />,
    );

    expect(screen.getByLabelText('Name')).toHaveValue('Tavily');
    expect(screen.getByLabelText('Server URL')).toHaveValue('https://mcp.tavily.com');
    expect(screen.getByLabelText('API key name')).toHaveValue('tavilyApiKey');
  });

  it('renders the URL read-only with the edit-mode hint when urlReadOnly is set', () => {
    render(
      <ConnectorDetailsForm
        {...baseProps()}
        mode="edit"
        urlReadOnly
        submitLabel="Save changes"
        initial={{ displayName: 'X', url: 'https://x.com', authType: 'none' }}
      />,
    );

    expect(screen.getByLabelText('Server URL')).toHaveAttribute('readonly');
    expect(screen.getByText(/URL can't be changed/)).toBeInTheDocument();
  });

  it('reports dirty state to onDirtyChange when a field changes', async () => {
    const onDirtyChange = vi.fn();
    render(<ConnectorDetailsForm {...baseProps()} onDirtyChange={onDirtyChange} />);

    // Mounts clean.
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    await userEvent.type(screen.getByLabelText('Name'), 'X');
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  });

  it('shows the parent-supplied error and renders a Back button when onBack is provided', () => {
    const onBack = vi.fn();
    render(
      <ConnectorDetailsForm
        {...baseProps()}
        error="Server said no"
        onBack={onBack}
      />,
    );

    expect(screen.getByText('Server said no')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Back/ })).toBeInTheDocument();
  });

  it('calls onCancel from the Cancel button', async () => {
    const onCancel = vi.fn();
    render(<ConnectorDetailsForm {...baseProps()} onCancel={onCancel} />);

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('disables actions and shows the saving label while submitting', () => {
    render(<ConnectorDetailsForm {...baseProps()} submitting submitLabel="Connect" />);

    const submit = screen.getByRole('button', { name: 'Saving…' });
    expect(submit).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});
