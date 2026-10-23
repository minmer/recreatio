/**
 * DIE EINFACHEN FELDER EINES EINTRAGS (0064) — aus seiner Art gezeichnet: Zeile,
 * Text, Zahl, Datum, Auswahl, Adresse, Verweis. Dieselben für die Quellen der
 * Bibliothek und für die Daten eines Textes im Skryptorium (2026-10-23 aus
 * `LibraryTextForm.tsx` herausgelöst).
 */

import type { ReactNode } from 'react';

import { type EntryData, type LibField, ids, kindOf, num, str } from './libraryKinds';
import { RefPicker } from './LibraryPick';
import type { LibraryStore } from './libraryStore';

export function FieldList({ store, kind, data, set, readOnly, skip = [], only, extras = {} }: {
  store: LibraryStore;
  kind: string;
  data: EntryData;
  set: (patch: EntryData) => void;
  readOnly: boolean;
  skip?: readonly string[];
  /** 2026-10-21 — nur diese Felder, in der Reihenfolge der Art (ein Formular in Abschnitten). */
  only?: readonly string[];
  /** Was unter einem Feld steht — Knöpfe, Hinweise (bei der ISBN: scannen, Katalog). */
  extras?: Readonly<Record<string, ReactNode>>;
}) {
  const def = kindOf(kind)!;
  return (
    <div className="lib-fields">
      {def.fields.filter((f) => !skip.includes(f.key) && (only === undefined || only.includes(f.key))
        && f.type !== 'outline' && f.type !== 'markup' && f.type !== 'items' && (f.when === undefined || f.when(data))).map((field) => (
        <FieldInput key={field.key} store={store} field={field} data={data} set={set} readOnly={readOnly} extra={extras[field.key]} />
      ))}
    </div>
  );
}

export function FieldInput({ store, field, data, set, readOnly, extra }: {
  store: LibraryStore;
  field: LibField;
  data: EntryData;
  set: (patch: EntryData) => void;
  readOnly: boolean;
  extra?: ReactNode;
}) {
  const value = str(data, field.key);
  const label = <span>{field.label}</span>;
  const wide = field.type === 'text' || field.type === 'refs' || field.key === 'title';

  if (field.type === 'ref' || field.type === 'refs') {
    return (
      <div className={`wk-field lib-field${wide ? ' is-wide' : ''}`}>
        {label}
        <RefPicker store={store} kinds={field.to ?? []} value={ids(data, field.key)} multiple={field.type === 'refs'} busy={readOnly}
          onChange={(next) => set({ [field.key]: field.type === 'ref' ? (next[0] ?? '') : next })} />
      </div>
    );
  }

  let input: ReactNode;
  if (field.type === 'select') {
    input = (
      <select value={value} disabled={readOnly} onChange={(e) => set({ [field.key]: e.target.value })}>
        <option value="">—</option>
        {(field.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  } else if (field.type === 'text') {
    input = <textarea rows={field.key === 'text' ? 6 : 3} value={value} placeholder={field.hint} disabled={readOnly} onChange={(e) => set({ [field.key]: e.target.value })} />;
  } else {
    input = (
      <input
        type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : field.type === 'url' ? 'url' : 'text'}
        step={field.type === 'number' ? 'any' : undefined}
        min={field.type === 'number' ? 0 : undefined}
        value={field.type === 'number' ? (num(data, field.key) ?? '') : value}
        placeholder={field.hint}
        disabled={readOnly}
        onChange={(e) => set({ [field.key]: field.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value })}
      />
    );
  }

  if (extra === undefined || extra === null) return <label className={`wk-field lib-field${wide ? ' is-wide' : ''}`}>{label}{input}</label>;
  return (
    <div className={`lib-field-with${wide ? ' is-wide' : ''}`}>
      <label className="wk-field lib-field">{label}{input}</label>
      {extra}
    </div>
  );
}
