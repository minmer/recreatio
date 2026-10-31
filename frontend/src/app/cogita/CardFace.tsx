/**
 * COGITA — EINE KARTE: die Frage, die Antwort in ihrer Form (zwölf Formen,
 * [D3]), und danach, was richtig war — mit dem Vergleich Zeichen für Zeichen
 * und dem Wissen, das sie erklärt [D14].
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { checkCard } from './cards';
import { shuffleAway, type Card, type PromptPart } from './cardBasics';
import { PRECISION_ASK, spansOf, type Outcome, type TextRule } from './check';
import { ExplainList } from './EntityReading';
import { OrderAnswer } from './OrderAnswer';
import { evaluateCode } from './python';
import { GeoMap } from './GeoMap';
import { InteractiveAnswer, InteractiveReplay } from './InteractiveAnswer';
import { givenValuesText, solutionText } from './interactive';
import { fieldText, fieldsOf, labelOf, type Entity } from './schema';
import type { CogitaLibrary } from './store';
import { Markup, MediaView, percent } from './ui';
import { StatementCard } from '../library/markupView';
import { blocksField } from './statements';

/* -- Die Frage ----------------------------------------------------------------------- */

export function CardPrompt({ parts }: { parts: readonly PromptPart[] }) {
  if (parts.length === 0) return null;
  return (
    <div className="cg-prompt">
      {parts.map((p, i) => (
        <div key={i} className="cg-prompt-media">
          {p.media !== undefined && <MediaView media={p.media} />}
          {p.text !== '' && <Markup text={p.text} />}
        </div>
      ))}
    </div>
  );
}

/** Was als richtig galt, in Worten. */
export function answerText(card: Card): string {
  const a = card.answer;
  switch (a.form) {
    case 'text':
    case 'gap': return a.accepted[0] ?? '';
    case 'number': return `${String(a.values[0] ?? '').replace('.', ',')}${a.unit === '' ? '' : ` ${a.unit}`}`;
    case 'date': return a.values[0] ?? '';
    case 'one': return a.options[a.correct] ?? '';
    case 'many': return a.correct.map((i) => a.options[i]).join(', ');
    case 'truefalse': return a.value ? 'prawda' : 'fałsz';
    case 'order': return a.items.join(' → ');
    case 'match': return a.pairs.map(([l, r]) => `${a.left[l]} — ${a.right[r]}`).join('; ');
    case 'flash': return a.back.join(' · ');
    case 'code': return 'kod, który przechodzi wszystkie przypadki';
    case 'point': return 'lat' in a.target ? `${a.target.lat.toFixed(4)}, ${a.target.lon.toFixed(4)}` : 'zaznaczony punkt';
    case 'interactive': return solutionText(a) ?? 'cel rysunku osiągnięty';
  }
}

/** Was gegeben wurde, kurz — für die Antwort, die gespeichert wird. */
export function givenText(card: Card, given: unknown): string {
  const a = card.answer;
  if (typeof given === 'string') return given;
  if (a.form === 'one' && typeof given === 'number') return a.options[given] ?? '';
  if (a.form === 'many' && Array.isArray(given)) return given.map((i) => a.options[Number(i)] ?? '').join(', ');
  if (a.form === 'truefalse') return given === true ? 'prawda' : given === false ? 'fałsz' : '';
  if (a.form === 'order' && Array.isArray(given)) return given.join(' → ');
  if (a.form === 'match' && Array.isArray(given)) return given.map((p) => (Array.isArray(p) ? `${a.left[p[0]]}—${a.right[p[1]]}` : '')).join('; ');
  if (a.form === 'code' && typeof given === 'object' && given !== null) return `${(given as { passed?: number }).passed ?? 0}/${(given as { total?: number }).total ?? 0}`;
  if (a.form === 'point' && typeof given === 'object' && given !== null) return JSON.stringify(given);
  if (a.form === 'interactive') return givenValuesText(a, given);
  return given === undefined || given === null ? '' : String(given);
}

/* -- Die Antwort ------------------------------------------------------------------------ */

/** Die Paare, und was gerade auf sein Gegenstück wartet — EIN Zustand, damit schnelles Tippen nichts verliert. */
interface Pairing {
  readonly pairs: Readonly<Record<number, number>>;
  readonly pick: { readonly side: 'l' | 'r'; readonly at: number } | null;
}

const NO_PAIRS: Pairing = { pairs: {}, pick: null };

/*
  2026-10-18 — PAARE DURCH ANTIPPEN: ein Wort auf einer Seite, dann sein
  Gegenstück auf der anderen (gleich, auf welcher man beginnt). Ein schon
  verbundenes antippen löst sein Paar und wählt es neu — so korrigiert man;
  das gewählte noch einmal antippen wählt es ab.
*/
function tapPair(was: Pairing, side: 'l' | 'r', at: number): Pairing {
  const without = (drop: (l: number, r: number) => boolean): Record<number, number> =>
    Object.fromEntries(Object.entries(was.pairs).filter(([l, r]) => !drop(Number(l), r)));
  const { pick } = was;
  if (pick !== null && pick.side !== side) {
    const l = side === 'l' ? at : pick.at;
    const r = side === 'r' ? at : pick.at;
    return { pairs: { ...without((x, y) => x === l || y === r), [l]: r }, pick: null };
  }
  if (pick !== null && pick.at === at) return { pairs: was.pairs, pick: null };
  return { pairs: without((x, y) => (side === 'l' ? x === at : y === at)), pick: { side, at } };
}

/** 2026-10-31 — eine Mischung für den Bildschirm: Stelle auf dem Bildschirm → Stelle in der Karte; ab zwei nie die gespeicherte. */
const shownOrder = (n: number): number[] => shuffleAway(Array.from({ length: n }, (_, i) => i), Math.random);

/** ✓ an dem, was richtig ist (gewählt oder nicht), ✗ an dem, was falsch gewählt ist — die Farbe ist nie das einzige Zeichen. */
const glyph = (right: boolean, chosen: boolean): string => (right ? '✓' : chosen ? '✗' : '');

/** Was der Lernende bei einer Datumsfrage eintippt — zur verlangten Genauigkeit. */
const DATE_HINT: Readonly<Record<'year' | 'month' | 'day', string>> = {
  year: 'rok, np. 1410',
  month: 'np. 7.1410 albo 1410-07',
  day: 'np. 15.07.1410 albo 1410-07-15'
};

export function AnswerInput({ card, disabled, onSubmit, autoFocus = true, reveal, onNext, nextLabel = 'Dalej' }: {
  card: Card;
  disabled?: boolean;
  onSubmit: (given: unknown) => void;
  autoFocus?: boolean;
  /** 2026-10-18 — nach der Antwort bleibt alles, wo es war: gesperrt, die richtigen grün, die falsch gewählten rot. */
  reveal?: { readonly outcome: Outcome; readonly given: unknown };
  /** 2026-10-31 — nach der Prüfung wird „Sprawdź” an derselben Stelle zu „Dalej”. */
  onNext?: () => void;
  nextLabel?: string;
}) {
  const a = card.answer;
  const shut = disabled === true || reveal !== undefined;
  /* Grün, was richtig ist; rot, was gewählt und falsch ist. */
  const mark = (right: boolean, chosen: boolean): string => (reveal === undefined ? '' : right ? ' is-right' : chosen ? ' is-wrong' : '');
  const [text, setText] = useState('');
  const [many, setMany] = useState<ReadonlySet<number>>(new Set());
  const [order, setOrder] = useState<readonly string[]>([]);
  const [pairing, setPairing] = useState<Pairing>(NO_PAIRS);
  const [flipped, setFlipped] = useState(false);
  const [code, setCode] = useState(a.form === 'code' ? a.starter : '');
  const [running, setRunning] = useState(false);
  const [point, setPoint] = useState<{ lat: number; lon: number } | null>(null);
  const field = useRef<HTMLInputElement | null>(null);
  /*
   * 2026-10-31 — JEDES ZEIGEN NEU GEMISCHT: die Möglichkeiten einer Wahl, die rechte Spalte der Paare, die Startfolge
   * beim Ordnen (nie die richtige). Die linke Spalte steht, wie die Karte sie mischte (`shuffledPairs`: nie in der
   * gespeicherten, oft zeitlichen Folge — ein zweites Mischen hier könnte genau sie zurückbringen). Gegeben wird weiter
   * in den Stellen der Karte — Prüfung und Wortlaut bleiben gleich.
   */
  const view = useMemo(() => ({
    options: a.form === 'one' || a.form === 'many' ? shownOrder(a.options.length) : [],
    left: a.form === 'match' ? a.left.map((_l, i) => i) : [],
    right: a.form === 'match' ? shownOrder(a.right.length) : [],
    start: a.form === 'order' ? shuffleAway(a.items, Math.random) : []
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [card.key, card.fingerprint]);

  useEffect(() => {
    setText(''); setMany(new Set()); setOrder(view.start); setPairing(NO_PAIRS); setFlipped(false);
    setCode(a.form === 'code' ? a.starter : ''); setPoint(null);
    if (autoFocus) window.setTimeout(() => field.current?.focus(), 30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.key, card.fingerprint]);

  const submit = (given: unknown) => { if (!shut) onSubmit(given); };
  const tap = (side: 'l' | 'r', at: number) => setPairing((was) => tapPair(was, side, at));
  /* Nach der Prüfung: „Dalej” an der Stelle von „Sprawdź” (oder dort, wo es stünde), gleich im Fokus. */
  const next = reveal !== undefined && onNext !== undefined
    /* Ein eigener Schlüssel: React baut den Knopf neu, statt „Sprawdź” umzubeschriften — nur so greift `autoFocus`. */
    ? <button key="next" type="button" className="wk-btn cg-next" autoFocus data-card-next="" onClick={onNext}>{nextLabel}</button>
    : null;
  const nextRow = next === null ? null : <div className="cg-answer-actions">{next}</div>;

  switch (a.form) {
    case 'text':
    case 'number':
    case 'date':
    case 'gap':
      return (
        <form className="cg-answer" onSubmit={(e) => { e.preventDefault(); submit(text); }}>
          {a.form === 'gap' && <div className="cg-prompt">{a.shown}</div>}
          {/* 2026-10-31 — jede Datumsfrage sagt, wie genau: das Jahr genügt, oder der Tag. */}
          {a.form === 'date' && <p className="cg-precision" data-precision={a.precision}>{PRECISION_ASK[a.precision]}</p>}
          <div className="cg-row">
            <input ref={field} type="text" className={reveal === undefined ? undefined : reveal.outcome.correct ? 'is-right' : reveal.outcome.correctness > 0.5 ? 'is-near' : 'is-wrong'} inputMode={a.form === 'number' ? 'decimal' : undefined} value={text} disabled={shut}
              placeholder={a.form === 'date' ? DATE_HINT[a.precision] : a.form === 'number' ? (a.quantity === undefined ? 'liczba' : 'liczba, może z jednostką') : 'odpowiedź'}
              aria-label={a.form === 'date' ? `Odpowiedź — ${PRECISION_ASK[a.precision].toLowerCase()}` : 'Odpowiedź'} onChange={(e) => setText(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} />
            {a.form === 'number' && a.unit !== '' && <span>{a.unit}</span>}
            {next ?? <button key="check" type="submit" className="wk-btn" disabled={shut}>Sprawdź</button>}
          </div>
        </form>
      );
    case 'one':
      return (
        <div className="cg-answer">
          <div className="cg-options" role="radiogroup">
            {view.options.map((i) => {
              const g = reveal === undefined ? '' : glyph(i === a.correct, reveal.given === i);
              return (
                <button key={i} type="button" role="radio" aria-checked={reveal?.given === i} className={`cg-option${mark(i === a.correct, reveal?.given === i)}`} disabled={shut} onClick={() => submit(i)}>
                  <span className="cg-option-text">{a.options[i]}</span>
                  {g !== '' && <span className="cg-option-mark" aria-label={g === '✓' ? 'dobra odpowiedź' : 'zła odpowiedź'}>{g}</span>}
                </button>
              );
            })}
          </div>
          {nextRow}
        </div>
      );
    case 'many':
      return (
        <div className="cg-answer">
          <div className="cg-options">
            {view.options.map((i) => {
              const g = reveal === undefined ? '' : glyph(a.correct.includes(i), many.has(i));
              return (
                <button key={i} type="button" className={`cg-option${reveal === undefined ? (many.has(i) ? ' is-on' : '') : mark(a.correct.includes(i), many.has(i))}`} aria-pressed={many.has(i)} disabled={shut}
                  onClick={() => setMany((was) => { const next2 = new Set(was); if (next2.has(i)) next2.delete(i); else next2.add(i); return next2; })}>
                  <span aria-hidden>{many.has(i) ? '☑' : '☐'}</span>
                  <span className="cg-option-text">{a.options[i]}</span>
                  {g !== '' && <span className="cg-option-mark" aria-label={g === '✓' ? (many.has(i) ? 'dobrze zaznaczone' : 'trzeba było zaznaczyć') : 'źle zaznaczone'}>{g}</span>}
                </button>
              );
            })}
          </div>
          {next ?? <button key="check" type="button" className="wk-btn" disabled={shut} onClick={() => submit([...many].sort((x, y) => x - y))}>Sprawdź</button>}
        </div>
      );
    case 'truefalse': {
      const tf = (value: boolean, label: string) => {
        const g = reveal === undefined ? '' : glyph(a.value === value, reveal.given === value);
        return (
          <button type="button" className={`cg-option${mark(a.value === value, reveal?.given === value)}`} disabled={shut} onClick={() => submit(value)}>
            <span className="cg-option-text">{label}</span>{g !== '' && <span className="cg-option-mark" aria-hidden>{g}</span>}
          </button>
        );
      };
      return (
        <div className="cg-answer">
          <div className="cg-options cg-options-two">{tf(true, 'Prawda')}{tf(false, 'Fałsz')}</div>
          {nextRow}
        </div>
      );
    }
    case 'order':
      return (
        <div className="cg-answer">
          {/* Der Knopf steht zwischen der Liste und ihrem Ergebnis: „Dalej” bleibt genau dort, wo „Sprawdź” war. */}
          <OrderAnswer key={`${card.key}:${card.fingerprint}`} start={view.start} correct={a.items} locked={shut}
            {...(reveal === undefined ? {} : { given: Array.isArray(reveal.given) ? reveal.given.map(String) : [] })} onOrder={setOrder}
            action={next ?? <button key="check" type="button" className="wk-btn" disabled={shut} onClick={() => submit(order)}>Sprawdź</button>} />
        </div>
      );
    case 'match': {
      const { pairs, pick } = pairing;
      if (reveal !== undefined) return <MatchResult card={card} given={reveal.given} leftOrder={view.left} next={next} />;
      /* Ein Paar trägt auf beiden Seiten dieselbe Nummer — gezählt in der Folge der linken Spalte, wie sie dasteht. */
      const lefts = view.left.filter((l) => pairs[l] !== undefined);
      const leftOf = (r: number) => lefts.find((l) => pairs[l] === r);
      const item = (side: 'l' | 'r', at: number, label: string, paired: number | undefined) => {
        const on = pick?.side === side && pick.at === at;
        const n = paired === undefined ? 0 : lefts.indexOf(paired) + 1;
        return (
          <button key={at} type="button" className={`cg-option${on ? ' is-on' : ''}${n > 0 ? ' is-paired' : ''}`} aria-pressed={on} disabled={shut}
            aria-label={n > 0 ? `${label} — para ${n}` : label} onClick={() => tap(side, at)}>
            {n > 0 && <span className="cg-match-n" aria-hidden>{n}</span>}<span className="cg-option-text">{label}</span>
          </button>
        );
      };
      return (
        <div className="cg-answer">
          <p className="cg-muted">Wybierz pozycję z jednej strony, potem jej parę z drugiej. Ponowne wybranie rozłącza parę.</p>
          <div className="cg-match">
            {/* 2026-10-27 — was die Spalten sind („Rok” — „Wydarzenie”). 2026-10-31 — beide Spalten gemischt, jede für sich. */}
            <div className="cg-match-side" data-match-side="left">{a.heads !== undefined && a.heads[0] !== '' && <span className="cg-match-head">{a.heads[0]}</span>}{view.left.map((i) => item('l', i, a.left[i]!, pairs[i] === undefined ? undefined : i))}</div>
            <div className="cg-match-side" data-match-side="right">{a.heads !== undefined && a.heads[1] !== '' && <span className="cg-match-head">{a.heads[1]}</span>}{view.right.map((j) => item('r', j, a.right[j]!, leftOf(j)))}</div>
          </div>
          <button type="button" className="wk-btn" disabled={shut || lefts.length === 0} onClick={() => submit(lefts.map((l) => [l, pairs[l]]))}>
            Sprawdź{lefts.length > 0 && lefts.length < a.left.length ? ` (${lefts.length} z ${a.left.length})` : ''}
          </button>
        </div>
      );
    }
    case 'flash':
      return flipped || reveal !== undefined ? (
        <div className="cg-answer">
          {/* 2026-10-27 — ein Block je Zeile, kein <p>: der Zapis bringt seine eigenen Absätze mit (<p> in <p> ist kein HTML). */}
          <div className="cg-flash-back">{a.back.map((b, i) => <div key={i}><Markup text={b} /></div>)}</div>
          <div className="cg-row">
            <button type="button" className={`cg-option${reveal?.given === 'knew' ? ' is-right' : ''}`} disabled={shut} onClick={() => submit('knew')}>Umiałem</button>
            <button type="button" className={`cg-option${reveal?.given === 'partly' ? ' is-on' : ''}`} disabled={shut} onClick={() => submit('partly')}>Częściowo</button>
            <button type="button" className={`cg-option${reveal?.given === 'not' ? ' is-wrong' : ''}`} disabled={shut} onClick={() => submit('not')}>Nie umiałem</button>
          </div>
          {nextRow}
        </div>
      ) : (
        <button type="button" className="wk-btn" disabled={shut} onClick={() => setFlipped(true)}>Pokaż odpowiedź</button>
      );
    case 'code':
      return (
        <div className="cg-answer">
          {a.task !== '' && <Markup text={a.task} />}
          <textarea className="cg-code" spellCheck={false} value={code} disabled={shut || running} onChange={(e) => setCode(e.target.value)} aria-label="Kod" />
          {next ?? <button key="check" type="button" className="wk-btn" disabled={shut || running} onClick={() => {
            setRunning(true);
            void evaluateCode({ createInput: a.createInput, reference: a.reference, learner: code, cases: a.cases, seed: Date.now() % 100000 })
              .then((v) => submit({ passed: v.passed, total: v.total, status: v.status, error: v.error ?? null }))
              .finally(() => setRunning(false));
          }}>{running ? 'Python liczy… (za pierwszym razem ładuje się ok. 10 MB)' : 'Sprawdź kod'}</button>}
        </div>
      );
    case 'point':
      return (
        <div className="cg-answer">
          {a.on === 'map' ? (
            <GeoMap zoom={6} center={{ lat: 51.9, lon: 19.1 }} marks={point === null ? [] : [{ ...point, kind: 'pin' }]} onPick={shut ? undefined : setPoint} />
          ) : <p className="cg-muted">Wskaż punkt na obrazie pytania.</p>}
          {next ?? <button key="check" type="button" className="wk-btn" disabled={shut || point === null} onClick={() => submit(point)}>Sprawdź</button>}
        </div>
      );
    case 'interactive':
      return <div className="cg-answer"><InteractiveAnswer card={card} disabled={shut} onSubmit={submit} />{nextRow}</div>;
  }
}

/**
 * 2026-10-31 — PAARE NACH DER PRÜFUNG, auf der eigenen Antwort: je linkes Stück, womit es verbunden wurde, ✓ oder ✗;
 * ein falsches (oder fehlendes) Paar nennt sein richtiges Gegenstück. Darüber, wie viele Paare stimmen.
 */
function MatchResult({ card, given, leftOrder, next }: { card: Card; given: unknown; leftOrder: readonly number[]; next: ReactNode }) {
  const a = card.answer;
  if (a.form !== 'match') return null;
  const mine = new Map<number, number>();
  for (const p of Array.isArray(given) ? given : []) if (Array.isArray(p) && typeof p[0] === 'number' && typeof p[1] === 'number') mine.set(p[0], p[1]);
  const truth = new Map(a.pairs.map(([l, r]) => [l, r]));
  const right = a.pairs.filter(([l, r]) => mine.get(l) === r).length;
  return (
    <div className="cg-answer">
      <p className="cg-order-count" data-match-count={right}>{right} z {a.pairs.length} {a.pairs.length === 1 ? 'pary' : 'par'} dobrze</p>
      {a.heads !== undefined && (a.heads[0] !== '' || a.heads[1] !== '') && <div className="cg-match-row is-head" aria-hidden><span /><span>{a.heads[0]}</span><span>{a.heads[1]}</span></div>}
      <ul className="cg-match-result" data-match-result="">
        {leftOrder.map((l) => {
          const chosen = mine.get(l);
          const want = truth.get(l);
          const ok = chosen !== undefined && chosen === want;
          return (
            <li key={l} className={`cg-match-row ${ok ? 'is-right' : 'is-wrong'}`} data-match-pair={ok ? 'right' : chosen === undefined ? 'missing' : 'wrong'}>
              <span className="cg-option-mark" aria-label={ok ? 'dobrze' : 'źle'}>{ok ? '✓' : '✗'}</span>
              <span className="cg-match-left">{a.left[l]}</span>
              <span className="cg-match-right">
                {chosen === undefined ? <em className="cg-muted">bez pary</em> : <span className={ok ? undefined : 'cg-struck'}>{a.right[chosen]}</span>}
                {!ok && want !== undefined && <span className="cg-match-fix">dobrze: <strong>{a.right[want]}</strong></span>}
              </span>
            </li>
          );
        })}
      </ul>
      {next}
    </div>
  );
}

/* -- Was richtig war ------------------------------------------------------------------------- */

/** Formen, deren Antwort nach der Prüfung mit ihren Marken stehen bleibt — dort steht das Ergebnis, nicht in einem langen Satz. */
const MARKED_FORMS: ReadonlySet<string> = new Set(['one', 'many', 'truefalse', 'order', 'match']);

export function Verdict({ card, outcome, given, lib, onEntity, extra, showGiven = true, marked = false }: {
  card: Card;
  outcome: Outcome;
  given: unknown;
  /** Die eigene Antwort noch einmal nennen — nicht, wo sie ohnehin sichtbar stehen bleibt. */
  showGiven?: boolean;
  /** 2026-10-31 — die eigene Antwort steht mit ✓/✗ darüber: Wahl, Reihenfolge und Paare brauchen dann keinen Satz „Poprawnie: …”. */
  marked?: boolean;
  lib?: CogitaLibrary;
  onEntity?: (id: string) => void;
  extra?: ReactNode;
}) {
  const level = outcome.correct ? 'is-right' : outcome.correctness > 0.5 ? 'is-near' : 'is-wrong';
  const expected = outcome.expected ?? answerText(card);
  const a = card.answer;
  const others = a.form === 'text' || a.form === 'gap' ? a.accepted.filter((x) => x.trim().toLowerCase() !== expected.trim().toLowerCase()) : [];
  const onAnswer = marked && MARKED_FORMS.has(a.form);
  /* 2026-10-31 — zuerst das Thema der Frage („O czym”), dann, was sie zur Erklärung nennt; alles zugeklappt. */
  const explainIds = lib === undefined ? [] : [...(card.about ?? []), ...card.explain];
  const box = (
    <div className={`cg-verdict ${level}`} role="status" data-verdict={outcome.correct ? 'right' : outcome.correctness > 0.5 ? 'near' : 'wrong'}>
      <strong><span aria-hidden>{outcome.correct ? '✓ ' : outcome.correctness > 0.5 ? '≈ ' : '✗ '}</span>{outcome.correct ? 'Dobrze!' : outcome.correctness > 0.5 ? `Prawie (${percent(outcome.correctness)})` : outcome.answered ? (outcome.correctness > 0 ? `Niestety nie (${percent(outcome.correctness)}).` : 'Niestety nie.') : 'Bez odpowiedzi.'}</strong>
      {/* Die richtige Antwort steht da, grün — auch nach einem Treffer, samt der anderen, die auch gelten; bei markierten Antworten auf ihnen selbst. */}
      {!onAnswer && (
        <span>Poprawnie: <strong className="cg-expected">{expected}</strong>
          {others.length > 0 && <> · także: <span className="cg-expected">{others.join(', ')}</span></>}
          {showGiven && !outcome.correct && givenText(card, given) !== '' ? <> · Twoja odpowiedź: {givenText(card, given)}</> : null}
        </span>
      )}
      {/* 2026-10-23 (Schritt 13) — z jakiego powodu, gdy nie chodzi o liczbę (jednostka innej wielkości). */}
      {outcome.note !== undefined && <span className="cg-verdict-note">{outcome.note}</span>}
      {outcome.mask !== undefined && !outcome.correct && (
        <span className="cg-diff" aria-label="Porównanie znak po znaku">
          {spansOf(expected, outcome.mask).map((s, i) => <span key={i} className={`is-${s.level}`}>{s.text}</span>)}
        </span>
      )}
      {card.answer.form === 'code' && typeof given === 'object' && given !== null && typeof (given as { error?: unknown }).error === 'string' && <code>{(given as { error: string }).error}</code>}
      {card.answer.form === 'interactive' && <InteractiveReplay card={card} given={given} />}
      {extra}
    </div>
  );
  return lib === undefined ? box : <>{box}<ExplainList lib={lib} ids={explainIds} onEntity={onEntity} /></>;
}

/** Ein Eintrag in Kürze: sein Etikett und, was er sagt — eine Aussage ganz, andere Felder in Worten. */
export function EntityGlance({ lib, entity, onEntity }: { lib: CogitaLibrary; entity: Entity; onEntity?: (id: string) => void }) {
  const look = lib.look;
  const fields = fieldsOf(entity, look).filter((f) => f.type !== 'ref' && f.type !== 'media' && f.type !== 'blocks').slice(0, 4);
  /* 2026-10-22 — eine Aussage erklärt mit ihren Bausteinen (dieselbe Zeichnung wie im Skryptorium); 2026-10-23: jeder Eintrag mit Feld blocks. */
  const statement = blocksField(entity, look) === undefined ? undefined : lib.entry(entity.id);
  if (statement !== undefined) return <div className="cg-card"><StatementCard entry={statement} look={lib.markupLook} prefix={`cg${entity.id.slice(0, 8)}-`} about /></div>;
  return (
    <div className="cg-card">
      <strong>{onEntity === undefined ? labelOf(entity, look) : <button type="button" className="cg-ref" onClick={() => onEntity(entity.id)}>{labelOf(entity, look)}</button>}</strong>
      {fields.map((f) => {
        const text = fieldText(entity, f, look);
        return text === '' ? null : <span key={f.key} className="cg-muted">{f.label}: {f.type === 'markup' ? <Markup text={String(entity.data[f.key] ?? '')} lib={lib} /> : text}</span>;
      })}
    </div>
  );
}


/* -- Frage, Antwort, Urteil ------------------------------------------------------------------- */

export function CardFace({ card, rule, lib, onAnswered, onNext, nextLabel = 'Dalej', head, foot, onEntity, autoFocus = true }: {
  card: Card;
  rule?: Partial<TextRule>;
  lib?: CogitaLibrary;
  /** Nach der Antwort: wie richtig, was gegeben wurde, wie lange es dauerte. */
  onAnswered: (outcome: Outcome, given: unknown, ms: number) => void;
  onNext?: () => void;
  nextLabel?: string;
  head?: ReactNode;
  foot?: ReactNode;
  onEntity?: (id: string) => void;
  /** 2026-10-21 — das Antwortfeld gleich fokussieren (nicht auf einer Szene, die gerade nicht dran ist). */
  autoFocus?: boolean;
}) {
  const [done, setDone] = useState<{ outcome: Outcome; given: unknown } | null>(null);
  const started = useMemo(() => Date.now(), [card.key, card.fingerprint]);
  useEffect(() => { setDone(null); }, [card.key, card.fingerprint]);

  return (
    <section className="cg-face" aria-live="polite" data-card={card.key} data-form={card.answer.form}>
      {head}
      <CardPrompt parts={card.prompt} />
      {/* Die Antwort bleibt, wo sie war — gesperrt, mit ihren Marken; „Sprawdź” wird an seiner Stelle „Dalej” (2026-10-31). */}
      <AnswerInput card={card} autoFocus={autoFocus} {...(done === null ? {} : { reveal: done })} onNext={onNext} nextLabel={nextLabel} onSubmit={(given) => {
        const outcome = checkCard(card, given, rule);
        setDone({ outcome, given });
        onAnswered(outcome, given, Date.now() - started);
      }} />
      {done !== null && <Verdict card={card} outcome={done.outcome} given={done.given} lib={lib} onEntity={onEntity} showGiven={false} marked />}
      {foot}
    </section>
  );
}
