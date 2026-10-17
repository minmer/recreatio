/**
 * COGITA — DAS SCHEMA BEARBEITEN (COGITA.md §2.2): Rodzaje mit ihren Feldern,
 * dem Muster des Etiketts, dem unterscheidenden Feld; die eingebauten als
 * Anfang, die man umbenennen und erweitern kann [B1]; eigene, so viele man
 * will. Werte entfernter oder umgetypter Felder bleiben „poza schematem" [B13].
 */

import { useEffect, useMemo, useState } from 'react';

import { JsonPanel } from '../ui/JsonPanel';
import { WorkspaceError } from '../core/session';
import { applyImport, courseDescription, exportSchema, planImport } from './json';
import { isBaseKind } from './kinds';
import {
  FIELD_KEY, FIELD_ROLES, FIELD_TYPE_LABEL, FIELD_TYPES, MEDIA_TYPES, patternKeys, problemsOf, RANGE_OF, readKind,
  type FieldDef, type FieldType, type KindDef
} from './schema';
import { OriginTag, useBusy, useCtx } from './ui';

const blankField = (n: number): FieldDef => ({ key: `pole${n}`, label: `Pole ${n}`, type: 'line', multi: false, uncertain: false });

export function SchemaEditor({ chosenId, onChoose }: { chosenId: string | null; onChoose: (id: string | null) => void }) {
  const { lib, writes, name } = useCtx();
  const chosen = chosenId === null ? undefined : lib.kind(chosenId);
  const [draft, setDraft] = useState<KindDef | null>(null);
  const { busy, failed, run } = useBusy();

  useEffect(() => { setDraft(chosen === undefined ? null : chosen); }, [chosenId, chosen === undefined ? '' : JSON.stringify(chosen)]);

  const create = () => {
    const id = lib.newId();
    setDraft({ id, name: 'Nowy rodzaj', label: '{name}', fields: [{ key: 'name', label: 'Nazwa', type: 'line', multi: false, uncertain: false }], speaks: false });
    onChoose(null);
  };

  return (
    <div className="cg-split">
      <div className="cg">
        {draft === null ? (
          <p className="wk-hint">Wybierz rodzaj z listy{writes ? ' albo dodaj nowy' : ''}. Rodzaj mówi, jakie pola ma wpis, jak się nazywa (wzór etykiety) i czym różnią się wpisy o tej samej nazwie.</p>
        ) : (
          <KindForm key={draft.id} draft={draft} writes={writes && (isBaseKind(draft.id) || lib.isOwn(draft.id) || lib.origin(draft.id) === undefined)} busy={busy}
            onChange={setDraft}
            onSave={() => void run(async () => { await lib.saveKind(draft); onChoose(draft.id); })}
          />
        )}
        {failed !== null && <p className="wk-error">{failed}</p>}
        {writes && (
          <JsonPanel
            summary="Schemat jako JSON — kopia do innej bazy wiedzy"
            lead={<>Rodzaje z ich szablonami kart jako jeden dokument. Import tworzy niezależną kopię: zmiany tutaj nie zmieniają bazy, z której przyszła [B12]. Żeby korzystać z rodzajów innej bazy bez kopiowania, dodaj ją w Ustawieniach jako źródło.</>}
            fileName={`schemat-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`}
            exportDoc={() => exportSchema(lib, name, lib.kinds.filter((k) => (!isBaseKind(k.id) && lib.isOwn(k.id)) || lib.docs('kind').some((e) => e.data.builtin === k.id)))}
            description={() => courseDescription(lib)}
            preview={(doc) => { const p = planImport(lib, doc); return 'error' in p ? p : { lines: p.lines, warnings: p.warnings }; }}
            importLabel="Importuj schemat"
            onImport={async (doc, stage) => {
              const p = planImport(lib, doc);
              if ('error' in p) throw new WorkspaceError(p.error);
              return applyImport(lib, p, stage);
            }}
          />
        )}
      </div>
      <aside className="cg">
        <div className="cg-row-between">
          <h3>Rodzaje</h3>
          {writes && <button type="button" className="wk-btn" onClick={create}>+ Rodzaj</button>}
        </div>
        <ul className="lib-list">
          {lib.kinds.map((k) => (
            <li key={k.id}>
              <button type="button" className={`lib-row cg-card${chosenId === k.id ? ' is-on' : ''}`} onClick={() => onChoose(k.id)}>
                <span className="lib-row-title">{k.name} {k.system !== undefined && <span className="cg-tag">system</span>} {isBaseKind(k.id) && k.system === undefined && <span className="cg-tag">wbudowany</span>} {k.speaks && <span className="cg-tag">postać</span>} {!isBaseKind(k.id) && <OriginTag id={k.id} />}</span>
                <span className="lib-row-meta">{lib.ofKind(k.id).length} wpisów · {k.fields.length} pól</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

function KindForm({ draft, writes, busy, onChange, onSave }: { draft: KindDef; writes: boolean; busy: boolean; onChange: (k: KindDef) => void; onSave: () => void }) {
  const { lib } = useCtx();
  const base = isBaseKind(draft.id);
  const builtinKeys = useMemo(() => new Set(base ? (lib.kind(draft.id)?.fields ?? []).filter((f) => f.role === f.key || f.private === true).map((f) => f.key) : []), [base, draft.id, lib]);
  const problems = problemsOf(draft, lib.look);
  const keys = new Set<string>();
  const dupes = draft.fields.filter((f) => { const d = keys.has(f.key); keys.add(f.key); return d; }).map((f) => f.key);
  const bad = draft.fields.filter((f) => !FIELD_KEY.test(f.key)).map((f) => f.key);
  const set = (patch: Partial<KindDef>) => onChange({ ...draft, ...patch });
  /* Ein neuer Typ räumt auf, was nur zum alten passte (Optionen, Ziele, Einheit) — sonst bleibt das Feld, wie es ist. */
  const setField = (i: number, patch: Partial<FieldDef>) => set({
    fields: draft.fields.map((f, j) => {
      if (j !== i) return f;
      const next = { ...f, ...patch };
      if (patch.type === undefined || patch.type === f.type) return next;
      return readKind(draft.id, { fields: [next] }).fields[0] ?? next;
    })
  });
  const move = (i: number, by: -1 | 1) => {
    const fields = [...draft.fields];
    const to = i + by;
    if (to < 0 || to >= fields.length) return;
    [fields[i], fields[to]] = [fields[to], fields[i]];
    set({ fields });
  };

  return (
    <form className="wk-form cg" onSubmit={(e) => { e.preventDefault(); if (writes) onSave(); }}>
      <div className="cg-row">
        <label className="wk-field"><span>Nazwa rodzaju</span><input value={draft.name} disabled={!writes} onChange={(e) => set({ name: e.target.value })} /></label>
        <label className="wk-field"><span>Wzór etykiety</span><input value={draft.label} disabled={!writes} placeholder="{givenNames} {surname}" onChange={(e) => set({ label: e.target.value })} /></label>
        <label className="wk-field"><span>Co odróżnia imienników</span>
          <select value={draft.tells ?? ''} disabled={!writes} onChange={(e) => set({ tells: e.target.value === '' ? undefined : e.target.value })}>
            <option value="">—</option>
            {draft.fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
        </label>
        <label className="pe-check"><input type="checkbox" checked={draft.speaks} disabled={!writes} onChange={(e) => set({ speaks: e.target.checked })} /><span>Postać — może mówić w przebiegach</span></label>
      </div>
      <p className="wk-hint">W etykiecie: {draft.fields.map((f) => `{${f.key}}`).join(' ')} {patternKeys(draft.label).length === 0 && '— wzór nie używa jeszcze żadnego pola.'}</p>
      {base && <p className="wk-hint">Pola wbudowanego rodzaju zostają (korzystają z nich przypisy, publikacja i ISBN) — można zmienić ich nazwy i dodać własne.</p>}

      <div className="cg-table-wrap">
        <table className="cg-table">
          <thead><tr><th>Klucz</th><th>Nazwa</th><th>Typ</th><th>Kilka</th><th>Niepewne</th><th>Więcej</th><th /></tr></thead>
          <tbody>
            {draft.fields.map((f, i) => {
              const fixed = builtinKeys.has(f.key);
              return (
                <tr key={`${i}-${f.key}`}>
                  <td><input value={f.key} disabled={!writes || fixed} size={10} onChange={(e) => setField(i, { key: e.target.value })} aria-label="Klucz pola" /></td>
                  <td><input value={f.label} disabled={!writes} onChange={(e) => setField(i, { label: e.target.value })} aria-label="Nazwa pola" />{f.private === true && <span className="cg-tag">prywatne</span>}</td>
                  <td>
                    <select value={f.type} disabled={!writes || fixed} onChange={(e) => setField(i, { type: e.target.value as FieldType })}>
                      {[...FIELD_TYPES, ...(f.type === 'outline' ? ['outline' as const] : [])].map((t) => <option key={t} value={t}>{FIELD_TYPE_LABEL[t]}</option>)}
                    </select>
                  </td>
                  <td><input type="checkbox" checked={f.multi} disabled={!writes || fixed} onChange={(e) => setField(i, { multi: e.target.checked })} aria-label="Kilka wartości" /></td>
                  <td><input type="checkbox" checked={f.uncertain} disabled={!writes || fixed} onChange={(e) => setField(i, { uncertain: e.target.checked })} aria-label="Wartości niepewne" /></td>
                  <td><FieldMore field={f} disabled={!writes || fixed} own={!base} onSet={(patch) => setField(i, patch)} /></td>
                  <td className="cg-row">
                    {writes && <button type="button" className="wk-link-btn" aria-label="Wyżej" onClick={() => move(i, -1)}>↑</button>}
                    {writes && <button type="button" className="wk-link-btn" aria-label="Niżej" onClick={() => move(i, 1)}>↓</button>}
                    {writes && !fixed && <button type="button" className="wk-link-btn" aria-label="Usuń pole" onClick={() => set({ fields: draft.fields.filter((_, j) => j !== i) })}>×</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {writes && <button type="button" className="wk-link-btn" onClick={() => set({ fields: [...draft.fields, blankField(draft.fields.length + 1)] })}>+ pole</button>}
      {[...problems, ...dupes.map((k) => `Dwa pola o kluczu „${k}".`), ...bad.map((k) => `Klucz „${k}": litery, cyfry i _, zaczyna się literą.`)].map((p, i) => <p key={i} className="wk-warn">{p}</p>)}
      <p className="wk-hint">Gdy usuniesz pole albo zmienisz jego typ, wartości wpisów zostają jako „poza schematem", dopóki ktoś o nich nie zdecyduje.</p>
      {writes && <div className="wk-actions"><button type="submit" className="wk-btn" disabled={busy || dupes.length > 0 || bad.length > 0}>{busy ? 'Zapisywanie…' : 'Zapisz rodzaj'}</button></div>}
    </form>
  );
}

function FieldMore({ field, disabled, own, onSet }: { field: FieldDef; disabled: boolean; own: boolean; onSet: (patch: Partial<FieldDef>) => void }) {
  const { lib } = useCtx();
  return (
    <details>
      <summary className="cg-muted">{field.says ?? 'ustawienia'}</summary>
      <div className="cg">
        <label className="wk-field"><span>Co znaczy (dla JSON i AI)</span><input value={field.says ?? ''} disabled={disabled && !own} onChange={(e) => onSet({ says: e.target.value || undefined })} /></label>
        {field.type === 'number' && <label className="wk-field"><span>Jednostka</span><input value={field.unit ?? ''} disabled={disabled} onChange={(e) => onSet({ unit: e.target.value || undefined })} /></label>}
        {field.type === 'choice' && (
          <label className="wk-field"><span>Do wyboru (wartość=nazwa w wierszu)</span>
            <textarea rows={3} disabled={disabled} value={(field.options ?? []).map((o) => (o.value === o.label ? o.value : `${o.value}=${o.label}`)).join('\n')}
              onChange={(e) => onSet({ options: e.target.value.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const [v, ...rest] = l.split('='); return { value: v.trim(), label: (rest.join('=') || v).trim() }; }) })} />
          </label>
        )}
        {field.type === 'ref' && (
          <>
            <fieldset className="cg-row"><legend>Do jakich rodzajów (puste — dowolnych; także z bibliotek, do których ta baza się odwołuje)</legend>
              {lib.refKinds.map((k) => (
                <label key={k.id} className="pe-check">
                  <input type="checkbox" checked={(field.to ?? []).includes(k.id)} disabled={disabled} onChange={(e) => onSet({ to: e.target.checked ? [...(field.to ?? []), k.id] : (field.to ?? []).filter((t) => t !== k.id) })} />
                  <span>{k.name}</span>
                </label>
              ))}
            </fieldset>
            <label className="wk-field"><span>Nazwa po drugiej stronie</span><input value={field.inverse ?? ''} disabled={disabled} placeholder="np. napisane przez" onChange={(e) => onSet({ inverse: e.target.value || undefined })} /></label>
            <label className="pe-check"><input type="checkbox" checked={field.symmetric === true} disabled={disabled} onChange={(e) => onSet({ symmetric: e.target.checked || undefined })} /><span>w obie strony (zapisane raz)</span></label>
          </>
        )}
        {field.type === 'media' && (
          <fieldset className="cg-row"><legend>Jakie pliki</legend>
            {MEDIA_TYPES.map((m) => (
              <label key={m} className="pe-check">
                <input type="checkbox" checked={(field.media ?? MEDIA_TYPES).includes(m)} disabled={disabled} onChange={(e) => {
                  const now = new Set(field.media ?? MEDIA_TYPES);
                  if (e.target.checked) now.add(m); else now.delete(m);
                  onSet({ media: [...now] });
                }} />
                <span>{{ image: 'obraz', audio: 'dźwięk', video: 'film', document: 'dokument' }[m]}</span>
              </label>
            ))}
          </fieldset>
        )}
        {field.type === 'range' && (
          <label className="wk-field"><span>Zakres czego</span>
            <select value={field.rangeOf ?? 'number'} disabled={disabled} onChange={(e) => onSet({ rangeOf: e.target.value as FieldDef['rangeOf'] })}>
              {RANGE_OF.map((r) => <option key={r} value={r}>{{ number: 'liczb', date: 'dat', text: 'tekstów' }[r]}</option>)}
            </select>
          </label>
        )}
        {own && (
          <label className="wk-field"><span>Rola (dla wbudowanych narzędzi)</span>
            <select value={field.role ?? ''} disabled={disabled} onChange={(e) => onSet({ role: e.target.value || undefined })}>
              <option value="">—</option>
              {FIELD_ROLES.map((r) => <option key={r.role} value={r.role}>{r.label}</option>)}
            </select>
          </label>
        )}
      </div>
    </details>
  );
}
