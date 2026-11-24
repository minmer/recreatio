/**
 * 2026-11-24 (Eigentümer: „der Modus der Lehrerin: ihre Klassen, wer drin ist, der QR-Code, eine Teilwelt, die Stunden — und
 * wer seinen Link verliert, bekommt von ihr einen neuen") — DIE KONSOLE DER LEHRERIN. EINE Umsetzung für Nauka → „Klasy"
 * (`ClassesTab.tsx`) und für den Baustein „Nauczyciel — moje klasy" einer Seite (`pages/parts/classParts.tsx`).
 *
 * <code>
 *   die Klassen der Baza + „Nowa klasa"           wie bisher (eine Karte je Klasse, QR, Postępy, Plan, Jednostki)
 *   eine Klasse geöffnet: Reiter
 *     Uczniowie    jede Person mit Namen — Plätze (ohne Konto) und Konten, die beigetreten sind; ein Platz: „Pokaż link"
 *                  (wieder lesbar, 0046), „Nowy link" (der alte hört auf, die Fortschritte bleiben), „Usuń z klasy"
 *     Dołączanie   der QR-Code, wie viele drin sind, neuer Code, Beitreten schliessen
 *     Świat klasy  was die Klasse von der Welt sieht (die Teilwelt — `world` von aussen, `SubWorldEditor`)
 *     Lekcje       planen, Jednostki, laufende und angehaltene Stunden der Klasse
 *     Postępy      `OfficeProgress` des Bereichs der Klasse
 * </code>
 */

import { lazy, Suspense, useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { QRCodeSVG } from 'qrcode.react';

import { myEpochKeys } from '../../areas/area';
import { loadAreaControllerState } from '../../areas/controllers';
import { areaKeys, loadAreaNames, openNames } from '../../chat/chat';
import { fmtDate, useT } from '../../core/i18n';
import { WorkspaceError } from '../../core/session';
import { loadLinks } from '../../links/linkAccess';
import { viewPath } from '../../routes';
import { loadSeats, officeSeatKey, relinkSeat, revokeSeat, type SeatRow } from '../../seats/seat';
import { openLink } from '../../seats/seatCheck';
import { pageLink } from '../../seats/seatKeep';
import { ask } from '../../ui/dialogs';
import { Icon } from '../../ui/icons';
import { Loading } from '../../ui/Loading';
import { MenuButton } from '../../ui/Menu';
import type { Card } from '../cardBasics';
import { loadSessions, type SessionRow } from '../live';
import { useAsync, useCtx } from '../ui';
import { classAim, type ClassOf } from './classModel';
import { classJoinLink, classOpening, closeJoining, createClass, moveClassUnderBase, myClasses, renewJoinLink, type ClassStage } from './classes';
import './classes.css';

const OfficeProgress = lazy(() => import('../Progress').then((m) => ({ default: m.OfficeProgress })));

/** Was die Konsole von aussen bekommt: der Reiter „Świat klasy" (die Teilwelt), wenn es ihn gibt. */
export interface ConsoleSlots {
  readonly world?: (klass: ClassOf) => ReactNode;
  /** 2026-11-24 — „Przegląd": alles zum Durchgehen (Folien, Fragen, Befunde, Uwagi, Polecenie für die KI), `explore/Explore.tsx`. */
  readonly explore?: (klass: ClassOf) => ReactNode;
}

/** Wie viele in einer Klasse sind: Konten, die den Code eingelöst haben, und Personen ohne Konto (Plätze der Klasse). */
async function studentsIn(klass: ClassOf, redeemed: number): Promise<number> {
  const seats = await loadSeats(klass.areaId).then((r) => r.seats.filter((s) => s.revokedAt === null).length, () => 0);
  return redeemed + seats;
}

/** Die ganze Adresse einer Seite mit dem Platz (zum Kopieren, für den QR-Code). */
const absolute = (hash: string): string => `${window.location.origin}${window.location.pathname}${hash}`;

export function TeacherConsole({ slots = {} }: { slots?: ConsoleSlots }) {
  const t = useT();
  const { lib, me, name } = useCtx();
  const [list, setList] = useState<readonly ClassOf[] | null>(null);
  const [opening, setOpening] = useState<'share' | 'public' | null | undefined>(undefined);
  const [tick, setTick] = useState(0);
  const [shown, setShown] = useState<{ readonly klass: ClassOf; readonly url: string } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const base = { libraryId: lib.libraryId, areaId: lib.areaId, name };

  useEffect(() => {
    if (me === null) { setList([]); setOpening(null); return undefined; }
    let alive = true;
    void myClasses(true, lib.libraryId, tick > 0).then((found) => { if (alive) setList(found); }, () => { if (alive) setList([]); });
    void classOpening(me, base).then((o) => { if (alive) setOpening(o); }, () => { if (alive) setOpening(null); });
    return () => { alive = false; };
  }, [me, lib.libraryId, lib.areaId, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  if (me === null) return <p className="wk-lede">{t('cogitaClass.tab.needAccount')}</p>;

  return (
    <div className="cg cl-tab" data-class-tab="" data-class-console="">
      <p className="wk-lede">{t('cogitaClass.tab.lede')}</p>
      {opening === undefined ? null : opening === null
        ? <p className="wk-note">{t('cogitaClass.tab.cannot')}</p>
        : <NewClass onMade={(klass, url) => { setTick((n) => n + 1); setOpenId(klass.areaId); setShown({ klass, url }); }} base={base} />}
      {list === null ? <Loading lines={2} />
        : list.length === 0 ? <p className="wk-empty">{t('cogitaClass.tab.empty')}</p>
        : (
          <ul className="cl-list">
            {list.map((klass) => (
              <ClassCard key={klass.areaId} klass={klass} open={openId === klass.areaId} onOpen={(yes) => setOpenId(yes ? klass.areaId : null)}
                onShow={(url) => setShown({ klass, url })} onChanged={() => setTick((n) => n + 1)} slots={slots} />
            ))}
          </ul>
        )}
      {shown !== null && <ClassQr klass={shown.klass} url={shown.url} onClose={() => setShown(null)} />}
    </div>
  );
}

function NewClass({ base, onMade }: { base: { libraryId: string; areaId: string; name: string }; onMade: (klass: ClassOf, url: string) => void }) {
  const t = useT();
  const { me } = useCtx();
  const [name, setName] = useState('');
  const [stage, setStage] = useState<ClassStage | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const go = (e: FormEvent) => {
    e.preventDefault();
    if (me === null || stage !== null) return;
    if (name.trim() === '') { setFailed(t('cogitaClass.err.needName')); return; }
    setFailed(null);
    setStage('area');
    void createClass(me, base, name, setStage).then((made) => {
      setName('');
      onMade(made.klass, made.url);
    }, (err: unknown) => setFailed(err instanceof WorkspaceError ? err.message : t('cogitaClass.err.failed'))).finally(() => setStage(null));
  };
  return (
    <form className="cl-new" onSubmit={go} data-class-new="">
      <label className="wk-field">
        <span>{t('cogitaClass.tab.name')}</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('cogitaClass.tab.namePlaceholder')} maxLength={120} data-class-name="" />
      </label>
      <button type="submit" className="wk-btn" disabled={stage !== null} data-class-create=""><Icon name="plus" />{t('cogitaClass.tab.create')}</button>
      {stage !== null && <p className="cl-busy" role="status"><span className="cl-spin" aria-hidden="true" />{t(`cogitaClass.tab.stage.${stage}`)}</p>}
      {failed !== null && <p className="wk-error">{failed}</p>}
    </form>
  );
}

type Tab = 'students' | 'join' | 'world' | 'explore' | 'lessons' | 'progress';
const TABS: readonly Tab[] = ['students', 'join', 'world', 'explore', 'lessons', 'progress'];

function ClassCard({ klass, open, onOpen, onShow, onChanged, slots }: {
  klass: ClassOf; open: boolean; onOpen: (yes: boolean) => void; onShow: (url: string) => void; onChanged: () => void; slots: ConsoleSlots;
}) {
  const t = useT();
  const { me, href, lib } = useCtx();
  const [count, setCount] = useState<number | null>(null);
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('students');
  /* Wie viele drin sind — alle 20 s neu (die Klasse tritt gerade bei). */
  const [again, setAgain] = useState(0);
  useEffect(() => { const timer = window.setInterval(() => setAgain((n) => n + 1), 20_000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    if (me === null) return undefined;
    let alive = true;
    void classJoinLink(me, klass).then(async (link) => {
      if (!alive) return;
      setUrl(link?.url ?? null);
      const n = await studentsIn(klass, link?.row.redeemed.filter((r) => r.active).length ?? 0);
      if (alive) setCount(n);
    }, () => { if (alive) setUrl(null); });
    return () => { alive = false; };
  }, [me, klass, again]);
  const act = (work: () => Promise<unknown>) => {
    setBusy(true);
    setFailed(null);
    void work().then(onChanged, (err: unknown) => setFailed(err instanceof WorkspaceError ? err.message : t('cogitaClass.err.failed'))).finally(() => setBusy(false));
  };
  const renew = () => {
    if (me === null) return;
    void ask({ title: t('cogitaClass.card.renewAsk'), body: t('cogitaClass.card.renewSays'), confirm: t('cogitaClass.card.renew') }).then((yes) => {
      if (yes) act(async () => { const fresh = await renewJoinLink(me, klass); onShow(fresh); });
    });
  };
  const close = () => {
    void ask({ title: t('cogitaClass.card.closeAsk'), body: t('cogitaClass.card.closeSays'), confirm: t('cogitaClass.card.close'), danger: true }).then((yes) => { if (yes) act(() => closeJoining(klass)); });
  };
  const tabs = TABS.filter((x) => (x !== 'world' || slots.world !== undefined) && (x !== 'explore' || slots.explore !== undefined));
  /*
    2026-11-24 (0129) — wer steht für die Daten der Klasse ein? Ohne Administrator danych (auch keinen geerbten) kann niemand beitreten:
    die Lehrerin sieht es hier, mit dem Weg zur Einstellung.
  */
  const [controller, setController] = useState<'yes' | 'none' | 'unknown'>('unknown');
  /* Hat der Bereich der Baza einen? Dann genügt es, die Klasse dorthin umzuhängen (alte Klassen einer öffentlichen Baza lagen aussen). */
  const [baseHas, setBaseHas] = useState(false);
  const [checked, setChecked] = useState(0);
  useEffect(() => {
    let alive = true;
    void loadAreaControllerState(klass.areaId).then((s) => { if (alive) setController(s.controller === null ? 'none' : 'yes'); }, () => undefined);
    void loadAreaControllerState(lib.areaId).then((s) => { if (alive) setBaseHas(s.controller !== null); }, () => undefined);
    return () => { alive = false; };
  }, [klass.areaId, lib.areaId, again, checked]);
  const moveUnder = () => act(async () => { await moveClassUnderBase(klass, lib.areaId); setChecked((n) => n + 1); });
  return (
    <li className={`cl-card${open ? ' is-open' : ''}`} data-class-card={klass.areaId}>
      <div className="cl-card-head">
        <span className="cl-card-ic" aria-hidden="true"><Icon name="users" /></span>
        <span className="cl-card-text">
          <strong>{klass.name}</strong>
          <span>{count === null ? t('cogitaClass.card.counting') : t('cogitaClass.card.students', { count })}{klass.joinInvitationId === null ? ` · ${t('cogitaClass.card.closed')}` : ''}</span>
        </span>
        <MenuButton label={t('cogitaClass.card.more')} items={[
          { label: t('cogitaClass.card.renew'), icon: 'refresh', onSelect: renew },
          klass.joinInvitationId !== null && { label: t('cogitaClass.card.close'), icon: 'lock', onSelect: close },
          { label: t('cogitaClass.card.asStudent'), icon: 'eye', onSelect: () => { window.location.hash = `/${classAim(klass.areaId, lib.libraryId)}`; } },
          { label: t('cogitaClass.card.area'), icon: 'area', onSelect: () => { window.location.hash = viewPath('areas', klass.areaId).slice(1); } }
        ]} />
      </div>
      {controller === 'none' && (
        <div className="wk-warn cl-nocontroller" role="alert" data-class-no-controller={klass.areaId}>
          <p>{baseHas ? t('cogitaClass.console.noControllerMove') : t('cogitaClass.console.noController')}</p>
          <div className="wk-actions">
            {baseHas && <button type="button" className="wk-btn" disabled={busy} onClick={moveUnder} data-class-move-under="">{t('cogitaClass.console.moveUnder')}</button>}
            <a className="wk-btn wk-btn-line" href={viewPath('areas', klass.areaId, 'ustawienia')} data-class-set-controller="">{t('cogitaClass.console.setController')}</a>
          </div>
        </div>
      )}
      <div className="wk-actions">
        <button type="button" className={open ? 'wk-btn' : 'wk-btn wk-btn-line'} aria-expanded={open} onClick={() => onOpen(!open)} data-class-manage={klass.areaId}>
          <Icon name="settings" />{open ? t('cogitaClass.console.hide') : t('cogitaClass.console.manage')}
        </button>
        {klass.joinInvitationId !== null && (
          <button type="button" className="wk-btn wk-btn-line" disabled={url === undefined || url === null || busy} onClick={() => { if (url) onShow(url); }} data-class-qr={klass.areaId}>
            <Icon name="grid" />{t('cogitaClass.card.showQr')}
          </button>
        )}
        {klass.joinInvitationId === null && <button type="button" className="wk-btn wk-btn-line" disabled={busy} onClick={renew}>{t('cogitaClass.card.open')}</button>}
        <a className="wk-btn wk-btn-line" href={href('postepy', klass.areaId)} data-class-progress={klass.areaId}><Icon name="list" />{t('cogitaClass.card.progress')}</a>
        <a className="wk-btn wk-btn-line" href={href('klasy', klass.areaId, 'plan')} data-class-plan={klass.areaId}><Icon name="flow" />{t('cogitaLesson.plan.cardButton')}</a>
        {lib.docs('unit').length > 0 && <a className="wk-btn wk-btn-line" href={href('klasy', klass.areaId, 'jednostki')} data-class-units={klass.areaId}><Icon name="list" />{t('cogitaUnit.start.cardButton')}</a>}
      </div>
      {url === null && klass.joinInvitationId !== null && <p className="cl-note">{t('cogitaClass.card.notYours')}</p>}
      {failed !== null && <p className="wk-error">{failed}</p>}
      {open && (
        <div className="cl-console" data-class-console-of={klass.areaId}>
          <div className="cl-tabs" role="tablist" aria-label={klass.name}>
            {tabs.map((x) => (
              <button key={x} type="button" role="tab" aria-selected={tab === x} className={`cl-tabbtn${tab === x ? ' is-on' : ''}`} onClick={() => setTab(x)} data-class-console-tab={x}>
                {t(`cogitaClass.console.tab.${x}`)}
              </button>
            ))}
          </div>
          <div className="cl-tabbody" role="tabpanel" data-class-console-panel={tab}>
            {tab === 'students' && <ClassStudents klass={klass} onChanged={onChanged} />}
            {tab === 'join' && <ClassJoin klass={klass} url={url} count={count} busy={busy} onShow={onShow} onRenew={renew} onClose={close} />}
            {tab === 'world' && slots.world?.(klass)}
            {tab === 'explore' && slots.explore?.(klass)}
            {tab === 'lessons' && <ClassLessons klass={klass} />}
            {tab === 'progress' && <ClassProgress klass={klass} />}
          </div>
        </div>
      )}
      {!open && <p className="cl-note">{t('cogitaClass.card.lessonHint')}</p>}
    </li>
  );
}

/* -- Uczniowie ------------------------------------------------------------------------------------------------------- */

interface Student {
  readonly key: string;
  readonly kind: 'seat' | 'account';
  readonly name: string;
  readonly joined: string;
  readonly seat?: SeatRow;
}

/** Die Personen der Klasse: Plätze (ohne Konto) und Konten, die einen ihrer Codes eingelöst haben — mit Namen, wo lesbar. */
function useStudents(klass: ClassOf, tick: number): { readonly list: readonly Student[] | null; readonly failed: string | null } {
  const t = useT();
  const { me, lib } = useCtx();
  const [list, setList] = useState<readonly Student[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    if (me === null) return undefined;
    let alive = true;
    void (async () => {
      try {
        const seats = (await loadSeats(klass.areaId)).seats.filter((s) => s.revokedAt === null);
        /* Konten: wer einen Code dieser Klasse eingelöst hat (auch einen älteren, erneuerten) und ihn noch hält. */
        const aim = classAim(klass.areaId, lib.libraryId);
        const redeemed = new Map<string, string>();
        for (const row of (await loadLinks().catch(() => ({ invites: [] }))).invites) {
          if ((row.aim ?? '').toLowerCase() !== aim) continue;
          for (const r of row.redeemed) if (r.active && (!redeemed.has(r.roleId) || r.at < redeemed.get(r.roleId)!)) redeemed.set(r.roleId, r.at);
        }
        const names = new Map<string, string>();
        try { for (const [role, n] of await openNames(await areaKeys(me.ring, klass.areaId), klass.areaId, (await loadAreaNames(klass.areaId)).names)) names.set(role.toLowerCase(), n); } catch { /* ohne Namen */ }
        const out: Student[] = [
          ...seats.map((s): Student => ({ key: `s:${s.seatId}`, kind: 'seat', name: s.recipientName ?? t('cogitaClass.roster.unnamed'), joined: s.createdAt, seat: s })),
          ...[...redeemed].map(([roleId, at]): Student => ({ key: `r:${roleId}`, kind: 'account', name: names.get(roleId.toLowerCase()) ?? t('cogitaClass.roster.account', { id: roleId.slice(-4) }), joined: at }))
        ].sort((a, b) => a.name.localeCompare(b.name, 'pl'));
        if (alive) { setList(out); setFailed(null); }
      } catch (err) {
        if (alive) { setList([]); setFailed(err instanceof WorkspaceError ? err.message : t('cogitaClass.err.failed')); }
      }
    })();
    return () => { alive = false; };
  }, [me, klass.areaId, lib.libraryId, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  return { list, failed };
}

function ClassStudents({ klass, onChanged }: { klass: ClassOf; onChanged: () => void }) {
  const t = useT();
  const { me, lib } = useCtx();
  const [tick, setTick] = useState(0);
  /* Wer gerade beitritt, erscheint ohne Neuladen (die Lehrerin zeigt den QR-Code, die Klasse tritt bei). */
  useEffect(() => { const timer = window.setInterval(() => setTick((n) => n + 1), 20_000); return () => window.clearInterval(timer); }, []);
  const { list, failed } = useStudents(klass, tick);
  const [shown, setShown] = useState<{ readonly key: string; readonly url: string; readonly fresh: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const aim = classAim(klass.areaId, lib.libraryId);

  /* Der Platzschlüssel — mit dem Schlüssel des Bereichs der Klasse, den die Lehrerin hält. */
  const seatKey = useCallback(async (row: SeatRow): Promise<Uint8Array> => {
    if (me === null) throw new WorkspaceError(t('cogitaClass.roster.noKey'));
    const epochs = await myEpochKeys(me.ring, klass.areaId);
    const areaKey = epochs.get(row.epoch) ?? [...epochs.values()].pop();
    const key = areaKey === undefined ? null : await officeSeatKey(row, areaKey);
    if (key === null) throw new WorkspaceError(t('cogitaClass.roster.noKey'));
    return key;
  }, [me, klass.areaId, t]);

  const run = (who: string, work: () => Promise<void>) => {
    setBusy(who);
    setProblem(null);
    void work().catch((err: unknown) => setProblem(err instanceof WorkspaceError ? err.message : t('cogitaClass.err.failed'))).finally(() => setBusy(null));
  };
  const reveal = (s: Student) => run(s.key, async () => {
    const row = s.seat!;
    if (row.linkSealed === null) throw new WorkspaceError(t('cogitaClass.roster.noOldLink'));
    const link = await openLink(row.seatId, await seatKey(row), row.linkSealed);
    if (link === null) throw new WorkspaceError(t('cogitaClass.roster.noOldLink'));
    setShown({ key: s.key, url: absolute(pageLink(aim, link.token, link.key)), fresh: false });
  });
  const relink = (s: Student) => {
    void ask({ title: t('cogitaClass.roster.relinkAsk', { name: s.name }), body: t('cogitaClass.roster.relinkSays'), confirm: t('cogitaClass.roster.relink') }).then((yes) => {
      if (!yes) return;
      run(s.key, async () => {
        const row = s.seat!;
        const link = await relinkSeat(row.seatId, await seatKey(row));
        setShown({ key: s.key, url: absolute(pageLink(aim, link.token, link.key)), fresh: true });
        setTick((n) => n + 1);
      });
    });
  };
  const remove = (s: Student) => {
    void ask({ title: t('cogitaClass.roster.removeAsk', { name: s.name }), body: t('cogitaClass.roster.removeSays'), confirm: t('cogitaClass.roster.remove'), danger: true }).then((yes) => {
      if (!yes) return;
      run(s.key, async () => {
        await revokeSeat(s.seat!.seatId);
        if (shown?.key === s.key) setShown(null);
        setTick((n) => n + 1);
        onChanged();
      });
    });
  };

  if (list === null) return <Loading lines={3} label={t('cogitaClass.roster.loading')} />;
  return (
    <div className="cl-students" data-class-students={list.length}>
      <p className="cl-note">{t('cogitaClass.roster.lede')}</p>
      {failed !== null && <p className="wk-error">{failed}</p>}
      {list.length === 0 ? <p className="wk-empty">{t('cogitaClass.roster.none')}</p> : (
        <ul className="cl-people">
          {list.map((s) => (
            <li key={s.key} className="cl-person" data-class-student={s.kind === 'seat' ? s.seat!.seatId : s.key.slice(2)} data-class-student-kind={s.kind} data-class-student-name={s.name}>
              <div className="cl-person-head">
                <span className="cl-person-ic" aria-hidden="true"><Icon name={s.kind === 'seat' ? 'link' : 'user'} /></span>
                <span className="cl-person-text">
                  <strong>{s.name}</strong>
                  <span>{s.kind === 'seat' ? t('cogitaClass.roster.kindSeat') : t('cogitaClass.roster.kindAccount')} · {t('cogitaClass.roster.joined', { date: fmtDate(new Date(s.joined), { dateStyle: 'medium' }, t.lang) })}</span>
                </span>
              </div>
              {s.kind === 'seat' && (
                <div className="wk-actions">
                  <button type="button" className="wk-btn wk-btn-line" disabled={busy !== null} onClick={() => reveal(s)} data-class-student-link={s.seat!.seatId}><Icon name="eye" />{t('cogitaClass.roster.show')}</button>
                  <button type="button" className="wk-btn wk-btn-line" disabled={busy !== null} onClick={() => relink(s)} data-class-student-relink={s.seat!.seatId}><Icon name="refresh" />{t('cogitaClass.roster.relink')}</button>
                  <button type="button" className="wk-btn wk-btn-line" disabled={busy !== null} onClick={() => remove(s)} data-class-student-remove={s.seat!.seatId}><Icon name="trash" />{t('cogitaClass.roster.remove')}</button>
                </div>
              )}
              {s.kind === 'account' && <p className="cl-note">{t('cogitaClass.roster.accountSays')}</p>}
              {shown?.key === s.key && <PersonalLink url={shown.url} fresh={shown.fresh} name={s.name} onClose={() => setShown(null)} />}
            </li>
          ))}
        </ul>
      )}
      {problem !== null && <p className="wk-error" role="alert">{problem}</p>}
    </div>
  );
}

/** Der Link einer Person — zum Kopieren und als QR-Code (sie scannt ihn auf einem neuen Gerät). */
function PersonalLink({ url, fresh, name, onClose }: { url: string; fresh: boolean; name: string; onClose: () => void }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <div className="cl-own-link" data-class-student-url={url} data-class-student-fresh={fresh ? '1' : '0'}>
      <p className="cl-note">{fresh ? t('cogitaClass.roster.freshSays', { name }) : t('cogitaClass.roster.showSays', { name })}</p>
      <div className="cl-own-qr"><QRCodeSVG value={url} size={200} marginSize={2} /></div>
      <div className="wk-actions">
        <button type="button" className="wk-btn" onClick={() => { void navigator.clipboard?.writeText(url).then(() => setCopied(true), () => undefined); }}><Icon name="copy" />{copied ? t('common.copied') : t('cogitaClass.roster.copy')}</button>
        <button type="button" className="wk-btn wk-btn-line" onClick={onClose}>{t('common.close')}</button>
      </div>
    </div>
  );
}

/* -- Dołączanie, Lekcje, Postępy -------------------------------------------------------------------------------------- */

function ClassJoin({ klass, url, count, busy, onShow, onRenew, onClose }: {
  klass: ClassOf; url: string | null | undefined; count: number | null; busy: boolean; onShow: (url: string) => void; onRenew: () => void; onClose: () => void;
}) {
  const t = useT();
  return (
    <div className="cl-join" data-class-join-tab="">
      <p className="cl-note">{klass.joinInvitationId === null ? t('cogitaClass.console.joinClosed') : t('cogitaClass.console.joinOpen', { count: count ?? 0 })}</p>
      {url !== null && url !== undefined && <div className="cl-own-qr"><QRCodeSVG value={url} size={180} marginSize={2} /></div>}
      <div className="wk-actions">
        {url !== null && url !== undefined && <button type="button" className="wk-btn" onClick={() => onShow(url)}><Icon name="fit" />{t('cogitaClass.card.showQr')}</button>}
        <button type="button" className="wk-btn wk-btn-line" disabled={busy} onClick={onRenew}><Icon name="refresh" />{klass.joinInvitationId === null ? t('cogitaClass.card.open') : t('cogitaClass.card.renew')}</button>
        {klass.joinInvitationId !== null && <button type="button" className="wk-btn wk-btn-line" disabled={busy} onClick={onClose}><Icon name="lock" />{t('cogitaClass.card.close')}</button>}
      </div>
    </div>
  );
}

function ClassLessons({ klass }: { klass: ClassOf }) {
  const t = useT();
  const { href, lib } = useCtx();
  const sessions = useAsync(() => loadSessions(klass.areaId, lib.libraryId).then((r) => r.sessions.filter((s) => (s.kind === 'lesson' && s.joinCode !== null) || s.kind === 'task'), () => [] as readonly SessionRow[]), [klass.areaId, lib.libraryId]);
  return (
    <div className="cl-lessons" data-class-lessons="">
      <div className="wk-actions">
        <a className="wk-btn" href={href('klasy', klass.areaId, 'plan')}><Icon name="flow" />{t('cogitaLesson.plan.cardButton')}</a>
        {lib.docs('unit').length > 0 && <a className="wk-btn wk-btn-line" href={href('klasy', klass.areaId, 'jednostki')}><Icon name="list" />{t('cogitaUnit.start.cardButton')}</a>}
      </div>
      {sessions == null ? <Loading lines={2} /> : sessions.length === 0 ? <p className="wk-empty">{t('cogitaClass.console.noLessons')}</p> : (
        <ul className="cl-people">
          {sessions.map((s) => (
            <li key={s.sessionId} className="cl-person" data-class-session={s.sessionId}>
              <a className="wk-link" href={href('sesje', s.sessionId)}>{t(`cogitaClass.console.session.${s.kind === 'task' ? 'task' : 'lesson'}`, { date: fmtDate(new Date(s.createdAt), { dateStyle: 'medium' }, t.lang) })}</a>
              <span className="cl-note"> · {t(`cogitaClass.console.state.${s.state}`)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ClassProgress({ klass }: { klass: ClassOf }) {
  const t = useT();
  const { lib } = useCtx();
  const cards = useAsync(() => lib.cards().then((r) => r.cards as readonly Card[]), [lib, lib.revision]);
  return <Suspense fallback={<Loading />}><OfficeProgress cards={cards ?? null} area={klass.areaId} />{cards === undefined && <p className="cl-note">{t('cogitaClass.roster.loading')}</p>}</Suspense>;
}

/**
 * DER QR-CODE FÜR DIE KLASSE — gross, zum Zeigen am Beamer: der Name, der Code, ein Satz, was zu tun ist, und wie viele schon
 * drin sind (alle paar Sekunden neu gezählt). Esc schliesst.
 */
export function ClassQr({ klass, url, onClose }: { klass: ClassOf; url: string; onClose: () => void }) {
  const t = useT();
  const { me } = useCtx();
  const [count, setCount] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);
  const look = useCallback(() => {
    if (me === null) return;
    void classJoinLink(me, klass).then(async (link) => {
      setCount(await studentsIn(klass, link?.row.redeemed.filter((r) => r.active).length ?? 0));
    }, () => undefined);
  }, [me, klass]);
  useEffect(() => {
    look();
    const timer = window.setInterval(look, 5000);
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    box.current?.focus();
    return () => { window.clearInterval(timer); window.removeEventListener('keydown', key); };
  }, [look, onClose]);
  const host = window.location.host;
  return (
    <div className="cl-qr-screen" role="dialog" aria-modal="true" aria-label={t('cogitaClass.qr.label', { name: klass.name })} ref={box} tabIndex={-1} data-class-qr-screen="" data-class-url={url}>
      <div className="cl-qr-top">
        <button type="button" className="wk-btn wk-btn-line" onClick={() => { void document.documentElement.requestFullscreen?.().catch(() => undefined); }}><Icon name="fit" />{t('cogitaClass.qr.fullscreen')}</button>
        <button type="button" className="wk-btn wk-btn-line" onClick={onClose} data-class-qr-close=""><Icon name="x" />{t('common.close')}</button>
      </div>
      <h2 className="cl-qr-name">{klass.name}</h2>
      <p className="cl-qr-say">{t('cogitaClass.qr.scan')}</p>
      <div className="cl-qr-code"><QRCodeSVG value={url} size={512} marginSize={2} data-class-qr-code="" /></div>
      <p className="cl-qr-count" role="status" data-class-count={count ?? ''}>{count === null ? '' : t('cogitaClass.qr.joined', { count })}</p>
      <div className="cl-qr-foot">
        <span>{t('cogitaClass.qr.orOpen', { host })}</span>
        <button type="button" className="wk-link-btn" onClick={() => { void navigator.clipboard?.writeText(url).then(() => setCopied(true)); }}>{copied ? t('common.copied') : t('cogitaClass.qr.copy')}</button>
      </div>
    </div>
  );
}
