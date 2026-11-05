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

import { t, useT } from '../../core/i18n';
import { text, type EditorProps, type PartContext, type RawConfig } from '../part';
import { Loading } from '../../ui/Loading';
import { defineTextPart, texts, withTexts } from './partTexts';

export const QUESTION_FORMS = ['one', 'many', 'truefalse', 'text', 'number', 'flash'] as const;
export type QuestionForm = (typeof QUESTION_FORMS)[number];

export const QUESTION_FORM_LABEL: Readonly<Record<QuestionForm, string>> = texts({
  one: 'moduleDataLearn.question.form.one', many: 'moduleDataLearn.question.form.many', truefalse: 'moduleDataLearn.question.form.truefalse', text: 'moduleDataLearn.question.form.text', number: 'moduleDataLearn.question.form.number', flash: 'moduleDataLearn.question.form.flash'
});

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
  /** 2026-11-03 (G) — eine echte Frage der Baza der Erzählung (Kennung oder @name): die Antwort liegt auf ihrer Karte. */
  readonly question: string;
  /** 2026-11-03 (G) — die eigene Frage zählt zusätzlich für diese Einträge der Baza (Kennungen oder @name). */
  readonly about: readonly string[];
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
    tolerance: Math.max(0, Number((raw.tolerance ?? '').replace(',', '.')) || 0),
    question: text(raw, 'question'),
    about: (raw.about ?? '').split(/[\n,]/).map((one) => one.trim()).filter((one) => one !== '')
  };
}

/** Was noch fehlt, damit sich die Frage beantworten lässt — oder `null`. */
export function questionMissing(c: QuestionConfig): string | null {
  /* 2026-11-03 (G) — eine echte Frage der Baza bringt alles mit. */
  if (c.question !== '') return null;
  if (c.prompt === '' && c.form !== 'flash') return t('moduleDataLearn.question.missPrompt');
  if (c.form === 'one' || c.form === 'many') {
    if (c.options.length < 2) return t('moduleDataLearn.question.missOptions');
    if (c.correct.length === 0) return t('moduleDataLearn.question.missCorrect');
  }
  if (c.form === 'truefalse' && c.value === null) return t('moduleDataLearn.question.missValue');
  if ((c.form === 'text' || c.form === 'number' || c.form === 'flash') && c.answers.length === 0) return c.form === 'flash' ? t('moduleDataLearn.question.missBack') : t('moduleDataLearn.question.missAnswer');
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
  const t = useT();
  const c = readQuestion(raw);
  const options = c.options.length === 0 ? ['', ''] : c.options;
  const setOptions = (next: readonly string[], correct: readonly number[]) =>
    onSet({ options: next.join('\n'), correct: correct.filter((i) => i < next.length).join(',') });

  return (
    <div className="pb-question">
      <label className="wk-field">
        <span>{t('moduleDataLearn.question.how')}</span>
        <select value={c.form} disabled={busy} onChange={(e) => onSet({ form: e.target.value })}>
          {QUESTION_FORMS.map((one) => <option key={one} value={one}>{t(`moduleDataLearn.question.form.${one}`)}</option>)}
        </select>
      </label>
      <label className="wk-field">
        <span>{c.form === 'flash' ? t('moduleDataLearn.question.front') : c.form === 'truefalse' ? t('moduleDataLearn.question.sentence') : t('moduleDataLearn.question.label')}</span>
        <textarea rows={3} value={raw.prompt ?? ''} disabled={busy} onChange={(e) => onSet({ prompt: e.target.value })} />
      </label>

      {(c.form === 'one' || c.form === 'many') && (
        <fieldset className="wk-field pb-question-options">
          <legend>{c.form === 'one' ? t('moduleDataLearn.question.optionsOne') : t('moduleDataLearn.question.optionsMany')}</legend>
          {options.map((one, i) => (
            <span key={i} className="pb-question-option">
              <input type={c.form === 'one' ? 'radio' : 'checkbox'} name={`q-${raw.prompt ?? ''}`} checked={c.correct.includes(i)} disabled={busy}
                aria-label={t('moduleDataLearn.question.optionCorrect', { n: i + 1 })}
                onChange={() => setOptions(options, c.form === 'one' ? [i] : c.correct.includes(i) ? c.correct.filter((x) => x !== i) : [...c.correct, i])} />
              <input value={one} disabled={busy} placeholder={t('moduleDataLearn.question.option', { n: i + 1 })} aria-label={t('moduleDataLearn.question.option', { n: i + 1 })}
                onChange={(e) => setOptions(options.map((o, k) => (k === i ? e.target.value : o)), c.correct)} />
              {options.length > 2 && (
                <button type="button" className="wk-link-btn" disabled={busy} aria-label={t('moduleDataLearn.question.optionRemove', { n: i + 1 })}
                  onClick={() => setOptions(options.filter((_, k) => k !== i), c.correct.filter((x) => x !== i).map((x) => (x > i ? x - 1 : x)))}>×</button>
              )}
            </span>
          ))}
          <button type="button" className="wk-link-btn" disabled={busy || options.length >= 12} onClick={() => setOptions([...options, ''], c.correct)}>{t('moduleDataLearn.question.optionAdd')}</button>
        </fieldset>
      )}

      {c.form === 'truefalse' && (
        <fieldset className="wk-field">
          <legend>{t('moduleDataLearn.question.sentenceIs')}</legend>
          <label className="wk-check"><input type="radio" checked={c.value === true} disabled={busy} onChange={() => onSet({ value: 'tak' })} /><span>{t('moduleDataLearn.question.true')}</span></label>
          <label className="wk-check"><input type="radio" checked={c.value === false} disabled={busy} onChange={() => onSet({ value: 'nie' })} /><span>{t('moduleDataLearn.question.false')}</span></label>
        </fieldset>
      )}

      {(c.form === 'text' || c.form === 'number' || c.form === 'flash') && (
        <label className="wk-field">
          <span>{c.form === 'flash' ? t('moduleDataLearn.question.back') : t('moduleDataLearn.question.answers')}</span>
          <textarea rows={3} value={raw.answers ?? ''} disabled={busy} onChange={(e) => onSet({ answers: e.target.value })} />
        </label>
      )}

      {/* 2026-10-23 (Schritt 13) — eine Zahl: Einheit, Grösse, Toleranz. */}
      {c.form === 'number' && <Suspense fallback={null}><LazyNumber raw={raw} c={c} busy={busy} onSet={onSet} /></Suspense>}

      <label className="wk-field">
        <span>{t('moduleDataLearn.question.explain')}</span>
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

export const questionPart = defineTextPart<QuestionConfig>({
  kind: 'question',
  example: withTexts({ form: 'one', correct: '1', value: 'tak', quantity: 'Dimensionless', tolerance: '0', about: '@kurs/sakramenty' }, texts({ prompt: 'moduleDataLearn.question.exPrompt', options: 'moduleDataLearn.question.exOptions', answers: 'moduleDataLearn.question.exAnswers', explain: 'moduleDataLearn.question.exExplain', unit: 'moduleDataLearn.question.exUnit', question: 'moduleDataLearn.question.exQuestion' })),
  box: { colSpan: 4, rowSpan: 3 },
  fields: [],
  extra: [
    withTexts({ key: 'form', shape: 'line' } as const, texts({ says: 'moduleDataLearn.question.sForm' })),
    withTexts({ key: 'prompt', shape: 'lines' } as const, texts({ says: 'moduleDataLearn.question.sPrompt' })),
    withTexts({ key: 'options', shape: 'lines' } as const, texts({ says: 'moduleDataLearn.question.sOptions' })),
    withTexts({ key: 'correct', shape: 'line' } as const, texts({ says: 'moduleDataLearn.question.sCorrect' })),
    withTexts({ key: 'answers', shape: 'lines' } as const, texts({ says: 'moduleDataLearn.question.sAnswers' })),
    withTexts({ key: 'value', shape: 'line' } as const, texts({ says: 'moduleDataLearn.question.sValue' })),
    withTexts({ key: 'explain', shape: 'lines' } as const, texts({ says: 'moduleDataLearn.question.sExplain' })),
    withTexts({ key: 'unit', shape: 'line' } as const, texts({ says: 'moduleDataLearn.question.sUnit' })),
    withTexts({ key: 'quantity', shape: 'line' } as const, texts({ says: 'moduleDataLearn.question.sQuantity' })),
    withTexts({ key: 'tolerance', shape: 'line' } as const, texts({ says: 'moduleDataLearn.question.sTolerance' })),
    withTexts({ key: 'question', shape: 'line' } as const, texts({ says: 'moduleDataLearn.question.sQuestion' })),
    withTexts({ key: 'about', shape: 'lines' } as const, texts({ says: 'moduleDataLearn.question.sAbout' }))
  ],
  read: readQuestion,
  hasContent: (c) => questionMissing(c) === null,
  missing: questionMissing,
  View: QuestionView,
  Editor: QuestionEditor,
  shows: (c, size) => size.height === 'strip'
    ? t('moduleDataLearn.question.showsStrip', { form: QUESTION_FORM_LABEL[c.form] })
    : t('moduleDataLearn.question.showsBlock', { form: QUESTION_FORM_LABEL[c.form] })
}, texts({ label: 'moduleDataLearn.question.label', use: 'moduleDataLearn.question.use' }));
