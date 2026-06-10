import axios from 'axios';

/**
 * Backend error helpers shared across views.
 *
 * The API returns a human-readable reason under `response.data.detail`; prefer
 * it over a generic catalog message so users see the actual cause, falling back
 * to the catalog string when it's absent or non-string (e.g. a validation array).
 */

/** The backend `detail` string if present + non-empty, else `fallback`. */
export function detailOr(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response
    ?.data?.detail;
  return typeof detail === 'string' && detail.trim() ? detail : fallback;
}

/** The HTTP status code of an axios error, or `undefined` for non-HTTP errors. */
export function statusOf(err: unknown): number | undefined {
  return axios.isAxiosError(err) ? err.response?.status : undefined;
}
