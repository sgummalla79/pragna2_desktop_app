import type { CredentialKind } from '@/domain/types/provider.types';

/** Canonical machine name for Anthropic — used as a feature gate for
 *  Anthropic-only capabilities like extended thinking. Matches the
 *  ``llm_providers.name`` seed value on the backend. */
export const ANTHROPIC_PROVIDER_NAME = 'anthropic';

// ── Visual design ─────────────────────────────────────────────────────────────
// Brand surface colours used to live here as hardcoded hex values
// (Anthropic copper, OpenAI black, etc.). Removed — every surface now
// reads from the active palette so the provider grid follows theme
// swaps. The actual brand identity is preserved via the SVG logo
// (see :file:`src/assets/logos/*.svg`); the colour-letter fallback
// below is just a neutral placeholder for providers without a logo.

/** Returns palette-driven colour pair for the logo-fallback tile.
 *  Uses CSS variable names so the result flips with the active theme
 *  + palette. */
export function providerColor(_name: string): { bg: string; fg: string } {
  // Underscore-prefixed param kept so call sites don't break; once
  // every caller migrates to the className-based variant we can drop it.
  return { bg: 'var(--color-muted)', fg: 'var(--color-muted-foreground)' };
}

/** Returns the letter initial for a provider logo fallback. */
export function providerInitial(name: string): string {
  const overrides: Record<string, string> = { vertexai: 'V', bedrock: 'B' };
  return overrides[name] ?? name.charAt(0).toUpperCase();
}

// ── Credential form config ────────────────────────────────────────────────────
// Authoritative definition of which fields to render per credential_kind.
// Components iterate this — they never define field lists themselves.

export interface CredentialFieldDef {
  /** Unique key within the form; used as the HTML id and values map key. */
  key: string;
  /** Used as the input placeholder (visible inside the field). No separate label is shown. */
  label: string;
  /** Example value shown as a short hint below the field. */
  placeholder: string;
  /** Short description shown below the input to guide the user. */
  hint: string;
  /** When true, render as a masked password field (PasswordInput). */
  secret: boolean;
  /** When true, render as a textarea instead of a single-line input. */
  multiline?: boolean;
  /** When true, the field is not required; it may be left blank. Used for
   *  gateway fields that only apply to an Anthropic/Bedrock-shaped gateway. */
  optional?: boolean;
  /** Key of a sibling `type:'toggle'` field that gates this one: the field is
   *  only enabled while that toggle is ON. Used so the CA Certificate input is
   *  disabled when SSL verification is off (a custom CA has no effect with
   *  verification disabled). The component reads this generically — it never
   *  hardcodes which fields gate which. */
  enabledWhenToggleOn?: string;
  /**
   * Controls which input widget is rendered.
   * - 'text' (default): Input, PasswordInput, or Textarea depending on `secret`
   *   and `multiline`. Existing fields omit this and get 'text' implicitly.
   * - 'toggle': A labelled switch row. `values[key]` of '' or 'true' = on,
   *   'false' = off. `secret`, `multiline`, and `placeholder` are unused.
   * - 'file': A click-to-select file-upload control with a secondary "Paste"
   *   toggle that falls back to a textarea. Both modes write the file's text
   *   content to `values[key]`. Used for the CA certificate, which is naturally
   *   a `.pem`/`.crt` file artifact. (Drag-drop is intentionally not offered:
   *   Tauri's default `dragDropEnabled: true` intercepts OS file drops before
   *   the webview, so DOM drop events never fire on desktop.)
   */
  type?: 'text' | 'toggle' | 'file';
}

/** Accepted file extensions when uploading a CA certificate. Kept here (not
 *  inlined in the form) so the picker filter is configured in one place. */
export const CA_CERT_FILE_ACCEPT = '.pem,.crt,.cer,.ca-bundle';

export const CREDENTIAL_FIELDS: Record<CredentialKind, CredentialFieldDef[]> = {
  api_key: [
    {
      key:         'apiKey',
      label:       'API Key',
      placeholder: 'sk-ant-api03-…',
      hint:        'Find your API key in your provider\'s developer console.',
      secret:      true,
    },
  ],
  aws_credentials: [
    {
      key:         'accessKeyId',
      label:       'Access Key ID',
      placeholder: 'AKIA…',
      hint:        'Found in AWS → IAM → Security credentials.',
      secret:      false,
    },
    {
      key:         'secretAccessKey',
      label:       'Secret Access Key',
      placeholder: 'wJalr…',
      hint:        'The 40-character secret paired with your Access Key ID.',
      secret:      true,
    },
    {
      key:         'region',
      label:       'AWS Region',
      placeholder: 'us-east-1',
      hint:        'e.g. us-east-1, eu-west-2, ap-southeast-1.',
      secret:      false,
    },
  ],
  gcp_credentials: [
    {
      key:         'serviceAccountJson',
      label:       'Service Account JSON',
      placeholder: '{ "type": "service_account", … }',
      hint:        'Paste the full JSON from GCP → IAM → Service Accounts → Keys.',
      secret:      false,
      multiline:   true,
    },
  ],
  gateway: [
    {
      key:         'baseUrl',
      label:       'Gateway URL',
      placeholder: 'https://your-gateway.example.com/bedrock',
      hint:        'Base URL of the LLM gateway/proxy that fronts your provider.',
      secret:      false,
    },
    {
      key:         'authToken',
      label:       'Auth Token',
      placeholder: 'sk-… / bearer token',
      hint:        'Bearer token your gateway issued you. The gateway holds the upstream cloud credentials.',
      secret:      true,
    },
    {
      key:         'modelsUrl',
      label:       'Models Endpoint (optional)',
      placeholder: 'https://your-gateway.example.com/models',
      hint:        'Optional. For an Anthropic/Bedrock-shaped gateway (no standard /v1/models), the URL that lists available models. Setting this switches the gateway to the Anthropic/Bedrock path.',
      secret:      false,
      optional:    true,
    },
    {
      key:         'awsRegion',
      label:       'AWS Region (optional)',
      placeholder: 'us-east-1',
      hint:        'Optional. Region for the Anthropic/Bedrock client; the gateway holds the AWS credentials. Defaults to us-east-1 when blank.',
      secret:      false,
      optional:    true,
    },
    {
      key:         'verifySsl',
      label:       'Verify SSL certificate',
      placeholder: '',
      hint:        'Disable only for development when providing a CA certificate is not practical. Turning this off skips all TLS verification — do not use in production.',
      secret:      false,
      optional:    true,
      type:        'toggle',
    },
    {
      key:                 'caCert',
      label:               'CA Certificate (optional)',
      placeholder:         '-----BEGIN CERTIFICATE-----\n…\n-----END CERTIFICATE-----',
      hint:                'Optional. PEM-encoded CA certificate for a self-signed or private-CA gateway. When set, the backend uses it to verify the TLS connection instead of the system trust store.',
      secret:              false,
      type:                'file',
      optional:            true,
      // Only meaningful while TLS verification is on; disabled when it's off.
      enabledWhenToggleOn: 'verifySsl',
    },
  ],
};

/**
 * Serializes credential form values to the single api_key string
 * expected by POST /api/user-providers, regardless of credential_kind.
 *
 * - api_key:         returns the raw key value directly.
 * - aws_credentials: JSON-encodes { accessKeyId, secretAccessKey, region }.
 * - gcp_credentials: returns the service-account JSON blob verbatim.
 * - gateway:         JSON-encodes { baseUrl, authToken } for an OpenAI-compatible
 *                    gateway. Optional fields are added ONLY when filled:
 *                    { modelsUrl, awsRegion } switch to the Anthropic/Bedrock path;
 *                    { caCert } (PEM string) supplies a custom CA for TLS;
 *                    { verifySsl: false } (native boolean) skips TLS verification.
 *                    An absent verifySsl key is treated as true by the backend.
 */
export function serializeCredentials(
  kind: CredentialKind,
  values: Record<string, string>
): string {
  switch (kind) {
    case 'api_key':
      return values['apiKey'] ?? '';
    case 'aws_credentials':
      return JSON.stringify({
        accessKeyId:     values['accessKeyId'] ?? '',
        secretAccessKey: values['secretAccessKey'] ?? '',
        region:          values['region'] ?? '',
      });
    case 'gcp_credentials':
      return values['serviceAccountJson'] ?? '';
    case 'gateway': {
      const blob: Record<string, string | boolean> = {
        baseUrl:   values['baseUrl'] ?? '',
        authToken: values['authToken'] ?? '',
      };
      const modelsUrl = values['modelsUrl']?.trim();
      if (modelsUrl) blob['modelsUrl'] = modelsUrl;
      const awsRegion = values['awsRegion']?.trim();
      if (awsRegion) blob['awsRegion'] = awsRegion;
      const caCert = values['caCert']?.trim();
      if (caCert) blob['caCert'] = caCert;
      // Only serialize verifySsl when the toggle is explicitly off — the backend
      // treats an absent key the same as true (verify normally).
      if (values['verifySsl'] === 'false') blob['verifySsl'] = false;
      return JSON.stringify(blob);
    }
  }
}
