/**
 * DAS ARCHIV DER SMS — lesen (im Browser die SMS-Seite, auf dem Telefon „Archiwum")
 * und, auf dem Telefon, einrichten: wem es gehört (eine Rolle), welche Gespräche
 * hinein, jetzt archivieren. Auch ein altes Telefon trägt so seine Geschichte bei.
 *
 * <code>
 *   #/workspace/sms/archiwum[/<gespräch>]   auf dem Telefon
 *   #/workspace/sms[/<gespräch>]            im Browser
 * </code>
 *
 * Die Liste kommt aus den Übersichten der Stapel (schnell, auch bei Zehntausenden
 * Nachrichten); ein Gespräch lädt nur seine Stapel; die Suche im Text lädt alles
 * einmal. Wer mehrere Archive lesen darf (das eigene, das der Kancelaria), wählt.
 *
 * 2026-10-18 — im Browser ANTWORTEN (0116): das Telefon mit der Nummer der Rozmowa
 * sendet, gleich oder zur gewählten Zeit; Liste und Gespräch sehen alle halbe Minute
 * nach, was dazukam. Lange drücken wählt Nachrichten — „Wyświetl" zeigt sie gross.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';

import { Avatar, cls, Icon, listTime, PopMenu, useButtonMenu, type MenuItem } from '../chat/ChatKit';

import { useCrumbs } from '../shell/crumbTrail';
import { viewPath } from '../routes';
import { loadAreas, type AreaRow } from '../areas/area';
import { fmtDate, fmtNumber, rich, useT, type T } from '../core/i18n';
import { useRemembered } from '../core/prefs';
import { keysFor } from '../core/ringOf';
import { WorkspaceError, type Who } from '../core/session';
import { myRoleNames } from '../roles/roleNames';
import { selfOf } from '../roles/roles';
import { ask, toast } from '../ui/dialogs';
import { Icon as UiIcon } from '../ui/icons';
import { Loading } from '../ui/Loading';
import { Modal } from '../ui/Modal';
import { PageHeader } from '../ui/PageHeader';
import { useBarHeight } from '../ui/useBarHeight';
import { ARCHIVE_PREF, archiveArea, readSettings, saveSettings, type ArchiveSettings } from './archiveSettings';
import { nameIndex } from './contactStore';
import { contactsOf, ruledNumber, useContactIndex, useLineRules, whyIcon, whyText, type LineWhy } from './lines';
import { OwnLines } from './LinesView';
import { Phone, phoneHere, pluginSource, type NativeThread, type PhoneStatus } from './native';
import { phoneKey, phoneShown, smsParts } from './numbers';
import { cancelReply, loadOutbox, pendingOf, queueReply, type OutboxEntry } from './outbox';
import { archiveNow, archiveRunning, MEDIA_PREF } from './phoneJobs';
import { openArea, openPhone, type PhoneCtx } from './phoneContext';
import {
  archivedFileUrl, archiveIndex, conversationKey, loadAll, loadConversation, readableArchives,
  type ArchivedConversation, type ArchivedMessage, type ArchivedPart, type ArchiveProgress, type ArchiveSummary
} from './smsArchive';
import { DropVeil, usePageDrop } from './fileDrop';
import { daysLabel, shareFile } from './share';
import { SHARE_DAYS, SHARE_MAX, shareLink, sizeText } from './shareSeal';
import { PlanDialog, PlannedRow, SmsHeader, SmsLog, useRoomFrame, type SmsItem } from './smsChat';
import { aheadWhen, around, barStyle, conversationMatches, isMode, SEARCH, timeOf, type SearchMode } from './smsShared';
import './phone.css';

const mb = (bytes: number) => `${fmtNumber(bytes / 1024 / 1024, { maximumFractionDigits: 1 })} MB`;
const meterStyle = (s: ArchiveSummary) => ({ width: `${Math.min(100, (100 * s.bytes) / Math.max(1, s.limit)).toFixed(1)}%` });

/** Ein Archiv, das ich lese — der Bereich, wie er heisst, wie viel darin ist. */
interface ArchiveOption { readonly areaId: string; readonly name: string; readonly messages: number }

/* Was zuletzt geöffnet war — zurück zur Liste steht sie sofort da. */
const indexSeen = new Map<string, { summary: ArchiveSummary; conversations: ArchivedConversation[] }>();
const conversationSeen = new Map<string, ArchivedMessage[]>();

/** Wie oft Liste und Gespräch nachsehen, ob das Telefon Neues archiviert hat. */
const INDEX_EVERY = 30_000;

export function SmsArchiveView({ who, trail }: { who: Who; trail: readonly string[] }) {
  const t = useT();
  const native = phoneHere();
  const [settingsText] = useRemembered(ARCHIVE_PREF, '');
  const settings = useMemo(() => readSettings(settingsText), [settingsText]);
  const [viewText, setViewText] = useRemembered('sms.view', '');
  const [archives, setArchives] = useState<readonly ArchiveOption[] | null>(null);
  const [areas, setAreas] = useState<readonly AreaRow[]>([]);
  const [tick, setTick] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);

  /* Welche Archive ich lese — unter allen Bereichen, die ich kenne. */
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { areas: known } = await loadAreas();
        const found = await readableArchives(known.map((a) => a.areaId));
        if (!alive) return;
        setAreas(known);
        setArchives(found.map((f) => ({ areaId: f.areaId, name: known.find((a) => a.areaId === f.areaId)?.name ?? t('phoneSms.menu.archive'), messages: f.messages })));
      } catch (e) {
        if (alive) setFailed(e instanceof WorkspaceError ? e.message : t('phoneArchive.loadArchivesFailed'));
      }
    })();
    return () => { alive = false; };
  }, [tick, t]);

  const areaId = archives === null ? null
    : archives.some((a) => a.areaId === viewText) ? viewText
    : settings.areaId !== null && archives.some((a) => a.areaId === settings.areaId) ? settings.areaId
    : archives[0]?.areaId ?? (native ? settings.areaId : null);

  const [ctx, setCtx] = useState<PhoneCtx | null>(null);
  useEffect(() => {
    if (areaId === null) { setCtx(null); return undefined; }
    let alive = true;
    void openArea(who, areaId).then((c) => { if (alive) setCtx(c); })
      .catch((e: unknown) => { if (alive) setFailed(e instanceof WorkspaceError ? e.message : t('phoneArchive.openFailed')); });
    return () => { alive = false; };
  }, [who, areaId, t]);

  const [index, setIndex] = useState(areaId === null ? null : indexSeen.get(areaId) ?? null);
  const reload = useCallback(async (opened: PhoneCtx) => {
    const fresh = await archiveIndex(opened);
    indexSeen.set(opened.areaId, fresh);
    setIndex(fresh);
  }, []);
  useEffect(() => {
    if (ctx === null) return;
    setIndex(indexSeen.get(ctx.areaId) ?? null);
    void reload(ctx).catch((e: unknown) => setFailed(e instanceof WorkspaceError ? e.message : t('phoneArchive.loadFailed')));
  }, [ctx, reload, t]);

  /* Neues vom Telefon (eine Antwort, die kam): alle halbe Minute, solange das Fenster vorn ist. */
  useEffect(() => {
    if (ctx === null) return undefined;
    const look = () => { if (document.visibilityState === 'visible') void reload(ctx).catch(() => undefined); };
    const every = window.setInterval(look, INDEX_EVERY);
    document.addEventListener('visibilitychange', look);
    return () => { window.clearInterval(every); document.removeEventListener('visibilitychange', look); };
  }, [ctx, reload]);

  /* Die eigenen Nummern, die das Archiv kennt — von ihnen kann eine Antwort ausgehen. */
  const lines = useMemo(() => [...new Set((index?.conversations ?? []).map((c) => c.lastLine).filter((l): l is string => l !== null && l !== ''))], [index]);
  const level = areas.find((a) => a.areaId === ctx?.areaId)?.myLevel ?? null;
  const mayWrite = level === 'write' || level === 'admin';

  const names = useNames(who, native, index?.conversations ?? []);
  const titleOf = useCallback((c: { readonly peers: readonly string[] }) =>
    (c.peers.length === 0 ? t('phoneSms.noNumber') : c.peers.map((p) => names.get(p) ?? phoneShown(p)).join(', ')), [names, t]);

  const step = trail[0];
  const listHref = native ? viewPath('sms', 'archiwum') : viewPath('sms');
  const conversation = step === undefined ? null : index?.conversations.find((c) => c.key === step) ?? null;

  if (step !== undefined) {
    if (ctx === null || index === null) return failed !== null ? <p className="wk-error">{failed}</p> : <Loading label={t('phoneArchive.opening')} />;
    if (conversation === null) return <p className="wk-empty">{t('phoneArchive.noConversation')}</p>;
    return (
      <ArchiveConversation key={conversation.key} who={who} ctx={ctx} conversation={conversation} title={titleOf(conversation)} names={names} back={listHref} native={native}
        lines={lines} mayWrite={mayWrite} />
    );
  }

  return (
    <ArchiveList who={who} native={native} settings={settings} archives={archives} areaId={areaId} ctx={ctx} index={index}
      failed={failed} titleOf={titleOf} conversationHref={(key) => (native ? viewPath('sms', 'archiwum', key) : viewPath('sms', key))}
      onView={setViewText} onArchived={() => { setTick((n) => n + 1); if (ctx !== null) void reload(ctx); }} areas={areas} />
  );
}

export default SmsArchiveView;

/** Namen zu Nummern: auf dem Telefon aus seinem Adressbuch, im Browser aus den Kontakten in recreatio. */
function useNames(who: Who, native: boolean, conversations: readonly ArchivedConversation[]): ReadonlyMap<string, string> {
  const [names, setNames] = useState<ReadonlyMap<string, string>>(new Map());
  const numbers = useMemo(() => [...new Set(conversations.flatMap((c) => c.peers))], [conversations]);
  const key = numbers.length;
  useEffect(() => {
    let alive = true;
    void (async () => {
      const out = new Map<string, string>();
      try {
        for (const [k, c] of nameIndex(await contactsOf(who))) out.set(k, c.name);
      } catch {
        // ohne Kontakte in recreatio
      }
      if (native && numbers.length > 0) {
        try {
          const { names: found } = await Phone.lookup({ numbers });
          for (const [number, name] of Object.entries(found)) out.set(phoneKey(number), name);
        } catch {
          // ohne Adressbuch
        }
      }
      if (alive) setNames(out);
    })();
    return () => { alive = false; };
    // Neu, wenn andere Nummern dazukommen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [who, native, key]);
  return names;
}

/* -- Die Liste (und auf dem Telefon: einrichten) ------------------------------------------------ */

function ArchiveList({ who, native, settings, archives, areaId, ctx, index, failed, titleOf, conversationHref, onView, onArchived, areas }: {
  who: Who;
  native: boolean;
  settings: ArchiveSettings;
  archives: readonly ArchiveOption[] | null;
  areaId: string | null;
  ctx: PhoneCtx | null;
  index: { summary: ArchiveSummary; conversations: ArchivedConversation[] } | null;
  failed: string | null;
  titleOf: (c: { readonly peers: readonly string[] }) => string;
  conversationHref: (key: string) => string;
  onView: (areaId: string) => void;
  onArchived: () => void;
  areas: readonly AreaRow[];
}) {
  const t = useT();
  const [modeText, setModeText] = useRemembered('sms.search', 'osoby');
  const mode: SearchMode = isMode(modeText) ? modeText : 'osoby';
  const [query, setQuery] = useState('');
  const [all, setAll] = useState<readonly ArchivedMessage[] | null>(null);
  const [loadingAll, setLoadingAll] = useState<string | null>(null);
  const top = useBarHeight();
  useCrumbs(native ? [{ label: t('phoneSms.menu.archive'), href: null }] : []);

  /* Ein anderes Archiv: die Suche im Text beginnt von vorn. */
  useEffect(() => { setAll(null); }, [areaId]);

  const q = query.trim();
  const conversations = index?.conversations ?? [];
  const shown = conversations.filter((c) => conversationMatches(mode, q, titleOf(c), c.peers));

  /* Im Text suchen: einmal alles laden (mit Fortschritt), dann hier durchsuchen. */
  useEffect(() => {
    if (mode !== 'tresc' || q.length < 2 || all !== null || loadingAll !== null || ctx === null) return;
    setLoadingAll(t('phoneArchive.loading'));
    void loadAll(ctx, (done, total) => setLoadingAll(t('phoneArchive.loadingN', { done, total })))
      .then(setAll).catch(() => toast(t('phoneArchive.loadFailed')))
      .finally(() => setLoadingAll(null));
  }, [mode, q, all, loadingAll, ctx, t]);

  const hits = useMemo(() => {
    if (mode !== 'tresc' || q.length < 2 || all === null) return null;
    const needle = q.toLocaleLowerCase();
    return all.filter((m) => m.body.toLocaleLowerCase().includes(needle)).slice(-300).reverse();
  }, [mode, q, all]);

  const ownName = settings.areaId === null ? null : areas.find((a) => a.areaId === settings.areaId)?.name ?? null;

  return (
    <div className="ph-threads" style={barStyle(top)}>
      <PageHeader title={native ? t('phone.ctx.archiveArea') : t('phoneSms.title')} meta={index === null ? undefined
        : t('phoneArchive.meta', { count: fmtNumber(index.summary.messages), used: mb(index.summary.bytes), limit: mb(index.summary.limit) })}
        actions={native ? undefined : <a className="wk-btn wk-btn-quiet" href={viewPath('sms', 'pliki')}><UiIcon name="link" />{t('phoneShare.view.title')}</a>} />
      {index !== null && <span className="ph-meter" aria-hidden="true"><span style={meterStyle(index.summary)} /></span>}

      {native && <ArchiveSetup who={who} settings={settings} conversations={conversations} ownName={ownName} onArchived={onArchived} />}

      {archives !== null && archives.length > 1 && (
        <label className="wk-field ph-archive-pick">
          <span>{t('phoneSms.menu.archive')}</span>
          <select value={areaId ?? ''} onChange={(e) => onView(e.target.value)}>
            {archives.map((a) => (
              <option key={a.areaId} value={a.areaId}>{a.name}{a.areaId === settings.areaId ? ` ${t('phoneArchive.phoneTarget')}` : ''} · {fmtNumber(a.messages)}</option>
            ))}
          </select>
        </label>
      )}

      {failed !== null && <p className="wk-error">{failed}</p>}
      {archives === null && failed === null && <Loading label={t('phoneArchive.loadingArchives')} />}
      {archives !== null && archives.length === 0 && !native && (
        <p className="wk-empty">{t('phoneArchive.none')}</p>
      )}

      {ctx !== null && (
        <>
          <div className="ph-bar" role="search">
            <label className="ch-side-search ph-search-pill">
              <Icon name="search" />
              <select value={mode} aria-label={t('phoneSms.list.searchIn')} onChange={(e) => setModeText(e.target.value)}>
                {(Object.keys(SEARCH) as SearchMode[]).map((m) => <option key={m} value={m}>{SEARCH[m].label}</option>)}
              </select>
              <input type="search" value={query} placeholder={SEARCH[mode].placeholder} aria-label={SEARCH[mode].placeholder}
                inputMode={mode === 'numery' ? 'tel' : 'search'} onChange={(e) => setQuery(e.target.value)} />
            </label>
          </div>
          {index === null && <Loading label={t('phoneArchive.loading')} />}
          {loadingAll !== null && <Loading label={loadingAll} lines={1} />}

          {hits !== null ? (
            hits.length === 0 ? <p className="wk-empty">{t('phoneArchive.noHits')}</p> : (
              <ul className="ch-list ph-chat-list" aria-label={t('phoneSms.list.hits')}>
                {hits.map((m) => {
                  const key = conversationKey(m.peers);
                  const title = titleOf({ peers: m.peers });
                  return (
                    <li key={m.key}>
                      <a className="ch-item" href={conversationHref(key)}>
                        <Avatar seed={key || '?'} name={title} icon={m.peers.length > 1 ? 'users' : /\p{L}/u.test(title) ? undefined : 'user'} /> // i18n-ignore
                        <span className="ch-item-main">
                          <span className="ch-item-top">
                            <strong className="ch-item-title">{title}</strong>
                            <time className="ch-item-time">{listTime(new Date(m.at).toISOString())}</time>
                          </span>
                          <span className="ch-item-bottom"><span className="ch-item-sub">{around(m.body, q)}</span></span>
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            )
          ) : index !== null && (
            shown.length === 0
              ? <p className="wk-empty">{conversations.length === 0 ? (native ? t('phoneArchive.emptyNative') : t('phoneArchive.empty')) : t('phoneContacts.app.noMatch')}</p>
              : (
                <ul className="ch-list ph-chat-list">
                  {shown.map((c) => {
                    const title = titleOf(c);
                    return (
                      <li key={c.key}>
                        <a className={cls('ch-item', c.lastBox === 'in' && 'ph-last-in')} href={conversationHref(c.key)}>
                          <Avatar seed={c.key || '?'} name={title} icon={c.peers.length > 1 ? 'users' : /\p{L}/u.test(title) ? undefined : 'user'} /> // i18n-ignore
                          <span className="ch-item-main">
                            <span className="ch-item-top">
                              <strong className="ch-item-title">{title}</strong>
                              {c.last > 0 && <time className="ch-item-time">{listTime(new Date(c.last).toISOString())}</time>}
                            </span>
                            <span className="ch-item-bottom">
                              <span className="ch-item-sub">{c.lastBox === 'in' ? '' : t('phoneArchive.youPrefix')}{c.lastBody !== '' ? c.lastBody : c.lastMedia ? '📷 MMS' : ''}</span>
                              <span className="ph-item-count" title={t('phoneArchive.countTitle')}>{fmtNumber(c.count)}</span>
                            </span>
                          </span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              )
          )}
        </>
      )}
    </div>
  );
}

/* -- Einrichten (auf dem Telefon) ---------------------------------------------------------------- */

interface RoleOption { readonly id: string; readonly name: string; readonly person: boolean }

/** Meine Rollen, denen ein Archiv gehören kann: die eigene Person und jede Rolle, mit der ich einen Bereich anlegen darf. */
function useOwnRoles(who: Who): readonly RoleOption[] | null {
  const t = useT();
  const [roles, setRoles] = useState<readonly RoleOption[] | null>(null);
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { ring, graph } = await keysFor(who);
        if (ring === null) { if (alive) setRoles([]); return; }
        const names = await myRoleNames(who).catch(() => new Map<string, string>());
        const self = selfOf(graph)?.id ?? null;
        const out = graph.roles
          .filter((r) => r.kind !== 'account' && ring.has(r.id) && (r.id === self || ring.maySign(r.id)))
          .map((r) => ({ id: r.id, name: names.get(r.id) ?? (r.id === self ? t('phoneChat.log.you') : t('phoneArchive.role')), person: r.id === self }))
          .sort((a, b) => Number(b.person) - Number(a.person) || a.name.localeCompare(b.name, t.locale));
        if (alive) setRoles(out);
      } catch {
        if (alive) setRoles([]);
      }
    })();
    return () => { alive = false; };
  }, [who, t]);
  return roles;
}

function ArchiveSetup({ who, settings, conversations, ownName, onArchived }: {
  who: Who;
  settings: ArchiveSettings;
  conversations: readonly ArchivedConversation[];
  ownName: string | null;
  onArchived: () => void;
}) {
  const t = useT();
  const roles = useOwnRoles(who);
  const [mediaText, setMediaText] = useRemembered(MEDIA_PREF, 'on');
  const [status, setStatus] = useState<PhoneStatus | null>(null);
  const [threads, setThreads] = useState<readonly NativeThread[] | null>(null);
  const [progress, setProgress] = useState<ArchiveProgress | null>(null);
  const [running, setRunning] = useState(archiveRunning());
  const [busy, setBusy] = useState(false);
  const [listOpen, setListOpen] = useState(false);

  const refresh = useCallback(() => {
    void Phone.status().then(setStatus).catch(() => undefined);
    void Phone.threads({ limit: 5000 }).then((r) => setThreads(r.threads)).catch(() => setThreads([]));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const archived = useMemo(() => new Map(conversations.map((c) => [c.key, c.count])), [conversations]);
  const person = roles?.find((r) => r.person) ?? null;
  const roleId = settings.roleId ?? person?.id ?? '';
  const chosen = new Set(settings.chosen);

  const chooseRole = async (next: string) => {
    if (next === roleId) return;
    const role = roles?.find((r) => r.id === next);
    const yes = await ask({
      title: role === undefined ? t('phoneArchive.setup.roleAskThis') : t('phoneArchive.setup.roleAsk', { name: role.name }),
      body: t('phoneArchive.setup.roleBody'),
      confirm: t('common.change')
    });
    if (!yes) return;
    setBusy(true);
    try {
      await archiveArea(who, { ...settings, roleId: next, areaId: settings.areas[next] ?? null });
      toast(t('phoneArchive.setup.roleChanged'));
      onArchived();
    } catch (e) {
      toast(e instanceof WorkspaceError || e instanceof Error ? e.message : t('common.failed'));
    } finally {
      setBusy(false);
    }
  };

  const setChoice = (patch: Partial<ArchiveSettings>) => saveSettings({ ...settings, ...patch });
  const toggle = (key: string, on: boolean) => setChoice({ chosen: on ? [...chosen, key] : [...chosen].filter((k) => k !== key) });

  const run = async (full: boolean) => {
    setRunning(true);
    setProgress(null);
    try {
      const done = await archiveNow(who, pluginSource, { full, onProgress: setProgress });
      setProgress(done);
      toast(done.added === 0 ? t('phoneArchive.setup.upToDate') : t('phoneArchive.setup.added', { count: done.added }));
      onArchived();
      refresh();
    } catch (e) {
      toast(e instanceof WorkspaceError || e instanceof Error ? e.message : t('phoneArchive.setup.failed'));
    } finally {
      setRunning(false);
    }
  };

  const threadTitle = (th: NativeThread) => (th.addresses.length === 0 ? t('phoneSms.noNumber') : th.addresses.map((a, i) => th.names?.[i] ?? phoneShown(a)).join(', '));

  return (
    <section className="ph-archive-state" aria-label={t('phoneArchive.setup.title')}>
      {status !== null && !status.smsRead && (
        <div className="ph-setup">
          <p>
            {rich(t('phoneArchive.setup.noRead'), { b: (s) => <strong>{s}</strong> })}
          </p>
          <div className="wk-actions">
            <button type="button" className="wk-btn" onClick={() => void Phone.requestSmsRead().then(refresh)}>{t('phoneArchive.setup.allowRead')}</button>
          </div>
        </div>
      )}

      <label className="wk-field">
        <span>{t('phoneArchive.setup.owner')}</span>
        <select value={roleId} disabled={roles === null || busy || running} onChange={(e) => void chooseRole(e.target.value)}>
          {(roles ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}{r.person ? ` ${t('phoneArchive.setup.private')}` : ''}</option>)}
        </select>
      </label>
      <p>
        {t('phoneArchive.setup.ownerNote')}{ownName !== null ? ` ${t('phoneArchive.setup.area', { name: ownName })}` : ''}
      </p>

      <div className="wk-field" role="radiogroup" aria-label={t('phoneArchive.setup.which')}>
        <label className="wk-check"><input type="radio" checked={settings.mode === 'all'} onChange={() => setChoice({ mode: 'all' })} /><span>{t('phoneArchive.setup.all')}</span></label>
        <label className="wk-check"><input type="radio" checked={settings.mode === 'chosen'} onChange={() => { setChoice({ mode: 'chosen' }); setListOpen(true); }} /><span>{t('phoneArchive.setup.chosen')}</span></label>
      </div>

      {settings.mode === 'chosen' && (
        <div className="ph-choose">
          <button type="button" className="wk-link-btn" onClick={() => setListOpen(!listOpen)}>
            {listOpen ? t('phoneArchive.setup.collapse') : t('phoneArchive.setup.chosenCount', { count: settings.chosen.length })}
          </button>
          {listOpen && threads !== null && (
            <>
              <div className="wk-actions">
                <button type="button" className="wk-link-btn" onClick={() => setChoice({ chosen: [...new Set([...settings.chosen, ...threads.map((th) => conversationKey(th.addresses))])] })}>{t('phoneArchive.setup.selectAll')}</button>
                <button type="button" className="wk-link-btn" onClick={() => setChoice({ chosen: [] })}>{t('phoneArchive.setup.selectNone')}</button>
              </div>
              <ul className="ph-choose-list">
                {threads.map((th) => {
                  const key = conversationKey(th.addresses);
                  const inArchive = archived.get(key) ?? 0;
                  return (
                    <li key={th.threadId}>
                      <label className="wk-check">
                        <input type="checkbox" checked={chosen.has(key)} onChange={(e) => toggle(key, e.target.checked)} />
                        <span className="ph-choose-text">
                          <span className="ph-row-name">{threadTitle(th)}</span>
                          <small>{t('phoneArchive.setup.onPhone', { count: th.count })}{inArchive > 0 ? ` · ${t('phoneArchive.setup.inArchive', { count: inArchive })}` : ''}</small>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}

      <label className="wk-check">
        <input type="checkbox" checked={mediaText !== 'off'} onChange={(e) => setMediaText(e.target.checked ? 'on' : 'off')} />
        <span>{t('phoneArchive.setup.media')}</span>
      </label>

      <OwnLines />
      <p>
        {t('phoneArchive.setup.whole')}
        {' '}{settings.areaId === null ? t('phoneArchive.setup.notOn') : t('phoneArchive.setup.auto')}
      </p>
      <div className="wk-actions">
        <button type="button" className="wk-btn" disabled={running || status?.smsRead === false} onClick={() => void run(false)}>
          <UiIcon name="archive" />{running ? t('phoneArchive.setup.running') : t('phoneArchive.setup.run')}
        </button>
        <button type="button" className="wk-btn wk-btn-quiet" disabled={running || status?.smsRead === false} onClick={() => void run(true)}>{t('phoneArchive.setup.full')}</button>
      </div>
      {progress !== null && (
        <p aria-live="polite">
          {t('phoneArchive.setup.progress', { done: progress.conversations, of: progress.of, seen: progress.seen, added: progress.added, known: progress.known })}
          {progress.media > 0 ? ` · ${t('phoneArchive.setup.files', { count: progress.media })}` : ''}{progress.done ? t('phoneArchive.setup.finished') : '…'}
        </p>
      )}
    </section>
  );
}

/* -- Ein Gespräch ---------------------------------------------------------------------------- */

const STEP = 200;
const OUTBOX_EVERY = 15_000;

/** Was dem Telefon gegeben wurde — alle 15 Sekunden nachgesehen, solange das Fenster vorn ist. */
function useOutbox(ctx: PhoneCtx, on: boolean): [readonly OutboxEntry[], () => void] {
  const [entries, setEntries] = useState<readonly OutboxEntry[]>([]);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!on) return undefined;
    let alive = true;
    const look = () => {
      if (document.visibilityState !== 'visible') return;
      void loadOutbox(ctx).then((found) => { if (alive) setEntries(found); }).catch(() => undefined);
    };
    look();
    const every = window.setInterval(look, OUTBOX_EVERY);
    document.addEventListener('visibilitychange', look);
    return () => { alive = false; window.clearInterval(every); document.removeEventListener('visibilitychange', look); };
  }, [ctx, on, tick]);
  return [entries, useCallback(() => setTick((n) => n + 1), [])];
}

/** Wo eine aus dem Browser gerade ist — die Zeile unter ihrem Text. */
function outboxMeta(entry: OutboxEntry, t: T): { text: string; future: boolean } {
  const m = entry.message;
  const at = m?.sendAt ?? 0;
  const future = m !== null && m.sendAt !== null && at > Date.now();
  const device = entry.device !== null ? ` (${entry.device})` : '';
  const text = entry.state === 'waiting' ? (future ? t('phoneArchive.out.waitingAt', { when: aheadWhen(at) }) : t('phoneArchive.out.waiting'))
    : entry.state === 'taken' ? (future ? t('phoneArchive.out.takenAt', { when: aheadWhen(at), device }) : t('phoneArchive.out.taken', { device }))
    : entry.state === 'sent' ? (entry.doneAt !== null ? t('phoneArchive.out.sentAt', { device, time: timeOf(Date.parse(entry.doneAt)) }) : t('phoneArchive.out.sent', { device }))
    : entry.state === 'failed' ? (entry.error !== null ? t('phoneSms.planned.failedWhy', { error: entry.error }) : t('phoneSms.planned.failed'))
    : t('phoneArchive.out.cancelled');
  return { text, future };
}

/*
 * EIN GESPRÄCH AUS DEM ARCHIV, wie eine Rozmowa (2026-10-19): der Kopf mit dem Namen und —
 * im Browser — der eigenen Nummer, von der das Telefon die Antwort senden soll; darunter,
 * was unterwegs ist, bis es im Archiv steht; unten das Feld. Auf dem Telefon (Archiwum)
 * bleibt es zum Lesen — geschrieben wird in SMS.
 */
function ArchiveConversation({ who, ctx, conversation, title, names, back, native, lines, mayWrite }: {
  who: Who; ctx: PhoneCtx; conversation: ArchivedConversation; title: string; names: ReadonlyMap<string, string>; back: string; native: boolean;
  lines: readonly string[]; mayWrite: boolean;
}) {
  const t = useT();
  const seenKey = `${ctx.areaId}:${conversation.key}`;
  const batchKey = conversation.batches.join(',');
  const [messages, setMessages] = useState<readonly ArchivedMessage[] | null>(conversationSeen.get(seenKey) ?? null);
  /* Die älteste gezeigte — sie bleibt, wenn Neues dazukommt; sonst rutschte das Fenster, und wer weiter oben liest, verlöre seine Stelle. */
  const [oldest, setOldest] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [outbox, reloadOutbox] = useOutbox(ctx, !native);
  const [search, setSearch] = useState('');
  const [follow, setFollow] = useState(0);
  const [ownText, setOwnText] = useRemembered('sms.line', '');
  const [askingLine, setAskingLine] = useState(false);
  const own = phoneKey(ownText);
  /*
    Von welcher Nummer: dieselben Regeln wie auf dem Telefon (am Konto) — die Wahl dieser
    Rozmowa, sonst die Nummer ihrer Gruppe; dann die zuletzt benutzte. Was hier gewählt wird,
    ist die Wahl der Rozmowa, auch auf dem Telefon.
  */
  const { groupRules, threadRules, setThreadRule } = useLineRules();
  const contacts = useContactIndex(who);
  const rule = useMemo(() => ruledNumber({ peers: conversation.peers, contacts, groupRules, threadRules }),
    [conversation.peers, contacts, groupRules, threadRules]);
  const line = rule?.number ?? conversation.lastLine ?? lines[0] ?? own;
  const options = useMemo(() => [...new Set([line, conversation.lastLine, ...lines, own]
    .filter((l): l is string => l !== null && l !== ''))], [line, conversation.lastLine, lines, own]);
  const lineMenu = useButtonMenu();
  const top = useBarHeight();
  const group = conversation.peers.length > 1;
  const replying = !native && mayWrite && conversation.peers.length === 1;
  /* 2026-10-27 — eine Datei auf das Gespräch gezogen: sie geht mit der Antwort als Link. */
  const [dropped, setDropped] = useState<Dropped | null>(null);
  const dropping = usePageDrop(replying ? (files) => setDropped((was) => ({ files, n: (was?.n ?? 0) + 1 })) : null);
  useRoomFrame();
  useCrumbs(native ? [{ label: t('phoneSms.menu.archive'), href: back }] : []);

  useEffect(() => {
    let alive = true;
    void loadConversation(ctx, conversation)
      .then((found) => { conversationSeen.set(seenKey, found); if (alive) { setMessages(found); setFailed(null); } })
      .catch(() => { if (alive) setFailed(t('phoneSms.thread.loadFailed')); });
    return () => { alive = false; };
    // Neu nur, wenn andere Stapel dazukommen — nicht bei jedem Nachsehen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, seenKey, batchKey]);

  const firstShown = useMemo(() => {
    if (messages === null) return 0;
    const at = oldest === null ? -1 : messages.findIndex((m) => m.key === oldest);
    return at >= 0 ? at : Math.max(0, messages.length - STEP);
  }, [messages, oldest]);
  useEffect(() => {
    if (oldest === null && messages !== null && messages.length > 0) setOldest(messages[firstShown].key);
  }, [messages, oldest, firstShown]);
  const shown = useMemo(() => (messages === null ? [] : messages.slice(firstShown)), [messages, firstShown]);
  const more = firstShown > 0;
  const earlier = () => { if (messages !== null && firstShown > 0) setOldest(messages[Math.max(0, firstShown - STEP)].key); };
  const pending = useMemo(() => pendingOf(outbox, conversation.key, messages ?? []), [outbox, conversation.key, messages]);

  /* Lief das Gespräch über zwei eigene Nummern: an jeder Nachricht das Ende der Nummer (die Steckplätze kennt der Browser nicht). */
  const ownLines = useMemo(() => new Set((messages ?? []).map((m) => m.line ?? '').filter((l) => l !== '')), [messages]);
  const items: SmsItem[] = useMemo(() => shown.map((m) => ({
    key: m.key,
    mine: m.box !== 'in',
    at: m.at,
    body: m.body,
    subject: m.subject,
    author: group && m.box === 'in' && m.from !== null ? names.get(m.from) ?? phoneShown(m.from) : null,
    authorSeed: m.from ?? undefined,
    state: m.box === 'failed' ? 'failed' as const : null,
    media: m.parts.length > 0 ? m.parts.map((p, j) => <ArchivedMedia key={j} ctx={ctx} part={p} />) : undefined,
    ...(ownLines.size > 1 && m.line ? { sim: `…${m.line.slice(-3)}`, simTitle: t(m.box === 'in' ? 'phoneSms.sim.in' : 'phoneSms.sim.out', { line: phoneShown(m.line) }) } : {})
  })), [shown, group, names, ctx, ownLines, t]);

  const cancel = async (entry: OutboxEntry) => {
    if (!await ask({ title: t('phoneArchive.conv.cancelAsk'), body: t('phoneArchive.conv.cancelBody'), confirm: t('phoneSms.thread.cancel'), danger: true })) return;
    try {
      await cancelReply(ctx, entry.id);
    } catch (e) {
      toast(e instanceof WorkspaceError ? e.message : t('phoneArchive.conv.cancelFailed'));
    }
    reloadOutbox();
  };
  const retry = async (entry: OutboxEntry) => {
    if (entry.message === null) return;
    try {
      await queueReply(ctx, { to: entry.message.to, body: entry.message.body, line: entry.message.line, sendAt: null, conversation: entry.message.conversation });
      toast(t('phoneArchive.conv.retried'));
    } catch (e) {
      toast(e instanceof WorkspaceError ? e.message : t('common.failed'));
    }
    reloadOutbox();
  };

  const tail = pending.length === 0 ? undefined : pending.map((entry) => {
    const meta = outboxMeta(entry, t);
    const failedHere = entry.state === 'failed';
    const cancelable = entry.state === 'waiting' || (entry.state === 'taken' && meta.future);
    const cancelTool = <button type="button" className="wk-link-btn wk-danger-link" onClick={() => void cancel(entry)}>{t('phoneSms.thread.cancel')}</button>;
    const retryTool = <button type="button" className="wk-link-btn" onClick={() => void retry(entry)}>{t('phoneSms.mms.resend')}</button>;
    return (
      <PlannedRow key={entry.id} text={entry.message?.body ?? ''} meta={meta.text} failed={failedHere}
        tools={cancelable ? cancelTool : failedHere ? retryTool : undefined} />
    );
  });

  const from = messages !== null && messages.length > 0 ? messages[0].at : conversation.first;
  const ruleText = rule === null ? '' : ` — ${whyText({ why: rule.why, group: rule.group ?? null })}`;
  /* 2026-10-29 — warum diese Nummer: dasselbe Zeichen wie auf dem Telefon (gewählt, Gruppe, zuletzt, sonst die erste bekannte). */
  const why: LineWhy = rule !== null ? rule.why : conversation.lastLine !== null && conversation.lastLine !== '' && line === conversation.lastLine ? 'last' : 'default';
  const whyHere = why === 'last' ? t('phoneArchive.conv.whyLast') : why === 'default' ? t('phoneArchive.conv.whyDefault') : whyText({ why, group: rule?.group ?? null });
  const lineItems: MenuItem[] = [
    ...options.map((l) => ({
      label: `${phoneShown(l)}${l === rule?.number ? ruleText : l === conversation.lastLine ? ` — ${t('phoneArchive.conv.thisConversation')}` : ''}`, // i18n-ignore
      icon: 'phone' as const, checked: line === l, onSelect: () => setThreadRule(conversation.peers, l)
    })),
    { label: t('phoneArchive.conv.otherNumber'), icon: 'edit', onSelect: () => setAskingLine(true) },
    ...(rule?.why === 'thread' ? [{ label: t('phoneChat.line.reset'), icon: 'refresh' as const, onSelect: () => setThreadRule(conversation.peers, null) }] : [])
  ];
  const sub = (
    <>
      {replying && (
        <>
          <button type="button" className="ch-chip ph-line-chip" aria-haspopup="menu" aria-expanded={lineMenu.open !== null}
            title={line === '' ? t('phoneArchive.conv.lineTitle') : t('phoneArchive.conv.lineTitleWhy', { why: whyHere })} data-why={line === '' ? undefined : why}
            onClick={(e) => lineMenu.toggle(e.currentTarget)}>
            <Icon name={line === '' ? 'phone' : whyIcon(why)} />{line === '' ? t('phoneArchive.conv.pickNumber') : phoneShown(line)}<Icon name="down" />
          </button>
          {lineMenu.open !== null && (
            <PopMenu anchor={{ rect: lineMenu.open.rect }} from={lineMenu.open.from} label={t('phoneChat.line.which')} items={lineItems} onClose={lineMenu.close}>
              <p className="ch-pop-head ph-why-head">
                {line !== '' && <><Icon name={whyIcon(why)} />{whyHere}. </>}{t('phoneArchive.conv.lineHead')}
              </p>
            </PopMenu>
          )}
        </>
      )}
      <span className="ph-head-numbers">{t('phoneArchive.setup.inArchive', { count: messages === null ? conversation.count : messages.length })}{from > 0 ? ` · ${t('phoneArchive.conv.since', { date: fmtDate(new Date(from), { day: '2-digit', month: '2-digit', year: 'numeric' }) })}` : ''}</span>
    </>
  );

  return (
    <div className="ch-room ph-room" style={barStyle(top)}>
      <SmsHeader back={back} title={title} seed={conversation.key || '?'} group={group} sub={sub} menu={[]} search={search} onSearch={setSearch} />
      <SmsLog items={messages === null ? null : items} failed={failed} title={title} group={group} search={search} follow={follow}
        more={more} onEarlier={earlier} tail={tail} empty={t('phoneArchive.conv.empty')}
        place={`archive:${ctx.areaId}:${conversation.key}`} firstNew={null} />
      {!native && (
        <ReplyBox who={who} ctx={ctx} conversation={conversation} line={line} mayWrite={mayWrite} dropped={dropped}
          onQueued={() => { setFollow((n) => n + 1); reloadOutbox(); }} onWrite={() => setFollow((n) => n + 1)} />
      )}
      {dropping && <DropVeil text={t('phoneArchive.conv.drop')} />}
      {askingLine && (
        <OtherLine value={ownText} onClose={() => setAskingLine(false)}
          onSave={(value) => { setOwnText(value); setThreadRule(conversation.peers, phoneKey(value)); setAskingLine(false); }} />
      )}
    </div>
  );
}

/** Ein anderer eigener Numer — den das Archiv noch nicht kennt. */
function OtherLine({ value, onSave, onClose }: { value: string; onSave: (value: string) => void; onClose: () => void }) {
  const t = useT();
  const [text, setText] = useState(value);
  return (
    <Modal title={t('phoneArchive.other.title')} onClose={onClose}>
      <label className="wk-field">
        <span>{t('phoneArchive.other.label')}</span>
        <input type="tel" value={text} placeholder="+48 600 100 200" autoFocus onChange={(e) => setText(e.target.value)} />
      </label>
      <div className="wk-actions">
        <button type="button" className="wk-btn" disabled={phoneKey(text) === ''} onClick={() => onSave(text)}>{t('phoneArchive.other.set')}</button>
        <button type="button" className="wk-link-btn" onClick={onClose}>{t('common.cancel')}</button>
      </div>
    </Modal>
  );
}

/** Auf das Gespräch gezogene Dateien — `n` zählt, damit dieselbe Datei zweimal auch zweimal ankommt. */
interface Dropped { readonly files: readonly File[]; readonly n: number }

/**
 * DIE ANTWORT AUS DEM BROWSER — wie das Feld des Chats: 📎 (eine Datei geht als Link mit),
 * die Lasche für „Wyślij później", Senden. An die eine Person der Rozmowa, von der Nummer
 * im Kopf; nur das Telefon mit dieser Nummer nimmt sie (FCM weckt es, sonst spätestens in
 * einer Viertelstunde).
 *
 * 2026-10-27 — die Datei kommt auch, wenn man sie auf das Gespräch zieht (`dropped`) oder
 * ins Feld einfügt (ein Bildschirmfoto mit Strg+V).
 */
function ReplyBox({ who, ctx, conversation, line, mayWrite, dropped, onQueued, onWrite }: {
  who: Who; ctx: PhoneCtx; conversation: ArchivedConversation; line: string; mayWrite: boolean; onQueued: () => void;
  dropped: Dropped | null;
  /** Man beginnt zu schreiben — das Gespräch geht ans Ende. */
  onWrite: () => void;
}) {
  const t = useT();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [sendMenu, setSendMenu] = useState<{ rect: DOMRect; from: Element } | null>(null);
  /* 0117 — eine Datei geht als Link mit (in voller Grösse, versiegelt im eigenen Bereich). */
  const [file, setFile] = useState<File | null>(null);
  const [daysText, setDaysText] = useRemembered('sms.linkDays', '30');
  const [progress, setProgress] = useState<number | null>(null);
  const uploaded = useRef<{ readonly file: File; readonly link: string } | null>(null);
  const picker = useRef<HTMLInputElement | null>(null);
  const days = (SHARE_DAYS as readonly number[]).includes(Number(daysText)) ? Number(daysText) : 30;

  /** Eine Datei für die Antwort — gewählt, hineingezogen oder eingefügt. Eine SMS trägt einen Link. */
  const take = (files: readonly File[]) => {
    const chosen = files[0];
    if (chosen === undefined) return;
    if (busy) { toast(t('phoneArchive.reply.wait')); return; }
    if (chosen.size > SHARE_MAX) { toast(t('phoneSms.compose.tooBig')); return; }
    uploaded.current = null;
    setFile(chosen);
    if (files.length > 1) toast(t('phoneArchive.reply.oneFile', { name: chosen.name }));
  };
  useEffect(() => {
    if (dropped !== null) take(dropped.files);
    // Nur, wenn wieder etwas hineingezogen wurde.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dropped]);

  if (!mayWrite) return <p className="ch-compose is-readonly">{t('phoneArchive.reply.readOnly')}</p>;
  if (conversation.peers.length !== 1) return <p className="ch-compose is-readonly">{t('phoneArchive.reply.onePerson')}</p>;

  const content = text.trim() !== '' || file !== null;
  const withLink = (link: string) => (text.trim() === '' ? link : `${text.trimEnd()}\n${link}`);
  const count = smsParts(file === null ? text : withLink(shareLink('x'.repeat(22))));
  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(e.target.files ?? []);
    e.target.value = '';
    take(chosen);
  };
  const send = async (at: number | null) => {
    if (line === '') { toast(t('phoneArchive.reply.pickLine')); return; }
    if (busy || !content) return;
    setBusy(true);
    try {
      let body = text;
      if (file !== null) {
        let link = uploaded.current !== null && uploaded.current.file === file ? uploaded.current.link : null;
        if (link === null) {
          setProgress(0);
          try {
            link = (await shareFile(await openPhone(who), file, {
              days, to: conversation.peers, onProgress: (done, total) => setProgress(total > 0 ? done / total : 0)
            })).link;
            uploaded.current = { file, link };
          } finally {
            setProgress(null);
          }
        }
        body = withLink(link);
      }
      await queueReply(ctx, { to: conversation.peers, body, line, sendAt: at, conversation: conversation.key });
      setText('');
      setFile(null);
      uploaded.current = null;
      toast(at === null ? t('phoneArchive.reply.queued') : t('phoneArchive.reply.queuedAt', { when: aheadWhen(at) }));
      onQueued();
    } catch (e) {
      toast(e instanceof WorkspaceError ? e.message : t('phoneArchive.reply.failed'));
    } finally {
      setBusy(false);
    }
  };

  const status = busy && progress !== null ? t('phoneSms.compose.uploading', { percent: Math.round(progress * 100) })
    : line === '' ? t('phoneArchive.reply.pickLine')
    : [
      ...(text !== '' || file !== null ? [
        ...(count.parts > 1 ? [t('phoneSms.compose.parts', { count: count.parts })] : []),
        t('phoneSms.compose.left', { left: count.left }),
        ...(file !== null ? [t('phoneSms.compose.withLink')] : [])
      ] : []),
      t('phoneArchive.reply.sentBy', { line: phoneShown(line) })
    ].join(' · ');

  return (
    <form className="ch-compose ph-compose ph-reply" onSubmit={(e) => { e.preventDefault(); void send(null); }}>
      {file !== null && (
        <div className="ch-files">
          <span className="ch-file-chip">
            <span className="ch-file-ic"><Icon name="file" /></span>
            <span className="ch-file-text"><span className="ch-file-name">{file.name}</span><small>{sizeText(file.size)} · {t('phoneArchive.reply.linkFull')}</small></span>
            <button type="button" className="ch-icon-btn is-small" aria-label={t('phoneSms.compose.removeAttachment', { name: file.name })} disabled={busy}
              onClick={() => { setFile(null); uploaded.current = null; }}><Icon name="x" /></button>
          </span>
          <select aria-label={t('phoneSms.compose.linkDays')} value={days} disabled={busy} onChange={(e) => setDaysText(e.target.value)}>
            {SHARE_DAYS.map((d) => <option key={d} value={d}>{t('phoneSms.compose.valid', { days: daysLabel(d) })}</option>)}
          </select>
        </div>
      )}
      <div className="ch-compose-row">
        <div className="ch-field">
          <textarea rows={1} value={text} placeholder={t('phoneArchive.reply.placeholder')} aria-label={t('phoneArchive.reply.body')} onChange={(e) => setText(e.target.value)} onFocus={onWrite}
            onPaste={(e) => {
              const pasted = Array.from(e.clipboardData.files);
              if (pasted.length === 0) return;
              if (e.clipboardData.getData('text') === '') e.preventDefault();
              take(pasted);
            }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(null); } }} />
          <button type="button" className="ch-icon-btn" aria-label={t('phoneArchive.reply.attach')} title={t('phoneArchive.reply.attach')} disabled={busy}
            onClick={() => picker.current?.click()}>
            <Icon name="clip" />
          </button>
        </div>
        {content && (
          <button type="button" className="ch-send-more" aria-label={t('phoneSms.compose.later')} title={t('phoneSms.compose.later')} aria-haspopup="menu" aria-expanded={sendMenu !== null}
            disabled={busy} onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => { const el = e.currentTarget; setSendMenu(sendMenu === null ? { rect: el.getBoundingClientRect(), from: el } : null); }}>
            <Icon name="chevron" />
          </button>
        )}
        <button type="submit" className="ch-send" aria-label={t('common.send')} title={t('common.send')} disabled={busy || !content || line === ''} onMouseDown={(e) => e.preventDefault()}>
          <Icon name="send" />
        </button>
      </div>
      {progress !== null && <progress className="ph-progress" value={progress} max={1} aria-label={t('phoneSms.compose.uploadBar')} />}
      <p className="ch-compose-line" role="status">{status}</p>
      <input ref={picker} type="file" className="ch-picker" tabIndex={-1} aria-label={t('phoneSms.compose.pickFile')} onChange={pick} />
      {sendMenu !== null && (
        <PopMenu anchor={{ rect: sendMenu.rect, above: true }} from={sendMenu.from} label={t('phoneSms.compose.sending')} onClose={() => setSendMenu(null)} items={[
          { label: t('phoneSms.compose.laterDots'), icon: 'clock', onSelect: () => setPlanning(true) }
        ]} />
      )}
      {planning && <PlanDialog onClose={() => setPlanning(false)} onPlan={(at) => void send(at)} note={t('phoneArchive.reply.planNote')} />}
    </form>
  );
}

function ArchivedMedia({ ctx, part }: { ctx: PhoneCtx; part: ArchivedPart }) {
  const t = useT();
  const [url, setUrl] = useState<string | null>(null);
  const [asked, setAsked] = useState(false);
  const visual = part.type.startsWith('image/') || part.type.startsWith('video/') || part.type.startsWith('audio/');
  useEffect(() => {
    if (part.file === null || !visual || (!asked && !part.type.startsWith('image/'))) return undefined;
    let alive = true;
    void archivedFileUrl(ctx, part.file, part.type, part.epoch ?? null).then((u) => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [ctx, part.file, part.type, part.epoch, visual, asked]);

  if (part.file === null) {
    const why = part.skipped === 'big' ? t('phoneArchive.media.big') : part.skipped === 'off' ? t('phoneArchive.media.off') : t('phoneArchive.media.notSaved');
    return <span className="ph-media-file">📎 {part.name ?? part.type} ({why})</span>;
  }
  if (!visual) return <span className="ph-media-file">📎 {part.name ?? part.type}</span>;
  if (url === null) {
    return part.type.startsWith('image/')
      ? <span className="ph-media-file">📷 …</span>
      : <button type="button" className="wk-link-btn" onClick={() => setAsked(true)}>{part.type.startsWith('video/') ? t('phoneArchive.media.video') : t('phoneArchive.media.audio')}</button>;
  }
  return part.type.startsWith('image/') ? <img src={url} alt={part.name ?? t('phoneSms.mms.photo')} loading="lazy" />
    : part.type.startsWith('video/') ? <video src={url} controls preload="metadata" />
    : <audio src={url} controls preload="metadata" />;
}
