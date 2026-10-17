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
 */

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { useCrumbs } from '../shell/crumbTrail';
import { viewPath } from '../routes';
import { loadAreas, type AreaRow } from '../areas/area';
import { useRemembered } from '../core/prefs';
import { keysFor } from '../core/ringOf';
import { WorkspaceError, type Who } from '../core/session';
import { myRoleNames } from '../roles/roleNames';
import { selfOf } from '../roles/roles';
import { ask, toast } from '../ui/dialogs';
import { Icon } from '../ui/icons';
import { Loading } from '../ui/Loading';
import { PageHeader } from '../ui/PageHeader';
import { useBarHeight } from '../ui/useBarHeight';
import { ARCHIVE_PREF, archiveArea, readSettings, saveSettings, type ArchiveSettings } from './archiveSettings';
import { loadContacts, nameIndex } from './contactStore';
import { Phone, phoneHere, pluginSource, type NativeThread, type PhoneStatus } from './native';
import { phoneKey, phoneShown } from './numbers';
import { archiveNow, archiveRunning, MEDIA_PREF } from './phoneJobs';
import { openArea, openPhone, type PhoneCtx } from './phoneContext';
import {
  archivedFileUrl, archiveIndex, conversationKey, loadAll, loadConversation, readableArchives,
  type ArchivedConversation, type ArchivedMessage, type ArchivedPart, type ArchiveProgress, type ArchiveSummary
} from './smsArchive';
import { around, Avatar, barStyle, conversationMatches, dayLabel, isMode, SEARCH, shortWhen, timeOf, type SearchMode } from './smsShared';
import './phone.css';

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toLocaleString('pl-PL', { maximumFractionDigits: 1 })} MB`;
const meterStyle = (s: ArchiveSummary) => ({ width: `${Math.min(100, (100 * s.bytes) / Math.max(1, s.limit)).toFixed(1)}%` });

/** Ein Archiv, das ich lese — der Bereich, wie er heisst, wie viel darin ist. */
interface ArchiveOption { readonly areaId: string; readonly name: string; readonly messages: number }

/* Was zuletzt geöffnet war — zurück zur Liste steht sie sofort da. */
const indexSeen = new Map<string, { summary: ArchiveSummary; conversations: ArchivedConversation[] }>();
const conversationSeen = new Map<string, ArchivedMessage[]>();

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

  const names = useNames(who, native, index?.conversations ?? []);
  const titleOf = useCallback((c: { readonly peers: readonly string[] }) =>
    (c.peers.length === 0 ? 'Bez numeru' : c.peers.map((p) => names.get(p) ?? phoneShown(p)).join(', ')), [names]);

  const step = trail[0];
  const listHref = native ? viewPath('sms', 'archiwum') : viewPath('sms');
  const conversation = step === undefined ? null : index?.conversations.find((c) => c.key === step) ?? null;

  if (step !== undefined) {
    if (ctx === null || index === null) return failed !== null ? <p className="wk-error">{failed}</p> : <Loading label="Otwieranie archiwum…" />;
    if (conversation === null) return <p className="wk-empty">Takiej rozmowy nie ma w archiwum.</p>;
    return <ArchiveConversation ctx={ctx} conversation={conversation} title={titleOf(conversation)} names={names} back={listHref} native={native} />;
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
        for (const [k, c] of nameIndex(await loadContacts(await openPhone(who)))) out.set(k, c.name);
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
        : `W archiwum: ${index.summary.messages.toLocaleString('pl-PL')} wiadomości · ${mb(index.summary.bytes)} z ${mb(index.summary.limit)}`} />
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
            <select value={mode} aria-label="Szukaj w" onChange={(e) => setModeText(e.target.value)}>
              {(Object.keys(SEARCH) as SearchMode[]).map((m) => <option key={m} value={m}>{SEARCH[m].label}</option>)}
            </select>
            <input type="search" value={query} placeholder={SEARCH[mode].placeholder} aria-label={SEARCH[mode].placeholder}
              inputMode={mode === 'numery' ? 'tel' : 'search'} onChange={(e) => setQuery(e.target.value)} />
          </div>
          {index === null && <Loading label="Wczytywanie archiwum…" />}
          {loadingAll !== null && <Loading label={loadingAll} lines={1} />}

          {hits !== null ? (
            hits.length === 0 ? <p className="wk-empty">Żadna wiadomość w archiwum tego nie zawiera.</p> : (
              <ul className="ph-list" aria-label="Znalezione wiadomości">
                {hits.map((m) => {
                  const key = conversationKey(m.peers);
                  const title = titleOf({ peers: m.peers });
                  return (
                    <li key={m.key}>
                      <a className="ph-row" href={conversationHref(key)}>
                        <Avatar name={m.peers.length > 1 ? '#' : title} seed={key} />
                        <span className="ph-row-text">
                          <span className="ph-row-name">{title}</span>
                          <span className="ph-row-snippet">{around(m.body, q)}</span>
                        </span>
                        <span className="ph-row-end">{shortWhen(m.at)}</span>
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
                <ul className="ph-list">
                  {shown.map((c) => {
                    const title = titleOf(c);
                    return (
                      <li key={c.key}>
                        <a className="ph-row" href={conversationHref(c.key)}>
                          <Avatar name={c.peers.length > 1 ? '#' : title} seed={c.key || '?'} />
                          <span className="ph-row-text">
                            <span className="ph-row-name">{title}</span>
                            <span className="ph-row-snippet">{c.lastBody !== '' ? c.lastBody : c.lastMedia ? '📷 MMS' : ''}</span>
                          </span>
                          <span className="ph-row-end">
                            <span>{c.last > 0 ? shortWhen(c.last) : ''}</span>
                            <span>{c.count.toLocaleString('pl-PL')}</span>
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
      <p>
        Każda wybrana rozmowa trafia do archiwum cała — wszystkie wiadomości, które są na telefonie.
        {settings.areaId === null
          ? ' Archiwum nie jest jeszcze włączone: wybierz rolę i rozmowy, potem „Archiwizuj teraz" — od tego momentu nowe wiadomości dochodzą same.'
          : ' Nowe dochodzą same: chwilę po przyjściu albo wysłaniu i dwa razy na dobę.'}
      </p>
      <div className="wk-actions">
        <button type="button" className="wk-btn" disabled={running || status?.smsRead === false} onClick={() => void run(false)}>
          <Icon name="archive" />{running ? 'Archiwizowanie…' : 'Archiwizuj teraz'}
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

function ArchiveConversation({ ctx, conversation, title, names, back, native }: {
  ctx: PhoneCtx; conversation: ArchivedConversation; title: string; names: ReadonlyMap<string, string>; back: string; native: boolean;
}) {
  const seenKey = `${ctx.areaId}:${conversation.key}:${conversation.batches.length}`;
  const [messages, setMessages] = useState<readonly ArchivedMessage[] | null>(conversationSeen.get(seenKey) ?? null);
  const [count, setCount] = useState(STEP);
  const [failed, setFailed] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);
  const anchor = useRef<number | null>(null);
  const top = useBarHeight();
  useCrumbs(native ? [{ label: 'Archiwum', href: back }] : []);

  useEffect(() => {
    let alive = true;
    void loadConversation(ctx, conversation)
      .then((found) => { conversationSeen.set(seenKey, found); if (alive) setMessages(found); })
      .catch(() => { if (alive) setFailed('Nie udało się wczytać rozmowy.'); });
    return () => { alive = false; };
  }, [ctx, conversation, seenKey]);

  const shown = messages === null ? [] : messages.slice(Math.max(0, messages.length - count));
  const more = messages !== null && count < messages.length;

  /* Beim Öffnen unten; nach „Wcześniejsze" an derselben Nachricht. */
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el === null) return;
    if (anchor.current !== null) {
      el.scrollTop += el.scrollHeight - anchor.current;
      anchor.current = null;
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, count]);

  const earlier = () => {
    const el = scroller.current;
    if (el !== null) anchor.current = el.scrollHeight;
    setCount(count + STEP);
  };

  const from = messages !== null && messages.length > 0 ? messages[0].at : conversation.first;
  return (
    <div className="ph-thread" style={barStyle(top)}>
      <header className="ph-thread-head">
        <a className="wk-icon-btn" href={back} aria-label="Wszystkie rozmowy w archiwum" title="Wszystkie rozmowy w archiwum"><Icon name="back" /></a>
        <Avatar name={conversation.peers.length > 1 ? '#' : title} seed={conversation.key || '?'} />
        <span className="ph-thread-title">
          <h1 className="ph-thread-name">{title}</h1>
          <span className="ph-thread-sub">
            {messages === null ? conversation.count : messages.length} wiadomości w archiwum{from > 0 ? ` · od ${new Date(from).toLocaleDateString('pl-PL')}` : ''}
          </span>
        </span>
      </header>
      <div className="ph-scroll" ref={scroller} onScroll={() => { const el = scroller.current; if (el !== null && el.scrollTop < 120 && more) earlier(); }}>
        <div className="ph-scroll-inner">
          {failed !== null && <p className="wk-error">{failed}</p>}
          {messages === null && failed === null && <Loading label="Wczytywanie rozmowy…" />}
          {more && <button type="button" className="wk-btn wk-btn-quiet ph-more" onClick={earlier}>Wcześniejsze wiadomości</button>}
          {shown.map((m, i) => {
            const before = shown[i - 1];
            const newDay = before === undefined || new Date(before.at).toDateString() !== new Date(m.at).toDateString();
            const incoming = m.box === 'in';
            return (
              <Fragment key={m.key}>
                {newDay && <span className="ph-day">{dayLabel(m.at)}</span>}
                <div className={`ph-msg ${incoming ? 'is-in' : 'is-out'}${m.box === 'failed' ? ' is-failed' : ''}`}>
                  {conversation.peers.length > 1 && incoming && m.from !== null && <span className="ph-msg-from">{names.get(m.from) ?? phoneShown(m.from)}</span>}
                  {m.subject !== null && <span className="ph-msg-subject">{m.subject}</span>}
                  {m.parts.length > 0 && <div className="ph-media">{m.parts.map((p, j) => <ArchivedMedia key={j} ctx={ctx} part={p} />)}</div>}
                  {m.body !== '' && <span>{m.body}</span>}
                  <span className={`ph-msg-meta${m.box === 'failed' ? ' is-failed' : ''}`}>{m.box === 'failed' ? 'Nie wysłano · ' : ''}{timeOf(m.at)}</span>
                </div>
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
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
