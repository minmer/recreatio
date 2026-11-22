/**
 * 2026-11-22 (Homer-Einheit) — DIE VORSCHAU DES IMPORTS FÜR LEKTÜRE-FRAGEN: was einer Frage `lines`, `label`, `span` fehlt (Werk
 * und Stelle, richtige Zeilen, Rollen, Bereiche), Zuordnungen mit unbekannter Rolle, Fehler-Tags, die keine Zeilen nennen.
 * Ob der Text des Werks erreichbar ist, sieht nur der Browser (die Bibliotheken) — die Prüfung im Dienst kennt sie nicht.
 */

import { t } from '../../core/i18n';
import { isReadingForm, readLabels, readLineTags, readingProblems, readRoles } from './readingSpec';

const clip = (text: string, n: number): string => { const flat = text.replace(/\s+/g, ' ').trim(); return flat.length > n ? `${flat.slice(0, n - 1)}…` : flat; };

interface PlannedEntity { readonly id: string; readonly kinds: readonly string[]; readonly data: Readonly<Record<string, unknown>> }

export function readingImportWarnings(plan: { readonly entities: readonly PlannedEntity[] }): string[] {
  const out: string[] = [];
  for (const e of plan.entities) {
    if (!e.kinds.includes('question') || !isReadingForm(e.data.form)) continue;
    const name = clip(typeof e.data.prompt === 'string' && e.data.prompt.trim() !== '' ? e.data.prompt : e.id, 60);
    const problems = readingProblems(e.data.form, e.data).map((p) => t(`cogitaReading.problem.${p}`));
    if (e.data.form === 'label') {
      const roles = readRoles(e.data.roles);
      const unknown = roles.length < 2 ? 0 : readLabels(e.data.labels, roles).unknown;
      if (unknown > 0) problems.push(t('cogitaReading.import.unknownRole', { count: unknown }));
    }
    const tagRows = Array.isArray(e.data.tags) ? e.data.tags.filter((x) => typeof x === 'string' ? x.trim() !== '' : true) : [];
    if (tagRows.length > readLineTags(e.data.tags).length) problems.push(t('cogitaReading.import.tagRows'));
    if (problems.length > 0) out.push(t('cogitaReading.import.question', { name, problems: problems.join(' ') }));
  }
  return out;
}
