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

export function Seats({ area, areas, ring, ownerRoleId }: {
  area: AreaRow;

  /**
   * Alle Bereiche dieses Menschen — für den GEMEINSAMEN Schlüssel.
   *
   * Eine Klasse braucht zwei: diesen hier für die Notizen, und einen zweiten
   * für das, was allen gilt. Läge beides unter einem, öffnete jeder Schüler mit
   * dem Gemeinsamen auch die Notizen über sich und alle anderen.
   */
  areas: readonly AreaRow[];

  ring: Ring;
  ownerRoleId: string;
}) {
  const [key, setKey] = useState<Uint8Array | null>(null);
  const [rows, setRows] = useState<readonly Shown[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  /** Der Link des zuletzt ausgestellten Platzes — einmal, dann nie wieder. */
  const [fresh, setFresh] = useState<{ name: string; link: Link; under: string | null } | null>(null);

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
        areas={areas.filter((a) => a.areaId !== area.areaId && a.heldEpochs > 0)}
        ring={ring}
        busy={busy !== null}
        onIssued={(name, link, under) => { setFresh({ name, link, under }); void look(); }}
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
function FreshLink({ fresh, onClose }: {
  fresh: { name: string; link: Link; under: string | null };
  onClose: () => void;
}) {
  const href = `${window.location.origin}${window.location.pathname}${seatPath(fresh.link, fresh.under)}`;
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

function NewSeatForm({ areaId, areaKey, epoch, ownerRoleId, areas, ring, busy, onIssued, onError }: {
  areaId: string;
  areaKey: Uint8Array;
  epoch: number;
  ownerRoleId: string;
  areas: readonly AreaRow[];
  ring: Ring;
  busy: boolean;
  onIssued: (name: string, link: Link, under: string | null) => void;
  onError: (message: string | null) => void;
}) {
  const [name, setName] = useState('');
  const [personal, setPersonal] = useState('');
  const [sharedId, setSharedId] = useState('');
  const [under, setUnder] = useState('');
  const [working, setWorking] = useState(false);

  const go = async () => {
    setWorking(true);
    onError(null);

    try {
      /*
       * Der gemeinsame Schlüssel, wenn einer gewählt wurde. Er wird unter dem
       * PLATZSCHLÜSSEL verpackt — damit liest der Schüler das Gemeinsame und
       * kommt trotzdem nicht an die Notizen, die in DIESEM Bereich liegen.
       */
      const shared: { areaId: string; areaKey: Uint8Array; epoch: number }[] = [];

      if (sharedId !== '') {
        const area = areas.find((a) => a.areaId === sharedId);
        if (area === undefined) throw new WorkspaceError('Nie ma takiego obszaru.');

        const keys = await myEpochKeys(ring, area.areaId);
        const key = keys.get(area.currentEpoch);

        if (key === undefined) {
          throw new WorkspaceError('Nie masz klucza tej epoki — nie da się go przekazać.');
        }

        shared.push({ areaId: area.areaId, areaKey: key, epoch: area.currentEpoch });
      }

      const page = under.trim().toLowerCase().replace(/^\/+|\/+$/g, '');

      const { link } = await issueSeat({
        areaId, areaKey, epoch, ownerRoleId,
        recipientName: name.trim() === '' ? undefined : name.trim(),
        personalNote: personal.trim() === '' ? undefined : personal.trim(),
        shared
      });

      onIssued(name.trim(), link, page === '' ? null : page);
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

      {/*
        DIE ZWEITE HÄLFTE DER KLASSE. Ohne sie hat der Schüler nur seinen
        eigenen Zettel; mit ihr sieht er auch, was allen gilt — und weiterhin
        nicht, was hier über ihn steht.
      */}
      {areas.length > 0 && (
        <>
          <label className="wk-field">
            <span>Klucz wspólny dla klasy</span>
            <select value={sharedId} onChange={(e) => setSharedId(e.target.value)}>
              <option value="">— tylko własne miejsce —</option>
              {areas.map((a) => <option key={a.areaId} value={a.areaId}>{a.name}</option>)}
            </select>
          </label>

          <p className="wk-hint">
            Klasa potrzebuje <strong>dwóch</strong> obszarów. Ten, w którym
            jesteś, trzyma notatki — uczeń ich nie widzi. Wybrany tutaj trzyma
            to, co wspólne: plan, terminy. Każde miejsce dostaje jego klucz
            zapakowany swoim własnym, więc uczeń widzi wspólne i nie widzi
            cudzego.
          </p>
        </>
      )}

      <label className="wk-field">
        <span>Adres strony (opcjonalnie)</span>
        <input
          value={under}
          placeholder="lo13"
          onChange={(e) => setUnder(e.target.value)}
        />
      </label>

      <p className="wk-hint">
        Podaj adres strony, a link będzie brzmiał{' '}
        <code>{(under.trim() || 'lo13')}/portal/…</code> zamiast{' '}
        <code>seat/…</code>. To tylko wygląd adresu — treść i klucze są te same.
      </p>

      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={busy || working}>
          {working ? 'Wystawianie…' : 'Wystaw i pokaż link'}
        </button>
      </div>
    </form>
  );
}

export default Seats;
