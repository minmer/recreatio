/**
 * DIE KARTE EINER SEITE (0048) — was wann zu sehen ist, und die Schritte.
 *
 * <b>Links, was über den Menschen bekannt ist</b>, der die Seite gerade
 * ansieht (die Wahl oben, `pagePerson`): ist jemand gewählt, kam er über einen
 * Link, ist er angemeldet, hat er Formular X geschickt, seine Angaben
 * bestätigt, eine Frage beantwortet, hat jemand einen Znacznik gesetzt — und
 * das Datum. <b>In der Mitte</b> I, LUB, NIE. <b>Rechts die Seite selbst:</b>
 *
 * <code>
 *   jeder Baustein   ein Knoten mit dem Eingang „pokaż, gdy" — ohne Kante
 *                    steht er da wie immer; mit Kanten nur, wenn alle gelten
 *   jeder Krok       ein Knoten mit „zrobione, gdy" und „dotyczy, gdy" — aus
 *                    ihnen zeichnet der Baustein „Kroki osoby" seine Liste,
 *                    von oben nach unten, wie sie auf der Karte stehen
 * </code>
 *
 * <b>Ausgewertet wird im Browser</b>, mit dem, was er über den Gewählten offen
 * hat. Die Karte selbst ist Seiteninhalt und liegt offen beim Dienst — mit
 * EINER Ausnahme: vergleicht sie eine Antwort mit einem Wert, steht nur der
 * Abdruck des Werts darin. Die Antwort eines Menschen gehört nicht in eine
 * Seite, die jeder abrufen kann, auch nicht als Bedingung.
 *
 * <b>Die Karte ist keine Sperre.</b> Was sie verbirgt, verbirgt sie aus der
 * Ansicht; was geschützt sein muss, schützt der Schlüssel.
 */

import { createContext, useContext } from 'react';

import { sha256, toBase64Url } from './crypto';
import type { SeatView } from './seatContext';

/* -- Das Modell ------------------------------------------------------------------ */

export const INPUT_KINDS = ['chosen', 'link', 'loggedIn', 'registered', 'confirmed', 'answer', 'mark', 'date'] as const;
export const GATE_KINDS = ['and', 'or', 'not'] as const;

export type InputKind = (typeof INPUT_KINDS)[number];
export type GateKind = (typeof GATE_KINDS)[number];
export type PageNodeKind = InputKind | GateKind | 'part' | 'step';

export const PAGE_NODE_LABEL: Record<PageNodeKind, string> = {
  chosen: 'Wybrana osoba',
  link: 'Otwarte przez link',
  loggedIn: 'Zalogowany',
  registered: 'Zgłoszenie wysłane',
  confirmed: 'Dane potwierdzone',
  answer: 'Odpowiedź',
  mark: 'Znacznik',
  date: 'Data',
  and: 'I',
  or: 'LUB',
  not: 'NIE',
  part: 'Moduł',
  step: 'Krok'
};

export type AnswerOp = 'filled' | 'empty' | 'eq' | 'ne';

export const ANSWER_OP_LABEL: Record<AnswerOp, string> = {
  filled: 'wypełniona',
  empty: 'pusta',
  eq: 'równa wartości',
  ne: 'różna od wartości'
};

export type PagePort = 'in' | 'show' | 'done' | 'applies';

export const PORT_LABEL: Record<PagePort, string> = {
  in: '',
  show: 'pokaż, gdy',
  done: 'zrobione, gdy',
  applies: 'dotyczy, gdy'
};

export interface PageNode {
  readonly id: string;
  readonly kind: PageNodeKind;
  readonly x: number;
  readonly y: number;

  /* part */
  readonly partId?: string;
  /** Was an Stelle des verborgenen Bausteins steht — leer: nichts. */
  readonly message?: string;

  /* step */
  readonly label?: string;
  readonly help?: string;
  /** `YYYY-MM-DD`. */
  readonly dueAt?: string;
  /** Ein Baustein dieser Seite, zu dem „Przejdź" führt. */
  readonly goto?: string;

  /* registered, confirmed, answer, mark */
  readonly formId?: string;

  /* answer */
  readonly fieldId?: string;
  readonly op?: AnswerOp;
  /** Der Abdruck des Vergleichswerts — der Wert selbst steht nirgends. */
  readonly valueHash?: string;

  /* mark: ein Znacznik des Formulars (0047), und wer ihn setzt */
  readonly stepId?: string;
  readonly markBy?: 'office' | 'person';

  /* date */
  readonly when?: 'after' | 'before';
  readonly date?: string;
}

export interface PageEdge {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly port: PagePort;
}

export interface PageLogic {
  readonly version: 1;
  readonly nodes: readonly PageNode[];
  readonly edges: readonly PageEdge[];
}

export const EMPTY_LOGIC: PageLogic = { version: 1, nodes: [], edges: [] };

export type Role = 'input' | 'gate' | 'output';

export const roleOfKind = (kind: PageNodeKind): Role =>
  (INPUT_KINDS as readonly string[]).includes(kind) ? 'input'
  : (GATE_KINDS as readonly string[]).includes(kind) ? 'gate'
  : 'output';

/** Die Eingänge eines Knotens — und ob einer mehrere Kanten nimmt (dann gelten ALLE). */
export function pagePortsOf(kind: PageNodeKind): readonly { readonly port: PagePort; readonly many: boolean }[] {
  switch (kind) {
    case 'part': return [{ port: 'show', many: true }];
    case 'step': return [{ port: 'done', many: true }, { port: 'applies', many: true }];
    case 'and':
    case 'or': return [{ port: 'in', many: true }];
    case 'not': return [{ port: 'in', many: false }];
    default: return [];
  }
}

/** Duldsam lesen: was nicht passt, fällt weg — eine kaputte Karte zeigt die Seite, wie sie ohne wäre. */
export function readLogic(text: string | null | undefined): PageLogic | null {
  if (text === null || text === undefined || text.trim() === '') return null;

  try {
    const raw = JSON.parse(text) as Partial<PageLogic>;
    const known: readonly string[] = [...INPUT_KINDS, ...GATE_KINDS, 'part', 'step'];
    const nodes = Array.isArray(raw.nodes) ? raw.nodes.filter((n): n is PageNode =>
      typeof n === 'object' && n !== null && typeof n.id === 'string' && typeof n.kind === 'string'
      && known.includes(n.kind) && typeof n.x === 'number' && typeof n.y === 'number') : [];
    const ids = new Set(nodes.map((n) => n.id));
    const edges = Array.isArray(raw.edges) ? raw.edges.filter((e): e is PageEdge =>
      typeof e === 'object' && e !== null && ids.has(e.from) && ids.has(e.to) && typeof e.port === 'string') : [];

    return { version: 1, nodes, edges };
  } catch {
    return null;
  }
}

/** Würde eine Kante `from → to` einen Kreis schliessen? */
export function wouldLoop(edges: readonly PageEdge[], from: string, to: string): boolean {
  if (from === to) return true;
  const next = new Map<string, string[]>();
  for (const e of edges) next.set(e.from, [...(next.get(e.from) ?? []), e.to]);

  const seen = new Set<string>();
  const stack = [to];
  while (stack.length > 0) {
    const at = stack.pop()!;
    if (at === from) return true;
    if (seen.has(at)) continue;
    seen.add(at);
    stack.push(...(next.get(at) ?? []));
  }
  return false;
}

/* -- Der Abdruck eines Vergleichswerts -------------------------------------------- */

/** Wie eine Antwort verglichen wird: ohne Rand, ohne Gross und Klein. */
export const answerText = (value: string): string => value.trim().toLocaleLowerCase('pl');

/** Der Abdruck — an die Frage gebunden, damit derselbe Wert zweier Fragen nicht gleich aussieht. */
export const answerHash = async (fieldId: string, value: string): Promise<string> =>
  toBase64Url(await sha256(`recreatio:v1:page-answer|${fieldId}|${answerText(value)}`));

/* -- Was über den Gewählten bekannt ist --------------------------------------------- */

export interface Facts {
  readonly chosen: boolean;
  readonly link: boolean;
  readonly loggedIn: boolean;

  /** Formulare, aus denen er etwas geschickt hat — auch Ergänzungen (0047). */
  readonly registered: ReadonlySet<string>;

  /** Formulare, deren Angaben er bestätigt hat (0046). */
  readonly confirmed: ReadonlySet<string>;

  /** Gesetzte Znaczniki (0047) — die Schritte der Formulare, die er sieht. */
  readonly marks: ReadonlySet<string>;

  /** Seine eigenen Antworten, soweit offen: Frage → Antwort. */
  readonly answers: ReadonlyMap<string, string>;

  /** Je Vergleichsknoten: stimmt seine Antwort mit dem Abdruck überein? */
  readonly matches: ReadonlyMap<string, boolean>;

  readonly now: Date;
}

export const NO_ONE: Facts = {
  chosen: false, link: false, loggedIn: false,
  registered: new Set(), confirmed: new Set(), marks: new Set(),
  answers: new Map(), matches: new Map(), now: new Date()
};

/**
 * Die Tatsachen über EINEN Platz — alles, was sein Browser offen hat.
 * `matches` braucht den Abdruck und ist deshalb asynchron.
 */
export async function factsOfSeat(
  seat: SeatView, logic: PageLogic, loggedIn: boolean, now: Date = new Date()
): Promise<Facts> {
  const registered = new Set<string>([
    ...seat.forms.map((f) => f.formId),
    ...seat.submitted.map((v) => v.formId),
    ...seat.forms.flatMap((f) => f.extensions.filter((e) => e.registrationId !== null).map((e) => e.moduleId))
  ]);

  const confirmed = new Set(seat.forms.filter((f) => f.confirmedAt !== null).map((f) => f.formId));
  const marks = new Set(seat.forms.flatMap((f) => f.marks.map((m) => m.stepId)));

  const answers = new Map<string, string>();
  for (const one of seat.opened) if (one.value !== null) answers.set(one.fieldId, one.value);

  const matches = new Map<string, boolean>();
  for (const node of logic.nodes) {
    if (node.kind !== 'answer' || (node.op !== 'eq' && node.op !== 'ne') || node.fieldId === undefined) continue;
    const given = answers.get(node.fieldId);
    matches.set(node.id, given !== undefined && node.valueHash !== undefined
      && (await answerHash(node.fieldId, given)) === node.valueHash);
  }

  return { chosen: true, link: true, loggedIn, registered, confirmed, marks, answers, matches, now };
}

/* -- Die EINE Auswertung ----------------------------------------------------------- */

export type StepStatus = 'done' | 'todo' | 'overdue';

export interface PageStep {
  readonly nodeId: string;
  readonly label: string;
  readonly help: string | null;
  readonly dueAt: string | null;
  readonly goto: string | null;
  readonly status: StepStatus;

  /** Hängt „zrobione" an genau einem Znacznik, den der Mensch selbst setzt — dann setzt er ihn hier. */
  readonly ownMark: { readonly formId: string; readonly stepId: string } | null;
}

export interface PageOutcome {
  /** Bausteine, die nicht zu sehen sind. */
  readonly hidden: ReadonlySet<string>;

  /** Was an Stelle eines verborgenen Bausteins steht. */
  readonly messages: ReadonlyMap<string, string>;

  /** Die Liste für „Kroki osoby" — nur, was für diesen Menschen gilt, von oben nach unten. */
  readonly steps: readonly PageStep[];

  /** Der Wert jedes Knotens — für die Vorschau im Editor. */
  readonly values: ReadonlyMap<string, boolean>;
}

/**
 * Den Eingang eines Knotens ablesen — aus den Tatsachen, oder in der Vorschau
 * aus dem, was der Bearbeitende angeklickt hat.
 */
export function inputValue(node: PageNode, facts: Facts): boolean {
  switch (node.kind) {
    case 'chosen': return facts.chosen;
    case 'link': return facts.link;
    case 'loggedIn': return facts.loggedIn;
    case 'registered': return node.formId !== undefined && facts.registered.has(node.formId);
    case 'confirmed': return node.formId !== undefined && facts.confirmed.has(node.formId);
    case 'mark': return node.stepId !== undefined && facts.marks.has(node.stepId);
    case 'answer': {
      const given = node.fieldId === undefined ? '' : (facts.answers.get(node.fieldId) ?? '');
      switch (node.op ?? 'filled') {
        case 'filled': return given.trim() !== '';
        case 'empty': return given.trim() === '';
        case 'eq': return facts.matches.get(node.id) === true;
        default: return given.trim() !== '' && facts.matches.get(node.id) !== true;
      }
    }
    case 'date': {
      if (node.date === undefined || node.date === '') return false;
      const at = new Date(`${node.date}T00:00:00`);
      return node.when === 'before' ? facts.now < at : facts.now >= at;
    }
    default: return false;
  }
}

export function evaluatePage(
  logic: PageLogic,
  read: (node: PageNode) => boolean,
  now: Date = new Date()
): PageOutcome {
  const byId = new Map(logic.nodes.map((n) => [n.id, n]));
  const into = new Map<string, PageEdge[]>();
  for (const e of logic.edges) into.set(e.to, [...(into.get(e.to) ?? []), e]);

  const memo = new Map<string, boolean>();
  const visiting = new Set<string>();

  const valueOf = (id: string): boolean => {
    const done = memo.get(id);
    if (done !== undefined) return done;
    if (visiting.has(id)) return false;

    const node = byId.get(id);
    if (node === undefined) return false;

    visiting.add(id);
    const ins = (into.get(id) ?? []).filter((e) => e.port === 'in').map((e) => valueOf(e.from));

    let v: boolean;
    switch (roleOfKind(node.kind)) {
      case 'input': v = read(node); break;
      case 'gate':
        v = node.kind === 'and' ? ins.length > 0 && ins.every(Boolean)
          : node.kind === 'or' ? ins.some(Boolean)
          : !(ins[0] ?? false);
        break;
      default: v = false;
    }

    visiting.delete(id);
    memo.set(id, v);
    return v;
  };

  /** Alle Kanten in diesen Anschluss — gelten sie ALLE? `null`: es gibt keine. */
  const all = (id: string, port: PagePort): boolean | null => {
    const edges = (into.get(id) ?? []).filter((e) => e.port === port);
    return edges.length === 0 ? null : edges.every((e) => valueOf(e.from));
  };

  const hidden = new Set<string>();
  const messages = new Map<string, string>();
  const steps: PageStep[] = [];

  for (const node of logic.nodes) {
    if (node.kind === 'part' && node.partId !== undefined) {
      const show = all(node.id, 'show');
      memo.set(node.id, show !== false);
      if (show === false) {
        hidden.add(node.partId);
        const text = (node.message ?? '').trim();
        if (text !== '') messages.set(node.partId, text);
      }
    }
  }

  for (const node of [...logic.nodes].filter((n) => n.kind === 'step').sort((a, b) => a.y - b.y || a.x - b.x)) {
    const applies = all(node.id, 'applies');
    if (applies === false) continue;

    const done = all(node.id, 'done') === true;
    memo.set(node.id, done);

    const due = node.dueAt === undefined || node.dueAt === '' ? null : new Date(`${node.dueAt}T23:59:59`);
    const doneEdges = (into.get(node.id) ?? []).filter((e) => e.port === 'done');
    const only = doneEdges.length === 1 ? byId.get(doneEdges[0].from) : undefined;

    steps.push({
      nodeId: node.id,
      label: (node.label ?? '').trim() || 'Krok',
      help: (node.help ?? '').trim() || null,
      dueAt: due === null ? null : due.toISOString(),
      goto: node.goto ?? null,
      status: done ? 'done' : due !== null && due < now ? 'overdue' : 'todo',
      ownMark: only?.kind === 'mark' && only.markBy === 'person' && only.formId !== undefined && only.stepId !== undefined
        ? { formId: only.formId, stepId: only.stepId }
        : null
    });
  }

  for (const node of logic.nodes) if (roleOfKind(node.kind) !== 'output') valueOf(node.id);

  return { hidden, messages, steps, values: memo };
}

/* -- Auf der Seite ---------------------------------------------------------------- */

export interface PageLogicState {
  readonly logic: PageLogic;
  readonly outcome: PageOutcome;
}

export const PageLogicContext = createContext<PageLogicState | null>(null);

/** Die Karte dieser Seite und was sie für den Gewählten ergibt — `null`: keine Karte. */
export const usePageLogic = (): PageLogicState | null => useContext(PageLogicContext);
