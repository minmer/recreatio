/**
 * 2026-11-24 (Eigentümer: „eine Teilwelt, damit die Schüler nicht alles sehen") — DIE TEILWELT EINER KLASSE.
 *
 * <b>Was sie ist.</b> Ein Widok der Weltkarte (`style: "world"`) in der Baza mit `landscape.only` — Tags (mit allen Untertags),
 * einzelne Türme und (`withBase`, Vorgabe ja) alles, was diese voraussetzen — und `forClass`: der Bereich der Klasse. Die
 * Klassenseite zeigt diesen Widok statt der ganzen Welt (`classViewOf`). Er liegt in der BAZA, nicht im Bereich der Klasse:
 * jede Schülerin, jeder Schüler (auch ohne Konto, über den eigenen Link) liest die Baza — die Schlüssel des Bereichs nicht.
 *
 * <b>Wie die Karte sie hält.</b> Die Welt wird einmal ganz gerechnet (um Tags und Voraussetzungen zu kennen), dann aus einem
 * BESCHNITTENEN Eingang noch einmal (`restrictWorldInput`): Türme ausserhalb fehlen im Modell selbst, darum zeigen der geführte
 * Weg, Ziele, Wiederholungen, Wegweiser, Zahlen und Abzeichen nie hinaus. Ein Ablauf, der einen Turm ausserhalb erreicht, fällt
 * weg (sonst führte eine Linie ins Nichts).
 *
 * <b>Was sie nicht ist:</b> ein Schutz. Wer die Baza liest, kann sie in der Nauka ganz öffnen — die Teilwelt ordnet, was die
 * Klasse sieht; sie sperrt nichts.
 */

import type { TagNetwork } from '../tags';
import type { CogitaLibrary } from '../store';
import { isClassView, readView, type LandscapeOnly } from '../views';
import type { Lines, World, WorldInput } from '../worldmap/wmTypes';

/** Unter diesem Feld nennt ein Widok die Klasse, deren Teilwelt er ist. */
export const CLASS_VIEW_FIELD = 'forClass';

/**
 * DIE TÜRME DER TEILWELT: die der Tags (mit Untertags), die genannten, und mit `withBase` ihre Voraussetzungen — `null`: keine
 * Teilwelt (die ganze Welt). Unbekannte Kennungen fallen weg; Tags, die Türme sind, zählen auch als Türme.
 */
export function subWorldPlaces(world: World, net: TagNetwork, only: LandscapeOnly | null | undefined): ReadonlySet<string> | null {
  if (only === null || only === undefined) return null;
  const chosen = new Set<string>();
  for (const tag of only.tags) {
    if (net.tags.has(tag)) for (const id of net.below(tag)) if (world.places.has(id)) chosen.add(id);
    if (world.places.has(tag)) chosen.add(tag);
  }
  for (const id of only.places) if (world.places.has(id)) chosen.add(id);
  if (!only.withBase) return chosen;
  const out = new Set(chosen);
  for (const id of chosen) for (const b of world.base(id)) if (world.places.has(b)) out.add(b);
  return out;
}

/**
 * DER BESCHNITTENE EINGANG: Türme ausserhalb fallen weg (ihre Einträge — Verweise auf sie bleiben baumelnd und werden beim
 * Lesen bereinigt), Karten nur über Türme ausserhalb ebenso, Abläufe, die einen Turm ausserhalb erreichen, auch, und die
 * Voraussetzungen der Ustawienia zwischen ihnen. `lines`: die Linien der GANZEN Welt (welche Türme ein Ablauf erreicht).
 */
export function restrictWorldInput(input: WorldInput, world: World, lines: Lines, allowed: ReadonlySet<string>): WorldInput {
  const out = (id: string) => world.places.has(id) && !allowed.has(id);
  const flowOut = new Set<string>();
  for (const line of lines.lines.values()) {
    /* Die Halte des Stammes und die Ziele aller Abschnitte (auch der Zweige): jeder Turm, den der Ablauf erreicht. */
    const towers = [...line.stops, ...line.sections.map((id) => lines.sections.get(id)?.to ?? '')].filter((s) => world.places.has(s));
    if (towers.some(out)) flowOut.add(line.id);
  }
  /*
    Abläufe ohne Linie (etwa ohne Einheit): was ihre Schritte zeigen oder fragen. Gehört ein Ding NUR zu Türmen ausserhalb
    (ein Turm selbst, eine Frage über sie, ein Eintrag, der nur auf sie zeigt), führt der Ablauf hinaus.
  */
  const entryById = new Map(input.entries.map((e) => [e.id, e] as const));
  const aboutOfQuestion = new Map<string, string[]>();
  for (const c of input.cards) aboutOfQuestion.set(c.question, [...(aboutOfQuestion.get(c.question) ?? []), ...c.about]);
  const onlyOutside = (id: string): boolean => {
    if (world.places.has(id)) return out(id);
    const about = aboutOfQuestion.get(id) ?? entryById.get(id)?.refs.map((r) => r.to).filter((x) => world.places.has(x)) ?? [];
    return about.length > 0 && about.every(out);
  };
  const strings = (v: unknown, into: string[]): string[] => {
    if (typeof v === 'string') into.push(v);
    else if (Array.isArray(v)) for (const x of v) strings(x, into);
    else if (typeof v === 'object' && v !== null) for (const x of Object.values(v)) strings(x, into);
    return into;
  };
  for (const f of input.flows) {
    if (flowOut.has(f.id)) continue;
    if (f.graph.nodes.some((n) => strings(n.config, []).some(onlyOutside))) flowOut.add(f.id);
  }
  return {
    ...input,
    entries: input.entries.filter((e) => !out(e.id)),
    cards: input.cards.filter((c) => c.about.length === 0 || !c.about.every(out)),
    flows: input.flows.filter((f) => !flowOut.has(f.id)),
    ...(input.dependencies === undefined ? {} : { dependencies: input.dependencies.filter((d) => !out(d.parent) && !out(d.child)) })
  };
}

/* -- Klasse ↔ Widok ---------------------------------------------------------------------------------------------------------- */

type ViewEntry = ReturnType<CogitaLibrary['docs']>[number];
const dataOf = (d: ViewEntry) => d.data as { landscape?: { style?: unknown }; mode?: unknown; forClass?: unknown };

/** Die Weltkarte der Baza (keine Teilwelt einer Klasse): der erste Widok mit `style: "world"`, sonst ein Krajobraz, sonst der erste. */
export function baseWorldViewOf(lib: CogitaLibrary): string | null {
  const views = lib.docs('view').filter((d) => !isClassView(d.data));
  return (views.find((d) => dataOf(d).landscape?.style === 'world') ?? views.find((d) => dataOf(d).landscape !== undefined || dataOf(d).mode === 'landscape') ?? views[0])?.id ?? null;
}

/** Der Widok, den die Teilwelt einer Klasse hat — `null`: keine eigene. */
export function classViewDoc(lib: CogitaLibrary, areaId: string): ViewEntry | null {
  const want = areaId.toLowerCase();
  return lib.docs('view').find((d) => typeof dataOf(d).forClass === 'string' && String(dataOf(d).forClass).toLowerCase() === want) ?? null;
}

/** Was die Klasse zeigt: ihre Teilwelt, sonst die Weltkarte der Baza. */
export const classViewOf = (lib: CogitaLibrary, klass: { readonly areaId: string } | string): string | null =>
  classViewDoc(lib, typeof klass === 'string' ? klass : klass.areaId)?.id ?? baseWorldViewOf(lib);

/** Die Wahl einer Klasse, wie der Editor sie zeigt: `null` — die ganze Welt. */
export function classOnly(lib: CogitaLibrary, areaId: string): LandscapeOnly | null {
  const doc = classViewDoc(lib, areaId);
  return doc === null ? null : readView(doc.data).landscape?.only ?? null;
}

/**
 * DIE TEILWELT SETZEN: ein Widok „<Klasse> — <Name>" als Abschrift der Weltkarte der Baza mit `only` und `forClass` (angelegt
 * oder ersetzt); `only = null` nimmt ihn weg (die Klasse sieht wieder die ganze Welt). Gibt die Kennung des Widoku zurück.
 */
export async function setClassView(lib: CogitaLibrary, klass: { readonly areaId: string; readonly name: string }, only: LandscapeOnly | null, name: string): Promise<string | null> {
  const had = classViewDoc(lib, klass.areaId);
  if (only === null) {
    if (had !== null) await lib.remove(had.id);
    return baseWorldViewOf(lib);
  }
  const baseId = baseWorldViewOf(lib);
  const base = baseId === null ? null : lib.docs('view').find((d) => d.id === baseId) ?? null;
  const from = (base?.data ?? { mode: 'landscape', steps: [] }) as Record<string, unknown>;
  const landscape = { ...((from.landscape ?? {}) as Record<string, unknown>), style: 'world', only: { tags: [...only.tags], places: [...only.places], withBase: only.withBase } };
  const saved = await lib.saveDoc('view', { ...from, name, mode: 'landscape', landscape, [CLASS_VIEW_FIELD]: klass.areaId.toLowerCase() }, had?.id);
  return saved.id;
}
