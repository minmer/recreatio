/**
 * 0077 — DIE LISTE EINES FORMULARS ALS JSON: Export und Import, mit der
 * Beschreibung daneben (`entriesJson.ts`).
 *
 * <b>Erst auf einen Klick geladen.</b> Für Export und Plan braucht es alles —
 * jeden Menschen, und was jede Erweiterung zu ihm trägt, über ALLE Zeiträume.
 * Das holt niemand, der nur die Liste ansehen will; deshalb steht hier erst
 * ein Knopf.
 *
 * <b>Ausgeführt wird der Plan in dieser Reihenfolge:</b> neue Menschen, dann
 * geänderte Antworten, dann die Einsendungen der Erweiterungen (die neuer
 * Menschen hängen an deren eben entstandener Kennung). Jeder Wert wird hier
 * versiegelt, unter der Annahme seines Bereichs — wie beim Eintragen von Hand.
 */

import { useCallback, useState } from 'react';

import { ENTRIES_FORMAT, entriesDescription, exportEntries, planEntries, type EntriesContext, type ExistingRecord } from './entriesJson';
import { addOfficeEntry, reviseAcrossAsOffice } from './form';
import { readForm, type ReadForm } from './formRead';
import { JsonPanel, type JsonPreview } from './JsonPanel';
import { keysFor } from './ringOf';
import { repeatOf } from './rounds';
import { WorkspaceError, type Who } from './session';
import type { ExtensionInfo } from './steps';

interface Loaded {
  readonly ctx: EntriesContext;
  readonly base: ReadForm;
  readonly exts: ReadonlyMap<string, ReadForm>;
}

export function ListJsonPanel({ who, formId, formName, extensions, onDone }: {
  who: Who;
  formId: string;
  formName: string;
  extensions: readonly ExtensionInfo[];
  onDone: () => Promise<void> | void;
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback(async (): Promise<Loaded> => {
    const { ring } = await keysFor(who);
    if (ring === null) throw new WorkspaceError('Bez hasła w tej karcie nie da się otworzyć listy.');

    const base = await readForm(formId, ring);
    const exts = new Map<string, ReadForm>();
    for (const ext of extensions) {
      try {
        exts.set(ext.moduleId, await readForm(ext.moduleId, ring));
      } catch {
        // Ein Rozszerzenie, das dieser Browser nicht liest, fehlt nur selbst.
      }
    }

    const recordsOf = (baseId: string) => new Map([...exts].map(([moduleId, data]) => [
      moduleId,
      new Map<string, ExistingRecord>(data.registrations.filter((r) => r.baseId === baseId).map((r) => [
        r.round ?? '', { registrationId: r.registrationId, values: data.opened.get(r.registrationId) ?? new Map<string, string>() }
      ]))
    ]));

    const ctx: EntriesContext = {
      formId, formName, fields: base.fields,
      extensions: extensions.filter((e) => exts.has(e.moduleId)).map((e) => ({
        moduleId: e.moduleId, name: e.name, audience: e.audience, repeat: repeatOf(e.repeat), fields: exts.get(e.moduleId)!.fields
      })),
      existing: base.registrations.filter((r) => r.withdrawnAt === null).map((r) => ({
        registrationId: r.registrationId, hasSeat: r.seatId !== null,
        answers: base.opened.get(r.registrationId) ?? new Map<string, string>(),
        records: recordsOf(r.registrationId)
      }))
    };

    return { ctx, base, exts };
  }, [who, formId, formName, extensions]);

  const open = async () => {
    setLoading(true);
    setFailed(null);
    try {
      setLoaded(await load());
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się otworzyć listy.');
    } finally {
      setLoading(false);
    }
  };

  if (loaded === null) {
    return (
      <div className="wk-actions">
        <button type="button" className="wk-link-btn" disabled={loading} onClick={() => void open()}>
          {loading ? 'Otwieranie listy…' : 'JSON listy — eksport i import'}
        </button>
        {failed !== null && <span className="wk-error">{failed}</span>}
      </div>
    );
  }

  const preview = (doc: unknown): JsonPreview | { error: string } => {
    const plan = planEntries(doc, loaded.ctx);
    return 'error' in plan ? plan : { lines: plan.lines, warnings: plan.warnings };
  };

  const run = async (doc: unknown, stage: (what: string) => void): Promise<JsonPreview> => {
    /* Mit dem FRISCHEN Stand planen — zwischen Vorschau und Knopf kann jemand etwas eingetragen haben. */
    const now = await load();
    const plan = planEntries(doc, now.ctx);
    if ('error' in plan) throw new WorkspaceError(plan.error);

    const baseKeys = { intakes: now.base.intakes, areaOf: now.base.areaOf, seatKey: null };
    const made = new Map<number, string>();

    for (const [i, one] of plan.add.entries()) {
      stage(`Dopisywanie osób: ${i + 1} z ${plan.add.length}…`);
      made.set(one.ref, (await addOfficeEntry(formId, null, one.answers, baseKeys)).registrationId);
    }

    for (const [i, one] of plan.change.entries()) {
      stage(`Zmienianie danych: ${i + 1} z ${plan.change.length}…`);
      await reviseAcrossAsOffice(one.registrationId, one.answers, baseKeys);
    }

    const extKeys = (extensionId: string) => {
      const data = now.exts.get(extensionId)!;
      return { intakes: data.intakes, areaOf: data.areaOf, seatKey: null };
    };

    for (const [i, one] of plan.recordsNew.entries()) {
      stage(`Wpisy w rozszerzeniach: ${i + 1} z ${plan.recordsNew.length}…`);
      const baseId = 'ref' in one.base ? made.get(one.base.ref) : one.base.registrationId;
      if (baseId === undefined) continue;
      await addOfficeEntry(one.extensionId, baseId, one.answers, extKeys(one.extensionId), one.round);
    }

    for (const [i, one] of plan.recordsChange.entries()) {
      stage(`Zmienianie wpisów: ${i + 1} z ${plan.recordsChange.length}…`);
      await reviseAcrossAsOffice(one.registrationId, one.answers, extKeys(one.extensionId));
    }

    setLoaded(await load());
    await onDone();
    return { lines: plan.lines, warnings: plan.warnings };
  };

  return (
    <JsonPanel
      summary="JSON listy — eksport i import"
      lead={<>Osoby z tej listy i wpisy z rozszerzeń jako JSON („{ENTRIES_FORMAT}”). Import dopisuje i zmienia — nie usuwa. Listę z kartki albo arkusza zamień na ten format (opis obok możesz skopiować do swojego czatu z AI) i wklej tutaj.</>}
      fileName={`lista-${formId.slice(0, 8)}.json`}
      exportDoc={async () => exportEntries((await load()).ctx)}
      description={() => entriesDescription(loaded.ctx)}
      preview={preview}
      importLabel="Importuj i zapisz"
      onImport={run}
    />
  );
}

export default ListJsonPanel;
