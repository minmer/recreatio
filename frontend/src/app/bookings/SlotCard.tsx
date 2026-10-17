/**
 * Sich etwas für eine Zeit nehmen — ein Treffen mit dem Priester, ein Haus in
 * Hortus Dei. Ein Baustein, beide Fälle (0039).
 *
 * <b>Das Ding sagt, welcher Fall es ist.</b> Gibt die Kanzlei die Zeiten vor
 * (`offered`), steht hier eine Liste der Termine, und man nimmt einen. Wählt,
 * wer fragt, die Zeit selbst (`open`), steht hier, was belegt ist, und darunter
 * die Frage nach einer eigenen Zeit.
 *
 * <b>FÜR WEN, sagt die Seite</b> (`usePerson`, 0045): ein Platz aus einem
 * Link, oder — angemeldet — eine eigene Person aus der Rollenkarte.
 *
 * <b>Wie im Firmungsportal des Altbestands</b> (`ParishPage`, „Spotkanie
 * początkowe"), weil es dort funktioniert hat:
 *
 * <code>
 *   noch kein Termin     die Termine als Karten, und die Farbe sagt, was geht:
 *                          grün   frei — nimm ihn
 *                          gelb   ein Gastgeber hält ihn — mit seinem Code oder seiner Zustimmung
 *                          rot    voll oder geschlossen
 *   ein Termin gewählt   NUR er, mit allem, was dazugehört — die Liste erst
 *                        wieder auf „Zmień termin"
 * </code>
 *
 * <b>Wer Gastgeber ist, liest es in einem Satz</b> — bis wann, mit welchem
 * Code, und was er tun soll, wenn er niemanden einladen will: das Vorrecht
 * abgeben. Sonst hielte er die freien Plätze für nichts fest.
 */

import { useCallback, useEffect, useState } from 'react';

import { usePerson } from '../pages/pagePerson';
import { loadOffers, type Holder, type MyClaim, type Offers, type Rules } from './resource';
import { useSeats } from '../seats/seatContext';
import { WorkspaceError } from '../core/session';
import { Loading } from '../ui/Loading';
import { type Act, type Fresh, people, span } from './slotText';
import { OpenAsk, OpenMine } from './OpenClaims';
import { MyTerm } from './MyTerm';
import { OfferList } from './OfferList';

/** Wer auf dieser Seite nimmt — aus der Wahl oben, sonst der eine geöffnete Platz. */
function useHolder(): Holder | null {
  const person = usePerson();
  const seats = useSeats();

  if (person === null) {
    const seat = seats[0];
    return seat === undefined ? null : { kind: 'seat', token: seat.token, key: seat.seatKey, name: seat.recipientName };
  }

  const chosen = person.chosen;
  if (chosen === null) return null;

  if (chosen.kind === 'seat') return { kind: 'seat', token: chosen.seat.token, key: chosen.seat.seatKey, name: chosen.seat.recipientName };

  try {
    return { kind: 'role', roleId: chosen.id, key: chosen.ring.keyOf(chosen.id), name: chosen.name };
  } catch {
    return null;
  }
}

const holderId = (holder: Holder | null) =>
  holder === null ? null : holder.kind === 'seat' ? holder.token : holder.roleId;

const live = (c: MyClaim) => (c.status === 'pending' || c.status === 'confirmed')
  && new Date(c.endsAt).getTime() > Date.now();

export function SlotCard({ title, resource }: {
  title: string;

  /** Das Ding. Leer, solange die Kanzlei keines gewählt hat. */
  resource: string;
}) {
  const holder = useHolder();
  const id = holderId(holder);
  const person = usePerson();

  const [data, setData] = useState<Offers | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [fresh, setFresh] = useState<Fresh | null>(null);

  /**
   * Die Liste der Termine, obwohl schon einer gewählt ist — `replaces`: der,
   * der dabei getauscht wird, oder `null` für einen weiteren.
   */
  const [picking, setPicking] = useState<{ replaces: string | null } | null>(null);

  const named = resource !== '';

  const look = useCallback(async () => {
    if (!named) return;

    try {
      setData(await loadOffers(resource, holder));
      setFailed(null);
    } catch (e) {
      setData(null);
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać terminów.');
    }
    // `holder` ändert sich mit `id`; ihn selbst als Abhängigkeit hiesse, bei jedem Zeichnen neu zu laden.
  }, [named, resource, id]);

  useEffect(() => { void look(); }, [look]);

  /* Wer umschaltet, sieht weder den Code noch die offene Auswahl des anderen. */
  useEffect(() => { setFresh(null); setPicking(null); }, [id]);

  const act: Act = async (what, todo) => {
    setBusy(what);
    setFailed(null);

    try {
      await todo();
      await look();
    } catch (e) {
      /*
       * AUCH NACH EINEM NEIN NEU LADEN — meist hat sich in der Zwischenzeit
       * etwas geändert (jemand war schneller), und die Karten zeigten sonst
       * noch den alten Stand. Die Meldung erst danach: `look` räumt sie weg.
       */
      await look();
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się.');
    } finally {
      setBusy(null);
    }
  };

  const heading = <h2 className="wk-card-title">{title === '' ? (data?.resource.name ?? 'Terminy') : title}</h2>;

  if (!named) {
    return (
      <>
        {heading}
        <p className="wk-card-muted">Ten blok nie wie jeszcze, czego dotyczy — wybierz zasób w ustawieniach.</p>
      </>
    );
  }

  if (data === null) {
    return <>{heading}{failed !== null ? <p className="wk-error">{failed}</p> : <Loading label="Wczytywanie…" />}</>;
  }

  const rules = data.resource;
  const held = holder === null ? [] : data.mine.filter(live);
  const atLimit = rules.perPerson > 0 && held.length >= rules.perPerson;
  /* Am Zeitpunkt verglichen, nicht am Text: dieselbe Zeit kann mit anderem Versatz geschrieben stehen. */
  const offerOf = (c: MyClaim) => (data.offers ?? []).find((o) => o.itemId === c.itemId
    && c.occurrenceAt !== null && new Date(o.occurrenceAt).getTime() === new Date(c.occurrenceAt).getTime());

  /*
   * DER TERMIN, DER SCHON WAR. Er zählt nicht mehr als gehalten (`live`) —
   * aber wer ihn hatte, soll ihn sehen und nicht die Liste, als hätte er nie
   * gewählt. 0099: und dabei bleibt es — nach dem Termin ist der Baustein nur
   * noch zum Lesen (Wunsch der Kanzlei); vorher stand hier „Wybierz kolejny
   * termin".
   */
  const past = holder === null ? [] : data.mine
    .filter((c) => c.status === 'confirmed' && new Date(c.endsAt).getTime() <= Date.now())
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  const lastPast = held.length === 0 ? past[0] ?? null : null;

  /* Was abgelehnt wurde, bleibt als Satz — sonst wüsste man nicht, warum nichts dasteht. */
  const declined = holder === null ? [] : data.mine.filter((c) => c.status === 'declined' && new Date(c.endsAt).getTime() > Date.now());

  const status = (
    <>
      {failed !== null && <p className="wk-error">{failed}</p>}
      {busy !== null && <p className="wk-working">{busy}</p>}
    </>
  );

  if (rules.mode === 'open') {
    return (
      <>
        {heading}
        {holder === null && <Nobody person={person !== null && person.options.length > 0} rules={rules} />}
        {status}
        {holder !== null && <OpenMine claims={data.mine} rules={rules} holder={holder} busy={busy !== null} onAct={act} />}
        <OpenAsk
          busyTimes={data.busy ?? []}
          rules={rules}
          holder={holder}
          atLimit={atLimit}
          busy={busy !== null}
          onAct={act}
        />
      </>
    );
  }

  /* -- Angebotene Termine ---------------------------------------------------- */

  const choosing = (held.length === 0 && lastPast === null) || picking !== null;

  return (
    <>
      {heading}
      <RulesLine rules={rules} />

      {holder === null && <Nobody person={person !== null && person.options.length > 0} rules={rules} />}
      {status}

      {/* EIN TERMIN GEWÄHLT: nur er, mit allem, was dazugehört. */}
      {holder !== null && held.map((claim) => (
        <MyTerm
          key={claim.claimId}
          claim={claim}
          offer={offerOf(claim)}
          rules={rules}
          holder={holder}
          fresh={fresh?.claimId === claim.claimId ? fresh : null}
          picking={picking !== null}
          busy={busy !== null}
          onAct={act}
          onPick={(replaces) => setPicking({ replaces })}
        />
      ))}

      {/*
        Abgelehnt ODER abgesagt: steht der Termin nicht mehr im Angebot, hat
        die Kanzlei ihn entfernt — das ist etwas anderes als ein „nein".
      */}
      {declined.map((c) => (
        <p className="wk-note" key={c.claimId}>
          {offerOf(c) === undefined
            ? <>Termin {span(c.startsAt, c.endsAt, rules)} został odwołany — wybierz inny.</>
            : <>Prośba o termin {span(c.startsAt, c.endsAt, rules)} nie została przyjęta — wybierz inny.</>}
        </p>
      ))}

      {lastPast !== null && picking === null && (
        <article className="wk-slot is-mine is-past">
          <p className="wk-slot-label">Twój termin</p>
          <p className="wk-slot-when">{span(lastPast.startsAt, lastPast.endsAt, rules)}</p>
          <p className="wk-slot-note">Ten termin już się odbył.</p>
        </article>
      )}

      {holder !== null && held.length > 0 && picking === null && !atLimit && (
        <div className="wk-actions">
          <button type="button" className="wk-link-btn" disabled={busy !== null}
            onClick={() => setPicking({ replaces: null })}>
            Wybierz jeszcze jeden termin
          </button>
        </div>
      )}

      {choosing && (
        <>
          {picking !== null && (
            <div className="wk-slot-pickhead">
              <strong>{picking.replaces === null ? 'Wybierz kolejny termin' : 'Wybierz nowy termin'}</strong>
              {picking.replaces !== null && (
                <span className="wk-row-side"> — dotychczasowy zwolnisz dopiero, gdy nowy będzie Twój.</span>
              )}
              {' '}
              <button type="button" className="wk-link-btn" onClick={() => setPicking(null)}>Anuluj</button>
            </div>
          )}

          <Legend rules={rules} />

          <OfferList
            offers={(data.offers ?? []).filter((o) => o.state !== 'mine' || picking === null)}
            rules={rules}
            holder={holder}
            replaces={picking?.replaces ?? null}
            busy={busy !== null}
            onAct={act}
            onTaken={(claimId, code, kept) => {
              if (code !== null) setFresh({ claimId, code, kept });
              setPicking(null);
            }}
          />
        </>
      )}
    </>
  );
}

/** Ohne Halter: wofür der Baustein da ist — oder dass oben zu wählen ist. */
function Nobody({ person, rules }: { person: boolean; rules: Rules }) {
  return (
    <p className="wk-card-muted">
      {person
        ? 'Wybierz u góry strony, za kogo chcesz się zapisać.'
        : rules.mode === 'offered'
          ? 'Tu osoba wybierze swój termin — po otwarciu swojego linku albo po zalogowaniu.'
          : 'Tu można zapytać o termin — po wysłaniu formularza, z własnego linku, albo po zalogowaniu.'}
    </p>
  );
}

function RulesLine({ rules }: { rules: Rules }) {
  const parts = [
    `na termin: ${people(rules.capacity)}`,
    rules.perPerson === 0 ? null : `na osobę: ${rules.perPerson === 1 ? 'jeden termin' : `do ${rules.perPerson} terminów`}`,
    rules.inviteHours === 0 || rules.capacity < 2 ? null
      : `pierwszy zapisany może przez ${rules.inviteHours} h sam dobierać pozostałych`,
    rules.inviteHours === 0 || rules.capacity < 2 ? null
      : `grupa od ${rules.minPersons} ${rules.minPersons === 1 ? 'osoby' : 'osób'} zatrzymuje termin dla siebie`
  ].filter((one): one is string => one !== null);

  return <p className="wk-row-side">{parts.join(' · ')}</p>;
}

/** Was die Farben heissen — einmal, über der Liste. */
function Legend({ rules }: { rules: Rules }) {
  return (
    <p className="wk-slot-legend">
      <span className="wk-slot-dot is-free" /> wolny
      {rules.inviteHours > 0 && rules.capacity > 1 && <><span className="wk-slot-dot is-hosted" /> z gospodarzem — nie do wybrania, tylko prośba albo kod</>}
      <span className="wk-slot-dot is-closed" /> pełny albo zamknięty
    </p>
  );
}
