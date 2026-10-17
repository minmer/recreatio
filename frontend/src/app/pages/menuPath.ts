/**
 * DIE WEGE IM MENÜ — reine Rechnerei, ohne Browser.
 *
 * <b>Sie steht für sich, damit sie sich messen lässt</b>
 * (`scripts/app-menu-check.mjs`). Ein Menü, das fast richtig hervorhebt, sieht
 * richtig aus: der Eintrag „Oaza" ist nicht markiert, man merkt es nicht, und
 * niemand meldet es. Was hier steht, ist deshalb geprüft und nicht bedacht.
 *
 * <code>
 *   joinPath      „oaza", „../kontakt" → ein Pfad im Register
 *   registryPath  wohin ein Eintrag zeigt — oder nichts (draussen, nur Dach)
 *   hereIn        WELCHER Eintrag „hier" ist
 * </code>
 */

import type { MenuItem } from './page';

/**
 * Wohin ein relativer Pfad von `from` aus führt — „.." geht eine Seite
 * hinauf, „." bleibt. Über die Wurzel hinaus geht es nicht.
 */
export function joinPath(from: string, target: string): string {
  const steps = from.split('/').filter((one) => one !== '');
  for (const step of target.split('/').filter((one) => one !== '')) {
    if (step === '.') continue;
    if (step === '..') steps.pop();
    else steps.push(step.toLowerCase());
  }
  return steps.join('/');
}

/** Der Pfad im Register, auf den ein Eintrag zeigt — oder `null` (draussen, oder nur ein Dach). */
export function registryPath(item: MenuItem, from: string): string | null {
  if (item.kind === 'abs') return item.target.replace(/^\/+|\/+$/g, '');
  if (item.kind === 'rel') return joinPath(from, item.target);
  return null;
}

/**
 * WO MAN GERADE IST — als Stelle im Baum („0", „2.1"), damit der Eintrag
 * selbst sie erkennt und nicht ein Pfadvergleich in jeder Zeile.
 */
export interface Spot {
  /** Die Stelle im Baum: die Indizes von oben, mit Punkten. */
  readonly at: string;

  /** Zeigt der Eintrag GENAU auf diese Seite — oder liegt sie nur darunter? */
  readonly exact: boolean;
}

/**
 * Welcher Eintrag „hier" ist.
 *
 * <b>Zuerst der, der genau auf diese Seite zeigt.</b> Gibt es keinen — und das
 * ist der Normalfall, seit ein Menü auf vielen Seiten steht (0056) —, dann
 * der, unter dem diese Seite LIEGT: wer auf „parish/oaza/terminy" steht, soll
 * am Eintrag „Oaza" sehen, wo er ist. Von mehreren solchen gewinnt der
 * längste, also der nächstliegende Abschnitt.
 *
 * <b>Die Wurzel zählt nur genau.</b> Ein Eintrag auf die Startseite ist der
 * Anfang JEDES Pfades; würde er als Abschnitt gelten, wäre „Start" auf jeder
 * Seite des Hauses hervorgehoben und sagte damit nichts mehr.
 */
export function hereIn(items: readonly MenuItem[], from: string, here: string): Spot | null {
  interface Hit { readonly at: string; readonly exact: boolean; readonly length: number }

  const hits: Hit[] = [];

  const walk = (list: readonly MenuItem[], prefix: string) => {
    list.forEach((item, i) => {
      const at = prefix === '' ? String(i) : `${prefix}.${i}`;
      const target = registryPath(item, from);

      if (target === here) hits.push({ at, exact: true, length: target.length });
      else if (target !== null && target !== '' && here.startsWith(`${target}/`)) {
        hits.push({ at, exact: false, length: target.length });
      }

      walk(item.children, at);
    });
  };

  walk(items, '');

  /* Genau vor Abschnitt, der nähere Abschnitt vor dem weiteren, sonst der erste. */
  const best = hits.reduce<Hit | null>((kept, one) => {
    if (kept === null) return one;
    if (one.exact !== kept.exact) return one.exact ? one : kept;
    return one.length > kept.length ? one : kept;
  }, null);

  return best === null ? null : { at: best.at, exact: best.exact };
}

/** Liegt die Stelle `at` unter dem Eintrag an `path` — er selbst nicht mitgezählt? */
export const under = (path: string, at: string): boolean => at.startsWith(`${path}.`);
