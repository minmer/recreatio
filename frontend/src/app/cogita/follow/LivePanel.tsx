/**
 * 2026-11-26 (Eigentümer: „zwei Mal gestartet — auf einem Gerät und auf einem anderen weiss niemand, welche Live-Stunde die richtige
 * ist; auf der Weltkarte sucht die Karte selbst nach den anderen Sitzungen") — „NA ŻYWO" ÜBER DER WELTKARTE (`worldmap/WorldScreen.tsx`):
 *
 * <code>
 *   suchen      alle 4 s (sichtbar): jede laufende Stunde dieser Baza, die ich sehen darf — Folge-Stunden (Tryb prowadzony) und
 *               Stunden mit Code; je Sitzung nur das Neue der Ereignisse (gemerkt), ohne mich im Raum anzumelden
 *   je Stunde   die Klasse, seit wann, wie viele da sind (für die Gastgeberin), und WER FÜHRT: dieser Tab / ein anderes Gerät
 *               (zuletzt gesehen vor n s) / niemand gerade — aus dem jüngsten Anspruch (`follow-lead`) und dem Herzschlag des Dienstes
 *   handeln     „Prowadź stąd" (übernehmen — das andere Gerät hört auf zu schicken), Leinwand, Beenden; eine Klasse ohne laufende
 *               Folge-Stunde: „Prowadź na żywo"
 *   doppelt     zwei Folge-Stunden einer Klasse: die Schüler folgen der älteren (`oldestFirst`) — die jüngere ist markiert, zum Beenden
 * </code>
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { fmtDate, useT } from '../../core/i18n';
import type { Me } from '../../core/me';
import { viewPath } from '../../routes';
import { ask } from '../../ui/dialogs';
import { myClasses } from '../classes/classes';
import { loadEvents, loadSessions, setSessionState, type SessionRow } from '../live';
import type { CogitaLibrary } from '../store';
import { FOLLOW_LEAD, followEnded, followTab, leadHere, oldestFirst, startFollow, stopFollow, useFollowLive } from './followHost';
import './follow.css';

const LOOK_MS = 4000;
/** So lange nach dem letzten Herzschlag der Gastgeberin gilt eine Stunde als geführt. */
const LED_MS = 15_000;

interface Peek {
  last: number;
  follow: boolean;
  className: string;
  claim: { readonly tab: string; readonly seq: number } | null;
}
/** Je Sitzung, was schon gelesen ist (nur das Neue wird geholt). */
const peeks = new Map<string, Peek>();

async function peekOf(row: SessionRow): Promise<{ peek: Peek; hostAgo: number | null; present: number | null }> {
  const had = peeks.get(row.sessionId) ?? { last: 0, follow: false, className: '', claim: null };
  const r = await loadEvents(row.sessionId, had.last);
  let { follow, className, claim } = had;
  for (const e of r.events) {
    if (e.plain === null) continue;
    try {
      const b = JSON.parse(e.plain) as Record<string, unknown>;
      if (e.kind === 'meta') { follow = b.follow === true; if (typeof b.className === 'string') className = b.className; }
      if (e.kind === FOLLOW_LEAD && typeof b.tab === 'string' && (claim === null || e.seq > claim.seq)) claim = { tab: b.tab, seq: e.seq };
    } catch { /* kein offener Teil */ }
  }
  const peek: Peek = { last: Math.max(had.last, r.last, ...r.events.map((e) => e.seq)), follow, className, claim };
  peeks.set(row.sessionId, peek);
  return { peek, hostAgo: r.pulse?.hostAgo ?? null, present: r.pulse?.present?.length ?? null };
}

export interface LiveSeen {
  readonly row: SessionRow;
  readonly follow: boolean;
  readonly className: string;
  readonly claimTab: string | null;
  readonly hostAgo: number | null;
  readonly present: number | null;
  /** Eine zweite (jüngere) Folge-Stunde derselben Klasse. */
  readonly duplicate: boolean;
}

/** Die laufenden Stunden dieser Baza, laufend nachgesehen. */
export function useLiveSessions(lib: CogitaLibrary, me: Me | null): { readonly seen: readonly LiveSeen[] | null; readonly again: () => void } {
  const [seen, setSeen] = useState<readonly LiveSeen[] | null>(null);
  const [tick, setTick] = useState(0);
  const again = useCallback(() => setTick((n) => n + 1), []);
  useEffect(() => {
    if (me === null) { setSeen([]); return undefined; }
    let alive = true;
    let timer = 0;
    const look = async () => {
      const { sessions } = await loadSessions(undefined, lib.libraryId);
      const rows = sessions.filter((s) => s.kind === 'lesson' && (s.state === 'running' || s.state === 'lobby')).sort(oldestFirst).slice(0, 12);
      const out: LiveSeen[] = [];
      for (const row of rows) {
        const p = await peekOf(row).catch(() => null);
        if (p === null) continue;
        out.push({ row, follow: p.peek.follow, className: p.peek.className, claimTab: p.peek.claim?.tab ?? null, hostAgo: p.hostAgo, present: p.present, duplicate: false });
      }
      const firstOf = new Map<string, string>();
      return out.map((x) => {
        if (!x.follow) return x;
        const area = x.row.areaId.toLowerCase();
        const first = firstOf.get(area);
        if (first === undefined) { firstOf.set(area, x.row.sessionId); return x; }
        return { ...x, duplicate: true };
      });
    };
    const run = () => {
      void look().then((list) => { if (alive) setSeen(list); }, () => { if (alive) setSeen((was) => was ?? []); })
        .finally(() => { if (alive) timer = window.setTimeout(run, document.visibilityState === 'hidden' ? LOOK_MS * 4 : LOOK_MS); });
    };
    run();
    return () => { alive = false; window.clearTimeout(timer); };
  }, [lib.libraryId, me, tick]);
  return { seen, again };
}

type Leads = 'here' | 'elsewhere' | 'nobody';

export function LivePanel({ lib, me }: { lib: CogitaLibrary; me: Me }) {
  const t = useT();
  const { live } = useFollowLive();
  const { seen, again } = useLiveSessions(lib, me);
  const [classes, setClasses] = useState<readonly { readonly areaId: string; readonly name: string }[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void myClasses(true, lib.libraryId).then((list) => { if (alive) setClasses(list.map((c) => ({ areaId: c.areaId, name: c.name }))); }, () => undefined);
    return () => { alive = false; };
  }, [lib.libraryId]);
  const nameOf = useMemo(() => new Map(classes.map((c) => [c.areaId.toLowerCase(), c.name] as const)), [classes]);
  const act = (key: string, job: () => Promise<unknown>) => {
    setBusy(key);
    setFailed(null);
    void job().then(() => undefined, (e: unknown) => setFailed(e instanceof Error ? e.message : String(e))).finally(() => { setBusy(null); again(); });
  };
  const leadsOf = (x: LiveSeen): Leads => {
    if (live !== null && live.sessionId === x.row.sessionId) return live.displaced ? 'elsewhere' : 'here';
    if (x.hostAgo !== null && x.hostAgo <= LED_MS) return 'elsewhere';
    return 'nobody';
  };
  const list = seen ?? [];
  const others = list.filter((x) => !(x.follow && !x.duplicate && leadsOf(x) === 'here'));
  const followAreas = new Set(list.filter((x) => x.follow).map((x) => x.row.areaId.toLowerCase()));
  const startable = classes.filter((c) => !followAreas.has(c.areaId.toLowerCase()));
  const nameFor = (x: LiveSeen) => (x.className !== '' ? x.className : nameOf.get(x.row.areaId.toLowerCase()) ?? t('cogitaFollow.panel.aLesson'));
  const since = (x: LiveSeen) => fmtDate(Date.parse(x.row.startedAt ?? x.row.createdAt), { hour: '2-digit', minute: '2-digit' }, t.lang);
  const end = (x: LiveSeen) => {
    void ask({ title: t('cogitaFollow.panel.endAsk', { name: nameFor(x) }), body: t('cogitaFollow.panel.endSays'), confirm: t('cogitaFollow.bar.end') }).then((yes) => {
      if (!yes) return;
      act(`end:${x.row.sessionId}`, async () => {
        if (live !== null && live.sessionId === x.row.sessionId) { await stopFollow(); return; }
        await setSessionState(x.row.sessionId, 'closed');
        followEnded(x.row.sessionId);
      });
    });
  };
  const take = (x: LiveSeen) => {
    const go = () => act(`lead:${x.row.sessionId}`, () => leadHere(lib, me, x.row, nameFor(x)));
    if (leadsOf(x) !== 'elsewhere' || x.claimTab === followTab) { go(); return; }
    void ask({ title: t('cogitaFollow.panel.takeAsk', { name: nameFor(x) }), body: t('cogitaFollow.panel.takeSays'), confirm: t('cogitaFollow.panel.leadHere') }).then((yes) => { if (yes) go(); });
  };

  return (
    <section className="cg-live-panel" aria-label={t('cogitaFollow.panel.title')} data-live-panel="" data-live-count={list.length} data-live-searching={seen === null ? '1' : '0'}>
      <header className="cg-live-panel-head">
        <span className={`cg-follow-dot${list.length === 0 ? ' is-off' : ''}`} aria-hidden="true" />
        <strong>{t('cogitaFollow.panel.title')}</strong>
        <span className="cg-muted">{seen === null ? t('cogitaFollow.panel.searching') : list.length === 0 ? t('cogitaFollow.panel.none') : t('cogitaFollow.panel.count', { count: list.length })}</span>
        {/* Die Stunde, die dieser Tab führt: nur ein Hinweis — alles Weitere steht in der Leiste darunter. */}
        {list.filter((x) => x.follow && !x.duplicate && leadsOf(x) === 'here').map((x) => (
          <span key={x.row.sessionId} className="cg-live-chip" data-live-session={x.row.sessionId} data-live-leads="here" data-live-duplicate="0">
            <strong>{nameFor(x)}</strong> · {t('cogitaFollow.panel.leadsHere')}
          </span>
        ))}
      </header>
      {others.length > 0 && (
        <ul className="cg-live-list">
          {others.map((x) => {
            const leads = x.follow ? leadsOf(x) : null;
            const id = x.row.sessionId;
            return (
              <li key={id} className={`cg-live-row${leads === 'here' ? ' is-here' : ''}${x.duplicate ? ' is-duplicate' : ''}`} data-live-session={id} data-live-leads={leads ?? 'code'} data-live-duplicate={x.duplicate ? '1' : '0'}>
                <span className="cg-live-what">
                  <strong>{nameFor(x)}</strong>
                  <span className="cg-muted"> · {x.follow ? t('cogitaFollow.panel.guided') : t('cogitaFollow.panel.withCode', { code: x.row.joinCode ?? '—' })} · {t('cogitaFollow.panel.since', { time: since(x) })}</span>
                  {x.present !== null && <span className="cg-muted"> · {t('cogitaFollow.bar.online', { count: x.present })}</span>}
                </span>
                <span className={`cg-live-who is-${leads ?? 'code'}`} data-live-who="">
                  {leads === 'here' ? t('cogitaFollow.panel.leadsHere')
                    : leads === 'elsewhere' ? t('cogitaFollow.panel.leadsElsewhere', { s: Math.max(0, Math.round((x.hostAgo ?? 0) / 1000)) })
                    : leads === 'nobody' ? t('cogitaFollow.panel.leadsNobody')
                    : t('cogitaFollow.panel.codeLesson')}
                </span>
                {x.duplicate && <span className="wk-note cg-live-dup" data-live-dup-note="">{t('cogitaFollow.panel.duplicate')}</span>}
                <span className="cg-live-actions">
                  {x.follow && leads !== 'here' && x.row.host && !x.duplicate && (
                    <button type="button" className="wk-btn is-small" disabled={busy !== null} onClick={() => take(x)} data-live-lead-here={id}>{t('cogitaFollow.panel.leadHere')}</button>
                  )}
                  {!x.follow && <a className="wk-btn is-small" href={viewPath('learn', lib.libraryId, 'sesje', id)} data-live-open={id}>{t('cogitaFollow.panel.open')}</a>}
                  <a className="wk-btn wk-btn-line is-small" href={viewPath('learn', lib.libraryId, 'sesje', id, 'ekran')} target="_blank" rel="noreferrer">{t('cogitaFollow.bar.screen')}</a>
                  {x.row.host && <button type="button" className="wk-btn wk-btn-line is-small" disabled={busy !== null} onClick={() => end(x)} data-live-end={id}>{t('cogitaFollow.bar.end')}</button>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {startable.length > 0 && (
        <div className="cg-live-start" data-live-start="">
          <span className="cg-muted">{t('cogitaFollow.panel.startLabel')}</span>
          {startable.map((c) => (
            <button key={c.areaId} type="button" className="wk-btn wk-btn-line is-small" disabled={busy !== null} title={t('cogitaFollow.console.startSays')}
              onClick={() => act(`start:${c.areaId}`, () => startFollow(lib, me, c))} data-live-start-class={c.areaId}>{c.name}</button>
          ))}
        </div>
      )}
      {failed !== null && <p className="wk-error">{failed}</p>}
    </section>
  );
}
