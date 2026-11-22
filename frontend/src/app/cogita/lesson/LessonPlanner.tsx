/**
 * 2026-11-22 (I11) — EINE STUNDE PLANEN (Modus „Prowadzę"): Anfang und Ziel wählen, der Weg dazwischen kommt von selbst (dieselbe
 * Rechnung wie „Prowadź mnie tutaj", `lessonPlan.ts`), dann auslassen, hinzufügen, verschieben, je Turm „nur Pfad" oder „Pfad
 * und Turm" — speichern (in der Klasse, wieder zu öffnen, zu kopieren) und mit einem Klick als Stunde beginnen.
 *
 * <code>
 *   …/klasy/<klasse>/plan              die gespeicherten Planungen der Klasse und „Nowy plan"
 *   …/klasy/<klasse>/plan/nowy[/<ziel>] eine neue Planung (vom Turm auf der Karte: das Ziel steht schon da)
 *   …/klasy/<klasse>/plan/<planung>     eine gespeicherte Planung ändern, starten
 * </code>
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { fmtDate, useT } from '../../core/i18n';
import { Icon } from '../../ui/icons';
import { Loading } from '../../ui/Loading';
import { TreePick, type TreeNode } from '../../ui/TreePick';
import { ask } from '../../ui/dialogs';
import { readFlow } from '../flow';
import { useAsync, useCtx } from '../ui';
import { createLesson, deletePlan, loadPlans, savePlan, type SavedPlan } from './lessonApi';
import {
  addItems, classState, knownFrom, lessonPartsOf, moveItem, planWarnings, questionPathItems, readPlanDoc, removeItem, routeItems,
  setAsk, setSkip, TOWER_QUESTIONS_MAX, pathItem, towerItem, type LessonPlanDoc, type PlanItem, type PlanStart
} from './lessonPlan';
import { useLeadAreas } from './MapClassTools';
import { planWorld, type PlanWorld } from './lessonWorld';
import type { ShowVotes } from './lessonTally';
import './lesson.css';

const HOME_VALUE = '~home';

export function LessonPlanner({ classAreaId, trail }: { classAreaId: string; trail: readonly string[] }) {
  const t = useT();
  const { lib, me, href } = useCtx();
  const areas = useLeadAreas(lib, me);
  const area = areas?.find((a) => a.areaId.toLowerCase() === classAreaId.toLowerCase()) ?? null;
  const cards = useAsync(() => lib.cards('learn').then((r) => r.cards), [lib, lib.revision]);
  const pw = useMemo(() => (cards == null ? null : planWorld(lib, cards)), [lib, lib.revision, cards]); // eslint-disable-line react-hooks/exhaustive-deps
  const [plans, setPlans] = useState<readonly SavedPlan[] | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (me === null || area === null) return undefined;
    let alive = true;
    void loadPlans(lib, me, area.areaId).then((p) => { if (alive) setPlans(p); }, () => { if (alive) setPlans([]); });
    return () => { alive = false; };
  }, [lib, me, area?.areaId, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  if (me === null) return <p className="wk-lede">{t('cogitaClass.tab.needAccount')}</p>;
  if (areas === null) return <Loading label={t('cogitaLesson.plan.loading')} />;
  if (area === null) return <p className="wk-error" data-plan-not-lead="">{t('cogitaLesson.plan.notLead')}</p>;
  if (pw === null) return <Loading label={t('cogitaLesson.plan.loading')} />;

  const back = <a className="wk-link-btn" href={href('klasy')}>‹ {t('cogitaLesson.plan.toClasses')}</a>;
  const sub = trail[0];
  if (sub === undefined) {
    return (
      <div className="cg cg-plan" data-plan-home={area.areaId}>
        {back}
        <h2 className="wk-h2">{t('cogitaLesson.plan.title', { name: area.name })}</h2>
        <p className="wk-lede">{t('cogitaLesson.plan.lede')}</p>
        <div className="wk-actions"><a className="wk-btn" href={href('klasy', area.areaId, 'plan', 'nowy')} data-plan-new=""><Icon name="plus" />{t('cogitaLesson.plan.new')}</a></div>
        <SavedPlans plans={plans} pw={pw} areaId={area.areaId} onChanged={() => setTick((n) => n + 1)} />
      </div>
    );
  }
  if (sub === 'nowy') return <PlanEditor key={`new:${trail[1] ?? ''}`} pw={pw} areaId={area.areaId} areaName={area.name} saved={null} target={trail[1] ?? null} back={back} onSaved={() => setTick((n) => n + 1)} />;
  if (plans === null) return <Loading label={t('cogitaLesson.plan.loading')} />;
  const saved = plans.find((p) => p.sessionId === sub) ?? null;
  if (saved === null) return <div className="cg">{back}<p className="wk-error">{t('cogitaLesson.plan.noSuch')}</p></div>;
  return <PlanEditor key={saved.sessionId} pw={pw} areaId={area.areaId} areaName={area.name} saved={saved} target={null} back={back} onSaved={() => setTick((n) => n + 1)} />;
}

/* -- Die gespeicherten Planungen ------------------------------------------------------------------------------------- */

function SavedPlans({ plans, pw, areaId, onChanged }: { plans: readonly SavedPlan[] | null; pw: PlanWorld; areaId: string; onChanged: () => void }) {
  const t = useT();
  const { lib, me, href } = useCtx();
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  if (plans === null) return <Loading lines={2} />;
  if (plans.length === 0) return <p className="wk-empty" data-plan-none="">{t('cogitaLesson.plan.none')}</p>;
  const label = (id: string) => pw.world.places.get(id)?.label ?? id;
  const act = (id: string, work: () => Promise<unknown>) => {
    setBusy(id);
    setFailed(null);
    void work().then(onChanged, (e: unknown) => setFailed(e instanceof Error ? e.message : String(e))).finally(() => setBusy(null));
  };
  const start = (p: SavedPlan) => act(p.sessionId, async () => {
    if (me === null) return;
    const id = await createLesson(lib, me, { areaId, title: p.config.title, parts: p.config.parts, showVotes: p.config.showVotes, thresholds: p.config.thresholds, ...(p.config.plan === undefined ? {} : { plan: p.config.plan }) });
    window.location.hash = href('sesje', id).replace(/^#/, '');
  });
  const copy = (p: SavedPlan) => act(p.sessionId, async () => {
    if (me === null) return;
    await savePlan(lib, me, { areaId, title: t('cogitaLesson.plan.copyOf', { title: p.config.title }), parts: p.config.parts, showVotes: p.config.showVotes, thresholds: p.config.thresholds, ...(p.config.plan === undefined ? {} : { plan: p.config.plan }) });
  });
  const remove = (p: SavedPlan) => {
    void ask({ title: t('cogitaLesson.plan.deleteAsk', { title: p.config.title }), body: t('cogitaLesson.plan.deleteSays'), confirm: t('common.delete'), danger: true })
      .then((yes) => { if (yes) act(p.sessionId, () => deletePlan(p.sessionId)); });
  };
  return (
    <>
      <ul className="cg-plan-saved">
        {plans.map((p) => {
          const doc = readPlanDoc(p.config.plan);
          return (
            <li key={p.sessionId} className="cg-card" data-plan-saved={p.sessionId}>
              <div className="cg-row-between">
                <strong>{p.config.title}</strong>
                <span className="cg-muted">{fmtDate(Date.parse(p.updatedAt), { dateStyle: 'medium' })}</span>
              </div>
              <p className="cg-muted">{t('cogitaLesson.plan.summary', { parts: p.config.parts.length, target: doc === null ? '—' : label(doc.target) })}</p>
              <div className="wk-actions">
                <button type="button" className="wk-btn" disabled={busy !== null} onClick={() => start(p)} data-plan-start-saved={p.sessionId}><Icon name="play" />{t('cogitaLesson.plan.start')}</button>
                <a className="wk-btn wk-btn-line" href={href('klasy', areaId, 'plan', p.sessionId)} data-plan-open={p.sessionId}>{t('cogitaLesson.plan.open')}</a>
                <button type="button" className="wk-link-btn" disabled={busy !== null} onClick={() => copy(p)} data-plan-copy={p.sessionId}>{t('cogitaLesson.plan.copy')}</button>
                <button type="button" className="wk-link-btn" disabled={busy !== null} onClick={() => remove(p)}>{t('common.delete')}</button>
              </div>
            </li>
          );
        })}
      </ul>
      {failed !== null && <p className="wk-error">{failed}</p>}
    </>
  );
}

/* -- Eine Planung ------------------------------------------------------------------------------------------------------- */

const startValue = (s: PlanStart): string => (s.kind === 'home' ? HOME_VALUE : s.kind === 'place' ? s.place : HOME_VALUE);

function PlanEditor({ pw, areaId, areaName, saved, target: given, back, onSaved }: {
  pw: PlanWorld; areaId: string; areaName: string; saved: SavedPlan | null; target: string | null; back: ReactNode; onSaved: () => void;
}) {
  const t = useT();
  const { lib, me, href } = useCtx();
  const { world, lines, settings, paths } = pw;
  const savedDoc = useMemo(() => readPlanDoc(saved?.config.plan), [saved]);
  const [start, setStart] = useState<PlanStart>(savedDoc?.start ?? { kind: 'home' });
  const [target, setTarget] = useState<string>(() => {
    const want = savedDoc?.target ?? given ?? '';
    return world.places.has(want) ? want : '';
  });
  const [items, setItems] = useState<readonly PlanItem[]>(savedDoc?.items ?? []);
  const [title, setTitle] = useState(saved?.config.title ?? '');
  const [showVotes, setShowVotes] = useState<ShowVotes>(saved?.config.showVotes ?? 'after');
  const [sessionId, setSessionId] = useState<string | null>(saved?.sessionId ?? null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  /* Den Weg nur rechnen, wenn Anfang oder Ziel sich ändern — eine gespeicherte Planung bleibt, wie sie war. */
  const [routed, setRouted] = useState(savedDoc !== null ? `${JSON.stringify(savedDoc.start)}|${savedDoc.target}` : '');

  const known = useMemo(() => knownFrom(world, lines, start), [world, lines, start]);
  const state = useMemo(() => classState(world, lines, settings, known), [world, lines, settings, known]);
  useEffect(() => {
    const key = `${JSON.stringify(start)}|${target}`;
    if (target === '' || key === routed) return;
    setRouted(key);
    /* Was von Hand dazukam, bleibt (hinten); der Weg kommt neu. */
    setItems((had) => addItems(routeItems(state, lines, start, target), had.filter((x) => x.added)));
  }, [start, target, state]); // eslint-disable-line react-hooks/exhaustive-deps

  const placeLabel = (id: string | null) => (id === null ? '' : world.places.get(id)?.label ?? (id.startsWith('~') ? t('cogitaLesson.plan.fork') : id));
  const lineName = (flow: string) => lines.lines.get(flow)?.name ?? lib.docs('flow').find((e) => e.id === flow)?.data.name as string | undefined ?? flow;
  const cardsOf = (place: string) => world.places.get(place)?.cards ?? [];
  const warnings = useMemo(() => planWarnings(world, items, known), [world, items, known]);

  /* Die Türme als Baum (Blöcke als Ordner), in der Reihenfolge der Welt. */
  const towerNodes = useMemo<TreeNode[]>(() => {
    const rank = new Map(world.order.map((id, i) => [id, i]));
    const out: TreeNode[] = [...world.blocks.values()].map((b) => ({ id: b.id, parentId: null, label: b.label, selectable: false, order: rank.get(b.id) ?? 0 }));
    for (const p of world.places.values()) out.push({ id: p.id, parentId: p.block ?? null, label: p.label, order: rank.get(p.id) ?? 0 });
    return out;
  }, [world]);

  /* Was sich hinzufügen lässt: Pfade, Vertiefungen (von Pfaden des Plans gerufen), Türme (mit Fragen), Wege zu einer Frage. */
  const inPlan = new Set(items.map((x) => (x.kind === 'path' ? `path:${x.flow}` : x.kind === 'tower' ? `tower:${x.place}` : `qpath:${x.path}`)));
  const flowsInPlan = new Set(items.flatMap((x) => (x.kind === 'path' ? [x.flow] : [])));
  const allLines = [...lines.lines.values()].filter((l) => l.sections.length > 0);
  const deepenings = allLines.filter((l) => l.deepening && [...l.calledBy.keys()].some((c) => flowsInPlan.has(c)) && !inPlan.has(`path:${l.id}`));
  const pathsToAdd = allLines.filter((l) => !l.deepening && !inPlan.has(`path:${l.id}`));
  const towersToAdd = world.order.filter((id) => world.places.has(id) && !inPlan.has(`tower:${id}`));
  const qpathsToAdd = paths.filter((p) => !inPlan.has(`qpath:${p.id}`));
  const add = (value: string) => {
    const [kind, ...rest] = value.split(':');
    const id = rest.join(':');
    if (kind === 'path') {
      const line = lines.lines.get(id);
      const lastSec = line === undefined ? undefined : lines.sections.get(line.sections[line.sections.length - 1] ?? '');
      setItems((had) => addItems(had, [pathItem(id, undefined, lastSec?.to ?? null, true)]));
    } else if (kind === 'tower') setItems((had) => addItems(had, [towerItem(id, true, true)]));
    else if (kind === 'qpath') {
      const qp = paths.find((p) => p.id === id);
      if (qp === undefined) return;
      const check = qp.check?.kind === 'questions' ? qp.check.questions.flatMap((q) => world.questionCards.get(q) ?? []) : [];
      setItems((had) => addItems(had, questionPathItems(state, lines, qp, had, check)));
    }
  };

  /* Ein Anfang mitten in einem Pfad: der Pfad und sein Schritt. */
  const stepsOf = (flow: string): { id: string; label: string }[] => {
    const doc = lib.docs('flow').find((e) => e.id === flow);
    if (doc === undefined) return [];
    return readFlow(doc.id, doc.data, { authored: true }).graph.nodes.map((n) => {
      const of = typeof n.config.of === 'string' ? n.config.of : '';
      const id = of === '' ? '' : of.startsWith('@') ? lib.byImportRef(of, 'entity')?.id ?? '' : of;
      const entity = id === '' ? undefined : lib.entity(id);
      return { id: n.id, label: `${n.type}${entity === undefined ? '' : ` · ${lib.label(entity)}`} (${n.id})` };
    });
  };

  const doc = (): LessonPlanDoc => ({ v: 1, start, target, items: [...items] });
  const titleNow = () => title.trim() || t('cogitaLesson.plan.defaultTitle', { name: placeLabel(target) });
  const parts = lessonPartsOf(items, cardsOf);
  const save = async (): Promise<string> => {
    if (me === null) throw new Error(t('cogitaClass.tab.needAccount'));
    const id = await savePlan(lib, me, { areaId, title: titleNow(), parts, showVotes, plan: doc() }, sessionId);
    setSessionId(id);
    onSaved();
    return id;
  };
  const run = (work: () => Promise<void>) => {
    setBusy(true);
    setFailed(null);
    setNote(null);
    void work().catch((e: unknown) => setFailed(e instanceof Error ? e.message : String(e))).finally(() => setBusy(false));
  };

  return (
    <div className="cg cg-plan" data-plan-editor={sessionId ?? 'new'}>
      {back}
      <h2 className="wk-h2">{saved === null ? t('cogitaLesson.plan.newTitle', { name: areaName }) : t('cogitaLesson.plan.editTitle', { title: saved.config.title })}</h2>
      <div className="cg-plan-ends">
        <div className="wk-field">
          <span>{t('cogitaLesson.plan.startLabel')}</span>
          <TreePick nodes={towerNodes} value={startValue(start)} label={t('cogitaLesson.plan.startLabel')}
            extras={[{ value: HOME_VALUE, label: t('cogitaLesson.plan.fromHome') }]}
            onChange={(v) => setStart(v === HOME_VALUE ? { kind: 'home' } : { kind: 'place', place: v })} />
          <details className="cg-plan-step" open={start.kind === 'step'}>
            <summary>{t('cogitaLesson.plan.midPath')}</summary>
            <StepStart lines={allLines.map((l) => ({ id: l.id, name: l.name }))} start={start} stepsOf={stepsOf} onPick={setStart} />
          </details>
        </div>
        <div className="wk-field">
          <span>{t('cogitaLesson.plan.targetLabel')}</span>
          <TreePick nodes={towerNodes} value={target} label={t('cogitaLesson.plan.targetLabel')} placeholder={t('cogitaLesson.plan.pickTarget')} onChange={setTarget} />
        </div>
      </div>
      {target === '' ? <p className="cg-muted">{t('cogitaLesson.plan.pickTargetSays')}</p> : (
        <>
          <p className="cg-muted">{t('cogitaLesson.plan.routeSays')}</p>
          {items.length === 0 && <p className="wk-note" data-plan-known="">{t('cogitaLesson.plan.alreadyKnown', { name: placeLabel(target) })}</p>}
          <ol className="cg-plan-items" data-plan-items={items.length}>
            {items.map((it, i) => {
              const warn = warnings.filter((w) => w.key === it.key);
              return (
                <li key={it.key} className={`cg-plan-item${it.skip ? ' is-skipped' : ''}${it.added ? ' is-added' : ''}`} data-plan-item={it.key} data-plan-kind={it.kind} data-plan-skip={it.skip ? '1' : '0'}>
                  <label className="wk-check">
                    <input type="checkbox" checked={!it.skip} onChange={(e) => setItems((had) => setSkip(had, it.key, !e.target.checked))} data-plan-take={it.key} />
                    <span className="cg-plan-what">
                      <span className="cg-tag">{t(`cogitaLesson.plan.kind.${it.kind}`)}</span>{' '}
                      {it.kind === 'path' ? (
                        <>{lineName(it.flow)}{it.to !== null && <span className="cg-muted"> → {placeLabel(it.to)}</span>}{it.start !== undefined && <span className="cg-muted"> · {t('cogitaLesson.plan.fromStep', { step: it.start.step })}</span>}</>
                      ) : it.kind === 'tower' ? placeLabel(it.place)
                        : (paths.find((p) => p.id === it.path)?.title ?? it.path)}
                      {it.added && <span className="cg-muted"> · {t('cogitaLesson.plan.added')}</span>}
                    </span>
                  </label>
                  {it.kind === 'tower' && !it.skip && (
                    <select value={it.ask ? 'ask' : 'path'} onChange={(e) => setItems((had) => setAsk(had, it.key, e.target.value === 'ask'))} data-plan-ask={it.key} aria-label={t('cogitaLesson.plan.towerHow')}>
                      <option value="path">{t('cogitaLesson.plan.pathOnly')}</option>
                      <option value="ask">{t('cogitaLesson.plan.pathAndTower', { count: Math.min(TOWER_QUESTIONS_MAX, cardsOf(it.place).length) })}</option>
                    </select>
                  )}
                  <span className="cg-plan-move">
                    <button type="button" className="wk-link-btn" disabled={i === 0} onClick={() => setItems((had) => moveItem(had, it.key, -1))} aria-label={t('cogitaLesson.plan.up')} data-plan-up={it.key}>↑</button>
                    <button type="button" className="wk-link-btn" disabled={i === items.length - 1} onClick={() => setItems((had) => moveItem(had, it.key, 1))} aria-label={t('cogitaLesson.plan.down')} data-plan-down={it.key}>↓</button>
                    {it.added && <button type="button" className="wk-link-btn" onClick={() => setItems((had) => removeItem(had, it.key))} aria-label={t('cogitaLesson.plan.remove')} data-plan-remove={it.key}>×</button>}
                  </span>
                  {warn.map((w) => (
                    <p key={w.needs} className="cg-plan-warn" data-plan-warn={it.key}>⚠ {t('cogitaLesson.plan.needsLater', { name: placeLabel(w.needs) })}</p>
                  ))}
                </li>
              );
            })}
          </ol>
          <label className="wk-field cg-plan-add">
            <span>{t('cogitaLesson.plan.add')}</span>
            <select value="" onChange={(e) => { if (e.target.value !== '') add(e.target.value); }} data-plan-add="">
              <option value="">{t('cogitaLesson.plan.addPick')}</option>
              {pathsToAdd.length > 0 && <optgroup label={t('cogitaLesson.plan.addPaths')}>{pathsToAdd.map((l) => <option key={l.id} value={`path:${l.id}`}>{l.name}</option>)}</optgroup>}
              {deepenings.length > 0 && <optgroup label={t('cogitaLesson.plan.addDeeper')}>{deepenings.map((l) => <option key={l.id} value={`path:${l.id}`}>{l.name}</option>)}</optgroup>}
              {towersToAdd.length > 0 && <optgroup label={t('cogitaLesson.plan.addTowers')}>{towersToAdd.map((id) => <option key={id} value={`tower:${id}`}>{placeLabel(id)}</option>)}</optgroup>}
              {qpathsToAdd.length > 0 && <optgroup label={t('cogitaLesson.plan.addQuestionPaths')}>{qpathsToAdd.map((p) => <option key={p.id} value={`qpath:${p.id}`}>{p.title}</option>)}</optgroup>}
            </select>
          </label>
          <div className="cg-plan-foot">
            <label className="wk-field"><span>{t('cogitaViewsStats.sess.title')}</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('cogitaLesson.plan.defaultTitle', { name: placeLabel(target) })} maxLength={120} data-plan-title="" /></label>
            <label className="wk-field"><span>{t('cogitaLesson.host.showVotes')}</span>
              <select value={showVotes} onChange={(e) => setShowVotes(e.target.value as ShowVotes)}>{(['after', 'live', 'never'] as const).map((v) => <option key={v} value={v}>{t(`cogitaLesson.showVotes.${v}`)}</option>)}</select>
            </label>
            <p className="cg-muted" data-plan-parts={parts.length}>{t('cogitaLesson.plan.partsSays', { count: parts.length })}</p>
            {warnings.length > 0 && <p className="cg-plan-warn">{t('cogitaLesson.plan.warnSays', { count: warnings.length })}</p>}
            {failed !== null && <p className="wk-error">{failed}</p>}
            {note !== null && <p className="wk-done" role="status">{note}</p>}
            <div className="wk-actions">
              <button type="button" className="wk-btn" disabled={busy || parts.length === 0} data-plan-start=""
                onClick={() => run(async () => {
                  if (me === null) return;
                  await save();
                  const id = await createLesson(lib, me, { areaId, title: titleNow(), parts, showVotes, plan: doc() });
                  window.location.hash = href('sesje', id).replace(/^#/, '');
                })}><Icon name="play" />{t('cogitaLesson.plan.start')}</button>
              <button type="button" className="wk-btn wk-btn-line" disabled={busy || items.length === 0} data-plan-save=""
                onClick={() => run(async () => { await save(); setNote(t('cogitaLesson.plan.saved')); })}>{t('cogitaLesson.plan.save')}</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Ein Anfang mitten in einem Pfad: welcher Pfad, welcher Schritt. */
function StepStart({ lines, start, stepsOf, onPick }: {
  lines: readonly { id: string; name: string }[]; start: PlanStart; stepsOf: (flow: string) => { id: string; label: string }[]; onPick: (s: PlanStart) => void;
}) {
  const t = useT();
  const [flow, setFlow] = useState(start.kind === 'step' ? start.flow : '');
  const steps = flow === '' ? [] : stepsOf(flow);
  return (
    <div className="cg-row">
      <label className="wk-field"><span>{t('cogitaLesson.plan.whichPath')}</span>
        <select value={flow} onChange={(e) => setFlow(e.target.value)} data-plan-step-flow="">
          <option value="">—</option>
          {lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </label>
      {flow !== '' && (
        <label className="wk-field"><span>{t('cogitaLesson.plan.whichStep')}</span>
          <select value={start.kind === 'step' && start.flow === flow ? start.step : ''} onChange={(e) => { if (e.target.value !== '') onPick({ kind: 'step', flow, step: e.target.value }); }} data-plan-step="">
            <option value="">—</option>
            {steps.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}
