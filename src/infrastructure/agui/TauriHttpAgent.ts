import { HttpAgent, transformHttpEventStream } from '@ag-ui/client';
import type { BaseEvent, RunAgentInput } from '@ag-ui/core';
import type { Observable } from 'rxjs';

import { runHttpRequestViaTauri } from './tauriHttpRequest';

/**
 * An `HttpAgent` that streams over Tauri's native HTTP transport.
 *
 * `@ag-ui/client`'s stock `HttpAgent.run()` issues the SSE request with the
 * webview's global `fetch`. In the packaged Tauri webview that fails on two
 * counts: the webview's CORS policy blocks the cross-origin backend call, and a
 * relative `/api` URL can't resolve against the non-HTTP webview origin. We
 * solve both the same way the rest of the app does — route through
 * `@tauri-apps/plugin-http` — by overriding the single `run()` seam.
 *
 * Everything else is inherited unchanged: `requestInit()` still builds the POST
 * body, `Authorization`/`Accept` headers, and the abort `signal`; the library's
 * exported `transformHttpEventStream` still parses the raw byte stream into
 * typed AG-UI events. Only the fetch call is swapped, so event handling stays
 * 1:1 with the web app.
 */
export class TauriHttpAgent extends HttpAgent {
  /**
   * Run a turn, streaming the response through Tauri native HTTP.
   *
   * @param input - The AG-UI run input (thread id, message list, forwarded props).
   * @returns An observable of typed AG-UI events for the subscriber chain.
   */
  run(input: RunAgentInput): Observable<BaseEvent> {
    const httpEvents = runHttpRequestViaTauri(this.url, this.requestInit(input));
    // `transformHttpEventStream` is typed against the library's own (unexported)
    // `HttpEvent`; our locally-declared union is byte-compatible, so we hand it
    // through the operator's parameter type.
    return transformHttpEventStream(
      httpEvents as unknown as Parameters<typeof transformHttpEventStream>[0],
    );
  }
}
