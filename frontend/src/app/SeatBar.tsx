/**
 * Was zu einem geöffneten Platz gehört — gleich, auf welcher Seite er gilt.
 *
 * <b>Der Link öffnet jetzt die SEITE selbst</b> (`seatKeep.pageLink`), nicht
 * eine eingebaute Portalansicht unter ihr. Was die Portalansicht ausser den
 * persönlichen Abschnitten noch hatte — den eigenen Link zum Mitnehmen, das
 * Binden an ein Konto, die Auskunft, wenn der Link nicht aufgeht —, steht
 * deshalb hier und erscheint auf jeder Seite, auf der ein Platz offen ist.
 *
 * <code>
 *   SeatBar           oben auf der Seite: welcher Platz offen ist, und was damit geht
 *   PersonalSections  die eingebauten Abschnitte — wo die Seite keine eigenen hat
 *   MyLink, BindSeat  einzeln, für die Ansicht eines Platzes ohne Seite
 * </code>
 */

import { useEffect, useState, type ReactNode } from 'react';

import type { SealedRole } from './keys';
import { keysFor } from './ringOf';
import { bindSeat } from './seat';
import { seatName, useSeats, useSeatStates, type SeatView } from './seatContext';
import { freshSeat, linkTo } from './seatKeep';
import { whoIsThere, WorkspaceError, type Who } from './session';
import { OwnSubmissions } from './Submission';

/* -- Oben auf der Seite ----------------------------------------------------- */

/**
 * WELCHER PLATZ HIER OFFEN IST — und was nicht aufging.
 *
 * <b>Ohne Platz: nichts.</b> Ein Besucher ohne Link sieht die Seite, wie sie
 * ist; kein Kasten sagt ihm, dass er keinen hat.
 *
 * <b>Ein Link, der nicht aufgeht, sagt es — hier, und nur für den, der ihn
 * gerade angeklickt hat.</b> Ein behaltener Platz, der inzwischen abgelaufen
 * ist, schweigt: ihn hat niemand gerade gewollt.
 */
export function SeatBar({ path }: { path: string }) {
  const seats = useSeats();
  const states = useSeatStates();
  const fresh = freshSeat();

  const here = fresh !== null && fresh.under === path ? fresh : null;
  const state = here === null ? undefined : states.find((one) => one.token === here.token);

  const trouble = here === null ? null
    : here.keyless ? 'W tym linku brakuje klucza — widać stronę, ale nie Twoje dane. Otwórz pełny link, który dostałeś.'
    : state?.state === 'gone' ? `Twojego miejsca nie ma — link mógł zostać wycofany albo stracić ważność.${state.failed === null ? '' : ` ${state.failed}`}`
    : state?.state === 'locked' ? 'Klucz z linku nie pasuje do tego miejsca. Sprawdź, czy link nie urwał się przy kopiowaniu.'
    : null;

  if (trouble === null && seats.length === 0) return null;

  return (
    <div className="wk-seat-bar">
      {trouble !== null && <p className="wk-error">{trouble}</p>}

      {seats.filter((seat) => seat.seatKey !== null).map((seat, at) => (
        <details className="wk-fold wk-seat-fold" key={seat.token}>
          <summary>
            {seats.length === 1 ? 'Twoje miejsce' : `Miejsce: ${seatName(seat, at)}`}
            <span className="wk-row-side"> — otwarte na tym urządzeniu</span>
          </summary>

          <p className="wk-hint">
            Link jest kluczem, nie legitymacją: kto go ma, widzi Twoje dane na stronach
            tej organizacji. Nie przekazuj go dalej.
            {seat.expiresAt !== null && ` Działa do ${new Date(seat.expiresAt).toLocaleDateString('pl-PL',
              { day: 'numeric', month: 'long', year: 'numeric' })}.`}
          </p>

          <MyLink token={seat.token} />
          <BindSeat seat={seat} />
        </details>
      ))}
    </div>
  );
}

/* -- Die eingebauten Abschnitte --------------------------------------------- */

/**
 * NUR WAS DA IST — die persönlichen Abschnitte, wenn die Seite keine eigenen
 * Bausteine dafür hat.
 *
 * Wählt die Kanzlei als Seite nach dem Absenden eine, auf der kein
 * „Zgłoszenie osoby" liegt, sähe der Mensch nach dem Klick auf seinen Link
 * nichts von dem, was er geschickt hat. Also erscheint es dann hier — und nur
 * auf DER Seite, zu der sein Link geführt hat, nicht auf jeder des Hauses.
 */
export function PersonalSections({ seat }: { seat: SeatView }) {
  return (
    <>
      {seat.note !== null && (
        <Zone title="Od kancelarii" who="Widzisz to tylko Ty i kancelaria.">
          <p className="wk-card-text" style={{ whiteSpace: 'pre-wrap' }}>{seat.note}</p>
        </Zone>
      )}

      {seat.submitted.length > 0 && (
        <Zone title="Twoje zgłoszenie" who="Widzisz to Ty i kancelaria, która prowadzi zapisy.">
          {seat.opened.length === 0 ? (
            <p className="wk-empty">Bez klucza z adresu nie da się tego otworzyć.</p>
          ) : (
            <OwnSubmissions
              values={seat.submitted}
              open={seat.opened}
              token={seat.token}
              seatKey={seat.seatKey}
              formId={null}
              show={null}
              onSaved={seat.reload}
            />
          )}
        </Zone>
      )}

      {seat.shared.length > 0 && (
        <Zone title="Wspólne dla grupy" who={`Widzą to wszyscy: ${seat.sharedNames.join(', ')}.`}>
          <ul className="wk-tile-lines">
            {seat.shared.map((s, i) => (
              <li key={i}>
                <strong>{new Date(s.when).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}</strong>
                {' — '}
                {s.what ?? 'zapieczętowane'}
              </li>
            ))}
          </ul>
        </Zone>
      )}
    </>
  );
}

/**
 * Ein Abschnitt, der sagt, WER ihn sieht.
 *
 * Die Zeile darunter ist nicht Zierde: sie ist das Einzige, woran ein Mensch
 * die Teile auseinanderhält.
 */
export function Zone({ title, who, children }: { title: string; who: string; children: ReactNode }) {
  return (
    <section className="wk-form">
      <h2 className="wk-h2">{title}</h2>
      <p className="wk-row-side">{who}</p>
      {children}
    </section>
  );
}

/* -- Der eigene Link -------------------------------------------------------- */

/**
 * DER EIGENE LINK, auf Verlangen.
 *
 * <b>Die Kehrseite des Aufräumens.</b> Solange der Schlüssel in der
 * Adresszeile stand, WAR sie der Link. Ihn herauszunehmen, ohne einen Weg
 * zurück anzubieten, hiesse: der Mensch hätte eine Adresse, die bei ihm geht
 * und bei niemandem sonst.
 *
 * <b>Zugeklappt</b> — ein Geheimnis, das ungefragt auf dem Bildschirm steht,
 * wäre genau das Problem, das gerade behoben wurde.
 */
export function MyLink({ token, under }: { token: string; under?: string | null }) {
  const [shown, setShown] = useState(false);

  const local = linkTo(token, under);
  if (local === null) return null;

  const full = `${window.location.origin}${window.location.pathname}${local}`;

  return (
    <details className="wk-fold" onToggle={(e) => setShown(e.currentTarget.open)}>
      <summary>Twój link</summary>

      {shown && (
        <>
          <p className="wk-hint">
            Tym adresem wracasz tutaj — także na innym urządzeniu. Kto go ma,
            widzi Twoje dane, więc nie przekazuj go dalej.
          </p>

          <textarea readOnly rows={3} className="wk-mono" value={full} />
        </>
      )}
    </details>
  );
}

/* -- An ein Konto binden ---------------------------------------------------- */

/**
 * Den Platz an eine eigene Person binden — dann geht es ohne Link.
 *
 * Der Platzschlüssel wird in DIESEM Browser unter dem Schlüssel der Person
 * verpackt; der Dienst bekommt die fertige Hülle.
 */
export function BindSeat({ seat }: { seat: SeatView }) {
  const [who, setWho] = useState<Who | null | undefined>(undefined);
  const [persons, setPersons] = useState<readonly SealedRole[]>([]);
  const [chosen, setChosen] = useState('');
  const [busy, setBusy] = useState(false);
  const [bound, setBound] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void whoIsThere().then((found) => { if (alive) setWho(found); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (who === null || who === undefined) return;
    let alive = true;

    void keysFor(who)
      .then(({ graph }) => {
        if (!alive) return;
        const people = graph.roles.filter((r) => r.kind === 'person');
        setPersons(people);
        setChosen((current) => (current === '' ? (people[0]?.id ?? '') : current));
      })
      .catch(() => { if (alive) setPersons([]); });

    return () => { alive = false; };
  }, [who]);

  const bind = async () => {
    const person = persons.find((p) => p.id === chosen);
    if (person === undefined || seat.seatKey === null) return;

    setBusy(true);
    setFailed(null);

    try {
      await bindSeat(seat.token, seat.seatId, seat.seatKey, person);
      setBound(true);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się przypisać.');
    } finally {
      setBusy(false);
    }
  };

  if (bound) {
    return (
      <p className="wk-done">
        Gotowe. To miejsce jest teraz przypisane do Ciebie — znajdziesz je w
        swoim koncie, także bez tego linku.
      </p>
    );
  }

  if (seat.seatKey === null || who === undefined) return null;

  if (who === null) {
    return (
      <p className="wk-hint">
        Masz konto? Po zalogowaniu możesz przypisać to miejsce do siebie — wtedy
        dotrzesz do niego bez linku.
      </p>
    );
  }

  if (persons.length === 0) {
    return (
      <p className="wk-hint">
        Żeby przypisać to miejsce do siebie, potrzebujesz <strong>osoby</strong> —
        konto to pęk kluczy, nie człowiek. Załóż ją w zakładce „Role".
      </p>
    );
  }

  return (
    <form className="wk-form" onSubmit={(e) => { e.preventDefault(); void bind(); }}>
      <label className="wk-field">
        <span>Przypisz do siebie — kogo dotyczy to miejsce</span>
        <select value={chosen} onChange={(e) => setChosen(e.target.value)}>
          {persons.map((p) => (
            <option key={p.id} value={p.id}>Osoba · {p.id.slice(0, 8)}</option>
          ))}
        </select>
      </label>

      <p className="wk-hint">
        Klucz miejsca zostanie zapakowany kluczem tej osoby. Usługa nie
        uczestniczy w tym — dostaje gotową kopertę.
      </p>

      {failed !== null && <p className="wk-error">{failed}</p>}

      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={busy || chosen === ''}>
          {busy ? 'Przypisywanie…' : 'Przypisz'}
        </button>
      </div>
    </form>
  );
}
