/**
 * 0064 — EIN MODUL ALS JSON, im Bausteinverwalter: sein Name, sein Inhalt und
 * — bei einem Formular — seine Fragen, sein Aufbau und seine Wymagania.
 *
 * Der Import ändert DIESES Modul, auf jeder Seite, auf der es steht; die
 * Kennungen der Fragen halten ihre Antworten fest (`formJson.ts`). Gelesen
 * wird das Dokument wie ein Eintrag einer Seite (`moduleWish.ts`), geändert
 * wird es wie dort (`moduleImport.ts`) — 2026-10-24.
 */

import { useEffect, useState } from 'react';

import { loadAreas, type AreaRow } from '../areas/area';
import { AreaPick } from '../areas/AreaPick';
import { readFormContent } from '../forms/formJson';
import { exportVirtualAreas } from '../forms/virtualAreasJson';
import { repeatOf } from '../forms/rounds';
import { memberRolesOf } from '../forms/formGroups';
import { JsonPanel, type JsonPreview } from '../ui/JsonPanel';
import { loadModules, readConfig, type ModuleRow } from './module';
import { applyModuleWish, wantedConfig } from './moduleImport';
import { carriesForm, formWishPreview, readModuleWish, type ModuleWish } from './moduleWish';
import { documentKind, exportModule, replacing } from '../pages/pageJson';
import { moduleFormat } from '../pages/pageJsonText';
import { partLabel } from '../pages/parts/registry';
import { asRecord, asText, count } from '../pages/event/kit';
import type { Who } from '../core/session';

/**
 * Wohin die Antworten neuer Fragen gehen, und ob Fragen und Wymagania
 * ausserhalb des Dokuments gehen. Die Bereiche holt es sich selbst — erst,
 * wenn ein Dokument Fragen trägt und es deshalb dasteht.
 */
export function QuestionOptions({ answersTo, onAnswersTo, replace, onReplace }: {
  answersTo: string;
  onAnswersTo: (areaId: string) => void;
  replace: boolean;
  onReplace: (next: boolean) => void;
}) {
  const [areas, setAreas] = useState<readonly AreaRow[] | null>(null);
  useEffect(() => {
    let live = true;
    void loadAreas().then((r) => { if (live) setAreas(r.areas); }, () => { if (live) setAreas([]); });
    return () => { live = false; };
  }, []);
  const usable = (areas ?? []).filter((a) => a.heldEpochs > 0);
  return (
    <div className="wk-json-options">
      <label className="wk-field">
        <span>Odpowiedzi nowych pytań trafiają do obszaru</span>
        <AreaPick
          label="Odpowiedzi nowych pytań trafiają do obszaru" value={answersTo} onChange={onAnswersTo} disabled={areas === null}
          areas={areas ?? []} only={usable}
          extras={[{ value: '', label: areas === null ? 'Wczytywanie…' : '— jak podano w pytaniu / obszar formularza —' }]}
        />
      </label>
      <p className="wk-hint">Kto ma klucz tego obszaru, czyta odpowiedzi. Formularz bez własnego obszaru dostaje ten obszar.</p>
      <label className="pe-check">
        <input type="checkbox" checked={replace} onChange={(e) => onReplace(e.target.checked)} />
        <span>Usuń pytania i wymagania, których nie ma w dokumencie (pytania z odpowiedziami zostaną tylko zdjęte z formularza — ich odpowiedzi zostają; pytań włączonych wymagań nie da się usunąć)</span>
      </label>
    </div>
  );
}

/** Der Inhalt eines Dokuments für dieses Modul — aus einem Modul, einem Eintrag einer Seite oder als blosser Inhalt. */
function contentOf(doc: unknown, kind: string): ModuleWish | { error: string } {
  const root = asRecord(doc);
  const said = documentKind(doc);
  if (said === 'page' || said === 'legacy') return { error: 'To dokument całej strony — importuj go w edytorze strony.' };
  const docKind = asText(root.kind);
  if (docKind !== '' && docKind !== kind) return { error: `To moduł rodzaju „${partLabel(docKind)}”, a otwarty jest „${partLabel(kind)}”.` };
  const wish = readModuleWish(root);
  /* Ohne "config" und ohne Schlüssel eines Formulars ist das ganze Dokument der Inhalt. */
  const wrapped = Object.prototype.hasOwnProperty.call(root, 'config');
  return !wrapped && said === 'unknown' && !carriesForm(wish) ? { ...wish, config: root } : wish;
}

export function ModuleJson({ row, who, onDone }: { row: ModuleRow; who: Who; onDone: () => Promise<void> | void }) {
  const form = row.kind === 'form';
  const [replace, setReplace] = useState(false);
  const [answersTo, setAnswersTo] = useState(row.areaId ?? '');

  const preview = (doc: unknown): JsonPreview | { error: string } => {
    const content = contentOf(doc, row.kind);
    if ('error' in content) return content;
    const lines: string[] = [];
    const warnings: string[] = [];
    if (content.name !== undefined && content.name !== row.name) lines.push(`Nazwa: „${content.name}”.`);
    if (content.config !== undefined) {
      const have = readConfig(row.config);
      const patch = replacing(have, wantedConfig(row.kind, have, content.config));
      lines.push(Object.keys(patch).length === 0 ? 'Treść: bez zmian.' : `Treść: ${count(Object.keys(patch).length, 'zmieniony klucz', 'zmienione klucze', 'zmienionych kluczy')} — na ${row.usedOnPages === 1 ? 'jednej stronie' : `${row.usedOnPages} stronach`}.`);
    }
    const more = formWishPreview(row, content, { replace });
    lines.push(...more.lines);
    warnings.push(...more.warnings);
    /* 2026-10-24 — ein Formular ohne Bereich: ohne Wahl entstünden neue Fragen (auch die der Wymagania) nicht. */
    if (form && row.areaId === null && answersTo === '' && (content.questions !== undefined || content.needs !== undefined)) {
      warnings.push('Wybierz obszar, do którego trafiają odpowiedzi — formularz nie ma jeszcze własnego, a bez niego nowe pytania i wymagania nie powstaną.');
    }
    if (asText(asRecord(doc).id) !== '' && asText(asRecord(doc).id) !== row.moduleId) {
      warnings.push('Dokument pochodzi z innego modułu — jego treść zostanie przeniesiona tutaj.');
    }
    if (lines.length === 0) lines.push('Nic do zmiany.');
    return { lines, warnings };
  };

  const run = async (doc: unknown, stage: (what: string) => void): Promise<JsonPreview> => {
    const content = contentOf(doc, row.kind);
    if ('error' in content) throw new Error(content.error);
    const done = await applyModuleWish(who, row, content, { replace, answersTo: answersTo === '' ? null : answersTo, stage });
    await onDone();
    return { lines: done.lines.length === 0 ? ['Nic się nie zmieniło.'] : done.lines, warnings: done.warnings };
  };

  return (
    <JsonPanel
      summary="JSON modułu — eksport i import"
      lead={<>Nazwa i treść tego modułu{form ? ', jego pytania, układ i wymagania' : ''} jako JSON. Import zmienia ten moduł na każdej stronie, na której stoi — bez tworzenia go od nowa.</>}
      fileName={`modul-${row.kind}-${row.moduleId.slice(0, 8)}.json`}
      exportDoc={async () => exportModule(
        {
          moduleId: row.moduleId, kind: row.kind, name: row.name, config: readConfig(row.config), extendsId: row.extendsId, audience: row.audience, repeat: repeatOf(row.repeat), memberRoles: memberRolesOf(row),
          virtualAreas: form && row.extendsId === null ? await exportVirtualAreas(row.moduleId) : undefined,
          group: row.groupId == null ? null : ((await loadModules()).groups ?? []).find((g) => g.groupId === row.groupId)?.name ?? null
        },
        form ? await readFormContent(who, row.moduleId) : undefined
      )}
      format={moduleFormat(row.kind)}
      preview={preview}
      options={(doc) => {
        const content = contentOf(doc, row.kind);
        if (!form || 'error' in content || (content.questions === undefined && content.needs === undefined)) return null;
        return <QuestionOptions answersTo={answersTo} onAnswersTo={setAnswersTo} replace={replace} onReplace={setReplace} />;
      }}
      importLabel="Importuj i zapisz"
      onImport={run}
    />
  );
}
