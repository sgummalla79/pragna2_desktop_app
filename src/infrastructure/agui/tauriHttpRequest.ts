import { Observable, defer, from, throwError } from 'rxjs';
import { mergeMap, switchMap } from 'rxjs/operators';

import { httpFetch } from '@/infrastructure/http/tauriFetch';

/**
 * AG-UI's `HttpEvent` union, replicated locally.
 *
 * `@ag-ui/client` does not export the `HttpEvent` type or its `HttpEventType`
 * enum, but its `transformHttpEventStream` operator consumes a stream of these
 * objects, discriminated by a string `type` of `'headers'` or `'data'` (the
 * enum's underlying values). We reproduce the shape here so our Tauri-backed
 * transport can emit byte-compatible events that the library's parser accepts.
 */
export type HttpEvent =
  | { type: 'headers'; status: number; headers: Headers }
  | { type: 'data'; data?: Uint8Array };

/** An HTTP error carrying the parsed response body, mirroring AG-UI's own. */
interface HttpRequestError extends Error {
  status?: number;
  payload?: unknown;
}

/**
 * A drop-in replacement for `@ag-ui/client`'s internal `runHttpRequest`, but
 * issuing the request through {@link httpFetch} (Tauri native HTTP) instead of
 * the webview's global `fetch`.
 *
 * This is a faithful port of the library's transport: it `defer`s the fetch (so
 * each subscription re-issues the request), maps non-2xx responses to a thrown
 * error that carries the parsed payload, then emits a single `headers` event
 * followed by one `data` event per streamed chunk, completing when the body
 * reader is exhausted. The downstream `transformHttpEventStream` turns this byte
 * stream into typed AG-UI `BaseEvent`s.
 *
 * @param url - Absolute request URL (the agent's `this.url`).
 * @param requestInit - Fetch init from `HttpAgent.requestInit` (method, headers,
 *   JSON body, and the abort `signal`).
 * @returns An observable of {@link HttpEvent}s suitable for `transformHttpEventStream`.
 */
export function runHttpRequestViaTauri(
  url: string,
  requestInit: RequestInit,
): Observable<HttpEvent> {
  return defer(() => from(httpFetch(url, requestInit))).pipe(
    switchMap((response) => {
      if (!response.ok) {
        const contentType = response.headers.get('content-type') ?? '';
        return from(response.text()).pipe(
          mergeMap((text) => {
            let payload: unknown = text;
            if (contentType.includes('application/json')) {
              try {
                payload = JSON.parse(text);
              } catch {
                // Non-JSON body despite the header — keep the raw text.
              }
            }
            const error: HttpRequestError = new Error(
              `HTTP ${response.status}: ${
                typeof payload === 'string' ? payload : JSON.stringify(payload)
              }`,
            );
            error.status = response.status;
            error.payload = payload;
            return throwError(() => error);
          }),
        );
      }

      const headersEvent: HttpEvent = {
        type: 'headers',
        status: response.status,
        headers: response.headers,
      };
      const reader = response.body?.getReader();
      if (!reader) {
        // No body to stream (shouldn't happen for SSE) — emit headers and finish.
        return new Observable<HttpEvent>((subscriber) => {
          subscriber.next(headersEvent);
          subscriber.complete();
        });
      }

      return new Observable<HttpEvent>((subscriber) => {
        subscriber.next(headersEvent);
        let cancelled = false;
        void (async () => {
          try {
            for (;;) {
              const { done, value } = await reader.read();
              if (cancelled || done) break;
              subscriber.next({ type: 'data', data: value });
            }
            if (!cancelled) subscriber.complete();
          } catch (err) {
            if (!cancelled) subscriber.error(err);
          }
        })();
        // Teardown (unsubscribe / abort) — stop reading and release the stream.
        return () => {
          cancelled = true;
          reader.cancel().catch(() => undefined);
        };
      });
    }),
  );
}
