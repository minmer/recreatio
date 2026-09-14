/**
 * Die Plätze eines Bereichs — die Kanzleisicht.
 *
 * <b>Ein Platz je Mensch.</b> Der Firmkandidat, der Teilnehmer, der Schüler:
 * dasselbe Gebilde, und was es unterscheidet, ist nur die Richtung, in die
 * geschrieben wird.
 *
 * <code>
 *   Dla uczestnika   unter dem PLATZSCHLÜSSEL   — er liest es
 *   Notatka wewnętrzna unter der EPOCHE         — er liest es nicht
 * </code>
 *
 * <b>Der Link steht genau EINMAL hier.</b> Gespeichert ist nur sein Abdruck;
 * niemand kann ihn nachschlagen, auch der Betreiber nicht. Wer ihn verliert,
 * stellt einen neuen aus — und das ist der Preis dafür, dass ein gestohlenes
 * Datenbankabbild keine Zugänge enthält.
 */

import { useCallback, useEffect, useState } from 'react';

import { myEpochKeys, type AreaRow } from './area';
import type { Ring } from './keys';
import {
  issueSeat, loadSeats, openAsOffice, revokeSeat, seatKeyOfRow, seatPath, setNotes,
  type Link, type SeatRow
} from './seat';
import { WorkspaceError } from './session';

interface Shown {
  readonly row: SeatRow;
  readonly personal: string | null;
  readonly internal: string | null;
}

export function Seats({ area, ring, ownerRoleId }: {
  area: AreaRow;
  ring: Ring;
  ownerRoleId: string;
}) {
  const [key, setKey] = useState<Uint8Array | null>(null);
  const [rows, setRows] = useState<readonly Shown[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  /** Der Link des zuletzt ausgestellten Platzes — einmal, dann nie wieder. */
  const [fresh, setFresh] = useState<{ name: string; link: Link } | null>(null);

  const look = useCallback(async () => {
    try {
      const keys = await myEpochKeys(ring, area.areaId);
      const areaKey = keys.get(area.currentEpoch) ?? null;
      setKey(areaKey);

      const { seats } = await loadSeats(area.areaId);

      if (areaKey === null) {
        setRows(seats.map((row) => ({ row, personal: null, internal: null })));
        return;
      }

      const opened: Shown[] = [];
      for (const row of seats) {
        opened.push({ row, ...await openAsOffice(row, areaKey) });
      }
      setRows(opened);
      setFailed(null);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać miejsc.');
    }
  }, [ring, area.areaId, area.currentEpoch]);

  useEffect(() => { void look(); }, [look]);

  const act = async (what: string, todo: () => Promise<unknown>) => {
    setBusy(what);
    setFailed(null);

    try {
      await todo();
      await look();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się.');
    } finally {
      setBusy(null);
    }
  };

  if (key === null) {
    return (
      <p className="wk-note">
        Nie masz klucza tej epoki — miejsca są widoczne, ale ich treść nie.
      </p>
    );
  }

  return (
    <>
      <h3 className="wk-h2">Miejsca</h3>

      {failed !== null && <p className="wk-error">{failed}</p>}
      {busy !== null && <p className="wk-hint">{busy}</p>}

      {fresh !== null && <FreshLink fresh={fresh} onClose={() => setFresh(null)} />}

      {rows.length === 0 ? (
        <p className="wk-empty">Jeszcze żadnego.</p>
      ) : (
        <ul className="wk-list">
          {rows.map((one) => (
            <SeatItem
              key={one.row.seatId}
              shown={one}
              areaKey={key}
              busy={busy !== null}
              onAct={act}
            />
          ))}
        </ul>
      )}

      <NewSeatForm
        areaId={area.areaId}
        areaKey={key}
        epoch={area.currentEpoch}
        ownerRoleId={ownerRoleId}
        busy={busy !== null}
        onIssued={(name, link) => { setFresh({ name, link }); void look(); }}
        onError={setFailed}
      />
    </>
  );
}

/* -- Der frische Link ------------------------------------------------------- */

/**
 * Er steht hier EINMAL.
 *
 * Kein „später ansehen": gespeichert ist nur der Abdruck. Das gehört gesagt,
 * solange der Link noch auf dem Bildschirm ist — danach ist es eine Ausrede.
 */
function FreshLink({ fresh, onClose }: { fresh: { name: string; link: Link }; onClose: () => void }) {
  const href = `${window.location.origin}${window.location.pathname}${seatPath(fresh.link)}`;
  const [copied, setCopied] = useState(false);

  return (
    <section className="wk-form">
      <h3 className="wk-h2">Link dla: {fresh.name === '' ? 'bez nazwy' : fresh.name}</h3>

      <p className="wk-hint">
        <strong>Ten link widzisz tylko teraz.</strong> Zapisany jest wyłącznie
        jego odcisk — nikt go nie odtworzy, także prowadzący usługę. Skopiuj go i
        wyślij; jeśli zginie, wystaw nowy.
      </p>

      <textarea readOnly rows={3} value={href} className="wk-mono" />

      <div className="wk-actions">
        <button
          type="button" className="wk-btn"
          onClick={() => {
            void navigator.clipboard?.writeText(href).then(() => setCopied(true)).catch(() => setCopied(false));
          }}
        >
          {copied ? 'Skopiowano' : 'Kopiuj'}
        </button>
        <button type="button" className="wk-link-btn" onClick={onClose}>Ukryj</button>
      </div>
    </section>
  );
}

/* -- Ein Platz -------------------------------------------------------------- */

function SeatItem({ shown, areaKey, busy, onAct }: {
  shown: Shown;
  areaKey: Uint8Array;
  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [personal, setPersonal] = useState(shown.personal ?? '');
  const [internal, setInternal] = useState(shown.internal ?? '');

  const row = shown.row;
  const gone = row.revokedAt !== null;

  const save = async () => {
    const seatKey = await seatKeyOfRow(row, areaKey);
    await setNotes(row.seatId, areaKey, seatKey, { personal, internal });
  };

  return (
    <li className="wk-row">
      <span>
        <strong>{row.recipientName ?? 'bez nazwy'}</strong>
        <span className="wk-row-side">
          {gone ? ' · wycofany' : ''}
          {row.holders > 0 ? ` · przypisany (${row.holders})` : ' · nieprzypisany'}
          {` · otwarć: ${row.viewCount}`}
        </span>

        {open && !gone && (
          <div className="wk-form">
            <label className="wk-field">
              <span>Dla uczestnika — on to widzi</span>
              <textarea rows={4} value={personal} onChange={(e) => setPersonal(e.target.value)} />
            </label>

            <label className="wk-field">
              <span>Notatka wewnętrzna — on tego nie widzi</span>
              <textarea rows={3} value={internal} onChange={(e) => setInternal(e.target.value)} />
            </label>

            <p className="wk-hint">
              Pierwsze pole pieczętuje klucz <em>tego</em> miejsca, drugie —
              klucz epoki obszaru. Dlatego uczestnik otwiera jedno, a drugiego
              nie: to wynika z kluczy, nie z ustawienia.
            </p>

            <div className="wk-actions">
              <button
                type="button" className="wk-btn" disabled={busy}
                onClick={() => void onAct('Zapisywanie…', save)}
              >
                Zapisz
              </button>

              <button
                type="button" className="wk-link-btn" disabled={busy}
                onClick={() => void onAct('Wycofywanie…', () => revokeSeat(row.seatId))}
              >
                Wycofaj link
              </button>
            </div>

            <p className="wk-hint">
              Wycofanie unieważnia link. Kto przypisał miejsce do konta, dalej
              ma do niego dostęp — zabierasz kartkę, nie człowieka.
            </p>
          </div>
        )}
      </span>

      {!gone && (
        <button type="button" className="wk-link-btn" onClick={() => setOpen(!open)}>
          {open ? 'Zamknij' : 'Otwórz'}
        </button>
      )}
    </li>
  );
}

/* -- Ausstellen ------------------------------------------------------------- */

function NewSeatForm({ areaId, areaKey, epoch, ownerRoleId, busy, onIssued, onError }: {
  areaId: string;
  areaKey: Uint8Array;
  epoch: number;
  ownerRoleId: string;
  busy: boolean;
  onIssued: (name: string, link: Link) => void;
  onError: (message: string | null) => void;
}) {
  const [name, setName] = useState('');
  const [personal, setPersonal] = useState('');
  const [working, setWorking] = useState(false);

  const go = async () => {
    setWorking(true);
    onError(null);

    try {
      const { link } = await issueSeat({
        areaId, areaKey, epoch, ownerRoleId,
        recipientName: name.trim() === '' ? undefined : name.trim(),
        personalNote: personal.trim() === '' ? undefined : personal.trim()
      });

      onIssued(name.trim(), link);
      setName('');
      setPersonal('');
    } catch (e) {
      onError(e instanceof WorkspaceError ? e.message : 'Nie udało się wystawić miejsca.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <form className="wk-form" onSubmit={(e) => { e.preventDefault(); void go(); }}>
      <h3 className="wk-h2">Wystaw miejsce</h3>

      <label className="wk-field">
        <span>Dla kogo</span>
        <input
          value={name}
          placeholder="np. Anna Nowak"
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      {/*
        Der Name ist KLARTEXT, und das gehört gesagt: der Ausstellende muss den
        Link zuordnen können, bevor er ihn verschickt. Wer das nicht will,
        lässt das Feld leer.
      */}
      <p className="wk-hint">
        To pole jest jawne — służy Tobie, żeby wiedzieć, komu wysłałeś który
        link. Możesz je zostawić puste.
      </p>

      <label className="wk-field">
        <span>Co ma zobaczyć (można później)</span>
        <textarea rows={3} value={personal} onChange={(e) => setPersonal(e.target.value)} />
      </label>

      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={busy || working}>
          {working ? 'Wystawianie…' : 'Wystaw i pokaż link'}
        </button>
      </div>
    </form>
  );
}

export default Seats;
