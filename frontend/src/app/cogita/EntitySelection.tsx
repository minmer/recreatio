/**
 * COGITA — VIELE EINTRÄGE AUF EINMAL BEHANDELN (COGITA.md §2.3), 2026-10-18,
 * auf Wunsch: in der Tabelle mit der Maus (Häkchen, Strg/Umschalt, Ziehen)
 * oder durch langes Drücken wählen — dann löschen, ein Feld setzen (Sprache,
 * Thema, …) oder in einen Zbiór legen. Was aus einer anderen Baza wiedzy
 * kommt, bleibt unberührt; wer gelöscht wird, auf den zeigen danach keine
 * Verweise mehr — das sagt die Rückfrage vorher.
 */

import { useState } from 'react';

import { plural } from '../core/plural';
import { askText, toast } from '../ui/dialogs';
import { typedValue } from './addForm';
import { fieldsOf, valuesOf, type Entity, type FieldDef } from './schema';
import { creatorFor, EntityPicker, useBusy, useCtx } from './ui';

type FieldMode = 'add' | 'set' | 'remove' | 'clear';

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Der Wert, so wie er gespeichert ist — ohne Hülle (Unsicherheit), zum Vergleichen. */
const bare = (raw: unknown): unknown => (typeof raw === 'object' && raw !== null && !Array.isArray(raw) && 'value' in raw ? (raw as { value: unknown }).value : raw);

/** Die Daten eines Eintrags nach der Änderung eines Feldes — `null`: nichts ändert sich. */
export function changedData(entity: Entity, field: FieldDef, mode: FieldMode, values: readonly unknown[]): Record<string, unknown> | null {
  const data: Record<string, unknown> = { ...entity.data };
  const raw = data[field.key];
  const now: unknown[] = raw === undefined || raw === null ? [] : field.multi && Array.isArray(raw) ? [...raw] : [raw];
  const has = (v: unknown) => valuesOf(entity, field).some((x) => same(x.value, v));
  if (mode === 'clear') {
    if (raw === undefined) return null;
    delete data[field.key];
    return data;
  }
  if (mode === 'remove') {
    const kept = now.filter((x) => !values.some((v) => same(bare(x), v)));
    if (kept.length === now.length) return null;
    if (kept.length === 0) delete data[field.key]; else data[field.key] = field.multi ? kept : kept[0];
    return data;
  }
  if (mode === 'add' && field.multi) {
    const fresh = values.filter((v) => !has(v));
    if (fresh.length === 0) return null;
    data[field.key] = [...now, ...fresh];
    return data;
  }
  const next = field.multi ? [...values] : values[0];
  if (same(raw, next)) return null;
  data[field.key] = next;
  return data;
}

export function SelectionBar({ ids, total, onAll, onClear, onKept }: {
  ids: ReadonlySet<string>;
  /** Wie viele die Liste gerade zeigt — „alle zaznacz". */
  total: number;
  onAll: () => void;
  onClear: () => void;
  /** Nach dem Löschen: was übrig bleibt, bleibt gewählt. */
  onKept: (kept: ReadonlySet<string>) => void;
}) {
  const { lib, writes } = useCtx();
  const { busy, failed, run } = useBusy();
  const [open, setOpen] = useState<'field' | 'collection' | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const chosen = [...ids].map((id) => lib.entity(id)).filter((e): e is Entity => e !== undefined);
  const own = chosen.filter((e) => lib.isOwn(e.id));
  const n = chosen.length;

  const remove = () => run(async () => {
    const gone = new Set(own.map((e) => e.id));
    const pointing = new Set(own.flatMap((e) => lib.backlinks(e.id).map((b) => b.from)).filter((id) => !gone.has(id)));
    const foreign = n - own.length;
    const asked = [
      `Usunąć ${own.length} ${plural(own.length, 'wpis', 'wpisy', 'wpisów')}?`,
      pointing.size > 0 ? `${pointing.size} ${plural(pointing.size, 'inny wpis odwołuje', 'inne wpisy odwołują', 'innych wpisów odwołuje')} się do nich (np. tłumaczenie do słowa) — te odwołania zostaną puste.` : '',
      foreign > 0 ? `${foreign} ${plural(foreign, 'pochodzi', 'pochodzą', 'pochodzi')} z innych baz wiedzy — te zostaną.` : ''
    ].filter(Boolean).join(' ');
    if (own.length === 0 || !(await askText(asked))) return;
    let done = 0;
    for (const e of own) {
      await lib.remove(e.id);
      done += 1;
      setProgress(`Usuwanie… ${done} z ${own.length}`);
    }
    setProgress(null);
    toast(`Usunięto ${done} ${plural(done, 'wpis', 'wpisy', 'wpisów')}.`);
    onKept(new Set([...ids].filter((id) => !gone.has(id))));
  });

  return (
    <div className="cg-select-bar" role="region" aria-label="Zaznaczone wpisy">
      <div className="cg-select-head">
        <strong>Zaznaczone: {n}</strong>
        {n < total && <button type="button" className="wk-link-btn" onClick={onAll}>Zaznacz wszystkie ({total})</button>}
        <button type="button" className="wk-link-btn" onClick={onClear}>Odznacz</button>
        {writes && (
          <span className="cg-row">
            <button type="button" className={`wk-btn wk-btn-quiet${open === 'field' ? ' is-on' : ''}`} disabled={busy || own.length === 0} onClick={() => setOpen(open === 'field' ? null : 'field')}>Ustaw pole…</button>
            <button type="button" className={`wk-btn wk-btn-quiet${open === 'collection' ? ' is-on' : ''}`} disabled={busy} onClick={() => setOpen(open === 'collection' ? null : 'collection')}>Do zbioru…</button>
            <button type="button" className="wk-btn wk-btn-danger" disabled={busy || own.length === 0} onClick={() => void remove()}>Usuń ({own.length})</button>
          </span>
        )}
      </div>
      {progress !== null && <p className="cg-muted">{progress}</p>}
      {failed !== null && <p className="wk-error">{failed}</p>}
      {open === 'field' && <FieldAction own={own} onDone={() => setOpen(null)} />}
      {open === 'collection' && <CollectionAction ids={[...ids]} onDone={() => setOpen(null)} />}
      {own.length < n && <p className="cg-muted">{n - own.length} z zaznaczonych pochodzi z innych baz wiedzy — tych nie da się tu zmienić ani usunąć.</p>}
    </div>
  );
}

/** Ein Feld für alle Gewählten: setzen, hinzufügen, einen Wert entfernen, leeren. */
function FieldAction({ own, onDone }: { own: readonly Entity[]; onDone: () => void }) {
  const { lib, writes } = useCtx();
  const { busy, failed, run } = useBusy();
  /* Die Felder, die die Gewählten haben — je Schlüssel einmal, mit der Zahl derer, die es haben. */
  const fields = new Map<string, { field: FieldDef; count: number }>();
  for (const e of own) for (const f of fieldsOf(e, lib.look)) fields.set(f.key, { field: f, count: (fields.get(f.key)?.count ?? 0) + 1 });
  const list = [...fields.values()].sort((a, b) => b.count - a.count);
  const [key, setKey] = useState(list[0]?.field.key ?? '');
  const field = fields.get(key)?.field;
  const [mode, setMode] = useState<FieldMode>('set');
  const [text, setText] = useState('');
  const [ref, setRef] = useState<string | null>(null);
  const modes: [FieldMode, string][] = field?.multi === true
    ? [['add', 'dodaj wartość'], ['set', 'zastąp wszystkie'], ['remove', 'usuń tę wartość'], ['clear', 'wyczyść pole']]
    : [['set', 'ustaw'], ['clear', 'wyczyść pole']];
  const effective = modes.some(([m]) => m === mode) ? mode : modes[0][0];

  const valuesOfInput = (): unknown[] | string => {
    if (field === undefined) return 'Wybierz pole.';
    if (effective === 'clear') return [];
    if (field.type === 'ref') return ref === null ? 'Wybierz wpis.' : [ref];
    const parsed = typedValue(field, text);
    if ('error' in parsed) return parsed.error;
    return Array.isArray(parsed.value) && field.multi && field.type !== 'list' ? parsed.value : [parsed.value];
  };

  const apply = () => run(async () => {
    const values = valuesOfInput();
    if (typeof values === 'string') throw new Error(values);
    const changes = own.flatMap((e) => {
      if (!fieldsOf(e, lib.look).some((f) => f.key === key)) return [];
      const data = changedData(e, field!, effective, values);
      return data === null ? [] : [{ id: e.id, kinds: e.kinds, data }];
    });
    if (changes.length === 0) { toast('Nic się nie zmienia.'); return; }
    const done = await lib.saveMany(changes);
    if (done.failed.length > 0) throw new Error(`Nie zapisano ${done.failed.length} z ${changes.length}: ${done.failed[0].error}`);
    toast(`Zmieniono ${done.saved} ${plural(done.saved, 'wpis', 'wpisy', 'wpisów')}.`);
    onDone();
  });

  if (list.length === 0) return <p className="cg-muted">Zaznaczone wpisy nie mają wspólnych pól.</p>;
  return (
    <div className="cg-select-action">
      <label className="wk-field"><span>Pole</span>
        <select value={key} onChange={(e) => { setKey(e.target.value); setText(''); setRef(null); }}>
          {list.map(({ field: f, count }) => <option key={f.key} value={f.key}>{f.label}{count < own.length ? ` (${count} z ${own.length})` : ''}</option>)}
        </select>
      </label>
      <label className="wk-field"><span>Co zrobić</span>
        <select value={effective} onChange={(e) => setMode(e.target.value as FieldMode)}>{modes.map(([m, label]) => <option key={m} value={m}>{label}</option>)}</select>
      </label>
      {field !== undefined && effective !== 'clear' && (field.type === 'ref'
        ? <div className="wk-field"><span>Wartość</span><EntityPicker lib={lib} kinds={field.to} value={ref} onPick={setRef} {...creatorFor(lib, field.to, writes)} /></div>
        : field.type === 'choice'
          ? (
            <label className="wk-field"><span>Wartość</span>
              <select value={text} onChange={(e) => setText(e.target.value)}><option value="">—</option>{(field.options ?? []).map((o) => <option key={o.value} value={o.label}>{o.label}</option>)}</select>
            </label>
          )
          : <label className="wk-field"><span>Wartość</span><input value={text} onChange={(e) => setText(e.target.value)} placeholder={field.multi ? 'kilka: oddziel średnikiem' : undefined} /></label>)}
      <div className="cg-row">
        <button type="button" className="wk-btn" disabled={busy} onClick={() => void apply()}>{busy ? 'Zapisywanie…' : `Zmień ${own.length} ${plural(own.length, 'wpis', 'wpisy', 'wpisów')}`}</button>
        <button type="button" className="wk-link-btn" onClick={onDone}>Anuluj</button>
      </div>
      {failed !== null && <p className="wk-error">{failed}</p>}
    </div>
  );
}

/** Die Gewählten in einen Zbiór — einen vorhandenen oder einen neuen. */
function CollectionAction({ ids, onDone }: { ids: readonly string[]; onDone: () => void }) {
  const { lib } = useCtx();
  const { busy, failed, run } = useBusy();
  const docs = lib.docs('collection').filter((e) => lib.isOwn(e.id));
  const [target, setTarget] = useState(docs[0]?.id ?? '');
  const [name, setName] = useState('');
  const apply = () => run(async () => {
    const doc = docs.find((e) => e.id === target);
    if (doc === undefined) {
      if (name.trim() === '') throw new Error('Podaj nazwę nowego zbioru.');
      await lib.saveDoc('collection', { name: name.trim(), rule: null, list: [...ids] });
    } else {
      const had = Array.isArray(doc.data.list) ? doc.data.list.filter((x): x is string => typeof x === 'string') : [];
      await lib.saveDoc('collection', { ...doc.data, list: [...new Set([...had, ...ids])] }, doc.id);
    }
    toast(`Dodano do zbioru: ${ids.length}.`);
    onDone();
  });
  return (
    <div className="cg-select-action">
      <label className="wk-field"><span>Zbiór</span>
        <select value={target} onChange={(e) => setTarget(e.target.value)}>
          {docs.map((e) => <option key={e.id} value={e.id}>{typeof e.data.name === 'string' ? e.data.name : 'Zbiór'}</option>)}
          <option value="">+ nowy zbiór…</option>
        </select>
      </label>
      {target === '' && <label className="wk-field"><span>Nazwa nowego zbioru</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>}
      <div className="cg-row">
        <button type="button" className="wk-btn" disabled={busy} onClick={() => void apply()}>Dodaj {ids.length}</button>
        <button type="button" className="wk-link-btn" onClick={onDone}>Anuluj</button>
      </div>
      {failed !== null && <p className="wk-error">{failed}</p>}
    </div>
  );
}
