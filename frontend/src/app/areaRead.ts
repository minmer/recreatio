/**
 * DER SCHLÜSSEL ZUM LESEN — auf jedem Weg, den dieser Browser hat.
 *
 * <b>Drei Wege führen zu einem Epochenschlüssel</b>, und eine Ansicht, die nur
 * einen davon kennt, zeigt „zapieczętowane", wo der Mensch den Schlüssel hält:
 *
 * <code>
 *   offengelegt        der Bereich ist jawny — jeder, ohne Konto
 *   aus einem Link     die Linkrolle liest den Bereich (0065) — ohne Konto
 *   aus der Zuteilung  eine eigene Rolle hält ihn — angemeldet, mit Schlüsselbund
 * </code>
 *
 * <b>Genau das war der Fehler des Formulars auf der Seite</b>: es kannte nur
 * den ersten. Ein Formular in einem Bereich, der nicht jawny ist, blieb dort
 * auch für den zu, der den Bereich FÜHRT — während dieselben Fragen in der
 * Kanzlei offen standen.
 *
 * <b>In dieser Reihenfolge, weil sie so teurer werden.</b> Der offene
 * Schlüssel ist eine Anfrage ohne Sitzung; die Links liegen im Browser; erst
 * der dritte fragt nach der Sitzung und packt RSA aus. Wer nichts davon
 * braucht, bezahlt nichts davon.
 *
 * <b>Die Epoche muss stimmen.</b> Ein Schlüssel einer anderen Epoche öffnet
 * nichts — er sähe nur so aus, als hätte man einen.
 */

import { loadPublicKey, myEpochKeys } from './area';
import { fromBase64Url } from './crypto';
import type { Ring } from './keys';
import { heldAreaKey } from './linkAccess';
import { keysFor } from './ringOf';
import { whoIsThere } from './session';

/**
 * Was der Weg über das Konto ergab:
 *
 * <code>
 *   none     niemand ist angemeldet
 *   locked   angemeldet, aber dieser Tab hat den Schlüsselbund nicht
 *   open     angemeldet, mit Schlüsselbund
 * </code>
 */
export type AccountWay = 'none' | 'locked' | 'open';

export interface AreaReader {
  /** Der Schlüssel dieser Epoche — oder `undefined`: dieser Browser liest den Bereich nicht. */
  readonly key: (areaId: string, epoch: number) => Promise<Uint8Array | undefined>;

  /** `null`, solange niemand den dritten Weg gebraucht hat. */
  readonly account: () => AccountWay | null;
}

/**
 * @param given Der Schlüsselbund, wenn die Ansicht ihn schon hat. Fehlt er
 *   (`undefined`), holt der Leser ihn selbst — einmal, und nur wenn die
 *   anderen Wege nichts hergeben. `null` heisst: KEIN Weg über das Konto (die
 *   Ansicht hat schon nachgesehen, oder sie fragt das Konto selbst).
 */
export function areaReader(given?: Ring | null): AreaReader {
  const published = new Map<string, Promise<{ epoch: number; key: Uint8Array } | null>>();
  const mine = new Map<string, Promise<ReadonlyMap<number, Uint8Array>>>();

  let way: AccountWay | null = given === undefined ? null : given === null ? 'none' : 'open';
  let asked: Promise<Ring | null> | null = given === undefined ? null : Promise.resolve(given);

  const ring = (): Promise<Ring | null> => {
    asked ??= (async () => {
      /* Kein Fehlschlag wirft: ein Besucher ohne Konto ist kein Fehler, ein Bund, der nicht kommt, auch nicht. */
      const who = await whoIsThere();
      if (who === null) { way = 'none'; return null; }

      const found = await keysFor(who).then((keys) => keys.ring, () => null);
      way = found === null ? 'locked' : 'open';
      return found;
    })();

    return asked;
  };

  const key = async (areaId: string, epoch: number): Promise<Uint8Array | undefined> => {
    let open = published.get(areaId);

    if (open === undefined) {
      open = loadPublicKey(areaId)
        .then((k) => ({ epoch: k.epoch, key: fromBase64Url(k.key) }))
        .catch(() => null);
      published.set(areaId, open);
    }

    const shown = await open;
    if (shown !== null && shown.epoch === epoch) return shown.key;

    const linked = await heldAreaKey(areaId, epoch);
    if (linked !== null) return linked;

    const bund = await ring();
    if (bund === null) return undefined;

    let held = mine.get(areaId);

    if (held === undefined) {
      /* Keine Zuteilung in diesem Bereich: eine Auskunft, kein Fehler. */
      held = myEpochKeys(bund, areaId).catch(() => new Map<number, Uint8Array>());
      mine.set(areaId, held);
    }

    return (await held).get(epoch);
  };

  return { key, account: () => way };
}
