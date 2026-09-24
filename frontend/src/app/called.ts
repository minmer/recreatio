/**
 * Wie jemand in einer Liste heisst — ein Mensch mit seinem Namen, nicht eine
 * Kennung.
 *
 * <b>Drei Quellen, und jede ist ehrlich über das, was sie weiss.</b>
 *
 * <code>
 *   was der Mensch dem Bereich FREIGEGEBEN hat   — liest jeder, der den
 *                                                  Schlüssel des Bereichs hat
 *   die EIGENEN Angaben meiner Personen           — liest nur, wer die Person hält
 *   der Name der Rolle                            — liest nur, wer sie hält
 * </code>
 *
 * Wer nichts davon hat, bekommt keinen Namen, sondern die Kennung — „nicht
 * für dich" ist eine andere Aussage als „namenlos", und die Liste soll sie
 * nicht verwischen.
 *
 * <b>Ein Mensch heisst zuerst, wie er gerufen werden will.</b> Steht ein
 * Spitzname da, ist er der Name; Vor- und Nachname stehen klein daneben.
 * Fehlt er, sind Vor- und Nachname der Name.
 */

import { myEpochKeys } from './area';
import type { Ring } from './keys';
import { loadGiven, loadPerson, openGiven, openMine, type Given, type PersonField } from './person';
import type { RoleGraphData } from './roles';

export interface Called {
  readonly name: string;

  /** Die andere Form desselben Menschen — oder `null`, wenn es keine gibt. */
  readonly also: string | null;
}

/** Aus den Angaben eines Menschen: Spitzname, sonst Vor- und Nachname. */
export function calledFrom(values: ReadonlyMap<PersonField, string>): Called | null {
  const nick = values.get('nickname')?.trim() || null;
  const full = [values.get('given_name'), values.get('surname')]
    .map((part) => part?.trim() ?? '')
    .filter((part) => part !== '')
    .join(' ') || null;

  if (nick !== null) return { name: nick, also: full };
  if (full !== null) return { name: full, also: null };
  return null;
}

/**
 * Die Namen der Rollen in einem Bereich — so viele, wie dieser Browser lesen
 * darf.
 */
export async function namesInArea(
  ring: Ring, graph: RoleGraphData, areaId: string, roleIds: readonly string[]
): Promise<Map<string, Called>> {
  const out = new Map<string, Called>();

  /* 1. Was Menschen diesem Bereich freigegeben haben. */
  try {
    const { given } = await loadGiven(areaId);

    if (given.length > 0) {
      const keys = await myEpochKeys(ring, areaId);
      const byEpoch = new Map<number, Given[]>();
      for (const one of given) byEpoch.set(one.epoch, [...(byEpoch.get(one.epoch) ?? []), one]);

      for (const [epoch, rows] of byEpoch) {
        const key = keys.get(epoch);
        if (key === undefined) continue;

        for (const [roleId, values] of await openGiven(rows, key)) {
          const called = calledFrom(values);
          if (called !== null) out.set(roleId, called);
        }
      }
    }
  } catch {
    // Ohne Freigaben bleiben die eigenen Namen — und die Kennungen.
  }

  /* 2. Meine eigenen Rollen: ihr Name, und bei meinen Personen ihre Angaben. */
  for (const roleId of roleIds) {
    if (roleId === graph.personRoleId) {
      out.set(roleId, { name: 'Konto', also: null });
      continue;
    }

    if (!ring.has(roleId)) continue;

    const shown = await ring.name(roleId);
    const role = graph.roles.find((r) => r.id === roleId);

    if (role?.kind === 'person') {
      try {
        const mine = await loadPerson(roleId);
        const called = calledFrom(await openMine(roleId, ring, mine.values));

        if (called !== null) {
          out.set(roleId, {
            name: called.name,
            also: called.also ?? (shown !== null && shown !== called.name ? shown : null)
          });
          continue;
        }
      } catch {
        // Keine eigenen Angaben — dann der Name der Rolle.
      }
    }

    if (shown !== null && !out.has(roleId)) out.set(roleId, { name: shown, also: null });
  }

  return out;
}
