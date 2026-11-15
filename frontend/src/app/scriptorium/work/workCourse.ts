/**
 * DER GANG DES WERKS (2026-11-15) — wie die Erklärung gebaut ist, Schritt für Schritt: vom Kapitel bis zum Akapit,
 * je Stelle, welche Wörter (Begriffe, Personen, Orte, Ideen des Wissens) hier eingeführt und welche gebraucht werden —
 * und ob ein Wort gebraucht wird, bevor es eingeführt ist.
 *
 * Gebaut aus dem Register eines Weges (`workMarks.ts`) — dieselbe Reihenfolge und dieselbe Regel „vor der Einführung"
 * (`beforeIntro`) wie die Prüfung. Ein Wort zählt, sobald es irgendwo im Werk markiert ist; danach auch ohne Link,
 * an seinen Formen erkannt.
 */

import type { WorkKnowledge } from './workKnowledge';
import { beforeIntro, unitsOf, type MarkLook, type Placement, type Register, type UnitKind } from './workMarks';
import { levelOf, MARK_ORDER, type MarkRole, type WorkModel, type WorkNode } from './workModel';

/** Eine Stelle: ein Knoten (mit Nummer) und vielleicht sein Akapit. */
export interface Anchor {
  readonly node: string;
  readonly number: string;
  readonly title: string;
  /** 0, 1, 2 … — fehlt: der Knoten als Ganzes. */
  readonly para?: number;
}

/** Ein Wort an einer Stelle — einmal je Stelle, mit seiner stärksten Rolle. */
export interface Mention {
  readonly entity: string;
  readonly label: string;
  readonly kind: string;
  readonly role: MarkRole;
  /** Nur an seiner Form erkannt, ohne Link. */
  readonly implicit: boolean;
  /** Gebraucht, bevor es eingeführt ist (auf diesem Weg). */
  readonly early: boolean;
  /** Wo es eingeführt wird (fehlt: nirgends auf diesem Weg). */
  readonly introAt?: Anchor;
}

export interface CourseUnit {
  readonly index: number;
  readonly kind: UnitKind;
  readonly excerpt: string;
  readonly words: number;
  readonly mentions: readonly Mention[];
}

export interface Tally {
  /** Was eingeführt wird, in Lesereihenfolge, jedes einmal. */
  readonly introduces: readonly string[];
  /** Was gebraucht wird (ohne Einführungen), jedes einmal. */
  readonly uses: readonly string[];
  /** Wie viele Stellen etwas vor seiner Einführung gebrauchen. */
  readonly problems: number;
  readonly words: number;
  readonly units: number;
}

export interface CourseRow {
  readonly node: WorkNode;
  readonly pos: number;
  readonly number: string;
  readonly depth: number;
  readonly level: string;
  /** Was für den ganzen Knoten gilt (Marken am Knoten, der Plan neben der Treść). */
  readonly head: readonly Mention[];
  readonly units: readonly CourseUnit[];
  /** Nur dieser Knoten. */
  readonly own: Tally;
  /** Dieser Knoten mit allem darunter (auf dem Weg). */
  readonly below: Tally;
  /** Die Knoten darunter (direkt), auf dem Weg. */
  readonly children: readonly string[];
}

export interface VocabEntry {
  readonly entity: string;
  readonly label: string;
  readonly kind: string;
  readonly intro: Anchor | null;
  readonly defined: Anchor | null;
  readonly firstUse: Anchor | null;
  readonly uses: number;
  readonly early: number;
}

export interface Problem extends Anchor {
  readonly entity: string;
  readonly label: string;
  readonly introAt?: Anchor;
  readonly implicit: boolean;
}

export interface Course {
  readonly rows: readonly CourseRow[];
  readonly byNode: ReadonlyMap<string, CourseRow>;
  /** Die Wörter in der Reihenfolge ihrer Einführung — der Wortschatz, wie der Leser ihn erwirbt. */
  readonly vocabulary: readonly VocabEntry[];
  /** Gebraucht, aber auf diesem Weg nie eingeführt. */
  readonly unintroduced: readonly VocabEntry[];
  /** Jede Stelle, die ein Wort vor seiner Einführung gebraucht, in Lesereihenfolge. */
  readonly problems: readonly Problem[];
  readonly totals: { readonly nodes: number; readonly units: number; readonly words: number; readonly perLevel: readonly { readonly name: string; readonly count: number }[] };
}

const STRENGTH: Readonly<Record<MarkRole, number>> = { intro: 0, def: 1, ex: 2, recall: 3, use: 4 };

/** Der Anfang eines Akapit, an einer Wortgrenze. */
export function excerptOf(plain: string, length = 180): string {
  if (plain.length <= length) return plain;
  const cut = plain.slice(0, length);
  const space = cut.lastIndexOf(' ');
  return `${(space > length * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`; // i18n-ignore — Auslassung
}

/** DER GANG EINES WEGES. */
export function courseOf(model: WorkModel, register: Register, look: MarkLook, knowledge: WorkKnowledge): Course {
  const placed = register.placed;
  const anchorOf = (o: Pick<Placement, 'pos' | 'para'>): Anchor => {
    const p = placed[o.pos];
    return { node: p.node.id, number: p.number, title: p.node.title, ...(o.para === undefined ? {} : { para: o.para }) };
  };
  const labelOf = (id: string) => knowledge.get(id)?.label ?? id;
  const kindOf = (id: string) => knowledge.get(id)?.kind ?? '';
  /* Was zählt: was irgendwo ausdrücklich markiert ist (Formen ohne Link kommen nur für solche zustande). */
  const problems: Problem[] = [];

  const mentionsOf = (list: readonly Placement[]): Mention[] => {
    const by = new Map<string, Mention>();
    for (const o of list) {
      const reg = register.byEntity.get(o.entity);
      const first = reg?.first ?? null;
      const early = o.role !== 'intro' && beforeIntro(o, first);
      const was = by.get(o.entity);
      const implicit = o.where === 'implicit';
      const next: Mention = {
        entity: o.entity, label: labelOf(o.entity), kind: kindOf(o.entity),
        role: was === undefined || STRENGTH[o.role] < STRENGTH[was.role] ? o.role : was.role,
        implicit: (was?.implicit ?? true) && implicit,
        early: (was?.early ?? false) || early,
        ...(first === null ? {} : { introAt: anchorOf(first) })
      };
      by.set(o.entity, next);
    }
    return [...by.values()].sort((a, b) => STRENGTH[a.role] - STRENGTH[b.role] || a.label.localeCompare(b.label));
  };

  const rows: CourseRow[] = [];
  const byNode = new Map<string, CourseRow>();
  for (const p of placed) {
    const here = register.atNode.get(p.node.id) ?? [];
    const head = mentionsOf(here.filter((o) => o.para === undefined));
    const units = unitsOf(p.node, look).map((u) => ({
      index: u.index, kind: u.kind, excerpt: excerptOf(u.plain), words: u.words,
      mentions: mentionsOf(here.filter((o) => o.para === u.index))
    }));
    for (const m of head) if (m.early) problems.push({ ...anchorOf({ pos: p.pos, para: undefined }), entity: m.entity, label: m.label, implicit: m.implicit, ...(m.introAt === undefined ? {} : { introAt: m.introAt }) });
    for (const u of units) for (const m of u.mentions) if (m.early) problems.push({ ...anchorOf({ pos: p.pos, para: u.index }), entity: m.entity, label: m.label, implicit: m.implicit, ...(m.introAt === undefined ? {} : { introAt: m.introAt }) });
    const all = [...head, ...units.flatMap((u) => u.mentions)];
    const own: Tally = {
      introduces: unique(all.filter((m) => m.role === 'intro').map((m) => m.entity)),
      uses: unique(all.filter((m) => m.role !== 'intro').map((m) => m.entity)),
      problems: all.filter((m) => m.early).length,
      words: units.reduce((n, u) => n + u.words, 0),
      units: units.length
    };
    const row: CourseRow = { node: p.node, pos: p.pos, number: p.number, depth: p.node.depth, level: levelOf(model, p.node.depth).name, head, units, own, below: own, children: [] };
    rows.push(row);
    byNode.set(p.node.id, row);
  }

  /* Von unten nach oben: was darunter liegt, zählt zum Knoten darüber. */
  const kids = new Map<string, string[]>();
  const stack: CourseRow[] = [];
  for (const row of rows) {
    while (stack.length > 0 && stack[stack.length - 1].depth >= row.depth) stack.pop();
    const parent = stack[stack.length - 1];
    if (parent !== undefined) { const list = kids.get(parent.node.id); if (list === undefined) kids.set(parent.node.id, [row.node.id]); else list.push(row.node.id); }
    stack.push(row);
  }
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i];
    const children = kids.get(row.node.id) ?? [];
    const below = children.map((id) => byNode.get(id)!.below);
    const merged: CourseRow = {
      ...row,
      children,
      below: {
        introduces: unique([...row.own.introduces, ...below.flatMap((b) => b.introduces)]),
        uses: unique([...row.own.uses, ...below.flatMap((b) => b.uses)]),
        problems: row.own.problems + below.reduce((n, b) => n + b.problems, 0),
        words: row.own.words + below.reduce((n, b) => n + b.words, 0),
        units: row.own.units + below.reduce((n, b) => n + b.units, 0)
      }
    };
    rows[i] = merged;
    byNode.set(row.node.id, merged);
  }

  /* Der Wortschatz in der Reihenfolge, in der der Leser ihn erwirbt. */
  const vocabulary: VocabEntry[] = [];
  const unintroduced: VocabEntry[] = [];
  for (const [entity, reg] of register.byEntity) {
    if (knowledge.get(entity)?.phaseOf !== undefined) continue;
    const uses = reg.occ.filter((o) => o.role !== 'intro');
    const entry: VocabEntry = {
      entity, label: labelOf(entity), kind: kindOf(entity),
      intro: reg.first === null ? null : anchorOf(reg.first),
      defined: reg.roles.def[0] === undefined ? null : anchorOf(reg.roles.def[0]),
      firstUse: uses[0] === undefined ? null : anchorOf(uses[0]),
      uses: uses.length,
      early: uses.filter((o) => beforeIntro(o, reg.first)).length
    };
    if (reg.first === null) { if (uses.length > 0) unintroduced.push(entry); } else vocabulary.push(entry);
  }
  const at = (a: Anchor | null) => (a === null ? Infinity : (register.posOf.get(a.node) ?? 0) * 1e5 + (a.para ?? -1));
  vocabulary.sort((a, b) => at(a.intro) - at(b.intro) || a.label.localeCompare(b.label));
  unintroduced.sort((a, b) => at(a.firstUse) - at(b.firstUse) || a.label.localeCompare(b.label));

  const deepest = Math.max(-1, ...rows.map((r) => r.depth));
  return {
    rows, byNode, vocabulary, unintroduced, problems,
    totals: {
      nodes: rows.length,
      units: rows.reduce((n, r) => n + r.own.units, 0),
      words: rows.reduce((n, r) => n + r.own.words, 0),
      perLevel: Array.from({ length: deepest + 1 }, (_, d) => ({ name: levelOf(model, d).name, count: rows.filter((r) => r.depth === d).length }))
    }
  };
}

function unique(list: readonly string[]): string[] {
  return [...new Set(list)];
}

/** Die Rollen in ihrer Reihenfolge — für Legenden. */
export const COURSE_ROLES: readonly MarkRole[] = MARK_ORDER;
