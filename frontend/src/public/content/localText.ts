/**
 * Der Quelltext, der NICHT in die Versionsverwaltung gehört.
 *
 * <b>Warum es diese Datei gibt.</b> Der polnische Quelltext des Manifests soll
 * nicht mitversioniert werden. Er muss aber auf der Seite stehen — und die
 * Seite muss sich trotzdem aus einem frischen Klon bauen lassen, auf einem
 * Rechner, auf dem der Text nicht liegt. Beides gleichzeitig geht nur so:
 *
 *   - `pl.ts`, `de.ts`, `en.ts` werden versioniert und tragen an den Stellen
 *     des Quelltextes `{ source: … }` — die sichtbare Lücke aus Abschnitt 7.
 *   - `content/local/` wird von git ignoriert und trägt die echten Absätze.
 *   - Fehlt der Ordner, baut alles und die Lücken bleiben sichtbar. Liegt er
 *     da, treten die Absätze an die Stelle der Lücken.
 *
 * <b>Warum `import.meta.glob` und kein gewöhnlicher Import.</b> Ein `import`
 * auf eine Datei, die es nicht gibt, ist ein Baufehler. `import.meta.glob`
 * liefert bei null Treffern ein leeres Objekt — genau das Verhalten, das eine
 * freiwillige Datei braucht.
 *
 * <b>Die Schlüssel sind Pfade in die Texte</b>, etwa
 * `manifest.mission.body`. Ein Schlüssel, der ins Leere zeigt, wird gemeldet
 * statt stillschweigend verworfen: ein Absatz, der nirgends ankommt, wäre
 * sonst genau so unsichtbar wie ein vergessener.
 */

import type { PublicCopy } from './types';
import type { PublicLang } from './index';

/** Was eine lokale Datei ausliefert: je Sprache Pfad → Absatz. */
export type LocalText = Partial<Record<PublicLang, Readonly<Record<string, string>>>>;

const modules = import.meta.glob<{ default: LocalText }>('./local/*.ts', { eager: true });

/** Alle lokalen Dateien zu einem Satz vereinigt. Später gelesene gewinnen. */
function collect(): LocalText {
  const merged: Record<string, Record<string, string>> = {};

  for (const key of Object.keys(modules).sort()) {
    const table = modules[key]?.default ?? {};
    for (const [lang, entries] of Object.entries(table)) {
      merged[lang] = { ...(merged[lang] ?? {}), ...(entries ?? {}) };
    }
  }

  return merged as LocalText;
}

const LOCAL = collect();

/** Ob überhaupt ein lokaler Text vorliegt — für die Meldung beim Start. */
export const hasLocalText = (lang: PublicLang): boolean =>
  Object.keys(LOCAL[lang] ?? {}).length > 0;

/**
 * Die Absätze an ihre Stelle setzen.
 *
 * Arbeitet auf einer Kopie: die Texte selbst bleiben unverändert, damit ein
 * Sprachwechsel hin und zurück nicht auf halb ersetzten Daten landet.
 */
export function applyLocalText(copy: PublicCopy, lang: PublicLang): PublicCopy {
  const entries = LOCAL[lang];
  if (entries === undefined) return copy;

  const next = structuredClone(copy) as unknown as Record<string, unknown>;

  for (const [path, text] of Object.entries(entries)) {
    const steps = path.split('.');
    let node: Record<string, unknown> | undefined = next;

    for (const step of steps.slice(0, -1)) {
      const child: unknown = node?.[step];
      node = typeof child === 'object' && child !== null
        ? (child as Record<string, unknown>)
        : undefined;
      if (node === undefined) break;
    }

    const last = steps[steps.length - 1];
    if (node === undefined || !(last in node)) {
      // Laut, nicht still. Ein Absatz, der nirgends ankommt, ist ein Fehler im
      // Schlüssel — und der fällt sonst erst auf, wenn jemand die Lücke sieht.
      console.warn(`[REcreatio] Quelltext-Schlüssel zeigt ins Leere: ${lang}.${path}`);
      continue;
    }

    node[last] = text;
  }

  return next as unknown as PublicCopy;
}
