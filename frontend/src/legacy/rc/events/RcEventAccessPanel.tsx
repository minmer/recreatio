/**
 * Dostęp osobisty — wydawanie i prowadzenie linków.
 *
 * <b>Token pokazuje się RAZ.</b> Serwis trzyma tylko jego odcisk; nie da się go
 * odzyskać ani odczytać z bazy. Kto go zgubi, dostaje nowy — więc ekran mówi to
 * wprost, zamiast pokazać go mimochodem i pozwolić zamknąć kartę.
 *
 * <b>Pierwsze otwarcie znaczy co innego niż liczba wejść.</b> Link jedzie w
 * jedno miejsce: pod numer, na który organizator go wysłał. To, że się otworzył,
 * dowodzi, że ten numer dociera do człowieka — czego żaden licznik odwiedzin nie
 * powie. Dlatego stoją osobno.
 *
 * <b>Wycofanie nie kasuje.</b> Kto już wszedł, zostaje na liście razem z tą
 * informacją. Kasowanie jest osobną, nieodwracalną rzeczą.
 */

import { useCallback, useEffect, useState } from 'react';

import {
  rcAccessStatus, rcDeleteAccess, rcEventAccessList, rcGrantAccess,
  type RcAccessNote, type RcAccessRow
} from '../lib/rcEventEditing';
import { rcPath } from '../lib/rcRoute';
import type { RcEventView } from '../lib/rcEvents';

export function RcEventAccessPanel({
  view, onError
}: {
  view: RcEventView;
  onError: (message: string) => void;
}) {
  const [rows, setRows] = useState<readonly RcAccessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [made, setMade] = useState<{ name: string; token: string } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setRows((await rcEventAccessList(view.eventId)).access ?? []); }
    catch (e) { onError(e instanceof Error ? e.message : 'Nie udało się pobrać listy dostępów.'); }
    finally { setLoading(false); }
  }, [view.eventId, onError]);

  useEffect(() => { void refresh(); }, [refresh]);

  /*
   * Tylko strony WEWNĘTRZNE da się przydzielić. Publiczna i tak jedzie z każdym
   * linkiem — oferowanie jej wyglądałoby jak wybór, którym nic się nie zmienia.
   */
  const internal = (view.pages ?? []).filter((page) => page.kind === 'internal');

  return (
    <section className="ew-panel">
      <h2 className="ew-h2">Dostęp osobisty</h2>

      {internal.length === 0 && (
        <p className="ec-note">
          To wydarzenie nie ma jeszcze strony wewnętrznej. Dodaj ją w zakładce
          „Strony i części" — link bez przydzielonej strony otwiera tylko to, co
          i tak jest publiczne.
        </p>
      )}

      {/*
        Token stoi TU, raz, z ostrzeżeniem. Serwis go nie zna — trzyma odcisk.
      */}
      {made !== null && (
        <div className="ew-token">
          <p>
            Link dla <strong>{made.name}</strong>. Pokazujemy go <strong>raz</strong> —
            nie da się go odtworzyć, nawet nam.
          </p>
          <code>{linkFor(made.token)}</code>
          <div className="ew-token-actions">
            <button type="button" className="rc-btn"
              onClick={() => void navigator.clipboard?.writeText(linkFor(made.token))}>
              Kopiuj
            </button>
            <button type="button" className="ee-danger" onClick={() => setMade(null)}>
              Zapisałem
            </button>
          </div>
        </div>
      )}

      <Grant
        pages={internal}
        onGrant={async (body) => {
          try {
            const done = await rcGrantAccess(view.eventId, body);
            setMade({ name: body.recipientName, token: done.token });
            await refresh();
          } catch (e) {
            onError(e instanceof Error ? e.message : 'Nie udało się wydać linku.');
          }
        }}
      />

      {loading && <p className="ec-note">Wczytywanie…</p>}
      {!loading && rows.length === 0 && <p className="ec-note">Nikomu jeszcze nie wydano linku.</p>}

      <ul className="ew-access">
        {rows.map((row) => (
          <li key={row.accessId} className="ew-access-row" data-revoked={row.status === 'revoked'}>
            <span className="ew-access-name">{row.recipientName}</span>
            {(row.recipientContact ?? '') !== '' && (
              <span className="ew-access-contact">{row.recipientContact}</span>
            )}

            {/*
              Dwie różne rzeczy, więc dwa różne znaczki: „dotarło" mówi, że
              numer działa; licznik mówi tylko, ile razy ktoś zaglądał.
            */}
            <span className="ew-access-meta">
              {row.contactVerified
                ? <span className="ew-tag ew-ok">dotarło</span>
                : <span className="ew-tag">jeszcze nie otwarto</span>}
              <span>{row.viewCount}×</span>
              <span>{row.pageIds.length} stron</span>
              {row.status === 'revoked' && <span className="ew-tag">wycofany</span>}
            </span>

            <span className="ew-access-actions">
              <button type="button" className="rc-link"
                onClick={() => void rcAccessStatus(
                  row.accessId, row.status === 'revoked' ? 'active' : 'revoked'
                ).then(refresh).catch((e: unknown) =>
                  onError(e instanceof Error ? e.message : 'Nie udało się zmienić stanu.'))}>
                {row.status === 'revoked' ? 'Przywróć' : 'Wycofaj'}
              </button>

              <button type="button" className="ee-danger"
                onClick={() => {
                  if (!window.confirm(`Usunąć link dla „${row.recipientName}"? Tego nie da się cofnąć.`)) return;
                  void rcDeleteAccess(row.accessId).then(refresh).catch((e: unknown) =>
                    onError(e instanceof Error ? e.message : 'Nie udało się usunąć.'));
                }}>
                Usuń
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Der ganze Link, wie er in die SMS kommt. */
function linkFor(token: string): string {
  return `${window.location.origin}${window.location.pathname}${rcPath('access', token)}`;
}

function Grant({
  pages, onGrant
}: {
  pages: RcEventView['pages'];
  onGrant: (body: {
    recipientName: string;
    recipientContact?: string | null;
    pageIds?: readonly string[];
    personalNote?: string | null;
    notes?: readonly RcAccessNote[];
  }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [note, setNote] = useState('');
  const [picked, setPicked] = useState<readonly string[]>([]);
  const [notes, setNotes] = useState<RcAccessNote[]>([]);
  const [busy, setBusy] = useState(false);

  const toggle = (pageId: string) =>
    setPicked((old) => old.includes(pageId) ? old.filter((x) => x !== pageId) : [...old, pageId]);

  return (
    <form
      className="ew-grant"
      onSubmit={async (e) => {
        e.preventDefault();
        if (name.trim() === '' || busy) return;
        setBusy(true);
        await onGrant({
          recipientName: name.trim(),
          recipientContact: contact.trim() || null,
          pageIds: picked,
          personalNote: note.trim() || null,
          notes: notes.filter((one) => one.label.trim() !== '')
        });
        setName(''); setContact(''); setNote(''); setPicked([]); setNotes([]);
        setBusy(false);
      }}
    >
      <div className="ew-form">
        <label className="mo-field">
          <span>Dla kogo</span>
          <input type="text" value={name} maxLength={200} disabled={busy}
            onChange={(e) => setName(e.target.value)} />
        </label>

        <label className="mo-field">
          <span>Telefon albo e-mail</span>
          <input type="text" value={contact} maxLength={200} disabled={busy}
            onChange={(e) => setContact(e.target.value)} />
        </label>

        <label className="mo-field ew-wide">
          <span>Wiadomość dla tej osoby</span>
          <input type="text" value={note} maxLength={1000} disabled={busy}
            onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>

      {pages.length > 0 && (
        <fieldset className="ew-pick">
          <legend>Które strony otwiera</legend>
          {pages.map((page) => (
            <label key={page.pageId} className="ee-check">
              <input type="checkbox" checked={picked.includes(page.pageId)} disabled={busy}
                onChange={() => toggle(page.pageId)} />
              <span>{page.menuLabel ?? page.title}</span>
            </label>
          ))}
        </fieldset>
      )}

      {/*
        Przydziały: „Twoja grupa: 3", „Zbiórka: 7:40, brama B". Dzięki nim JEDNA
        strona mówi każdemu co innego, bez wersji na osobę.
      */}
      <fieldset className="ew-pick">
        <legend>Co ta osoba ma zobaczyć u siebie</legend>

        {notes.map((one, n) => (
          <span key={n} className="ew-note-row">
            <input type="text" value={one.label} placeholder="Twoja grupa" disabled={busy}
              onChange={(e) => setNotes(notes.map((x, i) => i === n ? { ...x, label: e.target.value } : x))} />
            <input type="text" value={one.value} placeholder="3" disabled={busy}
              onChange={(e) => setNotes(notes.map((x, i) => i === n ? { ...x, value: e.target.value } : x))} />
            <button type="button" className="rc-link" disabled={busy}
              onClick={() => setNotes(notes.filter((_, i) => i !== n))}>usuń</button>
          </span>
        ))}

        <button type="button" className="ee-move" disabled={busy}
          onClick={() => setNotes([...notes, { label: '', value: '' }])}>
          + dopisz
        </button>
      </fieldset>

      <button type="submit" className="rc-btn" disabled={busy || name.trim() === ''}>
        {busy ? 'Wydawanie…' : 'Wydaj link'}
      </button>
    </form>
  );
}

export default RcEventAccessPanel;
