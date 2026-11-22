/**
 * 2026-11-22 (Homer) — DIE KONSOLE DES LEHRERS für eine Einheit (auf seinem Gerät, nicht an der Wand): der offene Etap mit seiner
 * Zeit gegen den Rahmen, wer wo steht (Schüler × Items: nicht begonnen, arbeitet, fertig, wartet, steckt fest, braucht Hilfe), die
 * häufigsten Fehler, „18 / 26 gotowe", und alles, was der Lehrer tut: Etap öffnen, verlängern, auslassen, umstellen, ein Item
 * hinzufügen, „Wszyscy patrzą na ekran", „Pokaż wyniki", weiter, „Zakończ lekcję" (der Abschluss beginnt), Pause, „Wznów" mit der
 * Wiederholung aus dem letzten Exit ticket. Gemeinsame Etapy spielt `LessonHost` (Abstimmungen, Verteilung, Antwort der Klasse).
 * Die Namen stehen nur hier — die Leinwand (`UnitScreen`) zeigt nie einen.
 */

import { useEffect, useMemo, useState } from 'react';

import { useT } from '../../core/i18n';
import { Icon } from '../../ui/icons';
import { TexText } from '../../ui/tex/Tex';
import { setSessionState, type SessionRow } from '../live';
import { LessonHost, type Send } from '../lesson/LessonHost';
import type { LessonPart } from '../lesson/lessonTally';
import { bodies, type Opened } from '../sessionEvents';
import { useBusy, useCtx } from '../ui';
import { itemLabel } from './UnitPlay';
import {
  closeStageOf, finishedBy, itemKey, latestAnswers, nextStage, pollCounts, recapQuestions, remainingCore, resumeTarget, stageReport, studentRows,
  timeState, topTags, unitNow, type HostEvent, type StudentStatus, type UnitItem, type UnitSettings, type UnitStage
} from './unitModel';
import { helpOf, HOST_KINDS, hostEvents, itemNow, participantsOf, progressOf, promptsOf, wallOf, type UnitConfig } from './unitSession';
import './unit.css';

const GLYPH: Readonly<Record<StudentStatus, string>> = { none: '·', working: '…', done: '✓', waiting: '✓', stuck: '!', help: '?' };

/** Ein gemeinsames Item als Teil einer Stunde (`LessonHost`); offene Frage und Umfrage sind keine. */
const partOf = (item: UnitItem | undefined): LessonPart | null =>
  item === undefined ? null : item.kind === 'flow' ? { flow: item.flow, ...(item.start === undefined ? {} : { start: item.start }) } : item.kind === 'questions' ? { questions: item.questions } : null;

export function UnitHost({ session, config, opened, send }: { session: SessionRow; config: UnitConfig; opened: readonly Opened[]; send: Send }) {
  const t = useT();
  const { lib } = useCtx();
  const { busy, failed, run } = useBusy();
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => { const tm = window.setInterval(() => setClock(Date.now()), 5000); return () => window.clearInterval(tm); }, []);
  const events = hostEvents(opened);
  const now = unitNow(config.unit, events, session.state, t('cogitaUnit.recap'));
  const people = participantsOf(opened);
  const ids = [...people.keys()];
  const progress = progressOf(opened);
  const help = helpOf(opened);
  const prompts = promptsOf(opened);
  const item = itemNow(opened);
  const settings = config.unit.settings;
  const plan = [...events].reverse().find((e): e is Extract<HostEvent, { kind: 'plan' }> => e.kind === 'plan') ?? null;
  const lessons = config.unit.lessons.length;
  const nameOf = (p: string) => people.get(p) || t('cogitaUnit.host.someone');

  const go = (kind: keyof typeof HOST_KINDS, body: unknown) => send(HOST_KINDS[kind], body);
  const openStage = (stage: UnitStage) => run(async () => {
    if (session.state !== 'running') await setSessionState(session.sessionId, 'running');
    await go('stage', { stage: stage.id, lesson: stage.lesson, at: Date.now() });
    if (stage.led) await go('item', { stage: stage.id, index: 0, at: Date.now() });
  });
  const savePlan = (next: { order?: readonly string[]; skipped?: readonly string[]; added?: Readonly<Record<string, readonly UnitItem[]>>; extend?: Readonly<Record<string, number>> }) => run(() => go('plan', {
    order: next.order ?? plan?.order ?? config.unit.stages.map((s) => s.id), skipped: next.skipped ?? plan?.skipped ?? [], added: next.added ?? plan?.added ?? {}, extend: next.extend ?? plan?.extend ?? {}, at: Date.now()
  }));
  const endLesson = () => run(async () => {
    await go('end', { lesson: now.lesson, at: Date.now() });
    const close = closeStageOf(now.stages, now.lesson);
    if (close !== null) { await go('stage', { stage: close.id, lesson: now.lesson, at: Date.now() }); return; }
    await go('pause', { lesson: now.lesson, at: Date.now() });
    await setSessionState(session.sessionId, 'paused');
  });
  const pause = () => run(async () => { await go('pause', { lesson: now.lesson, at: Date.now() }); await setSessionState(session.sessionId, 'paused'); });
  const openShare = (s: UnitStage) => (ids.length === 0 ? 0 : 1 - finishedBy(s, progress).size / ids.length);
  const resume = () => run(async () => {
    const lesson = Math.min(lessons, now.lesson + 1);
    const recap = recapQuestions(closeStageOf(now.stages, now.lesson), progress);
    await setSessionState(session.sessionId, 'running');
    await go('resume', { lesson, recap, at: Date.now() });
    if (recap.length > 0) {
      await go('stage', { stage: `R${lesson}`, lesson, at: Date.now() });
      await go('item', { stage: `R${lesson}`, index: 0, at: Date.now() });
      return;
    }
    const target = resumeTarget(now.stages, lesson, openShare, settings.resumeShare);
    if (target !== null) {
      await go('stage', { stage: target.id, lesson, at: Date.now() });
      if (target.led) await go('item', { stage: target.id, index: 0, at: Date.now() });
    }
  });
  const finishUnit = () => run(() => setSessionState(session.sessionId, 'finished'));

  const stage = now.stage;
  const afterRecap = stage !== null && now.recap !== null && stage.id === now.recap.id ? resumeTarget(now.stages, now.lesson, openShare, settings.resumeShare) : null;
  const next = stage === null ? nextStage(now.stages, null, now.lesson) : afterRecap ?? (stage.type === 'close' ? null : nextStage(now.stages, stage.id, now.lesson));
  const elapsed = stage === null || now.stageAt === null ? 0 : clock - now.stageAt;
  const ts = stage === null ? 'ok' : timeState(stage, elapsed);
  const rest = remainingCore(now.stages, now.lesson, stage?.id ?? null);

  /* Kann ein Etap ausgelassen werden (die Klasse wusste es schon)? Aus den Abstimmungen, solange der genannte Etap offen war. */
  const skipHint = (s: UnitStage): number | null => {
    if (s.skipIf === undefined) return null;
    const from = now.reached.get(s.skipIf.stage);
    if (from === undefined) return null;
    const later = [...now.reached.entries()].filter(([, at]) => at > from).map(([, at]) => at).sort((a, b) => a - b)[0] ?? Number.MAX_SAFE_INTEGER;
    const reveals = bodies<{ answered: number; correct: number; at?: number }>(opened, 'reveal').filter((r) => { const at = Date.parse(r.event.createdAt); return at >= from && at < later; });
    const answered = reveals.reduce((n, r) => n + r.body.answered, 0);
    return answered === 0 ? null : reveals.reduce((n, r) => n + r.body.correct, 0) / answered;
  };

  const ledAt = stage !== null && stage.led && item !== null && item.stage === stage.id ? item.index : 0;
  const ledItem = stage?.led ? stage.items[ledAt] : undefined;
  const ledPart = partOf(ledItem);
  const advanceLed = () => {
    if (stage === null) return;
    if (ledAt + 1 < stage.items.length) void run(() => go('item', { stage: stage.id, index: ledAt + 1, at: Date.now() }));
    else if (next !== null) void openStage(next);
  };

  const controls = (
    <div className="cg-unit-controls wk-actions" data-unit-controls="">
      {(now.phase === 'lobby' || (now.phase === 'lesson' && stage === null)) && next !== null && <button type="button" className="wk-btn" disabled={busy} onClick={() => void openStage(next)} data-unit-open={next.id}>{t('cogitaUnit.host.open', { name: next.title })}</button>}
      {now.phase === 'lesson' && stage !== null && next !== null && <button type="button" className="wk-btn" disabled={busy} onClick={() => void openStage(next)} data-unit-next={next.id}>{t('cogitaUnit.host.next', { name: next.title })}</button>}
      {(now.phase === 'lesson' || now.phase === 'closing') && <button type="button" className={now.look ? 'wk-btn' : 'wk-btn wk-btn-line'} aria-pressed={now.look} disabled={busy} onClick={() => void run(() => go('look', { on: !now.look, at: Date.now() }))} data-unit-look-toggle="">{now.look ? t('cogitaUnit.host.lookOff') : t('cogitaUnit.host.lookOn')}</button>}
      {now.phase === 'lesson' && <button type="button" className="wk-btn wk-btn-line" disabled={busy} onClick={() => void endLesson()} data-unit-end="">{t('cogitaUnit.host.endLesson')}</button>}
      {(now.phase === 'closing' || (now.phase === 'lesson' && stage?.type === 'close')) && <button type="button" className="wk-btn" disabled={busy} onClick={() => void pause()} data-unit-pause="">{t('cogitaUnit.host.pause')}</button>}
      {now.phase === 'between' && now.lesson < lessons && <button type="button" className="wk-btn" disabled={busy} onClick={() => void resume()} data-unit-resume="">{t('cogitaUnit.host.resume', { n: now.lesson + 1 })}</button>}
      {now.phase === 'between' && <button type="button" className="wk-btn wk-btn-line" disabled={busy} onClick={() => void finishUnit()} data-unit-finish="">{t('cogitaUnit.host.finishUnit')}</button>}
    </div>
  );

  return (
    <div className="cg-unit-host" data-unit-host={now.phase} data-unit-lesson={now.lesson} data-unit-current={stage?.id ?? ''}>
      <header className="cg-unit-top">
        <p className="cg-unit-head"><strong>{config.title}</strong> · {t('cogitaUnit.host.lessonOf', { n: now.lesson, all: lessons })}
          {config.unit.lessons[now.lesson - 1]?.title ? <> — <em>{config.unit.lessons[now.lesson - 1]!.title}</em></> : null}</p>
        <p className="cg-muted" data-unit-phase={now.phase}>{t(`cogitaUnit.phase.${now.phase}`)}</p>
        {stage !== null && (
          <p className={`cg-unit-time is-${ts}`} data-unit-time={ts}>
            <strong>{stage.id} · {stage.title}</strong> — {t('cogitaUnit.host.elapsed', { min: Math.floor(elapsed / 60_000), from: stage.minutes[0], to: stage.minutes[1] })}
            {rest > 0 && now.phase === 'lesson' && <> · {t('cogitaUnit.host.restCore', { min: rest })}</>}
          </p>
        )}
        {controls}
        {failed !== null && <p className="wk-error">{failed}</p>}
      </header>

      {stage !== null && stage.led && (now.phase === 'lesson' || now.phase === 'closing') && (
        <section className="cg-unit-led" data-unit-led={itemKey(stage.id, ledAt)}>
          <p className="cg-muted">{t('cogitaUnit.host.ledItem', { n: ledAt + 1, all: stage.items.length })}</p>
          {ledPart !== null
            ? <LessonHost key={`${stage.id}#${ledAt}`} session={session} opened={opened} send={send} parts={[ledPart]} onPartsDone={advanceLed} />
            : ledItem !== undefined ? <OpenItemPanel stage={stage} index={ledAt} item={ledItem} opened={opened} prompts={prompts} ids={ids} nameOf={nameOf} send={send} onNext={advanceLed} /> : null}
        </section>
      )}

      {stage !== null && !stage.led && (now.phase === 'lesson' || now.phase === 'closing') && (
        <StageGrid stage={stage} settings={settings} ids={ids} nameOf={nameOf} progress={progress} help={help} clock={clock} prompts={prompts} opened={opened} send={send} />
      )}

      {now.phase === 'lobby' && <p className="wk-lede">{t('cogitaUnit.host.lobby', { count: ids.length })}</p>}
      {now.phase === 'between' && <p className="wk-lede" data-unit-between="">{t('cogitaUnit.host.between')}</p>}

      <details className="cg-unit-plan" data-unit-plan="">
        <summary>{t('cogitaUnit.host.planTitle')}</summary>
        <PlanEditor stages={now.stages} all={config.unit.stages} current={stage?.id ?? null} reached={now.reached} skipped={plan?.skipped ?? []}
          skipHint={skipHint} onOpen={(s) => void openStage(s)} onPlan={(p) => void savePlan(p)} plan={plan} lib={lib} busy={busy} />
      </details>

      <details className="cg-unit-report" data-unit-report="">
        <summary>{t('cogitaUnit.host.reportTitle')}</summary>
        <table className="wk-table">
          <thead><tr><th>{t('cogitaUnit.report.stage')}</th><th>{t('cogitaUnit.report.finished')}</th><th>{t('cogitaUnit.report.median')}</th><th>{t('cogitaUnit.report.tags')}</th><th>{t('cogitaUnit.report.open')}</th></tr></thead>
          <tbody>
            {now.stages.filter((s) => now.reached.has(s.id) && !s.led).map((s) => {
              const r = stageReport(s, ids, progress);
              return (
                <tr key={s.id} data-unit-report-stage={s.id} data-unit-report-finished={r.finished}>
                  <td>{s.id} · {s.title}</td>
                  <td>{r.finished} / {r.total}</td>
                  <td>{r.medianMinutes === null ? '—' : t('cogitaUnit.report.minutes', { min: r.medianMinutes })}</td>
                  <td>{r.tags.map((x) => `${x.tag} (${x.count})`).join(', ') || '—'}</td>
                  <td>{r.open.map(nameOf).join(', ') || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="cg-muted">{t('cogitaUnit.report.says')}</p>
      </details>
    </div>
  );
}

/* -- Ein Etap allein: das Raster ----------------------------------------------------------------------------------------- */

function StageGrid({ stage, settings, ids, nameOf, progress, help, clock, prompts, opened, send }: {
  stage: UnitStage; settings: UnitSettings; ids: readonly string[]; nameOf: (p: string) => string; progress: ReturnType<typeof progressOf>; help: ReturnType<typeof helpOf>;
  clock: number; prompts: ReturnType<typeof promptsOf>; opened: readonly Opened[]; send: Send;
}) {
  const t = useT();
  const { lib } = useCtx();
  const rows = useMemo(() => studentRows(stage, ids, progress, help, clock, settings), [stage, ids, progress, help, clock, settings]);
  const ready = rows.filter((r) => r.status === 'waiting').length;
  const tags = topTags(progress, stage.id);
  const helpers = rows.filter((r) => r.help);
  const keys = stage.items.map((_, i) => itemKey(stage.id, i));
  const openItems = stage.items.map((it, i) => ({ it, i })).filter((x) => x.it.kind === 'prompt' || x.it.kind === 'poll');
  return (
    <section className="cg-unit-grid-box" data-unit-grid={stage.id}>
      <p className="cg-unit-counters">
        <strong data-unit-ready={`${ready}/${ids.length}`}>{t('cogitaUnit.host.ready', { done: ready, all: ids.length })}</strong>
        {helpers.length > 0 && <span className="cg-tag is-warn" data-unit-helps={helpers.length}>{t('cogitaUnit.host.helps', { count: helpers.length })}: {helpers.map((h) => nameOf(h.participant)).join(', ')}</span>}
        {tags.length > 0 && <span className="cg-muted" data-unit-tags="">{t('cogitaUnit.host.tags', { list: tags.map((x) => `${x.tag} (${x.count})`).join(' · ') })}</span>}
      </p>
      <div className="cg-unit-grid-scroll">
        <table className="cg-unit-grid">
          <thead><tr><th>{t('cogitaUnit.host.student')}</th>{stage.items.map((it, i) => <th key={i} title={itemLabel(it, lib, t)}>{i + 1}</th>)}<th>{t('cogitaUnit.host.status')}</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.participant} className={`is-${r.status}`} data-unit-row={r.participant} data-unit-row-status={r.status}>
                <th>{nameOf(r.participant)}</th>
                {keys.map((k) => { const s = r.items.get(k) ?? 'none'; return <td key={k} className={`is-${s}`} title={t(`cogitaUnit.status.${s}`)}>{GLYPH[s]}</td>; })}
                <td>{t(`cogitaUnit.status.${r.status}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="cg-muted">{t('cogitaUnit.host.stuckSays', { wrong: settings.stuckWrong, min: settings.stuckMinutes })}</p>
      {openItems.map(({ it, i }) => <OpenItemPanel key={i} stage={stage} index={i} item={it} opened={opened} prompts={prompts} ids={ids} nameOf={nameOf} send={send} />)}
    </section>
  );
}

/* -- Offene Frage und Umfrage: der Lehrer sieht alles, zeigt nur, was er will ------------------------------------------------- */

function OpenItemPanel({ stage, index, item, opened, prompts, ids, nameOf, send, onNext }: {
  stage: UnitStage; index: number; item: UnitItem; opened: readonly Opened[]; prompts: ReturnType<typeof promptsOf>; ids: readonly string[];
  nameOf: (p: string) => string; send: Send; onNext?: () => void;
}) {
  const t = useT();
  const { busy, run } = useBusy();
  const key = itemKey(stage.id, index);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const answers = latestAnswers(prompts, stage.id, key);
  const shown = wallOf(opened, stage.id, key);
  if (item.kind === 'prompt') {
    const texts = answers.filter((a) => typeof a.text === 'string' && a.text !== '');
    return (
      <section className="cg-unit-open" data-unit-open-item={key}>
        <h3><TexText text={item.prompt} /></h3>
        <p className="cg-muted" data-unit-answers={texts.length}>{t('cogitaUnit.host.answers', { count: texts.length, all: ids.length })}</p>
        <ul className="cg-unit-wall-edit">
          {texts.map((a) => (
            <li key={a.participant} className={hidden.has(a.participant) ? 'is-hidden' : ''}>
              <label><input type="checkbox" checked={!hidden.has(a.participant)} onChange={() => setHidden((h) => { const n = new Set(h); if (n.has(a.participant)) n.delete(a.participant); else n.add(a.participant); return n; })} data-unit-wall-keep={a.participant} />
                <span>{a.text}</span> {!item.anonymous && <em className="cg-muted">— {nameOf(a.participant)}</em>}</label>
            </li>
          ))}
        </ul>
        <div className="wk-actions">
          <button type="button" className="wk-btn" disabled={busy || texts.length === 0} onClick={() => void run(() => send(HOST_KINDS.wall, { stage: stage.id, item: key, texts: texts.filter((a) => !hidden.has(a.participant)).map((a) => a.text!) }))} data-unit-wall-show="">
            <Icon name="eye" />{shown === null ? t('cogitaUnit.host.wallShow') : t('cogitaUnit.host.wallUpdate')}</button>
          {onNext !== undefined && <button type="button" className="wk-btn wk-btn-line" onClick={onNext} data-unit-led-next="">{t('cogitaUnit.host.itemNext')}</button>}
        </div>
      </section>
    );
  }
  if (item.kind !== 'poll') return null;
  const now = pollCounts(prompts, stage.id, key, item.options.length);
  const beforeKey = item.after === undefined ? null : findItemKey(stage, item.after);
  const before = beforeKey === null ? null : pollCounts(prompts, beforeKey.split('#')[0]!, beforeKey, item.options.length);
  return (
    <section className="cg-unit-open" data-unit-open-item={key}>
      <h3><TexText text={item.poll} /></h3>
      <PollBarsView options={item.options} counts={now.counts} votes={now.votes} before={before} />
      <div className="wk-actions">
        <button type="button" className="wk-btn" disabled={busy} onClick={() => void run(() => send(HOST_KINDS.poll, { stage: stage.id, item: key, counts: now.counts, votes: now.votes, ...(before === null ? {} : { before }) }))} data-unit-poll-show="">
          <Icon name="eye" />{t('cogitaUnit.host.showResults')}</button>
        {onNext !== undefined && <button type="button" className="wk-btn wk-btn-line" onClick={onNext} data-unit-led-next="">{t('cogitaUnit.host.itemNext')}</button>}
      </div>
    </section>
  );
}

/** Wo ein Item mit dieser `id` steht (im selben Etap zuerst). */
function findItemKey(stage: UnitStage, id: string): string | null {
  const i = stage.items.findIndex((x) => x.id === id);
  return i >= 0 ? itemKey(stage.id, i) : null;
}

/** Die Balken einer Umfrage — vorher (blass) und jetzt, ohne Namen. */
export function PollBarsView({ options, counts, votes, before }: { options: readonly string[]; counts: readonly number[]; votes: number; before: { counts: readonly number[]; votes: number } | null }) {
  const t = useT();
  const pct = (n: number, all: number) => (all === 0 ? 0 : Math.round((n / all) * 100));
  return (
    <ul className="cg-unit-pollbars" data-unit-pollbars={votes}>
      {options.map((o, i) => (
        <li key={i} data-unit-pollbar={i} data-unit-pollcount={counts[i] ?? 0}>
          <span className="cg-unit-pollbar-label"><TexText text={o} /></span>
          {before !== null && <span className="cg-unit-pollbar is-before" title={t('cogitaUnit.poll.before')}><span ref={(el) => { el?.style.setProperty('--done', `${pct(before.counts[i] ?? 0, before.votes)}%`); }} /><em>{pct(before.counts[i] ?? 0, before.votes)} %</em></span>}
          <span className="cg-unit-pollbar"><span ref={(el) => { el?.style.setProperty('--done', `${pct(counts[i] ?? 0, votes)}%`); }} /><em>{pct(counts[i] ?? 0, votes)} % ({counts[i] ?? 0})</em></span>
        </li>
      ))}
      {before !== null && <li className="cg-muted">{t('cogitaUnit.poll.legend')}</li>}
    </ul>
  );
}

/* -- Der Plan: öffnen, auslassen, umstellen, verlängern, ein Item hinzufügen ------------------------------------------------------- */

function PlanEditor({ stages, all, current, reached, skipped, skipHint, onOpen, onPlan, plan, lib, busy }: {
  stages: readonly UnitStage[]; all: readonly UnitStage[]; current: string | null; reached: ReadonlyMap<string, number>; skipped: readonly string[];
  skipHint: (s: UnitStage) => number | null; onOpen: (s: UnitStage) => void;
  onPlan: (p: { order?: readonly string[]; skipped?: readonly string[]; added?: Readonly<Record<string, readonly UnitItem[]>>; extend?: Readonly<Record<string, number>> }) => void;
  plan: Extract<HostEvent, { kind: 'plan' }> | null; lib: ReturnType<typeof useCtx>['lib']; busy: boolean;
}) {
  const t = useT();
  const order = stages.map((s) => s.id);
  const [adding, setAdding] = useState<string | null>(null);
  const [flow, setFlow] = useState('');
  const [prompt, setPrompt] = useState('');
  const move = (id: string, by: number) => {
    const at = order.indexOf(id);
    const to = at + by;
    if (at < 0 || to < 0 || to >= order.length) return;
    const next = [...order];
    [next[at], next[to]] = [next[to]!, next[at]!];
    onPlan({ order: [...next, ...skipped] });
  };
  const add = (id: string, item: UnitItem) => onPlan({ added: { ...(plan?.added ?? {}), [id]: [...(plan?.added[id] ?? []), item] } });
  const flows = lib.docs('flow');
  return (
    <div className="cg-unit-planlist">
      <ol>
        {stages.map((s) => {
          const share = skipHint(s);
          return (
            <li key={s.id} className={`is-${s.type}${s.id === current ? ' is-current' : ''}${reached.has(s.id) ? ' is-reached' : ''}`} data-unit-plan-stage={s.id}>
              <span className="cg-unit-plan-name"><strong>{s.id}</strong> {s.title} <span className="cg-tag">{t(`cogitaUnit.type.${s.type}`)}</span> <span className="cg-muted">{s.modes.join(' ')} · {s.minutes[0]}–{s.minutes[1]} min</span></span>
              {share !== null && s.skipIf !== undefined && share > s.skipIf.above && <span className="cg-tag is-ok" data-unit-skip-hint={s.id}>{t('cogitaUnit.host.skipHint', { pct: Math.round(share * 100) })}</span>}
              <span className="cg-unit-plan-act">
                <button type="button" className="wk-link-btn" disabled={busy || s.id === current} onClick={() => onOpen(s)} data-unit-plan-open={s.id}>{t('cogitaUnit.host.openNow')}</button>
                <button type="button" className="wk-link-btn" disabled={busy} onClick={() => move(s.id, -1)} aria-label={t('cogitaUnit.host.up')}>↑</button>
                <button type="button" className="wk-link-btn" disabled={busy} onClick={() => move(s.id, 1)} aria-label={t('cogitaUnit.host.down')}>↓</button>
                <button type="button" className="wk-link-btn" disabled={busy} onClick={() => onPlan({ extend: { ...(plan?.extend ?? {}), [s.id]: (plan?.extend[s.id] ?? 0) + 5 } })} data-unit-extend={s.id}>{t('cogitaUnit.host.extend')}</button>
                <button type="button" className="wk-link-btn" disabled={busy || s.id === current} onClick={() => onPlan({ skipped: [...skipped, s.id] })} data-unit-skip={s.id}>{t('cogitaUnit.host.skip')}</button>
                <button type="button" className="wk-link-btn" disabled={busy} onClick={() => setAdding(adding === s.id ? null : s.id)} data-unit-add={s.id}>{t('cogitaUnit.host.add')}</button>
              </span>
              {adding === s.id && (
                <div className="cg-unit-add">
                  <label className="wk-field"><span>{t('cogitaUnit.host.addFlow')}</span>
                    <select value={flow} onChange={(e) => setFlow(e.target.value)}><option value="">—</option>{flows.map((f) => <option key={f.id} value={f.id}>{typeof f.data.name === 'string' ? f.data.name : f.id}</option>)}</select></label>
                  <button type="button" className="wk-btn wk-btn-line" disabled={flow === ''} onClick={() => { add(s.id, { kind: 'flow', flow }); setFlow(''); setAdding(null); }}>{t('cogitaUnit.host.addIt')}</button>
                  <label className="wk-field"><span>{t('cogitaUnit.host.addPrompt')}</span><input value={prompt} maxLength={200} onChange={(e) => setPrompt(e.target.value)} /></label>
                  <button type="button" className="wk-btn wk-btn-line" disabled={prompt.trim() === ''} onClick={() => { add(s.id, { kind: 'prompt', prompt: prompt.trim(), max: 80, anonymous: true }); setPrompt(''); setAdding(null); }}>{t('cogitaUnit.host.addIt')}</button>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {skipped.length > 0 && (
        <p className="cg-muted">{t('cogitaUnit.host.skipped')}: {skipped.map((id) => (
          <button key={id} type="button" className="wk-link-btn" onClick={() => onPlan({ skipped: skipped.filter((x) => x !== id) })} data-unit-unskip={id}>{all.find((s) => s.id === id)?.title ?? id} ↺</button>
        ))}</p>
      )}
    </div>
  );
}
