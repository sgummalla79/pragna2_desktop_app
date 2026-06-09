/**
 * Best-effort kebab-case slug seed from a free-text name or filename.
 *
 * Lowercases, collapses runs of non-alphanumerics to a single hyphen, and trims
 * leading/trailing hyphens. Used to pre-fill slug fields (the user can still
 * edit); the backend is the authority on slug validity.
 */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
