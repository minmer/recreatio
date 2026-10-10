/**
 * WAS DIE TEILE EINES WIDOKS LADEN (0094) — einmal je Karte und halbe Minute.
 *
 * Auf einer Seite des Warsztat stehen mehrere Teile, und mehrere brauchen
 * dasselbe: die Bereiche, die Module, die Rozmowy. Jeder für sich hätte jede
 * Liste einmal geholt. Hier liegt jede Frage als Versprechen, und wer nach
 * ihr fragt, bekommt dasselbe — bis sie veraltet ist (30 s) oder jemand
 * etwas geändert hat (`invalidate`).
 */

import { useEffect, useState } from 'react';

import { loadAgenda, openAgenda, type OpenedItem } from './agenda';
import { loadAreas, type AreaRow } from './area';
import { loadChats, type ChatRow } from './chat';
import type { Ring } from './keys';
import { loadLinks, type LinkRow } from './linkAccess';
import { loadModules, type ModuleRow } from './module';

const FRESH_MS = 30_000;
const cache = new Map<string, { at: number; value: Promise<unknown> }>();

function once<T>(key: string, load: () => Promise<T>): Promise<T> {
  const had = cache.get(key);
  if (had !== undefined && Date.now() - had.at < FRESH_MS) return had.value as Promise<T>;
  const value = load();
  cache.set(key, { at: Date.now(), value });
  value.catch(() => { if (cache.get(key)?.value === value) cache.delete(key); });
  return value;
}

/** Nach einer Änderung: alles neu fragen. */
export const invalidate = (): void => { cache.clear(); };

/** Der Warsztat hält seine Seiten und Rollen selbst (`Workspace`) — nach einem Anfang, der eine Seite anlegt, liest er sie neu. */
export const DESK_EVENT = 'recreatio:desk';
export const refreshDesk = (): void => { window.dispatchEvent(new Event(DESK_EVENT)); };

export const areasNow = (): Promise<readonly AreaRow[]> => once('areas', async () => (await loadAreas()).areas);
export const modulesNow = (): Promise<readonly ModuleRow[]> => once('modules', async () => (await loadModules()).modules);
export const chatsNow = (): Promise<readonly ChatRow[]> => once('chats', async () => (await loadChats()).chats);
export const linksNow = (): Promise<readonly LinkRow[]> => once('links', async () => (await loadLinks()).invites);

/** Die Termine der nächsten Tage, geöffnet — ab heute 0:00. */
export function agendaNow(ring: Ring, days: number): Promise<readonly OpenedItem[]> {
  return once(`agenda:${days}`, async () => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + days);
    const [{ occurrences }, areas] = await Promise.all([loadAgenda(from, to), areasNow()]);
    const opened = await openAgenda(ring, occurrences.filter((o) => o.status !== 'cancelled'), areas);
    return opened.sort((a, b) => a.occurrence.startsAt.localeCompare(b.occurrence.startsAt));
  });
}

/** Einmal laden, mit Zustand: `undefined` lädt, `null` ging nicht. */
export function useLoaded<T>(load: (() => Promise<T>) | null, deps: readonly unknown[]): T | null | undefined {
  const [value, setValue] = useState<T | null | undefined>(undefined);
  useEffect(() => {
    if (load === null) { setValue(undefined); return undefined; }
    let alive = true;
    setValue(undefined);
    load().then((found) => { if (alive) setValue(found); }, () => { if (alive) setValue(null); });
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}
