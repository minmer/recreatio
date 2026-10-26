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
  (options ?? []).map((o) => (o.value === o.label ? o.label : `${o.value}: ${o.label}`)).join('\n');
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
  const [def, setDef] = useState<SchemeDef>(doc?.def ?? start ?? { name: '', fields: [], lists: [] });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [ruleOf, setRuleOf] = useState<string | null>(null);

  const patch = (next: Partial<SchemeDef>) => setDef((was) => ({ ...was, ...next }));
  const setList = (key: string, next: RecordList | null) =>
    patch({ lists: next === null ? def.lists.filter((l) => l.key !== key) : def.lists.map((l) => (l.key === key ? next : l)) });

  const save = async () => {
    if (def.name.trim() === '') { setFailed('Schemat potrzebuje nazwy.'); return; }
    setBusy(true);
    setFailed(null);
    try {
      await saveDoc(me.ring, calendar, 'scheme', { ...def, name: def.name.trim() }, doc?.docId, doc?.version);
      forgetDocs(calendar.calendarId);
      onSaved();
      onClose();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać schematu.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (doc === null || !(await askText('Usunąć ten schemat? Jego terminy dostaną schemat uniwersalny; wartości pól zostają w nich zapisane, ale nie będą pokazywane.'))) return;
    setBusy(true);
    try {
      await deleteDoc(doc.docId);
      forgetDocs(calendar.calendarId);
      onSaved();
      onClose();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się usunąć schematu.');
      setBusy(false);
    }
  };

  const editingRule = ruleOf === null ? undefined : def.lists.find((l) => l.key === ruleOf);

  return (
    <Fullscreen title={doc === null ? 'Nowy schemat' : `Schemat: ${def.name || 'bez nazwy'}`} onClose={onClose}>
      <div className="wk-sch">
        <div className="wk-sch-head">
          <label className="wk-field">
            <span>Nazwa</span>
            <input value={def.name} maxLength={120} placeholder="np. Msza" onChange={(e) => patch({ name: e.target.value })} />
          </label>
          <label className="wk-field">
            <span>Rodzaj terminów</span>
            <select value={def.kind ?? 'appointment'} onChange={(e) => patch({ kind: e.target.value as ItemKind })}>
              {ITEM_KINDS.filter((k) => k !== 'task').map((k) => <option key={k} value={k}>{capital(ITEM_LABEL[k])}</option>)}
            </select>
          </label>
          <label className="wk-field">
            <span>Tytuł</span>
            <select value={def.publicTitle === undefined ? '' : def.publicTitle ? 'yes' : 'no'}
              onChange={(e) => patch({ publicTitle: e.target.value === '' ? undefined : e.target.value === 'yes' })}>
              <option value="">jak dotąd (jawny przy mszy, spowiedzi, nabożeństwie)</option>
              <option value="yes">jawny (plan, gablota)</option>
              <option value="no">zaszyfrowany</option>
            </select>
          </label>
        </div>

        <section className="wk-sch-part" aria-label="Pola terminu">
          <h3 className="wk-h3">Pola terminu</h3>
          <FieldsTable fields={def.fields} onChange={(fields) => patch({ fields })} levels />
        </section>

        <section className="wk-sch-part" aria-label="Listy wpisów">
          <h3 className="wk-h3">Listy wpisów przy terminie</h3>
          {def.lists.length === 0 && <p className="wk-empty">Bez list — np. intencji albo zapisów.</p>}
          {def.lists.map((list) => (
            <ListCard key={list.key} list={list} onChange={(next) => setList(list.key, next)} onRemove={() => setList(list.key, null)}
              onRule={() => setRuleOf(ruleOf === list.key ? null : list.key)} ruleOpen={ruleOf === list.key} />
          ))}
          <div className="wk-actions">
            <button type="button" className="wk-btn wk-btn-quiet" onClick={() => {
              const key = keyOf('Wpisy', def.lists.map((l) => l.key));
              patch({ lists: [...def.lists, { key, label: 'Wpisy', fields: [] }] });
            }}>+ Lista wpisów</button>
          </div>
        </section>

        {editingRule !== undefined && (
          <section className="wk-sch-part wk-sch-rule" aria-label={`Reguła: ${editingRule.label}`}>
            <h3 className="wk-h3">Reguła listy „{editingRule.label}”</h3>
            <Suspense fallback={<Loading label="Wczytywanie edytora…" />}>
              <FlowEditor kind="rule" doc={editingRule.rule ?? starterRule()} modes={editingRule.modes} fields={editingRule.fields}
                onChange={(rule: FlowDoc) => setList(editingRule.key, { ...editingRule, rule })}
                preview={<RuleProbe list={editingRule} />} />
            </Suspense>
          </section>
        )}

        <JsonPanel
          summary="JSON schematu — eksport i import"
          lead="Ten schemat jako JSON. Import zastępuje to, co jest w edytorze (zapisz potem przyciskiem „Zapisz schemat”)."
          fileName={`schemat-${keyOf(def.name || 'schemat')}.json`}
          exportDoc={() => exportScheme(def)}
          format={SCHEME_JSON}
          preview={(value) => {
            const warnings: string[] = [];
            const read = readScheme(value, warnings);
            return read === null ? { error: warnings[0] ?? 'To nie jest schemat.' }
              : { lines: [`Schemat „${read.name}”: pól ${read.fields.length}, list ${read.lists.length}.`], warnings };
          }}
          importLabel="Wczytaj do edytora"
          onImport={async (value) => {
            const warnings: string[] = [];
            const read = readScheme(value, warnings);
            if (read === null) throw new WorkspaceError(warnings[0] ?? 'To nie jest schemat.');
            setDef(read);
            return { lines: ['Wczytano do edytora — zapisz, aby zachować.'], warnings };
          }}
        />

        {failed !== null && <p className="wk-error">{failed}</p>}
        <div className="wk-actions">
          <button type="button" className="wk-btn" disabled={busy} onClick={() => void save()}>{busy ? 'Zapisywanie…' : 'Zapisz schemat'}</button>
          <button type="button" className="wk-btn wk-btn-quiet" disabled={busy} onClick={onClose}>Anuluj</button>
          {doc !== null && <button type="button" className="wk-link-btn wk-danger" disabled={busy} onClick={() => void remove()}>Usuń schemat</button>}
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
      {fields.length === 0 && <p className="wk-empty">Bez pól.</p>}
      {fields.map((f, i) => (
        <div key={i} className="wk-sch-field">
          <label className="wk-field">
            <span>Nazwa</span>
            <input value={f.label} maxLength={120} onChange={(e) => rename(i, f, e.target.value)} />
          </label>
          <label className="wk-field">
            <span>Rodzaj</span>
            <select value={f.type} onChange={(e) => {
              const type = e.target.value as SchemeFieldType;
              set(i, { ...f, type, ...(type === 'colour' && f.options === undefined ? { options: LITURGICAL_COLOURS } : {}) });
            }}>
              {SCHEME_FIELD_TYPES.map((t) => <option key={t} value={t}>{SCHEME_FIELD_LABEL[t]}</option>)}
            </select>
          </label>
          {levels && (
            <label className="wk-field">
              <span>Dotyczy</span>
              <select value={f.level ?? 'item'} onChange={(e) => set(i, { ...f, level: e.target.value === 'day' ? 'day' : undefined })}>
                <option value="item">całego terminu</option>
                <option value="day">jednego dnia serii</option>
              </select>
            </label>
          )}
          <span className="wk-sch-checks">
            <label className="wk-check"><input type="checkbox" checked={f.public === true} onChange={(e) => set(i, { ...f, public: e.target.checked || undefined })} /><span>jawne</span></label>
            <label className="wk-check"><input type="checkbox" checked={f.required === true} onChange={(e) => set(i, { ...f, required: e.target.checked || undefined })} /><span>wymagane</span></label>
          </span>
          {(f.type === 'choice' || f.type === 'colour') && (
            <label className="wk-field wk-sch-wide">
              <span>Do wyboru (jedno w wierszu; „wartość: nazwa” albo sama nazwa)</span>
              <textarea rows={3} value={choicesText(f.options)} onChange={(e) => set(i, { ...f, options: choicesOf(e.target.value) })} />
            </label>
          )}
          {f.type === 'number' && (
            <label className="wk-field">
              <span>Jednostka</span>
              <input value={f.unit ?? ''} maxLength={20} placeholder="np. osób" onChange={(e) => set(i, { ...f, unit: e.target.value || undefined })} />
            </label>
          )}
          <span className="wk-sch-acts">
            <span className="wk-sch-key" title="Klucz wartości — zostaje przy zmianie nazwy">{f.key}</span>
            <button type="button" className="wk-link-btn" aria-label="Wyżej" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
            <button type="button" className="wk-link-btn" aria-label="Niżej" disabled={i === fields.length - 1} onClick={() => move(i, 1)}>↓</button>
            <button type="button" className="wk-link-btn wk-danger" onClick={() => set(i, null)}>Usuń</button>
          </span>
        </div>
      ))}
      <div className="wk-actions">
        <button type="button" className="wk-btn wk-btn-quiet wk-btn-small" onClick={() => {
          const key = keyOf('Pole', fields.map((f) => f.key));
          fresh.current.add(key);
          onChange([...fields, { key, label: 'Pole', type: 'text' }]);
        }}>+ Pole</button>
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
  return (
    <div className="wk-sch-list">
      <div className="wk-sch-head">
        <label className="wk-field">
          <span>Nazwa listy</span>
          <input value={list.label} maxLength={120} onChange={(e) => onChange({ ...list, label: e.target.value })} />
        </label>
        <label className="wk-field">
          <span>Jeden wpis to</span>
          <input value={list.itemLabel ?? ''} maxLength={60} placeholder="np. intencja" onChange={(e) => onChange({ ...list, itemLabel: e.target.value || undefined })} />
        </label>
        <label className="wk-field">
          <span>Jawny tekst wpisu</span>
          <input value={list.textLabel ?? ''} maxLength={120} placeholder="np. Treść intencji (puste: bez tekstu)"
            onChange={(e) => onChange({ ...list, textLabel: e.target.value || undefined })} />
        </label>
        <label className="wk-field">
          <span>Przypięta osoba</span>
          <input value={list.person ?? ''} maxLength={120} placeholder="np. Kto odprawia (puste: bez osoby)"
            onChange={(e) => onChange({ ...list, person: e.target.value || undefined })} />
        </label>
        <label className="wk-field">
          <span>Rodzaje wpisu (jeden w wierszu)</span>
          <textarea rows={2} value={choicesText(list.modes)} onChange={(e) => {
            const modes = choicesOf(e.target.value);
            onChange({ ...list, modes: modes.length === 0 ? undefined : modes });
          }} />
        </label>
        <label className="wk-check">
          <input type="checkbox" checked={list.outside === true} onChange={(e) => onChange({ ...list, outside: e.target.checked || undefined })} />
          <span>Wpisują też osoby spoza prowadzących (wpis czeka na kancelarię)</span>
        </label>
      </div>
      <h4 className="wk-sch-sub">Pola wpisu</h4>
      <FieldsTable fields={list.fields} onChange={(fields) => onChange({ ...list, fields })} />
      <div className="wk-actions">
        <button type="button" className="wk-btn wk-btn-quiet wk-btn-small" aria-expanded={ruleOpen} onClick={onRule}>
          {ruleOpen ? 'Zamknij regułę' : list.rule ? `Reguła (${list.rule.nodes.length} węzłów)` : 'Dodaj regułę'}
        </button>
        <span className="wk-sch-key">{list.key}</span>
        <button type="button" className="wk-link-btn wk-danger" onClick={onRemove}>Usuń listę</button>
      </div>
    </div>
  );
}

/* -- Eine Probe der Regel ---------------------------------------------------------------------- */

function RuleProbe({ list }: { list: RecordList }) {
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
    <div className="wk-sch-probe" aria-label="Próba reguły">
      <h4 className="wk-sch-sub">Próba</h4>
      <div className="wk-sch-head">
        <label className="wk-field">
          <span>Kto dodaje</span>
          <select value={actor} onChange={(e) => setActor(e.target.value as 'office' | 'outside')}>
            <option value="office">kancelaria</option>
            <option value="outside">ktoś z zewnątrz</option>
          </select>
        </label>
        {modes.length > 0 && (
          <label className="wk-field">
            <span>Nowy wpis</span>
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              {modes.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>
        )}
        {modes.map((m) => (
          <label key={m.value} className="wk-field">
            <span>Już przy terminie: {m.label}</span>
            <input type="number" min={0} max={20} value={here[m.value] ?? 0} onChange={(e) => setHere((was) => ({ ...was, [m.value]: Math.max(0, Number(e.target.value) || 0) }))} />
          </label>
        ))}
        <label className="wk-field">
          <span>Inne terminy tygodnia z tym rodzajem</span>
          <input type="number" min={0} max={20} value={weekOthers} onChange={(e) => setWeekOthers(Math.max(0, Number(e.target.value) || 0))} />
        </label>
      </div>
      <p className={`wk-sch-verdict is-${result.verdict}`}>
        {result.verdict === 'allow' ? 'Przyjęty' : result.verdict === 'wait' ? 'Czeka na kancelarię' : 'Odmowa'}
        {result.message ? ` — ${result.message}` : ''}
      </p>
      {result.trace.length > 0 && <p className="wk-sch-trace">{result.trace.join(' → ')}</p>}
    </div>
  );
}
