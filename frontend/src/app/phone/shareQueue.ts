/**
 * EINE DATEI ALS LINK, OHNE SMS (2026-10-27) — „Pliki przez link" nimmt Dateien selbst
 * an (wählen, hineinziehen, einfügen): jede geht versiegelt hinauf und bekommt ihren
 * Link, zum Kopieren in eine Mail, einen anderen Messenger, wohin auch immer.
 *
 * Die Warteschlange lebt ausserhalb der Seite: wer weitergeht, verliert nichts. Eine
 * Datei nach der anderen (der Balken sagt dann etwas, und die Grenzen des Dienstes —
 * 1 GB am Tag, 2 GB zugleich — treffen der Reihe nach). Ist die Seite offen, steht
 * der neue Link oben in ihrer Liste; ist sie es nicht, meldet er sich (mit „Kopiuj").
 * Das Fenster zu schliessen, solange etwas hinaufgeht, fragt der Browser nach.
 */

import { useSyncExternalStore } from 'react';

import { viewPath } from '../routes';
import { WorkspaceError } from '../core/session';
import { toast } from '../ui/dialogs';
import type { PhoneCtx } from './phoneContext';
import { shareFile, ShareStopped } from './share';
import { SHARE_MAX } from './shareSeal';

/** Eine Datei auf dem Weg — so, wie die Seite sie zeigt. */
export interface Sending {
  readonly key: number;
  readonly name: string;
  readonly size: number;
  readonly days: number;
  readonly state: 'waiting' | 'sending' | 'failed';
  /** 0…1 beim Hinauf; `null`, solange sie noch gelesen und versiegelt wird. */
  readonly done: number | null;
  readonly error: string | null;
}

/** Ein Link, der in diesem Fenster entstand — neueste zuerst. */
export interface Made {
  readonly id: string;
  readonly name: string;
  readonly link: string;
}

interface Item extends Sending {
  readonly file: File;
  readonly ctx: PhoneCtx;
}

export interface ShareQueue {
  readonly queue: readonly Sending[];
  readonly made: readonly Made[];
}

let items: readonly Item[] = [];
let made: readonly Made[] = [];
let shown: ShareQueue = { queue: [], made: [] };
const listeners = new Set<() => void>();
let running: { readonly key: number; readonly stop: AbortController } | null = null;
let nextKey = 1;
/** Wie viele Seiten gerade zusehen — ohne Zuschauer meldet sich, was fertig wird. */
let watchers = 0;
/** Fertig geworden, während niemand zusah — gemeldet, sobald die Schlange leer ist. */
let unseen: Made[] = [];

const changed = () => {
  shown = { queue: items.map(({ file: _file, ctx: _ctx, ...rest }) => rest), made };
  guard();
  for (const l of listeners) l();
};

const patch = (key: number, part: Partial<Item>) => {
  items = items.map((i) => (i.key === key ? { ...i, ...part } : i));
};

/* -- Das Fenster nicht mitten im Hinauf schliessen ----------------------------------------------- */

let guarded = false;
const hold = (e: BeforeUnloadEvent) => {
  e.preventDefault();
  e.returnValue = '';
};
function guard(): void {
  const busy = items.some((i) => i.state !== 'failed');
  if (busy === guarded || typeof window === 'undefined') return;
  guarded = busy;
  if (busy) window.addEventListener('beforeunload', hold); else window.removeEventListener('beforeunload', hold);
}

/* -- Kopieren --------------------------------------------------------------------------------- */

/** In die Zwischenablage — mit einem Wort, ob es ging. */
export function copyText(text: string, said = 'Skopiowano link.'): void {
  if (navigator.clipboard === undefined) { toast('Ta przeglądarka nie pozwala kopiować — zaznacz link i skopiuj go ręcznie.'); return; }
  void navigator.clipboard.writeText(text).then(() => toast(said)).catch(() => toast('Nie udało się skopiować — zaznacz link i skopiuj go ręcznie.'));
}

/** Mehrere Links in einem Stück: je eine Zeile „Name: Link" — so stehen sie in einer Mail. */
export const linesOf = (links: readonly Made[]): string => links.map((m) => `${m.name}: ${m.link}`).join('\n');

/* -- Die Schlange ------------------------------------------------------------------------------ */

/** Was ohne Zuschauer fertig wurde — einmal gesagt, wenn nichts mehr wartet. */
function report(): void {
  if (watchers > 0 || unseen.length === 0 || items.some((i) => i.state !== 'failed')) return;
  const done = unseen;
  unseen = [];
  if (done.length === 1) {
    toast(`Link gotowy: ${done[0].name}`, { action: { label: 'Kopiuj', run: () => copyText(done[0].link) } });
  } else {
    toast(`Gotowe linki: ${done.length}`, { action: { label: 'Kopiuj wszystkie', run: () => copyText(linesOf(done), 'Skopiowano linki.') } });
  }
}

async function pump(): Promise<void> {
  if (running !== null) return;
  const next = items.find((i) => i.state === 'waiting');
  if (next === undefined) { report(); return; }
  const stop = new AbortController();
  running = { key: next.key, stop };
  patch(next.key, { state: 'sending', done: null, error: null });
  changed();

  let outcome: { readonly made: Made } | { readonly error: string } | null;
  try {
    const result = await shareFile(next.ctx, next.file, {
      days: next.days,
      signal: stop.signal,
      onProgress: (sent, total) => { patch(next.key, { done: total > 0 ? sent / total : 0 }); changed(); }
    });
    outcome = { made: { id: result.id, name: next.name, link: result.link } };
  } catch (e) {
    outcome = e instanceof ShareStopped ? null
      : { error: e instanceof WorkspaceError || e instanceof Error ? e.message : 'Nie udało się wysłać pliku.' };
  }
  running = null;

  if (outcome !== null && 'error' in outcome) {
    patch(next.key, { state: 'failed', done: null, error: outcome.error });
    if (watchers === 0) toast(`Nie udało się wysłać: ${next.name}`, { action: { label: 'Pokaż', run: () => { window.location.hash = viewPath('sms', 'pliki'); } } });
  } else {
    items = items.filter((i) => i.key !== next.key);
    if (outcome !== null) {
      made = [outcome.made, ...made];
      if (watchers === 0) unseen.push(outcome.made);
    }
  }
  changed();
  void pump();
}

/**
 * Dateien in die Schlange — jede mit der Gültigkeit von jetzt. Zu grosse kommen gar nicht
 * erst hinein (sie stehen gleich als nicht gesendet da, mit dem Grund).
 */
export function addFiles(ctx: PhoneCtx, files: readonly File[], days: number): void {
  if (files.length === 0) return;
  items = [...items, ...files.map((file): Item => ({
    key: nextKey++, file, ctx, name: file.name === '' ? 'plik' : file.name, size: file.size, days, done: null,
    ...(file.size > SHARE_MAX
      ? { state: 'failed' as const, error: 'Plik przez link może mieć najwyżej 25 MB.' }
      : { state: 'waiting' as const, error: null })
  }))];
  changed();
  void pump();
}

/** Anhalten (die, die gerade hinaufgeht) oder aus der Schlange nehmen (wartend, gescheitert). */
export function dropSending(key: number): void {
  if (running?.key === key) { running.stop.abort(); return; }
  items = items.filter((i) => i.key !== key);
  changed();
  void pump();
}

/** Eine gescheiterte noch einmal. */
export function retrySending(key: number): void {
  const one = items.find((i) => i.key === key);
  if (one === undefined || one.state !== 'failed' || one.size > SHARE_MAX) return;
  patch(key, { state: 'waiting', error: null, done: null });
  changed();
  void pump();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

/** Die Schlange und die neuen Links — für die Seite, die zusieht (solange sie offen ist, meldet sich nichts). */
export function useShareQueue(): ShareQueue {
  return useSyncExternalStore(subscribe, () => shown, () => shown);
}

/** Die Seite sieht zu: was jetzt fertig wird, steht in ihrer Liste und braucht keine Meldung. */
export function watchShares(): () => void {
  watchers += 1;
  unseen = [];
  return () => {
    watchers = Math.max(0, watchers - 1);
    report();
  };
}
