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

import { useEffect, useRef, useState } from 'react';

import { readFormContent, type FormContent } from '../forms/formJson';
import { JsonPanel, type JsonPreview } from '../ui/JsonPanel';
import { loadMenu } from './menu';
import { loadModules } from '../modules/module';
import { QuestionOptions } from '../modules/ModuleJson';
import { type DraftPart } from './page';
import { configFromJson, DEFAULT_IMPORT, documentKind, exportPage, legacyPagesOf, PART_FORMAT, replacing, type ImportOptions, type PageNow } from './pageJson';
import { AppointmentOptions } from '../calendar/AppointmentOptions';
import { PAGE_JSON, partFormat } from './pageJsonText';
import { keepOwn } from './part';
import { partOf } from './parts/registry';
import { asRecord, asText, count } from './event/kit';
import { ImageNeeds, type ImageChoice } from './ImageNeeds';
import { readImageNeeds, type NeedsPlan } from './pageImageNeeds';
import { planShownPage, runPageImport } from './pageImportRun';
import { type Who } from '../core/session';

/** 2026-10-24 — die Vorschaubilder vom Gerät freigeben: sie halten die Datei im Speicher. */
function dropPreviews(choices: readonly ImageChoice[]): void {
  for (const one of choices) if (one.from === 'device' && one.preview !== null) URL.revokeObjectURL(one.preview);
}

/** 2026-10-24 — eine Zeile zum Plan: wie viele Dateien das Dokument erbittet und wie viele schon da sind. */
function needsLine(needs: NeedsPlan, chosen: Readonly<Record<string, ImageChoice>>): string {
  const have = needs.needs.filter((n) => chosen[n.key] !== undefined).length;
  const lacking = needs.needs.length - have;
  return `Pliki do dodania: ${needs.needs.length} — dodane ${have}${lacking > 0 ? `, brakuje ${lacking}` : ''} (niżej).`;
}

function needsWarnings(needs: NeedsPlan, chosen: Readonly<Record<string, ImageChoice>>): string[] {
  const lacking = needs.needs.filter((n) => chosen[n.key] === undefined);
  return [
    ...needs.warnings,
    ...(lacking.length === 0 ? [] : [`Bez pliku zostaną puste miejsca: ${lacking.map((n) => `„${n.label}”`).join(', ')} — dodaj pliki niżej albo później w edytorze.`])
  ];
}

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
  /* 2026-10-24 — je Eingang der Termine des Dokuments: der Kalender, in den sie gehen. */
  const [calendarFor, setCalendarFor] = useState<Readonly<Record<string, string>>>({});
  /*
     2026-10-24 — je Datei, um die das Dokument bittet ("images", `page-image:@schlüssel`): was
     gewählt ist — vom Gerät (erst beim Import hochgeladen) oder aus den Dateien der Seite.
  */
  const [imageFor, setImageFor] = useState<Readonly<Record<string, ImageChoice>>>({});
  const [uploading, setUploading] = useState(false);
  const latestImages = useRef(imageFor);
  latestImages.current = imageFor;
  useEffect(() => () => dropPreviews(Object.values(latestImages.current)), []);

  const chooseImage = (key: string, choice: ImageChoice | null) => {
    const old = latestImages.current[key];
    if (old !== undefined && old !== choice) dropPreviews([old]);
    setImageFor((was) => {
      const { [key]: _gone, ...rest } = was;
      return choice === null ? rest : { ...rest, [key]: choice };
    });
  };

  /** Nach einem Import: die Wahl gehörte zum Dokument, und das ist fort. */
  const forgetImages = () => {
    dropPreviews(Object.values(latestImages.current));
    setImageFor({});
  };

  const set = (patch: Partial<ImportOptions>) => setOptions((was) => ({ ...was, ...patch }));
  /* 2026-10-24 — vor jedem Plan die erbetenen Dateien eingesetzt, wie es der Import tun wird: gewählte als Platzhalter, fehlende leer. */
  const planShown = (doc: unknown) => planShownPage(doc, now, options, imageFor);

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
    const done = planShown(doc);
    if ('error' in done) return done;
    const unchosen = (done.appointments?.entries ?? []).filter((e) => (calendarFor[e.key] ?? '') === '');
    const needs = readImageNeeds(doc);
    /* 2026-10-24 — ein neues Formular hat noch keinen Bereich: ohne Wahl entstünden seine Fragen (und die seiner Wymagania) nicht. */
    const homeless = answersTo === '' && [...done.forms].some(([id, wish]) =>
      (wish.questions !== undefined || wish.needs !== undefined) && done.parts.find((p) => p.id === id)?.moduleId === null);
    return {
      lines: [...done.lines, ...(needs === undefined || needs.needs.length === 0 ? [] : [needsLine(needs, imageFor)])],
      warnings: [
        ...done.warnings,
        ...(needs === undefined ? [] : needsWarnings(needs, imageFor)),
        ...unchosen.map((e) => `Wybierz kalendarz dla terminów „${e.label}” — bez tego zostaną pominięte.`),
        ...(homeless ? ['Wybierz obszar, do którego trafiają odpowiedzi nowego formularza — bez niego jego pytania i wymagania nie powstaną.'] : [])
      ]
    };
  };

  /*
     2026-10-26 — DER IMPORT SELBST steht in `pageImportRun.ts` (derselbe für das JSON
     eines Bereichs): Dateien, Plan, Termine, Titel, Bausteine, Inhalt, Formulare,
     Aussehen, Menü, Karte, Wybór na stronie.
  */
  const run = async (doc: unknown, stage: (what: string) => void): Promise<JsonPreview> => {
    const done = await runPageImport({
      who, now, doc, options,
      choices: { replaceQuestions, answersTo: answersTo === '' ? null : answersTo, calendarFor, imageFor },
      hooks: { stage, uploading: setUploading, uploaded: chooseImage }
    });
    await onDone();
    forgetImages();
    return { lines: done.lines, warnings: done.warnings };
  };

  return (
    <JsonPanel
      summary="JSON strony — eksport i import"
      lead={<>Cała strona — tytuł, wygląd, menu, mapa logiki i moduły z treścią (formularze z pytaniami) — jako jeden dokument. Wyeksportuj, zmień i zaimportuj: moduły zmieniają się w miejscu, a zgłoszenia, linki i mapa logiki zostają.</>}
      fileName={`strona-${now.path.replace(/[^a-z0-9]+/gi, '-')}.json`}
      exportDoc={exportDoc}
      format={PAGE_JSON}
      preview={preview}
      importLabel="Importuj i zapisz"
      note={unsaved ? 'Niezapisane zmiany w edytorze zostaną zapisane razem z importem.' : null}
      onImport={run}
      options={(doc) => {
        const kind = documentKind(doc);
        const planned = planShown(doc);
        const needs = readImageNeeds(doc);
        const entries = asRecord(doc).modules;
        const fromElsewhere = Array.isArray(entries) && entries.some((e) => {
          const one = asRecord(e);
          const module = asText(one.module);
          return module !== '' && !now.parts.some((p) => p.id === asText(one.id) || (p.moduleId ?? p.id) === module);
        });
        const pages = kind === 'legacy' ? legacyPagesOf(doc) : [];
        return (
          <div className="wk-json-options">
            {/* 2026-10-24 — die Dateien, um die das Dokument bittet: vor dem Import hinzufügen. */}
            {needs !== undefined && needs.needs.length > 0 && (
              <ImageNeeds path={now.path} needs={needs.needs} chosen={imageFor} busy={uploading} onChoose={chooseImage} />
            )}
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
            {!('error' in planned) && [...planned.forms.values()].some((f) => f.questions !== undefined || f.needs !== undefined) && (
              <QuestionOptions answersTo={answersTo} onAnswersTo={setAnswersTo} replace={replaceQuestions} onReplace={setReplaceQuestions} />
            )}
            {/* 2026-10-24 — die Eingänge der Termine: je einer ein Kalender. */}
            {!('error' in planned) && planned.appointments !== undefined && (
              <AppointmentOptions entries={planned.appointments.entries} chosen={calendarFor}
                onChoose={(entry, calendarId) => setCalendarFor((was) => ({ ...was, [entry]: calendarId }))} />
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
      format={partFormat(part.kind)}
      preview={(doc) => {
        const got = configOfDoc(doc, part.kind);
        if ('error' in got) return got;
        const patch = replacing(part.config, keepOwn(def.json, part.config, configFromJson(part.kind, got.config)));
        const changed = Object.keys(patch).length;
        return { lines: [changed === 0 ? 'Treść bez zmian.' : `Treść: ${count(changed, 'zmieniony klucz', 'zmienione klucze', 'zmienionych kluczy')}.`], warnings: [] };
      }}
      importLabel="Wstaw do szkicu"
      onImport={async (doc) => {
        const got = configOfDoc(doc, part.kind);
        if ('error' in got) throw new Error(got.error);
        const patch = replacing(part.config, keepOwn(def.json, part.config, configFromJson(part.kind, got.config)));
        if (Object.keys(patch).length > 0) onSet(patch);
        return { lines: ['Treść jest w szkicu — zapisz moduły, żeby została.'], warnings: [] };
      }}
    />
  );
}
