import {
  HttpAgent,
  transformChunks,
  transformHttpEventStream,
  verifyEvents,
} from '@ag-ui/client';
import type { BaseEvent, RunAgentInput } from '@ag-ui/core';
import { lastValueFrom, type Observable } from 'rxjs';

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

  /**
   * Stream a run from a NON-standard endpoint whose request body is not an
   * AG-UI `RunAgentInput` — specifically the HITL episode start
   * (`POST …/episodes`, body `{ flow_api_name, … }`) and resume
   * (`POST …/episodes/{id}/resume`, body `{ form, text }`) routes.
   *
   * Both return the same AG-UI SSE event stream as chat, so we reuse the exact
   * pipeline `runAgent()` uses — `transformChunks` → `verifyEvents` → the
   * inherited (protected) `apply()` → `processApplyEvents()`. That means the
   * response mutates `this.messages` and fires every registered subscriber's
   * event hooks (text/tool-call/`onCustomEvent` → `on_interrupt`, etc.) **the
   * same way a chat turn does** — so the resume reply streams in live and a
   * second interrupt surfaces natively, with no buffer/poll/`replaceMessages`.
   *
   * Run lifecycle (status, abort) is managed by the caller, not ag-ui's
   * `runAgent` internals: pass an `AbortSignal` to cancel the in-flight stream.
   *
   * @param url - Absolute endpoint URL (episode start or resume).
   * @param body - The endpoint's JSON request body (serialised as-is).
   * @param signal - Optional abort signal to cancel the stream client-side.
   * @returns A promise that resolves when the stream completes, rejects on error.
   */
  async runRaw(url: string, body: unknown, signal?: AbortSignal): Promise<void> {
    const init: RequestInit = {
      method: 'POST',
      headers: {
        ...this.headers,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
      signal,
    };

    // A valid `RunAgentInput` (current thread id + messages) for the subscriber
    // callback context; the body above — not this — is what's POSTed.
    const input = this.prepareRunAgentInput();

    const httpEvents = runHttpRequestViaTauri(url, init);
    const events$ = transformHttpEventStream(
      httpEvents as unknown as Parameters<typeof transformHttpEventStream>[0],
    ).pipe(transformChunks(false), verifyEvents(false));

    // `apply` fires the per-event subscriber hooks + builds state mutations;
    // `processApplyEvents` commits them to `this.messages` and fires
    // `onMessagesChanged`. Both are inherited (protected) — same machinery as
    // a chat turn.
    const mutations$ = this.apply(input, events$, this.subscribers);
    const committed$ = this.processApplyEvents(input, mutations$, this.subscribers);

    await lastValueFrom(committed$, { defaultValue: undefined });
  }
}
