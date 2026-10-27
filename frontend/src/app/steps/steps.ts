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

import { declinedAll, phaseOf, progressOf as taskProgressOf, type TaskPhase } from './candidateTasks';
import { aad, Field, fromBase64Url, openText, sealText, toBase64Url } from '../core/crypto';
import type { StepMark } from '../forms/submissions';
import { openFormNames, type FormNameIn } from '../core/names';
import { repeatOf, roundLabel, roundOf, type Repeat } from '../forms/rounds';
import { call } from '../core/session';

export type DoneBy = 'office' | 'person';

/**
 * 0098 — WAS FÜR EIN SCHRITT: ein Znacznik (einmal abgehakt) oder eine
 * AUFGABE mit Zeitraum, zu der der Mensch selbst etwas sagt (`candidateTasks.ts`).
 * 0109 — oder „Naucz się": erledigt, sobald er die Karten einer Bibliothek bis
 * zur Schwelle kann (`cogita/LearnStep.tsx`).
 */
export type StepKind = 'mark' | 'task' | 'booking' | 'chat' | 'learn';

/** 0109 — „Naucz się": aus welcher Bibliothek, welche Powtórka (`null`: alle Karten), bis zu welcher Kenntnis (0..1). */
export interface LearnTarget {
  readonly libraryId: string | null;
  readonly revisionId: string | null;
  readonly threshold: number;
}

/**
 * 0102 — „PRZECZYTAJ WIADOMOŚCI": in welchen Rozmowy des Menschen nichts
 * Ungelesenes liegen soll — in jeder, in denen mit den Prowadzący (jeden na
 * jeden), in der seiner Gruppe (razem) oder im Kanał; an einem Bereich, oder
 * an jedem (`areaId: null`).
 */
export type ChatTargetKind = 'all' | 'seat' | 'area' | 'channel';

export interface ChatTarget {
  readonly kind: ChatTargetKind;
  readonly areaId: string | null;
  /** Wie der Bereich heisst — der Name hängt aus, wie in der Liste der Rozmowy. */
  readonly areaName: string | null;
}

/** „…w kanale „Bierzmowanie"" — wo die Wiadomości liegen, für den Menschen und die Kanzlei. */
export function chatTargetText(target: ChatTarget): string {
  const at = target.areaName === null ? null : `„${target.areaName}"`;
  switch (target.kind) {
    case 'seat': return at === null ? 'w rozmowach z prowadzącymi' : `w rozmowie z prowadzącymi ${at}`;
    case 'area': return at === null ? 'w rozmowach grup' : `w rozmowie grupy ${at}`;
    case 'channel': return at === null ? 'w kanałach' : `w kanale ${at}`;
    default: return at === null ? 'we wszystkich rozmowach' : `we wszystkich rozmowach ${at}`;
  }
}

/** Ob eine Rozmowa seines Platzes zu dem gehört, was der Schritt meint. */
export const chatMatches = (target: Pick<ChatTarget, 'kind' | 'areaId'>, row: { readonly kind?: string; readonly areaId: string }): boolean =>
  (target.kind === 'all' || (row.kind ?? 'area') === target.kind) && (target.areaId === null || row.areaId === target.areaId);

/** Wie viele Wiadomości dort ungelesen liegen — aus seiner Liste der Rozmowy (`/seat/…/chats`). */
export const unreadIn = (
  target: Pick<ChatTarget, 'kind' | 'areaId'>,
  rows: readonly { readonly kind?: string; readonly areaId: string; readonly unread?: number }[]
): number => rows.filter((row) => chatMatches(target, row)).reduce((sum, row) => sum + (row.unread ?? 0), 0);

/**
 * 0098 — wann eine Aufgabe gilt: einmal in beliebigem Tag, jeden Tag, an
 * Wochentagen; 0099 — an den TERMINEN eines Kalendereintrags (`item`): eine
 * Reihe von Treffen, ein Fest, das Nabożeństwo der Pfarrei.
 */
export type TaskSchedule = 'any' | 'daily' | 'weekly' | 'item';

/** 0099 — ein Termin der Aufgabe, wie der Dienst ihn aus dem Kalender rechnet. */
export interface TaskDate {
  /** Der Tag, an dem er beginnt (YYYY-MM-DD, dort, wo der Kalender ist). */
  readonly day: string;
  readonly startsAt: string;
  readonly endsAt: string;
}

/** 0099 — eine Funktion in den Terminen („Krzyż", „Świece"), die wählt, wer kommt; versiegelt wie die Aufgabe. */
export interface SealedDuty {
  readonly dutyId: string;
  readonly position: number;
  readonly areaId: string;
  readonly epoch: number;
  readonly labelSealed: string;
  /** Wie viele sie nehmen können — `null`: beliebig viele. */
  readonly capacity: number | null;
}

/** 0099 — eine Funktion, geöffnet. */
export interface TaskDuty {
  readonly dutyId: string;
  /** `null`: der Schlüssel des Formulars liegt nicht offen. */
  readonly label: string | null;
  readonly capacity: number | null;
}

/** 0099 — wie voll eine Funktion an einem Termin ist (nur die Zahl). */
export interface DutyTaken {
  readonly stepId: string;
  readonly day: string;
  readonly dutyId: string;
  readonly count: number;
}

/** 0098 — der Plan einer Aufgabe, wie der Dienst ihn hält (Tage als YYYY-MM-DD). */
export interface TaskPlan {
  readonly startsOn: string;
  readonly endsOn: string;
  readonly schedule: TaskSchedule;
  /** Bits: pn 1, wt 2, śr 4, czw 8, pt 16, sob 32, ndz 64 — nur bei `weekly`. */
  readonly weekdays: number | null;
  /** Die Uhrzeit, um nachzuschlagen, wann man hingeht (Minuten nach Mitternacht), und wie lange. */
  readonly atMinute: number | null;
  readonly minutes: number | null;
  /** Wie viele Tage es braucht, damit sie erfüllt ist (fehlt: 1). */
  readonly needed: number | null;
  /** Ab wann der Mensch sie sieht (fehlt: ab Beginn) und bis wann er Tage einträgt (fehlt: 7 Tage nach Ende). */
  readonly showFrom: string | null;
  readonly reportUntil: string | null;

  /** 0099 — an Terminen: welcher Kalendereintrag (und sein Kalender), ob VORHER gefragt wird, die Termine, die Funktionen. */
  readonly itemId?: string | null;
  readonly calendarId?: string | null;
  readonly presence?: boolean;
  readonly dates?: readonly TaskDate[] | null;
  readonly duties?: readonly SealedDuty[];
}

/** 0099 — was jemand VOR einem Termin sagt. */
export type PresenceAnswer = 'yes' | 'maybe' | 'no';

/** 0099 — was die Kanzlei NACH dem Termin einträgt, wenn jemand nicht da war (da gewesen: ein Tag in `days`). */
export type Absence = 'absent' | 'excused';

/** 0099 — je Termin: die Antwort vorher, die Funktion, und — wenn nicht da gewesen — warum. */
export interface PresenceState {
  readonly day: string;
  readonly answer: PresenceAnswer | null;
  readonly dutyId: string | null;
  readonly absence: Absence | null;
  readonly byPerson?: boolean;
}

/** 0098 — was der Mensch zu einer Aufgabe sagt. */
export type TaskAnswer = 'accepted' | 'passed' | 'refused';

/** 0098 — seine Antwort und die Tage, an denen er sie getan hat. */
export interface TaskState {
  readonly stepId: string;
  readonly answer: TaskAnswer | null;
  readonly answeredAt?: string | null;
  readonly byPerson?: boolean;
  readonly days: readonly string[];

  /** 0099 — je Termin. */
  readonly presence: readonly PresenceState[];
}

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

  /** 0098 — was für ein Schritt (ein Znacznik, eine Aufgabe, …). */
  readonly kind: StepKind;
  readonly task?: TaskPlan | null;

  /** 0100 — „Wybierz termin": bei welchem Zasób (der Name hängt aus). */
  readonly booking?: { readonly resourceId: string | null; readonly resourceName: string | null } | null;

  /** 0102 — „Przeczytaj wiadomości": in welchen Rozmowy. */
  readonly chat?: ChatTarget | null;

  /** 0109 — „Naucz się": was zu lernen ist. */
  readonly learn?: LearnTarget | null;
}

export interface OpenStep extends SealedStep {
  /** `null`: der Schlüssel des Formulars liegt nicht offen. */
  readonly label: string | null;
  readonly help: string | null;

  /** 0099 — die Funktionen einer Aufgabe an Terminen, geöffnet. */
  readonly duties?: readonly TaskDuty[];
}

/** Eine Erweiterung, aus der sich ein Schritt von selbst ergibt. */
export interface ExtensionInfo {
  readonly moduleId: string;
  readonly name: string;
  readonly audience: 'person' | 'office';
  readonly closed: boolean;

  /** 0077 — wie oft sie je Mensch ausgefüllt wird. Fehlt es: einmal. */
  readonly repeat?: Repeat;

  /** 0099 — wie viele Fragen sie hat; ohne Fragen ist sie noch kein Schritt. */
  readonly questions: number;
}

/**
 * IST DIE ERWEITERUNG AUSGEFÜLLT — bei einer wiederkehrenden (0077): für den
 * LAUFENDEN Zeitraum? Der Dienst nennt je Erweiterung die jüngste Einsendung
 * und ihren Zeitraum; weil nichts in die Zukunft eingetragen wird, ist der
 * laufende genau dann ausgefüllt, wenn die jüngste ihn trägt.
 */
export const filledNow = (
  repeat: Repeat | undefined, latest: { readonly round?: string | null } | undefined | null, now: Date = new Date()
): boolean => latest != null && (repeatOf(repeat) === 'once' || latest.round === roundOf(repeatOf(repeat), now));

/* -- Die Etiketten ------------------------------------------------------------ */

const labelAad = (stepId: string) => aad('form', 'step', stepId, Field.StepLabel, 1);
const helpAad = (stepId: string) => aad('form', 'step', stepId, Field.StepHelp, 1);
/** 0099 — eine Funktion: an ihre Kennung gebunden, unter dem Schlüssel des Formulars. */
export const dutyAad = (dutyId: string) => aad('form', 'duty', dutyId, Field.TaskDutyLabel, 1);

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

    /* 0099 — die Funktionen liegen unter demselben Schlüssel (ihrer Epoche). */
    const duties: TaskDuty[] = [];
    for (const d of one.task?.duties ?? []) {
      const dutyKey = keyOf(d.areaId, d.epoch);
      const dutyLabel = dutyKey === undefined ? null
        : await openText(dutyKey, dutyAad(d.dutyId), fromBase64Url(d.labelSealed)).catch(() => null);
      duties.push({ dutyId: d.dutyId, label: dutyLabel, capacity: d.capacity });
    }

    out.push({ ...one, label, help, ...(duties.length > 0 ? { duties } : {}) });
  }

  return out;
}

/* -- Beim Dienst ---------------------------------------------------------------- */

/** Die Schritte eines Formulars und seine Erweiterungen — deren Namen geöffnet (0097: sie liegen versiegelt unter ihrem Bereich). */
export async function loadSteps(partId: string): Promise<{
  steps: readonly SealedStep[];
  extensions: readonly ExtensionInfo[];
}> {
  const got = await call<{ steps: readonly SealedStep[]; extensions: readonly (Omit<ExtensionInfo, 'name'> & FormNameIn)[] }>(
    `/workspace/part/${encodeURIComponent(partId)}/steps`);
  return { steps: got.steps, extensions: await openFormNames(got.extensions, 'Rozszerzenie') };
}

/** Ein Schritt, wie ihn die Kanzlei gerade bearbeitet — offen. */
export interface StepDraft {
  readonly stepId: string;
  readonly label: string;
  readonly help: string;
  readonly doneBy: DoneBy;
  readonly visibleToPerson: boolean;

  /** `YYYY-MM-DD` oder leer. */
  readonly dueAt: string;

  /** 0098 — ein Znacznik oder eine Aufgabe, und ihr Plan (als Eingaben: Texte). */
  readonly kind?: StepKind;
  readonly task?: TaskDraft;

  /** 0100 — „Wybierz termin": der Zasób. */
  readonly resourceId?: string;

  /** 0102 — „Przeczytaj wiadomości": welche Rozmowy (`areaId` leer: an jedem Bereich). */
  readonly chat?: { readonly kind: ChatTargetKind; readonly areaId: string };

  /** 0109 — „Naucz się": die Bibliothek, die Powtórka (leer: alle Karten), die Schwelle (0..1). */
  readonly learn?: { readonly libraryId: string; readonly revisionId: string; readonly threshold: number };
}

/** 0099 — eine Funktion, wie sie im Editor steht. */
export interface DutyDraft {
  readonly dutyId: string;
  readonly label: string;
  /** Wie viele — als Text, leer: beliebig viele. */
  readonly capacity: string;
}

/** 0098 — der Plan einer Aufgabe, wie er im Editor steht. */
export interface TaskDraft {
  readonly startsOn: string;
  readonly endsOn: string;
  readonly schedule: TaskSchedule;
  readonly weekdays: number;
  /** `HH:MM` oder leer. */
  readonly at: string;
  /** Minuten als Text, oder leer. */
  readonly minutes: string;
  readonly needed: string;
  readonly showFrom: string;
  readonly reportUntil: string;

  /** 0099 — an Terminen: der Kalender und der Eintrag (leer: keiner), vorher fragen, die Funktionen. */
  readonly calendarId?: string;
  readonly itemId?: string;
  readonly presence?: boolean;
  readonly duties?: readonly DutyDraft[];
}

const minuteOf = (time: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  return m === null ? null : Number(m[1]) * 60 + Number(m[2]);
};

const numberOf = (text: string): number | null => {
  const n = Number(text.trim());
  return text.trim() === '' || !Number.isInteger(n) ? null : n;
};

/** 0098 — der Plan, wie ihn der Dienst nimmt. */
export const taskIn = (t: TaskDraft) => ({
  startsOn: t.startsOn, endsOn: t.endsOn, schedule: t.schedule,
  weekdays: t.schedule === 'weekly' ? t.weekdays : null,
  atMinute: t.schedule === 'item' ? null : minuteOf(t.at), minutes: t.schedule === 'item' ? null : numberOf(t.minutes),
  needed: numberOf(t.needed),
  showFrom: t.showFrom === '' ? null : t.showFrom, reportUntil: t.reportUntil === '' ? null : t.reportUntil,
  itemId: t.schedule === 'item' && (t.itemId ?? '') !== '' ? t.itemId! : null,
  presence: t.schedule === 'item' && t.presence === true
});

/** 0099 — „ile osób" einer Funktion: eine Zahl, oder `null` (beliebig viele). */
export const capacityOf = (text: string): number | null => numberOf(text);

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
    /* 0099 — bei einer Aufgabe: wer die Teilnahme einträgt (der Mensch, oder die Kanzlei nach der Liste). */
    doneBy: one.kind === 'learn' ? 'person' : one.doneBy,
    visibleToPerson: one.kind === 'task' || one.kind === 'learn' || one.doneBy === 'person' || one.visibleToPerson,
    /* Bis zum Ende des Tages — „do 15 sierpnia" heisst: auch am 15. noch. */
    dueAt: one.kind === 'task' || one.dueAt === '' ? null : new Date(`${one.dueAt}T23:59:59`).toISOString(),
    kind: one.kind ?? 'mark',
    resourceId: one.kind === 'booking' ? one.resourceId ?? null : null,
    chatKind: one.kind === 'chat' ? one.chat?.kind ?? 'all' : null,
    chatAreaId: one.kind === 'chat' && (one.chat?.areaId ?? '') !== '' ? one.chat!.areaId : null,
    learnLibraryId: one.kind === 'learn' ? one.learn?.libraryId ?? null : null,
    learnRevisionId: one.kind === 'learn' && (one.learn?.revisionId ?? '') !== '' ? one.learn!.revisionId : null,
    learnThreshold: one.kind === 'learn' ? one.learn?.threshold ?? 0.8 : null,
    task: one.kind === 'task' && one.task !== undefined ? {
      ...taskIn(one.task),
      /* 0099 — die Funktionen: nur mit „vorher fragen", die Beschriftung versiegelt wie die der Aufgabe. */
      duties: one.task.schedule === 'item' && one.task.presence === true
        ? await Promise.all((one.task.duties ?? []).filter((d) => d.label.trim() !== '').map(async (d) => ({
          dutyId: d.dutyId,
          labelSealed: toBase64Url(await sealText(formKey.key, dutyAad(d.dutyId), d.label.trim())),
          capacity: capacityOf(d.capacity)
        })))
        : []
    } : null
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

/**
 * 0098 — WAS JEMAND ZU EINER AUFGABE SAGT: `answer` (accepted, passed, refused;
 * `none` nimmt es zurück) und/oder ALLE Tage, an denen er sie getan hat. Wer
 * Tage einträgt, hat sie angenommen.
 */
export interface TaskChange {
  readonly answer?: TaskAnswer | 'none';
  readonly days?: readonly string[];
}

/** Der Mensch selbst, über seinen Link. */
export const answerTask = (token: string, registrationId: string, stepId: string, change: TaskChange): Promise<{ saved: boolean }> =>
  call(`/seat/${encodeURIComponent(token)}/task`, {
    method: 'POST',
    body: JSON.stringify({ registrationId, stepId, answer: change.answer ?? null, days: change.days ?? null })
  });

/** Die Kanzlei für ihn — er hat es ihr gesagt, oder sie hat ihn gesehen. */
export const answerTaskAsOffice = (registrationId: string, stepId: string, change: TaskChange): Promise<{ tasks: readonly TaskState[] }> =>
  call(`/workspace/registration/${encodeURIComponent(registrationId)}/task`, {
    method: 'POST',
    body: JSON.stringify({ stepId, answer: change.answer ?? null, days: change.days ?? null })
  });

/**
 * 0099 — ZU EINEM TERMIN: `answer` (yes, maybe, no; `none` nimmt es zurück),
 * `dutyId` (eine Funktion; `''`: keine) und `attendance` (present; die
 * Kanzlei auch absent, excused; `none`: nichts). Was fehlt, bleibt.
 */
export interface PresenceChange {
  readonly day: string;
  readonly answer?: PresenceAnswer | 'none';
  readonly dutyId?: string;
  readonly attendance?: 'present' | Absence | 'none';
}

const presenceBody = (registrationId: string, stepId: string, change: PresenceChange) => JSON.stringify({
  registrationId, stepId, day: change.day,
  answer: change.answer ?? null, dutyId: change.dutyId ?? null, attendance: change.attendance ?? null
});

/** Der Mensch selbst, über seinen Link. */
export const answerPresence = (token: string, registrationId: string, stepId: string, change: PresenceChange): Promise<{ saved: boolean }> =>
  call(`/seat/${encodeURIComponent(token)}/presence`, { method: 'POST', body: presenceBody(registrationId, stepId, change) });

/** Die Kanzlei — für ihn, und nach dem Termin die Liste. */
export const answerPresenceAsOffice = (registrationId: string, stepId: string, change: PresenceChange): Promise<{ tasks: readonly TaskState[] }> =>
  call(`/workspace/registration/${encodeURIComponent(registrationId)}/presence`, { method: 'POST', body: presenceBody(registrationId, stepId, change) });

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
    /** 0097 — geöffnet (`seatView`); vom Dienst kommt er versiegelt unter `areaId`. */
    readonly name: string;
    readonly areaId?: string | null;
    readonly nameSealed?: string | null;
    readonly nameEpoch?: number | null;
    readonly closed: boolean;
    /** Seine Ergänzung — oder `null`: noch nicht ausgefüllt. Bei einer wiederkehrenden (0077): die jüngste. */
    readonly registrationId: string | null;
    /** 0077 — wie oft, und welchen Zeitraum die jüngste trägt. */
    readonly repeat?: Repeat;
    readonly round?: string | null;
    /** 0099 — wie viele Fragen sie hat. */
    readonly questions: number;
  }[];
  readonly steps: readonly SealedStep[];
  readonly marks: readonly StepMark[];

  /** 0098 — was er zu den Aufgaben gesagt hat, und an welchen Tagen er sie getan hat. */
  readonly tasks: readonly TaskState[];

  /** 0099 — wie voll die Funktionen in den Terminen sind (nur Zahlen). */
  readonly taken?: readonly DutyTaken[];
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

  /** 0100 — „Wybierz termin": bei welchem Zasób, und der Termin, wenn einer gewählt ist. */
  readonly booking?: {
    readonly resourceName: string | null;
    readonly chosen: { readonly status: 'pending' | 'confirmed'; readonly startsAt: string; readonly endsAt: string } | null;
  };

  /** 0102 — „Przeczytaj wiadomości": in welchen Rozmowy; erledigt, solange dort nichts Ungelesenes liegt. */
  readonly chat?: ChatTarget;

  /** 0109 — „Naucz się": was zu lernen ist; erledigt, wenn sein Browser die Schwelle gemeldet hat. */
  readonly learn?: LearnTarget;

  /** 0098 — eine Aufgabe: ihr Plan, was er gesagt hat, wie weit er ist, und wo im Zeitraum sie steht. */
  readonly task?: {
    readonly plan: TaskPlan;
    readonly state: TaskState | undefined;
    readonly phase: TaskPhase;
    readonly done: number;
    /** `null`: keine Zahl — erledigt ist sie mit einer Antwort (`respondedTo`). */
    readonly needed: number | null;
    readonly fulfilled: boolean;
    /** 0099 — die Funktionen in den Terminen (geöffnet), und wer die Teilnahme einträgt. */
    readonly duties: readonly TaskDuty[];
    readonly doneBy: DoneBy;
    /** 0099 — zu jedem Termin abgesagt (nie bei Aufgaben ohne Fragen vorher). */
    readonly declined: boolean;
  };
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
  readonly extensions: readonly {
    readonly moduleId: string; readonly name: string; readonly audience: 'person' | 'office';
    /** 0077 — eine wiederkehrende steht als Schritt für den LAUFENDEN Zeitraum da. */
    readonly repeat?: Repeat;
    /** 0099 — `0`: noch ohne Fragen, also kein Schritt (bei niemandem „do zrobienia"). */
    readonly questions?: number;
  }[];

  /** Welche Erweiterungen ausgefüllt sind — Erweiterung → wann. Bei einer wiederkehrenden: nur, wenn für den laufenden Zeitraum (`filledNow`). */
  readonly filled: ReadonlyMap<string, string>;
  readonly steps: readonly OpenStep[];
  readonly marks: readonly StepMark[];
  /** 0098 — seine Antworten und Tage zu den Aufgaben. */
  readonly tasks?: readonly TaskState[];
  /** 0098 — für den Menschen: Aufgaben vor „widoczne od" stehen noch nicht da. */
  readonly forPerson?: boolean;
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
    /*
     * 0099 — EIN UNTERFORMULAR OHNE FRAGEN ist noch keiner: auszufüllen gibt es
     * nichts. Vorher stand es bei der Kanzlei „do zrobienia", und der Mensch
     * fand an seiner Stelle nur „Tu nie ma formularza" (jetzt: „…nie ma jeszcze pytań").
     */
    if (ext.questions === 0) continue;
    const at = input.filled.get(ext.moduleId) ?? null;
    const person = ext.audience === 'person';
    const repeat = repeatOf(ext.repeat);
    const name = repeat === 'once' ? ext.name : `${ext.name} — ${roundLabel(repeat, roundOf(repeat, now))}`;

    out.push({
      key: `ext:${ext.moduleId}`,
      label: person ? `Uzupełnij: ${name}` : name,
      help: person ? null : 'Wypełnia koordynator — osoba tego nie widzi.',
      source: 'auto', doneBy: person ? 'person' : 'office', visibleToPerson: person,
      status: state(at, null), doneAt: at, dueAt: null,
      extensionId: ext.moduleId, stepId: null
    });
  }

  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  for (const one of input.steps) {
    /*
     * 0098 — EINE AUFGABE: erledigt mit genug Tagen; nach ihrem Ende ohne genug
     * Tage überfällig — ausser er hat sie ausdrücklich ausgelassen oder abgelehnt.
     */
    if (one.kind === 'task' && one.task != null) {
      const plan = one.task;
      const phase = phaseOf(plan, today);
      if (input.forPerson === true && phase === 'hidden') continue;
      const said = input.tasks?.find((t) => t.stepId === one.stepId);
      const progress = taskProgressOf(plan, said);
      const ended = phase === 'reporting' || phase === 'over';
      const last = said?.days.length ? said.days[said.days.length - 1] : null;
      /* 0099 — wer zu jedem Termin abgesagt hat (oder entschuldigt fehlte), ist nicht überfällig. */
      const declined = declinedAll(plan, said);

      out.push({
        key: `task:${one.stepId}`,
        label: one.label ?? 'Zadanie (zapieczętowane)',
        help: one.help,
        source: 'hand', doneBy: one.doneBy, visibleToPerson: true,
        status: progress.fulfilled ? 'done'
          : ended && progress.answer !== 'refused' && progress.answer !== 'passed' && !declined ? 'overdue' : 'todo',
        doneAt: progress.fulfilled && last !== null ? `${last}T12:00:00` : null,
        dueAt: null,
        extensionId: null, stepId: one.stepId,
        task: { plan, state: said, phase, ...progress, duties: one.duties ?? [], doneBy: one.doneBy, declined }
      });
      continue;
    }

    const mark = input.marks.find((m) => m.stepId === one.stepId) ?? null;

    /* 0100 — „WYBIERZ TERMIN": erledigt sich, sobald sein Platz einen Termin hält — niemand hakt ab. */
    if (one.kind === 'booking') {
      out.push({
        key: `step:${one.stepId}`,
        label: one.label ?? 'Wybór terminu (zapieczętowany)',
        help: one.help,
        source: 'auto', doneBy: 'person', visibleToPerson: true,
        status: state(mark?.doneAt ?? null, one.dueAt), doneAt: mark?.doneAt ?? null, dueAt: one.dueAt,
        extensionId: null, stepId: one.stepId,
        booking: { resourceName: one.booking?.resourceName ?? null, chosen: mark?.booking ?? null }
      });
      continue;
    }

    /*
     * 0102 — „PRZECZYTAJ WIADOMOŚCI": der Dienst meldet den Haken, solange in
     * den gewählten Rozmowy nichts Ungelesenes liegt. Kommt etwas Neues, ist er
     * wieder offen — überfällig wird er nie, er ist ein Stand, keine Frist.
     */
    if (one.kind === 'chat') {
      out.push({
        key: `step:${one.stepId}`,
        label: one.label ?? 'Przeczytaj wiadomości (zapieczętowane)',
        help: one.help,
        source: 'auto', doneBy: 'person', visibleToPerson: true,
        status: mark !== null ? 'done' : 'todo', doneAt: mark?.doneAt ?? null, dueAt: null,
        extensionId: null, stepId: one.stepId,
        chat: one.chat ?? { kind: 'all', areaId: null, areaName: null }
      });
      continue;
    }

    /*
     * 0109 — „NAUCZ SIĘ": erledigt, sobald sein Browser die Schwelle erreicht
     * und abgehakt hat; mit Frist überfällig, wenn sie vorbei ist.
     */
    if (one.kind === 'learn') {
      out.push({
        key: `step:${one.stepId}`,
        label: one.label ?? 'Naucz się (zapieczętowane)',
        help: one.help,
        source: 'auto', doneBy: 'person', visibleToPerson: true,
        status: state(mark?.doneAt ?? null, one.dueAt), doneAt: mark?.doneAt ?? null, dueAt: one.dueAt,
        extensionId: null, stepId: one.stepId,
        learn: one.learn ?? { libraryId: null, revisionId: null, threshold: 0.8 }
      });
      continue;
    }

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

/**
 * „WYBIERZ TERMIN" IN DER LISTE — je Schritt dieser Art ein Schildchen: der
 * gewählte Termin (wartend oder schon vorbei), oder dass keiner gewählt ist.
 * Damit sieht die Kanzlei beim Durchsehen, wer einen Termin hat und wer nicht,
 * ohne jeden Menschen aufzuklappen.
 */
export interface BookingTag {
  readonly key: string;
  readonly text: string;
  readonly title: string;
  /** `none`: kein Termin · `wait`: wartet auf ein Ja · `next`: steht, kommt noch · `past`: war schon. */
  readonly state: 'none' | 'wait' | 'next' | 'past';
}

/** Ein Termin kurz: „12.11, 18:00" — mit Jahr, wenn es nicht dieses ist. */
export function whenShort(at: Date, now = new Date()): string {
  return at.toLocaleString('pl-PL', {
    day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit',
    ...(at.getFullYear() !== now.getFullYear() ? { year: 'numeric' as const } : {})
  });
}

export function bookingTags(states: readonly StepState[], now = new Date()): readonly BookingTag[] {
  const booked = states.filter((st) => st.booking !== undefined);
  /* Mehr als ein solcher Schritt: dann steht sein Name davor, sonst nur im Hinweis. */
  const named = booked.length > 1;
  return booked.map((st) => {
    const chosen = st.booking!.chosen;
    const head = named ? `${st.label}: ` : '';
    if (chosen === null) {
      return { key: st.key, state: 'none', text: `${head}bez terminu`, title: `${st.label} — osoba nie wybrała jeszcze terminu` };
    }
    const at = new Date(chosen.startsAt);
    const full = at.toLocaleString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const state = chosen.status === 'pending' ? 'wait' : new Date(chosen.endsAt) < now ? 'past' : 'next';
    return {
      key: st.key, state,
      text: `${head}${state === 'past' ? 'termin był ' : 'termin '}${whenShort(at, now)}${state === 'wait' ? ' · czeka' : ''}`,
      title: `${st.label} — ${full}${state === 'wait' ? ' (czeka na potwierdzenie)' : state === 'past' ? ' (już był)' : ''}`
    };
  });
}

/** Die Klasse eines solchen Schildchens: ohne Termin warnend, mit festem Termin grün. */
export const bookingTagClass = (tag: BookingTag): string =>
  tag.state === 'none' ? 'wk-tag wk-tag-warn' : tag.state === 'wait' ? 'wk-tag' : 'wk-tag wk-tag-open';

/** Eine Frist, lesbar. */
export const dueText = (dueAt: string): string =>
  new Date(dueAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
