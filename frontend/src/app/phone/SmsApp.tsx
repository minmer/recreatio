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
 * </code>
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { useCrumbs } from '../shell/crumbTrail';
import { viewPath } from '../routes';
import { useRemembered } from '../core/prefs';
import type { Who } from '../core/session';
import { toast } from '../ui/dialogs';
import { Icon } from '../ui/icons';
import { Loading } from '../ui/Loading';
import { MenuButton } from '../ui/Menu';
import { PageHeader } from '../ui/PageHeader';
import { useBarHeight } from '../ui/useBarHeight';
import { Composer } from './Composer';
import { contactMatches, loadContacts, type Contact } from './contactStore';
import { Phone, phoneHere, type NativeMessage, type NativePart, type NativeThread, type PhoneStatus, type ThreadPage } from './native';
import { phoneKey, phoneShown } from './numbers';
import { openPhone } from './phoneContext';
import { SmsArchiveView } from './SmsArchiveView';
import { around, Avatar, barStyle, conversationMatches, dayLabel, isMode, SEARCH, shortWhen, timeOf, type SearchMode } from './smsShared';
import './phone.css';

export function SmsApp({ who, trail }: { who: Who; trail: readonly string[] }) {
  if (!phoneHere()) return <SmsArchiveView who={who} trail={trail} />;
  const step = trail[0];
  if (step === undefined) return <Threads />;
  if (step === 'nowa') return <Compose who={who} />;
  if (step === 'archiwum') return <SmsArchiveView who={who} trail={trail.slice(1)} />;
  return <Thread threadId={step} />;
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

/** Wie ein Gespräch heisst: die Namen aus dem Adressbuch, sonst die Nummern. */
const titleOf = (t: NativeThread): string =>
  t.addresses.length === 0 ? 'Bez numeru' : t.addresses.map((a, i) => t.names?.[i] ?? phoneShown(a)).join(', ');

/* -- Die Gespräche --------------------------------------------------------------------------- */

type SearchHit = Awaited<ReturnType<typeof Phone.search>>['hits'][number];

function Threads() {
  const [threads, setThreads] = useState<readonly NativeThread[] | null>(threadsSeen);
  const [failed, setFailed] = useState<string | null>(null);
  const [status, refreshStatus] = useStatus();
  const [modeText, setModeText] = useRemembered('sms.search', 'osoby');
  const mode: SearchMode = isMode(modeText) ? modeText : 'osoby';
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<readonly SearchHit[] | null>(null);
  const [checking, setChecking] = useState(false);
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
  useChanged(() => void load());

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

  return (
    <div className="ph-threads" style={barStyle(top)}>
      <PageHeader title="SMS" />
      {status !== null && <Setup status={status} onChanged={refreshStatus} />}
      <div className="ph-bar" role="search">
        <select value={mode} aria-label="Szukaj w" onChange={(e) => setModeText(e.target.value)}>
          {(Object.keys(SEARCH) as SearchMode[]).map((m) => <option key={m} value={m}>{SEARCH[m].label}</option>)}
        </select>
        <input type="search" value={query} placeholder={SEARCH[mode].placeholder} aria-label={SEARCH[mode].placeholder}
          inputMode={mode === 'numery' ? 'tel' : 'search'} onChange={(e) => setQuery(e.target.value)} />
        <a className="wk-btn ph-bar-new" href={viewPath('sms', 'nowa')} title="Nowa wiadomość"><Icon name="compose" /><span>Nowa</span></a>
        <MenuButton label="Więcej: SMS" items={[
          { label: 'Sprawdź nowe wiadomości', icon: 'refresh', disabled: checking, onSelect: () => void recheck() },
          { label: 'Archiwum', icon: 'archive', onSelect: () => { window.location.hash = viewPath('sms', 'archiwum'); } }
        ]} />
      </div>
      {failed !== null && <p className="wk-error">{failed}</p>}
      {threads === null && failed === null && <Loading label="Wczytywanie wiadomości…" />}

      {mode === 'tresc' && q.length >= 2 ? (
        hits === null ? <Loading label="Szukanie…" lines={2} />
          : hits.length === 0 ? <p className="wk-empty">Żadna wiadomość tego nie zawiera.</p>
          : (
            <ul className="ph-list" aria-label="Znalezione wiadomości">
              {hits.map((h) => {
                const thread = byId.get(h.threadId);
                const title = thread !== undefined ? titleOf(thread) : h.address === null ? 'MMS' : phoneShown(h.address);
                return (
                  <li key={h.id}>
                    <a className="ph-row" href={viewPath('sms', h.threadId)}>
                      <Avatar name={thread !== undefined && thread.addresses.length > 1 ? '#' : title} seed={h.address ?? h.threadId} />
                      <span className="ph-row-text">
                        <span className="ph-row-name">{title}</span>
                        <span className="ph-row-snippet">{around(h.snippet, q)}</span>
                      </span>
                      <span className="ph-row-end">{shortWhen(h.date)}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          )
      ) : threads !== null && (
        shown.length === 0
          ? <p className="wk-empty">{q === '' ? 'Nie ma jeszcze wiadomości.' : 'Nic nie pasuje.'}</p>
          : (
            <ul className="ph-list">
              {shown.map((t) => {
                const title = titleOf(t);
                return (
                  <li key={t.threadId}>
                    <a className={`ph-row${t.unread > 0 ? ' is-unread' : ''}`} href={viewPath('sms', t.threadId)}>
                      <Avatar name={t.addresses.length > 1 ? '#' : title} seed={t.addresses.map(phoneKey).join(',') || t.threadId} />
                      <span className="ph-row-text">
                        <span className="ph-row-name">{title}</span>
                        <span className="ph-row-snippet">{t.error ? '⚠ ' : ''}{t.attachment && t.snippet === '' ? '📷 Zdjęcie' : t.snippet}</span>
                      </span>
                      <span className="ph-row-end">
                        <span>{shortWhen(t.date)}</span>
                        {t.unread > 0 && <span className="ph-unread" aria-label={`${t.unread} nieprzeczytanych`}>{t.unread}</span>}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          )
      )}
    </div>
  );
}

/* -- Ein Gespräch ---------------------------------------------------------------------------- */

const PAGE = 60;

/*
 * DAS GESPRÄCH FÜLLT DAS FENSTER unter der Kopfleiste: oben wer (mit dem Weg zurück),
 * dazwischen die Nachrichten — nur sie rollen —, unten das Schreibfeld. So bleibt der Kopf
 * stehen, und unter dem Schreibfeld ist kein Rand für die Leiste des Telefons mehr.
 */
function Thread({ threadId }: { threadId: string }) {
  const [page, setPage] = useState<ThreadPage | null>(pagesSeen.get(threadId) ?? null);
  const [failed, setFailed] = useState<string | null>(null);
  const [status] = useStatus();
  const [open, setOpen] = useState<string | null>(null);
  const [olderBusy, setOlderBusy] = useState(false);
  const scroller = useRef<HTMLDivElement | null>(null);
  const inner = useRef<HTMLDivElement | null>(null);
  /** Unten bleiben: wer am Ende war, sieht auch das Neue (und nach dem Senden immer). */
  const stick = useRef(true);
  /** Beim Nachladen oben: die Höhe vorher — damit dieselbe Nachricht stehen bleibt. */
  const anchor = useRef<number | null>(null);
  const top = useBarHeight();
  useCrumbs([]);

  const messages = page?.messages ?? null;
  const peers = page?.peers ?? [];
  const names = useMemo(() => new Map(Object.entries(page?.names ?? {})), [page]);
  const title = peers.length === 0 ? (page === null ? '' : 'SMS') : peers.map((p) => nameOf(names, p)).join(', ');
  const single = peers.length === 1 ? peers[0] : null;

  useEffect(() => { if (page !== null) pagesSeen.set(threadId, page); }, [threadId, page]);

  const load = useCallback(async () => {
    try {
      const fresh = await Phone.messages({ threadId, limit: PAGE });
      setPage((had) => {
        if (had === null || had.messages.length === 0) return fresh;
        /* Was weiter oben schon geladen war, bleibt. */
        const newest = new Set(fresh.messages.map((m) => m.id));
        const first = fresh.messages[0]?.date ?? Infinity;
        const kept = had.messages.filter((m) => !newest.has(m.id) && m.date < first);
        return { ...fresh, messages: [...kept, ...fresh.messages], more: kept.length > 0 ? had.more : fresh.more };
      });
      setFailed(null);
      await Phone.markRead({ threadId }).catch(() => undefined);
    } catch (e) {
      setFailed(e instanceof Error ? e.message : 'Nie udało się wczytać rozmowy.');
    }
  }, [threadId]);

  useEffect(() => {
    stick.current = true;
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
      const el = scroller.current;
      if (el !== null) anchor.current = el.scrollHeight;
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

  /* Nach dem Zeichnen, vor dem Anzeigen: unten bleiben, oder nach dem Nachladen oben an derselben Stelle. */
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el === null) return;
    if (anchor.current !== null) {
      el.scrollTop += el.scrollHeight - anchor.current;
      anchor.current = null;
    } else if (stick.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  /* Die Tastatur geht auf, ein Bild ist geladen: wer unten war, bleibt unten. */
  useEffect(() => {
    const el = scroller.current;
    const content = inner.current;
    if (el === null || content === null || typeof ResizeObserver === 'undefined') return undefined;
    const keep = new ResizeObserver(() => { if (stick.current) el.scrollTop = el.scrollHeight; });
    keep.observe(el);
    keep.observe(content);
    return () => keep.disconnect();
  }, []);

  const onScroll = () => {
    const el = scroller.current;
    if (el === null) return;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 64;
    if (el.scrollTop < 160 && page?.more === true && !olderBusy) void loadOlder();
  };

  return (
    <div className="ph-thread" style={barStyle(top)}>
      <header className="ph-thread-head">
        <a className="wk-icon-btn" href={viewPath('sms')} aria-label="Wszystkie wiadomości" title="Wszystkie wiadomości"><Icon name="back" /></a>
        {peers.length > 0 && <Avatar name={peers.length > 1 ? '#' : title} seed={peers.map(phoneKey).join(',')} />}
        <span className="ph-thread-title">
          <h1 className="ph-thread-name">{title}</h1>
          {peers.some((p) => names.has(p)) && <span className="ph-thread-sub">{peers.map(phoneShown).join(', ')}</span>}
        </span>
        {single !== null && (
          <a className="wk-icon-btn" href={`tel:${single.replace(/\s+/g, '')}`} aria-label="Zadzwoń" title="Zadzwoń"><Icon name="phone" /></a>
        )}
      </header>

      <div className="ph-scroll" ref={scroller} onScroll={onScroll}>
        <div className="ph-scroll-inner" ref={inner}>
          {failed !== null && <p className="wk-error">{failed}</p>}
          {messages === null && failed === null && <Loading label="Wczytywanie rozmowy…" />}
          {page?.more === true && (
            <button type="button" className="wk-btn wk-btn-quiet ph-more" disabled={olderBusy} onClick={() => void loadOlder()}>Wcześniejsze wiadomości</button>
          )}
          {messages !== null && messages.map((m, i) => {
            const before = messages[i - 1];
            const newDay = before === undefined || new Date(before.date).toDateString() !== new Date(m.date).toDateString();
            return (
              <MessageView key={m.id} m={m} newDay={newDay} group={peers.length > 1} names={names}
                open={open === m.id} onToggle={() => setOpen(open === m.id ? null : m.id)}
                onChanged={() => void load()} />
            );
          })}
        </div>
      </div>

      {peers.length > 0 && (
        <Composer to={peers} sims={status?.sims ?? []} defaultSub={status?.defaultSubId ?? null}
          disabled={status !== null && !status.defaultSms}
          onSent={() => { stick.current = true; void load(); }} />
      )}
    </div>
  );
}

function MessageView({ m, newDay, group, names, open, onToggle, onChanged }: {
  m: NativeMessage; newDay: boolean; group: boolean; names: ReadonlyMap<string, string>;
  open: boolean; onToggle: () => void; onChanged: () => void;
}) {
  const incoming = m.box === 'in';
  const failed = m.box === 'failed' || m.status === 'failed';
  const sending = m.box === 'outbox' || m.box === 'queued' || m.status === 'pending';
  const copy = () => { void navigator.clipboard?.writeText(m.body).then(() => toast('Skopiowano.')).catch(() => undefined); };
  const remove = () => { void Phone.remove({ id: m.id }).then(onChanged); };
  return (
    <>
      {newDay && <span className="ph-day">{dayLabel(m.date)}</span>}
      <div className={`ph-msg ${incoming ? 'is-in' : 'is-out'}${failed ? ' is-failed' : ''}`} role="article" tabIndex={0}
        onClick={onToggle} onKeyDown={(e) => { if (e.key === 'Enter') onToggle(); }}>
        {group && incoming && m.address !== null && <span className="ph-msg-from">{nameOf(names, m.address)}</span>}
        {m.subject !== null && <span className="ph-msg-subject">{m.subject}</span>}
        {m.pending ? (
          <span>
            MMS — jeszcze nie pobrana.{' '}
            <button type="button" className="wk-link-btn" onClick={(e) => { e.stopPropagation(); void Phone.retryMms({ id: m.id }).then(() => toast('Pobieranie…')); }}>Pobierz</button>
          </span>
        ) : (
          <>
            {m.parts.length > 0 && <div className="ph-media">{m.parts.map((p) => <MediaPart key={p.partId} part={p} />)}</div>}
            {m.body !== '' && <span>{m.body}</span>}
          </>
        )}
        <span className={`ph-msg-meta${failed ? ' is-failed' : ''}`}>
          {failed ? 'Nie wysłano · ' : sending ? 'Wysyłanie… · ' : ''}{timeOf(m.date)}
        </span>
        {open && (
          <span className="ph-msg-tools" onClick={(e) => e.stopPropagation()}>
            {m.body !== '' && <button type="button" className="wk-link-btn" onClick={copy}>Kopiuj</button>}
            {failed && m.kind === 'sms' && (
              <button type="button" className="wk-link-btn" onClick={() => void Phone.send({ to: m.peers, body: m.body }).then(() => { remove(); })}>Wyślij ponownie</button>
            )}
            <button type="button" className="wk-link-btn wk-danger-link" onClick={remove}>Usuń z telefonu</button>
          </span>
        )}
      </div>
    </>
  );
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
    <div ref={box}>
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
  useCrumbs([{ label: 'Nowa wiadomość', href: null }]);

  useEffect(() => {
    let alive = true;
    void openPhone(who).then(loadContacts).then((list) => { if (alive) setContacts(list); }).catch(() => undefined);
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

  return (
    <>
      <PageHeader title="Nowa wiadomość" />
      {status !== null && <Setup status={status} onChanged={() => undefined} />}
      <div className="wk-field">
        <span>Do</span>
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
      <Composer to={to} sims={status?.sims ?? []} defaultSub={status?.defaultSubId ?? null} separate={separate}
        disabled={to.length === 0 || (status !== null && !status.defaultSms)} initial={query.get('tekst') ?? ''}
        onSent={(threadId) => {
          if (to.length > 1 && separate) {
            toast(`Wysłano do ${to.length} osób.`);
            window.location.hash = viewPath('sms');
          } else {
            window.location.hash = viewPath('sms', threadId);
          }
        }} />
    </>
  );
}
