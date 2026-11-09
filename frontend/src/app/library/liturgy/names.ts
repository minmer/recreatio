/**
 * 2026-11-09 — DIE ARTEN DER LITURGIA, ohne den Validator: `libraryKinds.ts` liegt im ersten Bündel, zod und die
 * eingebauten Vorgaben (`schema.ts`, `defaults.ts`) kommen erst mit einer geöffneten Liturgia, Cogita oder dem AI-Zugang.
 */

/** Rodzaj encji im Import → Art des Eintrags in der Bibliothek. */
export const KIND = {
  canonical_work: 'lit_work', text_edition: 'lit_edition', text_resource: 'lit_text', passage_definition: 'lit_passage',
  liturgical_template: 'lit_template', calendar_observance: 'lit_observance', liturgical_assignment: 'lit_assignment',
  liturgical_rule: 'lit_rule', calendar_profile: 'lit_calendar'
} as const;

export const isLiturgyKind = (kind: string): boolean => Object.values<string>(KIND).includes(kind);
