/**
 * 0064 — DIE SEITE ALS JSON (im Editor der Seite) und EIN BAUSTEIN ALS JSON
 * (in seinen Einstellungen).
 *
 * <b>Die Seite</b> geht mit allem hinaus, was sie ausmacht — Titel, Aussehen,
 * Menü, Karte, jeder Baustein mit Inhalt, Formulare mit ihren Fragen — und
 * kommt so wieder herein: geänderte Bausteine an ihrer Stelle, neue dazu
 * (`pageJson.ts`). Der Import SPEICHERT, in der Reihenfolge, in der die Teile
 * aufeinander aufbauen: erst die Seite, dann die Bausteine, dann was an den
 * Modulen hängt, zuletzt Aussehen, Menü und Karte.
 *
 * <b>Ein Baustein</b> tauscht nur seinen Inhalt — in den Entwurf; gespeichert
 * wird mit „Zapisz moduły", wie jede andere Änderung dort.
 */

import { useState } from 'react';

import { setPartConfig } from './form';
import { readFormContent, writeFormContent, type FormContent } from './formJson';
import { JsonPanel, type JsonPreview } from './JsonPanel';
import { adoptMenuOf, loadMenu, saveMenu } from './menu';
import { loadModules, readConfig, updateModule } from './module';
import { QuestionOptions } from './ModuleJson';
import { loadPage, savePage, savePageLogic, savePageLook, savePageSubject, saveParts, type DraftPart } from './page';
import {
  configFromJson, DEFAULT_IMPORT, documentKind, exportPage, legacyPagesOf, pageDescription, PART_FORMAT, partDescription,
  planImport, replacing, sameConfig, type ImportOptions, type PageNow
} from './pageJson';
import { partOf } from './parts/registry';
import { asRecord, asText, count } from './event/kit';
import { writeLook } from './slides';
import { WorkspaceError, type Who } from './session';

export function PageJson({ now, who, unsaved, onDone }: {
  /** Die Seite, wie der Editor sie gerade hält — mit dem Entwurf. */
  now: Omit<PageNow, 'menu' | 'names' | 'forms'>;
  who: Who;
  /** Liegt im Entwurf noch Ungespeichertes? Es geht mit hinaus. */
  unsaved: boolean;
  onDone: () => Promise<void> | void;
}) {
  const [options, setOptions] = useState<ImportOptions>(DEFAULT_IMPORT);
  const [replaceQuestions, setReplaceQuestions] = useState(false);
  const [answersTo, setAnswersTo] = useState('');

  const set = (patch: Partial<ImportOptions>) => setOptions((was) => ({ ...was, ...patch }));
  const plan = (doc: unknown) => planImport(doc, { ...now, menu: null }, options);

  const exportDoc = async () => {
    const menu = await loadMenu(now.path).catch(() => null);
    const modules = await loadModules().then((r) => r.modules, () => []);
    const names = new Map(modules.map((m) => [m.moduleId, m.name]));
    const forms = new Map<string, FormContent>();
    for (const part of now.parts.filter((p) => p.kind === 'form')) {
      const moduleId = part.moduleId ?? part.id;
      try { forms.set(moduleId, await readFormContent(who, moduleId)); } catch { /* ohne Fragen — der Rest geht trotzdem hinaus */ }
    }
    return exportPage({ ...now, menu, names, forms });
  };

  const preview = (doc: unknown): JsonPreview | { error: string } => {
    const done = plan(doc);
    if ('error' in done) return done;
    return { lines: done.lines, warnings: done.warnings };
  };

  const run = async (doc: unknown, stage: (what: string) => void): Promise<JsonPreview> => {
    const done = plan(doc);
    if ('error' in done) throw new Error(done.error);
    const path = now.path;
    const warnings = [...done.warnings];
    const lines = [...done.lines];

    if (done.title !== undefined || done.lead !== undefined) {
      const title = done.title ?? now.title;
      if (title.trim() === '') warnings.push('Strona nie ma tytułu — tekst strony nie został zapisany.');
      else {
        stage('Zapisywanie tytułu…');
        await savePage(path, { title, lead: done.lead !== undefined ? done.lead : now.lead.trim() === '' ? null : now.lead.trim() });
      }
    }

    stage('Zapisywanie modułów…');
    await saveParts(path, done.parts);

    /* Ein Modul, das auch woanders steht, folgt dem Entwurf nicht — es bekommt seinen Inhalt eigens. */
    const loaded = await loadPage(path);
    const moduleOf = new Map(loaded.parts.map((p) => [p.id, p.moduleId ?? p.id]));
    for (const [id, wanted] of done.configs) {
      const part = loaded.parts.find((p) => p.id === id);
      if (part === undefined) continue;
      const have = readConfig(part.config);
      if (sameConfig(have, wanted)) continue;
      try {
        stage('Zapisywanie treści modułów…');
        await setPartConfig(moduleOf.get(id)!, replacing(have, wanted));
      } catch (e) {
        warnings.push(`Treść modułu ${partOf(part.kind)?.label ?? part.kind}: ${e instanceof WorkspaceError ? e.message : 'nie udało się zapisać'}.`);
      }
    }

    if (done.names.size > 0 || done.forms.size > 0) {
      const modules = await loadModules().then((r) => r.modules, () => []);
      for (const [id, name] of done.names) {
        const module = modules.find((m) => m.moduleId === moduleOf.get(id));
        if (module === undefined || module.name === name) continue;
        try { await updateModule(module.moduleId, { name }); } catch (e) {
          warnings.push(`Nazwa „${name}”: ${e instanceof WorkspaceError ? e.message : 'nie udało się zapisać'}.`);
        }
      }
      for (const [id, content] of done.forms) {
        const moduleId = moduleOf.get(id);
        if (moduleId === undefined) continue;
        const module = modules.find((m) => m.moduleId === moduleId);
        try {
          const written = await writeFormContent(who, { moduleId, areaId: module?.areaId ?? null }, content,
            { replace: replaceQuestions, answersTo: answersTo === '' ? null : answersTo, onStage: stage });
          lines.push(`Formularz ${module?.name ?? ''}: nowe pytania — ${written.added}, zmienione — ${written.changed}${written.removed > 0 ? `, usunięte — ${written.removed}` : ''}${written.designSaved ? '; układ zapisany' : ''}.`);
          warnings.push(...written.warnings);
        } catch (e) {
          warnings.push(`Pytania formularza ${module?.name ?? ''}: ${e instanceof WorkspaceError ? e.message : e instanceof Error ? e.message : 'nie udało się'}.`);
        }
      }
    }

    if (done.mode !== undefined || done.look !== undefined) {
      stage('Zapisywanie wyglądu…');
      await savePageLook(path, { mode: done.mode ?? now.mode, theme: writeLook(done.look ?? now.look) });
    }

    if (done.menu !== undefined) {
      stage('Zapisywanie menu…');
      try {
        if (done.menu === null) await saveMenu(path, []);
        else if ('items' in done.menu) await saveMenu(path, done.menu.items);
        else await adoptMenuOf(path, done.menu.from);
      } catch (e) {
        warnings.push(`Menu: ${e instanceof WorkspaceError ? e.message : 'nie udało się zapisać'}.`);
      }
    }

    if (done.logic !== undefined) {
      stage('Zapisywanie mapy logiki…');
      await savePageLogic(path, done.logic);
    }

    if (done.subject !== undefined) {
      stage('Zapisywanie wyboru na stronie…');
      await savePageSubject(path, done.subject);
    }

    await onDone();
    return { lines, warnings };
  };

  return (
    <JsonPanel
      summary="JSON strony — eksport i import"
      lead={<>Cała strona — tytuł, wygląd, menu, mapa logiki i moduły z treścią (formularze z pytaniami) — jako jeden dokument. Wyeksportuj, zmień i zaimportuj: moduły zmieniają się w miejscu, a zgłoszenia, linki i mapa logiki zostają.</>}
      fileName={`strona-${now.path.replace(/[^a-z0-9]+/gi, '-')}.json`}
      exportDoc={exportDoc}
      description={pageDescription}
      preview={preview}
      importLabel="Importuj i zapisz"
      note={unsaved ? 'Niezapisane zmiany w edytorze zostaną zapisane razem z importem.' : null}
      onImport={run}
      options={(doc) => {
        const kind = documentKind(doc);
        const planned = plan(doc);
        const entries = asRecord(doc).modules;
        const fromElsewhere = Array.isArray(entries) && entries.some((e) => {
          const one = asRecord(e);
          const module = asText(one.module);
          return module !== '' && !now.parts.some((p) => p.id === asText(one.id) || (p.moduleId ?? p.id) === module);
        });
        const pages = kind === 'legacy' ? legacyPagesOf(doc) : [];
        return (
          <div className="wk-json-options">
            {kind === 'page' || kind === 'legacy' ? (
              <label className="pe-check">
                <input type="checkbox" checked={options.replace} onChange={(e) => set({ replace: e.target.checked })} />
                <span>Zastąp moduły strony — których nie ma w dokumencie, znikną ze strony</span>
              </label>
            ) : null}
            {(fromElsewhere || kind === 'module') && (
              <label className="pe-check">
                <input type="checkbox" checked={options.copyModules} onChange={(e) => set({ copyModules: e.target.checked })} />
                <span>Moduły z innych stron jako kopie (bez tego to te same moduły — zmiana w jednym miejscu zmienia oba)</span>
              </label>
            )}
            {kind === 'legacy' && pages.length > 1 && (
              <label className="wk-field">
                <span>Która strona wydarzenia</span>
                <select value={options.legacyPage} onChange={(e) => set({ legacyPage: Number(e.target.value) })}>
                  {pages.map((one) => <option key={one.index} value={one.index}>{one.label} — {one.parts.length} części</option>)}
                </select>
              </label>
            )}
            {kind === 'legacy' && (
              <label className="pe-check">
                <input type="checkbox" checked={options.takeTheme} onChange={(e) => set({ takeTheme: e.target.checked })} />
                <span>Weź też kolory wydarzenia</span>
              </label>
            )}
            {!('error' in planned) && [...planned.forms.values()].some((f) => f.questions !== undefined) && (
              <QuestionOptions answersTo={answersTo} onAnswersTo={setAnswersTo} replace={replaceQuestions} onReplace={setReplaceQuestions} />
            )}
          </div>
        );
      }}
    />
  );
}

/** Der Inhalt eines Dokuments für EINEN Baustein — aus `config`, einem Eintrag oder als blosser Inhalt. */
function configOfDoc(doc: unknown, kind: string): { config: unknown } | { error: string } {
  const root = asRecord(doc);
  const said = documentKind(doc);
  if (said === 'page' || said === 'legacy') return { error: 'To dokument całej strony — importuj go w „JSON strony” pod modułami.' };
  const docKind = asText(root.kind);
  if (docKind !== '' && docKind !== kind) return { error: `To treść modułu „${partOf(docKind)?.label ?? docKind}”, a ten moduł to „${partOf(kind)?.label ?? kind}”.` };
  return Object.prototype.hasOwnProperty.call(root, 'config') ? { config: root.config } : { config: root };
}

/** 0064 — EIN BAUSTEIN ALS JSON, in seinen Einstellungen (Raster und Slajdy). */
export function PartJson({ part, onSet }: { part: DraftPart; onSet: (patch: Record<string, string>) => void }) {
  const def = partOf(part.kind);
  if (def === undefined) return null;

  return (
    <JsonPanel
      summary="JSON tego modułu"
      lead={<>Treść tego modułu jako JSON — do skopiowania, poprawienia albo przygotowania przez AI. Import zmienia szkic; zapisuje „Zapisz moduły”.</>}
      fileName={`modul-${part.kind}.json`}
      exportDoc={() => ({ format: PART_FORMAT, version: 1, id: part.id, module: part.moduleId ?? part.id, kind: part.kind, config: def.json.toJson(part.config) })}
      description={() => partDescription(part.kind)}
      preview={(doc) => {
        const got = configOfDoc(doc, part.kind);
        if ('error' in got) return got;
        const patch = replacing(part.config, configFromJson(part.kind, got.config));
        const changed = Object.keys(patch).length;
        return { lines: [changed === 0 ? 'Treść bez zmian.' : `Treść: ${count(changed, 'zmieniony klucz', 'zmienione klucze', 'zmienionych kluczy')}.`], warnings: [] };
      }}
      importLabel="Wstaw do szkicu"
      onImport={async (doc) => {
        const got = configOfDoc(doc, part.kind);
        if ('error' in got) throw new Error(got.error);
        const patch = replacing(part.config, configFromJson(part.kind, got.config));
        if (Object.keys(patch).length > 0) onSet(patch);
        return { lines: ['Treść jest w szkicu — zapisz moduły, żeby została.'], warnings: [] };
      }}
    />
  );
}
