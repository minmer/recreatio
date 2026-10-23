/**
 * 2026-10-21 — DER PRZEBIEG EINER PRÄSENTATION im Editor (neben der Karte der Wege):
 * wohin die Antworten gehen, welche Werte es gibt, und die Tore (Warunek,
 * Zmień wartość) mit ihren Ausgängen.
 *
 * Bedingungen sind die der einen Logik (`cogita/logic.ts`); hier wählt man,
 * statt Kennungen zu tippen: eine Frage dieser Präsentation, eine Szene, einen
 * Wert.
 *
 * 2026-10-22 (Schritt 12) — „Przebieg w Nauce": derselbe Przebieg als Ablauf
 * der Baza wiedzy (er zeigt auf diese Seite, `cogita/presentationFlow.ts`).
 */

import { useEffect, useState } from 'react';

import { loadAreas, type AreaRow } from '../../areas/area';
import { AreaPick } from '../../areas/AreaPick';
import { PickLibrary } from '../../library/LibraryPick';
import { COMPARE_LABEL, readCondition, type Action, type CompareOp, type Condition } from '../../cogita/logic';
import { newId } from '../../core/ids';
import { useMe, useWho } from '../../core/me';
import { viewPath } from '../../routes';
import type { DraftPart } from '../page';
import { pieceLabelOf } from './PagePresentation';
import type { Show } from './presentation';
import { GATE, targetOptions } from './showPaths';
import { blankGate, GATE_LABEL, NO_STORY, type Gate, type Story, type StoryValue } from './story';

/** Was eine Bedingung hier prüfen kann — die Teile der einen Logik, die eine Präsentation kennt. */
const KINDS = ['answered', 'value', 'visited', 'knowness', 'time', 'and', 'or', 'not'] as const;
type Kind = (typeof KINDS)[number];

const KIND_LABEL: Record<Kind, string> = {
  answered: 'Odpowiedź na pytanie', value: 'Wartość', visited: 'Widziana scena', knowness: 'Jak dobrze umie (pytanie)',
  time: 'Czas', and: 'Wszystkie naraz (I)', or: 'Choć jedno (LUB)', not: 'Nie (NIE)'
};

const OPS: readonly CompareOp[] = ['ge', 'gt', 'eq', 'ne', 'le', 'lt'];

/** Die Fragen dieser Präsentation — mit der Kennung, unter der sie antworten (`question.tsx`: ihr Baustein). */
export const questionsOf = (parts: readonly DraftPart[]): { readonly id: string; readonly label: string }[] =>
  parts.filter((part) => part.kind === 'question').map((part) => ({ id: part.moduleId ?? part.id, label: pieceLabelOf(part) }));

/* -- Eine Bedingung ---------------------------------------------------------------------------------------- */

function ConditionPick({ value, onChange, show, parts, story, depth = 0 }: {
  value: Condition | null;
  onChange: (next: Condition | null) => void;
  show: Show;
  parts: readonly DraftPart[];
  story: Story;
  depth?: number;
}) {
  const c = value;
  const questions = questionsOf(parts);
  const set = (patch: Partial<Condition>) => onChange(readCondition({ ...(c ?? { type: 'answered' }), ...patch }));

  if (c === null) {
    return <button type="button" className="wk-link-btn" onClick={() => onChange({ type: 'answered', of: questions[0]?.id, correct: true })}>+ warunek</button>;
  }
  const kind: Kind = (KINDS as readonly string[]).includes(c.type) ? c.type as Kind : 'answered';
  const group = kind === 'and' || kind === 'or' || kind === 'not';

  return (
    <div className={`pm-cond pm-cond-d${Math.min(depth, 3)}`}>
      <div className="pm-cond-row">
        <select value={kind} aria-label="Co sprawdza warunek" onChange={(e) => {
          const type = e.target.value as Kind;
          onChange(readCondition(type === 'and' || type === 'or' || type === 'not' ? { type, items: c.items ?? (group ? [] : [c]) } : { type }));
        }}>
          {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </select>

        {(kind === 'answered' || kind === 'knowness') && (
          <select value={c.of ?? ''} aria-label="Które pytanie" onChange={(e) => set({ of: e.target.value })}>
            <option value="">— pytanie —</option>
            {questions.map((q) => <option key={q.id} value={q.id}>{q.label}</option>)}
          </select>
        )}
        {kind === 'answered' && (
          <select value={c.correct === undefined ? '' : c.correct ? 'yes' : 'no'} aria-label="Jak odpowiedziano" onChange={(e) => set({ correct: e.target.value === '' ? undefined : e.target.value === 'yes' })}>
            <option value="yes">dobrze</option><option value="no">źle</option><option value="">jakkolwiek</option>
          </select>
        )}
        {kind === 'visited' && (
          <select value={c.of ?? ''} aria-label="Która scena" onChange={(e) => set({ of: e.target.value })}>
            <option value="">— scena —</option>
            {show.scenes.map((sc, i) => <option key={sc.key} value={sc.key}>{i + 1}. {sc.label || 'Scena'}</option>)}
          </select>
        )}
        {kind === 'value' && (
          <select value={c.value ?? ''} aria-label="Która wartość" onChange={(e) => set({ value: e.target.value })}>
            <option value="">— wartość —</option>
            {story.values.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
        )}
        {(kind === 'value' || kind === 'knowness') && (
          <>
            <select value={c.op ?? 'ge'} aria-label="Porównanie" onChange={(e) => set({ op: e.target.value as CompareOp })}>
              {OPS.map((o) => <option key={o} value={o}>{COMPARE_LABEL[o]}</option>)}
            </select>
            <input type="number" step="any" value={c.than ?? ''} aria-label="Liczba" placeholder={kind === 'knowness' ? '0–1' : '0'}
              onChange={(e) => set({ than: e.target.value === '' ? undefined : Number(e.target.value) })} />
          </>
        )}
        {kind === 'time' && (
          <>
            <input type="date" value={c.after ?? ''} aria-label="od dnia" onChange={(e) => set({ after: e.target.value || undefined })} />
            <input type="date" value={c.before ?? ''} aria-label="do dnia" onChange={(e) => set({ before: e.target.value || undefined })} />
          </>
        )}
        <button type="button" className="wk-link-btn" aria-label="Usuń warunek" onClick={() => onChange(null)}>×</button>
      </div>

      {group && (
        <div className="pm-cond-items">
          {(c.items ?? []).map((item, i) => (
            <ConditionPick key={i} value={item} show={show} parts={parts} story={story} depth={depth + 1}
              onChange={(next) => set({ items: next === null ? (c.items ?? []).filter((_, k) => k !== i) : (c.items ?? []).map((x, k) => (k === i ? next : x)) })} />
          ))}
          {(kind !== 'not' || (c.items ?? []).length === 0) && (
            <button type="button" className="wk-link-btn" onClick={() => set({ items: [...(c.items ?? []), { type: 'answered', of: questions[0]?.id, correct: true }] })}>+ warunek w środku</button>
          )}
        </div>
      )}
    </div>
  );
}

/* -- Ein Tor ------------------------------------------------------------------------------------------------- */

export function GateSettings({ gate, show, parts, busy, onGate, onDelete }: {
  gate: Gate;
  show: Show;
  parts: readonly DraftPart[];
  busy: boolean;
  onGate: (next: Gate) => void;
  onDelete: () => void;
}) {
  const story = show.story ?? NO_STORY;
  const options = targetOptions(show).filter((o) => o.value !== `${GATE}${gate.key}`);
  const targetSelect = (label: string, value: string | null, onPick: (next: string | null) => void, mark: string) => (
    <label className="wk-field">
      <span>{label}</span>
      <select value={value ?? ''} disabled={busy} data-pm-gate={mark} onChange={(e) => onPick(e.target.value === '' ? null : e.target.value)}>
        <option value="">— nigdzie (koniec) —</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );

  return (
    <div className="wk-form">
      <h3 className="wk-h2">⑂ {gate.label || GATE_LABEL[gate.type]}</h3>
      <label className="wk-field">
        <span>Nazwa (na mapie)</span>
        <input value={gate.label} disabled={busy} maxLength={80} placeholder={GATE_LABEL[gate.type]} onChange={(e) => onGate({ ...gate, label: e.target.value })} />
      </label>

      {gate.type === 'condition' ? (
        <>
          <div className="wk-field">
            <span>Jeśli</span>
            <ConditionPick value={gate.when} show={show} parts={parts} story={story} onChange={(when) => onGate({ ...gate, when })} />
          </div>
          {targetSelect('Tak — prowadzi do', gate.yes, (yes) => onGate({ ...gate, yes }), 'yes')}
          {targetSelect('Nie — prowadzi do', gate.no, (no) => onGate({ ...gate, no }), 'no')}
        </>
      ) : (
        <>
          <ActionsPick actions={gate.actions} story={story} busy={busy} onActions={(actions) => onGate({ ...gate, actions })} />
          {targetSelect('Potem prowadzi do', gate.next, (next) => onGate({ ...gate, next }), 'next')}
        </>
      )}

      <div className="wk-actions">
        <button type="button" className="wk-link-btn se-drop" disabled={busy} onClick={onDelete}>Usuń</button>
      </div>
    </div>
  );
}

function ActionsPick({ actions, story, busy, onActions }: {
  actions: readonly Action[];
  story: Story;
  busy: boolean;
  onActions: (next: readonly Action[]) => void;
}) {
  return (
    <fieldset className="wk-field pm-actions">
      <legend>Zmienia</legend>
      {story.values.length === 0 && <p className="wk-card-muted">Najpierw dodaj wartość (niżej, „Wartości”).</p>}
      {actions.map((a, i) => (
        <span key={i} className="pm-action">
          <select value={a.value ?? ''} disabled={busy} aria-label="Wartość" onChange={(e) => onActions(actions.map((x, k) => (k === i ? { ...x, value: e.target.value } : x)))}>
            <option value="">— wartość —</option>
            {story.values.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
          <select value={a.type} disabled={busy} aria-label="Jak" onChange={(e) => onActions(actions.map((x, k) => (k === i ? { type: e.target.value === 'set' ? 'set' : 'add', value: x.value, ...(e.target.value === 'set' ? { to: x.to ?? x.by ?? 0 } : { by: x.by ?? x.to ?? 1 }) } : x)))}>
            <option value="add">dodaj</option>
            <option value="set">ustaw na</option>
          </select>
          <input type="number" step="any" disabled={busy} aria-label="Ile" value={(a.type === 'set' ? a.to : a.by) ?? ''}
            onChange={(e) => onActions(actions.map((x, k) => (k === i ? (x.type === 'set' ? { ...x, to: Number(e.target.value) } : { ...x, by: Number(e.target.value) }) : x)))} />
          <button type="button" className="wk-link-btn" disabled={busy} aria-label="Usuń zmianę" onClick={() => onActions(actions.filter((_, k) => k !== i))}>×</button>
        </span>
      ))}
      <button type="button" className="wk-link-btn" disabled={busy || story.values.length === 0}
        onClick={() => onActions([...actions, { type: 'add', value: story.values[0]?.id, by: 1 }])}>+ zmiana</button>
    </fieldset>
  );
}

/* -- 2026-10-22 (Schritt 12): derselbe Przebieg in Nauka ------------------------------------------------------ */

/**
 * Der Ablauf der Baza, der auf diese Präsentation zeigt — gefunden oder (wer in
 * der Baza schreibt) angelegt; geöffnet in einem neuen Fenster, der Editor
 * bleibt offen.
 */
function NaukaFlow({ base, path, name, busy }: { base: string; path: string; name: string; busy: boolean }) {
  const me = useMe(useWho());
  const [working, setWorking] = useState(false);
  const [said, setSaid] = useState<{ readonly href: string; readonly made: boolean } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  if (me == null) return null;
  const make = async () => {
    setWorking(true);
    setFailed(null);
    try {
      const { flowForPresentation } = await import('../../cogita/presentationFlow');
      const done = await flowForPresentation(me.ring, base, path, name);
      const href = viewPath('learn', base, 'przebiegi', done.flowId);
      setSaid({ href, made: done.made });
      window.open(href, '_blank', 'noopener');
    } catch (e) {
      setFailed(e instanceof Error ? e.message : 'Nie udało się.');
    } finally {
      setWorking(false);
    }
  };
  return (
    <div className="wk-field" data-pm-nauka="">
      <span>Ten sam przebieg w Nauce — w bazie wiedzy, obok jej innych przebiegów (wskazuje na tę stronę, niczego nie kopiuje)</span>
      <div className="wk-actions">
        <button type="button" className="wk-btn wk-btn-quiet" disabled={busy || working} onClick={() => void make()}>Przebieg w Nauce</button>
        {said !== null && <a className="wk-link" href={said.href} target="_blank" rel="noopener">{said.made ? 'Założono — otwórz' : 'Otwórz'}</a>}
      </div>
      {failed !== null && <p className="wk-error">{failed}</p>}
    </div>
  );
}

/* -- Der Przebieg als Ganzes --------------------------------------------------------------------------------- */

export function StoryPanel({ show, path, title, busy, onShow, onChoose }: {
  show: Show;
  /** 2026-10-22 (Schritt 12) — die Seite und ihr Titel (der Name des Ablaufs in Nauka). */
  path: string;
  title: string;
  busy: boolean;
  onShow: (next: Show) => void;
  /** Ein neues Tor gleich auswählen (in der Karte). */
  onChoose: (nodeId: string) => void;
}) {
  const story = show.story ?? NO_STORY;
  const setStory = (patch: Partial<Story>) => onShow({ ...show, story: { ...story, ...patch } });
  /* „W Cogicie" gewählt, die Baza wiedzy aber noch nicht — bis dahin bleibt alles im Browser. */
  const [cogita, setCogita] = useState(story.base !== '');
  const [areas, setAreas] = useState<readonly AreaRow[]>([]);
  useEffect(() => {
    let alive = true;
    loadAreas().then((found) => { if (alive) setAreas(found.areas); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);

  const addGate = (type: Gate['type']) => {
    const key = newId().replace(/-/g, '').slice(0, 8);
    setStory({ gates: [...story.gates, blankGate(key, type)] });
    onChoose(`${GATE}${key}`);
  };

  const setValue = (i: number, patch: Partial<StoryValue>) =>
    setStory({ values: story.values.map((v, k) => (k === i ? { ...v, ...patch } : v)) });

  return (
    <details className="wk-fold pm-story" open={show.story !== null}>
      <summary>Przebieg — odpowiedzi, warunki, wartości</summary>

      <fieldset className="wk-field">
        <legend>Odpowiedzi i miejsce, w którym ktoś skończył</legend>
        <label className="wk-check">
          <input type="radio" checked={!cogita} disabled={busy} onChange={() => { setCogita(false); setStory({ base: '', storage: '' }); }} />
          <span>Tylko w przeglądarce — przykład; nic nie wychodzi poza urządzenie</span>
        </label>
        <label className="wk-check">
          <input type="radio" checked={cogita} disabled={busy} onChange={() => setCogita(true)} />
          <span>W Cogicie — zalogowani (i osoby z formularza) uczą się na swoim koncie</span>
        </label>
      </fieldset>

      {cogita && (
        <>
          <div className="wk-field">
            <span>Baza wiedzy, w której liczą się odpowiedzi</span>
            <PickLibrary kind="knowledge" value={story.base} busy={busy} onPick={(id) => setStory({ base: id })} />
          </div>
          {story.base === '' && <p className="wk-blocker">Wybierz bazę wiedzy — do tego czasu odpowiedzi zostają w przeglądarce.</p>}
          <AreaPick areas={areas} label="Dokąd trafiają odpowiedzi zalogowanych" value={story.storage} placeholder="ich własny prywatny obszar"
            extras={[{ value: '', label: 'ich własny prywatny obszar' }]} disabled={busy}
            onChange={(id) => setStory({ storage: id })} />
          <p className="wk-card-muted">Bez konta odpowiedzi zostają w przeglądarce, jak w przykładzie. Osoba z formularza liczy się tylko wtedy, gdy wybrany jest obszar (z przyjmowaniem).</p>
          {story.base !== '' && <NaukaFlow base={story.base} path={path} name={title.trim() || (path.split('/').pop() ?? 'Prezentacja')} busy={busy} />}
        </>
      )}

      <fieldset className="wk-field pm-values">
        <legend>Wartości</legend>
        {story.values.map((v, i) => (
          <span key={v.id} className="pm-value">
            <input value={v.label} disabled={busy} aria-label="Nazwa wartości" placeholder="np. Punkty" onChange={(e) => setValue(i, { label: e.target.value })} />
            <label>od <input type="number" step="any" value={v.start} disabled={busy} aria-label="Na początek" onChange={(e) => setValue(i, { start: Number(e.target.value) || 0 })} /></label>
            <label>min <input type="number" step="any" value={v.min ?? ''} disabled={busy} aria-label="Najmniej" onChange={(e) => setValue(i, { min: e.target.value === '' ? null : Number(e.target.value) })} /></label>
            <label>max <input type="number" step="any" value={v.max ?? ''} disabled={busy} aria-label="Najwięcej" onChange={(e) => setValue(i, { max: e.target.value === '' ? null : Number(e.target.value) })} /></label>
            <button type="button" className="wk-link-btn" disabled={busy} aria-label={`Usuń wartość ${v.label}`} onClick={() => setStory({ values: story.values.filter((_, k) => k !== i) })}>×</button>
          </span>
        ))}
        <button type="button" className="wk-link-btn" disabled={busy}
          onClick={() => setStory({ values: [...story.values, { id: `w${newId().replace(/-/g, '').slice(0, 6)}`, label: `Wartość ${story.values.length + 1}`, start: 0, min: null, max: null }] })}>
          + wartość
        </button>
      </fieldset>

      <div className="wk-actions">
        <button type="button" className="wk-btn wk-btn-quiet" disabled={busy} data-pm-add-gate="condition" onClick={() => addGate('condition')}>+ Warunek</button>
        <button type="button" className="wk-btn wk-btn-quiet" disabled={busy} data-pm-add-gate="set" onClick={() => addGate('set')}>+ Zmień wartość</button>
      </div>
      {show.story !== null && (
        <button type="button" className="wk-link-btn" disabled={busy}
          onClick={() => onShow({ ...show, story: null })}>
          Wyłącz przebieg (pytania nadal sprawdzają, ale nic nie jest zapamiętywane)
        </button>
      )}
    </details>
  );
}
