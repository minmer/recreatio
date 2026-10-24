/**
 * 2026-10-24 — DIE JSON-FORMATE ALS BAUM.
 *
 * <b>Ein Format, eine Stelle.</b> Jedes JSON, das sich importieren lässt, hat
 * seine Beschreibung — wozu, welche Schlüssel, ein Beispiel. Viele Formate
 * tragen andere in sich: eine Seite ihre Module, ein Modul seinen Inhalt, ein
 * Formular seine Fragen, Wymagania und Obszary osób. Stünde deren Beschreibung
 * an jeder Stelle, die sie trägt, liefen die Abschriften auseinander — eine
 * neue Einstellung stünde beim Modul und fehlte bei der Seite.
 *
 * <b>Deshalb ein Baum.</b> Ein Knoten beschreibt nur SICH (`text`) und nennt,
 * was in ihm stecken kann (`inside`). Die Beschreibung neben einem Import ist
 * der Knoten und alles darunter (`describe`) — jeder Knoten genau einmal, an
 * der ersten Stelle, an der er vorkommt. Wer ein Format ändert, ändert es an
 * seinem Knoten, und jede Beschreibung, die es trägt, sagt es sofort.
 *
 * <b>Ganze Dokumente zum Einsetzen</b> (`samples`) hängen am Knoten, dessen
 * Format sie zeigen; das Fach bietet alle des Baums an („Wstaw przykład").
 */

export interface JsonSample {
  /** Wie der Knopf heisst — was das Dokument zeigt. */
  readonly label: string;
  /** Das Dokument, wie es in den Import kommt. */
  readonly doc: () => unknown;
}

export interface JsonNode {
  /** Eindeutig im ganzen Baum — daran wird ein Knoten wiedererkannt (`part:text`, `form`, `form.needs`). */
  readonly key: string;
  /** Die Überschrift seines Abschnitts. */
  readonly title: string;
  /** Wie er im Baum über der Beschreibung heisst, wenn die Überschrift dafür zu lang ist. */
  readonly short?: string;
  /** Was er selbst sagt — ohne Überschrift, ohne das, was in ihm steckt. */
  readonly text: () => string;
  /** Die Formate, die in ihm stecken können — in der Reihenfolge, in der sie beschrieben werden. */
  readonly inside?: () => readonly JsonNode[];
  /** Ganze Dokumente dieses Formats zum Einsetzen. */
  readonly samples?: () => readonly JsonSample[];
}

export interface JsonSection {
  readonly node: JsonNode;
  /** 0 — der Knoten, für den beschrieben wird; 1 — was in ihm steckt; … */
  readonly depth: number;
  /** Der Knoten darüber (`null` an der Wurzel). */
  readonly parent: string | null;
}

/** Wie tief der Baum höchstens gelesen wird — ein Knoten, der sich selbst enthielte, hält nichts an. */
const MAX_DEPTH = 12;

/** Der Knoten und alles darunter — der Tiefe nach, jeder Knoten einmal (an seiner ersten Stelle). */
export function sectionsOf(root: JsonNode): JsonSection[] {
  const out: JsonSection[] = [];
  const seen = new Set<string>();
  const walk = (node: JsonNode, depth: number, parent: string | null) => {
    if (seen.has(node.key) || depth > MAX_DEPTH) return;
    seen.add(node.key);
    out.push({ node, depth, parent });
    for (const child of node.inside?.() ?? []) walk(child, depth + 1, node.key);
  };
  walk(root, 0, null);
  return out;
}

/** Die Überschrift eines Abschnitts: `#` an der Wurzel, `##` darunter, … höchstens `####`. */
export const headingOf = (section: Pick<JsonSection, 'depth' | 'node'>): string =>
  `${'#'.repeat(Math.min(section.depth + 1, 4))} ${section.node.title}`;

/** Ein Abschnitt als Text: Überschrift, Leerzeile, was der Knoten sagt. */
export const sectionText = (section: JsonSection): string => {
  const body = section.node.text().trim();
  return body === '' ? headingOf(section) : `${headingOf(section)}\n${body}`;
};

/** DIE BESCHREIBUNG — neben dem Import und zum Kopieren für ein Sprachmodell. */
export function describe(root: JsonNode): string {
  return `${sectionsOf(root).map(sectionText).join('\n\n')}\n`;
}

/** Alle ganzen Dokumente des Baums — in der Reihenfolge der Abschnitte. */
export function samplesOf(root: JsonNode): JsonSample[] {
  return sectionsOf(root).flatMap((section) => [...(section.node.samples?.() ?? [])]);
}

/** Ein Knoten aus fertigem Text — für Abschnitte ohne eigene Gliederung. */
export const textNode = (key: string, title: string, text: () => string, inside?: () => readonly JsonNode[]): JsonNode =>
  ({ key, title, text, ...(inside === undefined ? {} : { inside }) });

/** Schlüssel und ihre Sätze, eine Zeile je Schlüssel: `  "title" — Nagłówek …`. */
export const keyLines = (keys: Readonly<Record<string, string>>, indent = '  '): string =>
  Object.entries(keys).map(([key, says]) => `${indent}"${key}" — ${says}`).join('\n');

/** Ein Beispiel, eingerückt wie in einer Datei. */
export const pretty = (value: unknown): string => JSON.stringify(value, null, 2);
