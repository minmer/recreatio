/**
 * DAS WISSEN EINES WERKS (2026-11-15) — Personen, Orte, Begriffe, Ideen, Motive, Dinge, Ereignisse liegen in einer
 * Baza wiedzy (Cogita), gebaut mit ihren eigenen Rodzaje (`templates/cogita/dzielo.json`). Eine solche Baza dient
 * der Struktur eines Werks, nicht dem Lernen (Ustawienia → „Do czego służy": „Wiedza dzieła").
 *
 * Das Skryptorium liest sie hier, ohne Cogita zu kennen, über eine schmale Sicht (`WorkKnowledge`): was eine
 * Prüfung, der Kontext einer Einheit, der Druck und die Abschrift für eine KI brauchen. Die Felder findet es an
 * ihrer ROLLE (`FieldDef.role`, oder am Schlüssel): `forms` (Formen, an denen ein Vorkommen ohne Link erkannt
 * wird), `forbidden` (verbotene Synonyme und falsche Formen), `preferred`, `definition`, `usage`, `description`;
 * eine Phase: `phaseOf` (wessen Phase), `validFrom` / `validUntil` (ein Knoten oder Text des Werks),
 * `storyFrom` / `storyUntil` (Zeit der Erzählung). Was vorher bekannt sein muss, sagen die Felder „Kolejność nauki"
 * (`prerequisite: "up"`) wie überall in Cogita.
 *
 * Was ein Leser nicht öffnen kann, ist hier nicht — es gibt keinen Namen, keinen Titel davon (die Sicht wird nur
 * aus dem gebaut, was der Speicher dieses Lesers offen hat).
 */

import type { CogitaLibrary } from '../../cogita/store';
import { fieldsOf, labelOf, valuesOf, type Entity, type FieldDef, type Lookup } from '../../cogita/schema';

export interface WorkEntity {
  readonly id: string;
  readonly label: string;
  /** Der Name seines Rodzaj (Osoba, Miejsce, Termin …). */
  readonly kind: string;
  readonly kindId: string;
  /** Die Baza, in der er liegt. */
  readonly base?: string;
  readonly forms: readonly string[];
  readonly forbidden: readonly string[];
  readonly preferred: string;
  readonly definition: string;
  readonly usage: string;
  readonly description: string;
  /** Was vorher eingeführt sein muss (Felder mit `prerequisite: "up"`). */
  readonly requires: readonly string[];
  /** Andere Verweise mit ihrem Feld (Teil von, Gegenteil …). */
  readonly relations: readonly { readonly field: string; readonly label: string; readonly to: string }[];
  /** Eine Phase: wessen, und ab wo / bis wo im Werk (Knoten oder Text) oder in der Zeit der Erzählung. */
  readonly phaseOf?: string;
  readonly from?: string;
  readonly until?: string;
  readonly storyFrom?: string;
  readonly storyUntil?: string;
}

export interface WorkKnowledge {
  get(id: string): WorkEntity | undefined;
  all(): readonly WorkEntity[];
  /** Die Phasen eines Eintrags, in der Reihenfolge ihres Beginns im Baum nicht bekannt — so wie gespeichert. */
  phasesOf(id: string): readonly WorkEntity[];
}

export const WORK_FIELD_ROLES = ['forms', 'forbidden', 'preferred', 'definition', 'usage', 'phaseOf', 'validFrom', 'validUntil', 'storyFrom', 'storyUntil'] as const;

/** Eine Sicht aus einer Liste — für Prüfungen ohne Cogita (die Prüfskripte, die Abschrift). */
export function knowledgeOf(list: readonly WorkEntity[]): WorkKnowledge {
  const byId = new Map(list.map((e) => [e.id, e]));
  const phases = new Map<string, WorkEntity[]>();
  for (const e of list) if (e.phaseOf !== undefined) phases.set(e.phaseOf, [...(phases.get(e.phaseOf) ?? []), e]);
  return { get: (id) => byId.get(id), all: () => list, phasesOf: (id) => phases.get(id) ?? [] };
}

export const EMPTY_KNOWLEDGE: WorkKnowledge = knowledgeOf([]);

const text = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');

/** Die Texte eines Feldes (eine Liste, ein Text mit Zeilen oder Kommas). */
function words(entity: Entity, field: FieldDef | undefined): string[] {
  if (field === undefined) return [];
  const out: string[] = [];
  for (const v of valuesOf(entity, field)) {
    const value = v.value;
    if (Array.isArray(value)) out.push(...value.map(text));
    else out.push(...text(value).split(/[\n;,]/));
  }
  return out.map((s) => s.trim()).filter((s) => s !== '');
}

function one(entity: Entity, field: FieldDef | undefined): string {
  if (field === undefined) return '';
  const v = valuesOf(entity, field)[0]?.value;
  if (Array.isArray(v)) return v.map(text).join(', ');
  if (typeof v === 'object' && v !== null && 'value' in v) return text((v as { value: unknown }).value);
  return text(v).trim();
}

function refs(entity: Entity, field: FieldDef): string[] {
  return valuesOf(entity, field).map((v) => {
    const value = v.value;
    return typeof value === 'string' ? value : typeof value === 'object' && value !== null && 'value' in value ? text((value as { value: unknown }).value) : '';
  }).filter((s) => s !== '');
}

/** Ein Eintrag als Teil des Wissens eines Werks. */
export function workEntityOf(entity: Entity, look: Lookup, base?: string): WorkEntity {
  const fields = fieldsOf(entity, look);
  const byRole = (role: string) => fields.find((f) => (f.role ?? f.key) === role) ?? fields.find((f) => f.key === role);
  const kindId = entity.kinds[0] ?? '';
  const ref = (role: string) => { const f = byRole(role); return f === undefined || f.type !== 'ref' ? undefined : refs(entity, f)[0]; };
  const relations: { field: string; label: string; to: string }[] = [];
  const requires: string[] = [];
  for (const f of fields) {
    if (f.type !== 'ref' || f.external === true) continue;
    if ((WORK_FIELD_ROLES as readonly string[]).includes(f.role ?? f.key)) continue;
    for (const to of refs(entity, f)) {
      if (f.prerequisite === 'up') requires.push(to);
      else relations.push({ field: f.key, label: f.label, to });
    }
  }
  const phaseOf = ref('phaseOf');
  return {
    id: entity.id,
    label: labelOf(entity, look),
    kind: look.kind(kindId)?.name ?? kindId,
    kindId,
    ...(base === undefined ? {} : { base }),
    forms: words(entity, byRole('forms')),
    forbidden: words(entity, byRole('forbidden')),
    preferred: one(entity, byRole('preferred')),
    definition: one(entity, byRole('definition')),
    usage: one(entity, byRole('usage')),
    description: one(entity, byRole('description')),
    requires: [...new Set(requires)],
    relations,
    ...(phaseOf === undefined ? {} : { phaseOf }),
    ...(ref('validFrom') === undefined ? {} : { from: ref('validFrom') }),
    ...(ref('validUntil') === undefined ? {} : { until: ref('validUntil') }),
    ...(one(entity, byRole('storyFrom')) === '' ? {} : { storyFrom: one(entity, byRole('storyFrom')) }),
    ...(one(entity, byRole('storyUntil')) === '' ? {} : { storyUntil: one(entity, byRole('storyUntil')) })
  };
}

/**
 * DAS WISSEN AUS EINER OFFENEN BAZA (oder der Linse des Skryptorium): alle eigenen Einträge der genannten Bazy,
 * dazu die Einträge, auf die das Werk zeigt (`extra`), wo immer sie liegen — sofern dieser Leser sie öffnen kann.
 */
export function knowledgeFrom(lib: CogitaLibrary, bases: readonly string[], extra: Iterable<string> = []): WorkKnowledge {
  const wanted = new Set(bases);
  const out = new Map<string, WorkEntity>();
  const look = lib.look;
  for (const entity of lib.entities()) {
    const origin = lib.origin(entity.id)?.libraryId ?? (lib.isOwn(entity.id) ? lib.libraryId : undefined);
    if (origin === undefined || !wanted.has(origin)) continue;
    if (['text', 'delivery', 'project', 'node', 'person', 'work', 'quote'].includes(entity.kinds[0] ?? '') && !entity.kinds.slice(1).some((k) => look.kind(k) !== undefined)) continue;
    out.set(entity.id, workEntityOf(entity, look, origin));
  }
  for (const id of extra) {
    if (out.has(id)) continue;
    const entity = lib.entity(id);
    if (entity !== undefined) out.set(id, workEntityOf(entity, look, lib.origin(id)?.libraryId));
  }
  /* Die Phase eines Eintrags gehört dazu, auch wenn sie in einer anderen Baza liegt. */
  for (const entity of lib.entities()) {
    if (out.has(entity.id)) continue;
    const made = workEntityOf(entity, look, lib.origin(entity.id)?.libraryId);
    if (made.phaseOf !== undefined && out.has(made.phaseOf)) out.set(entity.id, made);
  }
  return knowledgeOf([...out.values()]);
}

/** Die Formen, an denen ein Vorkommen ohne Link im Text erkannt wird: das Etikett, die bevorzugte Form, die Formen. */
export function formsOf(e: WorkEntity): string[] {
  return [...new Set([e.label, e.preferred, ...e.forms].map((s) => s.trim()).filter((s) => s.length >= 3))];
}
