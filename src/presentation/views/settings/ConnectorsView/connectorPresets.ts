/**
 * Curated catalogue of well-known MCP servers shown in the "Add connector"
 * gallery. Picking a preset pre-fills the details form (URL + auth method +
 * transport) so the common servers are one click + one credential away.
 *
 * Tiles show each service's real brand icon, fetched from its domain's favicon
 * ({@link faviconUrl}) — or a Simple Icons slug ({@link simpleIconUrl}) — with
 * a monogram chip as the graceful fallback if the icon can't load (offline /
 * CSP / unknown domain).
 *
 * These are **starter defaults the user reviews before connecting** — the URL
 * and auth specifics are editable on the next step. The long-term home for this
 * catalogue is a BE-served endpoint (so it changes without a redeploy). Until
 * then it lives here as named data, never inlined in component logic.
 */

import type {
  InjectionLocation,
  McpAuthType,
  McpOAuthConfig,
  McpTransport,
} from '@/domain/types/mcp.types';

export interface ConnectorPreset {
  /** Stable id (also the gallery tile testid suffix). */
  id: string;
  /** Default display name (the user can rename). */
  name: string;
  /** One-line description of what the server offers. */
  blurb: string;
  /** Pre-filled server URL (best-effort; user verifies). Empty = user pastes. */
  url: string;
  /** Pre-selected auth method. */
  authType: McpAuthType;
  /** Pre-selected transport. */
  transport: McpTransport;
  /** Domain whose favicon is the tile's brand icon. */
  iconDomain: string;
  /** Optional Simple Icons slug — used instead of the favicon when the domain
   *  favicon is the wrong/generic logo (e.g. Google products share one favicon).
   */
  iconSlug?: string;
  /** Fallback monogram (1–2 chars) shown if the brand icon fails to load. */
  monogram: string;
  /** Tailwind background class for the fallback monogram chip. */
  accent: string;
  /** For `api_key` presets: the default key name + where it's sent. */
  apiKeyName?: string;
  apiKeyLocation?: InjectionLocation;
  /** Optional provider docs link. */
  docsUrl?: string;
  /** Extra flags merged into `config.oauth` at connector-creation time, beyond
   *  what the user fills in (clientId / loginUrl / callbackPort). These flags
   *  never appear in the form — they are preset-injected and forwarded opaquely
   *  to the backend. Currently used only for `omitResourceAtTokenExchange`. */
  oauthExtraFlags?: Pick<McpOAuthConfig, 'omitResourceAtTokenExchange'>;
}

/** Build a brand-icon URL from a domain (Google's public favicon service). */
export function faviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

/** Build a brand-icon URL from a Simple Icons slug (official colored logo). */
export function simpleIconUrl(slug: string): string {
  return `https://cdn.simpleicons.org/${slug}`;
}

/** The known-server gallery. Order = display order. */
export const CONNECTOR_PRESETS: readonly ConnectorPreset[] = [
  {
    id: 'gmail',
    name: 'Gmail',
    blurb: 'Read and send email.',
    url: '',
    authType: 'oauth',
    transport: 'streamable_http',
    iconDomain: 'gmail.com',
    iconSlug: 'gmail',
    monogram: 'Gm',
    accent: 'bg-red-500',
    docsUrl: 'https://developers.google.com/gmail',
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    blurb: 'Events and scheduling.',
    url: '',
    authType: 'oauth',
    transport: 'streamable_http',
    iconDomain: 'calendar.google.com',
    iconSlug: 'googlecalendar',
    monogram: 'GC',
    accent: 'bg-blue-500',
    docsUrl: 'https://developers.google.com/calendar',
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    blurb: 'Search and read files.',
    url: '',
    authType: 'oauth',
    transport: 'streamable_http',
    iconDomain: 'drive.google.com',
    iconSlug: 'googledrive',
    monogram: 'GD',
    accent: 'bg-emerald-500',
    docsUrl: 'https://developers.google.com/drive',
  },
  {
    id: 'tavily',
    name: 'Tavily',
    blurb: 'Web search built for agents.',
    url: 'https://mcp.tavily.com/mcp/',
    authType: 'api_key',
    transport: 'streamable_http',
    iconDomain: 'tavily.com',
    monogram: 'Tv',
    accent: 'bg-emerald-600',
    apiKeyName: 'tavilyApiKey',
    apiKeyLocation: 'query_param',
    docsUrl: 'https://docs.tavily.com',
  },
  {
    id: 'exa',
    name: 'Exa',
    blurb: 'Neural search for the web.',
    url: 'https://mcp.exa.ai/mcp',
    authType: 'api_key',
    transport: 'streamable_http',
    iconDomain: 'exa.ai',
    monogram: 'Ex',
    accent: 'bg-slate-700',
    apiKeyName: 'exaApiKey',
    apiKeyLocation: 'query_param',
    docsUrl: 'https://docs.exa.ai',
  },
  {
    id: 'stripe',
    name: 'Stripe',
    blurb: 'Payments, customers, and invoices.',
    url: 'https://mcp.stripe.com',
    authType: 'bearer',
    transport: 'streamable_http',
    iconDomain: 'stripe.com',
    monogram: 'St',
    accent: 'bg-indigo-500',
    docsUrl: 'https://docs.stripe.com/mcp',
  },
  {
    id: 'square',
    name: 'Square',
    blurb: 'Payments, orders, and catalog.',
    url: '',
    authType: 'oauth',
    transport: 'streamable_http',
    iconDomain: 'squareup.com',
    monogram: 'Sq',
    accent: 'bg-zinc-800',
    docsUrl: 'https://developer.squareup.com',
  },
  {
    id: 'plaid',
    name: 'Plaid',
    blurb: 'Bank accounts and transactions.',
    url: 'https://api.dashboard.plaid.com/mcp',
    authType: 'oauth',
    transport: 'streamable_http',
    iconDomain: 'plaid.com',
    monogram: 'Pl',
    accent: 'bg-zinc-900',
    docsUrl: 'https://plaid.com/docs',
  },
  {
    id: 'deepwiki',
    name: 'DeepWiki',
    blurb: 'Ask questions about any GitHub repo.',
    url: 'https://mcp.deepwiki.com/mcp',
    authType: 'none',
    transport: 'streamable_http',
    iconDomain: 'deepwiki.com',
    monogram: 'Dw',
    accent: 'bg-sky-600',
    docsUrl: 'https://deepwiki.com',
  },
  {
    id: 'salesforce',
    name: 'Salesforce CRM',
    blurb: 'Accounts, contacts, and opportunities.',
    url: '',
    authType: 'oauth',
    transport: 'streamable_http',
    iconDomain: 'salesforce.com',
    monogram: 'Sf',
    accent: 'bg-sky-500',
    docsUrl: 'https://developer.salesforce.com',
    // Salesforce's /token endpoint rejects the RFC 8707 resource param (tracker #137).
    oauthExtraFlags: { omitResourceAtTokenExchange: true },
  },
] as const;
