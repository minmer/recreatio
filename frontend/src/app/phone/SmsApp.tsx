/**
 * SMS (Ausgabe „sms" der App, 2026-10-17) — die SMS-App des Telefons, neben
 * den Rozmowy und nicht in ihnen: andere Menschen, ein anderes Netz, kein
 * Schlüssel. Auf dem Telefon kommen die Nachrichten aus seinem Speicher; im
 * Browser (und unter „Archiwum") aus dem versiegelten Archiv.
 *
 * <code>
 *   #/workspace/sms                 die Gespräche (Browser: das Archiv)
 *   #/workspace/sms/<gespräch>      ein Gespräch, mit dem Schreibfeld
 *   #/workspace/sms/nowa?do=&tekst= eine neue Nachricht — auch aus „Napisz SMS"
 *   #/workspace/sms/archiwum        das Archiv: wie viel, „Archiwizuj teraz", lesen
 *   #/workspace/sms/pliki           Pliki przez link (0117)
 *   #/workspace/sms/numery          die eigenen Nummern und Gruppen mit eigener Nummer
 * </code>
 *
 * 2026-10-19 — AUSSEHEN WIE DIE ROZMOWY (`smsChat.tsx`): Liste, Kopf, Blasen und Feld
 * mit den Bausteinen des Chats. Im Kopf neben dem Namen die eigene Nummer, von der
 * geschrieben wird (`lines.ts`), und ob das Gespräch ins Archiv geht; im Menü ⋮
 * wyciszyć, zablokować (Spam), usunąć, der Kontakt.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Avatar, cls, Icon, listTime, PopMenu, useButtonMenu, type MenuItem } from '../chat/ChatKit';
import { useCrumbs } from '../shell/crumbTrail';
import { viewPath } from '../routes';
import { useRemembered } from '../core/prefs';
import type { Who } from '../core/session';
import { ask, toast } from '../ui/dialogs';
import { Loading } from '../ui/Loading';
import { Modal } from '../ui/Modal';
import { PageHeader } from '../ui/PageHeader';
import { useBarHeight } from '../ui/useBarHeight';
import { ARCHIVE_PREF, readSettings, saveSettings, type ArchiveSettings } from './archiveSettings';
import { Composer } from './Composer';
import { contactMatches, type Contact } from './contactStore';
import { chooseLine, contactsOf, lineKeyOf, lineName, useContactIndex, useLineRules, usePhoneLines } from './lines';
import { LinesView } from './LinesView';
import { Phone, phoneHere, pluginSource, type NativeMessage, type NativePart, type NativeThread, type PhoneStatus, type ScheduledEntry, type ThreadPage } from './native';
import { phoneKey, phoneShown } from './numbers';
import { openArea } from './phoneContext';
import { archiveNow } from './phoneJobs';
import { SharesView } from './Shares';
import { conversationKey, dropConversation } from './smsArchive';
import { SmsArchiveView } from './SmsArchiveView';
import { ArchiveMark, BlockDialog, LineChip, MuteDialog, PlannedRow, SmsHeader, SmsLog, useRoomFrame, type SmsItem } from './smsChat';
import { aheadWhen, around, barStyle, conversationMatches, isMode, SEARCH, type SearchMode } from './smsShared';
import './phone.css';

export function SmsApp({ who, trail }: { who: Who; trail: readonly string[] }) {
  const step = trail[0];
  /* Pliki przez link (0117) — auf dem Telefon und im Browser. */
  if (step === 'pliki') return <SharesView who={who} />;
  if (!phoneHere()) return <SmsArchiveView who={who} trail={trail} />;
  if (step === undefined) return <Threads who={who} />;
  if (step === 'nowa') return <Compose who={who} />;
  if (step === 'numery') return <LinesView who={who} />;
  if (step === 'archiwum') return <SmsArchiveView who={who} trail={trail.slice(1)} />;
  return <Thread key={step} threadId={step} who={who} />;
}

export default SmsApp;

/* -- Was alle brauchen ------------------------------------------------------------------------- */

/** Wie die Nummern im Adressbuch des Telefons heissen (dort stehen auch die Kontakte aus recreatio). */
function useNames(numbers: readonly string[]): ReadonlyMap<string, string> {
  const [names, setNames] = useState<ReadonlyMap<string, string>>(new Map());
  const key = [...new Set(numbers)].sort().join('|');
  useEffect(() => {
    if (key === '') return undefined;
    let alive = true;
    void Phone.lookup({ numbers: key.split('|') })
      .then(({ names: found }) => { if (alive) setNames(new Map(Object.entries(found))); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [key]);
  return names;
}

const nameOf = (names: ReadonlyMap<string, string>, address: string): string => names.get(address) ?? phoneShown(address);

/** Der Stand des Telefons — und neu gefragt, wenn sich etwas tut. */
function useStatus(): [PhoneStatus | null, () => void] {
  const [status, setStatus] = useState<PhoneStatus | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    void Phone.status().then((s) => { if (alive) setStatus(s); }).catch(() => undefined);
    return () => { alive = false; };
  }, [tick]);
  return [status, useCallback(() => setTick((n) => n + 1), [])];
}

/** `smsChanged` vom Telefon — etwas kam an oder ging hinaus. */
function useChanged(on: (threadId: string | null) => void): void {
  const keep = useRef(on);
  keep.current = on;
  useEffect(() => {
    let handle: { remove: () => Promise<void> } | null = null;
    let alive = true;
    void Phone.addListener('smsChanged', (e) => keep.current(e.threadId)).then((h) => {
      if (alive) handle = h; else void h.remove();
    });
    const back = () => { if (document.visibilityState === 'visible') keep.current(null); };
    document.addEventListener('visibilitychange', back);
    return () => {
      alive = false;
      void handle?.remove();
      document.removeEventListener('visibilitychange', back);
    };
  }, []);
}

/** Welche Gespräche still sind — {Gespräch: Ende}. */
function useMutes(): [Readonly<Record<string, number>>, () => void] {
  const [muted, setMuted] = useState<Readonly<Record<string, number>>>({});
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    void Phone.mutes().then((r) => { if (alive) setMuted(r.muted); }).catch(() => undefined);
    return () => { alive = false; };
  }, [tick]);
  return [muted, useCallback(() => setTick((n) => n + 1), [])];
}

/** Die Einstellungen des Archivs (am Konto). */
function useArchive(): ArchiveSettings {
  const [text] = useRemembered(ARCHIVE_PREF, '');
  return useMemo(() => readSettings(text), [text]);
}

const archivedIn = (settings: ArchiveSettings, key: string): boolean =>
  settings.areaId !== null && (settings.mode === 'all' || settings.chosen.includes(key));

/**
 * Was noch fehlt, damit SMS hier ankommen: die SMS-App sein, Kontakte lesen dürfen — und
 * Google Messages ohne Czat (RCS): wer dort RCS hatte, dessen Nummer ist bei Google noch
 * angemeldet, und Nachrichten anderer RCS-Nutzer gehen dorthin statt als SMS hierher.
 */
function Setup({ status, onChanged }: { status: PhoneStatus; onChanged: () => void }) {
  const [asked, setAsked] = useState(false);
  const [rcsSeen, setRcsSeen] = useRemembered('sms.rcs', '');
  const rcs = status.defaultSms && status.otherSms && rcsSeen !== 'seen';
  if (status.defaultSms && status.contacts && !rcs) return null;
  return (
    <section className="ph-setup" aria-label="Ustawienia telefonu">
      {!status.defaultSms && (
        <>
          <p><strong>Ta aplikacja nie jest jeszcze aplikacją SMS telefonu</strong> — nowe wiadomości trafiają do innej, a stąd nie da się wysyłać.</p>
          <div className="wk-actions">
            <button type="button" className="wk-btn" onClick={() => void Phone.requestDefault().then((r) => { setAsked(!r.defaultSms); onChanged(); }).catch((e: unknown) => toast(e instanceof Error ? e.message : 'Nie udało się.'))}>
              Ustaw jako aplikację SMS
            </button>
            {asked && <button type="button" className="wk-btn wk-btn-quiet" onClick={() => void Phone.openSettings()}>Ustawienia aplikacji</button>}
          </div>
          {asked && (
            <p>
              Telefon nie pozwolił? Na GrapheneOS i Androidzie 13+ aplikacja spoza sklepu musi najpierw dostać zgodę: Ustawienia aplikacji → ⋮ →
              „Zezwól na ustawienia z ograniczonym dostępem", potem jeszcze raz „Ustaw jako aplikację SMS". Przed zmianą wyłącz czat (RCS) w Google Messages.
            </p>
          )}
        </>
      )}
      {rcs && (
        <>
          <p>
            <strong>Na telefonie jest też Google Messages.</strong> Jeśli miało włączony czat (RCS), Twój numer może być nadal zgłoszony
            do czatu: wiadomości od osób, które go używają, dochodzą wtedy z opóźnieniem albo wcale. Ustaw na chwilę Google Messages jako
            aplikację SMS, wyłącz w nim Ustawienia → Czaty RCS, i wróć tutaj.
          </p>
          <div className="wk-actions">
            <button type="button" className="wk-btn wk-btn-quiet" onClick={() => setRcsSeen('seen')}>Rozumiem</button>
          </div>
        </>
      )}
      {!status.contacts && (
        <>
          <p>Bez dostępu do kontaktów zamiast imion stoją numery, a kontakty z recreatio nie trafią do telefonu.</p>
          <div className="wk-actions">
            <button type="button" className="wk-btn wk-btn-quiet" onClick={() => void Phone.requestContacts().then(onChanged)}>Pozwól na kontakty</button>
          </div>
        </>
      )}
    </section>
  );
}

/* -- Was zuletzt geladen war ------------------------------------------------------------------- */

/*
 * Zurück zur Liste oder wieder in ein Gespräch: was zuletzt da war, steht sofort da,
 * das Frische kommt danach. Ohne das wartete jede Rückkehr auf das Telefon.
 */
let threadsSeen: readonly NativeThread[] | null = null;
const pagesSeen = new Map<string, ThreadPage>();

/** Das Bild in der Liste: eine Gruppe, eine Nummer ohne Namen (ein Mensch) — sonst die Anfangsbuchstaben. */
const avatarIcon = (title: string, people: number): 'users' | 'user' | undefined =>
  people > 1 ? 'users' : /\p{L}/u.test(title) ? undefined : 'user';

/** Wie ein Gespräch heisst: die Namen aus dem Adressbuch, sonst die Nummern. */
const titleOf = (t: NativeThread): string =>
  t.addresses.length === 0 ? 'Bez numeru' : t.addresses.map((a, i) => t.names?.[i] ?? phoneShown(a)).join(', ');

/* -- Die Gespräche --------------------------------------------------------------------------- */

type SearchHit = Awaited<ReturnType<typeof Phone.search>>['hits'][number];

function Threads({ who }: { who: Who }) {
  const [threads, setThreads] = useState<readonly NativeThread[] | null>(threadsSeen);
  const [failed, setFailed] = useState<string | null>(null);
  const [status, refreshStatus] = useStatus();
  const [muted, refreshMutes] = useMutes();
  const [modeText, setModeText] = useRemembered('sms.search', 'osoby');
  const mode: SearchMode = isMode(modeText) ? modeText : 'osoby';
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<readonly SearchHit[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const lines = usePhoneLines();
  const contacts = useContactIndex(who);
  const { groupRules, threadRules } = useLineRules();
  const more = useButtonMenu();
  const top = useBarHeight();
  useCrumbs([]);

  const load = useCallback(async () => {
    try {
      const { threads: fresh } = await Phone.threads({ limit: 2000 });
      threadsSeen = fresh;
      setThreads(fresh);
      setFailed(null);
    } catch (e) {
      setFailed(e instanceof Error ? e.message : 'Nie udało się wczytać wiadomości.');
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useChanged(() => { void load(); refreshMutes(); });

  /* Welche Karte jedes Gespräch nimmt — nur, was nicht die des Telefons ist, steht in der Zeile. */
  const lineOf = useMemo(() => {
    const out = new Map<string, { name: string; subId: number }>();
    if (lines.length < 2) return out;
    for (const t of threads ?? []) {
      const choice = chooseLine({ peers: t.addresses, lines, contacts, groupRules, threadRules, defaultSub: status?.defaultSubId ?? null });
      if (choice.line !== null && (choice.why === 'thread' || choice.why === 'group')) {
        out.set(t.threadId, { name: lineName(choice.line), subId: choice.line.subId });
      }
    }
    return out;
  }, [threads, lines, contacts, groupRules, threadRules, status]);

  /* Antworten aus der Meldung nehmen dieselbe Karte — das Telefon erfährt die Regeln je Gespräch. */
  const pushed = useRef('');
  useEffect(() => {
    if (threads === null || lines.length < 2) return;
    const subs: Record<string, number> = {};
    for (const t of threads) subs[t.threadId] = lineOf.get(t.threadId)?.subId ?? -1;
    const text = JSON.stringify(subs);
    if (text === pushed.current) return;
    pushed.current = text;
    void Phone.threadSubs({ subs }).catch(() => undefined);
  }, [threads, lineOf, lines]);

  const q = query.trim();
  const shown = useMemo(
    () => (threads ?? []).filter((t) => conversationMatches(mode, q, titleOf(t), t.addresses)),
    [threads, q, mode]
  );

  /* In der Treffer-Suche: während des Tippens, kurz nach dem letzten Zeichen. */
  useEffect(() => {
    if (mode !== 'tresc' || q.length < 2) { setHits(null); return undefined; }
    let alive = true;
    const timer = window.setTimeout(() => {
      void Phone.search({ query: q, limit: 200 })
        .then((r) => { if (alive) setHits(r.hits); })
        .catch(() => { if (alive) setHits([]); });
    }, 250);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [mode, q]);

  const byId = useMemo(() => new Map((threads ?? []).map((t) => [t.threadId, t])), [threads]);

  /*
   * SPRAWDŹ: SMS holt man nicht ab — das Netz bringt sie, und diese App schreibt sie auf. Neu
   * gelesen wird alles, angekündigte MMS werden noch einmal geladen, und es kommt zur Sprache,
   * was Nachrichten wegnehmen kann (eine andere SMS-App, Czat in Google Messages).
   */
  const recheck = async () => {
    setChecking(true);
    try {
      const said = await Phone.recheck();
      await load();
      refreshStatus();
      if (!said.defaultSms) toast('Ta aplikacja nie jest aplikacją SMS telefonu — nowe wiadomości trafiają do innej.');
      else toast([
        said.mmsRetried > 0 ? `Sprawdzone. Ponowne pobieranie MMS: ${said.mmsRetried}.` : 'Sprawdzone — wszystko, co dotarło do telefonu, jest tutaj.',
        said.otherSms ? 'Jest też Google Messages: jeśli ma włączony czat (RCS), część wiadomości trafia tam.' : ''
      ].filter(Boolean).join(' '));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się.');
    } finally {
      setChecking(false);
    }
  };

  const items: MenuItem[] = [
    { label: 'Sprawdź nowe wiadomości', icon: 'refresh', disabled: checking, onSelect: () => void recheck() },
    { label: 'Archiwum', icon: 'archive', onSelect: () => { window.location.hash = viewPath('sms', 'archiwum'); } },
    { label: 'Pliki przez link', icon: 'link', onSelect: () => { window.location.hash = viewPath('sms', 'pliki'); } },
    { label: 'Numery i grupy', icon: 'phone', onSelect: () => { window.location.hash = viewPath('sms', 'numery'); } },
    { label: 'Zablokowane numery', icon: 'ban', onSelect: () => setBlockedOpen(true) }
  ];

  const row = (t: NativeThread) => {
    const title = titleOf(t);
    const line = lineOf.get(t.threadId);
    return (
      <li key={t.threadId}>
        <a className={cls('ch-item', t.unread > 0 && 'is-unread')} href={viewPath('sms', t.threadId)}>
          <Avatar seed={t.addresses.map(phoneKey).join(',') || t.threadId} name={title} icon={avatarIcon(title, t.addresses.length)} />
          <span className="ch-item-main">
            <span className="ch-item-top">
              <strong className="ch-item-title">{title}</strong>
              <time className="ch-item-time" dateTime={new Date(t.date).toISOString()}>{listTime(new Date(t.date).toISOString())}</time>
            </span>
            <span className="ch-item-bottom">
              <span className="ch-item-sub">{t.error ? '⚠ ' : ''}{t.attachment && t.snippet === '' ? '📷 Zdjęcie' : t.snippet}</span>
              {line !== undefined && <span className="ph-item-line" title={`Z numeru: ${line.name}`}><Icon name="phone" />{line.name}</span>}
              {muted[t.threadId] !== undefined && <span className="ch-item-muted"><Icon name="bell-off" label="wyciszona" /></span>}
              {t.unread > 0 && <span className="ch-badge" aria-label={`${t.unread} nieprzeczytanych`}>{t.unread}</span>}
            </span>
          </span>
        </a>
      </li>
    );
  };

  return (
    <div className="ph-chats" style={barStyle(top)}>
      <PageHeader title="SMS" />
      {status !== null && <Setup status={status} onChanged={refreshStatus} />}
      <div className="ph-bar" role="search">
        <label className="ch-side-search ph-search-pill">
          <Icon name="search" />
          <select value={mode} aria-label="Szukaj w" onChange={(e) => setModeText(e.target.value)}>
            {(Object.keys(SEARCH) as SearchMode[]).map((m) => <option key={m} value={m}>{SEARCH[m].label}</option>)}
          </select>
          <input type="search" value={query} placeholder={SEARCH[mode].placeholder} aria-label={SEARCH[mode].placeholder}
            inputMode={mode === 'numery' ? 'tel' : 'search'} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <a className="ch-icon-btn ph-bar-new" href={viewPath('sms', 'nowa')} aria-label="Nowa wiadomość" title="Nowa wiadomość"><Icon name="compose" /></a>
        <button type="button" className="ch-icon-btn" aria-label="Więcej: SMS" title="Więcej" aria-haspopup="menu" aria-expanded={more.open !== null}
          onClick={(e) => more.toggle(e.currentTarget)}>
          <Icon name="more" />
        </button>
        {more.open !== null && <PopMenu anchor={{ rect: more.open.rect }} from={more.open.from} label="SMS" items={items} onClose={more.close} />}
      </div>
      {failed !== null && <p className="ch-bar is-error" role="alert">{failed}</p>}
      {threads === null && failed === null && <Loading label="Wczytywanie wiadomości…" />}

      {mode === 'tresc' && q.length >= 2 ? (
        hits === null ? <Loading label="Szukanie…" lines={2} />
          : hits.length === 0 ? <p className="wk-empty">Żadna wiadomość tego nie zawiera.</p>
          : (
            <ul className="ch-list ph-chat-list" aria-label="Znalezione wiadomości">
              {hits.map((h) => {
                const thread = byId.get(h.threadId);
                const title = thread !== undefined ? titleOf(thread) : h.address === null ? 'MMS' : phoneShown(h.address);
                return (
                  <li key={h.id}>
                    <a className="ch-item" href={viewPath('sms', h.threadId)}>
                      <Avatar seed={h.address ?? h.threadId} name={title} icon={avatarIcon(title, thread?.addresses.length ?? 1)} />
                      <span className="ch-item-main">
                        <span className="ch-item-top">
                          <strong className="ch-item-title">{title}</strong>
                          <time className="ch-item-time">{listTime(new Date(h.date).toISOString())}</time>
                        </span>
                        <span className="ch-item-bottom"><span className="ch-item-sub">{around(h.snippet, q)}</span></span>
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          )
      ) : threads !== null && (
        shown.length === 0
          ? <p className="wk-empty">{q === '' ? 'Nie ma jeszcze wiadomości.' : 'Nic nie pasuje.'}</p>
          : <ul className="ch-list ph-chat-list">{shown.map(row)}</ul>
      )}

      {blockedOpen && <BlockedList onClose={() => setBlockedOpen(false)} />}
    </div>
  );
}

/** ZABLOKOWANE — im Telefon (auch aus der Telefon-App) und hier; einzeln wieder frei. */
function BlockedList({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<{ numbers: readonly string[]; system: boolean } | null>(null);
  const load = useCallback(() => { void Phone.blocked().then(setList).catch(() => setList({ numbers: [], system: false })); }, []);
  useEffect(() => { load(); }, [load]);
  const free = async (number: string) => {
    if (!await ask({ title: `Odblokować ${phoneShown(number)}?`, body: 'Telefon znów przyjmie od tego numeru SMS i połączenia.', confirm: 'Odblokuj' })) return;
    await Phone.unblock({ number }).catch(() => toast('Nie udało się odblokować.'));
    load();
  };
  return (
    <Modal title="Zablokowane numery" onClose={onClose}>
      {list === null && <Loading label="Wczytywanie…" lines={1} />}
      {list !== null && list.numbers.length === 0 && <p className="wk-empty">Nie ma zablokowanych numerów.</p>}
      {list !== null && list.numbers.length > 0 && (
        <ul className="ph-blocked">
          {list.numbers.map((n) => (
            <li key={n}>
              <span>{phoneShown(n)}</span>
              <button type="button" className="wk-link-btn" onClick={() => void free(n)}>Odblokuj</button>
            </li>
          ))}
        </ul>
      )}
      {list !== null && !list.system && (
        <p className="ch-compose-line">Telefon nie pozwala tej aplikacji blokować w systemie (nie jest aplikacją SMS) — blokuje tylko ona sama.</p>
      )}
    </Modal>
  );
}

/* -- Ein Gespräch ---------------------------------------------------------------------------- */

const PAGE = 60;

/*
 * DAS GESPRÄCH WIE EINE ROZMOWA: der Kopf steht (zurück, wer, die eigene Nummer, das
 * Archiv, Anrufen, Lupe, ⋮), nur der Verlauf rollt, unten das Feld. Es füllt das Fenster
 * unter der Kopfleiste — kein Rand unter dem Feld für die Leiste des Telefons.
 */
function Thread({ threadId, who }: { threadId: string; who: Who }) {
  const [page, setPage] = useState<ThreadPage | null>(pagesSeen.get(threadId) ?? null);
  const [failed, setFailed] = useState<string | null>(null);
  const [status] = useStatus();
  const [muted, refreshMutes] = useMutes();
  const [olderBusy, setOlderBusy] = useState(false);
  const [planned, setPlanned] = useState<readonly ScheduledEntry[]>([]);
  const [search, setSearch] = useState('');
  const [follow, setFollow] = useState(0);
  const [dialog, setDialog] = useState<'mute' | 'block' | null>(null);
  /* Was beim Öffnen neu (ungelesen) war — dorthin geht der Verlauf. Einmal, beim ersten frischen Laden (danach ist es gelesen). */
  const [firstNew, setFirstNew] = useState<string | null | undefined>(undefined);
  const opened = useRef(false);
  const lines = usePhoneLines();
  const contacts = useContactIndex(who);
  const { groupRules, threadRules, setThreadRule } = useLineRules();
  const settings = useArchive();
  const top = useBarHeight();
  useRoomFrame();
  useCrumbs([]);

  const messages = page?.messages ?? null;
  const peers = useMemo(() => page?.peers ?? [], [page]);
  const names = useMemo(() => new Map(Object.entries(page?.names ?? {})), [page]);
  const title = peers.length === 0 ? (page === null ? '' : 'SMS') : peers.map((p) => nameOf(names, p)).join(', ');
  const single = peers.length === 1 ? peers[0] : null;
  const group = peers.length > 1;
  const key = conversationKey(peers);
  const archived = archivedIn(settings, key);
  const isMuted = muted[threadId] !== undefined;
  const contact: Contact | undefined = single === null ? undefined : contacts.get(phoneKey(single));

  useEffect(() => { if (page !== null) pagesSeen.set(threadId, page); }, [threadId, page]);

  /* Was für dieses Gespräch geplant ist (hier oder aus dem Browser) und noch nicht gesendet. */
  const loadPlanned = useCallback(async () => {
    const { entries } = await Phone.scheduled();
    setPlanned(entries.filter((e) => e.threadId === threadId && e.state !== 'sent').sort((a, b) => a.sendAt - b.sendAt));
  }, [threadId]);

  const load = useCallback(async () => {
    try {
      const fresh = await Phone.messages({ threadId, limit: PAGE });
      if (!opened.current) {
        opened.current = true;
        setFirstNew(fresh.messages.find((m) => m.box === 'in' && !m.read)?.id ?? null);
      }
      setPage((had) => {
        if (had === null || had.messages.length === 0) return fresh;
        /* Was weiter oben schon geladen war, bleibt. */
        const newest = new Set(fresh.messages.map((m) => m.id));
        const first = fresh.messages[0]?.date ?? Infinity;
        const kept = had.messages.filter((m) => !newest.has(m.id) && m.date < first);
        return { ...fresh, messages: [...kept, ...fresh.messages], more: kept.length > 0 ? had.more : fresh.more };
      });
      setFailed(null);
      await loadPlanned().catch(() => undefined);
      await Phone.markRead({ threadId }).catch(() => undefined);
    } catch (e) {
      setFailed(e instanceof Error ? e.message : 'Nie udało się wczytać rozmowy.');
    }
  }, [threadId, loadPlanned]);

  useEffect(() => {
    setSearch('');
    void load();
    void Phone.viewing({ threadId });
    return () => { void Phone.viewing({ threadId: null }); };
  }, [threadId, load]);

  useChanged((changed) => { if (changed === null || changed === threadId) void load(); });

  const loadOlder = async () => {
    if (messages === null || messages.length === 0 || olderBusy) return;
    setOlderBusy(true);
    try {
      const fresh = await Phone.messages({ threadId, before: messages[0].date, limit: PAGE });
      setPage((had) => {
        if (had === null) return had;
        const known = new Set(had.messages.map((m) => m.id));
        return { ...had, messages: [...fresh.messages.filter((m) => !known.has(m.id)), ...had.messages], more: fresh.more };
      });
    } catch {
      toast('Nie udało się wczytać wcześniejszych wiadomości.');
    } finally {
      setOlderBusy(false);
    }
  };

  /* Die Karte: gewählt, nach Gruppe, wo zuletzt etwas kam, die des Telefons. */
  const lastSub = useMemo(() => [...(messages ?? [])].reverse().find((m) => m.box === 'in' && m.subId !== null)?.subId ?? null, [messages]);
  const choice = useMemo(() => chooseLine({ peers, lines, contacts, groupRules, threadRules, lastSub, defaultSub: status?.defaultSubId ?? null }),
    [peers, lines, contacts, groupRules, threadRules, lastSub, status]);
  const sub = choice.line?.subId ?? status?.defaultSubId ?? null;

  /* Antworten aus der Meldung nehmen dieselbe Karte. */
  useEffect(() => {
    if (lines.length < 2 || choice.line === null) return;
    void Phone.threadSubs({ subs: { [threadId]: choice.why === 'default' ? -1 : choice.line.subId } }).catch(() => undefined);
  }, [threadId, choice, lines]);

  const items: SmsItem[] = useMemo(() => (messages ?? []).map((m) => itemOf(m, names, group, () => void load())), [messages, names, group, load]);

  const cancelPlanned = async (id: string) => {
    if (!await ask({ title: 'Odwołać zaplanowaną wiadomość?', confirm: 'Odwołaj', danger: true })) return;
    const { removed } = await Phone.unschedule({ id });
    if (!removed) toast('Ta wiadomość jest już w drodze.');
    await loadPlanned();
  };

  const toggleArchive = () => {
    const on = !settings.chosen.includes(key);
    saveSettings({ ...settings, chosen: on ? [...settings.chosen, key] : settings.chosen.filter((k) => k !== key) });
    toast(on ? 'Ta rozmowa będzie archiwizowana — cała, także starsze wiadomości.' : 'Ta rozmowa nie będzie już archiwizowana (to, co już jest w archiwum, zostaje).');
    if (on) void archiveNow(who, pluginSource).catch(() => undefined);
  };

  const block = async (alsoArchive: boolean) => {
    try {
      const done = await Phone.block({ numbers: peers, threadId });
      let dropped = 0;
      if (alsoArchive && settings.areaId !== null) {
        dropped = await dropConversation(await openArea(who, settings.areaId), key).catch(() => 0);
        if (settings.chosen.includes(key)) saveSettings({ ...settings, chosen: settings.chosen.filter((k) => k !== key) });
      }
      toast([
        done.system ? 'Zablokowano i usunięto rozmowę.' : 'Zablokowano (w tej aplikacji) i usunięto rozmowę.',
        dropped > 0 ? 'Usunięto ją też z archiwum.' : ''
      ].filter(Boolean).join(' '));
      window.location.hash = viewPath('sms');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się zablokować.');
    }
  };

  const remove = async () => {
    const yes = await ask({
      title: 'Usunąć tę rozmowę z telefonu?',
      body: 'Wszystkie jej wiadomości znikną z telefonu. Archiwum zostaje bez zmian.',
      confirm: 'Usuń', danger: true
    });
    if (!yes) return;
    try {
      await Phone.deleteThread({ threadId });
      toast('Usunięto rozmowę z telefonu.');
      window.location.hash = viewPath('sms');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się usunąć.');
    }
  };

  const menu: MenuItem[] = [
    ...(contact !== undefined
      ? [{ label: `Kontakt: ${contact.name}`, icon: 'user' as const, onSelect: () => { window.location.hash = viewPath('contacts', contact.id); } }]
      : single !== null && /\d/.test(single)
        ? [{ label: 'Dodaj do kontaktów', icon: 'plus' as const, onSelect: () => { window.location.hash = `${viewPath('contacts', 'nowy')}?numer=${encodeURIComponent(single)}`; } }]
        : []),
    isMuted
      ? { label: 'Włącz powiadomienia', icon: 'bell', onSelect: () => void Phone.mute({ threadId, until: -1 }).then(refreshMutes) }
      : { label: 'Wycisz…', icon: 'bell-off', onSelect: () => setDialog('mute') },
    settings.areaId === null
      ? { label: 'Archiwum nie jest jeszcze włączone', icon: 'archive', disabled: true, onSelect: () => undefined }
      : settings.mode === 'all'
        ? { label: 'Archiwizowane są wszystkie rozmowy', icon: 'archive', disabled: true, onSelect: () => undefined }
        : { label: 'Archiwizuj tę rozmowę', icon: 'archive', checked: archived, onSelect: toggleArchive },
    { label: 'Zablokuj (spam)…', icon: 'ban', danger: true, onSelect: () => setDialog('block') },
    { label: 'Usuń rozmowę z telefonu…', icon: 'trash', danger: true, onSelect: () => void remove() }
  ];

  const numbers = peers.some((p) => names.has(p)) ? peers.map(phoneShown).join(', ') : null;
  const subtitle = (
    <>
      <LineChip lines={lines} choice={choice} onChoose={(l) => setThreadRule(peers, l === null ? null : lineKeyOf(l))} />
      <ArchiveMark on={archived} />
      {numbers !== null && <span className="ph-head-numbers">{numbers}</span>}
    </>
  );

  return (
    <div className="ch-room ph-room" style={barStyle(top)}>
      <SmsHeader back={viewPath('sms')} title={title} seed={peers.map(phoneKey).join(',') || threadId} group={group}
        sub={subtitle} menu={menu} search={search} onSearch={setSearch} call={single !== null && /\d/.test(single) ? single : null} muted={isMuted} />

      <SmsLog items={messages === null ? null : items} failed={failed} title={title} group={group} search={search} follow={follow}
        more={page?.more === true} onEarlier={() => void loadOlder()} place={`thread:${threadId}`} lasting firstNew={firstNew}
        pickActions={(chosen, done) => chosen.length === 1 && chosen[0].body !== '' ? (
          <button type="button" className="wk-link-btn" onClick={() => {
            done();
            window.location.hash = `${viewPath('sms', 'nowa')}?tekst=${encodeURIComponent(chosen[0].body)}`;
          }}>Przekaż</button>
        ) : null}
        tail={planned.length === 0 ? undefined : planned.map((p) => {
          const notSent = p.state === 'failed';
          const meta = notSent ? `Nie wysłano${p.error !== undefined ? ` · ${p.error}` : ''}` : p.state === 'sending' ? 'Wysyłanie…' : `Zaplanowana · ${aheadWhen(p.sendAt)}`;
          return (
            <PlannedRow key={p.id} text={p.body} failed={notSent} meta={`${meta}${p.outboxId !== undefined ? ' · z przeglądarki' : ''}`}
              tools={p.state === 'scheduled' ? <button type="button" className="wk-link-btn wk-danger-link" onClick={() => void cancelPlanned(p.id)}>Odwołaj</button>
                : notSent && p.outboxId === undefined ? <button type="button" className="wk-link-btn" onClick={() => void Phone.forgetScheduled({ id: p.id }).then(loadPlanned)}>Ukryj</button>
                : undefined} />
          );
        })} />

      {peers.length > 0 && (
        <Composer to={peers} sub={sub} sims={status?.sims ?? []} who={who}
          disabled={status !== null && !status.defaultSms}
          onSent={() => { setFollow((n) => n + 1); void load(); }}
          onScheduled={() => { setFollow((n) => n + 1); void loadPlanned(); }} />
      )}

      {dialog === 'mute' && <MuteDialog onClose={() => setDialog(null)} onMute={(until) => void Phone.mute({ threadId, until }).then(refreshMutes)} />}
      {dialog === 'block' && <BlockDialog title={title} archived={archived} onClose={() => setDialog(null)} onBlock={(also) => void block(also)} />}
    </div>
  );
}

/** Eine Nachricht des Telefons für den Verlauf. */
function itemOf(m: NativeMessage, names: ReadonlyMap<string, string>, group: boolean, onChanged: () => void): SmsItem {
  const failed = m.box === 'failed' || m.status === 'failed';
  const sending = m.box === 'outbox' || m.box === 'queued' || m.status === 'pending';
  /* Noch einmal senden ersetzt die nicht gesendete. */
  const resend = () => { void Phone.send({ to: m.peers, body: m.body }).then(() => Phone.remove({ id: m.id })).then(onChanged); };
  return {
    key: m.id,
    mine: m.box !== 'in',
    at: m.date,
    body: m.pending ? '' : m.body,
    subject: m.subject,
    author: group && m.box === 'in' && m.address !== null ? nameOf(names, m.address) : null,
    authorSeed: m.address ?? undefined,
    state: failed ? 'failed' : sending ? 'sending' : null,
    media: !m.pending && m.parts.length > 0 ? m.parts.map((p) => <MediaPart key={p.partId} part={p} />) : undefined,
    note: m.pending ? (
      <div className="ph-note">
        MMS — jeszcze nie pobrana.{' '}
        <button type="button" className="wk-link-btn" onClick={(e) => { e.stopPropagation(); void Phone.retryMms({ id: m.id }).then(() => toast('Pobieranie…')); }}>Pobierz</button>
      </div>
    ) : undefined,
    tools: failed && m.kind === 'sms'
      ? <button type="button" className="wk-link-btn" onClick={(e) => { e.stopPropagation(); resend(); }}>Wyślij ponownie</button>
      : undefined
  };
}

const parts = new Map<string, Promise<string | null>>();

/** Ein Bild (Film, Ton) einer MMS — erst, wenn es zu sehen ist. */
function MediaPart({ part }: { part: NativePart }) {
  const [url, setUrl] = useState<string | null>(null);
  const box = useRef<HTMLDivElement | null>(null);
  const visual = part.type.startsWith('image/') || part.type.startsWith('video/') || part.type.startsWith('audio/');
  useEffect(() => {
    if (!visual) return undefined;
    let alive = true;
    const el = box.current;
    const load = () => {
      let found = parts.get(part.partId);
      if (found === undefined) {
        found = Phone.part({ partId: part.partId, maxBytes: 25 * 1024 * 1024 })
          .then((r) => `data:${r.type};base64,${r.data}`)
          .catch(() => null);
        parts.set(part.partId, found);
      }
      void found.then((u) => { if (alive) setUrl(u); });
    };
    if (el === null || typeof IntersectionObserver === 'undefined') { load(); return () => { alive = false; }; }
    const seen = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { seen.disconnect(); load(); } });
    seen.observe(el);
    return () => { alive = false; seen.disconnect(); };
  }, [part.partId, visual]);

  if (!visual) return <span className="ph-media-file">📎 {part.name ?? part.type}</span>;
  return (
    <div ref={box} className="ph-media">
      {url === null ? <span className="ph-media-file">{part.type.startsWith('image/') ? '📷 Zdjęcie…' : '🎞 …'}</span>
        : part.type.startsWith('image/') ? <img src={url} alt={part.name ?? 'Zdjęcie'} loading="lazy" />
        : part.type.startsWith('video/') ? <video src={url} controls preload="metadata" />
        : <audio src={url} controls preload="metadata" />}
    </div>
  );
}

/* -- Eine neue Nachricht ------------------------------------------------------------------------ */

/** `?do=…&tekst=…` hinter der Raute — von „Napisz SMS", aus anderen Apps (sms:). */
function hashQuery(): URLSearchParams {
  const hash = window.location.hash;
  const at = hash.indexOf('?');
  return new URLSearchParams(at < 0 ? '' : hash.slice(at + 1));
}

function Compose({ who }: { who: Who }) {
  const query = useMemo(hashQuery, []);
  const [to, setTo] = useState<readonly string[]>(() => (query.get('do') ?? '').split(',').map((n) => n.trim()).filter(Boolean));
  const [typed, setTyped] = useState('');
  const [contacts, setContacts] = useState<readonly Contact[]>([]);
  const [separate, setSeparate] = useState(true);
  const [status] = useStatus();
  const lines = usePhoneLines();
  const index = useContactIndex(who);
  const { groupRules, threadRules, setThreadRule } = useLineRules();
  useCrumbs([{ label: 'Nowa wiadomość', href: null }]);

  useEffect(() => {
    let alive = true;
    void contactsOf(who).then((list) => { if (alive) setContacts(list); }).catch(() => undefined);
    return () => { alive = false; };
  }, [who]);

  const names = useNames(to);
  const suggestions = useMemo(() => {
    const q = typed.trim();
    if (q.length < 2) return [];
    const out: { name: string; number: string; label: string | null }[] = [];
    for (const c of contacts) {
      if (!contactMatches(c, q)) continue;
      for (const p of c.phones) out.push({ name: c.name, number: p.number, label: p.label });
      if (out.length > 30) break;
    }
    return out;
  }, [typed, contacts]);

  const add = (number: string) => {
    const n = number.trim();
    if (n === '' || to.some((x) => phoneKey(x) === phoneKey(n))) { setTyped(''); return; }
    setTo([...to, n]);
    setTyped('');
  };

  /* Die Karte für diese Empfänger — wie im Gespräch (eine Gruppe mit eigener Nummer zuerst). */
  const choice = chooseLine({ peers: to, lines, contacts: index, groupRules, threadRules, defaultSub: status?.defaultSubId ?? null });

  return (
    <>
      <PageHeader title="Nowa wiadomość" />
      {status !== null && <Setup status={status} onChanged={() => undefined} />}
      <div className="wk-field">
        <span className="ph-to-head">
          Do
          {to.length > 0 && <LineChip lines={lines} choice={choice} onChoose={(l) => setThreadRule(to, l === null ? null : lineKeyOf(l))} />}
        </span>
        <div className="ph-to">
          {to.map((n) => (
            <span key={n} className="ph-chip">
              {names.get(n) ?? phoneShown(n)}
              <button type="button" aria-label={`Usuń ${n}`} onClick={() => setTo(to.filter((x) => x !== n))}>×</button>
            </span>
          ))}
          <input value={typed} inputMode="text" placeholder={to.length === 0 ? 'Imię albo numer' : 'Dodaj…'} aria-label="Odbiorca"
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ',') && typed.trim() !== '') { e.preventDefault(); add(suggestions[0]?.number ?? typed); }
              if (e.key === 'Backspace' && typed === '' && to.length > 0) setTo(to.slice(0, -1));
            }}
            onBlur={() => { if (/^[+\d][\d\s-]{2,}$/.test(typed.trim())) add(typed); }} />
        </div>
      </div>
      {suggestions.length > 0 && (
        <ul className="ph-suggest" aria-label="Kontakty">
          {suggestions.map((s) => (
            <li key={`${s.name}:${s.number}`}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => add(s.number)}>
                <span>{s.name}</span><small>{s.number}{s.label !== null ? ` · ${s.label}` : ''}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
      {to.length > 1 && (
        <div className="wk-field" role="radiogroup" aria-label="Jak wysłać">
          <label className="wk-check"><input type="radio" checked={separate} onChange={() => setSeparate(true)} /><span>Osobno do każdego (SMS — nikt nie widzi pozostałych)</span></label>
          <label className="wk-check"><input type="radio" checked={!separate} onChange={() => setSeparate(false)} /><span>Jako grupa (MMS — odpowiedzi widzą wszyscy)</span></label>
        </div>
      )}
      <div className="ph-compose-box">
        <Composer to={to} sub={choice.line?.subId ?? status?.defaultSubId ?? null} sims={status?.sims ?? []} separate={separate} who={who}
          disabled={to.length === 0 || (status !== null && !status.defaultSms)} initial={query.get('tekst') ?? ''}
          onSent={(threadId) => {
            if (to.length > 1 && separate) {
              toast(`Wysłano do ${to.length} osób.`);
              window.location.hash = viewPath('sms');
            } else {
              window.location.hash = viewPath('sms', threadId);
            }
          }}
          onScheduled={(threads) => { window.location.hash = threads.length === 1 ? viewPath('sms', threads[0]) : viewPath('sms'); }} />
      </div>
    </>
  );
}
