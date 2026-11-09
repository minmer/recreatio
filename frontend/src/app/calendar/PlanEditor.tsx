/**
 * 2026-10-26 — EINEN PLAN BEARBEITEN (0132, D8): Name, welches Schema und
 * welche Art die angelegten Termine bekommen, wie viele Wochen die Vorschau
 * vorschlägt — und der Ablauf selbst (React Flow, `flow/FlowEditor.tsx`).
 * Daneben die Probe: ein Tag gewählt, und es steht da, was der Plan an ihm
 * anlegen würde (Kirchenjahr, Fest, Messen mit Titel, Werten, Einträgen).
 */

import { lazy, Suspense, useState } from 'react';

import { useT } from '../core/i18n';
import type { Me } from '../core/me';
import { WorkspaceError } from '../core/session';
import { askText } from '../ui/dialogs';
import { JsonPanel } from '../ui/JsonPanel';
import { Loading } from '../ui/Loading';
import { Fullscreen } from '../ui/Modal';
import { type CalendarRow, ITEM_KINDS, ITEM_LABEL, type ItemKind } from './calendar';
import { forgetDocs } from './calendarDocs';
import type { FlowDoc } from './flow/flowModel';
import { planDay } from './flow/flowRun';
import {
  colourClass, deleteDoc, keyOf, type OpenedDoc, type PlanDef, saveDoc, type SchemeDef, schemeOf, UNIVERSAL_ID
} from './scheme';
import { exportPlan, PLAN_JSON, readPlan } from './schemeJson';

const FlowEditor = lazy(() => import('./flow/FlowEditor'));

const capital = (text: string) => text.replace(/^./, (c) => c.toUpperCase());

/** Der nächste Sonntag (oder heute, wenn Sonntag ist) — der Tag, an dem man einen Plan zuerst prüft. */
function nextSunday(): string {
  const d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function PlanEditor({ me, calendar, doc, start, schemes, onClose, onSaved, onApply }: {
  me: Me;
  calendar: CalendarRow;
  doc: OpenedDoc<PlanDef> | null;
  start?: PlanDef;
  /** Die Schemata dieses Kalenders. */
  schemes: readonly OpenedDoc<SchemeDef>[];
  onClose: () => void;
  onSaved: () => void;
  /** Ein gespeicherter Plan: gleich anwenden. */
  onApply?: (docId: string) => void;
}) {
  const t = useT();
  const [def, setDef] = useState<PlanDef>(doc?.def ?? start ?? { name: '', flow: { v: 1, nodes: [], edges: [] } });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const scheme = schemeOf(schemes, def.schemeId ?? null);
  const patch = (next: Partial<PlanDef>) => setDef((was) => ({ ...was, ...next }));

  const save = async (): Promise<string | null> => {
    if (def.name.trim() === '') { setFailed(t('calendarData.planEditor.needsName')); return null; }
    setBusy(true);
    setFailed(null);
    try {
      const saved = await saveDoc(me.ring, calendar, 'plan', { ...def, name: def.name.trim() }, doc?.docId, doc?.version);
      forgetDocs(calendar.calendarId);
      onSaved();
      return saved.docId;
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : t('calendarData.planEditor.saveFailed'));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (doc === null || !(await askText(t('calendarData.planEditor.confirmDelete')))) return;
    setBusy(true);
    try {
      await deleteDoc(doc.docId);
      forgetDocs(calendar.calendarId);
      onSaved();
      onClose();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : t('calendarData.planEditor.deleteFailed'));
      setBusy(false);
    }
  };

  return (
    <Fullscreen title={doc === null ? t('calendarData.planEditor.newTitle') : t('calendarData.planEditor.title', { name: def.name || t('calendarData.schemeEditor.noName') })} onClose={onClose}>
      <div className="wk-sch">
        <div className="wk-sch-head">
          <label className="wk-field">
            <span>{t('calendarData.schemeEditor.name')}</span>
            <input value={def.name} maxLength={120} placeholder={t('calendarData.planEditor.namePlaceholder')} onChange={(e) => patch({ name: e.target.value })} />
          </label>
          <label className="wk-field">
            <span>{t('calendarData.planEditor.scheme')}</span>
            <select value={def.schemeId ?? ''} onChange={(e) => patch({ schemeId: e.target.value === '' ? null : e.target.value })}>
              <option value="">{t('calendarDataScheme.universal.name')}</option>
              {schemes.map((s) => <option key={s.docId} value={s.docId}>{s.def.name}</option>)}
            </select>
          </label>
          <label className="wk-field">
            <span>{t('calendarData.planEditor.kind')}</span>
            <select value={def.kind ?? scheme.def.kind ?? 'mass'} onChange={(e) => patch({ kind: e.target.value as ItemKind })}>
              {ITEM_KINDS.filter((k) => k !== 'task').map((k) => <option key={k} value={k}>{capital(ITEM_LABEL[k])}</option>)}
            </select>
          </label>
          <label className="wk-field">
            <span>{t('calendarData.planEditor.weeks')}</span>
            <input type="number" min={1} max={60} value={def.weeks ?? 8} onChange={(e) => patch({ weeks: Math.max(1, Math.min(60, Number(e.target.value) || 8)) })} />
          </label>
        </div>
        {scheme.id === UNIVERSAL_ID && def.flow.nodes.some((n) => n.type === 'set' && (n.data as { target?: string }).target === 'field') && (
          <p className="wk-warn">{t('calendarData.planEditor.universalWarn')}</p>
        )}

        <Suspense fallback={<Loading label={t('calendarData.schemeEditor.loadingEditor')} />}>
          <FlowEditor kind="plan" doc={def.flow} fields={scheme.def.fields} lists={scheme.def.lists}
            onChange={(flow: FlowDoc) => patch({ flow })}
            preview={<PlanProbe flow={def.flow} scheme={scheme.def} />} />
        </Suspense>

        <JsonPanel
          summary={t('calendarData.planEditor.jsonSummary')}
          lead={t('calendarData.planEditor.jsonLead')}
          fileName={t('calendarData.planEditor.fileName', { name: keyOf(def.name || t('calendarData.planEditor.fileFallback')) })}
          exportDoc={() => exportPlan(def)}
          format={PLAN_JSON}
          preview={(value) => {
            const warnings: string[] = [];
            const read = readPlan(value, schemes.map((s) => s.docId), warnings);
            return read === null ? { error: warnings[0] ?? t('calendarData.planEditor.notPlan') }
              : { lines: [t('calendarData.planEditor.previewLine', { name: read.name, nodes: read.flow.nodes.length })], warnings };
          }}
          importLabel={t('calendarData.schemeEditor.importLabel')}
          onImport={async (value) => {
            const warnings: string[] = [];
            const read = readPlan(value, schemes.map((s) => s.docId), warnings);
            if (read === null) throw new WorkspaceError(warnings[0] ?? t('calendarData.planEditor.notPlan'));
            setDef(read);
            return { lines: [t('calendarData.schemeEditor.loaded')], warnings };
          }}
        />

        {failed !== null && <p className="wk-error">{failed}</p>}
        <div className="wk-actions">
          <button type="button" className="wk-btn" disabled={busy} onClick={() => void save().then((id) => { if (id !== null) onClose(); })}>
            {busy ? t('common.saving') : t('calendarData.planEditor.save')}
          </button>
          {onApply !== undefined && (
            <button type="button" className="wk-btn wk-btn-quiet" disabled={busy} onClick={() => void save().then((id) => { if (id !== null) onApply(id); })}>
              {t('calendarData.planEditor.saveApply')}
            </button>
          )}
          <button type="button" className="wk-btn wk-btn-quiet" disabled={busy} onClick={onClose}>{t('common.cancel')}</button>
          {doc !== null && <button type="button" className="wk-link-btn wk-danger" disabled={busy} onClick={() => void remove()}>{t('calendarData.planEditor.delete')}</button>}
        </div>
      </div>
    </Fullscreen>
  );
}

/** Was der Plan an einem Tag anlegen würde. */
export function PlanProbe({ flow, scheme }: { flow: FlowDoc; scheme: SchemeDef }) {
  const t = useT();
  const [date, setDate] = useState(nextSunday);
  let day: ReturnType<typeof planDay> | null = null;
  let broken: string | null = null;
  try {
    day = date === '' ? null : planDay(flow, date);
  } catch (e) {
    broken = e instanceof Error ? e.message : t('calendarData.planEditor.flowBroken');
  }
  const label = (key: string) => scheme.fields.find((f) => f.key === key)?.label ?? key;

  return (
    <div className="wk-sch-probe" aria-label={t('calendarData.planEditor.dayPreview')}>
      <label className="wk-field">
        <span>{t('calendarData.planEditor.dayPreview')}</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      {broken !== null && <p className="wk-error">{broken}</p>}
      {day !== null && (
        <>
          <p className="wk-sch-day">
            <span className={`wk-lc${colourClass(day.ctx.colour) === null ? ' is-none' : ` ${colourClass(day.ctx.colour)}`}`} aria-hidden="true" />
            {day.ctx.celebration?.name ?? (day.ctx.sunday ? day.ctx.sundayName : day.ctx.seasonName)}
            <span className="wk-row-side"> · {t('calendarData.planEditor.dayLine', { season: day.ctx.seasonName, week: day.ctx.week, rank: day.ctx.celebration?.rank ?? day.ctx.dayRank })}</span>
          </p>
          {day.masses.length === 0 ? <p className="wk-empty">{t('calendarData.planEditor.noMasses')}</p> : (
            <ul className="wk-sch-masses">
              {day.masses.map((m) => (
                <li key={m.slot.key}>
                  <strong>{m.slot.time}</strong> {m.title}
                  {Object.entries(m.values).length > 0 && (
                    <span className="wk-row-side"> · {Object.entries(m.values).map(([k, v]) => `${label(k)}: ${v}`).join(' · ')}</span>
                  )}
                  {m.records.length > 0 && <span className="wk-row-side"> · {m.records.map((r) => `${r.list}: ${r.text}`).join(' · ')}</span>}
                </li>
              ))}
            </ul>
          )}
          {day.problems.length > 0 && <div className="wk-warn">{day.problems.map((p) => <p key={p}>{p}</p>)}</div>}
        </>
      )}
    </div>
  );
}
