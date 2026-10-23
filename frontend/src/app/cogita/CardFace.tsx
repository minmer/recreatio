/**
 * COGITA — EINE KARTE: die Frage, die Antwort in ihrer Form (zwölf Formen,
 * [D3]), und danach, was richtig war — mit dem Vergleich Zeichen für Zeichen
 * und dem Wissen, das sie erklärt [D14].
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { checkCard } from './cards';
import { type Card, type PromptPart } from './cardBasics';
import { spansOf, type Outcome, type TextRule } from './check';
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

export function AnswerInput({ card, disabled, onSubmit, autoFocus = true, reveal }: {
  card: Card;
  disabled?: boolean;
  onSubmit: (given: unknown) => void;
  autoFocus?: boolean;
  /** 2026-10-18 — nach der Antwort bleibt alles, wo es war: gesperrt, die richtigen grün, die falsch gewählten rot. */
  reveal?: { readonly outcome: Outcome; readonly given: unknown };
}) {
  const a = card.answer;
  const shut = disabled === true || reveal !== undefined;
  /* Grün, was richtig ist; rot, was gewählt und falsch ist. */
  const mark = (right: boolean, chosen: boolean): string => (reveal === undefined ? '' : right ? ' is-right' : chosen ? ' is-wrong' : '');
  const [text, setText] = useState('');
  const [many, setMany] = useState<ReadonlySet<number>>(new Set());
  const [order, setOrder] = useState<readonly string[]>(a.form === 'order' ? a.shown : []);
  const [pairing, setPairing] = useState<Pairing>(NO_PAIRS);
  const [flipped, setFlipped] = useState(false);
  const [code, setCode] = useState(a.form === 'code' ? a.starter : '');
  const [running, setRunning] = useState(false);
  const [point, setPoint] = useState<{ lat: number; lon: number } | null>(null);
  const field = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setText(''); setMany(new Set()); setOrder(a.form === 'order' ? a.shown : []); setPairing(NO_PAIRS); setFlipped(false);
    setCode(a.form === 'code' ? a.starter : ''); setPoint(null);
    if (autoFocus) window.setTimeout(() => field.current?.focus(), 30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.key, card.fingerprint]);

  const submit = (given: unknown) => { if (!shut) onSubmit(given); };
  const tap = (side: 'l' | 'r', at: number) => setPairing((was) => tapPair(was, side, at));

  switch (a.form) {
    case 'text':
    case 'number':
    case 'date':
    case 'gap':
      return (
        <form className="cg-answer" onSubmit={(e) => { e.preventDefault(); submit(text); }}>
          {a.form === 'gap' && <div className="cg-prompt">{a.shown}</div>}
          <div className="cg-row">
            <input ref={field} type="text" className={reveal === undefined ? undefined : reveal.outcome.correct ? 'is-right' : reveal.outcome.correctness > 0.5 ? 'is-near' : 'is-wrong'} inputMode={a.form === 'number' ? 'decimal' : undefined} value={text} disabled={shut}
              placeholder={a.form === 'date' ? 'np. 1410, 15 lipca 1410, 1410-07-15' : a.form === 'number' ? (a.quantity === undefined ? 'liczba' : 'liczba, może z jednostką') : 'odpowiedź'}
              aria-label="Odpowiedź" onChange={(e) => setText(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} />
            {a.form === 'number' && a.unit !== '' && <span>{a.unit}</span>}
            <button type="submit" className="wk-btn" disabled={shut}>Sprawdź</button>
          </div>
        </form>
      );
    case 'one':
      return (
        <div className="cg-options" role="radiogroup">
          {a.options.map((o, i) => <button key={i} type="button" className={`cg-option${mark(i === a.correct, reveal?.given === i)}`} disabled={shut} onClick={() => submit(i)}>{o}</button>)}
        </div>
      );
    case 'many':
      return (
        <div className="cg-answer">
          <div className="cg-options">
            {a.options.map((o, i) => (
              <button key={i} type="button" className={`cg-option${reveal === undefined ? (many.has(i) ? ' is-on' : '') : mark(a.correct.includes(i), many.has(i))}`} aria-pressed={many.has(i)} disabled={shut}
                onClick={() => setMany((was) => { const next = new Set(was); if (next.has(i)) next.delete(i); else next.add(i); return next; })}>
                <span aria-hidden>{many.has(i) ? '☑' : '☐'}</span> {o}
              </button>
            ))}
          </div>
          <button type="button" className="wk-btn" disabled={shut} onClick={() => submit([...many].sort((x, y) => x - y))}>Sprawdź</button>
        </div>
      );
    case 'truefalse':
      return (
        <div className="cg-row">
          <button type="button" className={`cg-option${mark(a.value, reveal?.given === true)}`} disabled={shut} onClick={() => submit(true)}>Prawda</button>
          <button type="button" className={`cg-option${mark(!a.value, reveal?.given === false)}`} disabled={shut} onClick={() => submit(false)}>Fałsz</button>
        </div>
      );
    case 'order':
      return (
        <div className="cg-answer">
          <ol className="cg-order">
            {order.map((item, i) => (
              <li key={`${item}-${i}`}>
                <span>{item}</span>
                <button type="button" className="wk-link-btn" aria-label="Wyżej" disabled={shut || i === 0} onClick={() => setOrder((was) => { const n = [...was]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; })}>↑</button>
                <button type="button" className="wk-link-btn" aria-label="Niżej" disabled={shut || i === order.length - 1} onClick={() => setOrder((was) => { const n = [...was]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; return n; })}>↓</button>
              </li>
            ))}
          </ol>
          <button type="button" className="wk-btn" disabled={shut} onClick={() => submit(order)}>Sprawdź</button>
        </div>
      );
    case 'match': {
      const { pairs, pick } = pairing;
      const lefts = Object.keys(pairs).map(Number).sort((x, y) => x - y);
      const leftOf = (r: number) => lefts.find((l) => pairs[l] === r);
      /* Ein Paar trägt auf beiden Seiten dieselbe Nummer. */
      const item = (side: 'l' | 'r', at: number, text: string, paired: number | undefined) => {
        const on = pick?.side === side && pick.at === at;
        const n = paired === undefined ? 0 : lefts.indexOf(paired) + 1;
        return (
          <button key={at} type="button" className={`cg-option${reveal !== undefined ? mark(paired !== undefined && a.pairs.some(([x, y]) => x === paired && y === pairs[paired]), paired !== undefined) : `${on ? ' is-on' : ''}${n > 0 ? ' is-paired' : ''}`}`} aria-pressed={on} disabled={shut}
            aria-label={n > 0 ? `${text} — para ${n}` : text} onClick={() => tap(side, at)}>
            {n > 0 && <span className="cg-match-n" aria-hidden>{n}</span>}{text}
          </button>
        );
      };
      return (
        <div className="cg-answer">
          <p className="cg-muted">Wybierz pozycję z jednej strony, potem jej parę z drugiej. Ponowne wybranie rozłącza parę.</p>
          <div className="cg-match">
            <div className="cg-match-side">{a.left.map((l, i) => item('l', i, l, pairs[i] === undefined ? undefined : i))}</div>
            <div className="cg-match-side">{a.right.map((r, j) => item('r', j, r, leftOf(j)))}</div>
          </div>
          <button type="button" className="wk-btn" disabled={shut || lefts.length === 0} onClick={() => submit(lefts.map((l) => [l, pairs[l]]))}>
            Sprawdź{lefts.length > 0 && lefts.length < a.left.length ? ` (${lefts.length} z ${a.left.length})` : ''}
          </button>
        </div>
      );
    }
    case 'flash':
      return flipped ? (
        <div className="cg-answer">
          <div className="cg-flash-back">{a.back.map((b, i) => <p key={i}><Markup text={b} /></p>)}</div>
          <div className="cg-row">
            <button type="button" className="cg-option is-right" disabled={shut} onClick={() => submit('knew')}>Umiałem</button>
            <button type="button" className="cg-option" disabled={shut} onClick={() => submit('partly')}>Częściowo</button>
            <button type="button" className="cg-option is-wrong" disabled={shut} onClick={() => submit('not')}>Nie umiałem</button>
          </div>
        </div>
      ) : (
        <button type="button" className="wk-btn" disabled={shut} onClick={() => setFlipped(true)}>Pokaż odpowiedź</button>
      );
    case 'code':
      return (
        <div className="cg-answer">
          {a.task !== '' && <Markup text={a.task} />}
          <textarea className="cg-code" spellCheck={false} value={code} disabled={shut || running} onChange={(e) => setCode(e.target.value)} aria-label="Kod" />
          <button type="button" className="wk-btn" disabled={shut || running} onClick={() => {
            setRunning(true);
            void evaluateCode({ createInput: a.createInput, reference: a.reference, learner: code, cases: a.cases, seed: Date.now() % 100000 })
              .then((v) => submit({ passed: v.passed, total: v.total, status: v.status, error: v.error ?? null }))
              .finally(() => setRunning(false));
          }}>{running ? 'Python liczy… (za pierwszym razem ładuje się ok. 10 MB)' : 'Sprawdź kod'}</button>
        </div>
      );
    case 'point':
      return (
        <div className="cg-answer">
          {a.on === 'map' ? (
            <GeoMap zoom={6} center={{ lat: 51.9, lon: 19.1 }} marks={point === null ? [] : [{ ...point, kind: 'pin' }]} onPick={disabled ? undefined : setPoint} />
          ) : <p className="wk-hint">Wskaż punkt na obrazie pytania.</p>}
          <button type="button" className="wk-btn" disabled={shut || point === null} onClick={() => submit(point)}>Sprawdź</button>
        </div>
      );
    case 'interactive':
      return <InteractiveAnswer card={card} disabled={shut} onSubmit={submit} />;
  }
}

/* -- Was richtig war ------------------------------------------------------------------------- */

export function Verdict({ card, outcome, given, lib, onEntity, extra, showGiven = true }: {
  card: Card;
  outcome: Outcome;
  given: unknown;
  /** Die eigene Antwort noch einmal nennen — nicht, wo sie ohnehin sichtbar stehen bleibt. */
  showGiven?: boolean;
  lib?: CogitaLibrary;
  onEntity?: (id: string) => void;
  extra?: ReactNode;
}) {
  const level = outcome.correct ? 'is-right' : outcome.correctness > 0.5 ? 'is-near' : 'is-wrong';
  const expected = outcome.expected ?? answerText(card);
  const a = card.answer;
  const others = a.form === 'text' || a.form === 'gap' ? a.accepted.filter((x) => x.trim().toLowerCase() !== expected.trim().toLowerCase()) : [];
  /* 2026-10-22 (Schritt 8) — auch auf einer Seite liest die Karte die Baza selbst: keine Erklärungen aus einem Bündel mehr. */
  const explain = (lib === undefined ? [] : card.explain.map((id) => lib.entity(id)).filter((e): e is Entity => e !== undefined));
  return (
    <div className={`cg-verdict ${level}`} role="status">
      <strong>{outcome.correct ? 'Dobrze!' : outcome.correctness > 0.5 ? `Prawie (${percent(outcome.correctness)})` : outcome.answered ? 'Niestety nie.' : 'Bez odpowiedzi.'}</strong>
      {/* Die richtige Antwort steht immer da, grün — auch nach einem Treffer, samt der anderen, die auch gelten. */}
      <span>Poprawnie: <strong className="cg-expected">{expected}</strong>
        {others.length > 0 && <> · także: <span className="cg-expected">{others.join(', ')}</span></>}
        {showGiven && !outcome.correct && givenText(card, given) !== '' ? <> · Twoja odpowiedź: {givenText(card, given)}</> : null}
      </span>
      {/* 2026-10-23 (Schritt 13) — z jakiego powodu, gdy nie chodzi o liczbę (jednostka innej wielkości). */}
      {outcome.note !== undefined && <span className="cg-verdict-note">{outcome.note}</span>}
      {outcome.mask !== undefined && !outcome.correct && (
        <span className="cg-diff" aria-label="Porównanie znak po znaku">
          {spansOf(expected, outcome.mask).map((s, i) => <span key={i} className={`is-${s.level}`}>{s.text}</span>)}
        </span>
      )}
      {card.answer.form === 'code' && typeof given === 'object' && given !== null && typeof (given as { error?: unknown }).error === 'string' && <code>{(given as { error: string }).error}</code>}
      {card.answer.form === 'interactive' && <InteractiveReplay card={card} given={given} />}
      {explain.length > 0 && lib !== undefined && (
        <div className="cg-explain">
          {explain.map((e) => <EntityGlance key={e.id} lib={lib} entity={e} onEntity={onEntity} />)}
        </div>
      )}
      {extra}
    </div>
  );
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
    <section className="cg-face" aria-live="polite">
      {head}
      <CardPrompt parts={card.prompt} />
      {/* Die Antwort bleibt, wo sie war — darunter erscheint nur das Urteil. */}
      <AnswerInput card={card} autoFocus={autoFocus} {...(done === null ? {} : { reveal: done })} onSubmit={(given) => {
        const outcome = checkCard(card, given, rule);
        setDone({ outcome, given });
        onAnswered(outcome, given, Date.now() - started);
      }} />
      {done !== null && (
        <>
          <Verdict card={card} outcome={done.outcome} given={done.given} lib={lib} onEntity={onEntity} showGiven={false} />
          {onNext !== undefined && <div className="wk-actions"><button type="button" className="wk-btn" autoFocus onClick={onNext}>{nextLabel}</button></div>}
        </>
      )}
      {foot}
    </section>
  );
}
