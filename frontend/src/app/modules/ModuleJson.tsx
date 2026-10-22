/**
 * 0064 — EIN MODUL ALS JSON, im Bausteinverwalter: sein Name, sein Inhalt und
 * — bei einem Formular — seine Fragen und sein Aufbau.
 *
 * Der Import ändert DIESES Modul, auf jeder Seite, auf der es steht; die
 * Kennungen der Fragen halten ihre Antworten fest (`formJson.ts`).
 */

import { useEffect, useState } from 'react';

import { loadAreas, type AreaRow } from '../areas/area';
import { AreaPick } from '../areas/AreaPick';
import { setPartConfig } from '../forms/form';
import { readFormContent, writeFormContent } from '../forms/formJson';
import { JsonPanel, type JsonPreview } from '../ui/JsonPanel';
import { createFormGroup, loadModules, readConfig, updateModule, type ModuleRow } from './module';
import { newId } from '../core/ids';
import { configFromJson, documentKind, exportModule, replacing } from '../pages/pageJson';
import { moduleDescription } from '../pages/pageJsonText';
import { partLabel } from '../pages/parts/registry';
import { asRecord, asText, count } from '../pages/event/kit';
import { REPEAT_LABEL, REPEATS, repeatOf, type Repeat } from '../forms/rounds';
import { setMemberRoles } from '../roles/memberRole';
import { keysFor } from '../core/ringOf';
import { memberRolesOf } from '../forms/formGroups';
import { describeVirtualAreas, exportVirtualAreas, importVirtualAreas, readVirtualAreas, type VirtualAreaDoc } from '../forms/virtualAreasJson';
import type { Who } from '../core/session';

/**
 * Wohin die Antworten neuer Fragen gehen, und ob Fragen ausserhalb des
 * Dokuments gehen. Die Bereiche holt es sich selbst — erst, wenn ein Dokument
 * Fragen trägt und es deshalb dasteht.
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
        <span>Usuń pytania, których nie ma w dokumencie (pytania z odpowiedziami zostaną tylko zdjęte z formularza — ich odpowiedzi zostają; pytań włączonych wymagań nie da się usunąć)</span>
      </label>
    </div>
  );
}

/** Der Inhalt eines Dokuments für dieses Modul — aus einem Modul, einem Eintrag einer Seite oder als blosser Inhalt. */
function contentOf(doc: unknown, kind: string): {
  config?: unknown; name?: string; questions?: unknown; design?: unknown; repeat?: Repeat;
  /** 0091/0120 — die Rollen seiner Menschen (aus "memberRoles", oder dem älteren "memberRole"). */
  memberRoles?: readonly string[];
  /** 0120 — die Obszary osób, und was beim Lesen auffiel. */
  virtualAreas?: readonly VirtualAreaDoc[]; virtualWarnings?: readonly string[];
  /** 0096 — wer ein Unterformular ausfüllt; die Gruppe (ein Name, oder null: keine). */
  audience?: 'person' | 'office'; group?: string | null;
} | { error: string } {
  const root = asRecord(doc);
  const said = documentKind(doc);
  if (said === 'page' || said === 'legacy') return { error: 'To dokument całej strony — importuj go w edytorze strony.' };
  const docKind = asText(root.kind);
  if (docKind !== '' && docKind !== kind) return { error: `To moduł rodzaju „${partLabel(docKind)}”, a otwarty jest „${partLabel(kind)}”.` };
  const wrapped = Object.prototype.hasOwnProperty.call(root, 'config');
  const has = (key: string) => Object.prototype.hasOwnProperty.call(root, key);
  return {
    ...(wrapped ? { config: root.config } : said === 'unknown' && !has('questions') && !has('design') ? { config: root } : {}),
    ...(asText(root.name).trim() !== '' ? { name: asText(root.name).trim() } : {}),
    ...(has('questions') ? { questions: root.questions } : {}),
    ...(has('design') ? { design: root.design } : {}),
    /* 0077 — wie oft eine Erweiterung ausgefüllt wird. Ein unbekanntes Wort ist keines. */
    ...((REPEATS as readonly string[]).includes(asText(root.repeat)) ? { repeat: asText(root.repeat) as Repeat } : {}),
    /* 0091/0120 — die Rollen seiner Menschen: eine Liste; älter: eine Kennung, oder null (keine). */
    ...(has('memberRoles') && Array.isArray(root.memberRoles)
      ? { memberRoles: [...new Set(root.memberRoles.map((r) => asText(r).trim()).filter((r) => r !== ''))] }
      : has('memberRole') ? { memberRoles: root.memberRole === null || asText(root.memberRole).trim() === '' ? [] : [asText(root.memberRole).trim()] } : {}),
    ...virtualOf(root.virtualAreas),
    ...(asText(root.audience) === 'person' || asText(root.audience) === 'office' ? { audience: asText(root.audience) as 'person' | 'office' } : {}),
    ...(has('group') ? { group: root.group === null ? null : asText(root.group).trim() || null } : {})
  };
}

/** 0120 — "virtualAreas" gelesen, mit dem, was dabei auffiel. */
function virtualOf(value: unknown): { virtualAreas?: readonly VirtualAreaDoc[]; virtualWarnings?: readonly string[] } {
  const warnings: string[] = [];
  const read = readVirtualAreas(value, warnings);
  return read === undefined ? {} : { virtualAreas: read, virtualWarnings: warnings };
}

const sameRoles = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

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
      const patch = replacing(readConfig(row.config), configFromJson(row.kind, content.config));
      lines.push(Object.keys(patch).length === 0 ? 'Treść: bez zmian.' : `Treść: ${count(Object.keys(patch).length, 'zmieniony klucz', 'zmienione klucze', 'zmienionych kluczy')} — na ${row.usedOnPages === 1 ? 'jednej stronie' : `${row.usedOnPages} stronach`}.`);
    }
    if (content.questions !== undefined || content.design !== undefined) {
      if (!form) warnings.push('"questions" i "design" ma tylko formularz — pominięte.');
      else {
        if (content.questions !== undefined) lines.push(`Pytania w dokumencie: ${Array.isArray(content.questions) ? content.questions.length : 0}.`);
        if (content.design !== undefined) lines.push(content.design === null ? 'Układ: zwykła lista.' : 'Układ i logika: z dokumentu.');
      }
    }
    if (content.repeat !== undefined && content.repeat !== repeatOf(row.repeat)) {
      if (row.extendsId === null) warnings.push('"repeat" ma tylko rozszerzenie formularza — pominięte.');
      else if (row.entries > 0) warnings.push('To rozszerzenie ma już wpisy — "repeat" zostaje bez zmian.');
      else lines.push(`Powtarzanie: ${REPEAT_LABEL[content.repeat]}.`);
    }
    if (content.memberRoles !== undefined && !sameRoles(content.memberRoles, memberRolesOf(row))) {
      if (!form || row.extendsId !== null) warnings.push('"memberRoles" mają tylko formularze (nie rozszerzenia) — pominięte.');
      else lines.push(content.memberRoles.length === 0 ? 'Role uczestników: żadne (kto już należy, zostaje).' : 'Role uczestników: z dokumentu — te, które masz.');
    }
    if (content.virtualAreas !== undefined) {
      warnings.push(...(content.virtualWarnings ?? []));
      if (!form || row.extendsId !== null) warnings.push('"virtualAreas" mają tylko formularze (nie rozszerzenia) — pominięte.');
      else lines.push(describeVirtualAreas(content.virtualAreas));
    }
    if (content.audience !== undefined && row.extendsId !== null && content.audience !== row.audience) {
      if (row.entries > 0) warnings.push('Ten podformularz ma już wpisy — "audience" zostaje bez zmian.');
      else lines.push(`Kto wypełnia: ${content.audience === 'office' ? 'tylko koordynator' : 'osoba przez swój link'}.`);
    }
    if (content.group !== undefined) {
      if (!form) warnings.push('"group" ma tylko formularz — pominięte.');
      else lines.push(content.group === null ? 'Grupa: żadna.' : `Grupa: „${content.group}" (jeśli jej nie ma — powstanie).`);
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
    const lines: string[] = [];
    const warnings: string[] = [];

    if (content.name !== undefined && content.name !== row.name) {
      stage('Zmiana nazwy…');
      await updateModule(row.moduleId, { name: content.name }, row);
      lines.push(`Nazwa: „${content.name}”.`);
    }
    if (content.repeat !== undefined && content.repeat !== repeatOf(row.repeat) && row.extendsId !== null && row.entries === 0) {
      stage('Zmiana powtarzania…');
      await updateModule(row.moduleId, { repeat: content.repeat });
      lines.push(`Powtarzanie: ${REPEAT_LABEL[content.repeat]}.`);
    }
    if (content.audience !== undefined && row.extendsId !== null && content.audience !== row.audience && row.entries === 0) {
      stage('Zmiana: kto wypełnia…');
      await updateModule(row.moduleId, { audience: content.audience });
      lines.push(`Kto wypełnia: ${content.audience === 'office' ? 'tylko koordynator' : 'osoba przez swój link'}.`);
    }
    if (form && content.group !== undefined) {
      stage('Grupa formularzy…');
      if (content.group === null) {
        await updateModule(row.moduleId, { clearGroup: true });
        lines.push('Grupa: żadna.');
      } else {
        const wanted = content.group;
        const known = ((await loadModules()).groups ?? []).find((g) => g.name.toLocaleLowerCase('pl') === wanted.toLocaleLowerCase('pl'));
        /* 0097 — eine neue Gruppe gehört dem Bereich des Formulars: unter seinem Schlüssel liegt ihr Name. */
        if (known === undefined && row.areaId === null) throw new Error('Formularz bez obszaru — grupy nie da się założyć.');
        const groupId = known?.groupId ?? (await createFormGroup(newId(), wanted, row.areaId!)).groupId;
        await updateModule(row.moduleId, { groupId });
        lines.push(known === undefined ? `Grupa „${wanted}" założona, formularz w niej.` : `Grupa: „${known.name}".`);
      }
    }
    if (content.config !== undefined) {
      const patch = replacing(readConfig(row.config), configFromJson(row.kind, content.config));
      if (Object.keys(patch).length > 0) {
        stage('Zapisywanie treści…');
        await setPartConfig(row.moduleId, patch);
        lines.push('Treść zapisana.');
      }
    }
    if (form && row.extendsId === null && content.memberRoles !== undefined && !sameRoles(content.memberRoles, memberRolesOf(row))) {
      stage('Ustawianie ról uczestników…');
      try {
        /* Nur Rollen, die der Importierende hält — eine fremde Kennung nähme sonst der ganzen Liste die Wirkung. */
        const { ring } = await keysFor(who);
        const held = content.memberRoles.filter((roleId) => ring?.has(roleId) === true);
        for (const roleId of content.memberRoles) {
          if (!held.includes(roleId)) warnings.push(`Roli ${roleId.slice(0, 8)}… nie masz — pominięta.`);
        }
        await setMemberRoles(row.moduleId, held);
        lines.push(held.length === 0 ? 'Role uczestników: żadne.' : 'Role uczestników ustawione.');
      } catch (e) {
        warnings.push(`Role uczestników nie zostały ustawione: ${e instanceof Error ? e.message : 'nie udało się'}`);
      }
    }
    if (form && row.extendsId === null && content.virtualAreas !== undefined) {
      try {
        const done = await importVirtualAreas(who, row.moduleId, content.virtualAreas, stage);
        lines.push(...done.lines);
        warnings.push(...done.warnings);
      } catch (e) {
        warnings.push(`Obszary osób: ${e instanceof Error ? e.message : 'nie udało się'}`);
      }
    }
    if (form && (content.questions !== undefined || content.design !== undefined)) {
      const written = await writeFormContent(who, { moduleId: row.moduleId, areaId: row.areaId }, content,
        { replace, answersTo: answersTo === '' ? null : answersTo, onStage: stage });
      lines.push(`Pytania: nowe — ${written.added}, zmienione — ${written.changed}, bez zmian — ${written.unchanged}${written.removed > 0 ? `, usunięte — ${written.removed}` : ''}${written.designSaved ? '; układ zapisany' : ''}.`);
      warnings.push(...written.warnings);
    }
    await onDone();
    return { lines: lines.length === 0 ? ['Nic się nie zmieniło.'] : lines, warnings };
  };

  return (
    <JsonPanel
      summary="JSON modułu — eksport i import"
      lead={<>Nazwa i treść tego modułu{form ? ', jego pytania i układ' : ''} jako JSON. Import zmienia ten moduł na każdej stronie, na której stoi — bez tworzenia go od nowa.</>}
      fileName={`modul-${row.kind}-${row.moduleId.slice(0, 8)}.json`}
      exportDoc={async () => exportModule(
        {
          moduleId: row.moduleId, kind: row.kind, name: row.name, config: readConfig(row.config), extendsId: row.extendsId, audience: row.audience, repeat: repeatOf(row.repeat), memberRoles: memberRolesOf(row),
          virtualAreas: form && row.extendsId === null ? await exportVirtualAreas(row.moduleId) : undefined,
          group: row.groupId == null ? null : ((await loadModules()).groups ?? []).find((g) => g.groupId === row.groupId)?.name ?? null
        },
        form ? await readFormContent(who, row.moduleId) : undefined
      )}
      description={() => moduleDescription(row.kind)}
      preview={preview}
      options={(doc) => {
        const content = contentOf(doc, row.kind);
        if (!form || 'error' in content || content.questions === undefined) return null;
        return <QuestionOptions answersTo={answersTo} onAnswersTo={setAnswersTo} replace={replace} onReplace={setReplace} />;
      }}
      importLabel="Importuj i zapisz"
      onImport={run}
    />
  );
}
