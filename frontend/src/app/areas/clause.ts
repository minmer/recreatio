/**
 * 0129 — DIE KLAUSEL in Worten: wer für die Daten geradesteht, wie man ihn
 * erreicht, wo man sich beschweren kann — und wer den Dienst technisch betreibt.
 *
 * Steht über jedem Formular, an jeder Reservierung, über „Napisz do nas", auf
 * der Seite eines Links mit Zugang und unten auf jeder öffentlichen Seite. Ohne
 * Administrator sammelt ein Bereich nichts (der Dienst lehnt ab); dann sagt die
 * Klausel genau das.
 */

import { appLang, tFor, type Lang } from '../core/i18n';
import { OPERATOR } from '../operator';
import type { Authority } from './controllers';

/** Was die Klausel braucht — der Datensatz, wie Formular, Reservierung oder Seite ihn mitbringen. */
export interface ClauseController {
  readonly name: string;
  readonly address: string | null;
  readonly email: string | null;
  readonly phone?: string | null;
  readonly dpo?: { readonly name: string | null; readonly contact: string | null } | null;
  readonly authority?: Authority | null;
}

/** Wo die Klausel steht: wo Daten gesammelt werden, oder unter einer Seite (wer für ihren Inhalt geradesteht). */
export type ClauseContext = 'collect' | 'page';

export interface ClauseLines {
  /** „Administrator danych: Parafia …, ul. …, e-mail …" — oder `null`, wenn niemand. */
  readonly who: string | null;
  readonly dpo: string | null;
  readonly complaint: string | null;
  /** Wer den Dienst betreibt — immer. */
  readonly operator: string;
  /** Der Satz, wenn niemand geradesteht. */
  readonly nobody: string | null;
}

const joined = (parts: readonly (string | null | undefined)[]): string =>
  parts.map((one) => (one ?? '').trim()).filter((one) => one !== '').join(', ');

export function clauseLines(c: ClauseController | null, context: ClauseContext, lang?: Lang): ClauseLines {
  const t = tFor(lang ?? appLang());
  const operator = context === 'collect'
    ? t('areas.clause.operatorCollect', { name: OPERATOR.name, email: OPERATOR.email })
    : t('areas.clause.operatorPage', { name: OPERATOR.name, email: OPERATOR.email });

  if (c === null) {
    return {
      who: null, dpo: null, complaint: null, operator,
      nobody: context === 'collect'
        ? t('areas.clause.nobodyCollect')
        : t('areas.clause.nobodyPage')
    };
  }

  const contact = joined([c.address, c.email === null || c.email === undefined ? null : t('areas.clause.email', { email: c.email }), c.phone ? t('areas.clause.phone', { phone: c.phone }) : null]);
  const who = contact === ''
    ? t(context === 'collect' ? 'areas.clause.controller' : 'areas.clause.responsible', { name: c.name })
    : t(context === 'collect' ? 'areas.clause.controllerContact' : 'areas.clause.responsibleContact', { name: c.name, contact });
  const dpoText = c.dpo === null || c.dpo === undefined ? '' : joined([c.dpo.name, c.dpo.contact]);
  return {
    who,
    dpo: dpoText === '' ? null : t('areas.clause.dpo', { dpo: dpoText }),
    complaint: context === 'collect' && c.authority ? t('areas.clause.complaint', { authority: t(`areas.authorityTo.${c.authority}`) }) : null,
    operator,
    nobody: null
  };
}

/** Die ganze Klausel als ein Text — für Druck und Ausfuhr. */
export const clauseText = (c: ClauseController | null, context: ClauseContext, lang?: Lang): string => {
  const l = clauseLines(c, context, lang);
  return [l.who ?? l.nobody, l.dpo, l.complaint, l.operator].filter((one): one is string => one !== null).join(' ');
};
