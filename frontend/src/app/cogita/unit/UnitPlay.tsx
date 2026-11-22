/**
 * 2026-11-22 (Homer) — DIE EINHEIT AUF DEM TELEFON. Nur der offene Etap, nichts sonst von der Welt:
 *
 * <code>
 *   gemeinsam      folgt dem Lehrer (`LessonPlay`: Folie, Abstimmung) — offene Fragen und Umfragen beantwortet jede und jeder
 *   allein         die Items im eigenen Tempo („2 z 3"), fest oder frei geordnet; danach „Dobra robota. Poczekaj na klasę."
 *                  mit den Bonus-Items darunter — der nächste Etap öffnet erst, wenn der Lehrer ihn öffnet
 *   „Potrzebuję pomocy"  meldet sich nur beim Lehrer
 *   „Wszyscy patrzą na ekran"  eine Tafel über allem, bis der Lehrer sie aufhebt
 *   zwischen den Stunden  genau die eigenen offenen Kern-Etapy (Hausaufgabe), Flex freiwillig — allein spielbar
 * </code>
 *
 * Was fertig ist, steht im EIGENEN Fortschritt (`~unit.<sitzung>.<item>`, `Learner.keepUnitDone`) — so stimmt die Hausaufgabe
 * auf jedem Gerät. Meldungen, die nicht hinauskommen (kein Netz), warten auf diesem Gerät und gehen später (`outbox`).
 */

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useT } from '../../core/i18n';
import { newId } from '../../core/ids';
import { Loading } from '../../ui/Loading';
import type { Card } from '../cardBasics';
import { contentOfLibrary } from '../FlowPlayer';
import type { Learner } from '../learn';
import { LessonPlay } from '../lesson/LessonHost';
import { postEvents, type Credentials, type SessionRow } from '../live';
import { usePageBase } from '../pageBase';
import type { Opened } from '../sessionEvents';
import type { CogitaLibrary } from '../store';
import { CogitaContext, useAsync } from '../ui';
import { ItemRun } from './UnitItems';
import { doneFromValues, doneValueKey, homeworkOf, itemKey, unitNow, type Progress, type UnitItem, type UnitStage } from './unitModel';
import { hostEvents, itemNow, type UnitConfig } from './unitSession';
import './unit.css';

type Seal = (eventId: string, body: unknown) => Promise<{ sealed: string; epoch: number }>;

/* -- Die Ablage für Meldungen ohne Netz ------------------------------------------------------------------------------------ */

interface Waiting { readonly eventId: string; readonly kind: string; readonly body: unknown }
const OUTBOX = (sessionId: string) => `recreatio:cogita:unit-outbox:${sessionId}`;
const readBox = (sessionId: string): Waiting[] => { try { return JSON.parse(localStorage.getItem(OUTBOX(sessionId)) ?? '[]') as Waiting[]; } catch { return []; } };
const writeBox = (sessionId: string, list: readonly Waiting[]) => { try { localStorage.setItem(OUTBOX(sessionId), JSON.stringify(list.slice(-500))); } catch { /* ohne Speicher */ } };
const LOCAL_DONE = (sessionId: string) => `recreatio:cogita:unit-done:${sessionId}`;
const readLocalDone = (sessionId: string): string[] => { try { return JSON.parse(localStorage.getItem(LOCAL_DONE(sessionId)) ?? '[]') as string[]; } catch { return []; } };

function useOutbox(sessionId: string, cred: Credentials, seal: Seal | null) {
  const [offline, setOffline] = useState(false);
  const flushing = useRef(false);
  const flush = useCallback(async () => {
    if (seal === null || flushing.current) return;
    const list = readBox(sessionId);
    if (list.length === 0) { setOffline(false); return; }
    flushing.current = true;
    try {
      const events = await Promise.all(list.map(async (w) => { const s = await seal(w.eventId, w.body); return { eventId: w.eventId, kind: w.kind, epoch: s.epoch, sealed: s.sealed }; }));
      await postEvents(sessionId, events, cred);
      const sent = new Set(list.map((w) => w.eventId));
      writeBox(sessionId, readBox(sessionId).filter((w) => !sent.has(w.eventId)));
      setOffline(false);
    } catch { setOffline(true); return; } finally { flushing.current = false; }
    /* Was während des Sendens dazukam, gleich hinterher. */
    if (readBox(sessionId).length > 0) void flush();
  }, [sessionId, cred, seal]);
  useEffect(() => {
    void flush();
    const tm = window.setInterval(() => { void flush(); }, 8000);
    const on = () => { void flush(); };
    window.addEventListener('online', on);
    return () => { window.clearInterval(tm); window.removeEventListener('online', on); };
  }, [flush]);
  const put = useCallback((kind: string, body: unknown) => {
    writeBox(sessionId, [...readBox(sessionId), { eventId: newId(), kind, body }]);
    void flush();
  }, [sessionId, flush]);
  return { put, offline };
}

/* -- Die Einheit auf dem Telefon ----------------------------------------------------------------------------------------- */

export function UnitPlay({ session, config, opened, cred, seal, participant, learner, slots, sent, onVote }: {
  session: SessionRow;
  config: UnitConfig;
  opened: readonly Opened[];
  cred: Credentials;
  seal: Seal | null;
  participant: string;
  learner: Learner | null;
  slots: readonly { readonly index: number; readonly form: string; readonly count: number }[];
  sent: ReadonlyMap<number, unknown>;
  onVote: (index: number, given: unknown) => void;
}) {
  const t = useT();
  const ctx = useContext(CogitaContext);
  const libraryId = session.libraryId ?? '';
  const own = ctx !== null && ctx.lib.libraryId.toLowerCase() === libraryId.toLowerCase();
  const page = usePageBase(own ? '' : libraryId);
  const lib: CogitaLibrary | null | undefined = own ? ctx!.lib : page.lib;
  const cards = useAsync(lib == null ? null : () => lib.cards('flow').then((r) => r.cards), [lib, lib?.revision]);
  const content = useMemo(() => (lib == null || cards == null ? null : contentOfLibrary(lib, cards)), [lib, cards]);
  const now = unitNow(config.unit, hostEvents(opened), session.state, t('cogitaUnit.recap'));
  const { put, offline } = useOutbox(session.sessionId, cred, seal);

  /* Fertig: aus dem eigenen Fortschritt, dazu was dieses Gerät eben gemeldet hat. */
  const [localDone, setLocalDone] = useState<ReadonlySet<string>>(() => new Set(readLocalDone(session.sessionId)));
  const [, setTick] = useState(0);
  useEffect(() => (learner === null ? undefined : learner.subscribe?.(() => setTick((n) => n + 1))), [learner]);
  const done = useMemo(() => new Set([...localDone, ...(learner === null ? [] : doneFromValues(learner.progress.values, session.sessionId))]), [localDone, learner, learner?.progress, session.sessionId]); // eslint-disable-line react-hooks/exhaustive-deps
  const markDone = useCallback((keys: readonly string[]) => {
    const fresh = keys.filter((k) => !done.has(k));
    if (fresh.length === 0) return;
    setLocalDone((was) => {
      const next = new Set([...was, ...fresh]);
      try { localStorage.setItem(LOCAL_DONE(session.sessionId), JSON.stringify([...next])); } catch { /* ohne Speicher */ }
      return next;
    });
    void learner?.keepUnitDone(fresh.map((k) => doneValueKey(session.sessionId, k)), Date.now()).catch(() => undefined);
  }, [done, learner, session.sessionId]);

  const report = useCallback((stage: string, item: string, p: Omit<Progress, 'participant' | 'stage' | 'item' | 'at'>) => {
    put('progress', { participant, stage, item, ...p, at: Date.now() } satisfies Progress);
  }, [put, participant]);

  /* Ein gemeinsamer Etap: was ich miterlebt habe, als der Lehrer weiterging, ist fertig. */
  const ledSeen = useRef(new Set<string>());
  const item = itemNow(opened);
  useEffect(() => {
    const stage = now.stage;
    /* Fertig ist nur, woran der Lehrer IN der Stunde vorbeiging — „Zakończ lekcję" mitten im Item zählt nicht. */
    if (now.phase !== 'lesson') { ledSeen.current.clear(); return; }
    const live = stage !== null && stage.led;
    const at = live && item !== null && item.stage === stage!.id ? item.index : 0;
    const key = live ? itemKey(stage!.id, at) : null;
    if (live && (stage!.items[at]?.kind === 'flow' || stage!.items[at]?.kind === 'questions')) ledSeen.current.add(key!);
    const passed = [...ledSeen.current].filter((k) => k !== key);
    if (passed.length > 0) { markDone(passed); for (const k of passed) { report(k.split('#')[0]!, k, { what: 'done' }); ledSeen.current.delete(k); } }
  }, [now.stage?.id, item?.index, now.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const [help, setHelp] = useState(false);
  const askHelp = (on: boolean) => { if (now.stage === null) return; setHelp(on); put('help', { participant, stage: now.stage.id, on, at: Date.now() }); };
  useEffect(() => { setHelp(false); }, [now.stage?.id]);
  const prompt = (stage: string, key: string) => (a: { text?: string; choice?: number }) => put('prompt', { participant, stage, item: key, ...a, at: Date.now() });

  if (lib === undefined || (lib !== null && content === null) || cards === undefined) return <Loading label={t('cogitaUnit.play.loading')} />;
  if (lib === null || content === null) return <p className="wk-error">{t('cogitaViewsStats.sess.cannotRead')}</p>;

  const head = (
    <p className="cg-unit-head">
      <strong>{config.title}</strong>
      {offline && <span className="cg-tag is-warn" data-unit-offline="">{t('cogitaUnit.play.offline')}</span>}
    </p>
  );
  const shell = (body: React.ReactNode, extra?: React.ReactNode) => (
    <div className="cg-unit-phone" data-unit-phone={now.phase} data-unit-stage={now.stage?.id ?? ''}>
      {head}
      {body}
      {extra}
      {now.look && (
        <div className="cg-unit-look" role="alertdialog" aria-live="assertive" data-unit-look="">
          <strong>{t('cogitaUnit.play.lookTitle')}</strong>
          <span>{t('cogitaUnit.play.lookSays')}</span>
        </div>
      )}
    </div>
  );
  const runner = (stage: UnitStage) => ({ lib, content, cards: cards ?? [], learner, via: session.sessionId, stage });

  if (now.phase === 'closed') return shell(<p className="wk-lede" data-unit-closed="">{t('cogitaUnit.play.closed')}</p>);
  if (now.phase === 'between') {
    const hw = homeworkOf(now.stages, now.lesson, done);
    return shell(<Homework core={hw.core} flex={hw.flex} r={runner} done={done} markDone={markDone} report={report} prompt={prompt} />);
  }
  if (now.phase === 'lobby' || now.stage === null) return shell(<p className="wk-lede" data-unit-wait="">{t('cogitaUnit.play.soon')}</p>);

  const stage = now.stage;
  if (stage.led) {
    const at = item !== null && item.stage === stage.id ? item.index : 0;
    const it = stage.items[at];
    const key = itemKey(stage.id, at);
    const body = it !== undefined && (it.kind === 'prompt' || it.kind === 'poll')
      ? (done.has(key) ? <p className="cg-muted" data-unit-sent="">{t('cogitaUnit.play.sentWait')}</p>
        : <ItemRun item={it} {...runner(stage)} report={(p) => report(stage.id, key, p)} onDone={() => { markDone([key]); report(stage.id, key, { what: 'done' }); }} onPrompt={prompt(stage.id, key)} />)
      : <LessonPlay sessionId={session.sessionId} opened={opened} slots={slots} learner={learner} sent={sent} onVote={onVote} />;
    return shell(<><p className="cg-muted cg-unit-stage-title">{stage.title}</p>{body}</>);
  }
  return shell(
    <StageRun key={stage.id} stage={stage} r={runner} done={done} markDone={markDone} report={report} prompt={prompt} />,
    <div className="cg-unit-help">
      <button type="button" className={help ? 'wk-btn' : 'wk-btn wk-btn-line'} aria-pressed={help} onClick={() => askHelp(!help)} data-unit-help="">
        {help ? t('cogitaUnit.play.helpOn') : t('cogitaUnit.play.help')}
      </button>
    </div>
  );
}

type Runner = (stage: UnitStage) => { lib: CogitaLibrary; content: NonNullable<ReturnType<typeof contentOfLibrary>>; cards: readonly Card[]; learner: Learner | null; via: string; stage: UnitStage };
type ReportFn = (stage: string, item: string, p: Omit<Progress, 'participant' | 'stage' | 'item' | 'at'>) => void;
type PromptFn = (stage: string, key: string) => (a: { text?: string; choice?: number }) => void;

/**
 * EIN ETAP ALLEIN: fest geordnet das nächste offene Item, frei geordnet eine Auswahl; „2 z 3"; danach warten und die Bonus-Items.
 */
function StageRun({ stage, r, done, markDone, report, prompt, onLeave }: {
  stage: UnitStage; r: Runner; done: ReadonlySet<string>; markDone: (keys: readonly string[]) => void; report: ReportFn; prompt: PromptFn; onLeave?: () => void;
}) {
  const t = useT();
  const keys = stage.items.map((_, i) => itemKey(stage.id, i));
  const left = keys.filter((k) => !done.has(k));
  const [picked, setPicked] = useState<string | null>(null);
  const [bonus, setBonus] = useState<number | null>(null);
  const started = useRef(new Set<string>());
  const current = picked !== null && !done.has(picked) ? picked : stage.order === 'fixed' ? left[0] ?? null : null;
  useEffect(() => {
    if (current === null || started.current.has(current)) return;
    started.current.add(current);
    report(stage.id, current, { what: 'start' });
  }, [current]); // eslint-disable-line react-hooks/exhaustive-deps
  const finish = (key: string) => { markDone([key]); report(stage.id, key, { what: 'done' }); setPicked(null); };
  const ofN = <p className="cg-unit-count" data-unit-count={`${keys.length - left.length}/${keys.length}`}>{t('cogitaUnit.play.of', { done: keys.length - left.length, all: keys.length })}
    <span className="cg-unit-bar" aria-hidden="true"><span ref={(el) => { el?.style.setProperty('--done', `${keys.length === 0 ? 100 : ((keys.length - left.length) / keys.length) * 100}%`); }} /></span></p>;

  if (current !== null) {
    const i = keys.indexOf(current);
    const it = stage.items[i]!;
    return (
      <div className="cg-unit-stage" data-unit-item={current}>
        <p className="cg-muted cg-unit-stage-title">{stage.title}</p>
        {ofN}
        <ItemRun key={current} item={it} {...r(stage)} report={(p) => report(stage.id, current, p)} onDone={() => finish(current)} onPrompt={prompt(stage.id, current)} />
      </div>
    );
  }
  if (left.length > 0) {
    return (
      <div className="cg-unit-stage" data-unit-free="">
        <p className="cg-muted cg-unit-stage-title">{stage.title}</p>
        {ofN}
        <p>{t('cogitaUnit.play.pickAny')}</p>
        <ul className="cg-unit-pick">
          {keys.map((k, i) => (
            <li key={k}>
              <button type="button" className={done.has(k) ? 'wk-btn wk-btn-line is-done' : 'wk-btn'} disabled={done.has(k)} onClick={() => setPicked(k)} data-unit-pick={k}>
                {done.has(k) ? '✓ ' : ''}{itemLabel(stage.items[i]!, r(stage).lib, t)}
              </button>
            </li>
          ))}
        </ul>
        {onLeave !== undefined && <button type="button" className="wk-link-btn" onClick={onLeave}>{t('cogitaUnit.play.backToList')}</button>}
      </div>
    );
  }
  /* Alles fertig: warten — mit den Bonus-Items. */
  if (bonus !== null && stage.bonus[bonus] !== undefined) {
    const key = itemKey(stage.id, bonus, true);
    return (
      <div className="cg-unit-stage" data-unit-bonus={key}>
        <ItemRun key={key} item={stage.bonus[bonus]!} {...r(stage)} report={(p) => report(stage.id, key, p)} onDone={() => { markDone([key]); report(stage.id, key, { what: 'done' }); setBonus(null); }} onPrompt={prompt(stage.id, key)} />
      </div>
    );
  }
  return (
    <div className="cg-unit-stage cg-unit-wait" data-unit-waiting={stage.id}>
      {ofN}
      <h2 className="wk-h2">{onLeave === undefined ? t('cogitaUnit.play.wellDone') : t('cogitaUnit.play.homeworkDone')}</h2>
      {stage.bonus.length > 0 && (
        <>
          <p>{t('cogitaUnit.play.bonusSays')}</p>
          <ul className="cg-unit-pick">
            {stage.bonus.map((b, i) => {
              const key = itemKey(stage.id, i, true);
              return <li key={key}><button type="button" className={done.has(key) ? 'wk-btn wk-btn-line is-done' : 'wk-btn wk-btn-line'} onClick={() => setBonus(i)} data-unit-bonus-pick={key}>{done.has(key) ? '✓ ' : ''}{itemLabel(b, r(stage).lib, t)}</button></li>;
            })}
          </ul>
        </>
      )}
      {onLeave !== undefined && <button type="button" className="wk-link-btn" onClick={onLeave}>{t('cogitaUnit.play.backToList')}</button>}
    </div>
  );
}

export function itemLabel(item: UnitItem, lib: CogitaLibrary, t: ReturnType<typeof useT>): string {
  if (item.kind === 'flow') { const f = lib.docs('flow').find((d) => d.id === item.flow); return (typeof f?.data.name === 'string' && f.data.name !== '' ? f.data.name : t('cogitaUnit.item.flow')); }
  if (item.kind === 'questions') return t('cogitaUnit.item.questions', { count: item.questions.length });
  if (item.kind === 'prompt') return item.prompt;
  return item.poll;
}

/** ZWISCHEN DEN STUNDEN: die eigenen offenen Kern-Etapy (Pflicht, bis zur nächsten Stunde) und die Flex-Etapy (freiwillig). */
function Homework({ core, flex, r, done, markDone, report, prompt }: {
  core: readonly UnitStage[]; flex: readonly UnitStage[]; r: Runner; done: ReadonlySet<string>; markDone: (keys: readonly string[]) => void; report: ReportFn; prompt: PromptFn;
}) {
  const t = useT();
  const [open, setOpen] = useState<string | null>(null);
  const stage = [...core, ...flex].find((s) => s.id === open);
  if (stage !== undefined) {
    return <StageRun key={stage.id} stage={{ ...stage, order: stage.order }} r={r} done={done} markDone={markDone} report={report} prompt={prompt} onLeave={() => setOpen(null)} />;
  }
  return (
    <div className="cg-unit-homework" data-unit-homework={core.length}>
      <h2 className="wk-h2">{t('cogitaUnit.play.homework')}</h2>
      {core.length === 0 ? <p className="wk-lede" data-unit-homework-none="">{t('cogitaUnit.play.homeworkNone')}</p> : (
        <>
          <p className="cg-muted">{t('cogitaUnit.play.homeworkUntil')}</p>
          <ul className="cg-unit-pick">
            {core.map((s) => <li key={s.id}><button type="button" className="wk-btn" onClick={() => setOpen(s.id)} data-unit-homework-stage={s.id}>{s.title}</button></li>)}
          </ul>
        </>
      )}
      {flex.length > 0 && (
        <>
          <h3 className="wk-h3">{t('cogitaUnit.play.optional')}</h3>
          <ul className="cg-unit-pick">
            {flex.map((s) => <li key={s.id}><button type="button" className="wk-btn wk-btn-line" onClick={() => setOpen(s.id)} data-unit-optional-stage={s.id}>{s.title}</button></li>)}
          </ul>
        </>
      )}
    </div>
  );
}
