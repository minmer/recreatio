/**
 * WIE MEINE ROLLEN HEISSEN — überall derselbe Name, nie eine halbe Kennung,
 * wenn ein Name zu haben ist.
 *
 * <b>Die Kennung stand in jeder Auswahl</b> („Rola · 01a0d4e4"), auch dort, wo
 * dieser Browser den Namen längst lesen konnte: er liegt versiegelt unter dem
 * Schlüssel der Rolle, und wer die Rolle hält, hält den Schlüssel. Hier wird
 * er EINMAL geöffnet und überall benutzt.
 *
 * <b>Eine Person heisst wie ein Mensch</b> — Vor- und Nachname aus ihren
 * eigenen Angaben, wie in der Rollenliste und im Kalender (`called.ts`); fehlen
 * sie, der Name der Rolle. Eine Rolle oder Gruppe heisst, wie man sie benannt
 * hat („Proboszcz", „Schola").
 *
 * <b>Wer nichts lesen kann</b> (kein Passwort in diesem Tab), bekommt die Art
 * und die halbe Kennung — ehrlicher als ein erfundener Name.
 */

import { useEffect, useState } from 'react';

import { calledFrom } from './called';
import { kindName, type RoleCard } from './desk';
import { loadPerson, openMine } from './person';
import { keysFor } from './ringOf';
import type { Who } from './session';

/* Ein Tab fragt einmal — und nach einer Minute wieder, falls jemand umbenannt hat. */
const cache = new Map<string, { at: number; names: Promise<ReadonlyMap<string, string>> }>();
const FRESH_MS = 60_000;

/** Die lesbaren Namen aller Rollen dieses Kontos. Was nicht aufgeht, fehlt. */
export function myRoleNames(who: Who): Promise<ReadonlyMap<string, string>> {
  const held = cache.get(who.accountId);
  if (held !== undefined && Date.now() - held.at < FRESH_MS) return held.names;

  const names = (async () => {
    const out = new Map<string, string>();
    const { graph, ring } = await keysFor(who);
    if (ring === null) return out;

    for (const role of graph.roles) {
      if (!ring.has(role.id)) continue;

      let name = await ring.name(role.id);

      if (role.kind === 'person') {
        try {
          const called = calledFrom(await openMine(role.id, ring, (await loadPerson(role.id)).values));
          if (called !== null) name = called.name;
        } catch {
          // Keine eigenen Angaben — dann der Name der Rolle.
        }
      }

      if (name !== null && name.trim() !== '') out.set(role.id, name.trim());
    }

    return out;
  })();

  cache.set(who.accountId, { at: Date.now(), names });
  names.catch(() => cache.delete(who.accountId));
  return names;
}

/** Nach einem Umbenennen: beim nächsten Mal neu lesen. */
export const forgetRoleNames = (): void => cache.clear();

/** Die Namen, sobald sie offen sind — bis dahin eine leere Liste. */
export function useRoleNames(who: Who | null | undefined): ReadonlyMap<string, string> {
  const [names, setNames] = useState<ReadonlyMap<string, string>>(new Map());

  useEffect(() => {
    if (who === null || who === undefined) return;
    let alive = true;
    void myRoleNames(who).then((found) => { if (alive) setNames(found); }).catch(() => undefined);
    return () => { alive = false; };
  }, [who]);

  return names;
}

/**
 * Wie eine Rolle in einer Auswahl heisst: ihr Name, und in Klammern die Art —
 * „Anna Kowalska (Ty)", „Proboszcz (rola)". Ohne lesbaren Namen die Art und die
 * halbe Kennung, wie bisher.
 */
export function roleLabel(role: RoleCard, names: ReadonlyMap<string, string>): string {
  const name = names.get(role.id);
  const kind = kindName(role);

  if (name === undefined) return `${kind} · ${role.id.slice(0, 8)}`;
  if (role.isPersonal) return name;
  return `${name} (${kind === 'Ty' ? 'Ty' : kind.toLowerCase()})`;
}
