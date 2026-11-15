/**
 * EINE STRUKTUR EINMAL BAUEN, VIELE MALE NUTZEN (2026-11-15). Eine Vorlage einer Einheit (Art `unittemplate`)
 * beschreibt die innere Gestalt einer Art von Einheit — Teile mit Art und Länge (ein Fünf-Minuten-Kazanie: Wejście —
 * Pismo — jedna myśl — przykład — zastosowanie; eine Lekcja: Ziel — Wiederholen — Neues — Üben — Prüfen) — und die
 * Regeln, die für sie gelten (Regeln mit `template`). Aus ihr entsteht ein Zyklus von N Einheiten an ihren Stellen,
 * auf Wunsch über die Werte einer Dimension geteilt. Jeder Knoten merkt sich die Gestalt, aus der er entstand
 * (`templateSig`); ändert sich die Vorlage, zeigt die Prüfung, welche Einheiten nicht mehr passen.
 */

import { newId } from '../../core/ids';
import { itemsOf, num, str, type EntryData, type LibEntry } from '../../library/libraryKinds';
import type { SaveInput } from '../../library/libraryStore';
import { planOf } from '../sermon';
import { orderBetween, type WorkModel, type WorkNode } from './workModel';

export interface TemplatePart {
  readonly id: string;
  readonly title: string;
  readonly kind: string;
  readonly words: number | null;
  readonly minutes: number | null;
  readonly note: string;
}

export interface UnitTemplate {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly role: string;
  readonly targetWords: number | null;
  readonly targetMinutes: number | null;
  readonly parts: readonly TemplatePart[];
}

export function readTemplate(e: LibEntry): UnitTemplate {
  const d = e.data;
  const seen = new Set<string>();
  const parts: TemplatePart[] = [];
  itemsOf(d, 'parts').forEach((p, i) => {
    let id = str(p, 'id').trim() || `t${i + 1}`;
    if (seen.has(id)) id = `${id}-${i + 1}`;
    seen.add(id);
    parts.push({ id, title: str(p, 'title').trim(), kind: str(p, 'kind') || 'thought', words: num(p, 'words'), minutes: num(p, 'minutes'), note: str(p, 'note').trim() });
  });
  return {
    id: e.id, name: str(d, 'name').trim(), description: str(d, 'description').trim(), role: str(d, 'role').trim(),
    targetWords: num(d, 'targetWords'), targetMinutes: num(d, 'targetMinutes'), parts
  };
}

/** Die Gestalt als kurzes Zeichen: ändert sich ein Teil (Kennung, Titel, Art, Länge), ändert es sich. */
export function templateSig(t: UnitTemplate): string {
  const text = JSON.stringify([t.role, t.targetWords, t.targetMinutes, t.parts.map((p) => [p.id, p.title, p.kind, p.words, p.minutes])]);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}

/** Die Kennung eines Planpunkts, der aus einem Teil der Vorlage kommt. */
export const partPointId = (part: TemplatePart): string => `tpl-${part.id}`;

/** Der Plan eines neuen Textes aus der Vorlage: ein Punkt je Teil. */
export function planFromTemplate(t: UnitTemplate): Record<string, unknown>[] {
  return t.parts.map((p) => ({ id: partPointId(p), text: p.title || p.id, depth: 0, kind: p.kind }));
}

/** Ein bestehender Plan, um die Teile der Vorlage ergänzt, die ihm fehlen (an ihrer Stelle). Nichts geht verloren. */
export function applyTemplate(data: EntryData, t: UnitTemplate): Record<string, unknown>[] {
  const points = itemsOf(data, 'plan');
  const has = new Set(points.map((p) => str(p, 'id')));
  const out: Record<string, unknown>[] = [];
  let at = 0;
  for (const part of t.parts) {
    const id = partPointId(part);
    const index = points.findIndex((p) => str(p, 'id') === id);
    if (index >= 0) { out.push(...points.slice(at, index + 1)); at = index + 1; continue; }
    if (!has.has(id)) out.push({ id, text: part.title || part.id, depth: 0, kind: part.kind });
  }
  out.push(...points.slice(at));
  return out;
}

/** Welche Teile der Vorlage einem Text fehlen (nach den Kennungen seiner Planpunkte). */
export function missingParts(text: LibEntry | undefined, t: UnitTemplate): TemplatePart[] {
  if (text === undefined) return [];
  const has = new Set(planOf(text.data).map((p) => p.id));
  return t.parts.filter((p) => !has.has(partPointId(p)));
}

export interface CycleSpec {
  readonly template: UnitTemplate;
  /** Unter welchem Knoten (oder oben). */
  readonly parent: WorkNode | null;
  readonly count: number;
  /** Der Titel, `{n}` wird die Nummer. */
  readonly title: string;
  /** Jede wievielte Einheit ist eine Zusammenfassung (0: keine). */
  readonly recapEvery?: number;
  /** Jede Einheit geteilt nach dieser Dimension: ein gemeinsamer Kern (wenn `core`) und ein Kind je Wert. */
  readonly splitBy?: string;
  readonly core?: boolean;
  /** Zu jeder Einheit (und jeder Variante) gleich einen Text mit dem Plan der Vorlage. */
  readonly withTexts?: boolean;
}

/**
 * EIN ZYKLUS AUS DER VORLAGE: N Einheiten, nummeriert, mit Rolle, Ziel und Gestalt der Vorlage; jede `recapEvery`-te
 * ist eine Zusammenfassung. Geteilt nach einer Dimension bekommt jede Einheit ihre Varianten (und einen Kern).
 * Was herauskommt, wird in EINEM Zapis gespeichert (`saveAll`).
 */
export function cycleFrom(model: WorkModel, spec: CycleSpec): SaveInput[] {
  const out: SaveInput[] = [];
  const t = spec.template;
  const sig = templateSig(t);
  const siblings = spec.parent === null ? model.roots : spec.parent.children;
  let order = siblings.length === 0 ? 0 : siblings[siblings.length - 1].order;
  const dim = spec.splitBy === undefined ? undefined : model.dimensions.find((d) => d.key === spec.splitBy);
  const count = Math.max(1, Math.min(1000, Math.round(spec.count)));
  const unit = (title: string, role: string, extra: EntryData): { node: SaveInput; text?: SaveInput } => {
    const textId = spec.withTexts === true ? newId() : undefined;
    const node: SaveInput = {
      id: newId(), kind: 'node',
      data: {
        project: model.project.id, title, role, status: 'planned', template: t.id, templateSig: sig,
        ...(t.targetWords === null ? {} : { targetWords: t.targetWords }),
        ...(t.targetMinutes === null ? {} : { targetMinutes: t.targetMinutes }),
        ...(textId === undefined ? {} : { text: textId }),
        ...extra
      }
    };
    const text: SaveInput | undefined = textId === undefined ? undefined
      : { id: textId, kind: 'text', data: { title, project: model.project.id, status: 'idea', plan: planFromTemplate(t), ...(t.targetWords === null ? {} : { targetWords: t.targetWords }) } };
    return { node, ...(text === undefined ? {} : { text }) };
  };
  for (let n = 1; n <= count; n += 1) {
    order = orderBetween(order, null);
    const recap = spec.recapEvery !== undefined && spec.recapEvery > 0 && n % spec.recapEvery === 0;
    const title = spec.title.includes('{n}') ? spec.title.replace(/\{n\}/g, String(n)) : `${spec.title} ${n}`;
    const role = recap ? 'summary' : t.role || 'new';
    if (dim === undefined) {
      const made = unit(title, role, { ...(spec.parent === null ? {} : { parent: spec.parent.id }), order });
      out.push(made.node, ...(made.text === undefined ? [] : [made.text]));
      continue;
    }
    /* Geteilt: die Einheit selbst ohne Text, darunter der Kern und eine Variante je Wert. */
    const head: SaveInput = {
      id: newId(), kind: 'node',
      data: { project: model.project.id, title, role, status: 'planned', split: dim.key, order, ...(spec.parent === null ? {} : { parent: spec.parent.id }) }
    };
    out.push(head);
    let inner = 0;
    if (spec.core === true) {
      const made = unit(title, role, { parent: head.id!, order: (inner += 1) });
      out.push(made.node, ...(made.text === undefined ? [] : [made.text]));
    }
    for (const v of dim.values) {
      const made = unit(`${title} — ${v.name}`, role, { parent: head.id!, order: (inner += 1), variant: v.key });
      out.push(made.node, ...(made.text === undefined ? [] : [made.text]));
    }
  }
  return out;
}
