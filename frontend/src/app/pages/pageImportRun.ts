/**
 * 2026-10-26 — EINEN IMPORT DER SEITE AUSFÜHREN — herausgelöst aus
 * `PageJsonPanel.tsx`, damit das JSON eines Bereichs (`areas/areaImport.ts`)
 * jede seiner Seiten genauso speichert: dieselben Schritte in derselben
 * Reihenfolge, an einer Stelle.
 *
 * <b>Die Reihenfolge baut aufeinander auf:</b> erst die erbetenen Dateien
 * (dann gibt es ihre Kennungen), dann der Plan, dann die Termine (dann gibt es
 * die Kennungen, auf die „@name" zeigt), dann Titel, Bausteine, ihr Inhalt,
 * Namen und Formulare, zuletzt Aussehen, Menü, Karte und Wybór na stronie.
 *
 * <b>0133 — wer einen Baustein nur für die Menschen eines Bereichs eingestellt
 * hat, behält das.</b> Das Dokument der Seite kennt diese Einstellung nicht;
 * ohne diesen Schritt nähme jeder Import einer Seite sie zurück, und Fotos
 * „nur für Teilnehmer" stünden öffentlich da.
 */

import { setPartConfig } from '../forms/form';
import { writeFormContent } from '../forms/formJson';
import { adoptMenuOf, saveMenu } from './menu';
import { loadModules, readConfig, updateModule } from '../modules/module';
import { loadPage, savePage, savePageLogic, savePageLook, savePageSubject, saveParts, type DraftPart } from './page';
import { planImport, referenceFieldsOf, replacing, sameConfig, type ImportOptions, type PageNow, type PagePlan } from './pageJson';
import { resolveReferences } from '../calendar/appointmentsJson';
import { loadCalendars, type CalendarRow } from '../calendar/calendar';
import { keysFor } from '../core/ringOf';
import { applyModuleWish } from '../modules/moduleImport';
import { keepOwn } from './part';
import { partOf } from './parts/registry';
import { count } from './event/kit';
import type { ImageChoice } from './ImageNeeds';
import { imageRef, uploadPageFile } from './pageImages';
import { previewImageNeeds, readImageNeeds, resolveImageNeeds } from './pageImageNeeds';
import { writeLook } from './slides/slideLook';
import { WorkspaceError, type Who } from '../core/session';

/** Die Seite, wie sie gerade ist — ohne Menü, Namen und Fragen (die holt der Export selbst). */
export type PageNowBase = Omit<PageNow, 'menu' | 'names' | 'forms'>;

/** Was der Mensch vor dem Import gewählt hat. */
export interface PageImportChoices {
  /** Fragen und Wymagania, die nicht im Dokument stehen, nehmen („Usuń pozostałe"). */
  readonly replaceQuestions: boolean;
  /** Wohin die Antworten neuer Fragen gehen — `null`: wie im Dokument, sonst der Bereich des Formulars. */
  readonly answersTo: string | null;
  /** Je Eingang der Termine des Dokuments: der Kalender, in den sie gehen. */
  readonly calendarFor: Readonly<Record<string, string>>;
  /** Je Datei, um die das Dokument bittet: was gewählt ist. */
  readonly imageFor: Readonly<Record<string, ImageChoice>>;
  /** 0133 — je Formular (Modul): Kennung im Dokument → Frage aus einem früheren Import; dazu Treffer nach Wortlaut. */
  readonly knownQuestions?: (moduleId: string) => ReadonlyMap<string, string> | undefined;
  readonly questionsByLabel?: boolean;
}

export interface PageImportHooks {
  readonly stage: (what: string) => void;
  /** Es wird gerade hochgeladen (die Auswahl der Dateien ruht solange). */
  readonly uploading?: (busy: boolean) => void;
  /** Eine Datei vom Gerät ist jetzt eine Datei der Seite — ein zweiter Versuch lädt sie nicht noch einmal. */
  readonly uploaded?: (key: string, choice: ImageChoice) => void;
  /**
   * 0133 — nach dem Plan, bevor etwas gespeichert wird: der Import eines Bereichs setzt
   * hier, welche Bausteine nur für seine Menschen sind, und räumt seine Hilfsplätze weg.
   */
  readonly adjust?: (plan: PagePlan) => PagePlan;
}

export interface PageImportResult {
  readonly lines: string[];
  readonly warnings: string[];
  /** Stelle auf der Seite → ihr Modul, wie gespeichert. */
  readonly moduleOf: ReadonlyMap<string, string>;
  /** Die Bausteine, wie sie gespeichert wurden. */
  readonly parts: readonly DraftPart[];
  /** Platzhalter („page-image:@schlüssel") → `page-image:<id>`. */
  readonly images: ReadonlyMap<string, string>;
  /** 0133 — je Formular (Modul): Kennung im Dokument → Frage, wie gespeichert. */
  readonly questions: ReadonlyMap<string, ReadonlyMap<string, string>>;
}

/** Der Plan, wie der Import ihn ausführt. */
export const planPage = (doc: unknown, now: PageNowBase, options: ImportOptions): PagePlan | { error: string } =>
  planImport(doc, { ...now, menu: null }, options);

/** Der Plan, wie ihn die Vorschau zeigt: gewählte Dateien als Platzhalter, fehlende leer — wie es der Import tun wird. */
export const planShownPage = (
  doc: unknown, now: PageNowBase, options: ImportOptions, imageFor: Readonly<Record<string, ImageChoice>>
): PagePlan | { error: string } => planPage(previewImageNeeds(doc, new Set(Object.keys(imageFor))), now, options);

/** 0133 — wer einen Baustein nur für die Menschen eines Bereichs eingestellt hat, behält das (das Dokument kennt es nicht). */
export function keepAudience(plan: PagePlan, before: readonly DraftPart[]): PagePlan {
  const audience = new Map(before.filter((p) => p.audienceAreaId != null).map((p) => [p.id, p.audienceAreaId!] as const));
  if (audience.size === 0) return plan;
  return {
    ...plan,
    parts: plan.parts.map((p) => {
      const was = audience.get(p.id);
      return p.audienceAreaId !== undefined || was === undefined ? p : { ...p, audienceAreaId: was };
    })
  };
}

/*
   2026-10-24 — DIE ERBETENEN DATEIEN, vor allem anderen: hochladen, was vom
   Gerät kommt, und überall einsetzen, wo `page-image:@schlüssel` steht. Ein
   Dokument, das sich nicht importieren lässt, lädt nichts hoch. Was
   hochgeladen ist, gilt danach als Datei der Seite — ein zweiter Versuch
   lädt es nicht noch einmal.
*/
export async function placeImages(input: {
  readonly path: string;
  readonly doc: unknown;
  readonly imageFor: Readonly<Record<string, ImageChoice>>;
  /** Der Plan, wie die Vorschau ihn zeigt — geht er nicht, wird nichts hochgeladen. */
  readonly check: (doc: unknown) => PagePlan | { error: string };
  readonly hooks: PageImportHooks;
}): Promise<{ doc: unknown; lines: string[]; warnings: string[]; refs: ReadonlyMap<string, string> }> {
  const { path, doc, imageFor, hooks } = input;
  const needs = readImageNeeds(doc);
  if (needs === undefined) return { doc, lines: [], warnings: [], refs: new Map() };
  const checked = input.check(doc);
  if ('error' in checked) throw new Error(checked.error);

  const refs = new Map<string, string>();
  const sending = needs.needs.filter((n) => imageFor[n.key]?.from === 'device').length;
  let sent = 0;
  hooks.uploading?.(true);
  try {
    for (const need of needs.needs) {
      const choice = imageFor[need.key];
      if (choice === undefined) continue;
      if (choice.from === 'page') {
        refs.set(need.key, imageRef(choice.id));
        continue;
      }
      hooks.stage(`Wgrywanie plików strony (${sent + 1}/${sending})…`);
      const made = await uploadPageFile(path, choice.file, choice.file.name, choice.type).catch((e: unknown) => {
        throw new WorkspaceError(`Plik „${need.label}” (${choice.file.name}): ${e instanceof WorkspaceError ? e.message : 'nie udało się wgrać.'}`
          + (sent > 0 ? ` Wgrane wcześniej (${sent}) są już w plikach strony — ponowny import ich nie powtórzy.` : ''));
      });
      sent += 1;
      refs.set(need.key, imageRef(made.id));
      hooks.uploaded?.(need.key, { from: 'page', id: made.id, name: choice.file.name, type: made.contentType });
    }
  } finally {
    hooks.uploading?.(false);
  }

  const resolved = resolveImageNeeds(doc, refs);
  const labelOf = (key: string) => needs.needs.find((n) => n.key === key)?.label ?? key;
  return {
    doc: resolved.doc,
    refs,
    lines: refs.size === 0 ? [] : [`Pliki strony: wgrane — ${sent}${refs.size > sent ? `, z plików strony — ${refs.size - sent}` : ''}; wstawione w ${count(resolved.placed, 'miejsce', 'miejsca', 'miejsc')}.`],
    warnings: resolved.missing.length === 0 ? [] : [`Bez pliku zostały puste miejsca: ${resolved.missing.map((key) => `„${labelOf(key)}”`).join(', ')} — plik dodasz w edytorze.`]
  };
}

/*
   2026-10-24 — DIE TERMINE EINTRAGEN, vor den Bausteinen: erst dann gibt es
   die Kennungen, auf die „@name" in ihren Tafeln zeigt. Gibt den Plan mit
   ersetzten Verweisen zurück.
*/
export async function placeAppointments(
  who: Who, done: PagePlan, calendarFor: Readonly<Record<string, string>>,
  stage: (what: string) => void, lines: string[], warnings: string[]
): Promise<PagePlan> {
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
}

/** DER IMPORT EINER SEITE — er speichert, in der Reihenfolge, in der die Teile aufeinander aufbauen. */
export async function runPageImport(input: {
  readonly who: Who;
  /** Die Seite, wie sie gerade ist (mit dem Entwurf des Editors). */
  readonly now: PageNowBase;
  readonly doc: unknown;
  readonly options: ImportOptions;
  readonly choices: PageImportChoices;
  readonly hooks: PageImportHooks;
}): Promise<PageImportResult> {
  const { who, now, options, choices, hooks } = input;
  const { stage } = hooks;
  const path = now.path;

  /* 2026-10-24 — erst die erbetenen Dateien, dann der Plan mit ihren echten Kennungen. */
  const images = await placeImages({
    path, doc: input.doc, imageFor: choices.imageFor, hooks,
    check: (doc) => planShownPage(doc, now, options, choices.imageFor)
  });
  const planned = planPage(images.doc, now, options);
  if ('error' in planned) throw new Error(planned.error);
  const warnings = [...planned.warnings, ...images.warnings];
  const lines = [...images.lines, ...planned.lines];

  /* 2026-10-24 — die Termine zuerst: die Bausteine zeigen dann auf ihre echten Kennungen. */
  const placed = keepAudience(await placeAppointments(who, planned, choices.calendarFor, stage, lines, warnings), now.parts);
  const done = hooks.adjust === undefined ? placed : hooks.adjust(placed);

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

  const questions = new Map<string, ReadonlyMap<string, string>>();
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
          const applied = await applyModuleWish(who, module, wish, {
            replace: choices.replaceQuestions, answersTo: choices.answersTo, stage,
            known: choices.knownQuestions?.(moduleId), byLabel: choices.questionsByLabel
          });
          if (applied.ids.size > 0) questions.set(moduleId, applied.ids);
          lines.push(...applied.lines.map((line) => `Formularz ${name}: ${line}`));
          warnings.push(...applied.warnings);
        } else if (wish.questions !== undefined || wish.design !== undefined) {
          /* Ein Modul, das die Liste (noch) nicht kennt: wenigstens Fragen und Aufbau. */
          const written = await writeFormContent(who, { moduleId, areaId: null }, { questions: wish.questions, design: wish.design },
            { replace: choices.replaceQuestions, answersTo: choices.answersTo, onStage: stage, known: choices.knownQuestions?.(moduleId), byLabel: choices.questionsByLabel });
          if (written.ids.size > 0) questions.set(moduleId, written.ids);
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

  return { lines, warnings, moduleOf, parts, images: images.refs, questions };
}
