/**
 * 0086 — WYMAGANIA EIN-, UM- UND AUSSCHALTEN. Was ein Wymaganie ist — seine
 * Wortlaute, Einstellungen, Gestalt und der Plan, wie es hineinkommt — steht
 * in `needs.ts` (ohne Netz); hier geschieht es: Fragen anlegen, zurückholen
 * und nehmen, Aufbau und Logik versiegeln, die Einstellung `needs` des
 * Formulars, der Schritt der Kanzlei.
 *
 * <b>2026-10-24 — UMSTELLEN UND ÜBERNEHMEN.</b> Ein eingeschaltetes Wymaganie
 * lässt sich umstellen (`reshapeNeed`): was beide Fassungen brauchen, bleibt
 * mit seinen Antworten an seinem Platz. Und ein JSON-Dokument kann Wymagania
 * mitbringen (`importNeeds`): mit dem, was sie im Formular hielten (`holds`),
 * werden die mitgebrachten Fragen, Gruppen und Knoten übernommen statt ein
 * zweites Mal angelegt; ohne es legt das Wymaganie selbst alles an.
 */

import { loadAreas, myEpochKeys } from '../areas/area';
import { readFormContent, writeFormContent } from './formJson';
import { removeField, restoreField, setPartConfig } from './form';
import { type FormDesign } from './formDesign';
import { newId } from '../core/ids';
import { loadModules, type ModuleRow } from '../modules/module';
import { keysFor } from '../core/ringOf';
import { WorkspaceError, type Who } from '../core/session';
import { openStepInfo } from './entryDesk';
import { saveSteps, type StepDraft } from '../steps/steps';
import { choiceWords, needOf, sameChoice, type FormNeed, type NeedChoice } from './needs';
import {
  adoptedOf, choiceOfOn, holdingOf, layoutWithout, logicWithout, needsJson, paperAfter, planNeed, readNeeds, type NeedOn
} from './needPlan';
import type { NeedWish } from './needsJson';

/** Das Modul, an dem es geschieht — so viel braucht es davon. */
type FormModule = Pick<ModuleRow, 'moduleId' | 'areaId' | 'extendsId'>;

export interface NeedResult {
  /** Neu angelegte Fragen. */
  readonly added: number;
  /** Vorhandene Fragen, die es zum ersten Mal mitbenutzt. */
  readonly reused: number;
  /** Fragen, die es nicht mehr braucht: gelöscht (ohne Antworten) und vom Formular genommen (mit). */
  readonly removed: number;
  readonly kept: number;
  readonly warnings: readonly string[];
  /** Die Einstellungen des Formulars danach. */
  readonly config: Record<string, string>;
}

/** Fragen nehmen — ohne Antworten gelöscht, mit Antworten vom Formular genommen (0086). */
async function takeOff(fields: readonly string[], warnings: string[], onStage?: (what: string) => void): Promise<{ removed: number; kept: number }> {
  let removed = 0;
  let kept = 0;
  for (const id of fields) {
    onStage?.('Usuwanie pytań wymagania…');
    try {
      const done = await removeField(id);
      if (done.kept === true) kept += 1; else removed += 1;
    } catch (e) {
      /* Schon von Hand entfernt — nichts zu tun. Sonst sagen, was blieb. */
      if (!(e instanceof WorkspaceError && /nie ma/i.test(e.message))) {
        warnings.push(`Pytanie ${id.slice(0, 8)} zostaje: ${e instanceof WorkspaceError ? e.message : 'nie udało się usunąć'}.`);
      }
    }
  }
  return { removed, kept };
}

/**
 * EIN WYMAGANIE INS FORMULAR — eingeschaltet (`now: null`), umgestellt oder aus
 * einem Dokument übernommen (`now`: was es hält). Der Plan (`planNeed`) sagt,
 * was geschieht; hier geschieht es, in der Reihenfolge, in der es nichts
 * sperrt: zurückholen, anlegen und versiegeln, die Einstellung (und mit ihr die
 * Sperre) neu, DANN nehmen, was nicht mehr gebraucht wird, zuletzt der Schritt.
 */
async function placeNeed(
  who: Who, module: FormModule, need: FormNeed, choice: NeedChoice, answersTo: string | null,
  config: Readonly<Record<string, string>>, now: NeedOn | null, onStage?: (what: string) => void
): Promise<NeedResult> {
  const before = readNeeds(config.needs);

  /* Ein Formular, das eben erst einen Bereich bekam (ein Import), steht in der alten Zeile noch ohne. */
  const row: FormModule = module.areaId !== null ? module
    : (await loadModules()).modules.find((m) => m.moduleId === module.moduleId) ?? module;

  onStage?.('Czytanie formularza…');
  const content = await readFormContent(who, row.moduleId);
  if (content.unread > 0) throw new WorkspaceError('Części pytań tego formularza nie da się odczytać — wymaganie mogłoby je zdublować. Otwórz formularz z kluczem jego obszaru.');

  const plan = planNeed({ need, choice, content, now, others: before.filter((one) => one.id !== need.id) });

  /*
   * Neue Fragen brauchen einen Bereich für ihre Antworten, Aufbau und Logik den
   * des Formulars (unter seinem Schlüssel liegen sie) — ohne ihn entstünde ein
   * Wymaganie ohne Fragen oder ohne Logik. Ein Formular ohne Fragen bekommt den
   * gewählten Bereich (`writeFormContent`); eines mit Fragen nicht.
   */
  const target = answersTo ?? row.areaId ?? content.questions.find((q) => q.answersTo !== '')?.answersTo ?? null;
  if (plan.created.length > 0 && target === null) {
    throw new WorkspaceError('Najpierw wybierz obszar, do którego trafiają odpowiedzi — bez niego pytania wymagania nie powstaną.');
  }
  if (row.areaId === null && (content.questions.length > 0 || answersTo === null)) {
    throw new WorkspaceError('Formularz nie ma jeszcze własnego obszaru — ustaw go w zakładce „Ustawienia”; pod jego kluczem leżą układ i logika wymagania.');
  }

  for (const id of plan.restore) {
    onStage?.('Przywracanie pytań…');
    await restoreField(id);
  }

  const written = await writeFormContent(who, { moduleId: row.moduleId, areaId: row.areaId }, { questions: plan.questions, design: plan.design },
    { replace: false, answersTo, onStage });
  const warnings = [...written.warnings];

  const created = new Set(plan.created);
  const missing = plan.created.filter((id) => !written.ids.has(id)).length;
  if (missing > 0) warnings.push(`Nie powstało pytań wymagania: ${missing} — spróbuj jeszcze raz albo dodaj je ręcznie.`);
  const real = (id: string): string | undefined => (created.has(id) ? written.ids.get(id) : id);

  const { set, paper } = paperAfter(need, plan.shape, now, config);
  const on = holdingOf(need, choice, plan, real, paper);
  set.needs = needsJson(before.some((one) => one.id === need.id) ? before.map((one) => (one.id === need.id ? on : one)) : [...before, on]);

  onStage?.('Zapisywanie wymagań formularza…');
  const saved = (await setPartConfig(row.moduleId, set)).config;

  /* Erst jetzt, ohne Sperre: was die neue Fassung nicht mehr braucht. */
  const gone = await takeOff(plan.leaving, warnings, onStage);

  const step = plan.shape.step;
  if (step !== undefined) {
    try {
      onStage?.('Dodawanie kroku dla koordynatora…');
      /* Der Bereich kann eben erst entstanden sein (das erste Wymaganie eines neuen Formulars). */
      const base = row.areaId !== null ? row : (await loadModules()).modules.find((m) => m.moduleId === row.moduleId) ?? row;
      await addOfficeStep(who, base, step);
    } catch (e) {
      warnings.push(`Krok „${step}” nie powstał: ${e instanceof WorkspaceError ? e.message : 'nie udało się'} — dodasz go w zakładce „Znaczniki”.`);
    }
  }

  const back = plan.restore.length;
  if (back > 0) warnings.push(`Wróciły do formularza pytania zdjęte wcześniej (${back}) — razem z odpowiedziami.`);
  return { added: plan.created.length - missing, reused: plan.reused, removed: gone.removed, kept: gone.kept, warnings, config: saved };
}

/**
 * EIN WYMAGANIE EINSCHALTEN — mit diesen Einstellungen. Fragen ans Ende,
 * Gruppen und Logik zu dem, was schon da ist (nicht statt dessen), die Regel
 * „do podpisu", der Schritt der Kanzlei — und in `config.needs`, was es hält.
 */
export async function applyNeed(
  who: Who, module: FormModule, need: FormNeed, choice: NeedChoice, answersTo: string | null,
  config: Readonly<Record<string, string>>, onStage?: (what: string) => void
): Promise<NeedResult> {
  if (readNeeds(config.needs).some((one) => one.id === need.id)) throw new WorkspaceError(`„${need.label}” jest już włączone.`);
  return placeNeed(who, module, need, choice, answersTo, config, null, onStage);
}

/**
 * 2026-10-24 — EIN EINGESCHALTETES WYMAGANIE UMSTELLEN: andere Einstellungen,
 * dieselben Antworten. Was beide Fassungen brauchen, bleibt, wo es ist.
 */
export async function reshapeNeed(
  who: Who, module: FormModule, needId: string, choice: NeedChoice, answersTo: string | null,
  config: Readonly<Record<string, string>>, onStage?: (what: string) => void
): Promise<NeedResult> {
  const need = needOf(needId);
  const now = readNeeds(config.needs).find((one) => one.id === needId);
  if (need === undefined || now === undefined) throw new WorkspaceError('To wymaganie nie jest włączone.');
  if (sameChoice(need, choiceOfOn(now), choice)) return { added: 0, reused: 0, removed: 0, kept: 0, warnings: [], config: { ...config } };
  return placeNeed(who, module, need, choice, answersTo, config, now, onStage);
}

/* -- Ausschalten --------------------------------------------------------------------- */

export interface NeedDropped {
  /** Ganz gelöscht (ohne Antworten). */
  readonly removed: number;
  /** Vom Formular genommen — ihre Antworten bleiben in den Zgłoszenia. */
  readonly kept: number;
  readonly warnings: readonly string[];
  readonly config: Record<string, string>;
}

/**
 * EIN WYMAGANIE AUSSCHALTEN. Erst die Sperre (sonst lehnte der Dienst das
 * Entfernen ab), dann seine eigenen Fragen — die, die noch ein anderes
 * eingeschaltetes Wymaganie braucht, bleiben —, dann seine Gruppen und Logik.
 * Der Schritt der Kanzlei bleibt: an ihm hängen vielleicht schon Häkchen.
 */
export async function dropNeed(
  who: Who, module: FormModule, needId: string,
  config: Readonly<Record<string, string>>, onStage?: (what: string) => void
): Promise<NeedDropped> {
  const before = readNeeds(config.needs);
  const gone = before.find((one) => one.id === needId);
  if (gone === undefined) throw new WorkspaceError('To wymaganie nie jest włączone.');
  const rest = before.filter((one) => one.id !== needId);

  const set: Record<string, string> = { needs: needsJson(rest) };
  const need = needOf(needId);
  if (gone.paper === true && need !== undefined && need.papers.includes((config.paper ?? '').trim())) {
    set.paper = '';
    if ((config.paperSigner ?? '') === (need.shape(choiceOfOn(gone)).signer ?? '')) set.paperSigner = '';
  }
  onStage?.('Zapisywanie wymagań formularza…');
  const saved = (await setPartConfig(module.moduleId, set)).config;

  const still = new Set(rest.flatMap((one) => one.fields));
  const leaving = gone.added.filter((id) => !still.has(id));
  const warnings: string[] = [];
  const { removed, kept } = await takeOff(leaving, warnings, onStage);

  /* Der Aufbau und die Logik ohne das, was es mitgebracht hat. */
  const now = await readFormContent(who, module.moduleId);
  if (now.design !== null) {
    const logic = logicWithout(now.design, new Set(gone.nodes), new Set(gone.edges));
    const design: FormDesign = {
      ...now.design,
      layout: layoutWithout(now.design.layout, new Set(gone.items), new Set(leaving)),
      nodes: logic.nodes,
      edges: logic.edges
    };
    if (JSON.stringify(design) !== JSON.stringify(now.design)) {
      onStage?.('Zapisywanie układu…');
      const written = await writeFormContent(who, { moduleId: module.moduleId, areaId: module.areaId }, { design },
        { replace: false, answersTo: null, onStage });
      warnings.push(...written.warnings);
    }
  }

  return { removed, kept, warnings, config: saved };
}

/* -- Aus einem Dokument (JSON, 2026-10-24) --------------------------------------------- */

export interface NeedsImported {
  readonly lines: readonly string[];
  readonly warnings: readonly string[];
  readonly config: Record<string, string>;
}

/**
 * DIE WYMAGANIA EINES DOKUMENTS AN EIN FORMULAR — nachdem seine Fragen und sein
 * Aufbau geschrieben sind (`ids`: Kennung im Dokument → Kennung hier, wie
 * `writeFormContent` sie zurückgibt).
 *
 * <code>
 *   schon eingeschaltet, gleiche Einstellungen   nichts
 *   schon eingeschaltet, andere                   umstellen
 *   nicht eingeschaltet, mit "holds"              übernehmen, was das Dokument mitbrachte, und ergänzen
 *   nicht eingeschaltet, ohne                     einschalten wie von Hand
 *   eingeschaltet, nicht im Dokument              bleibt — ausser `replace` (dann aus)
 * </code>
 */
export async function importNeeds(who: Who, module: FormModule, wishes: readonly NeedWish[], options: {
  readonly ids: ReadonlyMap<string, string>;
  readonly config: Readonly<Record<string, string>>;
  readonly replace: boolean;
  readonly answersTo: string | null;
  readonly onStage?: (what: string) => void;
}): Promise<NeedsImported> {
  const lines: string[] = [];
  const warnings: string[] = [];
  let config: Record<string, string> = { ...options.config };
  /* Was dieser Import neu anlegte — nur das darf ein übernommenes Wymaganie wieder nehmen. */
  const created = new Set([...options.ids].filter(([doc, here]) => doc !== here).map(([, here]) => here));
  const summary = (done: NeedResult) => [
    done.added > 0 ? `nowe pytania — ${done.added}` : '',
    done.removed + done.kept > 0 ? `zdjęte — ${done.removed + done.kept}` : ''
  ].filter((part) => part !== '').join(', ');

  for (const wish of wishes) {
    const need = needOf(wish.id);
    if (need === undefined) continue;
    const on = readNeeds(config.needs).find((one) => one.id === wish.id);
    try {
      if (on !== undefined) {
        if (sameChoice(need, choiceOfOn(on), wish.choice)) continue;
        const done = await placeNeed(who, module, need, wish.choice, options.answersTo, config, on, options.onStage);
        config = done.config;
        warnings.push(...done.warnings);
        lines.push(`Wymaganie „${need.label}”: nowe ustawienia — ${choiceWords(need, wish.choice)}${summary(done) === '' ? '' : ` (${summary(done)})`}.`);
        continue;
      }
      let adopted: NeedOn | null = null;
      if (wish.holds !== undefined) {
        const content = await readFormContent(who, module.moduleId);
        adopted = adoptedOf(need, wish.holds, options.ids, created, content);
        if (adopted === null) warnings.push(`Wymaganie „${need.label}”: tego, co trzymało ("holds"), nie ma w formularzu — dodane od nowa.`);
      }
      const done = await placeNeed(who, module, need, wish.choice, options.answersTo, config, adopted, options.onStage);
      config = done.config;
      warnings.push(...done.warnings);
      lines.push(`Wymaganie „${need.label}” włączone${adopted === null ? '' : ' (z pytaniami z dokumentu)'}${summary(done) === '' ? '' : `: ${summary(done)}`}.`);
    } catch (e) {
      warnings.push(`Wymaganie „${need.label}”: ${e instanceof WorkspaceError ? e.message : e instanceof Error ? e.message : 'nie udało się'}.`);
    }
  }

  if (options.replace) {
    for (const on of readNeeds(config.needs).filter((one) => !wishes.some((w) => w.id === one.id))) {
      try {
        const done = await dropNeed(who, module, on.id, config, options.onStage);
        config = done.config;
        warnings.push(...done.warnings);
        lines.push(`Wymaganie „${on.label}” wyłączone.`);
      } catch (e) {
        warnings.push(`Wymaganie „${on.label}”: ${e instanceof WorkspaceError ? e.message : 'nie udało się wyłączyć'}.`);
      }
    }
  }

  return { lines, warnings, config };
}

/* -- Der Schritt der Kanzlei ------------------------------------------------------------- */

const localDay = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Ein Schritt, den die Kanzlei abhakt — am HAUPTformular (eine Erweiterung hat
 * keine eigenen Schritte). Alle vorhandenen bleiben; ist er schon da, nichts.
 */
async function addOfficeStep(who: Who, module: FormModule, label: string): Promise<void> {
  const baseId = module.extendsId ?? module.moduleId;
  const base = module.extendsId === null ? module : (await loadModules()).modules.find((m) => m.moduleId === baseId);
  if (base === undefined || base.areaId === null) throw new WorkspaceError('formularz główny nie ma własnego obszaru');

  const { ring } = await keysFor(who);
  if (ring === null) throw new WorkspaceError('bez hasła nie da się zapieczętować kroku');

  const info = await openStepInfo(baseId, ring);
  if (info.steps.some((one) => one.label === label)) return;
  if (info.steps.some((one) => one.label === null)) throw new WorkspaceError('nie wszystkie kroki da się odczytać');

  const area = (await loadAreas()).areas.find((a) => a.areaId === base.areaId);
  const key = area === undefined ? undefined : (await myEpochKeys(ring, area.areaId)).get(area.currentEpoch);
  if (area === undefined || key === undefined) throw new WorkspaceError('brak klucza obszaru formularza');

  const drafts: StepDraft[] = [
    ...info.steps.map((one): StepDraft => ({
      stepId: one.stepId, label: one.label!, help: one.help ?? '', doneBy: one.doneBy,
      visibleToPerson: one.visibleToPerson, dueAt: one.dueAt === null ? '' : localDay(one.dueAt)
    })),
    { stepId: newId(), label, help: 'Koordynator odhacza, gdy dostanie podpisany wydruk.', doneBy: 'office', visibleToPerson: true, dueAt: '' }
  ];

  await saveSteps(baseId, drafts, { areaId: area.areaId, epoch: area.currentEpoch, key });
}
