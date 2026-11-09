/**
 * 2026-11-09 — EIN BRZMIENIE, STRUKTUR DARÜBER.
 *
 * Ein Text hat ein `text`. Die Struktur liegt als Einheiten über Zeichenstellen [at, to) — im Dokument als Stücke
 * (`{"text": "…"}`), die der Reihe nach im Brzmienie stehen müssen; dazwischen nur Leerraum. So kann keine Pause, keine
 * Rolle und keine Versnummer ins Brzmienie geraten, und jede Teilung weiss, für welche Fassung sie gilt (`textVersion`).
 *
 * Darunter das Modell der zwei Ansichten: die fortlaufende (das Brzmienie mit seinen Absätzen) und die liturgische
 * (Einheiten als Zeilen mit * und †, Versnummern, K./W., Kreuz, Überschriften, Rubriken, Wiederholungen).
 */
import type { End, ResourceType, Role, Step, TextResource, Unit } from './schema';

/* -- Fassung ------------------------------------------------------------------------------------- */

/** FNV-1a über die Zeichen, zwei Startwerte — 64 Bit, synchron (für die Vorschau), nur zum Wiedererkennen. */
export function textVersion(text: string): string {
  let a = 0x811c9dc5, b = 0x01000193 ^ 0x9e3779b9;
  const s = text.normalize('NFC');
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x5bd1e995) >>> 0;
    b = (b ^ (b >>> 15)) >>> 0;
  }
  return `v${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}`;
}

/** Zum Vergleichen von Brzmienie: Unicode NFC, Leerraum zu einem Zeichen, ohne Rand. */
export const normalizeWording = (text: string): string => text.normalize('NFC').replace(/\s+/g, ' ').trim();

const isSpace = (c: string | undefined) => c !== undefined && /\s/.test(c);

/* -- Stücke ↔ Stellen ---------------------------------------------------------------------------- */

export interface PieceUnit extends Omit<Unit, 'at' | 'to'> { readonly text?: string; readonly at?: number; readonly to?: number }
export type LayoutError = { readonly unit: number; readonly at: number; readonly expected: string; readonly found: string };

/** Ab `pos` (nach Leerraum) steht `piece` im Text? Leerraum zählt als gleich, egal wie viel. Ende oder -1. */
function matchAt(text: string, pos: number, piece: string): number {
  let i = pos, j = 0;
  const p = piece.normalize('NFC').trim();
  while (j < p.length) {
    if (isSpace(p[j])) {
      if (!isSpace(text[i])) return -1;
      while (isSpace(p[j])) j++;
      while (isSpace(text[i])) i++;
      continue;
    }
    if (text[i] !== p[j]) return -1;
    i++; j++;
  }
  return i;
}

/** Stücke (`text`) oder Stellen (`at`/`to`) zu Einheiten mit Stellen — oder wo es nicht passt. */
export function placeUnits(text: string, pieces: readonly PieceUnit[]): { readonly units: Unit[] } | { readonly error: LayoutError } {
  const out: Unit[] = [];
  let pos = 0;
  for (const [k, raw] of pieces.entries()) {
    const { text: piece, at, to, ...rest } = raw;
    if (typeof piece === 'string') {
      while (isSpace(text[pos])) pos++;
      const end = matchAt(text, pos, piece);
      if (end < 0 || piece.trim() === '') return { error: { unit: k + 1, at: pos, expected: piece.trim().slice(0, 60), found: text.slice(pos, pos + Math.max(20, Math.min(60, piece.trim().length))) } };
      out.push({ ...rest, at: pos, to: end } as Unit);
      pos = end;
    } else if (typeof at === 'number' && typeof to === 'number') {
      out.push({ ...rest, at, to } as Unit);
      pos = to;
    } else {
      return { error: { unit: k + 1, at: pos, expected: '', found: '' } };
    }
  }
  return { units: out };
}

/** Einheiten zurück zu Stücken — wie das Dokument sie schreibt. */
export const unitPieces = (text: string, units: readonly Unit[]): Record<string, unknown>[] =>
  units.map(({ at, to, ...rest }) => ({ text: text.slice(at, to), ...rest }));

/** Ohne `text`: das Brzmienie aus den Stücken — Strophen und Teile als Absätze, sonst ein Leerzeichen. */
export function textFromPieces(pieces: readonly PieceUnit[]): string {
  let out = '';
  pieces.forEach((p, k) => {
    out += (p.text ?? '').trim();
    if (k < pieces.length - 1) out += p.end === 'stanza' || p.end === 'part' ? '\n\n' : ' ';
  });
  return out;
}

/** Was an einer Teilung nicht stimmt: ausserhalb, überlappend, Lücken mit Text, nicht alles bedeckt. Codes für die Vorschau. */
export function layoutFaults(text: string, units: readonly Unit[], whole = true): { code: string; detail: string }[] {
  const faults: { code: string; detail: string }[] = [];
  let pos = 0;
  for (const [k, u] of units.entries()) {
    if (u.to > text.length || u.at >= u.to) { faults.push({ code: 'layout_bounds', detail: `${k + 1}: ${u.at}–${u.to} / ${text.length}` }); continue; }
    if (u.at < pos) { faults.push({ code: 'layout_overlap', detail: `${k + 1}: ${u.at} < ${pos}` }); continue; }
    const gap = text.slice(pos, u.at);
    if (whole && gap.trim() !== '') faults.push({ code: 'layout_gap', detail: `${k + 1}: „${gap.trim().slice(0, 40)}”` });
    pos = u.to;
  }
  if (whole && text.slice(pos).trim() !== '') faults.push({ code: 'layout_gap', detail: `${units.length + 1}: „${text.slice(pos).trim().slice(0, 40)}”` });
  const ids = units.flatMap((u) => (u.id === undefined ? [] : [u.id]));
  if (new Set(ids).size !== ids.length) faults.push({ code: 'layout_ids', detail: ids.filter((x, i) => ids.indexOf(x) !== i).join(', ') });
  return faults;
}

/* -- Welche Teilung, welche Einheiten ------------------------------------------------------------ */

export function layoutOf(r: TextResource, layoutId?: string): readonly Unit[] {
  if (layoutId !== undefined) {
    const alt = r.layouts?.find((l) => l.id === layoutId);
    if (alt !== undefined) return alt.units;
  }
  return r.layout?.units ?? [{ at: 0, to: r.text.length }];
}

/** Alle Ids von Einheiten, die ein Text kennt (Hauptteilung und bezeugte). */
export const unitIds = (r: TextResource): Set<string> =>
  new Set([...(r.layout?.units ?? []), ...(r.layouts ?? []).flatMap((l) => l.units)].flatMap((u) => (u.id === undefined ? [] : [u.id])));

export const sliceOf = (text: string, u: Unit): string => text.slice(u.at, u.to);

/* -- Zwei Ansichten ------------------------------------------------------------------------------ */

export type Mode = 'verse' | 'stanza' | 'prose';
/** Psalmen, Cantica und die Doxologie stehen in Verszeilen; Hymnen in Strophen; alles andere als Prosa mit Zeichen. */
export const modeOf = (type: ResourceType): Mode => (type === 'psalm' || type === 'canticle' || type === 'doxology' ? 'verse' : type === 'hymn' ? 'stanza' : 'prose');

export interface Seg { readonly text: string; readonly mark?: '*' | '†' | '/'; readonly cross?: boolean; readonly style?: 'italic' | 'bold' }
export interface Line {
  readonly kind: 'text' | 'heading' | 'subtitle' | 'sentence' | 'rubric' | 'source' | 'part';
  readonly segs: readonly Seg[];
  readonly role?: Role;
  readonly verse?: string;
  /** Davor eine Leerzeile (neuer Vers) oder ein Absatz (neue Strophe, neuer Teil). */
  readonly gap?: 'line' | 'stanza';
}

const markOf = (end: End | undefined, repeat: boolean): Seg['mark'] => (end === 'mediant' ? (repeat ? '/' : '*') : end === 'flex' ? '†' : undefined);

/**
 * Die liturgische Ansicht einer Folge von Einheiten. `repeat`: eine Antiphon beim Wiederholen — die Mediante als „/".
 * `notes` vor ihren Einheiten (oder am Anfang/Ende).
 */
export function unitLines(text: string, units: readonly Unit[], mode: Mode, opts: { readonly repeat?: boolean; readonly role?: Role; readonly notes?: TextResource['notes'] } = {}): Line[] {
  const lines: Line[] = [];
  const notesAt = (at: string) => (opts.notes ?? []).filter((n) => n.at === at).map((n): Line => ({ kind: n.type, segs: [{ text: n.source === undefined ? n.text : `${n.text} (${n.source})` }] })); // i18n-ignore — a note and its source, as printed
  lines.push(...notesAt('start'));
  let current: Seg[] = [];
  let currentRole: Role | undefined;
  let currentVerse: string | undefined;
  let gap: Line['gap'];
  let lastVerse: number | undefined;
  const flush = () => {
    if (current.length === 0) return;
    lines.push({ kind: 'text', segs: current, ...(currentRole === undefined ? {} : { role: currentRole }), ...(currentVerse === undefined ? {} : { verse: currentVerse }), ...(gap === undefined ? {} : { gap }) });
    current = []; currentVerse = undefined; gap = undefined;
  };
  let pendingGap: Line['gap'];
  units.forEach((u, k) => {
    if (u.id !== undefined) { const before = notesAt(u.id); if (before.length > 0) { flush(); lines.push(...before); } }
    const role = opts.role ?? u.role;
    const seg: Seg = { text: sliceOf(text, u), ...(markOf(u.end, opts.repeat === true) === undefined ? {} : { mark: markOf(u.end, opts.repeat === true) }), ...(u.cross ? { cross: true } : {}), ...(u.style === undefined ? {} : { style: u.style }) };
    const newVerse = u.verse !== undefined && u.verse !== lastVerse;
    const startLine = mode !== 'prose' || current.length === 0 || role !== currentRole || (u.kind !== undefined && u.kind !== units[k - 1]?.kind);
    if (startLine) flush();
    if (current.length === 0) {
      currentRole = role;
      gap = pendingGap ?? (mode === 'verse' && newVerse && lastVerse !== undefined ? 'line' : undefined);
      pendingGap = undefined;
      if (newVerse || (mode === 'stanza' && u.label !== undefined)) currentVerse = u.label ?? (u.verse === undefined ? undefined : String(u.verse));
    }
    current.push(seg);
    if (u.verse !== undefined) lastVerse = u.verse;
    if (u.end === 'stanza' || u.end === 'part') { flush(); pendingGap = 'stanza'; }
    else if (u.end === 'line' || u.end === 'verse') { flush(); if (u.end === 'verse' && mode === 'verse') pendingGap = 'line'; }
    else if (mode !== 'prose') flush();
  });
  flush();
  lines.push(...notesAt('end'));
  return lines;
}

/** Ein ganzer Text, liturgisch: seine Teilung oder sein Vortrag (`performance`), mit seinen Hinweisen. */
export function resourceLines(r: TextResource, opts: { readonly layout?: string; readonly repeat?: boolean; readonly units?: readonly Unit[]; readonly look?: (id: string) => TextResource | undefined } = {}): Line[] {
  const units = opts.units ?? layoutOf(r, opts.layout);
  const mode = modeOf(r.resource_type);
  if (r.performance === undefined || r.performance.length === 0 || opts.units !== undefined) return unitLines(r.text, units, mode, { repeat: opts.repeat, notes: r.notes });
  return performanceLines(r, r.performance, opts.look);
}

/** Der Vortrag Schritt für Schritt: Einheiten (auch wiederholt), andere Texte, Rubriken. */
export function performanceLines(r: TextResource, steps: readonly Step[], look?: (id: string) => TextResource | undefined): Line[] {
  const byId = new Map(layoutOf(r).flatMap((u) => (u.id === undefined ? [] : [[u.id, u] as const])));
  const out: Line[] = [];
  out.push(...(r.notes ?? []).filter((n) => n.at === 'start').map((n): Line => ({ kind: n.type, segs: [{ text: n.text }] })));
  const seen = new Set<string>();
  for (const step of steps) {
    if (step.rubric !== undefined) { out.push({ kind: 'rubric', segs: [{ text: step.rubric }] }); continue; }
    if (step.resource !== undefined) {
      const other = look?.(step.resource);
      if (other === undefined) continue;
      const otherUnits = step.units === undefined ? layoutOf(other) : layoutOf(other).filter((u) => u.id !== undefined && step.units!.includes(u.id));
      out.push(...unitLines(other.text, otherUnits, 'prose', { ...(step.role === undefined ? {} : { role: step.role }) }));
      continue;
    }
    const units = (step.say ?? []).flatMap((x) => { const u = byId.get(x); return u === undefined ? [] : [u]; });
    const again = (step.say ?? []).every((x) => seen.has(x));
    for (const x of step.say ?? []) seen.add(x);
    const lines = unitLines(r.text, units, 'prose', { repeat: again, ...(step.role === undefined ? {} : { role: step.role }) });
    /* Ein Schritt ist eine Zeile des Wechsels — ohne die Zeilenumbrüche, die seine Einheiten im Text hätten. */
    out.push(...(lines.length <= 1 ? lines : [{ ...lines[0], segs: lines.flatMap((l) => l.segs) }]));
  }
  out.push(...(r.notes ?? []).filter((n) => n.at === 'end').map((n): Line => ({ kind: n.type, segs: [{ text: n.text }] })));
  return out;
}

/** Die fortlaufende Ansicht: das Brzmienie in seinen Absätzen, ohne jede Struktur. */
export const paragraphs = (text: string): string[] => text.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p !== '');

/** Die fortlaufende Ansicht eines Vortrags (wie gelesen): jeder Schritt ein Absatz, ohne Rollen und Zeichen. */
export const plainOfLines = (lines: readonly Line[]): string[] =>
  lines.filter((l) => l.kind === 'text').map((l) => l.segs.map((s) => s.text).join(' ').replace(/\s+/g, ' ').trim()).filter((x) => x !== '');
