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
import { contactsOf, ruledNumber, useContactIndex, useLineRules } from './lines';
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
import { shareFile } from './share';
import { daysLabel, SHARE_DAYS, SHARE_MAX, shareLink, sizeText } from './shareSeal';
import { PlanDialog, PlannedRow, SmsHeader, SmsLog, useRoomFrame, type SmsItem } from './smsChat';
import { aheadWhen, around, barStyle, conversationMatches, isMode, SEARCH, timeOf, type SearchMode } from './smsShared';
import './phone.css';

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toLocaleString('pl-PL', { maximumFractionDigits: 1 })} MB`;
const meterStyle = (s: ArchiveSummary) => ({ width: `${Math.min(100, (100 * s.bytes) / Math.max(1, s.limit)).toFixed(1)}%` });

/** Ein Archiv, das ich lese — der Bereich, wie er heisst, wie viel darin ist. */
interface ArchiveOption { readonly areaId: string; readonly name: string; readonly messages: number }

/* Was zuletzt geöffnet war — zurück zur Liste steht sie sofort da. */
const indexSeen = new Map<string, { summary: ArchiveSummary; conversations: ArchivedConversation[] }>();
const conversationSeen = new Map<string, ArchivedMessage[]>();

/** Wie oft Liste und Gespräch nachsehen, ob das Telefon Neues archiviert hat. */
const INDEX_EVERY = 30_000;

export function SmsArchiveView({ who, trail }: { who: Who; trail: readonly string[] }) {
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
        setArchives(found.map((f) => ({ areaId: f.areaId, name: known.find((a) => a.areaId === f.areaId)?.name ?? 'Archiwum', messages: f.messages })));
      } catch (e) {
        if (alive) setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać archiwów.');
      }
    })();
    return () => { alive = false; };
  }, [tick]);

  const areaId = archives === null ? null
    : archives.some((a) => a.areaId === viewText) ? viewText
    : settings.areaId !== null && archives.some((a) => a.areaId === settings.areaId) ? settings.areaId
    : archives[0]?.areaId ?? (native ? settings.areaId : null);

  const [ctx, setCtx] = useState<PhoneCtx | null>(null);
  useEffect(() => {
    if (areaId === null) { setCtx(null); return undefined; }
    let alive = true;
    void openArea(who, areaId).then((c) => { if (alive) setCtx(c); })
      .catch((e: unknown) => { if (alive) setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się otworzyć archiwum.'); });
    return () => { alive = false; };
  }, [who, areaId]);

  const [index, setIndex] = useState(areaId === null ? null : indexSeen.get(areaId) ?? null);
  const reload = useCallback(async (opened: PhoneCtx) => {
    const fresh = await archiveIndex(opened);
    indexSeen.set(opened.areaId, fresh);
    setIndex(fresh);
  }, []);
  useEffect(() => {
    if (ctx === null) return;
    setIndex(indexSeen.get(ctx.areaId) ?? null);
    void reload(ctx).catch((e: unknown) => setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać archiwum.'));
  }, [ctx, reload]);

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
    (c.peers.length === 0 ? 'Bez numeru' : c.peers.map((p) => names.get(p) ?? phoneShown(p)).join(', ')), [names]);

  const step = trail[0];
  const listHref = native ? viewPath('sms', 'archiwum') : viewPath('sms');
  const conversation = step === undefined ? null : index?.conversations.find((c) => c.key === step) ?? null;

  if (step !== undefined) {
    if (ctx === null || index === null) return failed !== null ? <p className="wk-error">{failed}</p> : <Loading label="Otwieranie archiwum…" />;
    if (conversation === null) return <p className="wk-empty">Takiej rozmowy nie ma w archiwum.</p>;
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
  const [modeText, setModeText] = useRemembered('sms.search', 'osoby');
  const mode: SearchMode = isMode(modeText) ? modeText : 'osoby';
  const [query, setQuery] = useState('');
  const [all, setAll] = useState<readonly ArchivedMessage[] | null>(null);
  const [loadingAll, setLoadingAll] = useState<string | null>(null);
  const top = useBarHeight();
  useCrumbs(native ? [{ label: 'Archiwum', href: null }] : []);

  /* Ein anderes Archiv: die Suche im Text beginnt von vorn. */
  useEffect(() => { setAll(null); }, [areaId]);

  const q = query.trim();
  const conversations = index?.conversations ?? [];
  const shown = conversations.filter((c) => conversationMatches(mode, q, titleOf(c), c.peers));

  /* Im Text suchen: einmal alles laden (mit Fortschritt), dann hier durchsuchen. */
  useEffect(() => {
    if (mode !== 'tresc' || q.length < 2 || all !== null || loadingAll !== null || ctx === null) return;
    setLoadingAll('Wczytywanie archiwum…');
    void loadAll(ctx, (done, total) => setLoadingAll(`Wczytywanie archiwum… ${done}/${total}`))
      .then(setAll).catch(() => toast('Nie udało się wczytać archiwum.'))
      .finally(() => setLoadingAll(null));
  }, [mode, q, all, loadingAll, ctx]);

  const hits = useMemo(() => {
    if (mode !== 'tresc' || q.length < 2 || all === null) return null;
    const needle = q.toLocaleLowerCase('pl');
    return all.filter((m) => m.body.toLocaleLowerCase('pl').includes(needle)).slice(-300).reverse();
  }, [mode, q, all]);

  const ownName = settings.areaId === null ? null : areas.find((a) => a.areaId === settings.areaId)?.name ?? null;

  return (
    <div className="ph-threads" style={barStyle(top)}>
      <PageHeader title={native ? 'Archiwum SMS' : 'SMS'} meta={index === null ? undefined
        : `W archiwum: ${index.summary.messages.toLocaleString('pl-PL')} wiadomości · ${mb(index.summary.bytes)} z ${mb(index.summary.limit)}`}
        actions={native ? undefined : <a className="wk-btn wk-btn-quiet" href={viewPath('sms', 'pliki')}><UiIcon name="link" />Pliki przez link</a>} />
      {index !== null && <span className="ph-meter" aria-hidden="true"><span style={meterStyle(index.summary)} /></span>}

      {native && <ArchiveSetup who={who} settings={settings} conversations={conversations} ownName={ownName} onArchived={onArchived} />}

      {archives !== null && archives.length > 1 && (
        <label className="wk-field ph-archive-pick">
          <span>Archiwum</span>
          <select value={areaId ?? ''} onChange={(e) => onView(e.target.value)}>
            {archives.map((a) => (
              <option key={a.areaId} value={a.areaId}>{a.name}{a.areaId === settings.areaId ? ' (to, do którego archiwizuje telefon)' : ''} · {a.messages.toLocaleString('pl-PL')}</option>
            ))}
          </select>
        </label>
      )}

      {failed !== null && <p className="wk-error">{failed}</p>}
      {archives === null && failed === null && <Loading label="Wczytywanie archiwów…" />}
      {archives !== null && archives.length === 0 && !native && (
        <p className="wk-empty">Nie ma jeszcze archiwum SMS. Wiadomości archiwizuje aplikacja SMS na telefonie (wydanie „sms").</p>
      )}

      {ctx !== null && (
        <>
          <div className="ph-bar" role="search">
            <label className="ch-side-search ph-search-pill">
              <Icon name="search" />
              <select value={mode} aria-label="Szukaj w" onChange={(e) => setModeText(e.target.value)}>
                {(Object.keys(SEARCH) as SearchMode[]).map((m) => <option key={m} value={m}>{SEARCH[m].label}</option>)}
              </select>
              <input type="search" value={query} placeholder={SEARCH[mode].placeholder} aria-label={SEARCH[mode].placeholder}
                inputMode={mode === 'numery' ? 'tel' : 'search'} onChange={(e) => setQuery(e.target.value)} />
            </label>
          </div>
          {index === null && <Loading label="Wczytywanie archiwum…" />}
          {loadingAll !== null && <Loading label={loadingAll} lines={1} />}

          {hits !== null ? (
            hits.length === 0 ? <p className="wk-empty">Żadna wiadomość w archiwum tego nie zawiera.</p> : (
              <ul className="ch-list ph-chat-list" aria-label="Znalezione wiadomości">
                {hits.map((m) => {
                  const key = conversationKey(m.peers);
                  const title = titleOf({ peers: m.peers });
                  return (
                    <li key={m.key}>
                      <a className="ch-item" href={conversationHref(key)}>
                        <Avatar seed={key || '?'} name={title} icon={m.peers.length > 1 ? 'users' : /\p{L}/u.test(title) ? undefined : 'user'} />
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
              ? <p className="wk-empty">{conversations.length === 0 ? (native ? 'Archiwum jest jeszcze puste — „Archiwizuj teraz".' : 'Archiwum jest puste.') : 'Nic nie pasuje.'}</p>
              : (
                <ul className="ch-list ph-chat-list">
                  {shown.map((c) => {
                    const title = titleOf(c);
                    return (
                      <li key={c.key}>
                        <a className={cls('ch-item', c.lastBox === 'in' && 'ph-last-in')} href={conversationHref(c.key)}>
                          <Avatar seed={c.key || '?'} name={title} icon={c.peers.length > 1 ? 'users' : /\p{L}/u.test(title) ? undefined : 'user'} />
                          <span className="ch-item-main">
                            <span className="ch-item-top">
                              <strong className="ch-item-title">{title}</strong>
                              {c.last > 0 && <time className="ch-item-time">{listTime(new Date(c.last).toISOString())}</time>}
                            </span>
                            <span className="ch-item-bottom">
                              <span className="ch-item-sub">{c.lastBox === 'in' ? '' : 'Ty: '}{c.lastBody !== '' ? c.lastBody : c.lastMedia ? '📷 MMS' : ''}</span>
                              <span className="ph-item-count" title="Wiadomości w archiwum">{c.count.toLocaleString('pl-PL')}</span>
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
          .map((r) => ({ id: r.id, name: names.get(r.id) ?? (r.id === self ? 'Ty' : 'Rola'), person: r.id === self }))
          .sort((a, b) => Number(b.person) - Number(a.person) || a.name.localeCompare(b.name, 'pl'));
        if (alive) setRoles(out);
      } catch {
        if (alive) setRoles([]);
      }
    })();
    return () => { alive = false; };
  }, [who]);
  return roles;
}

function ArchiveSetup({ who, settings, conversations, ownName, onArchived }: {
  who: Who;
  settings: ArchiveSettings;
  conversations: readonly ArchivedConversation[];
  ownName: string | null;
  onArchived: () => void;
}) {
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
      title: `Archiwum SMS ma należeć do: ${role?.name ?? 'tej roli'}?`,
      body: 'Kto ma tę rolę — także ten, komu ją kiedyś przekażesz — czyta archiwum, również w przeglądarce. Od teraz telefon archiwizuje tam; dotychczasowe archiwum zostaje, gdzie jest, i dalej można je czytać.',
      confirm: 'Zmień'
    });
    if (!yes) return;
    setBusy(true);
    try {
      await archiveArea(who, { ...settings, roleId: next, areaId: settings.areas[next] ?? null });
      toast('Archiwum należy teraz do wybranej roli. „Archiwizuj teraz" przeniesie tam wiadomości.');
      onArchived();
    } catch (e) {
      toast(e instanceof WorkspaceError || e instanceof Error ? e.message : 'Nie udało się.');
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
      toast(done.added === 0 ? 'Archiwum jest aktualne.' : `Dodano do archiwum: ${done.added}.`);
      onArchived();
      refresh();
    } catch (e) {
      toast(e instanceof WorkspaceError || e instanceof Error ? e.message : 'Nie udało się zarchiwizować.');
    } finally {
      setRunning(false);
    }
  };

  const threadTitle = (t: NativeThread) => (t.addresses.length === 0 ? 'Bez numeru' : t.addresses.map((a, i) => t.names?.[i] ?? phoneShown(a)).join(', '));

  return (
    <section className="ph-archive-state" aria-label="Archiwizowanie">
      {status !== null && !status.smsRead && (
        <div className="ph-setup">
          <p>
            <strong>Ta aplikacja nie może jeszcze czytać SMS na tym telefonie.</strong> Na starym telefonie, z którego chcesz tylko przenieść
            historię, nie musi być aplikacją SMS — wystarczy pozwolić jej czytać wiadomości.
          </p>
          <div className="wk-actions">
            <button type="button" className="wk-btn" onClick={() => void Phone.requestSmsRead().then(refresh)}>Pozwól czytać SMS</button>
          </div>
        </div>
      )}

      <label className="wk-field">
        <span>Archiwum należy do</span>
        <select value={roleId} disabled={roles === null || busy || running} onChange={(e) => void chooseRole(e.target.value)}>
          {(roles ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}{r.person ? ' (prywatnie)' : ''}</option>)}
        </select>
      </label>
      <p>
        Kto ma tę rolę, czyta archiwum — także w przeglądarce. Każdy telefon z tą aplikacją (np. stary) archiwizuje do tego samego miejsca;
        te same wiadomości z dwóch telefonów zapisują się raz.{ownName !== null ? ` Obszar: „${ownName}".` : ''}
      </p>

      <div className="wk-field" role="radiogroup" aria-label="Które rozmowy">
        <label className="wk-check"><input type="radio" checked={settings.mode === 'all'} onChange={() => setChoice({ mode: 'all' })} /><span>Wszystkie rozmowy (także nowe)</span></label>
        <label className="wk-check"><input type="radio" checked={settings.mode === 'chosen'} onChange={() => { setChoice({ mode: 'chosen' }); setListOpen(true); }} /><span>Tylko wybrane</span></label>
      </div>

      {settings.mode === 'chosen' && (
        <div className="ph-choose">
          <button type="button" className="wk-link-btn" onClick={() => setListOpen(!listOpen)}>
            {listOpen ? 'Zwiń listę' : `Wybrane rozmowy: ${settings.chosen.length}`}
          </button>
          {listOpen && threads !== null && (
            <>
              <div className="wk-actions">
                <button type="button" className="wk-link-btn" onClick={() => setChoice({ chosen: [...new Set([...settings.chosen, ...threads.map((t) => conversationKey(t.addresses))])] })}>Zaznacz wszystkie</button>
                <button type="button" className="wk-link-btn" onClick={() => setChoice({ chosen: [] })}>Odznacz wszystkie</button>
              </div>
              <ul className="ph-choose-list">
                {threads.map((t) => {
                  const key = conversationKey(t.addresses);
                  const inArchive = archived.get(key) ?? 0;
                  return (
                    <li key={t.threadId}>
                      <label className="wk-check">
                        <input type="checkbox" checked={chosen.has(key)} onChange={(e) => toggle(key, e.target.checked)} />
                        <span className="ph-choose-text">
                          <span className="ph-row-name">{threadTitle(t)}</span>
                          <small>{t.count} na telefonie{inArchive > 0 ? ` · ${inArchive} w archiwum` : ''}</small>
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
        <span>Ze zdjęciami i filmami z MMS (do 10 MB każde)</span>
      </label>

      <OwnLines />
      <p>
        Każda wybrana rozmowa trafia do archiwum cała — wszystkie wiadomości, które są na telefonie.
        {settings.areaId === null
          ? ' Archiwum nie jest jeszcze włączone: wybierz rolę i rozmowy, potem „Archiwizuj teraz" — od tego momentu nowe wiadomości dochodzą same.'
          : ' Nowe dochodzą same: chwilę po przyjściu albo wysłaniu i dwa razy na dobę.'}
      </p>
      <div className="wk-actions">
        <button type="button" className="wk-btn" disabled={running || status?.smsRead === false} onClick={() => void run(false)}>
          <UiIcon name="archive" />{running ? 'Archiwizowanie…' : 'Archiwizuj teraz'}
        </button>
        <button type="button" className="wk-btn wk-btn-quiet" disabled={running || status?.smsRead === false} onClick={() => void run(true)}>Sprawdź wszystko od początku</button>
      </div>
      {progress !== null && (
        <p aria-live="polite">
          Rozmowy {progress.conversations}/{progress.of} · przejrzano {progress.seen} · nowych {progress.added} · już w archiwum {progress.known}
          {progress.media > 0 ? ` · plików ${progress.media}` : ''}{progress.done ? ' — gotowe.' : '…'}
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
function outboxMeta(entry: OutboxEntry): { text: string; future: boolean } {
  const m = entry.message;
  const at = m?.sendAt ?? 0;
  const future = m !== null && m.sendAt !== null && at > Date.now();
  const device = entry.device !== null ? ` (${entry.device})` : '';
  const text = entry.state === 'waiting' ? (future ? `Zaplanowana · ${aheadWhen(at)} · czeka na telefon` : 'Czeka na telefon…')
    : entry.state === 'taken' ? (future ? `Zaplanowana · ${aheadWhen(at)} · telefon ją ma${device}` : `Telefon wysyła${device}…`)
    : entry.state === 'sent' ? `Wysłano z telefonu${device}${entry.doneAt !== null ? ` · ${timeOf(Date.parse(entry.doneAt))}` : ''}`
    : entry.state === 'failed' ? `Nie wysłano${entry.error !== null ? ` · ${entry.error}` : ''}`
    : 'Odwołana — telefon jeszcze tego nie potwierdził';
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
  useRoomFrame();
  useCrumbs(native ? [{ label: 'Archiwum', href: back }] : []);

  useEffect(() => {
    let alive = true;
    void loadConversation(ctx, conversation)
      .then((found) => { conversationSeen.set(seenKey, found); if (alive) { setMessages(found); setFailed(null); } })
      .catch(() => { if (alive) setFailed('Nie udało się wczytać rozmowy.'); });
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

  const items: SmsItem[] = useMemo(() => shown.map((m) => ({
    key: m.key,
    mine: m.box !== 'in',
    at: m.at,
    body: m.body,
    subject: m.subject,
    author: group && m.box === 'in' && m.from !== null ? names.get(m.from) ?? phoneShown(m.from) : null,
    authorSeed: m.from ?? undefined,
    state: m.box === 'failed' ? 'failed' as const : null,
    media: m.parts.length > 0 ? m.parts.map((p, j) => <ArchivedMedia key={j} ctx={ctx} part={p} />) : undefined
  })), [shown, group, names, ctx]);

  const cancel = async (entry: OutboxEntry) => {
    if (!await ask({ title: 'Odwołać tę wiadomość?', body: 'Telefon jej nie wyśle — chyba że już to zrobił.', confirm: 'Odwołaj', danger: true })) return;
    try {
      await cancelReply(ctx, entry.id);
    } catch (e) {
      toast(e instanceof WorkspaceError ? e.message : 'Nie udało się odwołać.');
    }
    reloadOutbox();
  };
  const retry = async (entry: OutboxEntry) => {
    if (entry.message === null) return;
    try {
      await queueReply(ctx, { to: entry.message.to, body: entry.message.body, line: entry.message.line, sendAt: null, conversation: entry.message.conversation });
      toast('Przekazano telefonowi jeszcze raz.');
    } catch (e) {
      toast(e instanceof WorkspaceError ? e.message : 'Nie udało się.');
    }
    reloadOutbox();
  };

  const tail = pending.length === 0 ? undefined : pending.map((entry) => {
    const meta = outboxMeta(entry);
    const failedHere = entry.state === 'failed';
    return (
      <PlannedRow key={entry.id} text={entry.message?.body ?? ''} meta={meta.text} failed={failedHere}
        tools={entry.state === 'waiting' || (entry.state === 'taken' && meta.future)
          ? <button type="button" className="wk-link-btn wk-danger-link" onClick={() => void cancel(entry)}>Odwołaj</button>
          : failedHere ? <button type="button" className="wk-link-btn" onClick={() => void retry(entry)}>Wyślij ponownie</button>
          : undefined} />
    );
  });

  const from = messages !== null && messages.length > 0 ? messages[0].at : conversation.first;
  const replying = !native && mayWrite && conversation.peers.length === 1;
  const ruleText = rule === null ? '' : rule.why === 'thread' ? ' — wybrany dla tej rozmowy' : ` — grupa „${rule.group ?? ''}”`;
  const lineItems: MenuItem[] = [
    ...options.map((l) => ({
      label: `${phoneShown(l)}${l === rule?.number ? ruleText : l === conversation.lastLine ? ' — ta rozmowa' : ''}`,
      icon: 'phone' as const, checked: line === l, onSelect: () => setThreadRule(conversation.peers, l)
    })),
    { label: 'Inny numer…', icon: 'edit', onSelect: () => setAskingLine(true) },
    ...(rule?.why === 'thread' ? [{ label: 'Jak dotąd: według grupy i ostatniej wiadomości', icon: 'refresh' as const, onSelect: () => setThreadRule(conversation.peers, null) }] : [])
  ];
  const sub = (
    <>
      {replying && (
        <>
          <button type="button" className="ch-chip ph-line-chip" aria-haspopup="menu" aria-expanded={lineMenu.open !== null}
            title="Z którego numeru telefon wyśle odpowiedź" onClick={(e) => lineMenu.toggle(e.currentTarget)}>
            <Icon name="phone" />{line === '' ? 'wybierz numer' : phoneShown(line)}<Icon name="down" />
          </button>
          {lineMenu.open !== null && (
            <PopMenu anchor={{ rect: lineMenu.open.rect }} from={lineMenu.open.from} label="Z którego numeru" items={lineItems} onClose={lineMenu.close}>
              <p className="ch-pop-head">Telefon z tym numerem wyśle odpowiedź — wybór zostaje dla tej rozmowy, także na telefonie</p>
            </PopMenu>
          )}
        </>
      )}
      <span className="ph-head-numbers">{messages === null ? conversation.count : messages.length} w archiwum{from > 0 ? ` · od ${new Date(from).toLocaleDateString('pl-PL')}` : ''}</span>
    </>
  );

  return (
    <div className="ch-room ph-room" style={barStyle(top)}>
      <SmsHeader back={back} title={title} seed={conversation.key || '?'} group={group} sub={sub} menu={[]} search={search} onSearch={setSearch} />
      <SmsLog items={messages === null ? null : items} failed={failed} title={title} group={group} search={search} follow={follow}
        more={more} onEarlier={earlier} tail={tail} empty="W archiwum nie ma jeszcze wiadomości tej rozmowy."
        place={`archive:${ctx.areaId}:${conversation.key}`} firstNew={null} />
      {!native && (
        <ReplyBox who={who} ctx={ctx} conversation={conversation} line={line} mayWrite={mayWrite}
          onQueued={() => { setFollow((n) => n + 1); reloadOutbox(); }} />
      )}
      {askingLine && (
        <OtherLine value={ownText} onClose={() => setAskingLine(false)}
          onSave={(value) => { setOwnText(value); setThreadRule(conversation.peers, phoneKey(value)); setAskingLine(false); }} />
      )}
    </div>
  );
}

/** Ein anderer eigener Numer — den das Archiv noch nicht kennt. */
function OtherLine({ value, onSave, onClose }: { value: string; onSave: (value: string) => void; onClose: () => void }) {
  const [text, setText] = useState(value);
  return (
    <Modal title="Z którego numeru?" onClose={onClose}>
      <label className="wk-field">
        <span>Twój numer — wyśle telefon, który go ma</span>
        <input type="tel" value={text} placeholder="+48 600 100 200" autoFocus onChange={(e) => setText(e.target.value)} />
      </label>
      <div className="wk-actions">
        <button type="button" className="wk-btn" disabled={phoneKey(text) === ''} onClick={() => onSave(text)}>Ustaw</button>
        <button type="button" className="wk-link-btn" onClick={onClose}>Anuluj</button>
      </div>
    </Modal>
  );
}

/**
 * DIE ANTWORT AUS DEM BROWSER — wie das Feld des Chats: 📎 (eine Datei geht als Link mit),
 * die Lasche für „Wyślij później", Senden. An die eine Person der Rozmowa, von der Nummer
 * im Kopf; nur das Telefon mit dieser Nummer nimmt sie (FCM weckt es, sonst spätestens in
 * einer Viertelstunde).
 */
function ReplyBox({ who, ctx, conversation, line, mayWrite, onQueued }: {
  who: Who; ctx: PhoneCtx; conversation: ArchivedConversation; line: string; mayWrite: boolean; onQueued: () => void;
}) {
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

  if (!mayWrite) return <p className="ch-compose is-readonly">To archiwum możesz czytać; odpowiadać mogą ci, którzy mogą w nim pisać.</p>;
  if (conversation.peers.length !== 1) return <p className="ch-compose is-readonly">Z przeglądarki można odpowiadać w rozmowach z jedną osobą.</p>;

  const content = text.trim() !== '' || file !== null;
  const withLink = (link: string) => (text.trim() === '' ? link : `${text.trimEnd()}\n${link}`);
  const count = smsParts(file === null ? text : withLink(shareLink('x'.repeat(22))));
  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const chosen = e.target.files?.[0];
    e.target.value = '';
    if (chosen === undefined) return;
    if (chosen.size > SHARE_MAX) { toast('Plik może mieć najwyżej 25 MB.'); return; }
    uploaded.current = null;
    setFile(chosen);
  };
  const send = async (at: number | null) => {
    if (line === '') { toast('Wybierz w nagłówku numer, z którego telefon ma wysłać.'); return; }
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
      toast(at === null ? 'Przekazano telefonowi — wyśle, gdy tylko się zgłosi.' : `Telefon wyśle ją: ${aheadWhen(at)}.`);
      onQueued();
    } catch (e) {
      toast(e instanceof WorkspaceError ? e.message : 'Nie udało się przekazać wiadomości telefonowi.');
    } finally {
      setBusy(false);
    }
  };

  const status = busy && progress !== null ? `Wysyłanie pliku… ${Math.round(progress * 100)}%`
    : line === '' ? 'Wybierz w nagłówku numer, z którego telefon ma wysłać.'
    : `${text !== '' || file !== null ? `${count.parts > 1 ? `${count.parts} SMS · ` : ''}zostało ${count.left}${file !== null ? ' · z linkiem' : ''} · ` : ''}wyśle telefon z numerem ${phoneShown(line)}`;

  return (
    <form className="ch-compose ph-compose ph-reply" onSubmit={(e) => { e.preventDefault(); void send(null); }}>
      {file !== null && (
        <div className="ch-files">
          <span className="ch-file-chip">
            <span className="ch-file-ic"><Icon name="file" /></span>
            <span className="ch-file-text"><span className="ch-file-name">{file.name}</span><small>{sizeText(file.size)} · link, pełna jakość</small></span>
            <button type="button" className="ch-icon-btn is-small" aria-label={`Usuń załącznik ${file.name}`} disabled={busy}
              onClick={() => { setFile(null); uploaded.current = null; }}><Icon name="x" /></button>
          </span>
          <select aria-label="Jak długo działa link" value={days} disabled={busy} onChange={(e) => setDaysText(e.target.value)}>
            {SHARE_DAYS.map((d) => <option key={d} value={d}>ważny {daysLabel(d)}</option>)}
          </select>
        </div>
      )}
      <div className="ch-compose-row">
        <div className="ch-field">
          <textarea rows={1} value={text} placeholder="Odpowiedź — SMS wyśle telefon" aria-label="Treść odpowiedzi" onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(null); } }} />
          <button type="button" className="ch-icon-btn" aria-label="Dołącz plik (pójdzie jako link)" title="Dołącz plik (pójdzie jako link)" disabled={busy}
            onClick={() => picker.current?.click()}>
            <Icon name="clip" />
          </button>
        </div>
        {content && (
          <button type="button" className="ch-send-more" aria-label="Wyślij później" title="Wyślij później" aria-haspopup="menu" aria-expanded={sendMenu !== null}
            disabled={busy} onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => { const el = e.currentTarget; setSendMenu(sendMenu === null ? { rect: el.getBoundingClientRect(), from: el } : null); }}>
            <Icon name="chevron" />
          </button>
        )}
        <button type="submit" className="ch-send" aria-label="Wyślij" title="Wyślij" disabled={busy || !content || line === ''} onMouseDown={(e) => e.preventDefault()}>
          <Icon name="send" />
        </button>
      </div>
      {progress !== null && <progress className="ph-progress" value={progress} max={1} aria-label="Przesyłanie pliku" />}
      <p className="ch-compose-line" role="status">{status}</p>
      <input ref={picker} type="file" className="ch-picker" tabIndex={-1} aria-label="Wybierz plik" onChange={pick} />
      {sendMenu !== null && (
        <PopMenu anchor={{ rect: sendMenu.rect, above: true }} from={sendMenu.from} label="Wysyłanie" onClose={() => setSendMenu(null)} items={[
          { label: 'Wyślij później…', icon: 'clock', onSelect: () => setPlanning(true) }
        ]} />
      )}
      {planning && <PlanDialog onClose={() => setPlanning(false)} onPlan={(at) => void send(at)} note="Telefon z tym numerem wyśle ją o tej porze." />}
    </form>
  );
}

function ArchivedMedia({ ctx, part }: { ctx: PhoneCtx; part: ArchivedPart }) {
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
    const why = part.skipped === 'big' ? 'za duży' : part.skipped === 'off' ? 'bez plików' : 'nie zapisano';
    return <span className="ph-media-file">📎 {part.name ?? part.type} ({why})</span>;
  }
  if (!visual) return <span className="ph-media-file">📎 {part.name ?? part.type}</span>;
  if (url === null) {
    return part.type.startsWith('image/')
      ? <span className="ph-media-file">📷 …</span>
      : <button type="button" className="wk-link-btn" onClick={() => setAsked(true)}>{part.type.startsWith('video/') ? '🎞 Pokaż film' : '🔊 Odtwórz'}</button>;
  }
  return part.type.startsWith('image/') ? <img src={url} alt={part.name ?? 'Zdjęcie'} loading="lazy" />
    : part.type.startsWith('video/') ? <video src={url} controls preload="metadata" />
    : <audio src={url} controls preload="metadata" />;
}
