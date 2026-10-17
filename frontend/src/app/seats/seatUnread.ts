/**
 * 0102 — WAS IN DEN ROZMOWY EINES PLATZES UNGELESEN LIEGT, für die Seite.
 *
 * Der Streifen einer Rozmowa („3 nowe wiadomości"), der Schritt „Przeczytaj
 * wiadomości" und seine Zeile unter den Zadania fragen dasselbe. Geholt wird
 * es einmal je Platz (`/seat/…/chats`), und alle teilen es. Nachgesehen wird,
 * sobald er etwas gelesen hat (`CHAT_SEEN`), und jede Minute, solange die
 * Seite sichtbar ist — so erscheint auch, was inzwischen geschrieben wurde.
 */

import { useEffect, useState } from 'react';

import { CHAT_SEEN } from '../chat/chatFeatures';
import { loadSeatChats, type SeatChatRow } from './seatChat';

interface Entry {
  rows: readonly SeatChatRow[] | undefined;
  at: number;
  loading: boolean;
  /** Während geholt wurde, hat er etwas gelesen: danach noch einmal. */
  again: boolean;
  readonly listeners: Set<() => void>;
}

const entries = new Map<string, Entry>();

const entryOf = (token: string): Entry => {
  let entry = entries.get(token);
  if (entry === undefined) {
    entry = { rows: undefined, at: 0, loading: false, again: false, listeners: new Set() };
    entries.set(token, entry);
  }
  return entry;
};

/** Holen — ausser es ist jünger als `fresh` Millisekunden. */
function refresh(token: string, fresh = 0): void {
  const entry = entryOf(token);
  if (entry.loading) { if (fresh === 0) entry.again = true; return; }
  if (entry.rows !== undefined && Date.now() - entry.at < fresh) return;

  entry.loading = true;
  void loadSeatChats(token)
    .then((found) => { entry.rows = found.chats; }, () => { entry.rows ??= []; })
    .finally(() => {
      entry.at = Date.now();
      entry.loading = false;
      for (const fn of entry.listeners) fn();
      if (entry.again) { entry.again = false; refresh(token); }
    });
}

/**
 * Die Rozmowy dieser Plätze, mit dem Ungelesenen je Rozmowa — `undefined`,
 * solange sie geholt werden.
 */
export function useSeatChatRows(tokens: readonly string[]): readonly SeatChatRow[] | undefined {
  const key = tokens.join('|');
  const [, bump] = useState(0);

  useEffect(() => {
    const list = key === '' ? [] : key.split('|');
    if (list.length === 0) return undefined;
    const changed = () => bump((n) => n + 1);
    for (const token of list) { entryOf(token).listeners.add(changed); refresh(token, 10_000); }

    const seen = () => { for (const token of list) refresh(token); };
    window.addEventListener(CHAT_SEEN, seen);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') for (const token of list) refresh(token, 30_000);
    }, 60_000);

    return () => {
      for (const token of list) entryOf(token).listeners.delete(changed);
      window.removeEventListener(CHAT_SEEN, seen);
      window.clearInterval(timer);
    };
  }, [key]);

  if (tokens.length === 0) return [];
  const all = tokens.map((token) => entries.get(token)?.rows);
  return all.some((rows) => rows === undefined) ? undefined : all.flatMap((rows) => rows ?? []);
}

/** „1 nowa wiadomość", „3 nowe wiadomości", „5 nowych wiadomości". */
export function newMessages(n: number): string {
  const tens = n % 100;
  const ones = n % 10;
  if (n === 1) return '1 nowa wiadomość';
  if (ones >= 2 && ones <= 4 && (tens < 12 || tens > 14)) return `${n} nowe wiadomości`;
  return `${n} nowych wiadomości`;
}
