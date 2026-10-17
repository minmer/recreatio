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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useCrumbs } from '../shell/crumbTrail';
import { viewPath } from '../routes';
import type { Who } from '../core/session';
import { toast } from '../ui/dialogs';
import { Icon } from '../ui/icons';
import { Loading } from '../ui/Loading';
import { PageHeader } from '../ui/PageHeader';
import { Composer } from './Composer';
import { contactMatches, loadContacts, type Contact } from './contactStore';
import { Phone, phoneHere, type NativeMessage, type NativePart, type NativeThread, type PhoneStatus } from './native';
import { phoneKey, phoneShown } from './numbers';
import { openPhone } from './phoneContext';
import { SmsArchiveView } from './SmsArchiveView';
import { Avatar, dayLabel, shortWhen, timeOf } from './smsShared';
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

/** Was noch fehlt, damit SMS hier ankommen: die SMS-App sein, Kontakte lesen dürfen. */
function Setup({ status, onChanged }: { status: PhoneStatus; onChanged: () => void }) {
  const [asked, setAsked] = useState(false);
  if (status.defaultSms && status.contacts) return null;
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

/* -- Die Gespräche --------------------------------------------------------------------------- */

function Threads() {
  const [threads, setThreads] = useState<readonly NativeThread[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [status, refreshStatus] = useStatus();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<readonly { threadId: string; id: string; date: number; snippet: string; address: string | null }[] | null>(null);
  useCrumbs([]);

  const load = useCallback(() => {
    void Phone.threads({ limit: 1000 })
      .then((r) => { setThreads(r.threads); setFailed(null); })
      .catch((e: unknown) => setFailed(e instanceof Error ? e.message : 'Nie udało się wczytać wiadomości.'));
  }, []);
  useEffect(() => { load(); }, [load]);
  useChanged(() => load());

  const names = useNames((threads ?? []).flatMap((t) => t.addresses));
  const shown = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('pl');
    if (q === '' || threads === null) return threads ?? [];
    const digits = q.replace(/\D/g, '');
    return threads.filter((t) => t.addresses.some((a) => nameOf(names, a).toLocaleLowerCase('pl').includes(q) || (digits.length >= 3 && a.replace(/\D/g, '').includes(digits)))
      || t.snippet.toLocaleLowerCase('pl').includes(q));
  }, [threads, names, query]);

  const searchText = () => {
    const q = query.trim();
    if (q.length < 2) return;
    void Phone.search({ query: q, limit: 200 }).then((r) => setHits(r.hits)).catch(() => setHits([]));
  };

  return (
    <>
      <PageHeader title="SMS" actions={(
        <>
          <a className="wk-btn" href={viewPath('sms', 'nowa')}><Icon name="compose" />Nowa</a>
          <a className="wk-btn wk-btn-quiet" href={viewPath('sms', 'archiwum')}><Icon name="archive" />Archiwum</a>
        </>
      )} />
      {status !== null && <Setup status={status} onChanged={refreshStatus} />}
      <div className="ph-search">
        <input type="search" value={query} placeholder="Szukaj: osoba, numer, treść…" aria-label="Szukaj w SMS"
          onChange={(e) => { setQuery(e.target.value); setHits(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') searchText(); }} />
        <button type="button" className="wk-btn wk-btn-quiet" disabled={query.trim().length < 2} onClick={searchText}>W treści</button>
      </div>
      {failed !== null && <p className="wk-error">{failed}</p>}
      {threads === null && failed === null && <Loading label="Wczytywanie wiadomości…" />}

      {hits !== null && (
        <section aria-label="Znalezione wiadomości">
          <h2 className="wk-h2">Znalezione w treści: {hits.length}</h2>
          <ul className="ph-list">
            {hits.map((h) => (
              <li key={h.id}>
                <a className="ph-row" href={viewPath('sms', h.threadId)}>
                  <Avatar name={h.address === null ? '#' : nameOf(names, h.address)} seed={h.address ?? h.threadId} />
                  <span className="ph-row-text">
                    <span className="ph-row-name">{h.address === null ? 'MMS' : nameOf(names, h.address)}</span>
                    <span className="ph-row-snippet">{h.snippet}</span>
                  </span>
                  <span className="ph-row-end">{shortWhen(h.date)}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {threads !== null && hits === null && (
        shown.length === 0
          ? <p className="wk-empty">{query.trim() === '' ? 'Nie ma jeszcze wiadomości.' : 'Nic nie pasuje.'}</p>
          : (
            <ul className="ph-list">
              {shown.map((t) => {
                const title = t.addresses.length === 0 ? 'Bez numeru' : t.addresses.map((a) => nameOf(names, a)).join(', ');
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
    </>
  );
}

/* -- Ein Gespräch ---------------------------------------------------------------------------- */

const PAGE = 60;

function Thread({ threadId }: { threadId: string }) {
  const [messages, setMessages] = useState<readonly NativeMessage[] | null>(null);
  const [more, setMore] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [status] = useStatus();
  const [open, setOpen] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement | null>(null);
  const first = useRef(true);

  const peers = messages?.[0]?.peers ?? [];
  const names = useNames(peers);
  const title = peers.length === 0 ? 'SMS' : peers.map((p) => nameOf(names, p)).join(', ');
  useCrumbs([{ label: title, href: null }]);

  const load = useCallback(async (keepOlder: boolean) => {
    try {
      const page = await Phone.messages({ threadId, limit: PAGE });
      setMessages((had) => {
        if (!keepOlder || had === null || had.length === 0) return page.messages;
        const newest = new Set(page.messages.map((m) => m.id));
        const older = had.filter((m) => !newest.has(m.id) && m.date < (page.messages[0]?.date ?? Infinity));
        return [...older, ...page.messages];
      });
      if (!keepOlder) setMore(page.more);
      setFailed(null);
      await Phone.markRead({ threadId }).catch(() => undefined);
    } catch (e) {
      setFailed(e instanceof Error ? e.message : 'Nie udało się wczytać rozmowy.');
    }
  }, [threadId]);

  useEffect(() => {
    first.current = true;
    void load(false);
    void Phone.viewing({ threadId });
    return () => { void Phone.viewing({ threadId: null }); };
  }, [threadId, load]);

  useChanged((changed) => { if (changed === null || changed === threadId) void load(true); });

  /* Beim Öffnen und bei Neuem: nach unten. */
  const count = messages?.length ?? 0;
  useEffect(() => {
    if (count === 0) return;
    bottom.current?.scrollIntoView({ block: 'end', behavior: first.current ? 'auto' : 'smooth' });
    first.current = false;
  }, [count]);

  const older = async () => {
    if (messages === null || messages.length === 0) return;
    const page = await Phone.messages({ threadId, before: messages[0].date, limit: PAGE });
    setMessages([...page.messages, ...messages]);
    setMore(page.more);
  };

  const single = peers.length === 1 ? peers[0] : null;

  return (
    <div className="ph-thread">
      <div className="ph-thread-head">
        <span className="ph-thread-title">
          <h1 className="wk-h1">{title}</h1>
          {peers.some((p) => names.has(p)) && <span className="ph-thread-sub">{peers.map(phoneShown).join(', ')}</span>}
        </span>
        {single !== null && <a className="wk-btn wk-btn-quiet" href={`tel:${single.replace(/\s+/g, '')}`}><Icon name="phone" />Zadzwoń</a>}
      </div>

      {failed !== null && <p className="wk-error">{failed}</p>}
      {messages === null && failed === null && <Loading label="Wczytywanie rozmowy…" />}
      {more && <button type="button" className="wk-btn wk-btn-quiet ph-more" onClick={() => void older()}>Wcześniejsze wiadomości</button>}

      {messages !== null && messages.map((m, i) => {
        const before = messages[i - 1];
        const newDay = before === undefined || new Date(before.date).toDateString() !== new Date(m.date).toDateString();
        return (
          <MessageView key={m.id} m={m} newDay={newDay} group={peers.length > 1} names={names}
            open={open === m.id} onToggle={() => setOpen(open === m.id ? null : m.id)}
            onChanged={() => void load(true)} />
        );
      })}
      <div ref={bottom} />

      {peers.length > 0 && (
        <Composer to={peers} sims={status?.sims ?? []} defaultSub={status?.defaultSubId ?? null}
          disabled={status !== null && !status.defaultSms}
          onSent={() => void load(true)} />
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
