/**
 * DER GEMERKTE STAND (0054) — was man zuletzt offen hatte, und in welcher
 * Reihenfolge man die Dinge benutzt.
 *
 * Nach dem Neuladen stand bisher das alphabetisch Erste da: der erste
 * Terminarz, der erste Bereich — gleich, woran man gerade arbeitete. Jetzt
 * merkt sich jeder Teil des Arbeitsplatzes (ein `scope`), was zuletzt gewählt
 * war, und die Listen stellen das zuletzt Benutzte nach vorn.
 *
 * <b>Versiegelt, unter dem Schlüssel des Kontos.</b> Der Dienst hebt eine
 * Hülle auf (`/workspace/state`) und weiss nicht, was darin steht — also auch
 * nicht, was man zuletzt angesehen hat. Auf jedem Gerät, an dem man sich
 * anmeldet, gilt derselbe Stand. Ist der Schlüssel gerade nicht offen (die
 * Karte fragt nach dem Passwort), merkt sich der Stand nur diese Karte.
 *
 * <b>Ein Speicher für die ganze Karte</b>, mit einem Haken (`useRecent`) je
 * Teil: gelesen wird einmal, geschrieben gebündelt eine Sekunde nach der
 * letzten Änderung — nicht bei jedem Klick eine Runde zum Dienst.
 */

import { useEffect, useState, useSyncExternalStore } from 'react';

import { aad, Field, fromBase64Url, openText, sealText, toBase64Url } from './crypto';
import { keysFor } from './ringOf';
import { call, whoIsThere } from './session';

interface Stored {
  readonly v: 1;
  /** Je Teil die Kennungen, zuletzt benutzt zuerst. */
  readonly recent: Record<string, readonly string[]>;
  /** Je Teil ein einzelner Wert — eine Ansicht, ein Filter. */
  readonly values: Record<string, string>;
}

const EMPTY: Stored = { v: 1, recent: {}, values: {} };

/** Wie viele je Teil — genug für jede Liste, die man vorn sortieren will. */
const KEEP = 40;

const stateAad = (accountId: string) => aad('account', 'state', accountId, Field.WorkspaceState, 1);

let state: Stored = EMPTY;
let loaded: Promise<void> | null = null;
let sealer: { key: Uint8Array; accountId: string } | null = null;
let timer: number | null = null;
const listeners = new Set<() => void>();

const notify = () => { for (const one of listeners) one(); };

/** Einmal je Karte: die Hülle holen und öffnen. Gelingt das nicht, beginnt der Stand leer. */
function load(): Promise<void> {
  if (loaded !== null) return loaded;

  loaded = (async () => {
    try {
      const who = await whoIsThere();
      if (who === null) return;
      const { ring, graph } = await keysFor(who);
      if (ring === null || graph.personRoleId === null) return;

      sealer = { key: ring.keyOf(graph.personRoleId), accountId: who.accountId };

      const found = await call<{ stateSealed: string | null }>('/workspace/state');
      if (found.stateSealed === null) return;

      const opened = JSON.parse(await openText(sealer.key, stateAad(sealer.accountId), fromBase64Url(found.stateSealed))) as Partial<Stored>;
      state = {
        v: 1,
        /* Was in dieser Karte schon vor dem Laden gewählt wurde, gewinnt. */
        recent: { ...(opened.recent ?? {}), ...state.recent },
        values: { ...(opened.values ?? {}), ...state.values }
      };
      notify();
    } catch {
      // Ein Stand, der nicht aufgeht, ist kein Fehler — dann beginnt er eben leer.
    }
  })();

  return loaded;
}

function save(): void {
  if (timer !== null) window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    timer = null;
    void (async () => {
      await load();
      if (sealer === null) return;
      try {
        const sealed = await sealText(sealer.key, stateAad(sealer.accountId), JSON.stringify(state));
        await call('/workspace/state', { method: 'POST', body: JSON.stringify({ stateSealed: toBase64Url(sealed) }) });
      } catch {
        // Beim nächsten Mal wieder — der Stand ist ein Komfort, keine Pflicht.
      }
    })();
  }, 1000);
}

/** Etwas wurde benutzt: nach vorn. */
export function touch(scope: string, id: string): void {
  if (id === '') return;
  const was = state.recent[scope] ?? [];
  if (was[0] === id) return;
  state = { ...state, recent: { ...state.recent, [scope]: [id, ...was.filter((one) => one !== id)].slice(0, KEEP) } };
  notify();
  save();
}

export function setValue(scope: string, value: string): void {
  if (state.values[scope] === value) return;
  state = { ...state, values: { ...state.values, [scope]: value } };
  notify();
  save();
}

/** Für Prüfstände und die Abmeldung: alles vergessen. */
export function forget(): void {
  state = EMPTY;
  loaded = null;
  sealer = null;
  notify();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

/**
 * Die zuletzt benutzten Dinge eines Teils — und wie man sie ordnet.
 *
 * `order` stellt das zuletzt Benutzte nach vorn und lässt den Rest, wie er
 * war (die Reihenfolge des Aufrufers — meist alphabetisch). `last` ist das
 * zuletzt Benutzte, das es in `items` noch gibt.
 */
export function useRecent(scope: string): {
  readonly ids: readonly string[];
  readonly ready: boolean;
  order: <T>(items: readonly T[], idOf: (item: T) => string) => T[];
  last: <T>(items: readonly T[], idOf: (item: T) => string) => T | null;
  touch: (id: string) => void;
} {
  const snapshot = useSyncExternalStore(subscribe, () => state);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    void load().then(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);

  const ids = snapshot.recent[scope] ?? [];
  const rank = new Map(ids.map((id, i) => [id, i]));

  return {
    ids,
    ready,
    order: (items, idOf) => [...items].sort((a, b) => (rank.get(idOf(a)) ?? KEEP) - (rank.get(idOf(b)) ?? KEEP)),
    last: (items, idOf) => {
      for (const id of ids) {
        const found = items.find((one) => idOf(one) === id);
        if (found !== undefined) return found;
      }
      return null;
    },
    touch: (id: string) => touch(scope, id)
  };
}

/** Ein gemerkter Wert eines Teils — eine Ansicht, ein Filter. */
export function useRemembered(scope: string, fallback: string): [string, (value: string) => void, boolean] {
  const snapshot = useSyncExternalStore(subscribe, () => state);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    void load().then(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);

  return [snapshot.values[scope] ?? fallback, (value: string) => setValue(scope, value), ready];
}
