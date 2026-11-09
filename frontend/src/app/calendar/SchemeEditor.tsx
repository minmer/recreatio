/**
 * 2026-10-26 — EIN SCHEMA BEARBEITEN (0132): Name, Art der Termine, ob der
 * Titel offen ist, die Felder (am Termin oder an einem Tag, offen oder
 * versiegelt, Pflicht), und die Listen von Einträgen — jede mit ihren Arten,
 * ihrem offenen Text, ihrer Person, ihren Feldern und ihrer Regel als Ablauf
 * (React Flow, `flow/FlowEditor.tsx`), samt einer Probe der Regel.
 *
 * Gespeichert wird versiegelt im Kalender (`saveDoc`); JSON hinaus und hinein
 * daneben (`schemeJson.ts`).
 */

import { lazy, Suspense, useRef, useState } from 'react';

import { useT } from '../core/i18n';
import type { Me } from '../core/me';
import { WorkspaceError } from '../core/session';
import { askText } from '../ui/dialogs';
import { JsonPanel } from '../ui/JsonPanel';
import { Loading } from '../ui/Loading';
import { Fullscreen } from '../ui/Modal';
import { type CalendarRow, ITEM_KINDS, ITEM_LABEL, type ItemKind } from './calendar';
import { forgetDocs } from './calendarDocs';
import { EMPTY_FLOW, type FlowDoc, type RuleCtx } from './flow/flowModel';
import { runRule } from './flow/flowRun';
import {
  deleteDoc, keyOf, LITURGICAL_COLOURS, type OpenedDoc, type RecordList, saveDoc, SCHEME_FIELD_LABEL,
  SCHEME_FIELD_TYPES, type SchemeChoice, type SchemeDef, type SchemeField, type SchemeFieldType
} from './scheme';
import { exportScheme, readScheme, SCHEME_JSON } from './schemeJson';

const FlowEditor = lazy(() => import('./flow/FlowEditor'));

const capital = (text: string) => text.replace(/^./, (c) => c.toUpperCase());

/** Wahlmöglichkeiten als Zeilen: „wartość: nazwa" oder nur „nazwa". */
const choicesText = (options: readonly SchemeChoice[] | undefined) =>
  (options ?? []).map((o) => (o.value === o.label ? o.label : `${o.value}: ${o.label}`)).join('\n'); // i18n-ignore
const choicesOf = (text: string): SchemeChoice[] =>
  text.split('\n').map((line) => line.trim()).filter((line) => line !== '').map((line) => {
    const at = line.indexOf(':');
    return at > 0 ? { value: line.slice(0, at).trim(), label: line.slice(at + 1).trim() || line.slice(0, at).trim() } : { value: line, label: line };
  });

export function SchemeEditor({ me, calendar, doc, start, onClose, onSaved }: {
  me: Me;
  calendar: CalendarRow;
  /** Ein gespeichertes — oder `null` für ein neues. */
  doc: OpenedDoc<SchemeDef> | null;
  /** Für ein neues: womit es beginnt (eine Vorlage). */
  start?: SchemeDef;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const [def, setDef] = useState<SchemeDef>(doc?.def ?? start ?? { name: '', fields: [], lists: [] });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [ruleOf, setRuleOf] = useState<string | null>(null);

  const patch = (next: Partial<SchemeDef>) => setDef((was) => ({ ...was, ...next }));
  const setList = (key: string, next: RecordList | null) =>
    patch({ lists: next === null ? def.lists.filter((l) => l.key !== key) : def.lists.map((l) => (l.key === key ? next : l)) });

  const save = async () => {
    if (def.name.trim() === '') { setFailed(t('calendarData.schemeEditor.needsName')); return; }
    setBusy(true);
    setFailed(null);
    try {
      await saveDoc(me.ring, calendar, 'scheme', { ...def, name: def.name.trim() }, doc?.docId, doc?.version);
      forgetDocs(calendar.calendarId);
      onSaved();
      onClose();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : t('calendarData.schemeEditor.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (doc === null || !(await askText(t('calendarData.schemeEditor.confirmDelete')))) return;
    setBusy(true);
    try {
      await deleteDoc(doc.docId);
      forgetDocs(calendar.calendarId);
      onSaved();
      onClose();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : t('calendarData.schemeEditor.deleteFailed'));
      setBusy(false);
    }
  };

  const editingRule = ruleOf === null ? undefined : def.lists.find((l) => l.key === ruleOf);

  return (
    <Fullscreen title={doc === null ? t('calendarData.schemeEditor.newTitle') : t('calendarData.schemeEditor.title', { name: def.name || t('calendarData.schemeEditor.noName') })} onClose={onClose}>
      <div className="wk-sch">
        <div className="wk-sch-head">
          <label className="wk-field">
            <span>{t('calendarData.schemeEditor.name')}</span>
            <input value={def.name} maxLength={120} placeholder={t('calendarData.schemeEditor.namePlaceholder')} onChange={(e) => patch({ name: e.target.value })} />
          </label>
          <label className="wk-field">
            <span>{t('calendarData.schemeEditor.kind')}</span>
            <select value={def.kind ?? 'appointment'} onChange={(e) => patch({ kind: e.target.value as ItemKind })}>
              {ITEM_KINDS.filter((k) => k !== 'task').map((k) => <option key={k} value={k}>{capital(ITEM_LABEL[k])}</option>)}
            </select>
          </label>
          <label className="wk-field">
            <span>{t('calendarData.schemeEditor.titleLabel')}</span>
            <select value={def.publicTitle === undefined ? '' : def.publicTitle ? 'yes' : 'no'}
              onChange={(e) => patch({ publicTitle: e.target.value === '' ? undefined : e.target.value === 'yes' })}>
              <option value="">{t('calendarData.schemeEditor.titleDefault')}</option>
              <option value="yes">{t('calendarData.schemeEditor.titlePublic')}</option>
              <option value="no">{t('calendarData.schemeEditor.titleSealed')}</option>
            </select>
          </label>
        </div>

        <section className="wk-sch-part" aria-label={t('calendarData.schemeEditor.fields')}>
          <h3 className="wk-h3">{t('calendarData.schemeEditor.fields')}</h3>
          <FieldsTable fields={def.fields} onChange={(fields) => patch({ fields })} levels />
        </section>

        <section className="wk-sch-part" aria-label={t('calendarData.schemeEditor.lists')}>
          <h3 className="wk-h3">{t('calendarData.schemeEditor.listsTitle')}</h3>
          {def.lists.length === 0 && <p className="wk-empty">{t('calendarData.schemeEditor.noLists')}</p>}
          {def.lists.map((list) => (
            <ListCard key={list.key} list={list} onChange={(next) => setList(list.key, next)} onRemove={() => setList(list.key, null)}
              onRule={() => setRuleOf(ruleOf === list.key ? null : list.key)} ruleOpen={ruleOf === list.key} />
          ))}
          <div className="wk-actions">
            <button type="button" className="wk-btn wk-btn-quiet" onClick={() => {
              const label = t('calendarData.schemeEditor.newList');
              const key = keyOf(label, def.lists.map((l) => l.key));
              patch({ lists: [...def.lists, { key, label, fields: [] }] });
            }}>{t('calendarData.schemeEditor.addList')}</button>
          </div>
        </section>

        {editingRule !== undefined && (
          <section className="wk-sch-part wk-sch-rule" aria-label={t('calendarData.schemeEditor.ruleAria', { label: editingRule.label })}>
            <h3 className="wk-h3">{t('calendarData.schemeEditor.ruleTitle', { label: editingRule.label })}</h3>
            <Suspense fallback={<Loading label={t('calendarData.schemeEditor.loadingEditor')} />}>
              <FlowEditor kind="rule" doc={editingRule.rule ?? starterRule()} modes={editingRule.modes} fields={editingRule.fields}
                onChange={(rule: FlowDoc) => setList(editingRule.key, { ...editingRule, rule })}
                preview={<RuleProbe list={editingRule} />} />
            </Suspense>
          </section>
        )}

        <JsonPanel
          summary={t('calendarData.schemeEditor.jsonSummary')}
          lead={t('calendarData.schemeEditor.jsonLead')}
          fileName={t('calendarData.schemeEditor.fileName', { name: keyOf(def.name || t('calendarData.schemeEditor.fileFallback')) })}
          exportDoc={() => exportScheme(def)}
          format={SCHEME_JSON}
          preview={(value) => {
            const warnings: string[] = [];
            const read = readScheme(value, warnings);
            return read === null ? { error: warnings[0] ?? t('calendarData.schemeEditor.notScheme') }
              : { lines: [t('calendarData.schemeEditor.previewLine', { name: read.name, fields: read.fields.length, lists: read.lists.length })], warnings };
          }}
          importLabel={t('calendarData.schemeEditor.importLabel')}
          onImport={async (value) => {
            const warnings: string[] = [];
            const read = readScheme(value, warnings);
            if (read === null) throw new WorkspaceError(warnings[0] ?? t('calendarData.schemeEditor.notScheme'));
            setDef(read);
            return { lines: [t('calendarData.schemeEditor.loaded')], warnings };
          }}
        />

        {failed !== null && <p className="wk-error">{failed}</p>}
        <div className="wk-actions">
          <button type="button" className="wk-btn" disabled={busy} onClick={() => void save()}>{busy ? t('common.saving') : t('calendarData.schemeEditor.save')}</button>
          <button type="button" className="wk-btn wk-btn-quiet" disabled={busy} onClick={onClose}>{t('common.cancel')}</button>
          {doc !== null && <button type="button" className="wk-link-btn wk-danger" disabled={busy} onClick={() => void remove()}>{t('calendarData.schemeEditor.delete')}</button>}
        </div>
      </div>
    </Fullscreen>
  );
}

/** Ein leerer Ablauf einer Regel: „Nowy wpis" → „Przyjmij". */
function starterRule(): FlowDoc {
  return {
    v: 1,
    nodes: [
      { id: 'start', type: 'record-start', x: 0, y: 80, data: {} },
      { id: 'ok', type: 'allow', x: 280, y: 80, data: {} }
    ],
    edges: [{ id: 'start-ok', from: 'start', to: 'ok' }]
  };
}

/* -- Felder ------------------------------------------------------------------------------------ */

export function FieldsTable({ fields, onChange, levels = false }: {
  fields: readonly SchemeField[];
  onChange: (next: readonly SchemeField[]) => void;
  /** Termin oder Tag wählbar (bei Feldern eines Eintrags nicht). */
  levels?: boolean;
}) {
  const t = useT();
  /* Ein hier neu angelegtes Feld bekommt seinen Schlüssel aus dem Namen, solange man tippt; ein gespeichertes behält seinen. */
  const fresh = useRef(new Set<string>());
  const rename = (i: number, f: SchemeField, label: string) => {
    if (!fresh.current.has(f.key)) { set(i, { ...f, label }); return; }
    const key = keyOf(label || 'pole', fields.filter((_, j) => j !== i).map((x) => x.key));
    fresh.current.delete(f.key);
    fresh.current.add(key);
    set(i, { ...f, label, key });
  };
  const set = (i: number, next: SchemeField | null) =>
    onChange(next === null ? fields.filter((_, j) => j !== i) : fields.map((f, j) => (j === i ? next : f)));
  const move = (i: number, step: -1 | 1) => {
    const j = i + step;
    if (j < 0 || j >= fields.length) return;
    const next = [...fields];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="wk-sch-fields">
      {fields.length === 0 && <p className="wk-empty">{t('calendarData.schemeEditor.noFields')}</p>}
      {fields.map((f, i) => (
        <div key={i} className="wk-sch-field">
          <label className="wk-field">
            <span>{t('calendarData.schemeEditor.name')}</span>
            <input value={f.label} maxLength={120} onChange={(e) => rename(i, f, e.target.value)} />
          </label>
          <label className="wk-field">
            <span>{t('calendarData.schemeEditor.fieldKind')}</span>
            <select value={f.type} onChange={(e) => {
              const type = e.target.value as SchemeFieldType;
              set(i, { ...f, type, ...(type === 'colour' && f.options === undefined ? { options: LITURGICAL_COLOURS } : {}) });
            }}>
              {SCHEME_FIELD_TYPES.map((type) => <option key={type} value={type}>{SCHEME_FIELD_LABEL[type]}</option>)}
            </select>
          </label>
          {levels && (
            <label className="wk-field">
              <span>{t('calendarData.schemeEditor.level')}</span>
              <select value={f.level ?? 'item'} onChange={(e) => set(i, { ...f, level: e.target.value === 'day' ? 'day' : undefined })}>
                <option value="item">{t('calendarData.schemeEditor.levelItem')}</option>
                <option value="day">{t('calendarData.schemeEditor.levelDay')}</option>
              </select>
            </label>
          )}
          <span className="wk-sch-checks">
            <label className="wk-check"><input type="checkbox" checked={f.public === true} onChange={(e) => set(i, { ...f, public: e.target.checked || undefined })} /><span>{t('calendarData.schemeEditor.public')}</span></label>
            <label className="wk-check"><input type="checkbox" checked={f.required === true} onChange={(e) => set(i, { ...f, required: e.target.checked || undefined })} /><span>{t('calendarData.schemeEditor.required')}</span></label>
          </span>
          {(f.type === 'choice' || f.type === 'colour') && (
            <label className="wk-field wk-sch-wide">
              <span>{t('calendarData.schemeEditor.options')}</span>
              <textarea rows={3} value={choicesText(f.options)} onChange={(e) => set(i, { ...f, options: choicesOf(e.target.value) })} />
            </label>
          )}
          {f.type === 'number' && (
            <label className="wk-field">
              <span>{t('calendarData.schemeEditor.unit')}</span>
              <input value={f.unit ?? ''} maxLength={20} placeholder={t('calendarData.schemeEditor.unitPlaceholder')} onChange={(e) => set(i, { ...f, unit: e.target.value || undefined })} />
            </label>
          )}
          <span className="wk-sch-acts">
            <span className="wk-sch-key" title={t('calendarData.schemeEditor.keyHint')}>{f.key}</span>
            <button type="button" className="wk-link-btn" aria-label={t('calendarData.schemeEditor.up')} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
            <button type="button" className="wk-link-btn" aria-label={t('calendarData.schemeEditor.down')} disabled={i === fields.length - 1} onClick={() => move(i, 1)}>↓</button>
            <button type="button" className="wk-link-btn wk-danger" onClick={() => set(i, null)}>{t('common.delete')}</button>
          </span>
        </div>
      ))}
      <div className="wk-actions">
        <button type="button" className="wk-btn wk-btn-quiet wk-btn-small" onClick={() => {
          const label = t('calendarData.schemeEditor.newField');
          const key = keyOf(label, fields.map((f) => f.key));
          fresh.current.add(key);
          onChange([...fields, { key, label, type: 'text' }]);
        }}>{t('calendarData.schemeEditor.addField')}</button>
      </div>
    </div>
  );
}

/* -- Eine Liste von Einträgen ----------------------------------------------------------------- */

function ListCard({ list, onChange, onRemove, onRule, ruleOpen }: {
  list: RecordList;
  onChange: (next: RecordList) => void;
  onRemove: () => void;
  onRule: () => void;
  ruleOpen: boolean;
}) {
  const t = useT();
  return (
    <div className="wk-sch-list">
      <div className="wk-sch-head">
        <label className="wk-field">
          <span>{t('calendarData.schemeEditor.listName')}</span>
          <input value={list.label} maxLength={120} onChange={(e) => onChange({ ...list, label: e.target.value })} />
        </label>
        <label className="wk-field">
          <span>{t('calendarData.schemeEditor.itemLabel')}</span>
          <input value={list.itemLabel ?? ''} maxLength={60} placeholder={t('calendarData.schemeEditor.itemPlaceholder')} onChange={(e) => onChange({ ...list, itemLabel: e.target.value || undefined })} />
        </label>
        <label className="wk-field">
          <span>{t('calendarData.schemeEditor.textLabel')}</span>
          <input value={list.textLabel ?? ''} maxLength={120} placeholder={t('calendarData.schemeEditor.textPlaceholder')}
            onChange={(e) => onChange({ ...list, textLabel: e.target.value || undefined })} />
        </label>
        <label className="wk-field">
          <span>{t('calendarData.schemeEditor.person')}</span>
          <input value={list.person ?? ''} maxLength={120} placeholder={t('calendarData.schemeEditor.personPlaceholder')}
            onChange={(e) => onChange({ ...list, person: e.target.value || undefined })} />
        </label>
        <label className="wk-field">
          <span>{t('calendarData.schemeEditor.modes')}</span>
          <textarea rows={2} value={choicesText(list.modes)} onChange={(e) => {
            const modes = choicesOf(e.target.value);
            onChange({ ...list, modes: modes.length === 0 ? undefined : modes });
          }} />
        </label>
        <label className="wk-check">
          <input type="checkbox" checked={list.outside === true} onChange={(e) => onChange({ ...list, outside: e.target.checked || undefined })} />
          <span>{t('calendarData.schemeEditor.outside')}</span>
        </label>
      </div>
      <h4 className="wk-sch-sub">{t('calendarData.schemeEditor.entryFields')}</h4>
      <FieldsTable fields={list.fields} onChange={(fields) => onChange({ ...list, fields })} />
      <div className="wk-actions">
        <button type="button" className="wk-btn wk-btn-quiet wk-btn-small" aria-expanded={ruleOpen} onClick={onRule}>
          {ruleOpen ? t('calendarData.schemeEditor.closeRule') : list.rule ? t('calendarData.schemeEditor.ruleNodes', { count: list.rule.nodes.length }) : t('calendarData.schemeEditor.addRule')}
        </button>
        <span className="wk-sch-key">{list.key}</span>
        <button type="button" className="wk-link-btn wk-danger" onClick={onRemove}>{t('calendarData.schemeEditor.deleteList')}</button>
      </div>
    </div>
  );
}

/* -- Eine Probe der Regel ---------------------------------------------------------------------- */

function RuleProbe({ list }: { list: RecordList }) {
  const t = useT();
  const modes = list.modes ?? [];
  const [actor, setActor] = useState<'office' | 'outside'>('office');
  const [mode, setMode] = useState(modes[0]?.value ?? '');
  const [here, setHere] = useState<Record<string, number>>({});
  const [weekOthers, setWeekOthers] = useState(0);

  const occurrence = modes.flatMap((m) => Array.from({ length: here[m.value] ?? 0 }, () => ({ mode: m.value, status: 'accepted' })));
  const week = [
    ...occurrence.map((r) => ({ ...r, occurrence: 'here' })),
    ...Array.from({ length: weekOthers }, (_, i) => ({ mode, status: 'accepted', occurrence: `other-${i}` }))
  ];
  const ctx: RuleCtx = { actor, date: '2026-11-04', weekday: 3, record: { mode: mode || undefined, values: {} }, occurrence, week, here: 'here' };
  const result = runRule(list.rule ?? EMPTY_FLOW, ctx);

  return (
    <div className="wk-sch-probe" aria-label={t('calendarData.schemeEditor.probeAria')}>
      <h4 className="wk-sch-sub">{t('calendarData.schemeEditor.probe')}</h4>
      <div className="wk-sch-head">
        <label className="wk-field">
          <span>{t('calendarData.schemeEditor.actor')}</span>
          <select value={actor} onChange={(e) => setActor(e.target.value as 'office' | 'outside')}>
            <option value="office">{t('calendarData.schemeEditor.actorOffice')}</option>
            <option value="outside">{t('calendarData.schemeEditor.actorOutside')}</option>
          </select>
        </label>
        {modes.length > 0 && (
          <label className="wk-field">
            <span>{t('calendarData.schemeEditor.newEntry')}</span>
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              {modes.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>
        )}
        {modes.map((m) => (
          <label key={m.value} className="wk-field">
            <span>{t('calendarData.schemeEditor.already', { mode: m.label })}</span>
            <input type="number" min={0} max={20} value={here[m.value] ?? 0} onChange={(e) => setHere((was) => ({ ...was, [m.value]: Math.max(0, Number(e.target.value) || 0) }))} />
          </label>
        ))}
        <label className="wk-field">
          <span>{t('calendarData.schemeEditor.weekOthers')}</span>
          <input type="number" min={0} max={20} value={weekOthers} onChange={(e) => setWeekOthers(Math.max(0, Number(e.target.value) || 0))} />
        </label>
      </div>
      <p className={`wk-sch-verdict is-${result.verdict}`}>
        {result.verdict === 'allow' ? t('calendarData.schemeEditor.allow') : result.verdict === 'wait' ? t('calendarData.schemeEditor.wait') : t('calendarData.schemeEditor.refuse')}
        {result.message ? ` — ${result.message}` : ''}
      </p>
      {result.trace.length > 0 && <p className="wk-sch-trace">{result.trace.join(' → ')}</p>}
    </div>
  );
}
