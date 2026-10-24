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

import { setPartConfig } from '../forms/form';
import { readFormContent, writeFormContent, type FormContent } from '../forms/formJson';
import { JsonPanel, type JsonPreview } from '../ui/JsonPanel';
import { adoptMenuOf, loadMenu, saveMenu } from './menu';
import { loadModules, readConfig, updateModule } from '../modules/module';
import { QuestionOptions } from '../modules/ModuleJson';
import { loadPage, savePage, savePageLogic, savePageLook, savePageSubject, saveParts, type DraftPart } from './page';
import { configFromJson, DEFAULT_IMPORT, documentKind, exportPage, legacyPagesOf, PART_FORMAT, planImport, referenceFieldsOf, replacing, sameConfig, type ImportOptions, type PageNow, type PagePlan } from './pageJson';
import { AppointmentOptions } from '../calendar/AppointmentOptions';
import { resolveReferences } from '../calendar/appointmentsJson';
import { loadCalendars, type CalendarRow } from '../calendar/calendar';
import { keysFor } from '../core/ringOf';
import { PAGE_JSON, partFormat } from './pageJsonText';
import { applyModuleWish } from '../modules/moduleImport';
import { keepOwn } from './part';
import { partOf } from './parts/registry';
import { asRecord, asText, count } from './event/kit';
import { ImageNeeds, type ImageChoice } from './ImageNeeds';
import { imageRef, uploadPageFile } from './pageImages';
import { previewImageNeeds, readImageNeeds, resolveImageNeeds, type NeedsPlan } from './pageImageNeeds';
import { writeLook } from './slides/slideLook';
import { WorkspaceError, type Who } from '../core/session';

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
  const plan = (doc: unknown) => planImport(doc, { ...now, menu: null }, options);
  /* 2026-10-24 — vor jedem Plan die erbetenen Dateien eingesetzt, wie es der Import tun wird: gewählte als Platzhalter, fehlende leer. */
  const planShown = (doc: unknown) => plan(previewImageNeeds(doc, new Set(Object.keys(imageFor))));

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
     2026-10-24 — DIE ERBETENEN DATEIEN, vor allem anderen: hochladen, was vom
     Gerät kommt, und überall einsetzen, wo `page-image:@schlüssel` steht. Ein
     Dokument, das sich nicht importieren lässt, lädt nichts hoch. Was
     hochgeladen ist, gilt danach als Datei der Seite — ein zweiter Versuch
     lädt es nicht noch einmal.
  */
  const placeImages = async (doc: unknown, stage: (what: string) => void): Promise<{ doc: unknown; lines: string[]; warnings: string[] }> => {
    const needs = readImageNeeds(doc);
    if (needs === undefined) return { doc, lines: [], warnings: [] };
    const checked = planShown(doc);
    if ('error' in checked) throw new Error(checked.error);

    const refs = new Map<string, string>();
    const sending = needs.needs.filter((n) => imageFor[n.key]?.from === 'device').length;
    let sent = 0;
    setUploading(true);
    try {
      for (const need of needs.needs) {
        const choice = imageFor[need.key];
        if (choice === undefined) continue;
        if (choice.from === 'page') {
          refs.set(need.key, imageRef(choice.id));
          continue;
        }
        stage(`Wgrywanie plików strony (${sent + 1}/${sending})…`);
        const made = await uploadPageFile(now.path, choice.file, choice.file.name, choice.type).catch((e: unknown) => {
          throw new WorkspaceError(`Plik „${need.label}” (${choice.file.name}): ${e instanceof WorkspaceError ? e.message : 'nie udało się wgrać.'}`
            + (sent > 0 ? ` Wgrane wcześniej (${sent}) są już w plikach strony — ponowny import ich nie powtórzy.` : ''));
        });
        sent += 1;
        refs.set(need.key, imageRef(made.id));
        chooseImage(need.key, { from: 'page', id: made.id, name: choice.file.name, type: made.contentType });
      }
    } finally {
      setUploading(false);
    }

    const resolved = resolveImageNeeds(doc, refs);
    const labelOf = (key: string) => needs.needs.find((n) => n.key === key)?.label ?? key;
    return {
      doc: resolved.doc,
      lines: refs.size === 0 ? [] : [`Pliki strony: wgrane — ${sent}${refs.size > sent ? `, z plików strony — ${refs.size - sent}` : ''}; wstawione w ${count(resolved.placed, 'miejsce', 'miejsca', 'miejsc')}.`],
      warnings: resolved.missing.length === 0 ? [] : [`Bez pliku zostały puste miejsca: ${resolved.missing.map((key) => `„${labelOf(key)}”`).join(', ')} — plik dodasz w edytorze.`]
    };
  };

  /*
     2026-10-24 — DIE TERMINE EINTRAGEN, vor den Bausteinen: erst dann gibt es
     die Kennungen, auf die „@name" in ihren Tafeln zeigt. Gibt den Plan mit
     ersetzten Verweisen zurück.
  */
  const placeAppointments = async (done: PagePlan, stage: (what: string) => void, lines: string[], warnings: string[]): Promise<PagePlan> => {
    if (done.appointments === undefined) return done;
    const { ring, graph } = await keysFor(who);
    const person = graph.roles.find((r) => r.kind === 'person') ?? null;
    if (ring === null || person === null) {
      warnings.push('Terminy pominięte — najpierw podaj hasło.');
      return done;
    }
    const all = await loadCalendars().then((r) => r.calendars, () => [] as readonly CalendarRow[]);
    const chosen = new Map<string, CalendarRow>();
    for (const entry of done.appointments.entries) {
      const found = all.find((c) => c.calendarId === calendarFor[entry.key]);
      if (found !== undefined) chosen.set(entry.key, found);
    }
    const { importAppointments } = await import('../calendar/appointmentsImport');
    const placed = await importAppointments(ring, person.id, done.appointments, chosen, stage);
    warnings.push(...placed.warnings);
    if (placed.created > 0) lines.push(`Kalendarz: dodano ${count(placed.created, 'termin', 'terminy', 'terminów')} (z punktami programu).`);

    const missing = new Set<string>();
    const resolve = (kind: string, config: Readonly<Record<string, string>>) => {
      const got = resolveReferences(kind, config, referenceFieldsOf(kind), placed.items, placed.calendars);
      for (const name of got.missing) missing.add(name);
      return got.config;
    };
    const parts = done.parts.map((p) => ({ ...p, config: resolve(p.kind, p.config) }));
    const configs = new Map([...done.configs].map(([id, config]) => [id, resolve(done.parts.find((p) => p.id === id)?.kind ?? '', config)] as const));
    for (const name of missing) warnings.push(`„@${name}” zostało w module — ten termin albo kalendarz nie powstał.`);
    return { ...done, parts, configs };
  };

  const run = async (doc: unknown, stage: (what: string) => void): Promise<JsonPreview> => {
    /* 2026-10-24 — erst die erbetenen Dateien, dann der Plan mit ihren echten Kennungen. */
    const images = await placeImages(doc, stage);
    const planned = plan(images.doc);
    if ('error' in planned) throw new Error(planned.error);
    const path = now.path;
    const warnings = [...planned.warnings, ...images.warnings];
    const lines = [...images.lines, ...planned.lines];

    /* 2026-10-24 — die Termine zuerst: die Bausteine zeigen dann auf ihre echten Kennungen. */
    const done = await placeAppointments(planned, stage, lines, warnings);

    if (done.title !== undefined || done.lead !== undefined) {
      const title = done.title ?? now.title;
      if (title.trim() === '') warnings.push('Strona nie ma tytułu — tekst strony nie został zapisany.');
      else {
        stage('Zapisywanie tytułu…');
        await savePage(path, { title, lead: done.lead !== undefined ? done.lead : now.lead.trim() === '' ? null : now.lead.trim() });
      }
    }

    /* 2026-10-24 — ein Modul, das schon anderswo steht, behält, was es selbst führt (die Sperren der Wymagania). */
    const foreign = done.parts.filter((p) => p.moduleId !== null && !now.parts.some((x) => (x.moduleId ?? x.id) === p.moduleId));
    let parts = done.parts;
    if (foreign.length > 0) {
      const known = await loadModules().then((r) => r.modules, () => []);
      parts = done.parts.map((p) => {
        const module = foreign.includes(p) ? known.find((m) => m.moduleId === p.moduleId) : undefined;
        const def = partOf(p.kind);
        return module === undefined || def === undefined ? p : { ...p, config: keepOwn(def.json, readConfig(module.config), p.config) };
      });
    }

    stage('Zapisywanie modułów…');
    await saveParts(path, parts);

    /* Ein Modul, das auch woanders steht, folgt dem Entwurf nicht — es bekommt seinen Inhalt eigens. */
    const loaded = await loadPage(path);
    const moduleOf = new Map(loaded.parts.map((p) => [p.id, p.moduleId ?? p.id]));
    for (const [id, wanted] of done.configs) {
      const part = loaded.parts.find((p) => p.id === id);
      if (part === undefined) continue;
      const have = readConfig(part.config);
      /* 2026-10-24 — was das Modul selbst führt (die Sperren der Wymagania), bleibt. */
      const def = partOf(part.kind);
      const kept = def === undefined ? wanted : keepOwn(def.json, have, wanted);
      if (sameConfig(have, kept)) continue;
      try {
        stage('Zapisywanie treści modułów…');
        await setPartConfig(moduleOf.get(id)!, replacing(have, kept));
      } catch (e) {
        warnings.push(`Treść modułu ${partOf(part.kind)?.label ?? part.kind}: ${e instanceof WorkspaceError ? e.message : 'nie udało się zapisać'}.`);
      }
    }

    if (done.names.size > 0 || done.forms.size > 0) {
      const modules = await loadModules().then((r) => r.modules, () => []);
      for (const [id, name] of done.names) {
        const module = modules.find((m) => m.moduleId === moduleOf.get(id));
        if (module === undefined || module.name === name) continue;
        try { await updateModule(module.moduleId, { name }, module); } catch (e) {
          warnings.push(`Nazwa „${name}”: ${e instanceof WorkspaceError ? e.message : 'nie udało się zapisać'}.`);
        }
      }
      /*
       * 2026-10-24 — EIN FORMULAR DER SEITE BEKOMMT, WAS EIN MODUL-DOKUMENT IHM
       * GÄBE (`moduleImport.ts`): Fragen und Aufbau, Wymagania, Rollen, Obszary
       * osób, Gruppe, Wiederholung — dieselben Schritte wie im Bausteinverwalter.
       */
      for (const [id, wish] of done.forms) {
        const moduleId = moduleOf.get(id);
        if (moduleId === undefined) continue;
        const module = modules.find((m) => m.moduleId === moduleId);
        const name = module?.name ?? '';
        try {
          if (module !== undefined) {
            const applied = await applyModuleWish(who, module, wish, { replace: replaceQuestions, answersTo: answersTo === '' ? null : answersTo, stage });
            lines.push(...applied.lines.map((line) => `Formularz ${name}: ${line}`));
            warnings.push(...applied.warnings);
          } else if (wish.questions !== undefined || wish.design !== undefined) {
            /* Ein Modul, das die Liste (noch) nicht kennt: wenigstens Fragen und Aufbau. */
            const written = await writeFormContent(who, { moduleId, areaId: null }, { questions: wish.questions, design: wish.design },
              { replace: replaceQuestions, answersTo: answersTo === '' ? null : answersTo, onStage: stage });
            lines.push(`Formularz: nowe pytania — ${written.added}, zmienione — ${written.changed}${written.designSaved ? '; układ zapisany' : ''}.`);
            warnings.push(...written.warnings, 'Wymagania, role i obszary osób tego formularza pominięte — zaimportuj je w jego module.');
          }
        } catch (e) {
          warnings.push(`Formularz ${name}: ${e instanceof WorkspaceError ? e.message : e instanceof Error ? e.message : 'nie udało się'}.`);
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
    forgetImages();
    return { lines, warnings };
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
