/**
 * COGITA — EINEN FORMULARZ DODAWANIA AUSFÜLLEN (COGITA.md §2.4), 2026-10-17.
 *
 * Oben steht, was für alle Zeilen gilt (die Sprachen, das Thema) — einmal
 * gewählt, und beim nächsten Mal wieder da. Darunter die Zeile: Enter geht
 * weiter, im letzten Feld wird gespeichert, und die nächste Zeile steht schon
 * bereit, während die vorige im Hintergrund gespeichert wird. Was die Tasten
 * tun, sagt das Formular (`keys`). Daneben: eine ganze Liste einfügen.
 *
 * Gespeichert wird der Reihe nach (`pump`): jede Zeile wird erst geplant,
 * wenn die vorige gespeichert ist — so findet „zamek" in der dritten Zeile das
 * „zamek" der ersten, statt ein zweites anzulegen.
 */

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';

import { newId } from '../core/ids';
import { askText, toast } from '../ui/dialogs';
import {
  COLUMN_SEPARATOR_LABEL, COLUMN_SEPARATORS, defaultTyped, describeForm, groupsOf, isLong, KEY_ACTION_SHORT, KEY_NAMES, nodeLabel, parsePaste,
  planForm, readAddForm, rowIsEmpty, topOf, VALUE_SEPARATORS,
  type AddForm, type FormGroup, type FormPlan, type Instance, type KeyAction, type PasteRule, type PlanCtx, type RowInput, type TopChoice, type TopItem
} from './addForm';
import type { FieldDef } from './schema';
import type { CogitaLibrary } from './store';
import { EntityPicker, entityName, useCtx } from './ui';

/* -- Gemeinsam mit dem Editor ---------------------------------------------------------------- */

/** Ein Wert als Text, wie man ihn tippt — eine Auswahl, wo das Feld eine hat. */
export function ValueInput({ field, value, onChange, disabled = false, placeholder, label }: {
  field: FieldDef;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  label?: string;
}) {
  if (field.type === 'choice') {
    return (
      <select value={value} disabled={disabled} aria-label={label} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {(field.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }
  if (field.type === 'bool') {
    return (
      <select value={value} disabled={disabled} aria-label={label} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option><option value="tak">tak</option><option value="nie">nie</option><option value="nie wiadomo">nie wiadomo</option>
      </select>
    );
  }
  return <input value={value} disabled={disabled} placeholder={placeholder} aria-label={label} onChange={(e) => onChange(e.target.value)} />;
}

export const planCtx = (lib: CogitaLibrary): PlanCtx => ({
  look: lib.look,
  pool: (kind) => lib.ofKind(kind),
  isOwn: (id) => lib.isOwn(id),
  newId
});

/* -- Ausfüllen ---------------------------------------------------------------------------------- */

export function AddFormRun({ formId, onClose, onOpen, onEdit }: {
  formId: string | null;
  onClose: () => void;
  onOpen: (id: string) => void;
  onEdit: (id: string) => void;
}) {
  const { lib, writes } = useCtx();
  const entry = formId === null ? undefined : lib.docs('addform').find((e) => e.id === formId);
  if (entry === undefined) {
    return (
      <div className="cg">
        <button type="button" className="wk-link-btn" onClick={onClose}>← Wpisy</button>
        <p className="wk-empty">Nie ma takiego formularza.</p>
      </div>
    );
  }
  if (!writes) return <p className="wk-empty">W tej bazie wiedzy możesz tylko czytać.</p>;
  return <Runner key={entry.id} entryId={entry.id} version={entry.version} data={entry.data} onClose={onClose} onOpen={onOpen} onEdit={onEdit} />;
}

interface LogItem {
  readonly n: number;
  readonly at: Date;
  readonly text: string;
  readonly rows: readonly RowInput[];
  readonly top: TopChoice;
  status: 'waiting' | 'saving' | 'done' | 'failed' | 'undone';
  done: number;
  total: number;
  created: string[];
  changed: string[];
  reused: string[];
  skipped: string[];
  problems: string[];
  error?: string;
  kept?: number;
}

type Spot = { readonly node: string; readonly i: number; readonly field: string };
const spotKey = (s: Spot) => `${s.node}|${s.i}|${s.field}`;

const blankRow = (groups: readonly FormGroup[]): Record<string, Instance[]> => Object.fromEntries(groups.map((g) => [g.node, [{}]]));

const rowText = (row: RowInput, groups: readonly FormGroup[]): string =>
  groups.map((g) => (row[g.node] ?? []).map((inst) => g.fields.map((f) => (inst[f.key] ?? '').trim()).filter(Boolean).join(' ')).filter(Boolean).join(', '))
    .filter(Boolean).join(' · ');

function readTop(key: string): TopChoice | null {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? 'null') as unknown;
    if (typeof raw !== 'object' || raw === null) return null;
    const { picks, asks } = raw as { picks?: unknown; asks?: unknown };
    const clean = (o: unknown, each: (v: unknown) => boolean) => (typeof o === 'object' && o !== null ? Object.fromEntries(Object.entries(o).filter(([, v]) => each(v))) : {});
    return {
      picks: clean(picks, (v) => Array.isArray(v) && v.every((x) => typeof x === 'string')) as Record<string, string[]>,
      asks: clean(asks, (v) => typeof v === 'string') as Record<string, string>
    };
  } catch {
    return null;
  }
}

function Runner({ entryId, version, data, onClose, onOpen, onEdit }: {
  entryId: string;
  version: number;
  data: Readonly<Record<string, unknown>>;
  onClose: () => void;
  onOpen: (id: string) => void;
  onEdit: (id: string) => void;
}) {
  const { lib } = useCtx();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const form = useMemo(() => readAddForm(entryId, data), [entryId, version]);
  const look = lib.look;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const groups = useMemo(() => groupsOf(form, look), [form, lib.revision]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const top = useMemo(() => topOf(form, look), [form, lib.revision]);
  const storeKey = `cg-addform:${lib.libraryId}:${form.id}`;
  const [choice, setChoice] = useState<TopChoice>(() => readTop(storeKey) ?? { picks: {}, asks: {} });
  useEffect(() => { try { localStorage.setItem(storeKey, JSON.stringify(choice)); } catch { /* nur jetzt */ } }, [storeKey, choice]);
  const [row, setRow] = useState<Record<string, Instance[]>>(() => blankRow(groups));
  const [said, setSaid] = useState<string | null>(null);

  /* Die Liste dessen, was hinzugefügt wurde — veränderlich, damit das Speichern weiterläuft, auch wenn man die Ansicht verlässt. */
  const log = useRef<LogItem[]>([]);
  const seq = useRef(0);
  const [, setTick] = useState(0);
  const bump = useCallback(() => setTick((n) => n + 1), []);
  const formRef = useRef(form);
  formRef.current = form;
  const running = useRef(false);

  const topProblems = useMemo(() => planForm(form, planCtx(lib), [], choice).problems,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form, choice, lib.revision]);

  const pump = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      for (;;) {
        const item = [...log.current].reverse().find((x) => x.status === 'waiting');
        if (item === undefined) break;
        item.status = 'saving';
        item.error = undefined;
        bump();
        try {
          const plan = planForm(formRef.current, planCtx(lib), item.rows, item.top);
          if (plan.problems.length > 0) throw new Error(plan.problems.join(' '));
          const problems = plan.rows.flatMap((r, i) => r.problems.map((p) => (item.rows.length > 1 ? `Wiersz ${i + 1}: ${p}` : p)));
          if (item.rows.length === 1 && problems.length > 0) throw new Error(problems.join(' '));
          tell(item, plan, formRef.current, lib);
          item.problems = problems;
          item.done = 0;
          item.total = plan.saves.length;
          const done = await lib.saveMany(plan.saves, (n, total) => { item.done = n; item.total = total; bump(); });
          if (done.failed.length > 0) throw new Error(`Nie zapisano ${done.failed.length} z ${plan.saves.length}: ${done.failed[0].error}`);
          item.status = 'done';
        } catch (e) {
          item.status = 'failed';
          item.error = e instanceof Error && e.message !== '' ? e.message : 'Nie udało się zapisać.';
        }
        bump();
      }
    } finally {
      running.current = false;
      bump();
    }
  }, [lib, bump]);

  /* Wer die Seite schliesst, während noch gespeichert wird, wird gefragt. */
  const pending = log.current.some((x) => x.status === 'waiting' || x.status === 'saving');
  useEffect(() => {
    if (!pending) return undefined;
    const stop = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', stop);
    return () => window.removeEventListener('beforeunload', stop);
  }, [pending]);

  const queue = (rows: readonly RowInput[], text: string) => {
    log.current.unshift({ n: ++seq.current, at: new Date(), text, rows, top: choice, status: 'waiting', done: 0, total: 0, created: [], changed: [], reused: [], skipped: [], problems: [] });
    bump();
    void pump();
  };

  /* -- Die Zeile und die Tasten -- */

  const inputs = useRef(new Map<string, HTMLElement>());
  const [focusOn, setFocusOn] = useState<Spot | null>(null);
  useEffect(() => {
    if (focusOn === null) return;
    const el = inputs.current.get(spotKey(focusOn));
    if (el !== undefined) { el.focus(); if (el instanceof HTMLInputElement) el.select(); }
    setFocusOn(null);
  }, [focusOn, row]);

  const spots: Spot[] = groups.flatMap((g) => (row[g.node] ?? [{}]).flatMap((_, i) => g.fields.map((f) => ({ node: g.node, i, field: f.key }))));
  const first = spots[0] ?? null;
  /* Gleich tippen können: der Zeiger steht im ersten Feld. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (first !== null) setFocusOn(first); }, [first === null]);

  const submit = () => {
    if (rowIsEmpty(row)) { if (first !== null) setFocusOn(first); return; }
    if (topProblems.length > 0) { setSaid(topProblems.join(' ')); return; }
    setSaid(null);
    queue([row], rowText(row, groups));
    setRow(blankRow(groups));
    if (first !== null) setFocusOn({ ...first, i: 0 });
  };

  const setText = (at: Spot, text: string) => setRow((was) => {
    const list = [...(was[at.node] ?? [{}])];
    list[at.i] = { ...list[at.i], [at.field]: text };
    return { ...was, [at.node]: list };
  });

  const addInstance = (node: string, after: number) => {
    const g = groups.find((x) => x.node === node);
    if (g === undefined) return;
    setRow((was) => {
      const list = [...(was[node] ?? [{}])];
      list.splice(after + 1, 0, {});
      return { ...was, [node]: list };
    });
    setFocusOn({ node, i: after + 1, field: g.fields[0].key });
  };

  const removeInstance = (node: string, i: number) => {
    const g = groups.find((x) => x.node === node);
    setRow((was) => ({ ...was, [node]: (was[node] ?? [{}]).filter((_, j) => j !== i) }));
    if (g !== undefined) setFocusOn({ node, i: Math.max(0, i - 1), field: g.fields[0].key });
  };

  const act = (action: KeyAction, at: Spot) => {
    if (action === 'save') { submit(); return; }
    if (action === 'more' && groups.find((g) => g.node === at.node)?.many === true) { addInstance(at.node, at.i); return; }
    if (action === 'next' || action === 'more') {
      const k = spots.findIndex((s) => spotKey(s) === spotKey(at));
      const after = spots[k + 1];
      if (after === undefined) submit(); else setFocusOn(after);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLElement>, at: Spot, long: boolean) => {
    if (e.key === 'Backspace' && at.i > 0 && (e.currentTarget as HTMLInputElement).value === '' && groups.find((g) => g.node === at.node)?.fields.every((f) => ((row[at.node]?.[at.i]?.[f.key]) ?? '') === '')) {
      e.preventDefault();
      removeInstance(at.node, at.i);
      return;
    }
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    const action = e.ctrlKey || e.metaKey ? form.keys.ctrlEnter : e.shiftKey ? form.keys.shiftEnter : form.keys.enter;
    if (action === 'newline' && long) return;
    e.preventDefault();
    act(action, at);
  };

  const keyLine = KEY_NAMES.filter(([key]) => form.keys[key] !== 'none').map(([key, name]) => ({ name, what: KEY_ACTION_SHORT[form.keys[key]] }));
  const items = log.current;
  const busy = items.filter((x) => x.status === 'waiting' || x.status === 'saving').length;

  return (
    <div className="cg cg-af">
      <div className="cg-row-between">
        <div className="cg-row">
          <button type="button" className="wk-link-btn" onClick={onClose}>← Wpisy</button>
          <h2 className="wk-h2">{form.name}</h2>
        </div>
        <button type="button" className="wk-link-btn" onClick={() => onEdit(form.id)}>Zmień formularz</button>
      </div>
      {form.says !== undefined && <p className="cg-muted">{form.says}</p>}

      {top.length > 0 && (
        <section className="cg-card cg-af-top" aria-label="Na początek">
          {top.map((item) => (item.type === 'pick'
            ? <PickChoice key={item.key} item={item} chosen={choice.picks[item.node] ?? item.config.value} onChange={(ids) => setChoice((c) => ({ ...c, picks: { ...c.picks, [item.node]: ids } }))} />
            : (
              <label key={item.key} className="cg-af-top-item">
                <span className="cg-af-top-label">{item.label}</span>
                <ValueInput field={item.field} value={choice.asks[item.key] ?? item.value} onChange={(v) => setChoice((c) => ({ ...c, asks: { ...c.asks, [item.key]: v } }))} />
              </label>
            )))}
        </section>
      )}
      {topProblems.length > 0 && <p className="wk-warn">{topProblems.join(' ')}</p>}

      {groups.length === 0 ? (
        <p className="wk-empty">Ten formularz nie ma pól wpisywanych w wierszu — <button type="button" className="wk-link-btn" onClick={() => onEdit(form.id)}>uzupełnij go</button>.</p>
      ) : (
        <form className="cg" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <div className="cg-af-row">
            {groups.map((g) => (
              <fieldset key={g.node} className="cg-af-group">
                <legend>{g.label}<GroupContext form={form} node={g.node} choice={choice} /></legend>
                {(row[g.node] ?? [{}]).map((inst, i) => (
                  <div key={i} className="cg-af-inst">
                    {g.fields.map((f) => {
                      const at = { node: g.node, i, field: f.key };
                      const k = spots.findIndex((s) => spotKey(s) === spotKey(at));
                      return (
                        <RowField key={f.key} field={f} value={inst[f.key] ?? ''} label={`${g.label}: ${f.label}${i > 0 ? ` (${i + 1})` : ''}`}
                          placeholder={g.fields.length > 1 ? f.label : i > 0 ? 'kolejne' : undefined}
                          last={k === spots.length - 1 && form.keys.enter === 'next'}
                          register={(el) => { if (el === null) inputs.current.delete(spotKey(at)); else inputs.current.set(spotKey(at), el); }}
                          onChange={(v) => setText(at, v)} onKey={(e) => onKey(e, at, isLong(f))} />
                      );
                    })}
                    {i > 0 && <button type="button" className="wk-link-btn" aria-label="Usuń tę wartość" onClick={() => removeInstance(g.node, i)}>×</button>}
                  </div>
                ))}
                {g.many && <button type="button" className="wk-link-btn cg-af-more" onClick={() => addInstance(g.node, (row[g.node] ?? [{}]).length - 1)}>+ kolejne</button>}
              </fieldset>
            ))}
          </div>
          <div className="cg-row">
            <button type="submit" className="wk-btn" disabled={topProblems.length > 0}>Dodaj wiersz</button>
            <span className="cg-af-keys">{keyLine.map((k) => <span key={k.name}><kbd>{k.name}</kbd> {k.what}</span>)}</span>
          </div>
          {said !== null && <p className="wk-error">{said}</p>}
        </form>
      )}

      {groups.length > 0 && <PastePanel form={form} groups={groups} choice={choice} blocked={topProblems} onQueue={(rows) => queue(rows, `Lista: ${rows.length} ${rows.length === 1 ? 'wiersz' : 'wierszy'}`)} />}

      <details className="cg-card">
        <summary>Jak działa ten formularz</summary>
        <ul className="cg-af-desc">{describeForm(form, look).map((line, i) => <li key={i}>{line}</li>)}</ul>
      </details>

      {items.length > 0 && (
        <section className="cg-card">
          <h3>Dodane teraz ({items.filter((x) => x.status === 'done').length}){busy > 0 ? ` · zapisywanie: ${busy}` : ''}</h3>
          <ul className="cg-af-log">
            {items.slice(0, 60).map((item) => (
              <LogLine key={item.n} item={item} onOpen={onOpen}
                onRetry={() => { item.status = 'waiting'; bump(); void pump(); }}
                onUndo={async () => {
                  if (item.created.length > 10 && !(await askText(`Usunąć ${item.created.length} dodanych wpisów? Zostaną w historii wersji.`))) return;
                  await undo(lib, item).then(bump, (e: unknown) => toast(e instanceof Error ? e.message : 'Nie udało się cofnąć.', { kind: 'error' }));
                }} />
            ))}
          </ul>
          {items.length > 60 && <span className="cg-muted">… i {items.length - 60} wcześniejszych.</span>}
        </section>
      )}
    </div>
  );
}

/** Was ein Plan gebracht hat — für die Liste darunter. */
function tell(item: LogItem, plan: FormPlan, form: AddForm, lib: CogitaLibrary): void {
  item.created = plan.saves.filter((s) => s.isNew).map((s) => s.id);
  item.changed = plan.saves.filter((s) => !s.isNew).map((s) => s.id);
  const touched = new Set([...item.created, ...item.changed]);
  item.reused = [...new Set(plan.rows.flatMap((r) => r.made.map((m) => m.id)))].filter((id) => !touched.has(id));
  const label = (id: string) => { const n = form.graph.nodes.find((x) => x.id === id); return n === undefined ? '' : nodeLabel(n, lib.look); };
  item.skipped = [...new Set(plan.rows.flatMap((r) => r.skipped.map((s) => `${label(s.node)} — ${s.why}`)))];
}

/** Zurücknehmen: was diese Zeile angelegt hat — ausser, eine spätere Zeile benutzt es schon. */
async function undo(lib: CogitaLibrary, item: LogItem): Promise<void> {
  const mine = new Set(item.created);
  let kept = 0;
  for (const id of [...item.created].reverse()) {
    if (lib.entity(id) === undefined) continue;
    if (lib.backlinks(id).some((b) => !mine.has(b.from))) { kept += 1; continue; }
    await lib.remove(id);
  }
  item.status = 'undone';
  item.kept = kept;
}

function LogLine({ item, onOpen, onRetry, onUndo }: { item: LogItem; onOpen: (id: string) => void; onRetry: () => void; onUndo: () => Promise<void> }) {
  const { lib } = useCtx();
  const kindCount = (ids: readonly string[]) => {
    const by = new Map<string, number>();
    for (const id of ids) {
      const e = lib.entity(id);
      const name = e === undefined ? 'wpis' : lib.kind(e.kinds[0] ?? '')?.name ?? 'wpis';
      by.set(name, (by.get(name) ?? 0) + 1);
    }
    return [...by.entries()].map(([name, n]) => (n === 1 ? name : `${name} ×${n}`)).join(', ');
  };
  const time = item.at.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  const many = item.rows.length > 1;
  return (
    <li className={`is-${item.status}`}>
      <span className="cg-muted">{time}</span>
      <strong>{item.text || '—'}</strong>
      {item.status === 'waiting' && <span className="cg-tag">czeka</span>}
      {item.status === 'saving' && <span className="cg-tag">zapisywanie{item.total > 1 ? ` ${item.done}/${item.total}` : '…'}</span>}
      {item.status === 'failed' && (
        <>
          <span className="cg-tag is-bad">nie zapisano</span>
          <span className="cg-af-log-error">{item.error}</span>
          <button type="button" className="wk-link-btn" onClick={onRetry}>Ponów</button>
        </>
      )}
      {item.status === 'undone' && <span className="cg-tag">cofnięte{item.kept ? ` (zostało ${item.kept} — używane gdzie indziej)` : ''}</span>}
      {item.status === 'done' && (
        <>
          <span className="cg-tag is-ok">dodano</span>
          <span className="cg-muted">
            {[
              item.created.length > 0 ? `nowe: ${kindCount(item.created)}` : '',
              item.changed.length > 0 ? `uzupełnione: ${kindCount(item.changed)}` : '',
              item.reused.length > 0 ? `już były: ${kindCount(item.reused)}` : '',
              item.created.length + item.changed.length + item.reused.length === 0 ? 'nic nowego' : '',
              item.skipped.length > 0 ? `pominięte (${item.skipped.join('; ')})` : '',
              item.problems.length > 0 ? `wiersze z błędem: ${item.problems.length}` : ''
            ].filter(Boolean).join(' · ')}
          </span>
          {!many && item.created.slice(0, 6).map((id) => lib.entity(id) === undefined ? null : (
            <button key={id} type="button" className="cg-ref" onClick={() => onOpen(id)}>{entityName(lib, id)}</button>
          ))}
          {item.created.length > 0 && <button type="button" className="wk-link-btn" onClick={() => void onUndo()}>Cofnij</button>}
          {item.problems.length > 0 && (
            <details className="cg-af-problems">
              <summary>Błędy</summary>
              <ul>{item.problems.slice(0, 20).map((p, i) => <li key={i}>{p}</li>)}</ul>
            </details>
          )}
        </>
      )}
    </li>
  );
}

/** Wozu eine Spalte gehört: was oben für ihren Knoten gewählt ist („angielski · Zwierzęta"). */
function GroupContext({ form, node, choice }: { form: AddForm; node: string; choice: TopChoice }) {
  const { lib } = useCtx();
  const ids = form.graph.edges.filter((e) => e.to === node).flatMap((e) => {
    const from = form.graph.nodes.find((n) => n.id === e.from);
    if (from?.type !== 'pick') return [];
    return choice.picks[from.id] ?? (Array.isArray(from.config.value) ? from.config.value.filter((x): x is string => typeof x === 'string') : []);
  });
  if (ids.length === 0) return null;
  return <span className="cg-muted"> · {[...new Set(ids)].map((id) => entityName(lib, id)).join(' · ')}</span>;
}

function RowField({ field, value, label, placeholder, last, register, onChange, onKey }: {
  field: FieldDef;
  value: string;
  label: string;
  placeholder?: string;
  last: boolean;
  register: (el: HTMLElement | null) => void;
  onChange: (v: string) => void;
  onKey: (e: KeyboardEvent<HTMLElement>) => void;
}) {
  if (field.type === 'choice' || field.type === 'bool') {
    return (
      <select ref={register} value={value} aria-label={label} onChange={(e) => onChange(e.target.value)} onKeyDown={onKey}>
        <option value="">—</option>
        {field.type === 'choice'
          ? (field.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)
          : ['tak', 'nie', 'nie wiadomo'].map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (isLong(field)) {
    return <textarea ref={register} rows={2} value={value} aria-label={label} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} onKeyDown={onKey} />;
  }
  return (
    <input ref={register} value={value} aria-label={label} placeholder={placeholder} autoComplete="off" spellCheck={field.type === 'line' || field.type === 'text'}
      inputMode={field.type === 'number' ? 'decimal' : field.type === 'url' ? 'url' : undefined}
      enterKeyHint={last ? 'done' : 'next'}
      onChange={(e) => onChange(e.target.value)} onKeyDown={onKey} />
  );
}

/* -- Oben gewählt ------------------------------------------------------------------------------ */

function PickChoice({ item, chosen, onChange }: { item: Extract<TopItem, { type: 'pick' }>; chosen: readonly string[]; onChange: (ids: string[]) => void }) {
  const { lib } = useCtx();
  const kinds = item.config.kinds.length > 0 ? item.config.kinds : undefined;
  const shown = chosen.filter((id) => lib.entity(id) !== undefined);
  return (
    <div className="cg-af-top-item">
      <span className="cg-af-top-label">{item.label}{item.config.optional ? '' : ' *'}</span>
      {item.config.many ? (
        <span className="cg-row">
          {shown.map((id) => (
            <span key={id} className="cg-tag">{entityName(lib, id)} <button type="button" className="wk-link-btn" aria-label={`Usuń: ${entityName(lib, id)}`} onClick={() => onChange(shown.filter((x) => x !== id))}>×</button></span>
          ))}
          <EntityPicker lib={lib} kinds={kinds} refs value={null} placeholder="dodaj…" onPick={(id) => id !== null && onChange([...shown.filter((x) => x !== id), id])} />
        </span>
      ) : (
        <EntityPicker lib={lib} kinds={kinds} refs value={shown[0] ?? null} allowClear={item.config.optional} placeholder={`Szukaj: ${item.label}`} onPick={(id) => onChange(id === null ? [] : [id])} />
      )}
      <NewEntry kinds={item.config.kinds} onMade={(id) => onChange(item.config.many ? [...shown, id] : [id])} />
    </div>
  );
}

/** Einen fehlenden Eintrag gleich hier anlegen („Kuchnia" als neues Thema) — mit dem Feld seines Etiketts. */
function NewEntry({ kinds, onMade }: { kinds: readonly string[]; onMade: (id: string) => void }) {
  const { lib } = useCtx();
  const kind = kinds.length === 1 ? lib.kinds.find((k) => k.id === kinds[0]) : undefined;
  const field = kind === undefined ? undefined : defaultTyped(kind).find((f) => f.type === 'line' || f.type === 'text');
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (kind === undefined || field === undefined) return null;
  if (text === null) return <button type="button" className="wk-link-btn cg-af-new" onClick={() => setText('')}>+ nowy: {kind.name}</button>;
  const make = async () => {
    if (text.trim() === '') return;
    setBusy(true);
    try {
      const saved = await lib.saveEntity({ kinds: [kind.id], data: { [field.key]: text.trim() } });
      onMade(saved.id);
      setText(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się dodać.', { kind: 'error' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="cg-row">
      <input value={text} autoFocus aria-label={`Nowy: ${kind.name} — ${field.label}`} placeholder={field.label} disabled={busy}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void make(); } if (e.key === 'Escape') setText(null); }} />
      <button type="button" className="wk-btn" disabled={busy || text.trim() === ''} onClick={() => void make()}>Dodaj</button>
      <button type="button" className="wk-link-btn" onClick={() => setText(null)}>anuluj</button>
    </span>
  );
}

/* -- Eine Liste einfügen ------------------------------------------------------------------------ */

function PastePanel({ form, groups, choice, blocked, onQueue }: {
  form: AddForm;
  groups: readonly FormGroup[];
  choice: TopChoice;
  blocked: readonly string[];
  onQueue: (rows: readonly RowInput[]) => void;
}) {
  const { lib } = useCtx();
  const [text, setText] = useState('');
  const [rule, setRule] = useState<PasteRule>(form.paste);
  const typed = useDeferredValue(text);
  const parsed = useMemo(() => parsePaste(typed, groups, rule), [typed, groups, rule]);
  const plan = useMemo(() => (parsed.rows.length === 0 || blocked.length > 0 ? null : planForm(form, planCtx(lib), parsed.rows, choice)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parsed, form, choice, blocked.length, lib.revision]);
  const columns = groups.flatMap((g) => g.fields.map((f) => ({ g, f, label: g.fields.length > 1 ? `${g.label}: ${f.label}` : g.label })));
  const bad = plan === null ? [] : plan.rows.flatMap((r, i) => r.problems.map((p) => `Wiersz ${i + 1}: ${p}`));
  const fresh = plan === null ? [] : plan.saves.filter((s) => s.isNew);
  const byKind = new Map<string, number>();
  for (const s of fresh) { const name = lib.kind(s.kinds[0] ?? '')?.name ?? 'wpis'; byKind.set(name, (byKind.get(name) ?? 0) + 1); }
  const changed = plan === null ? 0 : plan.saves.filter((s) => !s.isNew).length;
  const separator = parsed.separator === '\t' ? 'tabulator' : parsed.separator === '' ? '' : `„${parsed.separator.trim()}"`;

  return (
    <details className="cg-card">
      <summary>Wklej listę</summary>
      <div className="cg">
        <span className="cg-muted">Jedna linia — jeden wiersz; kolumny w kolejności: {columns.map((c) => c.label).join(' | ')}. Można wkleić prosto z arkusza.</span>
        <textarea className="cg-af-paste" rows={8} value={text} placeholder={columns.length > 1 ? `np.\ncar, automobile\tsamochód\ndog\tpies` : 'jedna wartość w linii'} onChange={(e) => setText(e.target.value)} aria-label="Lista do wklejenia" />
        <div className="cg-row">
          {columns.length > 1 && (
            <label className="wk-field"><span>Kolumny oddziela</span>
              <select value={rule.columns} onChange={(e) => setRule({ ...rule, columns: e.target.value as PasteRule['columns'] })}>
                {COLUMN_SEPARATORS.map((s) => <option key={s} value={s}>{COLUMN_SEPARATOR_LABEL[s]}</option>)}
              </select>
            </label>
          )}
          {groups.some((g) => g.many) && (
            <label className="wk-field"><span>Kilka wartości w komórce oddziela</span>
              <select value={rule.values} onChange={(e) => setRule({ ...rule, values: e.target.value as PasteRule['values'] })}>
                {VALUE_SEPARATORS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          )}
          <label className="pe-check"><input type="checkbox" checked={rule.header} onChange={(e) => setRule({ ...rule, header: e.target.checked })} /><span>pierwsza linia to nagłówki</span></label>
        </div>
        {parsed.rows.length > 0 && (
          <>
            <div className="cg-table-wrap">
              <table className="cg-table">
                <thead><tr><th>#</th>{columns.map((c) => <th key={`${c.g.node}.${c.f.key}`}>{c.label}</th>)}</tr></thead>
                <tbody>
                  {parsed.rows.slice(0, 12).map((r, i) => (
                    <tr key={i} className={plan?.rows[i]?.problems.length ? 'is-bad' : undefined}>
                      <td className="cg-muted">{i + 1}</td>
                      {columns.map((c) => <td key={`${c.g.node}.${c.f.key}`}>{(r[c.g.node] ?? []).map((inst) => inst[c.f.key] ?? '').filter(Boolean).join(', ')}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <span className="cg-muted">
              {parsed.rows.length} {parsed.rows.length === 1 ? 'wiersz' : 'wierszy'}{separator === '' ? '' : ` · kolumny rozdzielone: ${separator}`}
              {parsed.wide > 0 ? ` · w ${parsed.wide} liniach więcej kolumn — reszta trafiła do ostatniej` : ''}
            </span>
            {plan !== null && (
              <p className="wk-note">
                Powstanie: {fresh.length === 0 ? 'nic nowego' : [...byKind.entries()].map(([name, n]) => `${name} ×${n}`).join(', ')}
                {changed > 0 ? ` · uzupełnione istniejące: ${changed}` : ''}
                {bad.length > 0 ? ` · wiersze z błędem (pominięte): ${bad.length}` : ''}
              </p>
            )}
            {bad.length > 0 && <ul className="wk-warn">{bad.slice(0, 6).map((p, i) => <li key={i}>{p}</li>)}</ul>}
          </>
        )}
        {blocked.length > 0 && parsed.rows.length > 0 && <p className="wk-warn">{blocked.join(' ')}</p>}
        <div className="cg-row">
          <button type="button" className="wk-btn" disabled={plan === null || plan.saves.length === 0} onClick={() => { onQueue(parsed.rows); setText(''); }}>
            Dodaj {parsed.rows.length > 0 ? `${parsed.rows.length - bad.length} ${parsed.rows.length - bad.length === 1 ? 'wiersz' : 'wierszy'}` : 'wszystkie'}
          </button>
        </div>
      </div>
    </details>
  );
}
