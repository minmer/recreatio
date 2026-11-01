/**
 * 2026-10-27 — EINE FRAGE SCHREIBEN: das eine Schema „Pytanie" (`questionTypes.ts`), so gezeigt, wie
 * man fragt. Oben der Rodzaj pytania (Knöpfe in vier Gruppen), darunter NUR die Felder dieser Art,
 * jedes in seiner Gestalt:
 * <code>
 *   Jedna / kilka z kilku   die Möglichkeiten, die richtigen angehakt (statt Nummern zu tippen)
 *   Prawda czy fałsz        das Zdanie und „prawdziwe / fałszywe"
 *   Połącz w pary           eine Tabelle mit zwei Spalten und ihren Nagłówki, eine Liste einfügen
 *                           („1410 – Grunwald" Zeile für Zeile), „Ile par naraz"
 *   Ułóż w kolejności       die Elemente in der richtigen Folge, mit ↑ ↓
 *   Odpowiedź słowami, Liczba, Data, Luka, Fiszka   die guten Antworten Zeile für Zeile
 *   Mapa, Kod, Rysunek      die gewöhnlichen Felder
 * </code>
 * Daneben (`QuestionPreview`, ausserhalb des Formulars: eine Karte hat selbst ein Formular) die
 * Karte, wie der Lernende sie sieht — bei einer langen Liste von Paaren Karte für Karte.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { CardFace } from './CardFace';
import { questionCards, readAlternatives, readChoices } from './cards';
import { drawParams, paramsProblems, readParamsSpec } from './questionParams';
import { GAP, QUESTION_GROUPS, QUESTION_TYPES, SHOW_MAX, pairsOf, parsePairs, questionProblems, questionType, rawList, showOf } from './questionTypes';
import type { FieldDef } from './schema';
import type { CogitaLibrary } from './store';
import { TexText } from '../ui/tex/Tex';

type Put = (key: string, value: unknown) => void;
/** Ein gewöhnliches Feld des Rodzaj (mit dem Editor des Eintrags), auf Wunsch mit anderer Beschriftung. */
type Field = (key: string, over?: Partial<FieldDef>) => ReactNode;

const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
/* Leer ist keine Null (`Number('')` wäre 0 — die erste Möglichkeit plötzlich richtig). */
const numbers = (v: unknown): number[] => (Array.isArray(v) ? v : [v]).map((x) => (typeof x === 'number' ? x : str(x).trim() === '' ? Number.NaN : Number(str(x)))).filter((n) => Number.isInteger(n) && n >= 0);

export function QuestionFields({ id, data, writes, onSet, field }: { id: string; data: Readonly<Record<string, unknown>>; writes: boolean; onSet: Put; field: Field }) {
  const type = questionType(data.form);
  const problems = questionProblems(data);
  const switchTo = (form: string) => {
    onSet('form', form);
    /* Jedna z kilku hat EINE richtige: von mehreren bleibt die erste. */
    const marked = numbers(data.correct);
    if (form === 'one' && marked.length > 1) onSet('correct', marked.slice(0, 1));
  };
  return (
    <div className="cg cg-question" data-question-editor={type.form}>
      <fieldset className="cg-qtype">
        <legend>Rodzaj pytania</legend>
        {QUESTION_GROUPS.map((g) => (
          <div key={g.id} className="cg-qtype-group">
            <span className="cg-qtype-name">{g.label}</span>
            <div className="cg-chips">
              {QUESTION_TYPES.filter((t) => t.group === g.id).map((t) => (
                <button key={t.form} type="button" className={`cg-chip${t.form === type.form ? ' is-on' : ''}`} aria-pressed={t.form === type.form} disabled={!writes} data-form={t.form}
                  onClick={() => switchTo(t.form)}>{t.label}</button>
              ))}
            </div>
          </div>
        ))}
        <span className="cg-muted">{type.says}</span>
      </fieldset>

      {field('prompt', { label: type.prompt, says: type.form === 'gap' ? 'Brakujące słowo w nawiasach: „Litwo! [[Ojczyzno]] moja!” — uczący się zobaczy „…” i wpisze to słowo. Kilka luk: odpowiedzią są słowa po kolei.' : undefined })}

      {(type.form === 'text' || type.form === 'number' || type.form === 'date' || type.form === 'gap') && (
        <Rows label={type.form === 'gap' ? 'Inne dobre odpowiedzi (bez nich — słowo z nawiasów)' : 'Dobre odpowiedzi — pierwsza jest wzorcowa'} add="odpowiedź" values={rawList(data.answers)} writes={writes}
          placeholder={(i) => (type.form === 'number' ? (i === 0 ? 'np. 12' : 'albo inna liczba') : type.form === 'date' ? 'np. 1410, 1410-07-15' : i === 0 ? 'odpowiedź' : 'inna dobra odpowiedź')}
          min={type.form === 'gap' ? 0 : 1} onChange={(v) => onSet('answers', v)} />
      )}
      {type.form === 'number' && <div className="cg-qmore">{field('unit')}{field('quantity')}{field('tolerance')}{field('relative')}</div>}
      {type.form === 'date' && <div className="cg-qmore">{field('precision')}{field('tolerance')}</div>}
      {type.form === 'gap' && <GapChoices data={data} writes={writes} onSet={onSet} />}
      {(type.form === 'one' || type.form === 'many') && <Choices id={id} data={data} many={type.form === 'many'} writes={writes} onSet={onSet} />}
      {type.form === 'truefalse' && (
        <fieldset className="cg-row cg-qtruth">
          <legend>To zdanie jest</legend>
          <label className="pe-check"><input type="radio" name={`q-truth-${id}`} checked={data.value === true} disabled={!writes} onChange={() => onSet('value', true)} /><span>prawdziwe</span></label>
          <label className="pe-check"><input type="radio" name={`q-truth-${id}`} checked={data.value === false} disabled={!writes} onChange={() => onSet('value', false)} /><span>fałszywe</span></label>
        </fieldset>
      )}
      {type.form === 'match' && <Pairs data={data} writes={writes} onSet={onSet} />}
      {type.form === 'order' && <Rows label="Elementy w dobrej kolejności — uczący się zobaczy je pomieszane" add="element" values={rawList(data.items)} writes={writes} ordered min={2} placeholder={(i) => `${i + 1}.`} onChange={(v) => onSet('items', v)} />}
      {type.form === 'order' && <PreviewChoice data={data} writes={writes} onSet={onSet} optional />}
      {type.form === 'build' && <Build data={data} writes={writes} onSet={onSet} />}
      {type.form === 'flash' && <Rows label="Odwrotna strona" add="linijka" values={rawList(data.back)} writes={writes} min={1} placeholder={() => 'co jest na odwrocie'} onChange={(v) => onSet('back', v)} />}
      {(type.form === 'point' || type.form === 'interactive') && type.fields.map((key) => <div key={key}>{field(key)}</div>)}
      {type.form === 'code' && (
        <>
          {['task', 'starter'].map((key) => <div key={key}>{field(key)}</div>)}
          <JsonArea label="Przykłady widoczne dla uczącego się" value={data.tests} writes={writes} rows={5}
            hint={'[{"input": [3, 1, 2], "output": [1, 2, 3], "note": "rosnąco"}] — transform(input) ma dać output; sprawdzane przed ukrytymi przypadkami.'}
            onChange={(v) => onSet('tests', v)} />
          {['createInput', 'reference', 'cases'].map((key) => <div key={key}>{field(key)}</div>)}
        </>
      )}

      {/* 2026-11-01 — für jede Art: Podpowiedzi vor der Antwort, das Wyjaśnienie danach. */}
      <Rows label="Podpowiedzi — przed odpowiedzią, od łagodnej do konkretnej (każda obniża wynik o ¼)" add="podpowiedź" values={rawList(data.hints)} writes={writes} min={0} placeholder={(i) => (i === 0 ? 'np. Pomyśl o definicji…' : 'konkretniejsza podpowiedź')} onChange={(v) => onSet('hints', v)} />
      {field('explanation')}
      <Params data={data} writes={writes} onSet={onSet} />

      {problems.length > 0 && (
        <ul className="cg-qmissing" aria-label="Czego brakuje">
          {problems.map((p) => <li key={p} className="wk-warn">{p}</li>)}
        </ul>
      )}
    </div>
  );
}

/** Zeilen einer Liste (gute Antworten, Elemente, Rückseite) — leere bleiben stehen, bis gespeichert wird. */
function Rows({ label, add, values, writes, placeholder, onChange, ordered = false, min }: {
  label: string; add: string; values: readonly string[]; writes: boolean; placeholder: (i: number) => string;
  onChange: (v: string[]) => void; ordered?: boolean; min: number;
}) {
  const rows = values.length >= Math.max(1, min) ? [...values] : [...values, ...Array.from({ length: Math.max(1, min) - values.length }, () => '')];
  const set = (next: string[]) => onChange(next);
  const move = (i: number, by: -1 | 1) => {
    const next = [...rows];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    set(next);
  };
  return (
    <fieldset className="cg cg-qrows">
      <legend>{label}</legend>
      {rows.map((v, i) => (
        <div key={i} className="cg-qrow">
          {ordered && <span className="cg-qnum" aria-hidden="true">{i + 1}.</span>}
          <input value={v} disabled={!writes} placeholder={placeholder(i)} aria-label={`${label}: ${i + 1}`} onChange={(e) => set(rows.map((x, j) => (j === i ? e.target.value : x)))} />
          {ordered && writes && <button type="button" className="wk-link-btn" aria-label="Wyżej" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>}
          {ordered && writes && <button type="button" className="wk-link-btn" aria-label="Niżej" disabled={i === rows.length - 1} onClick={() => move(i, 1)}>↓</button>}
          {writes && rows.length > Math.max(1, min) && <button type="button" className="wk-link-btn" aria-label={`Usuń: ${i + 1}`} onClick={() => set(rows.filter((_, j) => j !== i))}>×</button>}
        </div>
      ))}
      {writes && <button type="button" className="wk-link-btn" onClick={() => set([...rows, ''])}>+ {add}</button>}
    </fieldset>
  );
}

/** Die Möglichkeiten mit ihrem Haken — die richtigen werden angeklickt, nicht als Nummern getippt. */
function Choices({ id, data, many, writes, onSet }: { id: string; data: Readonly<Record<string, unknown>>; many: boolean; writes: boolean; onSet: Put }) {
  const raw = rawList(data.options);
  const rows = raw.length >= 2 ? raw : [...raw, ...Array.from({ length: 2 - raw.length }, () => '')];
  const marked = numbers(data.correct).filter((i) => i < rows.length);
  /* 2026-11-01 — ein Satz je Möglichkeit, an derselben Stelle (leer: keiner); er wandert mit, wenn eine Möglichkeit wegfällt. */
  const said = rows.map((_r, i) => rawList(data.feedback)[i] ?? '');
  const [notes, setNotes] = useState(said.some((x) => x.trim() !== ''));
  const write = (options: string[], correct: number[], feedback: string[] = said) => {
    onSet('options', options);
    onSet('correct', [...new Set(correct)].sort((a, b) => a - b));
    if (feedback.some((x) => x.trim() !== '') || Array.isArray(data.feedback)) onSet('feedback', feedback.slice(0, options.length));
  };
  return (
    <fieldset className="cg cg-qrows" data-question-choices="">
      <legend>Możliwości — zaznacz {many ? 'wszystkie dobre' : 'dobrą'}</legend>
      {rows.map((v, i) => (
        <div key={i} className="cg-qrow-wrap">
          <div className="cg-qrow">
            <input type={many ? 'checkbox' : 'radio'} name={`q-correct-${id}`} checked={marked.includes(i)} disabled={!writes} aria-label={`Możliwość ${i + 1} jest dobra`}
              onChange={() => write(rows, many ? (marked.includes(i) ? marked.filter((x) => x !== i) : [...marked, i]) : [i])} />
            <input value={v} disabled={!writes} placeholder={`Możliwość ${i + 1} (wzory: $…$)`} aria-label={`Możliwość ${i + 1}`} onChange={(e) => write(rows.map((x, j) => (j === i ? e.target.value : x)), marked)} />
            {writes && rows.length > 2 && (
              <button type="button" className="wk-link-btn" aria-label={`Usuń możliwość ${i + 1}`}
                onClick={() => write(rows.filter((_, j) => j !== i), marked.filter((x) => x !== i).map((x) => (x > i ? x - 1 : x)), said.filter((_, j) => j !== i))}>×</button>
            )}
          </div>
          {notes && (
            <input className="cg-qnote" value={said[i] ?? ''} disabled={!writes} placeholder={marked.includes(i) ? 'Dlaczego dobrze — zdanie po odpowiedzi' : 'Dlaczego nie — zdanie po odpowiedzi'}
              aria-label={`Zdanie do możliwości ${i + 1}`} onChange={(e) => write(rows, marked, said.map((x, j) => (j === i ? e.target.value : x)))} />
          )}
        </div>
      ))}
      <div className="cg-row">
        {writes && <button type="button" className="wk-link-btn" onClick={() => write([...rows, ''], marked, [...said, ''])}>+ możliwość</button>}
        {!notes && writes && <button type="button" className="wk-link-btn" data-question-feedback="" onClick={() => setNotes(true)}>+ zdanie do każdej możliwości</button>}
      </div>
    </fieldset>
  );
}

/**
 * 2026-11-01 — DIE LÜCKEN EINES TEXTES, jede mit ihrer Auswahl: was falsch zur Wahl steht (mit `|` getrennt); leer —
 * die Lücke wird getippt. Die Lücken kommen aus dem Text (`[[…]]`), in ihrer Folge.
 */
function GapChoices({ data, writes, onSet }: { data: Readonly<Record<string, unknown>>; writes: boolean; onSet: Put }) {
  const words = [...String(data.prompt ?? '').matchAll(GAP)].map((m) => m[1]!.trim());
  const lists = readChoices(data.choices);
  if (words.length === 0) return null;
  const write = (i: number, text: string) => {
    const next = words.map((_w, j) => (j === i ? text.split('|').map((x) => x.trim()).filter((x) => x !== '') : lists[j] ?? []));
    while (next.length > 0 && next[next.length - 1]!.length === 0) next.pop();
    onSet('choices', next.length === 0 ? undefined : next);
  };
  return (
    <fieldset className="cg cg-qrows" data-question-gaps={words.length}>
      <legend>Luki — do wpisania albo do wybrania</legend>
      {words.map((w, i) => (
        <label key={i} className="cg-qrow cg-qgap">
          <span className="cg-qnum">{i + 1}.</span>
          <span className="cg-qgap-word"><TexText text={w} /></span>
          <input value={(lists[i] ?? []).join(' | ')} disabled={!writes} placeholder="do wpisania — albo złe możliwości: Lemma 2.1 | Satz 3.4"
            aria-label={`Złe możliwości luki ${i + 1}`} onChange={(e) => write(i, e.target.value)} />
        </label>
      ))}
      <span className="cg-muted">Luka z możliwościami jest listą do wybrania (mogą być wzory $…$); bez nich — polem do wpisania. Każda luka liczy się osobno.</span>
    </fieldset>
  );
}

/** 2026-11-01 — wie das Gelegte (Gebaute) darüber steht: als Wzór, als Text — bei „Ułóż w kolejności" auch gar nicht. */
function PreviewChoice({ data, writes, onSet, optional = false }: { data: Readonly<Record<string, unknown>>; writes: boolean; onSet: Put; optional?: boolean }) {
  const value = data.preview === 'math' || data.preview === 'text' ? data.preview : optional ? '' : 'math';
  return (
    <div className="cg-qmore" data-question-preview-mode={value}>
      <label className="wk-field">
        <span>Podgląd tego, co ułożone</span>
        <select value={value} disabled={!writes} onChange={(e) => onSet('preview', e.target.value === '' ? undefined : e.target.value)}>
          {optional && <option value="">bez podglądu</option>}
          <option value="math">jako wzór</option>
          <option value="text">jako tekst</option>
        </select>
      </label>
      {value !== '' && (
        <label className="wk-field">
          <span>Między elementami</span>
          <input value={typeof data.join === 'string' ? data.join : ' '} disabled={!writes} placeholder="spacja" onChange={(e) => onSet('join', e.target.value === ' ' ? undefined : e.target.value)} />
        </label>
      )}
    </div>
  );
}

/** 2026-11-01 — ZBUDUJ Z KAFELKÓW: die Kacheln der Antwort in ihrer Folge, die zu viel, andere richtige Folgen, die Vorschau. */
function Build({ data, writes, onSet }: { data: Readonly<Record<string, unknown>>; writes: boolean; onSet: Put }) {
  const alternatives = readAlternatives(data.alternatives);
  const [alt, setAlt] = useState(alternatives.map((a) => a.join(' | ')).join('\n'));
  useEffect(() => { setAlt(readAlternatives(data.alternatives).map((a) => a.join(' | ')).join('\n')); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [JSON.stringify(data.alternatives ?? null)]);
  return (
    <>
      <Rows label="Kafelki dobrej odpowiedzi — w dobrej kolejności (wzory: $…$)" add="kafelek" values={rawList(data.items)} writes={writes} ordered min={1} placeholder={(i) => (i === 0 ? 'np. $\\exists a\\in A$' : `${i + 1}.`)} onChange={(v) => onSet('items', v)} />
      <Rows label="Kafelki zbędne — do zmylenia" add="kafelek" values={rawList(data.extra)} writes={writes} min={0} placeholder={() => 'np. $\\forall a\\in A$'} onChange={(v) => onSet('extra', v)} />
      <label className="wk-field">
        <span>Inne dobre kolejności — jedna w wierszu, kafelki oddzielone „|”</span>
        <textarea rows={2} value={alt} disabled={!writes} placeholder="$B$ | $=$ | $A$" onChange={(e) => {
          setAlt(e.target.value);
          const next = readAlternatives(e.target.value);
          onSet('alternatives', next.length === 0 ? undefined : next);
        }} />
      </label>
      <PreviewChoice data={data} writes={writes} onSet={onSet} />
    </>
  );
}

/**
 * 2026-11-01 — DATEN IN EIGENER GESTALT (JSON): als Text bearbeitet; gespeichert wird, was sich lesen lässt — sonst
 * steht der Fehler darunter, und nichts ändert sich.
 */
function JsonArea({ label, value, writes, rows = 3, hint, onChange }: { label: string; value: unknown; writes: boolean; rows?: number; hint?: string; onChange: (v: unknown) => void }) {
  const shown = (v: unknown): string => (v === undefined || v === null ? '' : typeof v === 'string' ? v : JSON.stringify(v, null, 1).replace(/\n\s*/g, ' '));
  const [text, setText] = useState(shown(value));
  const [error, setError] = useState<string | null>(null);
  /* eslint-disable-next-line react-hooks/exhaustive-deps */
  useEffect(() => { if (error === null) setText(shown(value)); }, [JSON.stringify(value ?? null)]);
  return (
    <label className="wk-field cg-qjson">
      <span>{label}</span>
      <textarea rows={rows} value={text} disabled={!writes} spellCheck={false} aria-invalid={error !== null || undefined} onChange={(e) => {
        const t = e.target.value;
        setText(t);
        if (t.trim() === '') { setError(null); onChange(undefined); return; }
        try { const v = JSON.parse(t) as unknown; setError(null); onChange(v); } catch (err) { setError(err instanceof Error ? err.message : 'to nie jest JSON'); }
      }} />
      {error !== null ? <span className="wk-warn" role="alert">Nie zapisano — to nie jest poprawny JSON: {error}</span> : hint !== undefined && <span className="cg-muted">{hint}</span>}
    </label>
  );
}

/**
 * 2026-11-01 — PARAMETRY: Werte, die bei jedem Zeigen neu gezogen werden ({a} im Text), daraus Gerechnetes ({r}) und
 * Bedingungen für das Ziehen — mit einem Beispiel des Zugs und dem, was nicht stimmt.
 */
function Params({ data, writes, onSet }: { data: Readonly<Record<string, unknown>>; writes: boolean; onSet: Put }) {
  const spec = readParamsSpec(data);
  const [round, setRound] = useState(0);
  const sample = useMemo(() => (spec === null ? null : drawParams(spec, Math.random)), [JSON.stringify([data.params, data.let, data.require]), round]); // eslint-disable-line react-hooks/exhaustive-deps
  const problems = useMemo(() => (spec === null ? [] : paramsProblems(spec)), [JSON.stringify([data.params, data.let, data.require])]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <details className="cg-qparams" open={spec !== null} data-question-params={spec?.params.length ?? 0}>
      <summary>Parametry — nowe liczby przy każdym pytaniu</summary>
      <JsonArea label="Parametry" value={data.params} writes={writes} rows={2}
        hint={'[{"name": "a", "random": [20, 99]}, {"name": "n", "random": [3, 9], "step": 1}] — w tekstach pytania {a}, {n}; albo {"name": "f", "values": ["sin", "cos"]}'}
        onChange={(v) => onSet('params', v)} />
      <JsonArea label="Wartości liczone" value={data.let} writes={writes} rows={2}
        hint={'[{"name": "r", "value": "mod(a, n)"}] — język wyrażeń rysunków (mod, round, sqrt, fmt(x, 2) …); w tekstach {r}'}
        onChange={(v) => onSet('let', v)} />
      <Rows label="Warunki losowania (losuje się od nowa, aż wszystkie są spełnione)" add="warunek" values={rawList(data.require)} writes={writes} min={0} placeholder={() => 'np. a > 2*n'} onChange={(v) => onSet('require', v)} />
      {sample !== null && (
        <p className="cg-muted" data-params-sample="">
          Przykład: {Object.entries(sample.values).map(([k, v]) => `${k} = ${typeof v === 'number' ? Number(v.toPrecision(10)) : v}`).join(', ')}{' '}
          <button type="button" className="wk-link-btn" onClick={() => setRound((r) => r + 1)}>losuj jeszcze raz</button>
        </p>
      )}
      {problems.map((p) => <p key={p} className="wk-warn">{p}</p>)}
    </details>
  );
}

/**
 * PARY: zwei Spalten mit ihren Nagłówki, eine Liste zum Einfügen und „Ile par naraz" — eine lange
 * Liste (40 Jahre und Ereignisse) zeigt je Karte nur ein paar Paare, und jedes Paar hat seine Karte.
 */
function Pairs({ data, writes, onSet }: { data: Readonly<Record<string, unknown>>; writes: boolean; onSet: Put }) {
  const left = rawList(data.left);
  const right = rawList(data.right);
  const rows: [string, string][] = Array.from({ length: Math.max(left.length, right.length, 2) }, (_, i) => [left[i] ?? '', right[i] ?? '']);
  const write = (next: readonly (readonly [string, string])[]) => { onSet('left', next.map((r) => r[0])); onSet('right', next.map((r) => r[1])); };
  const [paste, setPaste] = useState('');
  const parsed = useMemo(() => parsePairs(paste), [paste]);
  const count = pairsOf(data).length;
  const show = showOf(data, count);
  const leftName = str(data.leftLabel).trim() || 'Lewa strona';
  const rightName = str(data.rightLabel).trim() || 'Prawa strona';
  return (
    <fieldset className="cg cg-qpairs" data-question-pairs="">
      <legend>Pary</legend>
      <div className="cg-qpair cg-qpair-head">
        <input value={str(data.leftLabel)} disabled={!writes} placeholder="nagłówek, np. Rok" aria-label="Nagłówek lewej strony" onChange={(e) => onSet('leftLabel', e.target.value)} />
        <input value={str(data.rightLabel)} disabled={!writes} placeholder="nagłówek, np. Wydarzenie" aria-label="Nagłówek prawej strony" onChange={(e) => onSet('rightLabel', e.target.value)} />
        <span />
      </div>
      {rows.map(([l, r], i) => (
        <div key={i} className="cg-qpair">
          <input value={l} disabled={!writes} placeholder={leftName} aria-label={`${leftName} ${i + 1}`} onChange={(e) => write(rows.map((x, j) => (j === i ? [e.target.value, x[1]] : x)))} />
          <input value={r} disabled={!writes} placeholder={rightName} aria-label={`${rightName} ${i + 1}`} onChange={(e) => write(rows.map((x, j) => (j === i ? [x[0], e.target.value] : x)))} />
          {writes && rows.length > 2 ? <button type="button" className="wk-link-btn" aria-label={`Usuń parę ${i + 1}`} onClick={() => write(rows.filter((_, j) => j !== i))}>×</button> : <span />}
        </div>
      ))}
      {writes && <button type="button" className="wk-link-btn" onClick={() => write([...rows, ['', '']])}>+ para</button>}
      {writes && (
        <details className="cg-qpaste">
          <summary>Wklej listę par</summary>
          <textarea rows={5} value={paste} aria-label="Lista par" placeholder={'1410 – Bitwa pod Grunwaldem\n1569 – Unia lubelska'} onChange={(e) => setPaste(e.target.value)} />
          <span className="cg-muted">Jedna para w wierszu. Strony oddziela tabulator (z arkusza), „ – ”, „ | ”, „;” albo „=”.</span>
          <button type="button" className="wk-btn" disabled={parsed.length === 0}
            onClick={() => { write([...rows.filter((x) => x[0].trim() !== '' || x[1].trim() !== ''), ...parsed.map((p): [string, string] => [p.left, p.right])]); setPaste(''); }}>
            Dodaj {parsed.length} {parsed.length === 1 ? 'parę' : 'par'}
          </button>
        </details>
      )}
      <label className="wk-field cg-qshow">
        <span>Ile par naraz na karcie</span>
        <input type="number" min={2} max={SHOW_MAX} step={1} value={typeof data.show === 'number' ? data.show : ''} disabled={!writes} placeholder="wszystkie"
          onChange={(e) => onSet('show', e.target.value === '' ? undefined : Math.max(2, Math.min(SHOW_MAX, Math.round(Number(e.target.value)))))} />
      </label>
      <span className="cg-muted" data-pairs-count={count}>
        {count} {count === 1 ? 'para' : 'par'}{show === null
          ? ' — wszystkie na jednej karcie.'
          : ` — na karcie po ${show}: każda para ma swoją kartę, a obok niej ${show - 1} innych, losowo. W powtórce wracają pary, których jeszcze nie umiesz.`}
      </span>
    </fieldset>
  );
}

/**
 * TAK ZOBACZY TO UCZĄCY SIĘ — die Karte (oder die Karten) dieser Frage, beantwortbar, nichts wird
 * gespeichert. Steht neben dem Formular, nicht darin: die Karte hat ihr eigenes.
 */
export function QuestionPreview({ id, data, lib }: { id: string; data: Readonly<Record<string, unknown>>; lib: CogitaLibrary }) {
  const [round, setRound] = useState(0);
  const text = JSON.stringify(data);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cards = useMemo(() => questionCards({ id, kinds: ['question'], data: { ...data } }, `podglad:${round}`), [id, text, round]);
  const card = cards.length === 0 ? undefined : cards[round % cards.length];
  return (
    <section className="cg-card cg-qpreview" data-question-preview={cards.length}>
      <div className="cg-row-between">
        <strong>Tak zobaczy to uczący się</strong>
        {card !== undefined && (
          <span className="cg-row">
            {cards.length > 1 && <span className="cg-muted">karta {(round % cards.length) + 1} z {cards.length}</span>}
            <button type="button" className="wk-link-btn" onClick={() => setRound((r) => r + 1)}>{cards.length > 1 ? 'Następna karta' : 'Jeszcze raz'}</button>
          </span>
        )}
      </div>
      {card === undefined
        ? <span className="cg-muted">Karta pojawi się, gdy pytanie będzie kompletne.</span>
        : <CardFace key={`${card.key}:${round}`} card={card} lib={lib} autoFocus={false} onAnswered={() => undefined} />}
    </section>
  );
}
