/**
 * COGITA — EINE KARTE: die Frage, die Antwort in ihrer Form (zwölf Formen,
 * [D3]), und danach, was richtig war — mit dem Vergleich Zeichen für Zeichen
 * und dem Wissen, das sie erklärt [D14].
 */

import { useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { checkCard, type Card, type PromptPart } from './cards';
import { spansOf, type Outcome, type TextRule } from './check';
import { evaluateCode } from './python';
import { GeoMap } from './GeoMap';
import { fieldText, fieldsOf, labelOf, type Entity } from './schema';
import type { PublicEntity } from './publish';
import type { CogitaLibrary } from './store';
import { Markup, MediaView, percent, PublicContext } from './ui';

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
  return given === undefined || given === null ? '' : String(given);
}

/* -- Die Antwort ------------------------------------------------------------------------ */

export function AnswerInput({ card, disabled, onSubmit, autoFocus = true }: { card: Card; disabled?: boolean; onSubmit: (given: unknown) => void; autoFocus?: boolean }) {
  const a = card.answer;
  const [text, setText] = useState('');
  const [many, setMany] = useState<ReadonlySet<number>>(new Set());
  const [order, setOrder] = useState<readonly string[]>(a.form === 'order' ? a.shown : []);
  const [pairs, setPairs] = useState<Readonly<Record<number, number>>>({});
  const [flipped, setFlipped] = useState(false);
  const [code, setCode] = useState(a.form === 'code' ? a.starter : '');
  const [running, setRunning] = useState(false);
  const [point, setPoint] = useState<{ lat: number; lon: number } | null>(null);
  const field = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setText(''); setMany(new Set()); setOrder(a.form === 'order' ? a.shown : []); setPairs({}); setFlipped(false);
    setCode(a.form === 'code' ? a.starter : ''); setPoint(null);
    if (autoFocus) window.setTimeout(() => field.current?.focus(), 30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.key, card.fingerprint]);

  const submit = (given: unknown) => { if (disabled !== true) onSubmit(given); };

  switch (a.form) {
    case 'text':
    case 'number':
    case 'date':
    case 'gap':
      return (
        <form className="cg-answer" onSubmit={(e) => { e.preventDefault(); submit(text); }}>
          {a.form === 'gap' && <div className="cg-prompt">{a.shown}</div>}
          <div className="cg-row">
            <input ref={field} type="text" inputMode={a.form === 'number' ? 'decimal' : undefined} value={text} disabled={disabled}
              placeholder={a.form === 'date' ? 'np. 1410, 15 lipca 1410, 1410-07-15' : a.form === 'number' ? 'liczba' : 'odpowiedź'}
              aria-label="Odpowiedź" onChange={(e) => setText(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} />
            {a.form === 'number' && a.unit !== '' && <span>{a.unit}</span>}
            <button type="submit" className="wk-btn" disabled={disabled}>Sprawdź</button>
          </div>
        </form>
      );
    case 'one':
      return (
        <div className="cg-options" role="radiogroup">
          {a.options.map((o, i) => <button key={i} type="button" className="cg-option" disabled={disabled} onClick={() => submit(i)}>{o}</button>)}
        </div>
      );
    case 'many':
      return (
        <div className="cg-answer">
          <div className="cg-options">
            {a.options.map((o, i) => (
              <button key={i} type="button" className={`cg-option${many.has(i) ? ' is-on' : ''}`} aria-pressed={many.has(i)} disabled={disabled}
                onClick={() => setMany((was) => { const next = new Set(was); if (next.has(i)) next.delete(i); else next.add(i); return next; })}>
                <span aria-hidden>{many.has(i) ? '☑' : '☐'}</span> {o}
              </button>
            ))}
          </div>
          <button type="button" className="wk-btn" disabled={disabled} onClick={() => submit([...many].sort((x, y) => x - y))}>Sprawdź</button>
        </div>
      );
    case 'truefalse':
      return (
        <div className="cg-row">
          <button type="button" className="cg-option" disabled={disabled} onClick={() => submit(true)}>Prawda</button>
          <button type="button" className="cg-option" disabled={disabled} onClick={() => submit(false)}>Fałsz</button>
        </div>
      );
    case 'order':
      return (
        <div className="cg-answer">
          <ol className="cg-order">
            {order.map((item, i) => (
              <li key={`${item}-${i}`}>
                <span>{item}</span>
                <button type="button" className="wk-link-btn" aria-label="Wyżej" disabled={disabled || i === 0} onClick={() => setOrder((was) => { const n = [...was]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; })}>↑</button>
                <button type="button" className="wk-link-btn" aria-label="Niżej" disabled={disabled || i === order.length - 1} onClick={() => setOrder((was) => { const n = [...was]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; return n; })}>↓</button>
              </li>
            ))}
          </ol>
          <button type="button" className="wk-btn" disabled={disabled} onClick={() => submit(order)}>Sprawdź</button>
        </div>
      );
    case 'match':
      return (
        <div className="cg-answer">
          <div className="cg-match">
            {a.left.map((l, i) => (
              <label key={i} className="wk-field">
                <span>{l}</span>
                <select value={pairs[i] ?? ''} disabled={disabled} onChange={(e) => setPairs((was) => ({ ...was, [i]: Number(e.target.value) }))}>
                  <option value="">—</option>
                  {a.right.map((r, j) => <option key={j} value={j}>{r}</option>)}
                </select>
              </label>
            ))}
          </div>
          <button type="button" className="wk-btn" disabled={disabled} onClick={() => submit(Object.entries(pairs).map(([l, r]) => [Number(l), r]))}>Sprawdź</button>
        </div>
      );
    case 'flash':
      return flipped ? (
        <div className="cg-answer">
          <div className="cg-flash-back">{a.back.map((b, i) => <p key={i}><Markup text={b} /></p>)}</div>
          <div className="cg-row">
            <button type="button" className="cg-option is-right" disabled={disabled} onClick={() => submit('knew')}>Umiałem</button>
            <button type="button" className="cg-option" disabled={disabled} onClick={() => submit('partly')}>Częściowo</button>
            <button type="button" className="cg-option is-wrong" disabled={disabled} onClick={() => submit('not')}>Nie umiałem</button>
          </div>
        </div>
      ) : (
        <button type="button" className="wk-btn" disabled={disabled} onClick={() => setFlipped(true)}>Pokaż odpowiedź</button>
      );
    case 'code':
      return (
        <div className="cg-answer">
          {a.task !== '' && <Markup text={a.task} />}
          <textarea className="cg-code" spellCheck={false} value={code} disabled={disabled || running} onChange={(e) => setCode(e.target.value)} aria-label="Kod" />
          <button type="button" className="wk-btn" disabled={disabled || running} onClick={() => {
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
          <button type="button" className="wk-btn" disabled={disabled || point === null} onClick={() => submit(point)}>Sprawdź</button>
        </div>
      );
  }
}

/* -- Was richtig war ------------------------------------------------------------------------- */

export function Verdict({ card, outcome, given, lib, onEntity, extra }: {
  card: Card;
  outcome: Outcome;
  given: unknown;
  lib?: CogitaLibrary;
  onEntity?: (id: string) => void;
  extra?: ReactNode;
}) {
  const level = outcome.correct ? 'is-right' : outcome.correctness > 0.5 ? 'is-near' : 'is-wrong';
  const expected = outcome.expected ?? answerText(card);
  const explain = (lib === undefined ? [] : card.explain.map((id) => lib.entity(id)).filter((e): e is Entity => e !== undefined));
  /* 0109 — ohne Bibliothek (eine öffentliche Seite): die Erklärungen, die das Bündel mitbringt. */
  const shown = useContext(PublicContext);
  const explainPublic = lib !== undefined || shown === null ? [] : card.explain.map((id) => shown.entity(id)).filter((e): e is PublicEntity => e !== null);
  return (
    <div className={`cg-verdict ${level}`} role="status">
      <strong>{outcome.correct ? 'Dobrze!' : outcome.correctness > 0.5 ? `Prawie (${percent(outcome.correctness)})` : outcome.answered ? 'Niestety nie.' : 'Bez odpowiedzi.'}</strong>
      {!outcome.correct && <span>Poprawnie: <strong>{expected}</strong>{givenText(card, given) !== '' ? <> · Twoja odpowiedź: {givenText(card, given)}</> : null}</span>}
      {outcome.mask !== undefined && !outcome.correct && (
        <span className="cg-diff" aria-label="Porównanie znak po znaku">
          {spansOf(expected, outcome.mask).map((s, i) => <span key={i} className={`is-${s.level}`}>{s.text}</span>)}
        </span>
      )}
      {card.answer.form === 'code' && typeof given === 'object' && given !== null && typeof (given as { error?: unknown }).error === 'string' && <code>{(given as { error: string }).error}</code>}
      {explain.length > 0 && lib !== undefined && (
        <div className="cg-explain">
          {explain.map((e) => <EntityGlance key={e.id} lib={lib} entity={e} onEntity={onEntity} />)}
        </div>
      )}
      {explainPublic.length > 0 && (
        <div className="cg-explain">
          {explainPublic.map((e) => <PublicGlance key={e.id} entity={e} />)}
        </div>
      )}
      {extra}
    </div>
  );
}

/** Ein Eintrag in Kürze: sein Etikett und, was er sagt — Wissen ganz, andere Felder in Worten. */
export function EntityGlance({ lib, entity, onEntity }: { lib: CogitaLibrary; entity: Entity; onEntity?: (id: string) => void }) {
  const look = lib.look;
  const fields = fieldsOf(entity, look).filter((f) => f.private !== true && f.type !== 'ref' && f.type !== 'media').slice(0, 4);
  const knowledge = entity.kinds.includes('knowledge');
  return (
    <div className="cg-card">
      {knowledge ? <Markup text={String(entity.data.text ?? '')} onEntity={onEntity} resolve={(t) => lib.resolve(t)} />
        : (
          <>
            <strong>{onEntity === undefined ? labelOf(entity, look) : <button type="button" className="cg-ref" onClick={() => onEntity(entity.id)}>{labelOf(entity, look)}</button>}</strong>
            {fields.map((f) => {
              const text = fieldText(entity, f, look);
              return text === '' ? null : <span key={f.key} className="cg-muted">{f.label}: {f.type === 'markup' ? <Markup text={String(entity.data[f.key] ?? '')} /> : text}</span>;
            })}
          </>
        )}
    </div>
  );
}

/** Dasselbe aus einem Bündel (eine öffentliche Seite): Wissen ganz, sonst das Etikett und einige Felder. */
export function PublicGlance({ entity }: { entity: PublicEntity }) {
  const text = entity.fields.find((f) => f.key === 'text' && f.type === 'markup');
  return (
    <div className="cg-card">
      {(entity.kindIds ?? []).includes('knowledge') && text !== undefined ? <Markup text={text.text} /> : (
        <>
          <strong>{entity.label}</strong>
          {entity.fields.slice(0, 4).map((f) => <span key={f.key} className="cg-muted">{f.label}: {f.type === 'markup' ? <Markup text={f.text} /> : f.text}</span>)}
        </>
      )}
    </div>
  );
}

/* -- Frage, Antwort, Urteil ------------------------------------------------------------------- */

export function CardFace({ card, rule, lib, onAnswered, onNext, nextLabel = 'Dalej', head, foot, onEntity }: {
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
}) {
  const [done, setDone] = useState<{ outcome: Outcome; given: unknown } | null>(null);
  const started = useMemo(() => Date.now(), [card.key, card.fingerprint]);
  useEffect(() => { setDone(null); }, [card.key, card.fingerprint]);

  return (
    <section className="cg-face" aria-live="polite">
      {head}
      <CardPrompt parts={card.prompt} />
      {done === null ? (
        <AnswerInput card={card} onSubmit={(given) => {
          const outcome = checkCard(card, given, rule);
          setDone({ outcome, given });
          onAnswered(outcome, given, Date.now() - started);
        }} />
      ) : (
        <>
          <Verdict card={card} outcome={done.outcome} given={done.given} lib={lib} onEntity={onEntity} />
          {onNext !== undefined && <div className="wk-actions"><button type="button" className="wk-btn" autoFocus onClick={onNext}>{nextLabel}</button></div>}
        </>
      )}
      {foot}
    </section>
  );
}
