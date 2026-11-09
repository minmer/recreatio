/**
 * 2026-10-26 — SCHEMATA UND PLÄNE EINES KALENDERS (0132), in seinen
 * Einstellungen: die Liste, „+ Nowy", „Z szablonu" (eine Vorlage kommt nur
 * von Hand hinein, D13), Bearbeiten im Vollbild, und „Zastosuj…" für einen
 * Plan. Braucht ein Plan aus einer Vorlage ein Schema („Rok liturgiczny"
 * braucht „Msza"), wird es mit angelegt, wenn der Kalender keines dieses
 * Namens hat.
 */

import { lazy, Suspense, useState } from 'react';

import type { AreaRow } from '../areas/area';
import { useT } from '../core/i18n';
import type { Me } from '../core/me';
import { WorkspaceError } from '../core/session';
import { ITEM_LABEL } from './calendar';
import type { CalendarRow } from './calendar';
import { forgetDocs, useCalendarDocs } from './calendarDocs';
import { type OpenedDoc, type PlanDef, saveDoc, type SchemeDef } from './scheme';
import { PLAN_TEMPLATES } from './templates/planTemplates';
import { SCHEME_TEMPLATES } from './templates/schemeTemplates';

const SchemeEditor = lazy(() => import('./SchemeEditor').then((m) => ({ default: m.SchemeEditor })));
const PlanEditor = lazy(() => import('./PlanEditor').then((m) => ({ default: m.PlanEditor })));
const PlanApply = lazy(() => import('./PlanApply'));

type Open =
  | { readonly what: 'scheme'; readonly doc: OpenedDoc<SchemeDef> | null; readonly start?: SchemeDef }
  | { readonly what: 'plan'; readonly doc: OpenedDoc<PlanDef> | null; readonly start?: PlanDef }
  | { readonly what: 'apply'; readonly planId: string };

export function CalendarDocsSection({ me, areas, calendar, calendars, onChanged }: {
  me: Me;
  areas: readonly AreaRow[];
  calendar: CalendarRow;
  /** Alle Kalender, in denen ich schreibe — für „Zastosuj…". */
  calendars: readonly CalendarRow[];
  onChanged: () => void;
}) {
  const t = useT();
  const docs = useCalendarDocs(me.ring, calendar.calendarId);
  const [open, setOpen] = useState<Open | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  /* Ein Plan aus einer Vorlage — und, wenn er eines braucht, das Schema dazu. */
  const planFrom = async (id: string) => {
    const template = PLAN_TEMPLATES.find((one) => one.id === id);
    if (template === undefined || docs === null) return;
    setBusy(true);
    setFailed(null);
    try {
      let schemeId = template.def.schemeId ?? null;
      const needs = template.needs === undefined ? undefined : SCHEME_TEMPLATES.find((one) => one.id === template.needs);
      if (needs !== undefined) {
        const had = docs.schemes.find((s) => s.def.name === needs.def.name);
        schemeId = had?.docId ?? (await saveDoc(me.ring, calendar, 'scheme', needs.def)).docId;
        if (had === undefined) forgetDocs(calendar.calendarId);
      }
      setOpen({ what: 'plan', doc: null, start: { ...template.def, schemeId } });
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : t('calendarData.docs.templateFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="wk-calset-docs" aria-label={t('calendarData.docs.aria')}>
      <h3 className="wk-h3">{t('calendarData.docs.schemes')}</h3>
      {docs === null ? <p className="wk-empty">…</p> : docs.schemes.length === 0 ? (
        <p className="wk-empty">{t('calendarData.docs.noSchemes')}</p>
      ) : (
        <ul className="wk-calset-doclist">
          {docs.schemes.map((s) => (
            <li key={s.docId}>
              <strong>{s.def.name}</strong>
              <span className="wk-row-side"> · {t('calendarData.docs.schemeLine', { kind: ITEM_LABEL[s.def.kind ?? 'appointment'], fields: s.def.fields.length, lists: s.def.lists.length })}</span>
              <button type="button" className="wk-link-btn" onClick={() => setOpen({ what: 'scheme', doc: s })}>{t('common.change')}</button>
            </li>
          ))}
        </ul>
      )}
      <div className="wk-actions">
        <button type="button" className="wk-btn wk-btn-quiet wk-btn-small" disabled={busy} onClick={() => setOpen({ what: 'scheme', doc: null })}>{t('calendarData.docs.newScheme')}</button>
        <select value="" disabled={busy} aria-label={t('calendarData.docs.schemeTemplate')} onChange={(e) => {
          const tpl = SCHEME_TEMPLATES.find((one) => one.id === e.target.value);
          if (tpl !== undefined) setOpen({ what: 'scheme', doc: null, start: tpl.def });
        }}>
          <option value="">{t('calendarData.docs.fromTemplate')}</option>
          {SCHEME_TEMPLATES.map((one) => <option key={one.id} value={one.id}>{one.def.name}</option>)}
        </select>
      </div>

      <h3 className="wk-h3">{t('calendarData.docs.plans')}</h3>
      {docs === null ? <p className="wk-empty">…</p> : docs.plans.length === 0 ? (
        <p className="wk-empty">{t('calendarData.docs.noPlans')}</p>
      ) : (
        <ul className="wk-calset-doclist">
          {docs.plans.map((p) => (
            <li key={p.docId}>
              <strong>{p.def.name}</strong>
              <span className="wk-row-side"> · {t('calendarData.docs.planLine', { scheme: docs.schemes.find((s) => s.docId === p.def.schemeId)?.def.name ?? t('calendarDataScheme.universal.name'), nodes: p.def.flow.nodes.length })}</span>
              <button type="button" className="wk-link-btn" onClick={() => setOpen({ what: 'plan', doc: p })}>{t('common.change')}</button>
              <button type="button" className="wk-link-btn" onClick={() => setOpen({ what: 'apply', planId: p.docId })}>{t('calendarData.docs.apply')}</button>
            </li>
          ))}
        </ul>
      )}
      <div className="wk-actions">
        <button type="button" className="wk-btn wk-btn-quiet wk-btn-small" disabled={busy}
          onClick={() => setOpen({ what: 'plan', doc: null, start: { name: '', flow: { v: 1, nodes: [{ id: 'day', type: 'day', x: 0, y: 0, data: {} }, { id: 'mass', type: 'mass', x: 0, y: 260, data: {} }], edges: [] } } })}>
          {t('calendarData.docs.newPlan')}
        </button>
        <select value="" disabled={busy} aria-label={t('calendarData.docs.planTemplate')} onChange={(e) => { if (e.target.value !== '') void planFrom(e.target.value); }}>
          <option value="">{t('calendarData.docs.fromTemplate')}</option>
          {PLAN_TEMPLATES.map((one) => <option key={one.id} value={one.id}>{one.def.name}</option>)}
        </select>
      </div>
      {failed !== null && <p className="wk-error">{failed}</p>}

      <Suspense fallback={null}>
        {open?.what === 'scheme' && (
          <SchemeEditor me={me} calendar={calendar} doc={open.doc} start={open.start} onClose={() => setOpen(null)} onSaved={onChanged} />
        )}
        {open?.what === 'plan' && docs !== null && (
          <PlanEditor me={me} calendar={calendar} doc={open.doc} start={open.start} schemes={docs.schemes}
            onClose={() => setOpen(null)} onSaved={onChanged} onApply={(planId) => setOpen({ what: 'apply', planId })} />
        )}
        {open?.what === 'apply' && (
          <PlanApply me={me} areas={areas} calendars={calendars} calendarId={calendar.calendarId} planId={open.planId}
            onClose={() => setOpen(null)} onDone={onChanged} />
        )}
      </Suspense>
    </section>
  );
}

export default CalendarDocsSection;
