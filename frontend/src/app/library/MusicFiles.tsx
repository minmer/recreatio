/**
 * 2026-10-26 — DIE DATEIEN EINES WERKS DER MUSIK: die Spuren eines Nagrania (das Ganze, oder die Stimmen und
 * Instrumente, die zusammen klingen) und die Dateien der Nuty (Partitur, Stimmen, Notensatz).
 *
 * Jede Datei wird im Browser versiegelt, wie alles in der Bibliothek (`LibraryStore.upload`), und erst geöffnet,
 * wenn jemand sie hören oder sehen will (`openFile`) — eine Seite mit fünf Spuren lädt nicht fünf Dateien.
 * Eine Spur heisst nach ihrem Dateinamen, so gut es geht („Barka - Sopran.mp3" → Sopran, `guessVoice`).
 *
 * Zusammen gespielt wird hier nichts: das tut später der Spieler einer öffentlichen Seite (`partsOf`, `wholeOf`).
 */

import { useEffect, useId, useState } from 'react';

import { removeFile } from '../cogita/files';
import type { MediaRef } from '../cogita/schema';
import { WorkspaceError } from '../core/session';
import { ask } from '../ui/dialogs';
import { itemsOf, TRACK_ROLES, type EntryData } from './libraryKinds';
import type { LibraryStore } from './libraryStore';
import { guessVoice, isWholeLabel, mediaOf, SCORE_LABELS, VOICES } from './music';

type Which = 'tracks' | 'files';

const AUDIO = 'audio/*,.mp3,.m4a,.ogg,.oga,.opus,.wav,.flac,.aac';
const SCORE = '.pdf,image/*,.musicxml,.mxl,.xml,.mid,.midi,.mscz,.ly,.abc';

/** Eine neue Kennung in der Liste — „t" und fünf Zeichen. */
function itemId(taken: ReadonlySet<string>): string {
  for (;;) {
    const id = `t${Math.random().toString(36).slice(2, 7)}`;
    if (!taken.has(id)) return id;
  }
}

/** Was eine Datei der Nuty ist, nach ihrem Namen: eine Stimme, sonst die Partitur (PDF) oder ihr Format. */
function scoreLabel(name: string): string {
  const voice = guessVoice(name);
  if (voice.known && voice.role === 'part') return voice.label;
  if (/\.(musicxml|mxl|xml)$/i.test(name)) return 'MusicXML';
  if (/\.(mid|midi)$/i.test(name)) return 'MIDI';
  return 'Partytura';
}

/** Wie eine Datei gezeigt wird: hören, sehen, als PDF lesen, sonst laden. */
function shownAs(ref: MediaRef): 'audio' | 'image' | 'pdf' | 'download' {
  const name = (ref.name ?? '').toLowerCase();
  const mime = (ref.mime ?? '').toLowerCase();
  if (mime.includes('midi') || /\.(mid|midi)$/.test(name)) return 'download';
  if (ref.type === 'audio') return 'audio';
  if (ref.type === 'image') return 'image';
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  return 'download';
}

export function MusicFiles({ store, data, set, commit, readOnly, which }: {
  store: LibraryStore;
  data: EntryData;
  /** Namen, Rollen, Reihenfolge — gespeichert wie jedes Feld, kurz nach dem Tippen. */
  set: (patch: EntryData) => void;
  /** Dateien — sofort gespeichert: sie liegen schon beim Dienst (`entryDraft.commit`). */
  commit: (patch: EntryData) => Promise<unknown>;
  readOnly: boolean;
  which: Which;
}) {
  const items = itemsOf(data, which);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [shown, setShown] = useState<string | null>(null);
  const listId = useId();
  const tracks = which === 'tracks';
  const locked = readOnly || busy !== null;
  const own = (ref: MediaRef) => (ref.library ?? store.libraryId) === store.libraryId;

  const write = (next: readonly Record<string, unknown>[]) => set({ [which]: next });
  const change = (index: number, patch: Record<string, unknown>) => write(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  const move = (index: number, by: -1 | 1) => {
    const next = [...items];
    const [one] = next.splice(index, 1);
    next.splice(index + by, 0, one!);
    write(next);
  };
  /** Die Liste sofort gespeichert — sonst kein Verweis auf eine Datei, die schon oben liegt. */
  const keep = async (next: readonly Record<string, unknown>[]) => {
    if ((await commit({ [which]: next })) === null) throw new WorkspaceError('Nie udało się zapisać wpisu.');
  };

  /* Mehrere Dateien auf einmal: jede versiegelt hinauf und gleich gespeichert (bricht etwas ab, bleibt das schon Hochgeladene). */
  const add = async (files: readonly File[]) => {
    setFailed(null);
    let next = [...items];
    const taken = new Set(next.map((item) => String(item.id ?? '')));
    try {
      for (const [i, file] of files.entries()) {
        setBusy(`Szyfrowanie i wysyłanie ${i + 1} z ${files.length}: ${file.name}…`);
        const ref = await store.upload(file);
        const id = itemId(taken);
        taken.add(id);
        let item: Record<string, unknown>;
        if (tracks) {
          const voice = guessVoice(file.name);
          /* Eine einzige Spur, deren Name keine Stimme verrät, ist das ganze Nagranie. */
          item = items.length === 0 && files.length === 1 && !voice.known ? { id, label: 'Całość', role: 'whole', file: ref } : { id, label: voice.label, role: voice.role, file: ref };
        } else {
          item = { id, label: scoreLabel(file.name), file: ref };
        }
        next = [...next, item];
        try {
          await keep(next);
        } catch (e) {
          await removeFile(store.libraryId, ref.file).catch(() => undefined);
          throw e;
        }
      }
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wysłać pliku.');
    } finally {
      setBusy(null);
    }
  };

  /* Ersetzen: die neue Datei hinauf und gespeichert, dann die alte weg. */
  const replace = async (index: number, file: File) => {
    setFailed(null);
    const before = mediaOf(items[index]?.file);
    try {
      setBusy(`Szyfrowanie i wysyłanie: ${file.name}…`);
      const ref = await store.upload(file);
      try {
        await keep(items.map((item, i) => (i === index ? { ...item, file: ref } : item)));
      } catch (e) {
        await removeFile(store.libraryId, ref.file).catch(() => undefined);
        throw e;
      }
      if (before !== null && own(before)) await removeFile(store.libraryId, before.file).catch(() => undefined);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wysłać pliku.');
    } finally {
      setBusy(null);
    }
  };

  /* Entfernen nimmt die Datei mit — sie gehört nur diesem Eintrag; erst wenn der Eintrag sie nicht mehr nennt. */
  const drop = async (index: number) => {
    const item = items[index];
    if (item === undefined) return;
    const label = String(item.label ?? '').trim() || (tracks ? 'ścieżkę' : 'plik');
    if (!(await ask({
      title: `Usunąć „${label}”?`,
      body: tracks ? 'Ścieżka zniknie z nagrania razem ze swoim plikiem. Tego nie da się cofnąć.' : 'Plik zniknie z tych nut. Tego nie da się cofnąć.',
      confirm: 'Usuń',
      danger: true
    }))) return;
    const ref = mediaOf(item.file);
    setFailed(null);
    setBusy('Usuwanie…');
    try {
      await keep(items.filter((_, i) => i !== index));
      if (ref !== null && own(ref)) await removeFile(store.libraryId, ref.file).catch(() => undefined);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się usunąć.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="lib-music" data-music-files={which}>
      <h2 className="lib-box-h">{tracks ? 'Ścieżki nagrania' : 'Pliki nut'}{items.length > 0 && <span className="lib-count"> {items.length}</span>}</h2>
      <p className="wk-hint">
        {tracks
          ? '„Głos albo instrument” — ścieżki, które brzmią razem (każda osobno: sopran, alt, organy…); „Całe nagranie” — gotowa całość, słuchana sama. Można dodać kilka plików naraz: nazwa pliku podpowie, czyj to głos.'
          : 'Partytura, osobne głosy, zapis nutowy (PDF, obraz, MusicXML, MIDI).'}
        {' '}Pliki są szyfrowane w przeglądarce, do 50 MB każdy.
      </p>
      {items.length === 0 && <p className="wk-empty">{tracks ? 'Nie ma jeszcze żadnej ścieżki.' : 'Nie ma jeszcze żadnego pliku.'}</p>}
      {items.length > 0 && (
        <ol className="lib-music-list">
          {items.map((item, index) => {
            const ref = mediaOf(item.file);
            const id = String(item.id ?? index);
            const label = String(item.label ?? '');
            const role = item.role === 'whole' || item.role === 'part' ? item.role : (items.length === 1 || isWholeLabel(label) ? 'whole' : 'part');
            return (
              <li key={id} className="lib-music-row" data-music-item={id}>
                <div className="lib-music-line">
                  {readOnly
                    ? <span className="lib-music-label">{label || '—'}</span>
                    : <input className="lib-music-label" value={label} list={`${listId}-names`} disabled={locked} aria-label={tracks ? 'Głos albo instrument' : 'Co to jest'}
                      placeholder={tracks ? 'np. Sopran' : 'np. Partytura'} onChange={(e) => change(index, { label: e.target.value })} />}
                  {tracks && (readOnly
                    ? <span className="lib-badge">{TRACK_ROLES.find((r) => r.value === role)?.label}</span>
                    : <select value={role} disabled={locked} aria-label="Rola ścieżki" onChange={(e) => change(index, { role: e.target.value })}>
                      {TRACK_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>)}
                  <span className="lib-music-name">{ref === null ? 'bez pliku' : ref.name ?? 'plik'}</span>
                  {ref !== null && (
                    <button type="button" className="wk-link-btn" aria-expanded={shown === id} onClick={() => setShown(shown === id ? null : id)}>
                      {shown === id ? 'Zwiń' : shownAs(ref) === 'audio' ? '▶ Odsłuchaj' : shownAs(ref) === 'download' ? 'Pobierz' : 'Pokaż'}
                    </button>
                  )}
                  {!readOnly && (
                    <span className="lib-music-tools">
                      <button type="button" className="wk-link-btn" disabled={locked || index === 0} aria-label="Wyżej" onClick={() => move(index, -1)}>↑</button>
                      <button type="button" className="wk-link-btn" disabled={locked || index === items.length - 1} aria-label="Niżej" onClick={() => move(index, 1)}>↓</button>
                      <label className="wk-link-btn lib-music-pick">
                        {ref === null ? 'Dodaj plik' : 'Zamień plik'}
                        <input type="file" accept={tracks ? AUDIO : SCORE} disabled={locked} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file !== undefined) void replace(index, file); }} />
                      </label>
                      <button type="button" className="wk-link-btn wk-danger-link" disabled={locked} onClick={() => void drop(index)}>Usuń</button>
                    </span>
                  )}
                </div>
                {shown === id && ref !== null && <FileView store={store} media={ref} />}
              </li>
            );
          })}
        </ol>
      )}
      <datalist id={`${listId}-names`}>{(tracks ? VOICES : SCORE_LABELS).map((v) => <option key={v} value={v} />)}</datalist>
      {!readOnly && (
        <div className="wk-actions">
          <label className="wk-btn lib-music-pick">
            {tracks ? '+ Dodaj ścieżki' : '+ Dodaj pliki'}
            <input type="file" multiple accept={tracks ? AUDIO : SCORE} disabled={locked}
              onChange={(e) => { const files = [...(e.target.files ?? [])]; e.target.value = ''; if (files.length > 0) void add(files); }} />
          </label>
        </div>
      )}
      {busy !== null && <p className="lib-music-status" role="status">{busy}</p>}
      {failed !== null && <p className="wk-error">{failed}</p>}
    </section>
  );
}

/** Eine Datei, geöffnet, wenn jemand sie will: hören, sehen, lesen, laden. */
function FileView({ store, media }: { store: LibraryStore; media: MediaRef }) {
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    store.openFile(media).then((found) => { if (alive) setUrl(found); }, () => { if (alive) setUrl(null); });
    return () => { alive = false; };
  }, [store, media.file]); // eslint-disable-line react-hooks/exhaustive-deps
  if (url === undefined) return <p className="lib-music-status lib-music-view" role="status">Otwieranie pliku…</p>;
  if (url === null) return <p className="wk-error lib-music-view">Tego pliku nie da się otworzyć.</p>;
  const name = media.name ?? 'plik';
  switch (shownAs(media)) {
    case 'audio': return <audio className="lib-music-view" src={url} controls autoPlay preload="auto" />;
    case 'image': return <img className="lib-music-view lib-music-image" src={url} alt={name} />;
    case 'pdf':
      return (
        <div className="lib-music-view">
          <object className="lib-music-pdf" data={url} type="application/pdf" aria-label={name}><a href={url} download={name}>Pobierz: {name}</a></object>
          <p className="wk-actions"><a className="wk-link-btn" href={url} target="_blank" rel="noopener noreferrer">Otwórz w nowej karcie</a><a className="wk-link-btn" href={url} download={name}>Pobierz</a></p>
        </div>
      );
    default: return <p className="lib-music-view"><a className="wk-link-btn" href={url} download={name}>Pobierz: {name}</a></p>;
  }
}
