/**
 * DIE SCHRITTE EINES MENSCHEN (0047) — was er noch tun muss, und was die
 * Kanzlei noch abhaken muss.
 *
 * <b>Zwei Sorten, und sie entstehen verschieden:</b>
 *
 * <code>
 *   von selbst   die Durchsicht der Angaben (0046) — wo es einen Link gibt
 *                je Erweiterung, die der Mensch ausfüllt: „Uzupełnij: …"
 *                je Erweiterung, die die Kanzlei ausfüllt (nur sie sieht es)
 *   von Hand     „Przynieś zgodę rodzica", „Quiz" — die Kanzlei legt sie an
 *                und sagt, wer abhakt: sie selbst oder der Mensch
 * </code>
 *
 * Die von selbst stehen nirgends: sie folgen aus dem, was es gibt. Wer eine
 * Erweiterung anlegt, hat damit auch ihren Schritt angelegt.
 *
 * <b>Ob ein Schritt erledigt ist, rechnet EINE Funktion</b> (`stepsFor`) — bei
 * der Kanzlei und beim Menschen dieselbe. Der Dienst liefert nur, was er
 * ohnehin weiss (welche Einsendungen es gibt, was abgehakt ist); lesen kann
 * er davon nichts.
 */

import { aad, Field, fromBase64Url, openText, sealText, toBase64Url } from './crypto';
import type { StepMark } from './form';
import { call } from './session';

export type DoneBy = 'office' | 'person';

/** Ein von Hand angelegter Schritt, wie der Dienst ihn hält — die Beschriftung versiegelt. */
export interface SealedStep {
  readonly stepId: string;
  readonly position: number;
  readonly areaId: string;
  readonly epoch: number;
  readonly labelSealed: string;
  readonly helpSealed: string | null;
  readonly doneBy: DoneBy;
  readonly visibleToPerson: boolean;
  readonly dueAt: string | null;
}

export interface OpenStep extends SealedStep {
  /** `null`: der Schlüssel des Formulars liegt nicht offen. */
  readonly label: string | null;
  readonly help: string | null;
}

/** Eine Erweiterung, aus der sich ein Schritt von selbst ergibt. */
export interface ExtensionInfo {
  readonly moduleId: string;
  readonly name: string;
  readonly audience: 'person' | 'office';
  readonly closed: boolean;
}

/* -- Die Etiketten ------------------------------------------------------------ */

const labelAad = (stepId: string) => aad('form', 'step', stepId, Field.StepLabel, 1);
const helpAad = (stepId: string) => aad('form', 'step', stepId, Field.StepHelp, 1);

/** Aufmachen — mit dem Schlüssel des Formularbereichs in der Epoche, mit der versiegelt wurde. */
export async function openSteps(
  steps: readonly SealedStep[],
  keyOf: (areaId: string, epoch: number) => Uint8Array | undefined
): Promise<readonly OpenStep[]> {
  const out: OpenStep[] = [];

  for (const one of steps) {
    const key = keyOf(one.areaId, one.epoch);

    const label = key === undefined ? null
      : await openText(key, labelAad(one.stepId), fromBase64Url(one.labelSealed)).catch(() => null);
    const help = key === undefined || one.helpSealed === null ? null
      : await openText(key, helpAad(one.stepId), fromBase64Url(one.helpSealed)).catch(() => null);

    out.push({ ...one, label, help });
  }

  return out;
}

/* -- Beim Dienst ---------------------------------------------------------------- */

export const loadSteps = (partId: string): Promise<{
  steps: readonly SealedStep[];
  extensions: readonly ExtensionInfo[];
}> => call(`/workspace/part/${encodeURIComponent(partId)}/steps`);

/** Ein Schritt, wie ihn die Kanzlei gerade bearbeitet — offen. */
export interface StepDraft {
  readonly stepId: string;
  readonly label: string;
  readonly help: string;
  readonly doneBy: DoneBy;
  readonly visibleToPerson: boolean;

  /** `YYYY-MM-DD` oder leer. */
  readonly dueAt: string;
}

/**
 * Die von Hand angelegten Schritte speichern — ALLE, in dieser Reihenfolge,
 * versiegelt unter dem Schlüssel des Formularbereichs. Was fehlt, geht,
 * samt seinen Haken.
 */
export async function saveSteps(
  partId: string, drafts: readonly StepDraft[],
  formKey: { readonly areaId: string; readonly epoch: number; readonly key: Uint8Array }
): Promise<{ steps: readonly SealedStep[] }> {
  const steps = await Promise.all(drafts.map(async (one) => ({
    stepId: one.stepId,
    areaId: formKey.areaId,
    epoch: formKey.epoch,
    labelSealed: toBase64Url(await sealText(formKey.key, labelAad(one.stepId), one.label.trim())),
    helpSealed: one.help.trim() === ''
      ? null
      : toBase64Url(await sealText(formKey.key, helpAad(one.stepId), one.help.trim())),
    doneBy: one.doneBy,
    visibleToPerson: one.doneBy === 'person' || one.visibleToPerson,
    /* Bis zum Ende des Tages — „do 15 sierpnia" heisst: auch am 15. noch. */
    dueAt: one.dueAt === '' ? null : new Date(`${one.dueAt}T23:59:59`).toISOString()
  })));

  return call(`/workspace/part/${encodeURIComponent(partId)}/steps`, {
    method: 'POST',
    body: JSON.stringify({ steps })
  });
}

/** Die Kanzlei hakt ab — oder nimmt den Haken weg. */
export const markStep = (registrationId: string, stepId: string, done: boolean): Promise<{ doneAt: string | null }> =>
  call(`/workspace/registration/${encodeURIComponent(registrationId)}/step`, {
    method: 'POST',
    body: JSON.stringify({ stepId, done })
  });

/** Der Mensch hakt selbst ab — nur, was er selbst abhaken soll. */
export const markOwnStep = (
  token: string, registrationId: string, stepId: string, done: boolean
): Promise<{ doneAt: string | null }> =>
  call(`/seat/${encodeURIComponent(token)}/step`, {
    method: 'POST',
    body: JSON.stringify({ registrationId, stepId, done })
  });

/* -- Was der Platz bekommt ---------------------------------------------------------- */

/**
 * Je Einsendung des Platzes, die keine Ergänzung ist: was der Mensch noch tun
 * muss. Nur, was ER ausfüllt und sieht — von dem der Kanzlei kommt nichts.
 */
export interface SeatFormSealed {
  readonly formId: string;
  readonly registrationId: string;
  readonly confirmedAt: string | null;
  readonly extensions: readonly {
    readonly moduleId: string;
    readonly name: string;
    readonly closed: boolean;
    /** Seine Ergänzung — oder `null`: noch nicht ausgefüllt. */
    readonly registrationId: string | null;
  }[];
  readonly steps: readonly SealedStep[];
  readonly marks: readonly StepMark[];
}

export interface SeatForm extends Omit<SeatFormSealed, 'steps'> {
  readonly steps: readonly OpenStep[];
}

/* -- Die EINE Rechnung --------------------------------------------------------------- */

export type StepStatus = 'done' | 'todo' | 'overdue';

export interface StepState {
  /** `confirm`, `ext:<Formular>` oder `step:<Schritt>` — beständig, zum Filtern. */
  readonly key: string;
  readonly label: string;
  readonly help: string | null;

  /** Von selbst entstanden, oder von Hand angelegt. */
  readonly source: 'auto' | 'hand';

  /** Wer handelt: der Mensch, oder die Kanzlei. */
  readonly doneBy: DoneBy;
  readonly visibleToPerson: boolean;

  readonly status: StepStatus;
  readonly doneAt: string | null;
  readonly dueAt: string | null;

  /** „Uzupełnij": welche Erweiterung. */
  readonly extensionId: string | null;

  /** Ein von Hand angelegter Schritt: welcher. */
  readonly stepId: string | null;
}

/**
 * Wie es um die Schritte EINES Menschen steht.
 *
 * <b>Überfällig</b> ist, was nicht erledigt ist und dessen Frist vorbei ist —
 * erledigt ist erledigt, auch wenn es spät kam.
 */
export function stepsFor(input: {
  /** Ob es einen Link gibt — ohne ihn gibt es nichts durchzusehen. */
  readonly hasSeat: boolean;
  readonly confirmedAt: string | null;
  readonly extensions: readonly { readonly moduleId: string; readonly name: string; readonly audience: 'person' | 'office' }[];

  /** Welche Erweiterungen ausgefüllt sind — Erweiterung → wann. */
  readonly filled: ReadonlyMap<string, string>;
  readonly steps: readonly OpenStep[];
  readonly marks: readonly StepMark[];
  readonly now?: Date;
}): readonly StepState[] {
  const now = input.now ?? new Date();
  const out: StepState[] = [];

  const state = (doneAt: string | null, dueAt: string | null): StepStatus =>
    doneAt !== null ? 'done' : dueAt !== null && new Date(dueAt) < now ? 'overdue' : 'todo';

  if (input.hasSeat) {
    out.push({
      key: 'confirm',
      label: 'Sprawdzenie i potwierdzenie danych',
      help: 'Po otwarciu linku osoba przegląda swoje dane — zwłaszcza kontakty — i potwierdza je jednym przyciskiem.',
      source: 'auto', doneBy: 'person', visibleToPerson: true,
      status: state(input.confirmedAt, null), doneAt: input.confirmedAt, dueAt: null,
      extensionId: null, stepId: null
    });
  }

  for (const ext of input.extensions) {
    const at = input.filled.get(ext.moduleId) ?? null;
    const person = ext.audience === 'person';

    out.push({
      key: `ext:${ext.moduleId}`,
      label: person ? `Uzupełnij: ${ext.name}` : ext.name,
      help: person ? null : 'Wypełnia koordynator — osoba tego nie widzi.',
      source: 'auto', doneBy: person ? 'person' : 'office', visibleToPerson: person,
      status: state(at, null), doneAt: at, dueAt: null,
      extensionId: ext.moduleId, stepId: null
    });
  }

  for (const one of input.steps) {
    const mark = input.marks.find((m) => m.stepId === one.stepId) ?? null;

    out.push({
      key: `step:${one.stepId}`,
      label: one.label ?? 'Krok (zapieczętowany)',
      help: one.help,
      source: 'hand', doneBy: one.doneBy, visibleToPerson: one.visibleToPerson,
      status: state(mark?.doneAt ?? null, one.dueAt), doneAt: mark?.doneAt ?? null, dueAt: one.dueAt,
      extensionId: null, stepId: one.stepId
    });
  }

  return out;
}

/** Wie viele erledigt sind — und ob etwas überfällig ist. */
export function progressOf(states: readonly StepState[]): { done: number; total: number; overdue: number } {
  return {
    done: states.filter((s) => s.status === 'done').length,
    total: states.length,
    overdue: states.filter((s) => s.status === 'overdue').length
  };
}

/** Eine Frist, lesbar. */
export const dueText = (dueAt: string): string =>
  new Date(dueAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
