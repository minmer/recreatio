/**
 * DAS REGELBUCH BLEIBT IM SKRYPTORIUM (2026-11-15). Eine Regel (Art `rule`) sagt, wie geschrieben wird — Stil,
 * Stimme, Zeit, Anrede, Zielgruppe, Zitierweise, Länge — und WARUM. Sie gilt, wo alles zutrifft, was sie nennt:
 *
 *   project     das Werk (leer: das eigene Regelbuch — jedes Projekt dieses Skryptorium erbt es)
 *   node        ein Teilbaum (der Knoten und alles darunter)
 *   role        Knoten dieser Rolle (etwa nur Zusammenfassungen)
 *   template    Einheiten aus dieser Vorlage (auch unter einem Knoten aus ihr)
 *   dimension + value   Wege, die diesen Wert wählen („für Kinder: kurze Sätze")
 *   entity      Stellen, an denen dieser Eintrag vorkommt (wie eine Person spricht, wie ein Begriff eingeführt wird)
 *
 * Was sich von selbst prüfen lässt (`check` + `param`), prüft `workChecks.ts` — eine Stelle für App und KI.
 */

import { ids, str, wordCount, type LibEntry } from '../../library/libraryKinds';
import { ancestors, chosenValue, type Placed, type WorkLook, type WorkModel, type WorkPath } from './workModel';

export interface WorkRule {
  readonly id: string;
  readonly key?: string;
  /** `null`: das eigene Regelbuch. */
  readonly project: string | null;
  readonly rule: string;
  readonly why: string;
  readonly weight: 'must' | 'should';
  readonly node: string | null;
  readonly role: string;
  readonly template: string | null;
  readonly dimension: string;
  readonly value: string;
  readonly entity: string | null;
  readonly good: string;
  readonly bad: string;
  readonly check: string;
  readonly param: string;
}

export function readRule(e: LibEntry): WorkRule {
  const d = e.data;
  return {
    id: e.id,
    ...(e.key === undefined ? {} : { key: e.key }),
    project: ids(d, 'project')[0] ?? null,
    rule: str(d, 'rule').trim(),
    why: str(d, 'why').trim(),
    weight: str(d, 'weight') === 'must' ? 'must' : 'should',
    node: ids(d, 'node')[0] ?? null,
    role: str(d, 'role').trim(),
    template: ids(d, 'template')[0] ?? null,
    dimension: str(d, 'dimension').trim(),
    value: str(d, 'value').trim(),
    entity: ids(d, 'entity')[0] ?? null,
    good: str(d, 'good').trim(),
    bad: str(d, 'bad').trim(),
    check: str(d, 'check'),
    param: str(d, 'param').trim()
  };
}

/** Die Regeln eines Werks: seine eigenen und das eigene Regelbuch (Regeln ohne Projekt). */
export function rulesOf(model: WorkModel, look: WorkLook): WorkRule[] {
  return look.all().filter((e) => e.kind === 'rule').map(readRule).filter((r) => r.project === null || r.project === model.project.id)
    .sort((a, b) => (a.project === null ? 0 : 1) - (b.project === null ? 0 : 1) || (a.weight === 'must' ? 0 : 1) - (b.weight === 'must' ? 0 : 1));
}

/**
 * Gilt die Regel an dieser Stelle des Weges? `entities`: was an der Stelle vorkommt (für Regeln zu einem Eintrag).
 */
export function ruleApplies(model: WorkModel, rule: WorkRule, at: Placed, path: WorkPath, entities: ReadonlySet<string>): boolean {
  const chain = [at.node, ...ancestors(model, at.node)];
  if (rule.node !== null && !chain.some((n) => n.id === rule.node)) return false;
  if (rule.role !== '' && at.node.role !== rule.role) return false;
  if (rule.template !== null && !chain.some((n) => n.template === rule.template)) return false;
  if (rule.dimension !== '') {
    const chosen = at.through[rule.dimension] ?? chosenValue(model, path, rule.dimension);
    if (chosen === undefined || (rule.value !== '' && chosen !== rule.value)) return false;
  }
  if (rule.entity !== null && !entities.has(rule.entity)) return false;
  return true;
}

/** Die Regeln, die an einer Stelle gelten. */
export function rulesAt(model: WorkModel, rules: readonly WorkRule[], at: Placed, path: WorkPath, entities: ReadonlySet<string>): WorkRule[] {
  return rules.filter((r) => ruleApplies(model, r, at, path, entities));
}

/* -- Was sich am Wortlaut prüfen lässt ---------------------------------------------------------------- */

/** Die Sätze eines Textes (am Satzzeichen mit Leerraum dahinter; Zeilenwechsel trennen auch). */
export function sentencesOf(plain: string): string[] {
  return plain.split(/(?<=[.!?…])\s+|\n+/).map((s) => s.trim()).filter((s) => wordCount(s) > 0);
}

/** Wörter oder Wendungen aus dem Parameter („a, b; c"). */
export const phrasesOf = (param: string): string[] => param.split(/[,;\n]/).map((s) => s.trim()).filter((s) => s !== '');

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Steht die Wendung als ganzes Wort (Gross/klein egal) im Text? */
export function hasPhrase(plain: string, phrase: string): boolean {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escape(phrase)}(?![\\p{L}\\p{N}])`, 'iu').test(plain);
}

/** Die Zahl im Parameter, oder `null`. */
export const numberParam = (param: string): number | null => {
  const n = Number(param.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
};
