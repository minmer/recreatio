/** 0130 — die Adressen von „Zgłoś" (klein, damit jede Klausel und jedes Menü sie nehmen kann, ohne mehr zu laden). */

import { path } from '../routes';

/** Die Arten, die sich melden lassen — dieselben wie `Reports.Kinds` im Dienst. */
export const REPORT_KINDS = ['page', 'part', 'file', 'form', 'message', 'entry', 'item', 'share', 'link', 'event'] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export const isReportKind = (word: string | null | undefined): word is ReportKind =>
  word !== null && word !== undefined && (REPORT_KINDS as readonly string[]).includes(word);

/** `#/zglos/<art>/<kennung>` — eine Sache melden. */
export const reportPath = (kind: string, id: string): string => path('zglos', kind, id);

/** `#/zglos` — eine Adresse melden (ein Feld). */
export const reportAnyPath = (): string => path('zglos');

/** `#/zglos/stan` — was aus einer Meldung wurde. */
export const reportStatusPath = (): string => path('zglos', 'stan');

/** Die Art, die der Dienst an die Stelle eines nach einer Meldung gesperrten Teils setzt (`Page.PartsOfAsync`). */
export const BLOCKED_KIND = 'blocked';

/** Der Satz an der Stelle eines gesperrten Teils — überall derselbe. */
export const BLOCKED_PART_TEXT = 'Ten fragment zablokowano po zgłoszeniu.';
