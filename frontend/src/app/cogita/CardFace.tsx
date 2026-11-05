/**
 * COGITA — EINE KARTE: die Frage, die Antwort in ihrer Form (zwölf Formen,
 * [D3]), und danach, was richtig war — mit dem Vergleich Zeichen für Zeichen
 * und dem Wissen, das sie erklärt [D14].
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { checkCard } from './cards';
import { HINT_COST, shuffleAway, type Card, type PromptPart } from './cardBasics';
import { DATE_UNREAD, dateAsked, PRECISION_ASK, readDateAnswer, spansOf, withHints, type DatePartMark, type Outcome, type TextRule } from './check';
import { BuildAnswer } from './BuildAnswer';
import { CodeAnswer, CodeResult, storedCodeGiven } from './CodeAnswer';
import { ExplainList } from './EntityReading';
import { isSlideEntity } from './slideLib';
import { leadingSlides } from './slideLinks';
import { GapAnswer } from './GapAnswer';
import { OrderAnswer } from './OrderAnswer';
import { GeoMap } from './GeoMap';
import { InteractiveAnswer, InteractiveReplay } from './InteractiveAnswer';
import { givenValuesText, solutionText } from './interactive';
import { datePartText, dateText, fieldText, fieldsOf, labelOf, readDate, type Entity } from './schema';
import type { CogitaLibrary } from './store';
import { Markup, MediaView, percent } from './ui';
import { StatementCard } from '../library/markupView';
import { blocksField } from './statements';
import { TexText } from '../ui/tex/Tex';
import { answerWords, CHOICE_CLASS, CHOICE_GLYPH, choiceMark, choiceWords, type ChoiceMark } from './choiceMarks';
import { baseLang, type Lang } from './lang';
import { motionWords } from './motionWords';
import { noteAnswerSource, onKnown } from './rewardBus';
import { RewardIcon } from './RewardViews';
import { motionLevel } from '../ui/motion';

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

/**
 * 2026-11-03 — EINE GERECHNETE ZAHL, WIE MAN SIE SAGT: so genau, wie die Toleranz es verlangt (1 % → drei gültige
 * Ziffern, ± 0,01 → zwei Stellen), ohne Toleranz höchstens sechs gültige Ziffern — nie „8,0487804878" (Generatoren).
 */
export function shownNumber(v: number, tolerance: number, relative: boolean): string {
  if (!Number.isFinite(v)) return String(v);
  let out: number;
  if (tolerance > 0 && relative) out = Number(v.toPrecision(Math.max(2, Math.min(12, Math.ceil(-Math.log10(tolerance)) + 1))));
  else if (tolerance > 0) out = Number(v.toFixed(Math.max(0, Math.min(10, Math.ceil(-Math.log10(tolerance))))));
  else out = Number(v.toPrecision(6));
  return String(out).replace('.', ',');
}

/** Was als richtig galt, in Worten. */
export function answerText(card: Card): string {
  const a = card.answer;
  switch (a.form) {
    case 'text': return a.accepted[0] ?? '';
    case 'gap': return gapWords(card) ?? a.accepted[0] ?? '';
    case 'number': return `${a.values[0] === undefined ? '' : shownNumber(a.values[0], a.tolerance, a.relative)}${a.unit === '' ? '' : ` ${a.unit}`}`;
    /* 2026-11-01 — wie man ein Datum sagt („listopad 1829"), nicht wie es gespeichert ist („1829-11"). */
    case 'date': { const d = readDate(a.values[0]); return d === null ? a.values[0] ?? '' : dateText(d); }
    case 'one': return a.options[a.correct] ?? '';
    case 'many': return a.correct.map((i) => a.options[i]).join(', ');
    case 'truefalse': return a.value ? 'prawda' : 'fałsz';
    case 'order': return a.items.join(' → ');
    case 'match': return a.pairs.map(([l, r]) => `${a.left[l]} — ${a.right[r]}`).join('; ');
    case 'flash': return a.back.join(' · ');
    case 'code': return 'kod, który przechodzi wszystkie przypadki';
    case 'point': return 'lat' in a.target ? `${a.target.lat.toFixed(4)}, ${a.target.lon.toFixed(4)}` : 'zaznaczony punkt';
    case 'interactive': return solutionText(a) ?? 'cel rysunku osiągnięty';
    case 'build': return a.items.join(a.join);
  }
}

/** 2026-11-01 — was zu einer Lücke gehört: bei mehreren Lücken jede mit ihrem Wort. */
const gapWords = (card: Card): string | null => (card.answer.form === 'gap' && card.answer.gaps !== undefined ? card.answer.gaps.map((g) => g.accepted[0] ?? '').join(' · ') : null);

/**
 * 2026-11-01 — WAS GESPEICHERT WIRD. Eine Wahl und Paare als TEXT: die Stellen gelten nur für die Karte dieses Laufs (die
 * Möglichkeiten sind gemischt) — das Protokoll der Lehrerin und „die häufigste falsche Antwort" lesen sie später mit
 * einer anders gemischten Karte. Eine Antwort in Code ohne ihre Fälle (die sind nur zum Anschauen).
 */
export function storedGiven(card: Card, given: unknown): string {
  if (typeof given === 'string') return given;
  const a = card.answer;
  if (a.form === 'one' && typeof given === 'number') return JSON.stringify(a.options[given] ?? given);
  if (a.form === 'many' && Array.isArray(given)) return JSON.stringify(given.map((i) => (typeof i === 'number' ? a.options[i] ?? i : i)));
  if (a.form === 'match' && Array.isArray(given)) return JSON.stringify(given.map((p) => (Array.isArray(p) && typeof p[0] === 'number' && typeof p[1] === 'number' ? [a.left[p[0]] ?? p[0], a.right[p[1]] ?? p[1]] : p)));
  return JSON.stringify(a.form === 'code' ? storedCodeGiven(given) : given) ?? '';
}

/** Was gegeben wurde, kurz — für die Antwort, die gespeichert wird. */
export function givenText(card: Card, given: unknown): string {
  const a = card.answer;
  if (typeof given === 'string') return given;
  if (a.form === 'one' && typeof given === 'number') return a.options[given] ?? '';
  /* 2026-11-01 — gespeichert wird der Text der Wahl (`storedGiven`); alte Antworten tragen noch die Stelle. */
  if (a.form === 'many' && Array.isArray(given)) return given.map((i) => (typeof i === 'number' ? a.options[i] ?? '' : String(i))).join(', ');
  if (a.form === 'truefalse') return given === true ? 'prawda' : given === false ? 'fałsz' : '';
  if (a.form === 'order' && Array.isArray(given)) return given.join(' → ');
  if (a.form === 'match' && Array.isArray(given)) return given.map((p) => (!Array.isArray(p) ? '' : typeof p[0] === 'number' ? `${a.left[p[0]]}—${a.right[p[1]]}` : `${String(p[0])}—${String(p[1])}`)).join('; ');
  if (a.form === 'code' && typeof given === 'object' && given !== null) return `${(given as { passed?: number }).passed ?? 0}/${(given as { total?: number }).total ?? 0}`;
  if (a.form === 'point' && typeof given === 'object' && given !== null) return JSON.stringify(given);
  if (a.form === 'interactive') return givenValuesText(a, given);
  /* 2026-11-01 — gebaut: die Kacheln in ihrer Folge; mehrere Lücken: je Lücke, was dort stand. */
  if (a.form === 'build' && Array.isArray(given)) return given.map(String).join(a.join);
  if (a.form === 'gap' && Array.isArray(given)) return given.map((g) => (typeof g === 'string' && g.trim() !== '' ? g : '—')).join(' · ');
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
  month: 'np. 7.1410 albo lipiec 1410',
  day: 'np. 15.07.1410 albo 15 lipca 1410'
};

/** 2026-11-01 — so nennt die Karte die Teile eines Datums. */
const PART_NAME: Readonly<Record<'year' | 'month' | 'day', string>> = { year: 'rok', month: 'miesiąc', day: 'dzień' };

/**
 * 2026-11-01 — DAS DATUM TEIL FÜR TEIL nach der Prüfung: je Tag, Monat, Jahr, was gegeben war und ob es stimmt (✓),
 * nah ist (≈, um eins daneben) oder nicht (✗) — mit dem richtigen Wert daneben. Die Farbe ist nie das einzige Zeichen.
 */
function DateParts({ parts }: { parts: readonly DatePartMark[] }) {
  return (
    <ul className="cg-date-parts" data-date-parts="">
      {parts.map((p) => {
        const level = p.score === 1 ? 'is-right' : p.score > 0 ? 'is-near' : 'is-wrong';
        return (
          <li key={p.part} className={level} data-date-part={p.part} data-score={p.score}>
            <span className="cg-option-mark" aria-hidden>{p.score === 1 ? '✓' : p.score > 0 ? '≈' : '✗'}</span>
            <span className="cg-date-part-name">{PART_NAME[p.part]}</span>
            {p.given === null ? <em className="cg-muted">brak</em> : <strong className={p.score === 1 ? undefined : 'cg-struck'}>{datePartText(p.part, p.given)}</strong>}
            {p.score < 1 && <span className="cg-date-part-fix">{p.score > 0 ? 'blisko · ' : ''}dobrze: <strong>{datePartText(p.part, p.expected)}</strong></span>}
          </li>
        );
      })}
    </ul>
  );
}

export function AnswerInput({ card, disabled, onSubmit, autoFocus = true, reveal, onNext, nextLabel = 'Dalej', lang = 'pl' }: {
  card: Card;
  /** 2026-11-04 (Prompt 15) — die Sprache der Baza, für die Worte am Ergebnis einer Wahl (`choiceMarks.ts`). */
  lang?: Lang;
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
  /*
    Grün, was richtig ist; rot, was gewählt und falsch ist. 2026-11-05 (Prompt 17): dazu, was gewählt war (`is-hit`: blitzt
    kurz grün mit dem ✓, oder rot mit einem kleinen Schütteln) und die richtige, die nicht gewählt war (`is-answer`: leuchtet
    danach sanft grün) — `cogita.css`.
  */
  const mark = (right: boolean, chosen: boolean): string => (reveal === undefined ? '' : right ? (chosen ? ' is-right is-hit' : ' is-right is-answer') : chosen ? ' is-wrong is-hit' : '');
  /* 2026-11-05 (Prompt 17) — die Antwort ist geprüft: ihre Teile zeigen ihr Ergebnis (nacheinander, `cogita.css`). */
  const revealed = reveal === undefined ? '' : ` is-revealed is-${reveal.outcome.correct ? 'right' : reveal.outcome.correctness > 0 ? 'partly' : 'wrong'}`;
  const [text, setText] = useState('');
  /* 2026-11-01 — eine Datumsantwort, die sich nicht lesen liess: gesagt, nicht gezählt. */
  const [unread, setUnread] = useState(false);
  const [many, setMany] = useState<ReadonlySet<number>>(new Set());
  const [order, setOrder] = useState<readonly string[]>([]);
  const [pairing, setPairing] = useState<Pairing>(NO_PAIRS);
  const [flipped, setFlipped] = useState(false);
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
    setText(''); setUnread(false); setMany(new Set()); setOrder(view.start); setPairing(NO_PAIRS); setFlipped(false);
    setPoint(null);
    if (autoFocus) window.setTimeout(() => field.current?.focus(), 30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.key, card.fingerprint]);
  /* 2026-11-01 — nach der Antwort: der Satz zu einer Möglichkeit, unter der gewählten und unter jeder richtigen (✓/✗, nie nur Farbe). */
  const said = (i: number, right: boolean, chosen: boolean, choice?: ChoiceMark): ReactNode => {
    const text = reveal === undefined ? '' : (card.feedback?.[i] ?? '').trim();
    if (text === '' || (!right && !chosen)) return null;
    /* 2026-11-04 (Prompt 15) — unter einer übersehenen richtigen: bernsteinfarben, ohne ✓ (sie wurde nicht gewählt). */
    if (choice === 'missed') {
      return (
        <div className="cg-option-said is-missed" data-option-said="missed">
          <Markup text={text} />
        </div>
      );
    }
    return (
      <div className={`cg-option-said ${right ? 'is-right' : 'is-wrong'}`} data-option-said={right ? 'right' : 'wrong'}>
        <span className="cg-option-mark" aria-label={right ? answerWords(lang).right : answerWords(lang).wrong}>{right ? '✓' : '✗'}</span>
        <Markup text={text} />
      </div>
    );
  };

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
    case 'gap': {
      /* 2026-11-01 — mehrere Lücken (oder Lücken zum Wählen): jede an ihrer Stelle im Text. */
      if (a.form === 'gap' && a.gaps !== undefined && a.pieces !== undefined) {
        return (
          <GapAnswer key={`${card.key}:${card.fingerprint}`} pieces={a.pieces} gaps={a.gaps} locked={shut} autoFocus={autoFocus}
            {...(reveal === undefined ? {} : { given: Array.isArray(reveal.given) ? reveal.given.map((g) => (typeof g === 'string' ? g : '')) : [], marks: reveal.outcome.marks ?? [] })}
            onSubmit={submit} action={next} />
        );
      }
      /* 2026-11-01 — ein Datum, wie es gelesen wird: steht etwas da, das sich nicht lesen lässt, zählt es nicht als Antwort. */
      const asked = a.form === 'date' ? dateAsked(a) : null;
      const reading = a.form === 'date' && text.trim() !== '' ? readDateAnswer(text) : null;
      const readText = reading === null ? '' : dateText(reading);
      return (
        <form className={`cg-answer${revealed}`} onSubmit={(e) => {
          e.preventDefault();
          if (a.form === 'date' && text.trim() !== '' && reading === null) { setUnread(true); return; }
          submit(text);
        }}>
          {a.form === 'gap' && <div className="cg-prompt"><TexText text={a.shown} /></div>}
          {/* 2026-10-31 — jede Datumsfrage sagt, wie genau: das Jahr genügt, oder der Tag. */}
          {asked !== null && <p className="cg-precision" data-precision={asked}>{PRECISION_ASK[asked]}</p>}
          <div className="cg-row">
            <input ref={field} type="text" className={reveal === undefined ? undefined : reveal.outcome.correct ? 'is-right' : reveal.outcome.near === true || reveal.outcome.correctness > 0.5 ? 'is-near' : 'is-wrong'} inputMode={a.form === 'number' ? 'decimal' : undefined} value={text} disabled={shut}
              placeholder={asked !== null ? DATE_HINT[asked] : a.form === 'number' ? (a.quantity === undefined ? 'liczba' : 'liczba, może z jednostką') : 'odpowiedź'}
              aria-label={asked !== null ? `Odpowiedź — ${PRECISION_ASK[asked].toLowerCase()}` : 'Odpowiedź'} aria-invalid={unread || undefined}
              onChange={(e) => { setText(e.target.value); setUnread(false); }} autoComplete="off" autoCapitalize="off" spellCheck={false} />
            {a.form === 'number' && a.unit !== '' && <span>{a.unit}</span>}
            {next ?? <button key="check" type="submit" className="wk-btn" disabled={shut}>Sprawdź</button>}
          </div>
          {/* Wie das Datum gelesen wird — nur, wenn es anders aussieht als getippt („1829 11" → listopad 1829). */}
          {a.form === 'date' && reveal === undefined && readText !== '' && readText !== text.trim() && <p className="cg-date-read" data-date-read="">= {readText}</p>}
          {unread && reveal === undefined && <p className="cg-date-problem" role="alert" data-date-unread="">{DATE_UNREAD}</p>}
        </form>
      );
    }
    case 'one':
      return (
        <div className={`cg-answer${revealed}`}>
          <div className="cg-options" role="radiogroup">
            {view.options.map((i) => {
              const g = reveal === undefined ? '' : glyph(i === a.correct, reveal.given === i);
              const button = (
                <button key={i} type="button" role="radio" aria-checked={reveal?.given === i} className={`cg-option${mark(i === a.correct, reveal?.given === i)}`} disabled={shut} onClick={() => submit(i)}>
                  <span className="cg-option-text"><TexText text={a.options[i] ?? ''} /></span>
                  {g !== '' && <span className="cg-option-mark" aria-label={g === '✓' ? answerWords(lang).right : answerWords(lang).wrong}>{g}</span>}
                </button>
              );
              /* 2026-11-01 — der Satz zur Möglichkeit steht unter ihr (in derselben Zelle — die Möglichkeiten bleiben gleich breit). */
              const note = said(i, i === a.correct, reveal?.given === i);
              return note === null ? button : <div key={i} className="cg-option-cell">{button}{note}</div>;
            })}
          </div>
          {nextRow}
        </div>
      );
    case 'many':
      return (
        <div className={`cg-answer${revealed}`}>
          <div className="cg-options">
            {view.options.map((i) => {
              /* 2026-11-04 (Prompt 15) — nach der Prüfung die Entscheidung des Lernenden: übersehen ist bernsteinfarben, ohne ✓ (`choiceMarks.ts`). */
              const m = reveal === undefined ? null : choiceMark(a.correct.includes(i), many.has(i));
              const g = m === null ? '' : CHOICE_GLYPH[m];
              const button = (
                <button key={i} type="button" className={`cg-option${m === null ? (many.has(i) ? ' is-on' : '') : CHOICE_CLASS[m]}`} aria-pressed={many.has(i)} disabled={shut}
                  data-choice={m ?? undefined} onClick={() => setMany((was) => { const next2 = new Set(was); if (next2.has(i)) next2.delete(i); else next2.add(i); return next2; })}>
                  <span aria-hidden>{many.has(i) ? '☑' : '☐'}</span>
                  <span className="cg-option-text"><TexText text={a.options[i] ?? ''} />
                    {(m === 'missed' || m === 'left') && <span className={`cg-option-note${m === 'left' ? ' is-quiet' : ''}`}>{choiceWords(lang)[m]}</span>}
                  </span>
                  {m !== null && g !== '' && <span className="cg-option-mark" aria-label={choiceWords(lang)[m]}>{g}</span>}
                </button>
              );
              const note = m === null ? null : said(i, a.correct.includes(i), many.has(i), m);
              return note === null ? button : <div key={i} className="cg-option-cell">{button}{note}</div>;
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
        <div className={`cg-answer${revealed}`}>
          <div className="cg-options cg-options-two">{tf(true, 'Prawda')}{tf(false, 'Fałsz')}</div>
          {nextRow}
        </div>
      );
    }
    case 'order':
      return (
        <div className={`cg-answer${revealed}`}>
          {/* Der Knopf steht zwischen der Liste und ihrem Ergebnis: „Dalej” bleibt genau dort, wo „Sprawdź” war. */}
          <OrderAnswer key={`${card.key}:${card.fingerprint}`} start={view.start} correct={a.items} locked={shut}
            {...(a.preview === undefined ? {} : { preview: a.preview, join: a.join ?? ' ' })}
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
            {n > 0 && <span className="cg-match-n" aria-hidden>{n}</span>}<span className="cg-option-text"><TexText text={label} /></span>
          </button>
        );
      };
      return (
        <div className={`cg-answer${revealed}`}>
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
        <div className={`cg-answer${revealed}`}>
          {/* 2026-10-27 — ein Block je Zeile, kein <p>: der Zapis bringt seine eigenen Absätze mit (<p> in <p> ist kein HTML). */}
          <div className="cg-flash-back">{a.back.map((b, i) => <div key={i}><Markup text={b} /></div>)}</div>
          <div className="cg-row">
            {/* 2026-11-05 (Prompt 17) — die eigene Einschätzung zeigt sich wie eine Antwort: grün, rot mit kleinem Schütteln, teilweise. */}
            <button type="button" className={`cg-option${reveal?.given === 'knew' ? ' is-right is-hit' : ''}`} disabled={shut} onClick={() => submit('knew')}>Umiałem</button>
            <button type="button" className={`cg-option${reveal?.given === 'partly' ? ' is-on is-hit' : ''}`} disabled={shut} onClick={() => submit('partly')}>Częściowo</button>
            <button type="button" className={`cg-option${reveal?.given === 'not' ? ' is-wrong is-hit' : ''}`} disabled={shut} onClick={() => submit('not')}>Nie umiałem</button>
          </div>
          {nextRow}
        </div>
      ) : (
        <button type="button" className="wk-btn" disabled={shut} onClick={() => setFlipped(true)}>Pokaż odpowiedź</button>
      );
    case 'code':
      /* 2026-11-01 — eigene Datei: Beispiele vorher, die Fälle danach als Tabelle (`CodeAnswer.tsx`). */
      return <div className={`cg-answer${revealed}`}><CodeAnswer key={`${card.key}:${card.fingerprint}`} card={card} locked={shut} onSubmit={submit} next={next} /></div>;
    case 'build':
      /* 2026-11-01 — aus Kacheln bauen, mit der Vorschau darüber (`BuildAnswer.tsx`). */
      return (
        <div className={`cg-answer${revealed}`}>
          <BuildAnswer key={`${card.key}:${card.fingerprint}`} card={card} locked={shut} autoFocus={autoFocus}
            {...(reveal === undefined ? {} : { given: Array.isArray(reveal.given) ? reveal.given.map(String) : [], outcome: reveal.outcome })}
            onSubmit={submit} action={next} />
        </div>
      );
    case 'point':
      return (
        <div className={`cg-answer${revealed}`}>
          {a.on === 'map' ? (
            <GeoMap zoom={6} center={{ lat: 51.9, lon: 19.1 }} marks={point === null ? [] : [{ ...point, kind: 'pin' }]} onPick={shut ? undefined : setPoint} />
          ) : <p className="cg-muted">Wskaż punkt na obrazie pytania.</p>}
          {next ?? <button key="check" type="button" className="wk-btn" disabled={shut || point === null} onClick={() => submit(point)}>Sprawdź</button>}
        </div>
      );
    case 'interactive':
      return <div className={`cg-answer${revealed}`}><InteractiveAnswer card={card} disabled={shut} onSubmit={submit} />{nextRow}</div>;
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
    <div className="cg-answer is-revealed">
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
              <span className="cg-match-left"><TexText text={a.left[l] ?? ''} /></span>
              <span className="cg-match-right">
                {chosen === undefined ? <em className="cg-muted">bez pary</em> : <span className={ok ? undefined : 'cg-struck'}><TexText text={a.right[chosen] ?? ''} /></span>}
                {!ok && want !== undefined && <span className="cg-match-fix">dobrze: <strong><TexText text={a.right[want] ?? ''} /></strong></span>}
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

/**
 * 2026-11-05 (Prompt 17) — DER ANTEIL ZÄHLT HOCH („75 %"), wenn die Teile der Antwort ihr Ergebnis gezeigt haben (`delay`);
 * ohne volle Bewegung (Animacje) steht er gleich da.
 */
function CountPercent({ value, delay }: { value: number; delay: number }) {
  const target = Math.max(0, Math.min(1, value));
  const [shown, setShown] = useState(() => (motionLevel() === 'full' ? 0 : target));
  useEffect(() => {
    if (motionLevel() !== 'full') { setShown(target); return undefined; }
    let raf = 0;
    const t0 = performance.now() + delay;
    const tick = (t: number) => {
      const k = Math.max(0, Math.min(1, (t - t0) / 520));
      setShown(target * (1 - (1 - k) ** 3));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, delay]);
  return <span className="cg-count" data-count={Math.round(target * 100)}>{percent(shown)}</span>;
}

/** Formen, deren Antwort nach der Prüfung mit ihren Marken stehen bleibt — dort steht das Ergebnis, nicht in einem langen Satz. */
const MARKED_FORMS: ReadonlySet<string> = new Set(['one', 'many', 'truefalse', 'order', 'match', 'build', 'code']);

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
  /* 2026-11-01 — „nah" auch, wo die Prüfung es sagt (ein Datum, jeder Teil höchstens um eins daneben). */
  const close = outcome.near === true || outcome.correctness > 0.5;
  const level = outcome.correct ? 'is-right' : close ? 'is-near' : 'is-wrong';
  const expected = outcome.expected ?? answerText(card);
  /* 2026-11-01 — verglichen mit einer Zeile ohne LaTeX, gezeigt, wie die Antwort geschrieben steht (mit Wzór). */
  const written = outcome.shown ?? expected;
  const a = card.answer;
  const others = a.form === 'text' || (a.form === 'gap' && a.gaps === undefined) ? a.accepted.filter((x) => x !== written && x.trim().toLowerCase() !== expected.trim().toLowerCase()) : [];
  /* 2026-11-01 — mehrere Lücken stehen mit ihren Marken im Text — dort das Ergebnis. */
  const onAnswer = marked && (MARKED_FORMS.has(a.form) || (a.form === 'gap' && a.gaps !== undefined));
  /* 2026-10-31 — zuerst das Thema der Frage („O czym”), dann, was sie zur Erklärung nennt; alles zugeklappt. */
  /* 2026-11-05 (Prompt 23, A1) — führen Folien einer Erzählung die Erklärung an, stehen sie zuerst (wie im Spieler gezeichnet); das Thema folgt wie bisher. */
  const lead = lib === undefined ? [] : leadingSlides(card.explain, (id) => isSlideEntity(lib, id));
  const explainIds = lib === undefined ? [] : [...lead, ...(card.about ?? []), ...card.explain.filter((x) => !lead.includes(x))];
  /* 2026-11-01 — richtig, aber mit Podpowiedź: das zählt weniger — und es steht da. */
  const hinted = outcome.correct && (outcome.hints ?? 0) > 0;
  /* 2026-11-05 (Prompt 17) — teilweise richtig: der Anteil zählt hoch, nachdem die Teile ihr Ergebnis gezeigt haben. */
  const parts = a.form === 'many' ? a.options.length : a.form === 'match' ? a.pairs.length : a.form === 'order' ? a.items.length : 0;
  const share = <CountPercent value={outcome.correctness} delay={Math.min(700, parts * 90)} />;
  const box = (
    <div className={`cg-verdict ${hinted ? 'is-near' : level}`} role="status" data-verdict={outcome.correct ? 'right' : close ? 'near' : 'wrong'} data-hints={outcome.hints}>
      <strong><span aria-hidden>{outcome.correct ? '✓ ' : close ? '≈ ' : '✗ '}</span>{hinted ? <>Dobrze — z podpowiedzią ({share})</> : outcome.correct ? 'Dobrze!' : close ? <>Prawie ({share})</> : outcome.answered ? (outcome.correctness > 0 ? <>Niestety nie ({share}).</> : 'Niestety nie.') : 'Bez odpowiedzi.'}</strong>
      {/* 2026-11-01 — ein Datum Teil für Teil: was stimmt, was nah ist, was nicht. */}
      {outcome.dateParts !== undefined && !outcome.correct && <DateParts parts={outcome.dateParts} />}
      {/* Die richtige Antwort steht da, grün — auch nach einem Treffer, samt der anderen, die auch gelten; bei markierten Antworten auf ihnen selbst. */}
      {!onAnswer && (
        <span>Poprawnie: <strong className="cg-expected"><TexText text={written} /></strong>
          {others.length > 0 && <> · także: <span className="cg-expected"><TexText text={others.join(', ')} /></span></>}
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
      {card.answer.form === 'code' && <CodeResult card={card} given={given} />}
      {card.answer.form === 'interactive' && <InteractiveReplay card={card} given={given} />}
      {extra}
    </div>
  );
  /* 2026-11-01 — das Wyjaśnienie der Frage zuerst, aufgeklappt; dann die Einträge (zugeklappt). */
  const explanation = card.explanation === undefined || card.explanation.trim() === '' ? null : (
    <section className="cg-explanation" data-explanation="" aria-label="Wyjaśnienie">
      <Markup text={card.explanation} lib={lib} onEntity={onEntity} />
    </section>
  );
  return <>{box}{explanation}{lib !== undefined && <ExplainList lib={lib} ids={explainIds} onEntity={onEntity} />}</>;
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
      {/* 2026-11-01 — der Name mit seinen Wzory gesetzt. */}
      <strong>{onEntity === undefined ? <TexText text={labelOf(entity, look, 0, false, true)} /> : <button type="button" className="cg-ref" aria-label={labelOf(entity, look)} onClick={() => onEntity(entity.id)}><TexText text={labelOf(entity, look, 0, false, true)} /></button>}</strong>
      {fields.map((f) => {
        const text = fieldText(entity, f, look);
        return text === '' ? null : <span key={f.key} className="cg-muted">{f.label}: {f.type === 'markup' ? <Markup text={String(entity.data[f.key] ?? '')} lib={lib} /> : text}</span>;
      })}
    </div>
  );
}


/* -- Frage, Antwort, Urteil ------------------------------------------------------------------- */

export function CardFace({ card, rule, lib, onAnswered, onNext, nextLabel = 'Dalej', head, foot, onEntity, autoFocus = true, lang }: {
  card: Card;
  /** 2026-11-04 (Prompt 15) — die Sprache der Baza; fehlt sie, aus `lib` (`baseLang`), sonst polnisch. */
  lang?: Lang;
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
  /* 2026-11-01 — wie viele Podpowiedzi schon aufgedeckt sind (eine nach der anderen, nur vor der Antwort). */
  const [hinted, setHinted] = useState(0);
  const started = useMemo(() => Date.now(), [card.key, card.fingerprint]);
  useEffect(() => { setDone(null); setHinted(0); }, [card.key, card.fingerprint]);
  const hints = card.hints ?? [];
  /*
    2026-11-05 (Prompt 17) — WOHER DIE ANTWORT KAM (der gedrückte Knopf, das Feld): von dort steigt „+N" zum Zähler auf
    (`rewardBus.ts`). Und: wird diese Karte eben utrwalona, zeigt sie es einmal („Utrwalone", ein kleiner Stern).
  */
  const pressed = useRef<Element | null>(null);
  const [burst, setBurst] = useState<number | null>(null);
  useEffect(() => onKnown((key) => { if (key === card.key) setBurst(Date.now()); }), [card.key]);
  useEffect(() => {
    if (burst === null) return undefined;
    const t = window.setTimeout(() => setBurst(null), 1700);
    return () => window.clearTimeout(t);
  }, [burst]);
  const MW = motionWords(lang ?? (lib === undefined ? 'pl' : baseLang(lib)));

  return (
    <section className="cg-face" aria-live="polite" data-card={card.key} data-form={card.answer.form}
      onPointerDownCapture={(e) => { pressed.current = (e.target as Element | null)?.closest?.('button, input, textarea, [role="radio"]') ?? null; }}
      onKeyDownCapture={(e) => { if (e.key === 'Enter' || e.key === ' ') pressed.current = e.target as Element; }}>
      {burst !== null && <span key={burst} className="cg-known-burst" data-known-burst="" aria-hidden><RewardIcon name="star" />{MW.known}</span>}
      {burst !== null && <span className="cg-sr" role="status">{MW.known}</span>}
      {head}
      <CardPrompt parts={card.prompt} />
      {/*
        2026-11-01 — PODPOWIEDZI: eine nach der anderen, vor der Antwort; jede nimmt ein Viertel vom Höchsten dieser Antwort
        (die Kenntnis nimmt sie als teilweise richtig), und die Antwort sagt der Lehrerin, wie viele es waren.
      */}
      {hints.length > 0 && (hinted > 0 || done === null) && (
        <div className="cg-hints" data-hints={hints.length} data-hints-shown={hinted}>
          {hints.slice(0, hinted).map((h, i) => (
            <div key={i} className="cg-hint" data-hint={i + 1}>
              <span className="cg-hint-n">Podpowiedź {i + 1}</span>
              <Markup text={h} lib={lib} />
            </div>
          ))}
          {done === null && hinted < hints.length && (
            <button type="button" className="wk-link-btn cg-hint-btn" data-hint-next="" title={`Każda podpowiedź obniża wynik tej odpowiedzi o ${Math.round(HINT_COST * 100)}%.`}
              onClick={() => setHinted((n) => Math.min(hints.length, n + 1))}>
              Podpowiedź {hinted + 1}/{hints.length}
            </button>
          )}
        </div>
      )}
      {/* Die Antwort bleibt, wo sie war — gesperrt, mit ihren Marken; „Sprawdź” wird an seiner Stelle „Dalej” (2026-10-31). */}
      <AnswerInput card={card} autoFocus={autoFocus} lang={lang ?? (lib === undefined ? 'pl' : baseLang(lib))} {...(done === null ? {} : { reveal: done })} onNext={onNext} nextLabel={nextLabel} onSubmit={(given) => {
        noteAnswerSource(pressed.current?.isConnected === true ? pressed.current : document.activeElement, card.key);
        const outcome = withHints(checkCard(card, given, rule), hinted, HINT_COST);
        setDone({ outcome, given });
        onAnswered(outcome, given, Date.now() - started);
      }} />
      {done !== null && <Verdict card={card} outcome={done.outcome} given={done.given} lib={lib} onEntity={onEntity} showGiven={false} marked />}
      {foot}
    </section>
  );
}
