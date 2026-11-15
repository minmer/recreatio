/**
 * EINE EINHEIT SCHREIBEN: DER KONTEXT ZUR HAND (2026-11-15). Wer eine Einheit öffnet — in der App neben dem Editor,
 * eine KI über `get_work_context` — sieht dasselbe: Zweck, Rolle, Kernsatz; die Stelle in den Dimensionen und die
 * Nachbarzellen (dasselbe Kapitel für eine andere Zielgruppe); die Kernsätze davor und danach; was auf diesem Weg
 * schon eingeführt ist und gebraucht werden darf; was diese Einheit einführen soll; die Regeln, die hier gelten; die
 * Beschreibungen der Personen und Orte, die hier gelten (Phasen); die offenen Befunde.
 */

import type { Finding } from './workChecks';
import { rangeOf } from './workChecks';
import type { WorkKnowledge } from './workKnowledge';
import type { MarkLook, Register } from './workMarks';
import { rulesAt, type WorkRule } from './workRules';
import { ancestors, levelOf, roleOf, targetOf, wordsOf, type Placed, type WorkModel, type WorkNode, type WorkPath } from './workModel';

export interface Neighbour {
  readonly node: string;
  readonly title: string;
  readonly synopsis: string;
  readonly number?: string;
}

export interface Introduced {
  readonly entity: string;
  readonly label: string;
  readonly kind: string;
  /** Wo es eingeführt wurde. */
  readonly at: string;
  readonly defined: boolean;
}

export interface ValidPhase {
  readonly entity: string;
  readonly label: string;
  readonly phase: string;
  readonly phaseLabel: string;
  readonly description: string;
}

export interface NodeContext {
  readonly path: WorkPath;
  readonly node: WorkNode;
  readonly placed: Placed | null;
  readonly level: string;
  readonly role: string;
  readonly target: number | null;
  readonly words: number;
  readonly chain: readonly Neighbour[];
  readonly previous: Neighbour | null;
  readonly next: Neighbour | null;
  /** Dieselbe Stelle in den anderen Werten der Dimension, die hier teilt (oder am nächsten darüber). */
  readonly cells: readonly (Neighbour & { readonly dimension: string; readonly value: string })[];
  readonly introduced: readonly Introduced[];
  /** Was diese Einheit (mit allem darunter) einführen soll. */
  readonly deliver: readonly { readonly entity: string; readonly label: string; readonly role: string }[];
  readonly rules: readonly WorkRule[];
  readonly phases: readonly ValidPhase[];
  readonly findings: readonly Finding[];
}

const neighbour = (p: Placed | WorkNode): Neighbour => {
  const node = 'node' in p ? p.node : p;
  return { node: node.id, title: node.title, synopsis: node.synopsis, ...('number' in p ? { number: p.number } : {}) };
};

/**
 * DER KONTEXT EINES KNOTENS auf einem Weg. Liegt der Knoten nicht auf dem Weg (eine Variante für andere), steht
 * er trotzdem da — ohne Stelle, Nachbarn und Eingeführtes.
 */
export function contextAt(model: WorkModel, register: Register, node: WorkNode, look: MarkLook, knowledge: WorkKnowledge,
  rules: readonly WorkRule[], findings: readonly Finding[]): NodeContext {
  const path = register.path;
  const placed = register.placed.find((p) => p.node.id === node.id) ?? null;
  const pos = placed?.pos ?? -1;
  const label = (id: string) => knowledge.get(id)?.label ?? id;
  const here = (register.atNode.get(node.id) ?? []);
  /* Was bis hierher eingeführt ist (davor, nicht hier). */
  const introduced: Introduced[] = [];
  if (placed !== null) {
    for (const [entity, reg] of register.byEntity) {
      if (reg.firstIntro === null || reg.firstIntro >= pos) continue;
      introduced.push({
        entity, label: label(entity), kind: knowledge.get(entity)?.kind ?? '',
        at: register.placed[reg.firstIntro].node.title, defined: reg.roles.def.some((o) => o.pos < pos)
      });
    }
  }
  /* Was hier eingeführt werden soll — am Knoten und darunter. */
  const below = [node.id];
  if (placed !== null) for (let i = pos + 1; i < register.placed.length && register.placed[i].node.depth > node.depth; i += 1) below.push(register.placed[i].node.id);
  const deliver = new Map<string, { entity: string; label: string; role: string }>();
  for (const id of below) {
    for (const o of register.atNode.get(id) ?? []) if (o.role === 'intro' || o.role === 'def') deliver.set(`${o.entity}:${o.role}`, { entity: o.entity, label: label(o.entity), role: o.role });
  }
  if (placed === null) for (const m of node.marks) if (m.role === 'intro' || m.role === 'def') deliver.set(`${m.entry}:${m.role}`, { entity: m.entry, label: label(m.entry), role: m.role });
  /* Phasen, die hier gelten — für alles, was hier vorkommt oder schon eingeführt ist. */
  const phases: ValidPhase[] = [];
  if (placed !== null) {
    const relevant = new Set([...here.map((o) => o.entity), ...introduced.map((i) => i.entity)]);
    for (const entity of relevant) {
      for (const ph of knowledge.phasesOf(entity)) {
        const range = rangeOf(model, register, ph.from, ph.until, look);
        if (range !== null && pos >= range[0] && pos <= range[1]) {
          phases.push({ entity, label: label(entity), phase: ph.id, phaseLabel: ph.label, description: ph.description });
        }
      }
    }
  }
  /* Die Nachbarzellen: unter dem nächsten geteilten Knoten darüber die anderen Varianten. */
  const cells: (Neighbour & { dimension: string; value: string })[] = [];
  const chain = [node, ...ancestors(model, node)];
  for (let i = 0; i < chain.length - 1; i += 1) {
    const child = chain[i];
    const parent = chain[i + 1];
    if (parent.split === '' || child.variant === '') continue;
    for (const other of parent.children) {
      if (other.id === child.id || other.variant === '' || other.variant === child.variant) continue;
      cells.push({ ...neighbour(other), dimension: parent.split, value: other.variant });
    }
    break;
  }
  const at = placed;
  return {
    path, node, placed,
    level: levelOf(model, node.depth).name,
    role: roleOf(model, node.role)?.label ?? node.role,
    target: targetOf(node),
    words: wordsOf(node, look),
    chain: ancestors(model, node).reverse().map(neighbour),
    previous: at === null || at.pos === 0 ? null : neighbour(previousLeafish(register.placed, at)),
    next: at === null || at.pos + 1 >= register.placed.length ? null : neighbour(register.placed[at.pos + 1]),
    cells,
    introduced: introduced.sort((a, b) => a.label.localeCompare(b.label)),
    deliver: [...deliver.values()],
    rules: at === null ? rules.filter((r) => r.node === null && r.role === '' && r.dimension === '' && r.template === null && r.entity === null)
      : rulesAt(model, rules, at, path, new Set(here.map((o) => o.entity))),
    phases,
    findings: findings.filter((f) => f.node === node.id)
  };
}

/** Der Knoten davor auf derselben Ebene (oder der davor in der Lesereihenfolge). */
function previousLeafish(placed: readonly Placed[], at: Placed): Placed {
  for (let i = at.pos - 1; i >= 0; i -= 1) if (placed[i].node.depth === at.node.depth) return placed[i];
  return placed[at.pos - 1];
}
