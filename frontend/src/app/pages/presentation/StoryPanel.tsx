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
import { useT } from '../../core/i18n';
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

/* Die Namen der Arten: pagePresentation.story.kind.<art>. */

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
  const t = useT();
  const c = value;
  const questions = questionsOf(parts);
  const set = (patch: Partial<Condition>) => onChange(readCondition({ ...(c ?? { type: 'answered' }), ...patch }));

  if (c === null) {
    return <button type="button" className="wk-link-btn" onClick={() => onChange({ type: 'answered', of: questions[0]?.id, correct: true })}>{t('pagePresentation.story.addCondition')}</button>;
  }
  const kind: Kind = (KINDS as readonly string[]).includes(c.type) ? c.type as Kind : 'answered';
  const group = kind === 'and' || kind === 'or' || kind === 'not';

  return (
    <div className={`pm-cond pm-cond-d${Math.min(depth, 3)}`}>
      <div className="pm-cond-row">
        <select value={kind} aria-label={t('pagePresentation.story.checks')} onChange={(e) => {
          const type = e.target.value as Kind;
          onChange(readCondition(type === 'and' || type === 'or' || type === 'not' ? { type, items: c.items ?? (group ? [] : [c]) } : { type }));
        }}>
          {KINDS.map((k) => <option key={k} value={k}>{t(`pagePresentation.story.kind.${k}`)}</option>)}
        </select>

        {(kind === 'answered' || kind === 'knowness') && (
          <select value={c.of ?? ''} aria-label={t('pagePresentation.story.whichQuestion')} onChange={(e) => set({ of: e.target.value })}>
            <option value="">{t('pagePresentation.story.questionNone')}</option>
            {questions.map((q) => <option key={q.id} value={q.id}>{q.label}</option>)}
          </select>
        )}
        {kind === 'answered' && (
          <select value={c.correct === undefined ? '' : c.correct ? 'yes' : 'no'} aria-label={t('pagePresentation.story.howAnswered')} onChange={(e) => set({ correct: e.target.value === '' ? undefined : e.target.value === 'yes' })}>
            <option value="yes">{t('pagePresentation.story.right')}</option><option value="no">{t('pagePresentation.story.wrong')}</option><option value="">{t('pagePresentation.story.any')}</option>
          </select>
        )}
        {kind === 'answered' && <input type="number" min={1} max={3650} value={c.within ?? ''} placeholder={t('pagePresentation.story.withinDays')} aria-label={t('pagePresentation.story.withinDays')} onChange={(e) => set({ within: e.target.value === '' ? undefined : Number(e.target.value) })} />}
        {kind === 'visited' && (
          <select value={c.of ?? ''} aria-label={t('pagePresentation.story.whichScene')} onChange={(e) => set({ of: e.target.value })}>
            <option value="">{t('pagePresentation.story.sceneNone')}</option>
            {show.scenes.map((sc, i) => <option key={sc.key} value={sc.key}>{i + 1}. {sc.label || t('pagePresentation.paths.scene')}</option>)}
          </select>
        )}
        {kind === 'value' && (
          <select value={c.value ?? ''} aria-label={t('pagePresentation.story.whichValue')} onChange={(e) => set({ value: e.target.value })}>
            <option value="">{t('pagePresentation.story.valueNone')}</option>
            {story.values.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
        )}
        {(kind === 'value' || kind === 'knowness') && (
          <>
            <select value={c.op ?? 'ge'} aria-label={t('pagePresentation.story.compare')} onChange={(e) => set({ op: e.target.value as CompareOp })}>
              {OPS.map((o) => <option key={o} value={o}>{COMPARE_LABEL[o]}</option>)}
            </select>
            <input type="number" step="any" value={c.than ?? ''} aria-label={t('pagePresentation.story.number')} placeholder={kind === 'knowness' ? '0–1' : '0'}
              onChange={(e) => set({ than: e.target.value === '' ? undefined : Number(e.target.value) })} />
          </>
        )}
        {kind === 'time' && (
          <>
            <input type="date" value={c.after ?? ''} aria-label={t('pagePresentation.story.fromDay')} onChange={(e) => set({ after: e.target.value || undefined })} />
            <input type="date" value={c.before ?? ''} aria-label={t('pagePresentation.story.toDay')} onChange={(e) => set({ before: e.target.value || undefined })} />
          </>
        )}
        <button type="button" className="wk-link-btn" aria-label={t('pagePresentation.story.removeCondition')} onClick={() => onChange(null)}>×</button>
      </div>

      {group && (
        <div className="pm-cond-items">
          {(c.items ?? []).map((item, i) => (
            <ConditionPick key={i} value={item} show={show} parts={parts} story={story} depth={depth + 1}
              onChange={(next) => set({ items: next === null ? (c.items ?? []).filter((_, k) => k !== i) : (c.items ?? []).map((x, k) => (k === i ? next : x)) })} />
          ))}
          {(kind !== 'not' || (c.items ?? []).length === 0) && (
            <button type="button" className="wk-link-btn" onClick={() => set({ items: [...(c.items ?? []), { type: 'answered', of: questions[0]?.id, correct: true }] })}>{t('pagePresentation.story.addInner')}</button>
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
  const t = useT();
  const story = show.story ?? NO_STORY;
  const options = targetOptions(show).filter((o) => o.value !== `${GATE}${gate.key}`);
  const targetSelect = (label: string, value: string | null, onPick: (next: string | null) => void, mark: string) => (
    <label className="wk-field">
      <span>{label}</span>
      <select value={value ?? ''} disabled={busy} data-pm-gate={mark} onChange={(e) => onPick(e.target.value === '' ? null : e.target.value)}>
        <option value="">{t('pagePresentation.story.nowhereEnd')}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );

  return (
    <div className="wk-form">
      <h3 className="wk-h2">⑂ {gate.label || GATE_LABEL[gate.type]}</h3>
      <label className="wk-field">
        <span>{t('pagePresentation.story.nameOnMap')}</span>
        <input value={gate.label} disabled={busy} maxLength={80} placeholder={GATE_LABEL[gate.type]} onChange={(e) => onGate({ ...gate, label: e.target.value })} />
      </label>

      {gate.type === 'condition' ? (
        <>
          <div className="wk-field">
            <span>{t('pagePresentation.story.if')}</span>
            <ConditionPick value={gate.when} show={show} parts={parts} story={story} onChange={(when) => onGate({ ...gate, when })} />
          </div>
          {targetSelect(t('pagePresentation.story.yesLeads'), gate.yes, (yes) => onGate({ ...gate, yes }), 'yes')}
          {targetSelect(t('pagePresentation.story.noLeads'), gate.no, (no) => onGate({ ...gate, no }), 'no')}
        </>
      ) : (
        <>
          <ActionsPick actions={gate.actions} story={story} busy={busy} onActions={(actions) => onGate({ ...gate, actions })} />
          {targetSelect(t('pagePresentation.story.thenLeads'), gate.next, (next) => onGate({ ...gate, next }), 'next')}
        </>
      )}

      <div className="wk-actions">
        <button type="button" className="wk-link-btn se-drop" disabled={busy} onClick={onDelete}>{t('common.delete')}</button>
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
  const t = useT();
  return (
    <fieldset className="wk-field pm-actions">
      <legend>{t('pagePresentation.story.changes')}</legend>
      {story.values.length === 0 && <p className="wk-card-muted">{t('pagePresentation.story.addValueFirst')}</p>}
      {actions.map((a, i) => (
        <span key={i} className="pm-action">
          <select value={a.value ?? ''} disabled={busy} aria-label={t('pagePresentation.story.value')} onChange={(e) => onActions(actions.map((x, k) => (k === i ? { ...x, value: e.target.value } : x)))}>
            <option value="">{t('pagePresentation.story.valueNone')}</option>
            {story.values.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
          <select value={a.type} disabled={busy} aria-label={t('pagePresentation.story.how')} onChange={(e) => onActions(actions.map((x, k) => (k === i ? { type: e.target.value === 'set' ? 'set' : 'add', value: x.value, ...(e.target.value === 'set' ? { to: x.to ?? x.by ?? 0 } : { by: x.by ?? x.to ?? 1 }) } : x)))}>
            <option value="add">{t('pagePresentation.story.add')}</option>
            <option value="set">{t('pagePresentation.story.setTo')}</option>
          </select>
          <input type="number" step="any" disabled={busy} aria-label={t('pagePresentation.story.howMuch')} value={(a.type === 'set' ? a.to : a.by) ?? ''}
            onChange={(e) => onActions(actions.map((x, k) => (k === i ? (x.type === 'set' ? { ...x, to: Number(e.target.value) } : { ...x, by: Number(e.target.value) }) : x)))} />
          <button type="button" className="wk-link-btn" disabled={busy} aria-label={t('pagePresentation.story.removeChange')} onClick={() => onActions(actions.filter((_, k) => k !== i))}>×</button>
        </span>
      ))}
      <button type="button" className="wk-link-btn" disabled={busy || story.values.length === 0}
        onClick={() => onActions([...actions, { type: 'add', value: story.values[0]?.id, by: 1 }])}>{t('pagePresentation.story.addChange')}</button>
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
  const t = useT();
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
      setFailed(e instanceof Error ? e.message : t('common.failed'));
    } finally {
      setWorking(false);
    }
  };
  return (
    <div className="wk-field" data-pm-nauka="">
      <span>{t('pagePresentation.story.naukaHint')}</span>
      <div className="wk-actions">
        <button type="button" className="wk-btn wk-btn-quiet" disabled={busy || working} onClick={() => void make()}>{t('pagePresentation.story.naukaBtn')}</button>
        {said !== null && <a className="wk-link" href={said.href} target="_blank" rel="noopener">{said.made ? t('pagePresentation.story.madeOpen') : t('common.open')}</a>}
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
  const t = useT();
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
      <summary>{t('pagePresentation.story.title')}</summary>

      <fieldset className="wk-field">
        <legend>{t('pagePresentation.story.answersWhere')}</legend>
        <label className="wk-check">
          <input type="radio" checked={!cogita} disabled={busy} onChange={() => { setCogita(false); setStory({ base: '', storage: '' }); }} />
          <span>{t('pagePresentation.story.browserOnly')}</span>
        </label>
        <label className="wk-check">
          <input type="radio" checked={cogita} disabled={busy} onChange={() => setCogita(true)} />
          <span>{t('pagePresentation.story.inCogita')}</span>
        </label>
      </fieldset>

      {cogita && (
        <>
          <div className="wk-field">
            <span>{t('pagePresentation.story.base')}</span>
            <PickLibrary kind="knowledge" value={story.base} busy={busy} onPick={(id) => setStory({ base: id })} />
          </div>
          {story.base === '' && <p className="wk-blocker">{t('pagePresentation.story.pickBase')}</p>}
          <AreaPick areas={areas} label={t('pagePresentation.story.storage')} value={story.storage} placeholder={t('pagePresentation.story.ownArea')}
            extras={[{ value: '', label: t('pagePresentation.story.ownArea') }]} disabled={busy}
            onChange={(id) => setStory({ storage: id })} />
          <p className="wk-card-muted">{t('pagePresentation.story.noAccount')}</p>
          {story.base !== '' && <NaukaFlow base={story.base} path={path} name={title.trim() || (path.split('/').pop() ?? t('pagePresentation.story.presentation'))} busy={busy} />}
        </>
      )}

      <fieldset className="wk-field pm-values">
        <legend>{t('pagePresentation.story.values')}</legend>
        {story.values.map((v, i) => (
          <span key={v.id} className="pm-value">
            <input value={v.label} disabled={busy} aria-label={t('pagePresentation.story.valueName')} placeholder={t('pagePresentation.story.valuePlaceholder')} onChange={(e) => setValue(i, { label: e.target.value })} />
            <label>{t('pagePresentation.story.from')} <input type="number" step="any" value={v.start} disabled={busy} aria-label={t('pagePresentation.story.start')} onChange={(e) => setValue(i, { start: Number(e.target.value) || 0 })} /></label>
            <label>{t('pagePresentation.story.min')} <input type="number" step="any" value={v.min ?? ''} disabled={busy} aria-label={t('pagePresentation.story.least')} onChange={(e) => setValue(i, { min: e.target.value === '' ? null : Number(e.target.value) })} /></label>
            <label>{t('pagePresentation.story.max')} <input type="number" step="any" value={v.max ?? ''} disabled={busy} aria-label={t('pagePresentation.story.most')} onChange={(e) => setValue(i, { max: e.target.value === '' ? null : Number(e.target.value) })} /></label>
            <button type="button" className="wk-link-btn" disabled={busy} aria-label={t('pagePresentation.story.removeValue', { name: v.label })} onClick={() => setStory({ values: story.values.filter((_, k) => k !== i) })}>×</button>
          </span>
        ))}
        <button type="button" className="wk-link-btn" disabled={busy}
          onClick={() => setStory({ values: [...story.values, { id: `w${newId().replace(/-/g, '').slice(0, 6)}`, label: t('pagePresentation.story.valueN', { n: story.values.length + 1 }), start: 0, min: null, max: null }] })}>
          {t('pagePresentation.story.addValue')}
        </button>
      </fieldset>

      <div className="wk-actions">
        <button type="button" className="wk-btn wk-btn-quiet" disabled={busy} data-pm-add-gate="condition" onClick={() => addGate('condition')}>{t('pagePresentation.story.addGate')}</button>
        <button type="button" className="wk-btn wk-btn-quiet" disabled={busy} data-pm-add-gate="set" onClick={() => addGate('set')}>{t('pagePresentation.story.addSet')}</button>
      </div>
      {show.story !== null && (
        <button type="button" className="wk-link-btn" disabled={busy}
          onClick={() => onShow({ ...show, story: null })}>
          {t('pagePresentation.story.off')}
        </button>
      )}
    </details>
  );
}
