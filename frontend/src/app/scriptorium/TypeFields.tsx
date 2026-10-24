/**
 * DIE EIGENEN FELDER EINES TEXTES (2026-10-23) — die seines Rodzaj tekstu,
 * ausgefüllt mit DENSELBEN Feldern wie ein Eintrag in Nauka
 * (`cogita/EntityEditor.tsx`, `FieldEditor`): ein Verweis wählt einen Eintrag
 * aus Nauka oder eine Quelle der Bibliothek (durch die Linse, `lens.ts`),
 * eine Zahl, ein Datum, eine Auswahl wie dort. Gespeichert wird im Text,
 * unter dem Schlüssel des Feldes.
 */

import { useMemo } from 'react';

import { FieldEditor } from '../cogita/EntityEditor';
import { readKind, type FieldDef } from '../cogita/schema';
import { CogitaContext, type CogitaCtx } from '../cogita/ui';
import type { Me } from '../core/me';
import type { Who } from '../core/session';
import { containerPath } from '../library/library';
import type { EntryData, LibEntry } from '../library/libraryKinds';
import { viewPath } from '../routes';
import { cogitaPath } from '../cogita/parts';
import { CORE_KEYS, TEXT_TYPE_FIELD_TYPES } from './textTypes';
import type { ScriptoriumLens } from './lens';

/** Die Felder eines Rodzaj tekstu als Felder von Nauka (für den Editor). */
export function typeFieldDefs(type: Pick<LibEntry, 'id' | 'data'>): FieldDef[] {
  return readKind(type.id, { name: 'Rodzaj tekstu', fields: type.data.fields }).fields
    .filter((f) => !CORE_KEYS.has(f.key) && (TEXT_TYPE_FIELD_TYPES as readonly string[]).includes(f.type))
    .map((f) => ({ ...f, uncertain: false }));
}

/** Wohin ein gewählter Eintrag führt — in die Wiedza oder in seinen Teil. */
export function lensHref(lens: ScriptoriumLens, id: string): string | null {
  const from = lens.origin(id);
  if (from === undefined) return null;
  return from.kind === 'knowledge' ? viewPath('knowledge', from.libraryId, 'wpisy', id) : containerPath(from.libraryId, id);
}

export function TypeFields({ lens, me, who, type, data, set, readOnly }: {
  lens: ScriptoriumLens;
  me: Me;
  who: Who | null;
  type: LibEntry;
  data: EntryData;
  set: (patch: EntryData) => void;
  readOnly: boolean;
}) {
  const fields = useMemo(() => typeFieldDefs(type), [type]);
  const ctx = useMemo<CogitaCtx>(() => ({
    lib: lens,
    name: 'Skryptorium',
    writes: !readOnly,
    keyOf: async () => undefined,
    keyIn: async () => undefined,
    me,
    who,
    href: (...tail) => (tail[0] === undefined ? viewPath('knowledge') : cogitaPath(tail[0], ...tail.slice(1)))
  }), [lens, readOnly, me, who]);

  if (fields.length === 0) return <p className="wk-empty">Rodzaj „{String(type.data.name ?? '')}” nie ma jeszcze własnych pól.</p>;
  return (
    <CogitaContext.Provider value={ctx}>
      <div className="lib-fields lib-type-fields" data-type-fields="">
        {fields.map((field) => (
          <FieldEditor key={field.key} field={field} raw={data[field.key]} writes={!readOnly}
            onChange={(value) => set({ [field.key]: value })}
            onOpen={(id) => { const href = lensHref(lens, id); if (href !== null) window.location.hash = href; }} />
        ))}
      </div>
    </CogitaContext.Provider>
  );
}
