import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Textarea } from '@/components/ui/textarea';
import { CREDENTIAL_FIELDS } from '@/constants/providers';
import type { CredentialKind } from '@/domain/types/provider.types';

interface ProviderConnectFormProps {
  credentialKind: CredentialKind;
  values: Record<string, string>;
  onValuesChange: (key: string, value: string) => void;
  error: string;
  connecting: boolean;
  onConnect: () => void;
  /**
   * When true, render a required instance-label field above the credential
   * fields. Set for multi-instance providers (e.g. an LLM gateway) so each
   * registration is named; the Connect button stays disabled until it's filled.
   */
  showLabel?: boolean;
  /** Current label value (only used when `showLabel`). */
  label?: string;
  /** Label change handler (only used when `showLabel`). */
  onLabelChange?: (value: string) => void;
}

/**
 * Form shown inside the provider modal when a provider is not yet connected.
 * Fields are driven entirely by the CREDENTIAL_FIELDS config — the field label
 * is used as the placeholder, with a short hint below each field.
 */
export function ProviderConnectForm({
  credentialKind,
  values,
  onValuesChange,
  error,
  connecting,
  onConnect,
  showLabel = false,
  label = '',
  onLabelChange,
}: ProviderConnectFormProps) {
  const fields = CREDENTIAL_FIELDS[credentialKind];
  const labelMissing = showLabel && label.trim() === '';

  return (
    <div className="flex flex-col gap-4">
      {showLabel && (
        <div className="flex flex-col gap-1.5">
          <Input
            id="instance-label"
            placeholder="Label"
            aria-label="Label"
            value={label}
            onChange={(e) => onLabelChange?.(e.target.value)}
            className={error ? 'border-destructive' : undefined}
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            <span className="font-mono text-muted-foreground">e.g. prod, staging</span>
            {'  ·  '}
            A name to tell this connection apart from your others.
          </p>
        </div>
      )}

      {fields.map((field) => (
        <div key={field.key} className="flex flex-col gap-1.5">
          {field.multiline ? (
            <Textarea
              id={field.key}
              placeholder={field.label}
              aria-label={field.label}
              value={values[field.key] ?? ''}
              onChange={(e) => onValuesChange(field.key, e.target.value)}
              rows={5}
              className={error ? 'border-destructive' : undefined}
            />
          ) : field.secret ? (
            <PasswordInput
              id={field.key}
              placeholder={field.label}
              aria-label={field.label}
              value={values[field.key] ?? ''}
              onChange={(e) => onValuesChange(field.key, e.target.value)}
              autoComplete="off"
              className={error ? 'border-destructive' : undefined}
            />
          ) : (
            <Input
              id={field.key}
              placeholder={field.label}
              aria-label={field.label}
              value={values[field.key] ?? ''}
              onChange={(e) => onValuesChange(field.key, e.target.value)}
              className={error ? 'border-destructive' : undefined}
            />
          )}

          <p className="text-xs leading-relaxed text-muted-foreground">
            {field.placeholder && (
              <span className="font-mono text-muted-foreground">{field.placeholder}</span>
            )}
            {field.placeholder && field.hint && '  ·  '}
            {field.hint}
          </p>
        </div>
      ))}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Button
        onClick={onConnect}
        disabled={connecting || labelMissing}
        aria-busy={connecting}
        className="w-full"
      >
        {connecting ? 'Connecting…' : 'Connect'}
      </Button>
    </div>
  );
}
