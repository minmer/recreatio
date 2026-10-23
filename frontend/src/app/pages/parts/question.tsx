/**
 * 2026-10-21 — PYTANIE: eine Frage von Cogita auf der Seite.
 *
 * In einer Präsentation ist sie ein Schritt des Przebiegs (`presentation/
 * story.ts`): nach der Antwort führt sie dorthin, wohin ihr Ausgang „dobrze"
 * oder „źle" auf dieser Szene zeigt (fehlt er: „dalej" der Szene), und die
 * Antwort zählt — im Browser (ein Beispiel) oder in Cogita, wenn die Seite mit
 * einer Bazą wiedzy verbunden ist. Auf einer gewöhnlichen Seite prüft sie nur.
 *
 * <b>Dieselbe Frage wie in Cogita</b> (die Art `question`, `cards.ts
 * questionCard`): ihre Formen, ihr Prüfen, ihr Urteil. Hier stehen nur die
 * Formen, die man ohne Werkzeug schreibt — eine von mehreren, mehrere, prawda
 * / fałsz, Text, Zahl, eine Fiszka.
 *
 * Die Ansicht mit `CardFace` (und den Stücken von Cogita) lädt erst, wenn eine
 * Seite eine Frage zeigt.
 *
 * 2026-10-23 (Schritt 13) — eine Zahl hat ihre Einheit, ihre Grösse und eine
 * Toleranz: mit Grösse zählt die Einheit der Antwort (`core/quantities.ts`).
 */

import { createElement, lazy, Suspense } from 'react';

import { definePart, text, type EditorProps, type PartContext, type RawConfig } from '../part';
import { Loading } from '../../ui/Loading';

export const QUESTION_FORMS = ['one', 'many', 'truefalse', 'text', 'number', 'flash'] as const;
export type QuestionForm = (typeof QUESTION_FORMS)[number];

export const QUESTION_FORM_LABEL: Record<QuestionForm, string> = {
  one: 'Jedna z kilku', many: 'Kilka z kilku', truefalse: 'Prawda czy fałsz', text: 'Odpowiedź słowami', number: 'Liczba', flash: 'Fiszka (sam oceniasz)'
};

export interface QuestionConfig {
  readonly form: QuestionForm;
  readonly prompt: string;
  /** one, many: die Möglichkeiten. */
  readonly options: readonly string[];
  /** one, many: welche richtig sind (ab 0). */
  readonly correct: readonly number[];
  /** text, number: was gilt; flash: die Rückseite. */
  readonly answers: readonly string[];
  /** truefalse. */
  readonly value: boolean | null;
  /** Nach der Antwort zu lesen. */
  readonly explain: string;
  /** 2026-10-23 (Schritt 13) — number: die Einheit der richtigen Antworten, die Grösse (QUDT), die erlaubte Abweichung. */
  readonly unit: string;
  readonly quantity: string;
  readonly tolerance: number;
}

const lines = (raw: RawConfig, key: string): string[] =>
  (raw[key] ?? '').split('\n').map((one) => one.trim()).filter((one) => one !== '');

export function readQuestion(raw: RawConfig): QuestionConfig {
  const form = (QUESTION_FORMS as readonly string[]).includes(raw.form ?? '') ? raw.form as QuestionForm : 'one';
  const options = lines(raw, 'options');
  return {
    form,
    prompt: text(raw, 'prompt'),
    options,
    correct: (raw.correct ?? '').split(',').map((one) => Number(one.trim())).filter((n) => Number.isInteger(n) && n >= 0 && n < options.length),
    answers: lines(raw, 'answers'),
    value: raw.value === 'tak' ? true : raw.value === 'nie' ? false : null,
    explain: text(raw, 'explain'),
    unit: text(raw, 'unit'),
    /* geprüft wird die Grösse, wo gerechnet wird (`questionCard`); hier steht sie, wie sie ist */
    quantity: text(raw, 'quantity'),
    tolerance: Math.max(0, Number((raw.tolerance ?? '').replace(',', '.')) || 0)
  };
}

/** Was noch fehlt, damit sich die Frage beantworten lässt — oder `null`. */
export function questionMissing(c: QuestionConfig): string | null {
  if (c.prompt === '' && c.form !== 'flash') return 'Wpisz pytanie.';
  if (c.form === 'one' || c.form === 'many') {
    if (c.options.length < 2) return 'Dodaj co najmniej dwie możliwości.';
    if (c.correct.length === 0) return 'Zaznacz, która możliwość jest dobra.';
  }
  if (c.form === 'truefalse' && c.value === null) return 'Wybierz, czy zdanie jest prawdziwe.';
  if ((c.form === 'text' || c.form === 'number' || c.form === 'flash') && c.answers.length === 0) return c.form === 'flash' ? 'Wpisz, co jest na odwrocie.' : 'Wpisz dobrą odpowiedź.';
  return null;
}

/** Die Frage als Eintrag der Art `question` von Cogita — `questionCard` macht daraus eine Karte. */
export function questionData(c: QuestionConfig): Record<string, unknown> {
  return {
    form: c.form === 'one' && c.correct.length > 1 ? 'many' : c.form,
    prompt: c.prompt,
    options: c.options,
    correct: c.form === 'one' ? c.correct.slice(0, 1) : c.correct,
    answers: c.answers,
    back: c.form === 'flash' ? c.answers : [],
    ...(c.value === null ? {} : { value: c.value }),
    ...(c.form === 'number' ? { unit: c.unit, tolerance: c.tolerance, ...(c.quantity === '' ? {} : { quantity: c.quantity }) } : {})
  };
}

/* -- Der Editor: die Möglichkeiten mit ihrem Häkchen, statt Nummern zu tippen ------------------ */

function QuestionEditor({ raw, onSet, busy }: EditorProps) {
  const c = readQuestion(raw);
  const options = c.options.length === 0 ? ['', ''] : c.options;
  const setOptions = (next: readonly string[], correct: readonly number[]) =>
    onSet({ options: next.join('\n'), correct: correct.filter((i) => i < next.length).join(',') });

  return (
    <div className="pb-question">
      <label className="wk-field">
        <span>Jak się odpowiada</span>
        <select value={c.form} disabled={busy} onChange={(e) => onSet({ form: e.target.value })}>
          {QUESTION_FORMS.map((one) => <option key={one} value={one}>{QUESTION_FORM_LABEL[one]}</option>)}
        </select>
      </label>
      <label className="wk-field">
        <span>{c.form === 'flash' ? 'Przód fiszki' : c.form === 'truefalse' ? 'Zdanie' : 'Pytanie'}</span>
        <textarea rows={3} value={raw.prompt ?? ''} disabled={busy} onChange={(e) => onSet({ prompt: e.target.value })} />
      </label>

      {(c.form === 'one' || c.form === 'many') && (
        <fieldset className="wk-field pb-question-options">
          <legend>Możliwości — zaznacz {c.form === 'one' ? 'dobrą' : 'dobre'}</legend>
          {options.map((one, i) => (
            <span key={i} className="pb-question-option">
              <input type={c.form === 'one' ? 'radio' : 'checkbox'} name={`q-${raw.prompt ?? ''}`} checked={c.correct.includes(i)} disabled={busy}
                aria-label={`Możliwość ${i + 1} jest dobra`}
                onChange={() => setOptions(options, c.form === 'one' ? [i] : c.correct.includes(i) ? c.correct.filter((x) => x !== i) : [...c.correct, i])} />
              <input value={one} disabled={busy} placeholder={`Możliwość ${i + 1}`} aria-label={`Możliwość ${i + 1}`}
                onChange={(e) => setOptions(options.map((o, k) => (k === i ? e.target.value : o)), c.correct)} />
              {options.length > 2 && (
                <button type="button" className="wk-link-btn" disabled={busy} aria-label={`Usuń możliwość ${i + 1}`}
                  onClick={() => setOptions(options.filter((_, k) => k !== i), c.correct.filter((x) => x !== i).map((x) => (x > i ? x - 1 : x)))}>×</button>
              )}
            </span>
          ))}
          <button type="button" className="wk-link-btn" disabled={busy || options.length >= 12} onClick={() => setOptions([...options, ''], c.correct)}>+ możliwość</button>
        </fieldset>
      )}

      {c.form === 'truefalse' && (
        <fieldset className="wk-field">
          <legend>To zdanie jest</legend>
          <label className="wk-check"><input type="radio" checked={c.value === true} disabled={busy} onChange={() => onSet({ value: 'tak' })} /><span>prawdziwe</span></label>
          <label className="wk-check"><input type="radio" checked={c.value === false} disabled={busy} onChange={() => onSet({ value: 'nie' })} /><span>fałszywe</span></label>
        </fieldset>
      )}

      {(c.form === 'text' || c.form === 'number' || c.form === 'flash') && (
        <label className="wk-field">
          <span>{c.form === 'flash' ? 'Odwrotna strona' : 'Dobre odpowiedzi — każda w osobnej linii'}</span>
          <textarea rows={3} value={raw.answers ?? ''} disabled={busy} onChange={(e) => onSet({ answers: e.target.value })} />
        </label>
      )}

      {/* 2026-10-23 (Schritt 13) — eine Zahl: Einheit, Grösse, Toleranz. */}
      {c.form === 'number' && <Suspense fallback={null}><LazyNumber raw={raw} c={c} busy={busy} onSet={onSet} /></Suspense>}

      <label className="wk-field">
        <span>Wyjaśnienie po odpowiedzi</span>
        <textarea rows={2} value={raw.explain ?? ''} disabled={busy} onChange={(e) => onSet({ explain: e.target.value })} />
      </label>
    </div>
  );
}

/* 2026-10-23 (Schritt 13) — Einheit, Grösse, Toleranz einer Zahl: erst im Editor geladen (die Liste der Einheiten). */
const LazyNumber = lazy(() => import('./questionNumber'));

/* -- Die Ansicht, erst geladen, wenn sie gezeigt wird ------------------------------------------- */

const LazyView = lazy(() => import('./questionView'));

function QuestionView({ config, ctx }: { config: QuestionConfig; ctx: PartContext }) {
  return createElement(Suspense, { fallback: createElement(Loading, {}) }, createElement(LazyView, { config, ctx }));
}

export const questionPart = definePart<QuestionConfig>({
  kind: 'question',
  example: { form: 'one', prompt: 'Ile jest sakramentów?', options: 'Pięć\nSiedem\nDwanaście', correct: '1', answers: 'siedem\n7', value: 'tak', explain: 'Chrzest, bierzmowanie, Eucharystia, pokuta, namaszczenie chorych, kapłaństwo, małżeństwo.', unit: 'szt.', quantity: 'Dimensionless', tolerance: '0' },
  label: 'Pytanie',
  use: 'Pytanie z odpowiedzią do sprawdzenia. W prezentacji — krok przebiegu: po dobrej i po złej odpowiedzi może prowadzić w inne miejsce, a odpowiedzi liczą się w przeglądarce albo w Cogicie.',
  box: { colSpan: 4, rowSpan: 3 },
  fields: [],
  extra: [
    { key: 'form', shape: 'line', says: '"one" — jedna z kilku, "many" — kilka, "truefalse", "text", "number", "flash" — fiszka' },
    { key: 'prompt', shape: 'lines', says: 'treść pytania (przy fiszce: przód)' },
    { key: 'options', shape: 'lines', says: 'możliwości, każda w osobnej linii (one, many)' },
    { key: 'correct', shape: 'line', says: 'numery dobrych możliwości od 0, po przecinku, np. "1" albo "0,2"' },
    { key: 'answers', shape: 'lines', says: 'dobre odpowiedzi, każda w osobnej linii (text, number); odwrotna strona (flash)' },
    { key: 'value', shape: 'line', says: '"tak" albo "nie" — czy zdanie jest prawdziwe (truefalse)' },
    { key: 'explain', shape: 'lines', says: 'wyjaśnienie pokazywane po odpowiedzi' },
    { key: 'unit', shape: 'line', says: 'jednostka dobrych odpowiedzi, np. "N·m" (number)' },
    { key: 'quantity', shape: 'line', says: 'wielkość (number) — np. "Torque" (moment siły), "Energy", "Mass", "Length"; wtedy odpowiedź w innej jednostce tej wielkości jest przeliczana, a jednostka innej wielkości jest błędem ("12 J" na pytanie o moment siły)' },
    { key: 'tolerance', shape: 'line', says: 'ile wolno się pomylić, w jednostce pytania, np. "0,5" (number)' }
  ],
  read: readQuestion,
  hasContent: (c) => questionMissing(c) === null,
  missing: questionMissing,
  View: QuestionView,
  Editor: QuestionEditor,
  shows: (c, size) => size.height === 'strip'
    ? `${QUESTION_FORM_LABEL[c.form]}: pytanie i odpowiedź w jednym pasku.`
    : `${QUESTION_FORM_LABEL[c.form]} — pytanie, odpowiedź, ocena i wyjaśnienie; w prezentacji potem „Dalej" tam, dokąd prowadzi wynik.`
});
