/**
 * COGITA — FORMULARZE DODAWANIA ALS JSON (COGITA.md §2.4), 2026-10-19, auf
 * Wunsch: ein Formular (oder alle) mit den Rodzaje, die es braucht, hinaus —
 * und herein, mit dem Plan vor dem Knopf und der Beschreibung daneben, wie
 * überall (`JsonPanel`). Derselbe `ref` ändert ein Formular an Ort und Stelle,
 * ein neuer legt eines an; danach öffnet sich das (erste) eingelesene.
 */

import { useCallback, useState } from 'react';

import { JsonPanel } from '../ui/JsonPanel';
import { Modal } from '../ui/Modal';
import { WorkspaceError } from '../core/session';
import { applyImport, exportForms, formDescription, planFormImport } from './json';
import { useCtx } from './ui';

export function FormJsonPanel({ forms, name, note, onImported, open = false }: {
  /** Was der Export enthält — ein Formular (auch ungespeichert) oder alle. */
  forms: () => readonly { readonly id: string; readonly data: Readonly<Record<string, unknown>> }[];
  name: string;
  note?: string;
  /** Das erste eingelesene Formular. */
  onImported?: (id: string) => void;
  open?: boolean;
}) {
  const { lib } = useCtx();
  const describe = useCallback(() => formDescription(lib), [lib]);
  return (
    <JsonPanel
      summary={forms().length === 1 ? 'Formularz jako JSON' : 'Formularze dodawania jako JSON'}
      lead={<>Formularz razem z rodzajami, których potrzebuje (i szablonami kart, jeśli dokument je ma) — do innej bazy wiedzy albo do poprawienia w tekście. Ten sam „ref” zmienia istniejący formularz, nowy — tworzy formularz. Niczego się nie usuwa.</>}
      fileName={`formularz-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'cogita'}.json`}
      exportDoc={() => exportForms(lib, forms(), name)}
      description={describe}
      preview={(doc) => { const p = planFormImport(lib, doc); return 'error' in p ? p : { lines: p.lines, warnings: p.warnings }; }}
      importLabel="Importuj formularz"
      {...(note === undefined ? {} : { note })}
      open={open}
      onImport={async (doc, stage) => {
        const plan = planFormImport(lib, doc);
        if ('error' in plan) throw new WorkspaceError(plan.error);
        const done = await applyImport(lib, plan, stage);
        const first = plan.docs.find((d) => d.kind === 'addform');
        if (first !== undefined) onImported?.(first.id);
        return done;
      }}
    />
  );
}

/** „+ Formularz → Z JSON…": ein Dialog mit demselben Fach — für ein Formular, das es hier noch nicht gibt. */
export function FormJsonDialog({ onClose, onImported }: { onClose: () => void; onImported: (id: string) => void }) {
  const { lib } = useCtx();
  const [shown] = useState(() => lib.docs('addform').filter((e) => lib.isOwn(e.id)).map((e) => ({ id: e.id, data: e.data })));
  return (
    <Modal title="Formularz dodawania z JSON" onClose={onClose} wide>
      <FormJsonPanel open forms={() => shown} name="Formularze dodawania" onImported={(id) => { onImported(id); onClose(); }} />
    </Modal>
  );
}
