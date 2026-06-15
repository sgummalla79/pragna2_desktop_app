import { useRef } from 'react';
import { Switch } from 'radix-ui';
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
 *
 * Fields with `type: 'toggle'` render as a labelled switch row.
 * Fields with `multiline: true` render a Browse button that opens a native file
 * picker and reads the selected file's text content into the textarea (used for
 * the CA Certificate field).
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

  // One hidden file input per multiline field — keyed by field.key via ref map.
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function handleFilePick(fieldKey: string, file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === 'string') onValuesChange(fieldKey, text);
    };
    reader.readAsText(file);
  }

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
          {field.type === 'toggle' ? (
            // Toggle row: hint is rendered inline; the hint <p> below is suppressed.
            <div className="flex items-center justify-between gap-3 rounded-lg border border-input px-3 py-2.5">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium leading-none text-foreground">
                  {field.label}
                </span>
                {field.hint && (
                  <p className="text-xs leading-relaxed text-muted-foreground">{field.hint}</p>
                )}
              </div>
              <Switch.Root
                id={field.key}
                aria-label={field.label}
                checked={values[field.key] !== 'false'}
                onCheckedChange={(checked) =>
                  onValuesChange(field.key, checked ? 'true' : 'false')
                }
                className="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=checked]:bg-primary data-[state=unchecked]:bg-input"
              >
                <Switch.Thumb className="pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0" />
              </Switch.Root>
            </div>
          ) : field.multiline ? (
            <>
              {/* Hidden file input — Browse button triggers it */}
              <input
                ref={(el) => { fileInputRefs.current[field.key] = el; }}
                type="file"
                accept=".pem,.crt,.cer,.ca-bundle"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFilePick(field.key, file);
                  // Reset so the same file can be re-selected after a clear.
                  e.target.value = '';
                }}
              />
              <div className="flex items-center gap-2">
                <Textarea
                  id={field.key}
                  placeholder={field.label}
                  aria-label={field.label}
                  value={values[field.key] ?? ''}
                  onChange={(e) => onValuesChange(field.key, e.target.value)}
                  rows={5}
                  className={`flex-1 font-mono text-xs ${error ? 'border-destructive' : ''}`}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => fileInputRefs.current[field.key]?.click()}
              >
                Browse…
              </Button>
            </>
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

          {/* Hint row — suppressed for toggle fields (hint is inline in the toggle row) */}
          {field.type !== 'toggle' && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {field.placeholder && (
                <span className="font-mono text-muted-foreground">{field.placeholder}</span>
              )}
              {field.placeholder && field.hint && '  ·  '}
              {field.hint}
            </p>
          )}
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
