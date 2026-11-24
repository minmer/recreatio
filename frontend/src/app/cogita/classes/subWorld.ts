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
import type { Flow } from '../flow';
import type { GraphEdge, GraphNode } from '../graph';
import { isClassView, readView, type HiddenSection, type LandscapeOnly } from '../views';
import { linesOf } from '../worldmap/wmLines';
import type { Lines, Section, World, WorldInput } from '../worldmap/wmTypes';

/** Unter diesem Feld nennt ein Widok die Klasse, deren Teilwelt er ist. */
export const CLASS_VIEW_FIELD = 'forClass';

/**
 * DIE TÜRME DER TEILWELT: die der Tags (mit Untertags), die genannten, und mit `withBase` ihre Voraussetzungen — `null`: keine
 * Teilwelt (die ganze Welt). Unbekannte Kennungen fallen weg; Tags, die Türme sind, zählen auch als Türme.
 */
export function subWorldPlaces(world: World, net: TagNetwork, only: LandscapeOnly | null | undefined): ReadonlySet<string> | null {
  if (only === null || only === undefined) return null;
  /* 2026-11-25 — nur das Gewählte: genau diese Türme (ohne Voraussetzungen von selbst — die Lehrerin hat sie gewählt oder nicht). */
  if (only.optIn === true) return new Set((only.showPlaces ?? []).filter((id) => world.places.has(id)));
  /* 2026-11-24 — nichts eingeschlossen: die ganze Welt ohne die ausgeblendeten Türme (ohne solche: keine Einschränkung der Türme). */
  const hidden = new Set(only.hidePlaces ?? []);
  if (only.tags.length === 0 && only.places.length === 0) return hidden.size === 0 ? null : new Set([...world.places.keys()].filter((id) => !hidden.has(id)));
  const keep = (set: Set<string>): ReadonlySet<string> => { for (const id of hidden) set.delete(id); return set; };
  const chosen = new Set<string>();
  for (const tag of only.tags) {
    if (net.tags.has(tag)) for (const id of net.below(tag)) if (world.places.has(id)) chosen.add(id);
    if (world.places.has(tag)) chosen.add(tag);
  }
  for (const id of only.places) if (world.places.has(id)) chosen.add(id);
  if (!only.withBase) return keep(chosen);
  const out = new Set(chosen);
  for (const id of chosen) for (const b of world.base(id)) if (world.places.has(b)) out.add(b);
  return keep(out);
}

/* -- 2026-11-24: Abschnitte, Erzählungen, Wegweiser — auf der Karte gewählt -------------------------------------------------- */

/**
 * DER BLEIBENDE NAME EINES ABSCHNITTS: sein erster Schritt (ein eingebetteter Schritt `a>b` heisst nach `a`, dem Schritt im
 * Ablauf selbst). Ohne Schritte (ein Tor, ein Rückweg): `null` — er folgt seiner Erzählung und seinen Türmen.
 */
export function sectionStep(s: Pick<Section, 'steps'>): string | null {
  const first = s.steps[0];
  return first === undefined || first === '' ? null : first.split('>')[0]!;
}

export const sectionKey = (s: Pick<Section, 'line' | 'steps'>): string | null => { const step = sectionStep(s); return step === null ? null : `${s.line}#${step}`; };
export const hiddenKey = (h: HiddenSection): string => `${h.flow}#${h.step}`;

const END: GraphNode = { id: '~end', type: 'end', x: 0, y: 0, config: {} };
const isDropped = (o: unknown): boolean => typeof o === 'object' && o !== null && (o as { _dropped?: unknown })._dropped === true;

/**
 * EINEN ABLAUF BESCHNEIDEN: von den Schritten in `hide` an fällt der Weg weg. Eine Wahl verliert die Möglichkeit, die dorthin
 * führt (`_dropped` — die Nummern der übrigen bleiben), ein anderer Schritt endet dort (der Ablauf hört an diesem Turm auf).
 * Ein Abstecher in eine Erzählung, die es nicht mehr gibt (`gone`), wird übersprungen. Was nicht mehr erreichbar ist, fällt
 * weg. `null`: vom Ablauf bleibt nichts (sein Anfang ist ausgeblendet).
 */
export function pruneFlow(flow: Flow, hide: ReadonlySet<string>, gone: (ref: string) => boolean = () => false): Flow | null {
  const nodes = new Map(flow.graph.nodes.map((n) => [n.id, n] as const));
  if (flow.start !== null && hide.has(flow.start)) return null;
  /* Abstecher ins Nichts: wer zu ihm führt, geht gleich dorthin, wohin er nach dem Abstecher ginge. */
  const skip = new Map<string, string | null>();
  for (const n of flow.graph.nodes) {
    if (n.type !== 'detour' && n.type !== 'handoff') continue;
    if (!gone(typeof n.config.flow === 'string' ? n.config.flow : '')) continue;
    const after = flow.graph.edges.find((e) => e.from === n.id && (e.out === 'done' || e.out === 'skip' || e.out === 'next'));
    skip.set(n.id, after?.to ?? null);
  }
  if (hide.size === 0 && skip.size === 0) return flow;
  const target = (to: string, seen: Set<string> = new Set()): string | null => {
    if (!skip.has(to) || seen.has(to)) return to;
    seen.add(to);
    const next = skip.get(to) ?? null;
    return next === null ? null : target(next, seen);
  };
  let needEnd = false;
  const edges: GraphEdge[] = [];
  const dropped = new Map<string, Set<string>>();
  for (const e of flow.graph.edges) {
    if (skip.has(e.from)) continue;
    const to = target(e.to);
    if (to !== null && !hide.has(to)) { edges.push(to === e.to ? e : { ...e, to }); continue; }
    const from = nodes.get(e.from);
    if (from?.type === 'choice' && /^o\d+$/.test(e.out)) { const set = dropped.get(e.from) ?? new Set<string>(); set.add(e.out); dropped.set(e.from, set); continue; }
    needEnd = true;
    edges.push({ ...e, to: END.id });
  }
  /* Eine Wahl ohne übrige Möglichkeit wird selbst ein Ende. */
  const deadChoices = new Set<string>();
  const outNodes = [...nodes.values()].map((n): GraphNode => {
    const drop = dropped.get(n.id);
    if (drop === undefined || n.type !== 'choice') return n;
    const options = (Array.isArray(n.config.options) ? n.config.options : []).map((o, i) => (drop.has(`o${i}`) ? { ...(typeof o === 'object' && o !== null ? o : { label: String(o) }), _dropped: true } : o));
    if (options.every(isDropped)) deadChoices.add(n.id);
    return { ...n, config: { ...n.config, options } };
  });
  const kept: GraphEdge[] = [];
  for (const e of edges) {
    if (deadChoices.has(e.from)) continue;
    if (deadChoices.has(e.to)) { needEnd = true; kept.push({ ...e, to: END.id }); } else kept.push(e);
  }
  const all = [...outNodes.filter((n) => !skip.has(n.id) && !deadChoices.has(n.id)), ...(needEnd && !nodes.has(END.id) ? [END] : [])];
  const start = flow.start === null ? null : target(flow.start);
  if (flow.start !== null && (start === null || deadChoices.has(start))) return null;
  /* Nur, was vom Anfang her erreichbar ist (ohne Anfang: alles, was übrig ist). */
  const reach = new Set<string>();
  if (start === null) for (const n of all) reach.add(n.id);
  else {
    const todo = [start];
    while (todo.length > 0) { const id = todo.pop()!; if (reach.has(id)) continue; reach.add(id); for (const e of kept) if (e.from === id) todo.push(e.to); }
  }
  return {
    ...flow,
    ...(start === flow.start ? {} : { start }),
    graph: { nodes: all.filter((n) => reach.has(n.id)), edges: kept.filter((e) => reach.has(e.from) && reach.has(e.to)) }
  };
}

/**
 * DER EINGANG DER KLASSE: Türme ausserhalb (`subWorldPlaces`), ausgeblendete Erzählungen, Abschnitte und — von selbst — jeder
 * Abschnitt, der zu einem Turm ausserhalb führt, sind weg; eine Erzählung behält ihre übrigen Zweige. `null`: keine Teilwelt.
 * Dieselbe Rechnung zeigt der Lehrerin beim Wählen, was die Klasse sieht.
 */
export function classWorldInput(input: WorldInput, world: World, net: TagNetwork, only: LandscapeOnly | null | undefined, fullLines?: Lines): WorldInput | null {
  if (only === null || only === undefined) return null;
  const allowed = subWorldPlaces(world, net, only);
  const lines = fullLines ?? linesOf(world, input.flows);
  const refOf = new Map<string, string>();
  for (const f of input.flows) { refOf.set(f.id, f.id); if (f.ref !== undefined) { refOf.set(f.ref, f.id); refOf.set(f.ref.replace(/^@/, ''), f.id); } }
  const idOf = (ref: string): string | undefined => refOf.get(ref) ?? refOf.get(ref.replace(/^@/, ''));
  const hiddenFlows = new Set((only.hideFlows ?? []).map(idOf).filter((x): x is string => x !== undefined));
  const steps = new Map<string, Set<string>>();
  const hideStep = (flow: string, step: string) => { const set = steps.get(flow) ?? new Set<string>(); set.add(step); steps.set(flow, set); };
  for (const h of only.hideSections ?? []) { const id = idOf(h.flow); if (id !== undefined) hideStep(id, h.step); }
  /* 2026-11-25 — nur das Gewählte: jeder Abschnitt, der nicht gewählt ist, fällt weg; eine Erzählung ohne gewählten Abschnitt ganz. */
  if (only.optIn === true) {
    const shown = new Set((only.showSections ?? []).map((h) => `${idOf(h.flow) ?? h.flow}#${h.step}`));
    const anyShown = new Set<string>();
    for (const sec of lines.sections.values()) {
      const step = sectionStep(sec);
      if (step === null) continue;
      if (shown.has(`${sec.line}#${step}`)) anyShown.add(sec.line); else hideStep(sec.line, step);
    }
    for (const f of input.flows) if (!anyShown.has(f.id)) hiddenFlows.add(f.id);
  }
  if (allowed !== null) {
    for (const sec of lines.sections.values()) {
      if (!world.places.has(sec.to) || allowed.has(sec.to)) continue;
      const step = sectionStep(sec);
      if (step !== null) hideStep(sec.line, step);
    }
  }
  /* Bis nichts mehr dazukommt: was ganz wegfällt, nimmt Abstechern dorthin den Weg. */
  let flows: Flow[] = [];
  let gone = new Set(hiddenFlows);
  for (let round = 0; round < 4; round += 1) {
    const isGone = (ref: string) => { const id = idOf(ref); return id !== undefined && gone.has(id); };
    flows = input.flows.filter((f) => !gone.has(f.id)).map((f) => pruneFlow(f, steps.get(f.id) ?? new Set(), isGone)).filter((f): f is Flow => f !== null);
    const kept = new Set(flows.map((f) => f.id));
    const now = new Set([...hiddenFlows, ...input.flows.filter((f) => !kept.has(f.id)).map((f) => f.id)]);
    if (now.size === gone.size) break;
    gone = now;
  }
  const pruned: WorldInput = { ...input, flows };
  return allowed === null ? pruned : restrictWorldInput(pruned, world, linesOf(world, flows), allowed);
}

/**
 * 2026-11-25 — NUR DAS GEWÄHLTE, FÜR DIE WAHL AUF DER KARTE: die Wahl als Ausnahmen (die Karte schaltet in dieser Form um) — alle
 * Türme, Abschnitte und Wegweiser, die nicht gewählt sind, ausgeblendet. Ohne Wahl: nichts gewählt (alles grau).
 */
export function hideFormOf(only: LandscapeOnly | null, world: World, lines: Lines, signs: readonly string[]): LandscapeOnly {
  const o: LandscapeOnly = only ?? { tags: [], places: [], withBase: false, optIn: true };
  if (o.optIn !== true) return o;
  const places = new Set(o.showPlaces ?? []);
  const shown = new Set((o.showSections ?? []).map(hiddenKey));
  const hideSections: HiddenSection[] = [];
  for (const sec of lines.sections.values()) { const step = sectionStep(sec); if (step !== null && !shown.has(`${sec.line}#${step}`)) hideSections.push({ flow: sec.line, step }); }
  const keep = new Set(o.showSigns ?? []);
  return {
    tags: [], places: [], withBase: false,
    hidePlaces: [...world.places.keys()].filter((id) => !places.has(id)),
    hideSections,
    hideSigns: signs.filter((s) => !keep.has(s))
  };
}

/** Und zurück: was mit dieser Wahl sichtbar ist, als „nur das Gewählte" (so wird gespeichert — Neues bleibt aussen vor). */
export function optInOf(places: ReadonlySet<string>, sectionKeys: ReadonlySet<string> | null, lines: Lines, signs: readonly string[], hideSigns: readonly string[]): LandscapeOnly {
  const showSections: HiddenSection[] = [];
  for (const sec of lines.sections.values()) {
    const step = sectionStep(sec);
    if (step === null) continue;
    if (sectionKeys === null || sectionKeys.has(`${sec.line}#${step}`)) showSections.push({ flow: sec.line, step });
  }
  const off = new Set(hideSigns);
  return { tags: [], places: [], withBase: false, optIn: true, showPlaces: [...places], showSections, showSigns: signs.filter((s) => !off.has(s)) };
}

/** `only` für den Widok, ohne leere Listen. */
export function onlyJson(only: LandscapeOnly): Record<string, unknown> {
  if (only.optIn === true) {
    return { optIn: true, showPlaces: [...(only.showPlaces ?? [])], showSections: (only.showSections ?? []).map((h) => ({ flow: h.flow, step: h.step })), showSigns: [...(only.showSigns ?? [])] };
  }
  return {
    tags: [...only.tags], places: [...only.places], withBase: only.withBase,
    ...((only.hidePlaces ?? []).length === 0 ? {} : { hidePlaces: [...only.hidePlaces!] }),
    ...((only.hideFlows ?? []).length === 0 ? {} : { hideFlows: [...only.hideFlows!] }),
    ...((only.hideSections ?? []).length === 0 ? {} : { hideSections: only.hideSections!.map((h) => ({ flow: h.flow, step: h.step })) }),
    ...((only.hideSigns ?? []).length === 0 ? {} : { hideSigns: [...only.hideSigns!] })
  };
}

/** Ist die Wahl leer (keine Einschränkung)? */
export const onlyEmpty = (only: LandscapeOnly | null | undefined): boolean => only === null || only === undefined || (only.optIn !== true && only.tags.length === 0 && only.places.length === 0
  && (only.hidePlaces ?? []).length === 0 && (only.hideFlows ?? []).length === 0 && (only.hideSections ?? []).length === 0 && (only.hideSigns ?? []).length === 0);

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
 * `fromView`: auf dieser Karte gewählt (2026-11-24) — ihre Abschrift, wenn sie ein Widok der Baza ist; sonst die Weltkarte der Baza.
 */
export async function setClassView(lib: CogitaLibrary, klass: { readonly areaId: string; readonly name: string }, only: LandscapeOnly | null, name: string, fromView: string | null = null): Promise<string | null> {
  const had = classViewDoc(lib, klass.areaId);
  if (only === null || onlyEmpty(only)) {
    if (had !== null) await lib.remove(had.id);
    return baseWorldViewOf(lib);
  }
  const chosen = fromView === null ? null : lib.docs('view').find((d) => d.id === fromView && !isClassView(d.data)) ?? null;
  const baseId = chosen?.id ?? baseWorldViewOf(lib);
  const base = baseId === null ? null : lib.docs('view').find((d) => d.id === baseId) ?? null;
  const from = (base?.data ?? { mode: 'landscape', steps: [] }) as Record<string, unknown>;
  const landscape = { ...((from.landscape ?? {}) as Record<string, unknown>), style: 'world', only: onlyJson(only) };
  const saved = await lib.saveDoc('view', { ...from, name, mode: 'landscape', landscape, [CLASS_VIEW_FIELD]: klass.areaId.toLowerCase() }, had?.id);
  return saved.id;
}
