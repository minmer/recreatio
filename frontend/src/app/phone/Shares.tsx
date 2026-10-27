/**
 * PLIKI PRZEZ LINK — die eigenen (0117): was als Link hinausging, an wen, bis wann,
 * wie oft geöffnet. Den Link noch einmal kopieren, selbst öffnen, oder zurückziehen
 * (dann gilt er sofort nicht mehr, auch bei denen, die ihn schon haben).
 *
 * 0125 — auch was Thunderbird als Link verschickte (mit dem Namen seines Połączenie),
 * und darunter die Połączenia selbst (`ShareConnections.tsx`).
 *
 * 2026-10-27 — HIER SELBST EINEN LINK MACHEN, ohne SMS: Dateien wählen, auf die Seite
 * ziehen oder einfügen (Strg+V); jede geht versiegelt hinauf und bekommt ihren Link
 * (`shareQueue.ts` — weiter, auch wenn man die Seite verlässt). Die neuen stehen oben,
 * mit dem Link zum Ansehen, „Kopiuj" und — mehrere — „Kopiuj nowe linki".
 *
 * <code>
 *   #/workspace/sms/pliki   auf dem Telefon und im Browser
 * </code>
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { cls, coarsePointer } from '../chat/ChatKit';
import { useCrumbs } from '../shell/crumbTrail';
import { viewPath } from '../routes';
import { useRemembered } from '../core/prefs';
import { WorkspaceError, type Who } from '../core/session';
import { ask, toast } from '../ui/dialogs';
import { Icon } from '../ui/icons';
import { Loading } from '../ui/Loading';
import { PageHeader } from '../ui/PageHeader';
import { DropVeil, usePageDrop } from './fileDrop';
import { phoneHere } from './here';
import { phoneShown } from './numbers';
import { openPhone, type PhoneCtx } from './phoneContext';
import { loadShares, unshare, type ShareEntry } from './share';
import { ShareConnections } from './ShareConnections';
import { addFiles, copyText, dropSending, linesOf, retrySending, useShareQueue, watchShares, type Made, type Sending } from './shareQueue';
import { daysLabel, SHARE_DAYS, SHARE_MAX, shareLink, sizeText } from './shareSeal';
import './phone.css';

const day = (at: string) => new Date(at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' });

/** Wie lange ein neuer Link gilt — dieselbe Wahl wie beim Anhang einer SMS. */
const DAYS_PREF = 'sms.linkDays';

export function SharesView({ who }: { who: Who }) {
  const [ctx, setCtx] = useState<PhoneCtx | null>(null);
  const [list, setList] = useState<readonly ShareEntry[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [daysText, setDaysText] = useRemembered(DAYS_PREF, '30');
  const days = (SHARE_DAYS as readonly number[]).includes(Number(daysText)) ? Number(daysText) : 30;
  const { queue, made } = useShareQueue();
  useCrumbs([{ label: 'Pliki przez link', href: null }]);
  useEffect(() => watchShares(), []);

  const load = useCallback(async () => {
    try {
      const opened = await openPhone(who);
      setCtx(opened);
      setList(await loadShares(opened));
      setFailed(null);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać linków.');
    }
  }, [who]);
  useEffect(() => { void load(); }, [load]);
  /* Ein neuer Link ist fertig: die Liste neu — er steht dann oben. */
  const madeCount = made.length;
  useEffect(() => { if (madeCount > 0) void load(); }, [madeCount, load]);

  const take = useCallback((files: readonly File[]) => {
    if (ctx !== null) addFiles(ctx, files, days);
  }, [ctx, days]);
  const dropping = usePageDrop(ctx === null ? null : take);

  /* Strg+V auf der Seite: ein Bildschirmfoto, eine im Explorer kopierte Datei. Text in einem Feld bleibt Text. */
  useEffect(() => {
    if (ctx === null) return undefined;
    const paste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.length === 0) return;
      const target = e.target as HTMLElement | null;
      const typing = target !== null && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (typing && (e.clipboardData?.getData('text') ?? '') !== '') return;
      e.preventDefault();
      take(files);
    };
    document.addEventListener('paste', paste);
    return () => document.removeEventListener('paste', paste);
  }, [ctx, take]);

  const remove = async (entry: ShareEntry) => {
    if (ctx === null) return;
    const yes = await ask({
      title: `Usunąć ${entry.label?.name ?? 'ten plik'}?`,
      body: 'Link przestanie działać od razu — także u tych, którzy już go dostali.',
      confirm: 'Usuń', danger: true
    });
    if (!yes) return;
    try {
      await unshare(ctx, entry.id);
      toast('Usunięto — link już nie działa.');
    } catch (e) {
      toast(e instanceof WorkspaceError ? e.message : 'Nie udało się usunąć.');
    }
    await load();
  };

  /* Die neuen aus diesem Fenster, die noch gelten — in der Reihenfolge der Liste. */
  const fresh = useMemo(() => new Map(made.map((m) => [m.id, m])), [made]);
  const freshShown = useMemo(() => (list ?? []).map((s) => fresh.get(s.id)).filter((m): m is Made => m !== undefined), [list, fresh]);

  const total = (list ?? []).reduce((n, s) => n + s.size, 0);
  return (
    <>
      <PageHeader title="Pliki przez link" meta={list === null || list.length === 0 ? undefined : `${list.length} · razem ${sizeText(total)}`} />
      <p className="ph-shares-intro">
        Zdjęcia i pliki jako link — dodane tutaj, wysłane w SMS albo z Thunderbirda — w pełnej jakości, zaszyfrowane. Klucz jest tylko w linku;
        recreatio.pl go nie zna. Po terminie plik znika sam.
      </p>
      {failed !== null && <p className="wk-error">{failed}</p>}
      {ctx !== null && <ShareAdd days={days} onDays={(d) => setDaysText(String(d))} queue={queue} onFiles={take} />}
      {dropping && <DropVeil text={`Upuść, a każdy plik dostanie link (ważny ${daysLabel(days)})`} />}

      {list === null && failed === null && <Loading label="Wczytywanie linków…" />}
      {list !== null && list.length === 0 && (
        <p className="wk-empty">
          Nie ma jeszcze plików przez link. Dodaj plik wyżej — albo w rozmowie SMS dołącz zdjęcie lub plik i wybierz „Link — pełna jakość”,
          albo połącz Thunderbirda (niżej).
        </p>
      )}
      {freshShown.length > 1 && (
        <div className="wk-actions ph-shares-fresh">
          <button type="button" className="wk-btn wk-btn-line" onClick={() => copyText(linesOf(freshShown), 'Skopiowano linki.')}>
            <Icon name="copy" />Kopiuj nowe linki ({freshShown.length})
          </button>
        </div>
      )}
      {list !== null && list.length > 0 && (
        <ul className="ph-shares">
          {list.map((s) => <ShareRow key={s.id} entry={s} fresh={fresh.has(s.id)} onRemove={() => void remove(s)} />)}
        </ul>
      )}
      {ctx !== null && <ShareConnections ctx={ctx} onChanged={() => void load()} />}
    </>
  );
}

export default SharesView;

/** Ein Link der Liste — ein neuer zeigt ihn ganz (zum Ansehen und Markieren). */
function ShareRow({ entry: s, fresh, onRemove }: { entry: ShareEntry; fresh: boolean; onRemove: () => void }) {
  const link = s.label === null ? null : shareLink(s.label.secret);
  const sent = (s.label !== null && s.label.to.length > 0) || s.device !== null;
  const share = link !== null && typeof navigator.share === 'function'
    ? () => void navigator.share({ url: link, title: s.label?.name ?? 'Plik' }).catch(() => undefined)
    : null;
  return (
    <li className={cls('ph-share', fresh && 'is-new')}>
      <span className="ph-share-name">
        <Icon name={s.label?.type.startsWith('image/') === true ? 'image' : 'file'} />{s.label?.name ?? 'Plik'}
        {fresh && <span className="wk-tag wk-tag-new">nowy</span>}
      </span>
      <small>
        {sizeText(s.size)} · {sent ? 'wysłano' : 'dodano'} {day(s.createdAt)}
        {s.label !== null && s.label.to.length > 0 ? ` · do ${s.label.to.map(phoneShown).join(', ')}` : ''}
        {s.device !== null ? ` · z: ${s.device.name ?? 'Thunderbird'}` : ''}
      </small>
      <small>ważny do {day(s.expiresAt)} · {s.downloads === 0 ? 'jeszcze nie otwarty' : `otwarty ${s.downloads}×`}</small>
      {fresh && link !== null && (
        <input className="ph-share-link" readOnly value={link} aria-label={`Link do ${s.label?.name ?? 'pliku'}`}
          onFocus={(e) => e.currentTarget.select()} />
      )}
      <span className="ph-share-tools">
        {link !== null && s.label !== null && (
          <>
            <button type="button" className="wk-link-btn" onClick={() => copyText(link)}><Icon name="copy" />Kopiuj link</button>
            {share !== null && <button type="button" className="wk-link-btn" onClick={share}><Icon name="share" />Udostępnij…</button>}
            {phoneHere() && (
              <a className="wk-link-btn" href={`${viewPath('sms', 'nowa')}?tekst=${encodeURIComponent(link)}`}><Icon name="send" />Wyślij SMS</a>
            )}
            <a className="wk-link-btn" href={`#/plik/${s.label.secret}`}><Icon name="eye" />Otwórz</a>
          </>
        )}
        <button type="button" className="wk-link-btn wk-danger-link" onClick={onRemove}><Icon name="trash" />Usuń</button>
      </span>
    </li>
  );
}

/**
 * DATEIEN HINEIN: wählen (mehrere), hineinziehen oder einfügen — und wie lange der Link
 * gilt. Darunter, was gerade hinaufgeht: der Balken, „Przerwij"; was scheiterte, mit dem
 * Grund und „Spróbuj ponownie".
 */
function ShareAdd({ days, onDays, queue, onFiles }: {
  days: number;
  onDays: (days: number) => void;
  queue: readonly Sending[];
  onFiles: (files: readonly File[]) => void;
}) {
  const picker = useRef<HTMLInputElement | null>(null);
  const touch = coarsePointer();
  return (
    <section className="ph-share-add" aria-label="Nowy link do pliku">
      <div className="ph-share-add-row">
        <button type="button" className="wk-btn" onClick={() => picker.current?.click()}><Icon name="upload" />Dodaj pliki…</button>
        <label className="ph-share-days">
          <span>Link ważny</span>
          <select value={days} onChange={(e) => onDays(Number(e.target.value))}>
            {SHARE_DAYS.map((d) => <option key={d} value={d}>{daysLabel(d)}</option>)}
          </select>
        </label>
      </div>
      <p className="ph-share-add-note">
        {touch ? 'Każdy plik (do 25 MB) dostaje własny link.' : 'Albo przeciągnij pliki na stronę lub wklej je (Ctrl+V). Każdy plik (do 25 MB) dostaje własny link.'}
      </p>
      {queue.length > 0 && (
        <ul className="ph-sending" aria-label="Wysyłane pliki">
          {queue.map((q) => <SendingRow key={q.key} item={q} />)}
        </ul>
      )}
      <input ref={picker} type="file" multiple className="ch-picker" tabIndex={-1} aria-label="Wybierz pliki"
        onChange={(e) => { const files = Array.from(e.target.files ?? []); e.target.value = ''; onFiles(files); }} />
    </section>
  );
}

function SendingRow({ item: q }: { item: Sending }) {
  const percent = q.done === null ? null : Math.round(q.done * 100);
  const state = q.state === 'waiting' ? 'czeka'
    : q.state === 'failed' ? 'nie wysłano'
    : percent === null ? 'szyfrowanie…' : `wysyłanie… ${percent}%`;
  return (
    <li className={cls('ph-share', 'ph-send', q.state === 'failed' && 'is-failed')}>
      <span className="ph-share-name"><Icon name="file" />{q.name}</span>
      <small>{sizeText(q.size)} · link ważny {daysLabel(q.days)} · <span role="status">{state}</span></small>
      {q.state === 'sending' && (
        <progress className="ph-progress" value={q.done ?? undefined} max={1} aria-label={`Wysyłanie: ${q.name}`} />
      )}
      {q.error !== null && <p className="wk-error">{q.error}</p>}
      <span className="ph-share-tools">
        {q.state === 'failed' && q.size <= SHARE_MAX && (
          <button type="button" className="wk-link-btn" onClick={() => retrySending(q.key)}><Icon name="refresh" />Spróbuj ponownie</button>
        )}
        <button type="button" className="wk-link-btn" onClick={() => dropSending(q.key)}>
          <Icon name="x" />{q.state === 'sending' ? 'Przerwij' : q.state === 'failed' ? 'Usuń z listy' : 'Nie wysyłaj'}
        </button>
      </span>
    </li>
  );
}
