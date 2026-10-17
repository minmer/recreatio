/**
 * DAS ARCHIV DER SMS — wie viel darin liegt, „Archiwizuj teraz" (auf dem
 * Telefon) und das Archiv selbst zum Lesen: im Browser die SMS-Seite, auf dem
 * Telefon unter „Archiwum".
 *
 * Gelesen wird alles auf einmal (die Stapel geöffnet hier, im Browser); die
 * Namen kommen aus den Kontakten (im Browser) oder dem Adressbuch (Telefon).
 */

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';

import { useCrumbs } from '../shell/crumbTrail';
import { viewPath } from '../routes';
import type { Who } from '../core/session';
import { WorkspaceError } from '../core/session';
import { useRemembered } from '../core/prefs';
import { toast } from '../ui/dialogs';
import { Icon } from '../ui/icons';
import { Loading } from '../ui/Loading';
import { PageHeader } from '../ui/PageHeader';
import { loadContacts, nameIndex } from './contactStore';
import { Phone, phoneHere, pluginSource } from './native';
import { phoneKey, phoneShown } from './numbers';
import { archiveNow, archiveRunning, MEDIA_PREF } from './phoneJobs';
import { openPhone, type PhoneCtx } from './phoneContext';
import { archivedFileUrl, archiveSummary, archiveThreads, loadArchive, type ArchivedMessage, type ArchivedPart, type ArchiveProgress, type ArchiveSummary } from './smsArchive';
import { Avatar, dayLabel, shortWhen, timeOf } from './smsShared';
import './phone.css';

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toLocaleString('pl-PL', { maximumFractionDigits: 1 })} MB`;

export function SmsArchiveView({ who, trail }: { who: Who; trail: readonly string[] }) {
  const native = phoneHere();
  const [ctx, setCtx] = useState<PhoneCtx | null>(null);
  const [summary, setSummary] = useState<ArchiveSummary | null>(null);
  const [messages, setMessages] = useState<readonly ArchivedMessage[] | null>(null);
  const [loading, setLoading] = useState<{ done: number; total: number } | null>(null);
  const [progress, setProgress] = useState<ArchiveProgress | null>(null);
  const [running, setRunning] = useState(archiveRunning());
  const [failed, setFailed] = useState<string | null>(null);
  const [mediaText, setMediaText] = useRemembered(MEDIA_PREF, 'on');
  const [names, setNames] = useState<ReadonlyMap<string, string>>(new Map());
  const [query, setQuery] = useState('');
  const threadKey = trail[0];

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const opened = await openPhone(who);
        if (!alive) return;
        setCtx(opened);
        setSummary(await archiveSummary(opened));
        const contacts = await loadContacts(opened).catch(() => []);
        const index = new Map<string, string>();
        for (const [key, c] of nameIndex(contacts)) index.set(key, c.name);
        if (alive) setNames(index);
      } catch (e) {
        if (alive) setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się otworzyć archiwum.');
      }
    })();
    return () => { alive = false; };
  }, [who]);

  /* Im Browser gleich lesen — dafür ist die Seite da; auf dem Telefon erst auf Wunsch. */
  const read = async (opened: PhoneCtx) => {
    setLoading({ done: 0, total: 0 });
    try {
      const { messages: all, summary: now } = await loadArchive(opened, (done, total) => setLoading({ done, total }));
      setMessages(all);
      setSummary(now);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać archiwum.');
    } finally {
      setLoading(null);
    }
  };
  useEffect(() => {
    if (ctx !== null && messages === null && loading === null && (!native || threadKey !== undefined)) void read(ctx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, threadKey]);

  /* Auf dem Telefon die Namen aus dem Adressbuch dazu — dort steht oft mehr als in recreatio. */
  useEffect(() => {
    if (!native || messages === null) return;
    const numbers = [...new Set(messages.flatMap((m) => m.peers))].slice(0, 2000);
    void Phone.lookup({ numbers }).then(({ names: found }) => {
      setNames((had) => {
        const next = new Map(had);
        for (const [number, name] of Object.entries(found)) next.set(phoneKey(number), name);
        return next;
      });
    }).catch(() => undefined);
  }, [native, messages]);

  const archive = async (full: boolean) => {
    if (ctx === null) return;
    setRunning(true);
    setFailed(null);
    try {
      const done = await archiveNow(ctx, pluginSource, { full, media: mediaText !== 'off', onProgress: setProgress });
      setProgress(done);
      setSummary(await archiveSummary(ctx));
      toast(done.added === 0 ? 'Archiwum jest aktualne.' : `Dodano do archiwum: ${done.added}.`);
      if (messages !== null) void read(ctx);
    } catch (e) {
      setFailed(e instanceof WorkspaceError || e instanceof Error ? e.message : 'Nie udało się zarchiwizować.');
    } finally {
      setRunning(false);
    }
  };

  const threads = useMemo(() => archiveThreads(messages ?? []), [messages]);
  const titleOf = (peers: readonly string[]) => peers.length === 0 ? 'Bez numeru' : peers.map((p) => names.get(p) ?? phoneShown(p)).join(', ');
  const thread = threadKey === undefined ? null : threads.find((t) => t.key === threadKey) ?? null;

  useCrumbs(native
    ? [{ label: 'Archiwum', href: viewPath('sms', 'archiwum') }, ...(thread !== null ? [{ label: titleOf(thread.peers), href: null }] : [])]
    : thread !== null ? [{ label: titleOf(thread.peers), href: null }] : []);

  if (failed !== null && ctx === null) return <p className="wk-error">{failed}</p>;
  if (ctx === null) return <Loading label="Otwieranie archiwum…" />;

  const threadHref = (key: string) => (native ? viewPath('sms', 'archiwum', key) : viewPath('sms', key));

  if (threadKey !== undefined) {
    if (messages === null) return <Loading label={loading !== null && loading.total > 0 ? `Wczytywanie archiwum… ${loading.done}/${loading.total}` : 'Wczytywanie archiwum…'} />;
    if (thread === null) return <p className="wk-empty">Takiej rozmowy nie ma w archiwum.</p>;
    return <ArchiveThread ctx={ctx} title={titleOf(thread.peers)} messages={thread.messages} names={names} group={thread.peers.length > 1}
      back={native ? viewPath('sms', 'archiwum') : viewPath('sms')} />;
  }

  const q = query.trim().toLocaleLowerCase('pl');
  const shown = q === '' ? threads : threads.filter((t) =>
    titleOf(t.peers).toLocaleLowerCase('pl').includes(q) || t.peers.some((p) => p.includes(q.replace(/\s+/g, '')))
    || t.messages.some((m) => m.body.toLocaleLowerCase('pl').includes(q)));

  return (
    <>
      <PageHeader title={native ? 'Archiwum SMS' : 'SMS'} meta={summary === null ? undefined
        : `W archiwum: ${summary.messages.toLocaleString('pl-PL')} wiadomości · ${mb(summary.bytes)} z ${mb(summary.limit)}`} />

      {native && (
        <section className="ph-archive-state" aria-label="Archiwizowanie">
          {summary !== null && <span className="ph-meter" aria-hidden="true"><span style={meterStyle(summary)} /></span>}
          <p>
            Nowe wiadomości trafiają do archiwum same — kilka chwil po przyjściu albo wysłaniu, i dwa razy na dobę. Archiwum jest zaszyfrowane
            kluczem Twojego prywatnego obszaru: serwer go nie odczyta.
          </p>
          <label className="wk-check">
            <input type="checkbox" checked={mediaText !== 'off'} onChange={(e) => setMediaText(e.target.checked ? 'on' : 'off')} />
            <span>Ze zdjęciami i filmami z MMS (do 10 MB każde)</span>
          </label>
          <div className="wk-actions">
            <button type="button" className="wk-btn" disabled={running} onClick={() => void archive(false)}>
              <Icon name="archive" />{running ? 'Archiwizowanie…' : 'Archiwizuj teraz'}
            </button>
            <button type="button" className="wk-btn wk-btn-quiet" disabled={running} onClick={() => void archive(true)}>Sprawdź wszystko od początku</button>
            {messages === null && <button type="button" className="wk-btn wk-btn-quiet" disabled={loading !== null} onClick={() => void read(ctx)}>Przeglądaj archiwum</button>}
          </div>
          {progress !== null && (
            <p aria-live="polite">
              Przejrzano {progress.seen} · nowych {progress.added} · już w archiwum {progress.known}{progress.media > 0 ? ` · plików ${progress.media}` : ''}{progress.done ? ' — gotowe.' : '…'}
            </p>
          )}
        </section>
      )}

      {failed !== null && <p className="wk-error">{failed}</p>}
      {loading !== null && <Loading label={loading.total > 0 ? `Wczytywanie archiwum… ${loading.done}/${loading.total}` : 'Wczytywanie archiwum…'} />}

      {messages !== null && (
        <>
          <div className="ph-search">
            <input type="search" value={query} placeholder="Szukaj: osoba, numer, treść…" aria-label="Szukaj w archiwum" onChange={(e) => setQuery(e.target.value)} />
          </div>
          {shown.length === 0
            ? <p className="wk-empty">{messages.length === 0 ? (native ? 'Archiwum jest jeszcze puste — „Archiwizuj teraz".' : 'Archiwum jest puste. Wiadomości archiwizuje aplikacja SMS na telefonie.') : 'Nic nie pasuje.'}</p>
            : (
              <ul className="ph-list">
                {shown.slice(0, 500).map((t) => {
                  const title = titleOf(t.peers);
                  const hit = q === '' ? null : t.messages.find((m) => m.body.toLocaleLowerCase('pl').includes(q)) ?? null;
                  return (
                    <li key={t.key}>
                      <a className="ph-row" href={threadHref(t.key)}>
                        <Avatar name={t.peers.length > 1 ? '#' : title} seed={t.key} />
                        <span className="ph-row-text">
                          <span className="ph-row-name">{title}</span>
                          <span className="ph-row-snippet">{(hit ?? t.last).body || (t.last.parts.length > 0 ? '📷 MMS' : '')}</span>
                        </span>
                        <span className="ph-row-end"><span>{shortWhen((hit ?? t.last).at)}</span><span>{t.messages.length}</span></span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
        </>
      )}
    </>
  );
}

const meterStyle = (s: ArchiveSummary) => ({ width: `${Math.min(100, (100 * s.bytes) / Math.max(1, s.limit)).toFixed(1)}%` });

function ArchiveThread({ ctx, title, messages, names, group, back }: {
  ctx: PhoneCtx; title: string; messages: readonly ArchivedMessage[]; names: ReadonlyMap<string, string>; group: boolean; back: string;
}) {
  const [count, setCount] = useState(150);
  const end = useRef<HTMLDivElement | null>(null);
  const shown = messages.slice(Math.max(0, messages.length - count));
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, []);
  return (
    <div className="ph-thread">
      <div className="ph-thread-head">
        <a className="wk-icon-btn" href={back} aria-label="Wszystkie rozmowy w archiwum"><Icon name="back" /></a>
        <span className="ph-thread-title">
          <h1 className="wk-h1">{title}</h1>
          <span className="ph-thread-sub">{messages.length} wiadomości w archiwum</span>
        </span>
      </div>
      {count < messages.length && <button type="button" className="wk-btn wk-btn-quiet ph-more" onClick={() => setCount(count + 300)}>Wcześniejsze wiadomości</button>}
      {shown.map((m, i) => {
        const before = shown[i - 1];
        const newDay = before === undefined || new Date(before.at).toDateString() !== new Date(m.at).toDateString();
        const incoming = m.box === 'in';
        return (
          <Fragment key={m.key}>
            {newDay && <span className="ph-day">{dayLabel(m.at)}</span>}
            <div className={`ph-msg ${incoming ? 'is-in' : 'is-out'}${m.box === 'failed' ? ' is-failed' : ''}`}>
              {group && incoming && m.from !== null && <span className="ph-msg-from">{names.get(m.from) ?? phoneShown(m.from)}</span>}
              {m.subject !== null && <span className="ph-msg-subject">{m.subject}</span>}
              {m.parts.length > 0 && <div className="ph-media">{m.parts.map((p, j) => <ArchivedMedia key={j} ctx={ctx} part={p} />)}</div>}
              {m.body !== '' && <span>{m.body}</span>}
              <span className={`ph-msg-meta${m.box === 'failed' ? ' is-failed' : ''}`}>{m.box === 'failed' ? 'Nie wysłano · ' : ''}{timeOf(m.at)}</span>
            </div>
          </Fragment>
        );
      })}
      <div ref={end} />
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
    void archivedFileUrl(ctx, part.file, part.type).then((u) => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [ctx, part.file, part.type, visual, asked]);

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
