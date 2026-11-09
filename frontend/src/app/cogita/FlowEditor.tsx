/**
 * COGITA — ABLÄUFE BAUEN (COGITA.md §8, §9, §11): Schritte als Graph, das
 * Aussehen, Platzhalter einer Erzählvorlage und ihre Verwendung, Ziele (eine
 * Aufgabe), Zeilen der Gestalten, und — für ein Spiel — Zonen, Werte und
 * Auslöser. Daneben: ausprobieren, wer ihn sieht („Kto widzi" — 2026-10-22,
 * Schritt 8: keine Abschrift mehr, die Baza selbst entscheidet), eine Seite mit
 * ihm anlegen, Abhängigkeiten vorschlagen.
 *
 * 2026-10-22 (Schritt 12) — ein Ablauf, der auf eine Präsentation zeigt
 * (`presentation`), hat keinen eigenen Graphen: seine Karte ist das Storyboard
 * der Seite (nur zum Ansehen, geändert wird es dort). Erzähler (`narrators`)
 * hat jeder Ablauf.
 */

import { useEffect, useMemo, useState } from 'react';

import { contentOfLibrary, FlowPlayer } from './FlowPlayer';
import { flowProblems } from './flowCheck';
import { detourProblems } from './detour';
import { mountainProblems, type MountainContext } from './mountain';
import { FLOW_PALETTE, LOOK_LABEL, LOOK_TYPES, proposedDependencies, readFlow, resolveFlow, type CharacterLine, type Flow, type Goal, type LookType, type Narrator, type Slot } from './flow';
import { GameRulesEditor } from './GamePanel';
import { readGame, type GameRules } from './game';
import { graphJson, type Graph } from './graph';
import { GraphEditor } from './GraphEditor';
import { FLOW_PRESETS } from './presets';
import { pageUrl, publishModule } from './publish';
import { WhoSees } from './BaseWho';
import { readCondition } from './logic';
import { ConditionEditor, EntityPicker, entityName, ForeignOnly, useAsync, useBusy, useCtx } from './ui';
import { askText } from '../ui/dialogs';
import { Loading } from '../ui/Loading';
import { pageSteps, viewPath } from '../routes';
import { statementKinds } from './statements';
import { useT } from '../core/i18n';

export function FlowEditor({ chosenId, onChoose }: { chosenId: string | null; onChoose: (id: string | null) => void }) {
  const t = useT();
  const { lib, writes } = useCtx();
  const flows = lib.docs('flow');
  const entry = chosenId === null ? undefined : flows.find((e) => e.id === chosenId);
  const { busy, failed, run } = useBusy();
  /* 2026-10-22 (Schritt 12) — ein Przebieg aus einer Präsentation: nur ihr Adres. */
  const [showPath, setShowPath] = useState('');
  return (
    <div className="cg">
      <div className="cg-row-between">
        <select value={chosenId ?? ''} onChange={(e) => onChoose(e.target.value === '' ? null : e.target.value)} aria-label={t('cogitaEditFlow.editor.flow')}>
          <option value="">{t('cogitaEditFlow.editor.listHead', { n: flows.length })}</option>
          {flows.map((e) => <option key={e.id} value={e.id}>{typeof e.data.name === 'string' ? e.data.name : t('cogitaEditFlow.editor.flow')}{lib.isOwn(e.id) ? '' : t('cogitaEditFlow.editor.fromOrigin', { name: lib.origin(e.id)?.name ?? '?' })}</option>)}
        </select>
        {writes && (
          <details className="cg-card">
            <summary>{t('cogitaEditFlow.editor.new')}</summary>
            <div className="cg">
              {FLOW_PRESETS.map((p) => (
                <button key={p.id} type="button" className="cg-option" disabled={busy} onClick={() => void run(async () => { const made = await lib.saveDoc('flow', p.make()); onChoose(made.id); })}>
                  <span><strong>{p.label}</strong><br /><span className="cg-muted">{p.says}</span></span>
                </button>
              ))}
              <button type="button" className="cg-option" disabled={busy} onClick={() => void run(async () => { const made = await lib.saveDoc('flow', { name: t('cogitaEditFlow.editor.newName'), look: 'reading', graph: { nodes: [], edges: [] } }); onChoose(made.id); })}>{t('cogitaEditFlow.editor.empty')}</button>
              <div className="cg-row">
                <label className="wk-field"><span>{t('cogitaEditFlow.editor.fromShow')}</span><input value={showPath} placeholder={t('cogitaEditFlow.editor.fromShowPh')} onChange={(e) => setShowPath(e.target.value)} /></label>
                <button type="button" className="wk-btn wk-btn-quiet" disabled={busy || showPath.trim().replace(/^#?\/?/, '') === ''} onClick={() => void run(async () => {
                  const path = showPath.trim().replace(/^#?\/?/, '');
                  const made = await lib.saveDoc('flow', { name: path.split('/').pop() ?? t('cogitaEditFlow.editor.showName'), look: 'scenes', presentation: path, graph: { nodes: [], edges: [] } });
                  setShowPath('');
                  onChoose(made.id);
                })}>{t('common.add')}</button>
              </div>
              {failed !== null && <p className="wk-error">{failed}</p>}
            </div>
          </details>
        )}
      </div>
      {entry === undefined
        ? <p className="wk-hint">{t('cogitaEditFlow.editor.intro')}</p>
        : <ForeignOnly id={entry.id} tab="przebiegi"><FlowForm key={entry.id} id={entry.id} /></ForeignOnly>}
    </div>
  );
}

function FlowForm({ id }: { id: string }) {
  const t = useT();
  const { lib, writes, me } = useCtx();
  const entry = lib.docs('flow').find((e) => e.id === id)!;
  const [flow, setFlow] = useState<Flow>(() => readFlow(entry.id, entry.data));
  const [game, setGame] = useState<GameRules>(() => readGame(entry.data.game));
  const [dirty, setDirty] = useState(false);
  const [playing, setPlaying] = useState(false);
  const { busy, failed, run } = useBusy();
  const [said, setSaid] = useState<string | null>(null);
  useEffect(() => { if (!dirty) { setFlow(readFlow(entry.id, entry.data)); setGame(readGame(entry.data.game)); } }, [entry.version, dirty, entry.id, entry.data]);
  const set = (patch: Partial<Flow>) => { setFlow((f) => ({ ...f, ...patch })); setDirty(true); };
  const cards = useAsync(() => lib.cards('flow').then((r) => r.cards), [lib.revision]);
  const find = (x: string) => { const e = lib.docs('flow').find((one) => one.id === x); return e === undefined ? undefined : readFlow(e.id, e.data); };
  const resolved = useMemo(() => resolveFlow(flow, find), [flow, lib.revision]);

  const save = () => run(async () => {
    const doc: Record<string, unknown> = {
      ...entry.data, name: flow.name, look: flow.look, lookId: flow.lookId, start: flow.start, graph: graphJson(flow.graph),
      slots: flow.slots, template: flow.template, fill: flow.fill, overrides: flow.overrides, goals: flow.goals, lines: flow.lines,
      /* 2026-10-22 (Schritt 12) */
      narrators: flow.narrators.map((n) => ({ character: n.character, ...(n.condition === null ? {} : { condition: n.condition }) })),
      presentation: flow.presentation,
      ...(game.zones.length + game.triggers.length + game.values.length > 0 ? { game } : { game: undefined })
    };
    await lib.saveDoc('flow', doc, id);
    setDirty(false);
  });

  if (playing && cards !== undefined) {
    return <FlowPlayer flow={resolved} content={contentOfLibrary(lib, cards ?? [])} learner={null} onClose={() => setPlaying(false)} backLabel={t('cogitaEditFlow.editor.backLabel')} />;
  }

  const templates = lib.docs('flow').filter((e) => e.id !== id && Array.isArray(e.data.slots) && e.data.slots.length > 0);
  const steps = flow.graph.nodes.map((n) => ({ id: n.id, label: `${typeof n.config.title === 'string' && n.config.title !== '' ? n.config.title : n.type} ${n.id.slice(-3)}` }));

  return (
    <div className="cg">
      <div className="cg-row">
        <label className="wk-field"><span>{t('common.name')}</span><input value={flow.name} disabled={!writes} onChange={(e) => set({ name: e.target.value })} /></label>
        <label className="wk-field"><span>{t('cogitaEditFlow.editor.look')}</span>
          <select value={flow.look} disabled={!writes || flow.presentation !== undefined} onChange={(e) => set({ look: e.target.value as LookType })}>{LOOK_TYPES.map((l) => <option key={l} value={l}>{LOOK_LABEL[l]}</option>)}</select>
        </label>
        <button type="button" className="wk-btn" onClick={() => setPlaying(true)}>{t('cogitaEditFlow.editor.try')}</button>
      </div>

      {/* 2026-10-22 (Schritt 12) — ein Storyboard: die Karte kommt aus der Präsentation. */}
      {flow.presentation !== undefined && (
        <>
          <PresentationPath value={flow.presentation} writes={writes} onChange={(presentation) => set({ presentation })} />
          <StoryMap path={flow.presentation} />
        </>
      )}

      {flow.presentation === undefined && (<>
      <details open={flow.template !== undefined}>
        <summary>{t('cogitaEditFlow.editor.template')} {flow.template !== undefined ? t('cogitaEditFlow.editor.templateUsed', { name: String(templates.find((tp) => tp.id === flow.template)?.data.name ?? '?') }) : ''}</summary>
        <div className="cg">
          <label className="wk-field"><span>{t('cogitaEditFlow.editor.usesTemplate')}</span>
            <select value={flow.template ?? ''} disabled={!writes} onChange={(e) => set({ template: e.target.value === '' ? undefined : e.target.value })}>
              <option value="">{t('cogitaEditFlow.editor.noTemplate')}</option>
              {templates.map((tp) => <option key={tp.id} value={tp.id}>{String(tp.data.name ?? t('cogitaEditFlow.editor.templateFallback'))}</option>)}
            </select>
          </label>
          {flow.template !== undefined && (find(flow.template)?.slots ?? []).map((slot) => (
            <div key={slot.id} className="cg-row">
              <span>{slot.label}:</span>
              <EntityPicker lib={lib} kinds={slot.kind === undefined ? undefined : [slot.kind]} value={flow.fill[slot.id] ?? null} onPick={(v) => set({ fill: { ...flow.fill, ...(v === null ? {} : { [slot.id]: v }) } })} />
            </div>
          ))}
          {flow.template === undefined && <SlotsEditor slots={flow.slots} writes={writes} onChange={(slots) => set({ slots })} />}
          <p className="wk-hint">{t('cogitaEditFlow.editor.slotHint', { json: '{"of": {"slot": "osoba"}}' })}</p>
        </div>
      </details>

      {/* 2026-11-04 — ist die Ścieżka folgerichtig? Ein Anfang, ein Ende, keine Sackgassen — jeder Fehler beim Namen. */}
      {flow.template === undefined && <FlowProblems flow={flow} label={(x) => { const e = lib.entity(x); return e === undefined ? x : lib.label(e); }} others={lib.docs('flow').map((d) => readFlow(d.id, d.data))} resolve={(r) => { const x = r.trim(); if (x.startsWith('@')) return lib.byImportRef(x.slice(1), 'flow')?.id ?? null; return lib.docs('flow').some((d) => d.id === x) ? x : null; }} />}
      {flow.template === undefined && (
        <GraphEditor graph={flow.graph} palette={FLOW_PALETTE} cycles readOnly={!writes} start={flow.start}
          onStart={(s) => set({ start: s })} onChange={(g: Graph) => set({ graph: g, start: flow.start ?? g.nodes[0]?.id ?? null })} />
      )}
      </>)}

      <details open={flow.narrators.length > 0}>
        <summary>{t('cogitaEditFlow.editor.people')} {flow.narrators.length > 0 ? t('cogitaEditFlow.editor.narrCount', { n: flow.narrators.length }) : ''}</summary>
        <GoalsEditor goals={flow.goals} writes={writes} onChange={(goals) => set({ goals })} />
        <NarratorsEditor narrators={flow.narrators} writes={writes} onChange={(narrators) => set({ narrators })} />
        <LinesEditor lines={flow.lines} writes={writes} onChange={(lines) => set({ lines })} />
      </details>

      {flow.presentation === undefined && (
        <details>
          <summary>{t('cogitaEditFlow.editor.game')} {game.zones.length > 0 ? t('cogitaEditFlow.editor.zones', { n: game.zones.length }) : ''}</summary>
          <GameRulesEditor rules={game} steps={steps} writes={writes} onChange={(g) => { setGame(g); setDirty(true); }} />
        </details>
      )}

      {failed !== null && <p className="wk-error">{failed}</p>}
      {said !== null && <p className="wk-hint">{said}</p>}
      {writes && (
        <div className="wk-actions">
          <button type="button" className="wk-btn" disabled={busy || !dirty} onClick={() => void save()}>{busy ? t('common.saving') : t('cogitaEditFlow.editor.save')}</button>
          <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void run(async () => {
            const proposed = proposedDependencies(resolved);
            const settings = lib.settings();
            const have = new Set(settings.dependencies.map((d) => `${d.parent}>${d.child}`));
            const fresh = proposed.filter((p) => !have.has(`${p.parent}>${p.child}`)).map((p) => ({ ...p, kind: 'prerequisite', impact: 0.5, proposed: true }));
            if (fresh.length > 0) await lib.saveSettings({ dependencies: [...settings.dependencies, ...fresh] });
            setSaid(fresh.length === 0 ? t('cogitaEditFlow.editor.noDeps') : t('cogitaEditFlow.editor.proposedDeps', { n: fresh.length }));
          })}>{t('cogitaEditFlow.editor.proposeDeps')}</button>
          <button type="button" className="wk-link-btn" disabled={busy} onClick={async () => { if (await askText(t('cogitaEditFlow.editor.askDelete'))) void run(() => lib.remove(id)); }}>{t('common.delete')}</button>
        </div>
      )}
      <WhoSees id={id} />
      {writes && me !== null && <PageWithFlow id={id} name={flow.name} onSaid={setSaid} />}
    </div>
  );
}

/**
 * 2026-10-22 (Schritt 12) — DAS STORYBOARD ALS KARTE: der Graph, wie ihn der
 * Motor der Abläufe liest (`storyToFlow`) — nur zum Ansehen; geändert wird er
 * in der Präsentation (Przejścia). Die Seite wird geholt wie jede andere, mit
 * dem eigenen Zugang.
 */
function StoryMap({ path }: { path: string }) {
  const t = useT();
  const [state, setState] = useState<{ graph: Graph; start: string | null; editable: boolean; real: string; scenes: number } | string | null>(null);
  useEffect(() => {
    let alive = true;
    setState(null);
    void import('../pages/presentation/storyOfPage').then((m) => m.loadStory(path)).then(
      (s) => { if (alive) setState({ graph: s.flow.graph, start: s.flow.start, editable: s.page.editable, real: s.path, scenes: s.show.scenes.length }); },
      (e: unknown) => { if (alive) setState(e instanceof Error ? e.message : t('cogitaEditFlow.editor.showFailed')); });
    return () => { alive = false; };
  }, [path]);
  if (state === null) return <Loading lines={2} />;
  if (typeof state === 'string') return <p className="wk-error">{state}</p>;
  return (
    <div className="cg">
      <div className="cg-row-between">
        <span className="cg-muted">{t('cogitaEditFlow.editor.storyboard', { n: state.scenes })}</span>
        {state.editable && <a className="wk-btn wk-btn-quiet" href={viewPath('pages', ...pageSteps(state.real))}>{t('cogitaEditFlow.editor.editShow')}</a>}
      </div>
      <GraphEditor graph={state.graph} palette={FLOW_PALETTE} cycles readOnly start={state.start} onChange={() => undefined} />
    </div>
  );
}

/** Der Adres der Präsentation — übernommen beim Verlassen des Feldes (die Karte lädt dann neu). */
function PresentationPath({ value, writes, onChange }: { value: string; writes: boolean; onChange: (path: string) => void }) {
  const t = useT();
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);
  const commit = () => {
    const path = draft.trim().replace(/^#?\/?/, '');
    if (path !== '' && path !== value) onChange(path); else setDraft(value);
  };
  return (
    <label className="wk-field"><span>{t('cogitaEditFlow.editor.showPath')}</span>
      <input value={draft} disabled={!writes} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') commit(); }} />
    </label>
  );
}

/** 2026-10-22 (Schritt 12) — Erzähler nach Werten: der erste, dessen Bedingung gilt, erzählt den Schritt. */
function NarratorsEditor({ narrators, writes, onChange }: { narrators: readonly Narrator[]; writes: boolean; onChange: (n: Narrator[]) => void }) {
  const t = useT();
  const { lib } = useCtx();
  const put = (i: number, patch: Partial<Narrator>) => onChange(narrators.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div className="cg">
      <span className="cg-muted">{t('cogitaEditFlow.editor.narrators')}</span>
      {narrators.map((n, i) => (
        <div key={i} className="cg-card" data-narrator-row={i}>
          <div className="cg-row">
            <EntityPicker lib={lib} value={n.character} onPick={(v) => v !== null && put(i, { character: v })} allowClear={false} placeholder={t('cogitaEditFlow.editor.whoTells')} />
            {writes && i > 0 && <button type="button" className="wk-link-btn" aria-label={t('cogitaEditFlow.editor.up')} onClick={() => onChange(narrators.map((x, j) => (j === i - 1 ? narrators[i] : j === i ? narrators[i - 1] : x)))}>↑</button>}
            {writes && <button type="button" className="wk-link-btn" aria-label={t('cogitaEditFlow.editor.removeNarrator')} onClick={() => onChange(narrators.filter((_, j) => j !== i))}>×</button>}
          </div>
          <ConditionEditor value={n.condition} onChange={(c) => put(i, { condition: c })} name={(x) => entityName(lib, x)} />
        </div>
      ))}
      {writes && (
        <div className="cg-row">
          <span className="cg-muted">{t('cogitaEditFlow.editor.newNarrator')}</span>
          <EntityPicker lib={lib} value={null} onPick={(v) => v !== null && onChange([...narrators, { character: v, condition: null }])} placeholder={t('cogitaEditFlow.editor.whoTells')} />
        </div>
      )}
    </div>
  );
}

function SlotsEditor({ slots, writes, onChange }: { slots: readonly Slot[]; writes: boolean; onChange: (s: Slot[]) => void }) {
  const t = useT();
  const { lib } = useCtx();
  return (
    <div className="cg">
      <span className="cg-muted">{t('cogitaEditFlow.editor.slots')}</span>
      {slots.map((s, i) => (
        <div key={i} className="cg-row">
          <input value={s.id} placeholder={t('cogitaEditFlow.editor.slotKey')} disabled={!writes} onChange={(e) => onChange(slots.map((x, j) => (j === i ? { ...x, id: e.target.value.replace(/[^a-z0-9_]/gi, '') } : x)))} />
          <input value={s.label} placeholder={t('cogitaEditFlow.editor.slotName')} disabled={!writes} onChange={(e) => onChange(slots.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
          <select value={s.kind ?? ''} disabled={!writes} onChange={(e) => onChange(slots.map((x, j) => (j === i ? { ...x, kind: e.target.value || undefined } : x)))}>
            <option value="">{t('cogitaEditFlow.editor.anyKind')}</option>
            {lib.kinds.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
          </select>
          {writes && <button type="button" className="wk-link-btn" onClick={() => onChange(slots.filter((_, j) => j !== i))}>×</button>}
        </div>
      ))}
      {writes && <button type="button" className="wk-link-btn" onClick={() => onChange([...slots, { id: `miejsce${slots.length + 1}`, label: t('cogitaEditFlow.editor.slotDefault') }])}>{t('cogitaEditFlow.editor.addSlot')}</button>}
    </div>
  );
}

function GoalsEditor({ goals, writes, onChange }: { goals: readonly Goal[]; writes: boolean; onChange: (g: Goal[]) => void }) {
  const t = useT();
  return (
    <div className="cg">
      <span className="cg-muted">{t('cogitaEditFlow.editor.goals')}</span>
      {goals.map((g, i) => (
        <div key={g.id} className="cg-card">
          <div className="cg-row">
            <input value={g.title} disabled={!writes} onChange={(e) => onChange(goals.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
            {writes && <button type="button" className="wk-link-btn" onClick={() => onChange(goals.filter((_, j) => j !== i))}>×</button>}
          </div>
          <ConditionEditor value={g.condition} onChange={(c) => onChange(goals.map((x, j) => (j === i ? { ...x, condition: c } : x)))} />
        </div>
      ))}
      {writes && <button type="button" className="wk-link-btn" onClick={() => onChange([...goals, { id: `cel${goals.length + 1}`, title: t('cogitaEditFlow.editor.newGoal'), condition: readCondition({ type: 'visited' }) }])}>{t('cogitaEditFlow.editor.addGoal')}</button>}
    </div>
  );
}

/*
  2026-10-17 — SPRECHEN DARF JEDER EINTRAG. Früher nur einer, dessen Rodzaj
  „Postać — może mówić" trug; das Häkchen ist fort. Eine neue Zeile entsteht,
  sobald beide gewählt sind: wer spricht und was (ein Satz Wissen).
*/
function LinesEditor({ lines, writes, onChange }: { lines: readonly CharacterLine[]; writes: boolean; onChange: (l: CharacterLine[]) => void }) {
  const t = useT();
  const { lib } = useCtx();
  const [who, setWho] = useState<string | null>(null);
  const [what, setWhat] = useState<string | null>(null);
  const add = (character: string | null, of: string | null) => {
    setWho(character);
    setWhat(of);
    if (character === null || of === null) return;
    onChange([...lines, { character, of, condition: null, once: true }]);
    setWho(null);
    setWhat(null);
  };
  return (
    <div className="cg">
      <span className="cg-muted">{t('cogitaEditFlow.editor.lines')}</span>
      {lines.map((l, i) => (
        <div key={i} className="cg-card">
          <div className="cg-row">
            <EntityPicker lib={lib} value={l.character} onPick={(v) => v !== null && onChange(lines.map((x, j) => (j === i ? { ...x, character: v } : x)))} allowClear={false} placeholder={t('cogitaEditFlow.editor.whoSays')} />
            <EntityPicker lib={lib} kinds={statementKinds(lib.refKinds)} refs value={l.of} onPick={(v) => v !== null && onChange(lines.map((x, j) => (j === i ? { ...x, of: v } : x)))} allowClear={false} placeholder={t('cogitaEditFlow.editor.whatSays')} />
            <label className="pe-check"><input type="checkbox" checked={l.once} disabled={!writes} onChange={(e) => onChange(lines.map((x, j) => (j === i ? { ...x, once: e.target.checked } : x)))} /><span>{t('cogitaEditFlow.editor.once')}</span></label>
            {writes && <button type="button" className="wk-link-btn" onClick={() => onChange(lines.filter((_, j) => j !== i))}>×</button>}
          </div>
          <ConditionEditor value={l.condition} onChange={(c) => onChange(lines.map((x, j) => (j === i ? { ...x, condition: c } : x)))} name={(x) => entityName(lib, x)} />
        </div>
      ))}
      {writes && (
        <div className="cg-row">
          <span className="cg-muted">{t('cogitaEditFlow.editor.newLine')}</span>
          <EntityPicker lib={lib} value={who} onPick={(v) => add(v, what)} placeholder={t('cogitaEditFlow.editor.whoSays')} />
          <EntityPicker lib={lib} kinds={statementKinds(lib.refKinds)} refs value={what} onPick={(v) => add(who, v)} placeholder={t('cogitaEditFlow.editor.whatSays')} />
        </div>
      )}
    </div>
  );
}

/**
 * 2026-10-22 (Schritt 8) — eine Seite mit diesem Przebieg. Keine Abschrift:
 * der Baustein liest die Baza selbst; wer die Seite sieht, liest sie so, wie
 * die Baza ihn lässt („Kto widzi").
 */
function PageWithFlow({ id, name, onSaid }: { id: string; name: string; onSaid: (s: string) => void }) {
  const t = useT();
  const { lib, me } = useCtx();
  const { busy, failed, run } = useBusy();
  const [role, setRole] = useState(me?.person.id ?? '');
  if (me === null) return null;
  return (
    <section className="cg-card">
      <h3>{t('cogitaEditFlow.editor.page')}</h3>
      <p className="cg-muted">{t('cogitaEditFlow.editor.pageHint')}</p>
      <div className="cg-row">
        <select value={role} onChange={(e) => setRole(e.target.value)} aria-label={t('cogitaEditFlow.editor.whosePage')}>{me.roles.filter((r) => r.kind !== 'account').map((r) => <option key={r.id} value={r.id}>{me.names.get(r.id) ?? t('cogitaEditFlow.editor.role')}</option>)}</select>
        <button type="button" className="wk-btn" disabled={busy || role === ''} onClick={() => void run(async () => {
          const path = await publishModule({ roleId: role, title: name, parts: [{ kind: 'cogita-flow', config: { library: lib.libraryId, flow: id } }] });
          await navigator.clipboard?.writeText(pageUrl(path)).catch(() => undefined);
          onSaid(t('cogitaEditFlow.editor.pageReady', { url: pageUrl(path) }));
        })}>{t('cogitaEditFlow.editor.makePage')}</button>
      </div>
      {failed !== null && <p className="wk-error">{failed}</p>}
    </section>
  );
}

/** 2026-11-04 — was an der Ścieżka eines Ablaufs nicht stimmt (`flowCheck.ts`): Fehler zuerst, jeder Schritt beim Namen. */
function FlowProblems({ flow, label, others, resolve }: { flow: Flow; label: (id: string) => string; others: readonly Flow[]; resolve: (ref: string) => string | null }) {
  const t = useT();
  /* 2026-11-04 (Prompt 13) — dazu die Abstecher: eine Erzählung, die es nicht gibt; ein Kreis A → B → A (beide beim Namen); zu tief. */
  const { lib } = useCtx();
  /* 2026-11-06 — ein Sechseck mit inneren Wegen (`mountain.ts`): Abschnitte, Pflichtfragen, Abdeckung jedes Weges. */
  const entityOf = (ref: string): string | null => { const r = ref.trim(); if (r === '') return null; if (r.startsWith('@')) return lib.byImportRef(r.slice(1), 'entity')?.id ?? null; return lib.entity(r) !== undefined ? r : null; };
  const refsOf = (v: unknown): string[] => (Array.isArray(v) ? v : v == null ? [] : [v]).flatMap((x) => { const id = typeof x === 'string' ? entityOf(x) : null; return id === null ? [] : [id]; });
  const mountain: MountainContext = {
    flow: (ref) => { const id = resolve(ref); return id === null ? undefined : others.find((f) => f.id === id) ?? (id === flow.id ? flow : undefined); },
    entity: entityOf,
    question: (id) => { const e = lib.entity(id); if (e === undefined || !e.kinds.includes('question')) return null; const d = lib.entry(id)?.data ?? {}; return { about: refsOf(d.about), explain: refsOf(d.explain) }; },
    label
  };
  const list = [...flowProblems(flow, label), ...detourProblems(flow, others, resolve), ...mountainProblems(flow, mountain)];
  if (list.length === 0) return <p className="cg-muted" data-flow-problems="0">{t('cogitaEditFlow.editor.pathOk')}</p>;
  const errors = list.filter((p) => p.level === 'error');
  return (
    <div className={errors.length > 0 ? 'wk-error' : 'wk-note'} role="status" data-flow-problems={list.length}>
      <p>{errors.length > 0 ? t('cogitaEditFlow.editor.pathError') : t('cogitaEditFlow.editor.pathWarn')}</p>
      <ul>{[...errors, ...list.filter((p) => p.level === 'warning')].slice(0, 12).map((p, i) => <li key={i}>{p.text}</li>)}{list.length > 12 && <li>{t('cogitaEditFlow.editor.more', { n: list.length - 12 })}</li>}</ul>
    </div>
  );
}
