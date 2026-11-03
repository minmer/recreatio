/**
 * 2026-11-03 — DER KRAJOBRAZ IM WORKER: Graph (einmal je Baza und Widok), Höhen (nach jeder Antwort — die Bitmengen
 * bleiben), Gestalt. Die Ansicht schickt nur, was sich geändert hat (`landscapeClient.ts`); rein gerechnet wird in
 * `landscape.ts`.
 */

import { LandscapeEngine, type LsInput, type LsOptions, type LsState } from './landscape';

type Request =
  | { readonly id: number; readonly type: 'run'; readonly input?: LsInput; readonly state?: LsState; readonly options: LsOptions }
  | { readonly id: number; readonly type: 'route'; readonly target: string };

const engine = new LandscapeEngine();

self.addEventListener('message', (event: MessageEvent<Request>) => {
  const msg = event.data;
  try {
    if (msg.type === 'route') {
      self.postMessage({ id: msg.id, ok: true, result: engine.routeTo(msg.target) });
      return;
    }
    if (msg.input !== undefined) engine.setInput(msg.input);
    if (msg.state !== undefined) engine.setState(msg.state);
    self.postMessage({ id: msg.id, ok: true, result: engine.layout(msg.options) });
  } catch (e) {
    self.postMessage({ id: msg.id, ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});
