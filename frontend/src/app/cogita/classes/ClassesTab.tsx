/**
 * 2026-11-22 — „KLASY" IN DER NAUKA EINER BAZA: eine Klasse anlegen (ein Name genügt), ihren QR-Code zeigen (gross, für den
 * Beamer, mit der Zahl derer, die schon drin sind), die Fortschritte der Schüler öffnen, einen neuen Code ausgeben oder das
 * Beitreten schliessen. Was eine Klasse ist: `classes.ts`. Die Lekcja selbst beginnt auf der Karte („Prowadź tutaj").
 */

import { lazy, Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { QRCodeSVG } from 'qrcode.react';

import { useT } from '../../core/i18n';
import { WorkspaceError } from '../../core/session';
import { viewPath } from '../../routes';
import { loadSeats } from '../../seats/seat';
import { ask } from '../../ui/dialogs';
import { Icon } from '../../ui/icons';
import { Loading } from '../../ui/Loading';
import { MenuButton } from '../../ui/Menu';
import { useCtx } from '../ui';
import { classAim, type ClassOf } from './classModel';
import { classJoinLink, classOpening, closeJoining, createClass, myClasses, renewJoinLink, type ClassStage } from './classes';
import './classes.css';

/** Wie viele in einer Klasse sind: Konten, die den Code eingelöst haben, und Personen ohne Konto (Plätze der Klasse). */
async function studentsIn(klass: ClassOf, redeemed: number): Promise<number> {
  const seats = await loadSeats(klass.areaId).then((r) => r.seats.filter((s) => s.revokedAt === null).length, () => 0);
  return redeemed + seats;
}

/* 2026-11-22 (I11) — eine Stunde planen: `…/klasy/<klasse>/plan…` (`lesson/LessonPlanner.tsx`). */
const LessonPlanner = lazy(() => import('../lesson/LessonPlanner').then((m) => ({ default: m.LessonPlanner })));

export function ClassesTab({ trail = [] }: { trail?: readonly string[] }) {
  if (trail[0] !== undefined && trail[1] === 'plan') {
    return <Suspense fallback={<Loading />}><LessonPlanner classAreaId={trail[0]} trail={trail.slice(2)} /></Suspense>;
  }
  return <ClassesList />;
}

function ClassesList() {
  const t = useT();
  const { lib, me, name } = useCtx();
  const [list, setList] = useState<readonly ClassOf[] | null>(null);
  const [opening, setOpening] = useState<'share' | 'public' | null | undefined>(undefined);
  const [tick, setTick] = useState(0);
  const [shown, setShown] = useState<{ readonly klass: ClassOf; readonly url: string } | null>(null);
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
    <div className="cg cl-tab" data-class-tab="">
      <p className="wk-lede">{t('cogitaClass.tab.lede')}</p>
      {opening === undefined ? null : opening === null
        ? <p className="wk-note">{t('cogitaClass.tab.cannot')}</p>
        : <NewClass onMade={(klass, url) => { setTick((n) => n + 1); setShown({ klass, url }); }} base={base} />}
      {list === null ? <Loading lines={2} />
        : list.length === 0 ? <p className="wk-empty">{t('cogitaClass.tab.empty')}</p>
        : (
          <ul className="cl-list">
            {list.map((klass) => <ClassCard key={klass.areaId} klass={klass} onShow={(url) => setShown({ klass, url })} onChanged={() => setTick((n) => n + 1)} />)}
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

function ClassCard({ klass, onShow, onChanged }: { klass: ClassOf; onShow: (url: string) => void; onChanged: () => void }) {
  const t = useT();
  const { me, href, lib } = useCtx();
  const [count, setCount] = useState<number | null>(null);
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
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
  }, [me, klass]);
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
  return (
    <li className="cl-card" data-class-card={klass.areaId}>
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
      <div className="wk-actions">
        {klass.joinInvitationId !== null && (
          <button type="button" className="wk-btn" disabled={url === undefined || url === null || busy} onClick={() => { if (url) onShow(url); }} data-class-qr={klass.areaId}>
            <Icon name="grid" />{t('cogitaClass.card.showQr')}
          </button>
        )}
        {klass.joinInvitationId === null && <button type="button" className="wk-btn wk-btn-line" disabled={busy} onClick={renew}>{t('cogitaClass.card.open')}</button>}
        <a className="wk-btn wk-btn-line" href={href('postepy', klass.areaId)} data-class-progress={klass.areaId}><Icon name="list" />{t('cogitaClass.card.progress')}</a>
        <a className="wk-btn wk-btn-line" href={href('klasy', klass.areaId, 'plan')} data-class-plan={klass.areaId}><Icon name="flow" />{t('cogitaLesson.plan.cardButton')}</a>
      </div>
      {url === null && klass.joinInvitationId !== null && <p className="cl-note">{t('cogitaClass.card.notYours')}</p>}
      <p className="cl-note">{t('cogitaClass.card.lessonHint')}</p>
      {failed !== null && <p className="wk-error">{failed}</p>}
    </li>
  );
}

/**
 * DER QR-CODE FÜR DIE KLASSE — gross, zum Zeigen am Beamer: der Name, der Code, ein Satz, was zu tun ist, und wie viele schon
 * drin sind (alle paar Sekunden neu gezählt). Esc schliesst.
 */
function ClassQr({ klass, url, onClose }: { klass: ClassOf; url: string; onClose: () => void }) {
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
