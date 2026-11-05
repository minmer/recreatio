/**
 * 2026-10-27 — EIN SCHEMA FÜR JEDE FRAGE: der Rodzaj „Pytanie" und seine Rodzaje pytań.
 *
 * <b>Entschieden: EIN Rodzaj, nicht einer je Art der Frage</b> (COGITA.md §3). Was jede Frage hat —
 * die Frage selbst, was nach der Antwort zu lesen ist, „O czym", „Najpierw trzeba znać" — steht
 * einmal da; der Rodzaj pytania (`form`) entscheidet, welche Felder dazukommen (`FieldDef.when`),
 * und der Editor zeigt nur sie. So
 * <code>
 *   wechselt eine Frage ihre Art, ohne neu zu entstehen (eine von mehreren → mehrere; prawda/fałsz →
 *     eine von mehreren): Frage, Erklärung, „O czym" und der Fortschritt bleiben;
 *   nehmen Powtórki, Sitzungen, Przebiegi und das Modul „Pytanie" ALLE Fragen als eine Quelle;
 *   prüft EIN Code jede Art (`cards.ts`, `check.ts`) — ein neuer Rodzaj je Art hätte die Felder,
 *     die alle teilen, zwölfmal, und eine Frage, die ihre Art wechselt, müsste umziehen.
 * </code>
 * Die Arten stehen hier, als Daten: was der Lernende tut, wie das Feld der Frage heisst, welche
 * Felder dazugehören. Daraus entstehen die Wahl im Rodzaj (`kinds.ts` QUESTION, mit `when` je
 * Feld), der Editor (`QuestionFields.tsx`), die Beschreibung des JSON (`json.ts`) und die Vorlage
 * `templates/cogita/pytania.json`.
 *
 * <b>Paare in langen Listen</b>: „Połącz w pary" mit „Ile par naraz" (`show`) — eine Liste von 40
 * Jahren und Ereignissen zeigt je Karte nur ein paar Paare; jedes Paar hat seine eigene Karte
 * (`cards.ts` questionCards), so dass gerade die Paare wiederkommen, die noch nicht sitzen.
 */

import type { AnswerForm } from './check';
import { appLang, t } from '../core/i18n';

export type QuestionGroup = 'write' | 'choose' | 'connect' | 'other';

export const QUESTION_GROUPS: readonly { readonly id: QuestionGroup; readonly label: string }[] = (['write', 'choose', 'connect', 'other'] as const)
  .map((id) => ({ id, get label() { return t(`cogitaData.questionGroup.${id}`); } }));

export interface QuestionType {
  readonly form: AnswerForm;
  readonly label: string;
  readonly group: QuestionGroup;
  /** Was der Lernende tut — ein Satz für den Editor, das Schema und das JSON. */
  readonly says: string;
  /** Wie das Feld der Frage bei dieser Art heisst. */
  readonly prompt: string;
  /** Die Felder, die NUR zu dieser Art gehören — in der Reihenfolge des Editors. */
  readonly fields: readonly string[];
}

/* 2026-11-05 — Name, Erklärung und Feld der Frage in der Sprache der Anwendung (`cogitaData.questionType.<art>.*`), beim Lesen geholt. */
const qt = (form: AnswerForm, group: QuestionGroup, fields: readonly string[]): QuestionType => ({
  form, group, fields,
  get label() { return t(`cogitaData.questionType.${form}.label`); },
  get says() { return t(`cogitaData.questionType.${form}.says`); },
  get prompt() { return t(`cogitaData.questionType.${form}.prompt`); }
});

export const QUESTION_TYPES: readonly QuestionType[] = [
  qt('text', 'write', ['answers']),
  qt('number', 'write', ['answers', 'unit', 'quantity', 'tolerance', 'relative']),
  qt('date', 'write', ['answers', 'precision', 'tolerance']),
  qt('gap', 'write', ['answers', 'choices']),
  qt('one', 'choose', ['options', 'correct', 'feedback']),
  qt('many', 'choose', ['options', 'correct', 'feedback', 'show']),
  qt('truefalse', 'choose', ['value']),
  qt('match', 'connect', ['left', 'right', 'leftLabel', 'rightLabel', 'show']),
  qt('order', 'connect', ['items', 'extra', 'preview', 'join']),
  qt('build', 'connect', ['items', 'extra', 'alternatives', 'preview', 'join']),
  qt('flash', 'other', ['back']),
  qt('point', 'other', ['place', 'radius']),
  qt('code', 'other', ['task', 'starter', 'tests', 'createInput', 'reference', 'cases']),
  qt('interactive', 'other', ['drawing', 'goal', 'solution', 'goals', 'check'])
];

/**
 * Was jede Frage hat, gleich welcher Art. 2026-11-01 — dazu Podpowiedzi (vor der Antwort), das Wyjaśnienie als Text
 * (nach ihr) und Parameter (neue Zahlen je Versuch).
 */
export const QUESTION_SHARED = ['form', 'prompt', 'hints', 'explanation', 'explain', 'about', 'needs', 'params', 'let', 'require', 'share', 'fact', 'core'] as const;

export const questionType = (form: unknown): QuestionType =>
  QUESTION_TYPES.find((t) => t.form === form) ?? QUESTION_TYPES[0];

/** Zu welchen Arten ein Feld gehört — `undefined`: zu allen (die gemeinsamen). */
export function formsOfField(key: string): readonly string[] | undefined {
  const forms = QUESTION_TYPES.filter((t) => t.fields.includes(key)).map((t) => t.form);
  return forms.length === 0 ? undefined : forms;
}

/** Wie viele Paare eine Karte höchstens zeigt — mehr passt nicht nebeneinander auf ein Telefon. */
export const SHOW_MAX = 12;

/* -- Lesen, robust gegen halb Getipptes --------------------------------------------------------- */

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');

/** Eine Liste, wie sie steht — mit leeren Stellen (der Editor tippt gerade), aus einem Feld oder aus Zeilen. */
export const rawList = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => str(isObject(x) ? x.value : x)) : typeof v === 'string' ? v.split('\n') : [];

/** Nicht leere Einträge einer Liste. */
export const filledList = (v: unknown): string[] => rawList(v).map((x) => x.trim()).filter((x) => x !== '');

/**
 * DIE MÖGLICHKEITEN einer Wahl, mit den richtigen — leere fallen weg und die Nummern der
 * richtigen rücken mit (eine leere Zeile mitten in der Liste verschiebt sonst, was richtig ist).
 */
export function choicesOf(d: Readonly<Record<string, unknown>>): { options: string[]; correct: number[]; feedback: string[] } {
  const raw = rawList(d.options);
  /* 2026-11-01 — ein Satz je Möglichkeit, an derselben Stelle wie sie: er rückt mit, wenn eine leere wegfällt. */
  const said = rawList(d.feedback);
  /* Leer ist keine Null: `Number('')` wäre 0 — und die erste Möglichkeit plötzlich richtig. */
  const marked = new Set((Array.isArray(d.correct) ? d.correct : [d.correct]).map((c) => (typeof c === 'number' ? c : str(c).trim() === '' ? Number.NaN : Number(str(c)))).filter((n) => Number.isInteger(n) && n >= 0));
  const options: string[] = [];
  const correct: number[] = [];
  const feedback: string[] = [];
  raw.forEach((text, i) => {
    const t = text.trim();
    if (t === '') return;
    if (marked.has(i)) correct.push(options.length);
    options.push(t);
    feedback.push((said[i] ?? '').trim());
  });
  return { options, correct, feedback };
}

/** DIE PAARE (match): Stelle für Stelle aus beiden Seiten; ein Paar, dem eine Seite fehlt, fällt weg. */
export function pairsOf(d: Readonly<Record<string, unknown>>): { left: string; right: string }[] {
  const left = rawList(d.left);
  const right = rawList(d.right);
  const out: { left: string; right: string }[] = [];
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const l = (left[i] ?? '').trim();
    const r = (right[i] ?? '').trim();
    if (l !== '' && r !== '') out.push({ left: l, right: r });
  }
  return out;
}

/** Wie viele Paare je Karte — `null`: alle auf einer Karte (keine Zahl, oder nicht weniger als es gibt). */
export function showOf(d: Readonly<Record<string, unknown>>, pairs: number): number | null {
  const n = typeof d.show === 'number' ? d.show : Number(str(d.show).replace(',', '.'));
  if (!Number.isFinite(n) || n < 2) return null;
  const show = Math.min(SHOW_MAX, Math.round(n));
  return show >= pairs ? null : show;
}

/** Was in einem Text eine Lücke ist: [[słowo]] (ohne „|@" — das ist ein Verweis). */
export const GAP = /\[\[([^\]|]+)\]\]/g;

/* -- Eine Liste von Paaren einfügen ---------------------------------------------------------------- */

/** In dieser Reihenfolge wird je Zeile das erste Trennzeichen gesucht, das darin vorkommt. */
const PAIR_SEPARATORS = ['\t', ' | ', '|', ' – ', ' — ', ' - ', ' = ', '=', ';', ': '];

/**
 * „1410 – Bitwa pod Grunwaldem" Zeile für Zeile (aus einer Tabelle: Tab). Je Zeile gilt das erste
 * Trennzeichen der Liste, das in ihr steht — ein Bindestrich IM Wort („polsko-litewska") trennt nicht.
 */
export function parsePairs(text: string): { left: string; right: string }[] {
  const out: { left: string; right: string }[] = [];
  for (const line of text.split(/\r?\n/)) {
    const sep = PAIR_SEPARATORS.find((s) => line.includes(s));
    if (sep === undefined) continue;
    const at = line.indexOf(sep);
    const left = line.slice(0, at).trim();
    const right = line.slice(at + sep.length).trim();
    if (left !== '' && right !== '') out.push({ left, right });
  }
  return out;
}

/* -- Was noch fehlt, und Aufräumen vor dem Speichern ---------------------------------------------------- */

const readNum = (v: string): number | null => {
  const n = Number(v.replace(/\s/g, '').replace(',', '.'));
  return v.trim() !== '' && Number.isFinite(n) ? n : null;
};

/**
 * WAS NOCH FEHLT, damit aus der Frage eine Karte wird — in Worten, für den Editor. Leer: sie lässt
 * sich stellen. (Eine Karte entsteht trotzdem nur, wo `cards.ts` sie bauen kann.)
 */
export function questionProblems(d: Readonly<Record<string, unknown>>): string[] {
  const type = questionType(d.form);
  const out: string[] = [];
  const prompt = str(d.prompt).trim();
  const answers = filledList(d.answers);
  /* Im Deutschen bleibt das Hauptwort gross. */
  if (prompt === '' && type.form !== 'interactive' && type.form !== 'code') out.push(t('cogitaData.questionProblem.writePrompt', { what: appLang() === 'de' ? type.prompt : type.prompt.toLowerCase() }));
  switch (type.form) {
    case 'text': if (answers.length === 0) out.push(t('cogitaData.questionProblem.text')); break;
    case 'gap': if (answers.length === 0 && [...str(d.prompt).matchAll(GAP)].length === 0) out.push(t('cogitaData.questionProblem.gap')); break;
    case 'number': if (!answers.some((a) => readNum(a.replace(/[^\d,.\-\s]/g, '')) !== null)) out.push(t('cogitaData.questionProblem.number')); break;
    case 'date': if (!answers.some((a) => /\d/.test(a))) out.push(t('cogitaData.questionProblem.date')); break;
    case 'one':
    case 'many': {
      const { options, correct } = choicesOf(d);
      if (options.length < 2) out.push(t('cogitaData.questionProblem.twoOptions'));
      if (correct.length === 0) out.push(type.form === 'one' ? t('cogitaData.questionProblem.markOne') : t('cogitaData.questionProblem.markMany'));
      if (type.form === 'one' && correct.length > 1) out.push(t('cogitaData.questionProblem.oneOnly'));
      break;
    }
    case 'truefalse': if (typeof d.value !== 'boolean') out.push(t('cogitaData.questionProblem.truefalse')); break;
    case 'order': if (filledList(d.items).length < 2) out.push(t('cogitaData.questionProblem.order')); break;
    case 'build': {
      const items = filledList(d.items).length;
      if (items === 0) out.push(t('cogitaData.questionProblem.buildItems'));
      else if (items + filledList(d.extra).length < 2) out.push(t('cogitaData.questionProblem.buildSecond'));
      break;
    }
    case 'match': if (pairsOf(d).length < 2) out.push(t('cogitaData.questionProblem.match')); break;
    case 'flash': if (filledList(d.back).length === 0 && answers.length === 0) out.push(t('cogitaData.questionProblem.flash')); break;
    case 'point': if (!isObject(d.place)) out.push(t('cogitaData.questionProblem.point')); break;
    case 'code': {
      /* 2026-11-01 — sichtbare Beispiele genügen; verdeckte Fälle brauchen Rozwiązanie wzorcowe UND Dane testowe. */
      const hidden = str(d.reference).trim() !== '' && str(d.createInput).trim() !== '';
      const half = !hidden && (str(d.reference).trim() !== '' || str(d.createInput).trim() !== '');
      if (!hidden && jsonCount(d.tests) === 0) out.push(t('cogitaData.questionProblem.codeTests'));
      else if (half) out.push(t('cogitaData.questionProblem.codeHalf'));
      break;
    }
    case 'interactive': if (str(d.drawing).trim() === '') out.push(t('cogitaData.questionProblem.drawing')); break;
  }
  if (type.form === 'gap') {
    const gaps = [...str(d.prompt).matchAll(GAP)].length;
    const lists = jsonCount(d.choices);
    if (lists > gaps) out.push(t('cogitaData.questionProblem.gapLists', { lists, gaps: t('cogitaData.questionProblem.gaps', { count: gaps }) }));
  }
  return out;
}

/** 2026-11-01 — wie viele Einträge ein JSON-Feld hat (eine Liste oder ein JSON-Text mit einer Liste). */
function jsonCount(raw: unknown): number {
  if (Array.isArray(raw)) return raw.length;
  if (typeof raw !== 'string' || raw.trim() === '') return 0;
  try { const v = JSON.parse(raw) as unknown; return Array.isArray(v) ? v.length : 0; } catch { return 0; }
}

/**
 * VOR DEM SPEICHERN: was der Editor leer stehen liess, fällt weg — leere Möglichkeiten (die
 * Nummern der richtigen rücken mit), leere Antworten, Paare ohne beide Seiten, leere Elemente.
 * Felder anderer Arten bleiben, wie sie sind (wechselt die Art zurück, sind sie wieder da).
 */
export function tidyQuestion(data: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...data };
  const set = (key: string, value: unknown[]) => { if (value.length === 0) delete out[key]; else out[key] = value; };
  /* Ohne gewählten Rodzaj pytania ist es eines „słowami" — so steht es dann auch da. */
  if (typeof out.form !== 'string' || out.form === '') out.form = 'text';
  if (Array.isArray(data.options)) {
    const { options, correct, feedback } = choicesOf(data);
    set('options', options);
    set('correct', correct);
    /* 2026-11-01 — die Sätze bleiben bei ihren Möglichkeiten (leere Stellen als ''); keiner — das Feld fällt weg. */
    if (Array.isArray(data.feedback)) set('feedback', feedback.some((x) => x !== '') ? feedback : []);
  }
  for (const key of ['answers', 'items', 'back', 'hints', 'extra']) if (Array.isArray(data[key])) set(key, filledList(data[key]));
  if (Array.isArray(data.left) || Array.isArray(data.right)) {
    /* Ein halbes Paar bleibt (die andere Seite kommt später) — nur ganz leere Zeilen fallen weg. */
    const left = rawList(data.left);
    const right = rawList(data.right);
    const rows: [string, string][] = [];
    for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
      const row: [string, string] = [(left[i] ?? '').trim(), (right[i] ?? '').trim()];
      if (row[0] !== '' || row[1] !== '') rows.push(row);
    }
    set('left', rows.map((r) => r[0]));
    set('right', rows.map((r) => r[1]));
  }
  for (const key of ['leftLabel', 'rightLabel']) if (typeof out[key] === 'string' && (out[key] as string).trim() === '') delete out[key];
  return out;
}
