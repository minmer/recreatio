/**
 * 2026-11-09 — VON DER BAZA ZUM EINGANG DER WELTKARTE: Einträge mit den Rollen ihrer Verweisfelder („prerequisite",
 * „part", „structure"), die Karten (eine Frage: worüber sie ist; eine Vorlage: ihr Eintrag), die Abläufe (Vorlagen
 * aufgelöst). Einmal je Stand der Baza und Kartensatz gerechnet.
 *
 * Eine Präsentation (`look: "scenes"`) hat ihren Graphen in ihrer Seite: sie kommt nur mit, wenn er gereicht wird
 * (`flows`); sonst bleibt sie aussen vor (statt als „Ablauf ohne Ort" gemeldet zu werden).
 */

import type { Card } from '../cardBasics';
import { readFlow, resolveFlow, type Flow } from '../flow';
import { fieldsOf, labelOf, valuesOf } from '../schema';
import type { CogitaLibrary } from '../store';
import type { WmCardInput, WmEntry, WmRef, WorldInput } from './wmTypes';

export interface InputOptions {
  /** Die Arten der Orte, wenn der Widok sie nennt (`source.kind`). */
  readonly placeKinds?: readonly string[];
  /** Aufgelöste Präsentationen (Ablauf-Kennung → Ablauf mit Graph). */
  readonly flows?: ReadonlyMap<string, Flow>;
}

const MEMO = new WeakMap<object, { revision: number; cards: readonly Card[]; key: string; input: WorldInput }>();

/** Die Abläufe einer Baza, Vorlagen aufgelöst; Präsentationen nur mit gereichtem Graphen. */
export function flowsOf(lib: CogitaLibrary, given?: ReadonlyMap<string, Flow>): Flow[] {
  const raw = lib.docs('flow').map((d) => readFlow(d.id, d.data));
  const byId = new Map(raw.map((f) => [f.id, f] as const));
  const out: Flow[] = [];
  for (const f of raw) {
    const resolved = given?.get(f.id) ?? resolveFlow(f, (id) => byId.get(id));
    if (resolved.presentation !== undefined && resolved.graph.nodes.length === 0) continue;
    out.push(resolved);
  }
  return out;
}

export function worldInputOf(lib: CogitaLibrary, cards: readonly Card[], opts: InputOptions = {}): WorldInput {
  const key = `${(opts.placeKinds ?? []).join(',')}|${opts.flows === undefined ? '' : [...opts.flows.keys()].join(',')}`;
  const had = MEMO.get(lib.store);
  if (had !== undefined && had.revision === lib.revision && had.cards === cards && had.key === key) return had.input;
  const look = lib.look;
  const entries: WmEntry[] = [];
  for (const e of lib.entities()) {
    const refs: WmRef[] = [];
    for (const f of fieldsOf(e, look)) {
      if (f.type !== 'ref') continue;
      for (const v of valuesOf(e, f)) {
        if (typeof v.value !== 'string' || v.value === '') continue;
        refs.push({
          field: f.key, to: v.value,
          ...(f.prerequisite === undefined ? {} : { prerequisite: f.prerequisite }),
          ...(f.part === undefined ? {} : { part: f.part }),
          ...(f.structure === undefined ? {} : { structure: f.structure })
        });
      }
    }
    entries.push({ id: e.id, kinds: e.kinds, label: labelOf(e, look), refs });
  }
  const byId = new Map(entries.map((e) => [e.id, e] as const));
  const wmCards: WmCardInput[] = [];
  for (const c of cards) {
    const fromTemplate = c.template !== undefined;
    const about = fromTemplate ? (c.entity === undefined ? [] : [c.entity]) : (c.about ?? []).filter((a) => a !== c.question);
    if (about.length === 0) continue;
    wmCards.push({
      key: c.key, question: c.question, about, explain: c.explain,
      ...(fromTemplate ? { fromTemplate: true } : { needs: (byId.get(c.question)?.refs ?? []).filter((r) => r.field === 'needs').map((r) => r.to) }),
      ...(c.core === true ? { core: true } : {})
    });
  }
  const questionKinds = ['question', ...lib.refKinds.filter((k) => k.system === 'question').map((k) => k.id)];
  const input: WorldInput = {
    entries, cards: wmCards, flows: flowsOf(lib, opts.flows),
    questionKinds: [...new Set(questionKinds)],
    ...(opts.placeKinds === undefined || opts.placeKinds.length === 0 ? {} : { placeKinds: opts.placeKinds }),
    dependencies: lib.settings().dependencies.filter((d) => d.kind === 'prerequisite' && d.proposed !== true).map((d) => ({ parent: d.parent, child: d.child }))
  };
  MEMO.set(lib.store, { revision: lib.revision, cards, key, input });
  return input;
}
