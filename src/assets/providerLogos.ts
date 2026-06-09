/**
 * Provider logo URL map — built at bundle time from src/assets/logos/*.svg.
 * Providers without a logo file fall back to the coloured initial in ProviderTile.
 */
const logoModules = import.meta.glob('./logos/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export const PROVIDER_LOGO_URLS: Record<string, string> = Object.fromEntries(
  Object.entries(logoModules).map(([path, url]) => {
    const name = path.split('/').pop()!.replace('.svg', '');
    return [name, url];
  })
);

/**
 * Provider logos that are monochrome black strokes.
 * In the dark UI these must be inverted to white so they remain visible.
 */
export const MONO_BLACK_PROVIDERS = new Set<string>(['openai', 'groq', 'perplexity']);
