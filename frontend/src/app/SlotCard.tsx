/**
 * Sich etwas für eine Zeit nehmen — ein Treffen mit dem Priester, ein Haus in
 * Hortus Dei. Ein Baustein, beide Fälle (0039).
 *
 * <b>Das Ding sagt, welcher Fall es ist.</b> Gibt die Kanzlei die Zeiten vor
 * (`offered`), steht hier eine Liste der Termine, und man nimmt einen. Wählt,
 * wer fragt, die Zeit selbst (`open`), steht hier, was belegt ist, und darunter
 * die Frage nach einer eigenen Zeit. Beides endet an derselben Stelle: „Twoje
 * rezerwacje", mit dem, was steht, und dem, was noch wartet.
 *
 * <b>FÜR WEN, sagt die Seite</b> (`usePerson`, 0045): ein Platz aus einem
 * Link, oder — angemeldet — eine eigene Person aus der Rollenkarte. Hier stand
 * vorher eine eigene Auswahl „Za kogo"; jetzt gibt es eine für die ganze
 * Seite, oben.
 *
 * <b>Die Regeln stehen da, bevor man klickt</b>: wie viele auf einen Termin
 * passen, wie viele Termine einer halten darf, wie lange der Erste Gastgeber
 * ist. Wer an der Grenze ist, TAUSCHT — in einem Schritt, ohne den eigenen
 * Termin erst herzugeben.
 */

import { useCallback, useEffect, useState } from 'react';

import { usePerson } from './pagePerson';
import {
  askToJoin, hostDecides, loadOffers, minutesToTime, nightsToSpan, openInvite, releaseClaim,
  takeOffer, takeSpan, type Busy, type Holder, type MyClaim, type Offer, type Offers, type Rules
} from './resource';
import { useSeats } from './seatContext';
import { WorkspaceError } from './session';

/** Wer auf dieser Seite nimmt — aus der Wahl oben, sonst der eine geöffnete Platz. */
function useHolder(): Holder | null {
  const person = usePerson();
  const seats = useSeats();

  if (person === null) {
    const seat = seats[0];
    return seat === undefined ? null : { kind: 'seat', token: seat.token, key: seat.seatKey };
  }

  const chosen = person.chosen;
  if (chosen === null) return null;

  if (chosen.kind === 'seat') return { kind: 'seat', token: chosen.seat.token, key: chosen.seat.seatKey };

  try {
    return { kind: 'role', roleId: chosen.id, key: chosen.ring.keyOf(chosen.id), name: chosen.name };
  } catch {
    return null;
  }
}

const holderId = (holder: Holder | null) =>
  holder === null ? null : holder.kind === 'seat' ? holder.token : holder.roleId;

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

  /** Der Code des zuletzt genommenen Termins. */
  const [fresh, setFresh] = useState<{ code: string; until: string | null; kept: boolean } | null>(null);

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

  /* Wer umschaltet, sieht den Code des anderen nicht mehr. */
  useEffect(() => { setFresh(null); }, [id]);

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
    return <>{heading}{failed !== null ? <p className="wk-error">{failed}</p> : <p className="wk-card-text">Wczytywanie…</p>}</>;
  }

  const rules = data.resource;

  /* Was dieser Halter noch hält — die Grenze je Mensch zählt nur das (0045). */
  const now = Date.now();
  const held = data.mine.filter((c) => (c.status === 'pending' || c.status === 'confirmed')
    && new Date(c.endsAt).getTime() > now);
  const atLimit = rules.perPerson > 0 && held.length >= rules.perPerson;

  return (
    <>
      {heading}

      <Rules rules={rules} />

      {holder === null && (
        <p className="wk-card-muted">
          {person !== null && person.options.length > 0
            ? 'Wybierz u góry strony, za kogo chcesz się zapisać.'
            : rules.mode === 'offered'
              ? 'Tu osoba wybierze swój termin — po otwarciu swojego linku albo po zalogowaniu.'
              : 'Tu można zapytać o termin — po wysłaniu formularza, z własnego linku, albo po zalogowaniu.'}
        </p>
      )}

      {failed !== null && <p className="wk-error">{failed}</p>}
      {busy !== null && <p className="wk-working">{busy}</p>}

      {fresh !== null && (
        <div className="wk-note">
          <p>
            <strong>Masz termin.</strong> Jesteś jego gospodarzem
            {fresh.until !== null && <> do <strong>{moment(fresh.until)}</strong></>} — do tego czasu
            dołączyć można tylko z Twoim kodem albo za Twoją zgodą. Podaj go, komu chcesz:
          </p>
          <p className="wk-code">{fresh.code}</p>
          <p className="wk-hint">
            {fresh.kept
              ? 'Kod znajdziesz też później niżej, w „Twoje rezerwacje".'
              : 'Widzisz go tylko teraz — zapisany jest wyłącznie jego odcisk.'}
            {fresh.until !== null && ' Potem wolne miejsca na tym terminie otworzą się dla wszystkich.'}
          </p>
          <button type="button" className="wk-link-btn" onClick={() => setFresh(null)}>Ukryj</button>
        </div>
      )}

      {holder !== null && (
        <Mine claims={data.mine} rules={rules} holder={holder} busy={busy !== null} onAct={act} />
      )}

      {holder !== null && rules.perPerson > 0 && (
        <p className="wk-hint">
          {atLimit
            ? `Masz już ${held.length === 1 ? 'swój termin' : `${held.length} terminy`} — możesz ${held.length === 1 ? 'go' : 'jeden z nich'} zamienić na inny.`
            : `Możesz wybrać ${rules.perPerson === 1 ? 'jeden termin' : `do ${rules.perPerson} terminów`}${held.length > 0 ? ` — masz ${held.length}` : ''}.`}
        </p>
      )}

      {rules.mode === 'offered' ? (
        <OfferList
          offers={data.offers ?? []}
          rules={rules}
          holder={holder}
          held={atLimit ? held : []}
          busy={busy !== null}
          onAct={act}
          onCode={setFresh}
        />
      ) : (
        <OpenAsk
          busyTimes={data.busy ?? []}
          rules={rules}
          holder={holder}
          atLimit={atLimit}
          busy={busy !== null}
          onAct={act}
        />
      )}
    </>
  );
}

/* -- Die Regeln, bevor man klickt ------------------------------------------ */

function Rules({ rules }: { rules: Rules }) {
  if (rules.mode !== 'offered') return null;

  const parts = [
    `na termin: ${rules.capacity} ${rules.capacity === 1 ? 'osoba' : rules.capacity < 5 ? 'osoby' : 'osób'}`,
    rules.perPerson === 0 ? null : `na osobę: ${rules.perPerson === 1 ? 'jeden termin' : `do ${rules.perPerson} terminów`}`,
    rules.inviteHours === 0 || rules.capacity < 2 ? null
      : `pierwszy zapisany przez ${rules.inviteHours} h sam dobiera pozostałych`
  ].filter((one): one is string => one !== null);

  return <p className="wk-row-side">{parts.join(' · ')}</p>;
}

/* -- Was ich halte -------------------------------------------------------- */

const STATUS_WORD: Record<MyClaim['status'], string> = {
  pending: 'czeka na odpowiedź',
  confirmed: 'potwierdzone',
  declined: 'odrzucone',
  released: 'oddane'
};

/**
 * Was dieser Halter hält — ZUERST, vor allem anderen.
 *
 * <b>Darum kommt man zurück.</b> Wer seinen Link ein zweites Mal öffnet, will
 * wissen, ob die Kanzlei ja gesagt hat — und, als Gastgeber, seinen Code noch
 * einmal sehen und wie lange er noch allein einlädt.
 */
function Mine({ claims, rules, holder, busy, onAct }: {
  claims: readonly MyClaim[];
  rules: Rules;
  holder: Holder;
  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
}) {
  if (claims.length === 0) return null;

  return (
    <section className="wk-panel">
      <h3 className="wk-h2">Twoje rezerwacje</h3>

      <ul className="wk-people">
        {claims.map((c) => (
          <li className="wk-person" key={c.claimId}>
            <span className="wk-person-who">
              <strong>{span(c.startsAt, c.endsAt, rules)}</strong>
            </span>

            <span className="wk-person-can">
              <span className={c.status === 'confirmed' ? 'wk-tag wk-tag-open' : 'wk-tag'}>
                {STATUS_WORD[c.status]}
                {c.awaits === 'host' && ' gospodarza'}
                {c.awaits === 'office' && ' kancelarii'}
              </span>
              {c.hosting && <span className="wk-tag">gospodarz</span>}
            </span>

            {(c.status === 'pending' || c.status === 'confirmed') && (
              <button
                type="button" className="wk-link-btn" disabled={busy}
                onClick={() => void onAct('Oddawanie…', () => releaseClaim(c.claimId, holder))}
              >
                {c.status === 'pending' ? 'Wycofaj' : 'Oddaj'}
              </button>
            )}

            {c.hosting && c.status !== 'released' && <HostInfo claim={c} holder={holder} />}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * WIE LANGE ER GASTGEBER IST — und sein Code, auf Verlangen.
 *
 * Der Code liegt versiegelt unter dem Schlüssel des Halters (0045); der Dienst
 * kann ihn nicht lesen. Ältere Termine haben ihn nicht — dann steht da, dass
 * er nur einmal zu sehen war.
 */
function HostInfo({ claim, holder }: { claim: MyClaim; holder: Holder }) {
  const [code, setCode] = useState<string | null | undefined>(undefined);
  const open = claim.inviteUntil !== null && new Date(claim.inviteUntil).getTime() > Date.now();

  return (
    <span className="wk-host-info">
      {claim.inviteUntil === null ? null : open ? (
        <>Jesteś gospodarzem do <strong>{moment(claim.inviteUntil)}</strong> — do tego czasu dołączyć można tylko z Twoim kodem. </>
      ) : (
        <>Czas gospodarza minął {moment(claim.inviteUntil)} — wolne miejsca są dostępne dla wszystkich. </>
      )}

      {open && (code === undefined ? (
        <button type="button" className="wk-link-btn"
          onClick={() => void openInvite(claim, holder).then(setCode)}>
          Pokaż kod
        </button>
      ) : code === null ? (
        <span className="wk-row-side">Kod był widoczny tylko przy zapisie.</span>
      ) : (
        <strong className="wk-code wk-code-inline">{code}</strong>
      ))}
    </span>
  );
}

/* -- Die Kanzlei gibt die Zeiten vor ---------------------------------------- */

const WORD: Record<Offer['state'], string> = {
  open: 'wolne',
  inviteneeded: 'trzyma je gospodarz',
  locked: 'zamknięte',
  full: 'pełne',
  mine: 'Twój termin'
};

function OfferList({ offers, rules, holder, held, busy, onAct, onCode }: {
  offers: readonly Offer[];
  rules: Rules;
  holder: Holder | null;
  /** Was er hält, WENN er an der Grenze ist — dann wird getauscht statt genommen. */
  held: readonly MyClaim[];
  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
  onCode: (code: { code: string; until: string | null; kept: boolean }) => void;
}) {
  if (offers.length === 0) return <p className="wk-empty">Nie ma teraz żadnych terminów do wyboru.</p>;

  return (
    <ul className="wk-list">
      {offers.map((one) => (
        <OfferRow
          key={`${one.itemId}:${one.occurrenceAt}`}
          offer={one}
          rules={rules}
          holder={holder}
          held={held}
          busy={busy}
          onAct={onAct}
          onCode={onCode}
        />
      ))}
    </ul>
  );
}

function OfferRow({ offer, rules, holder, held, busy, onAct, onCode }: {
  offer: Offer;
  rules: Rules;
  holder: Holder | null;
  held: readonly MyClaim[];
  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
  onCode: (code: { code: string; until: string | null; kept: boolean }) => void;
}) {
  const [code, setCode] = useState('');

  /* An der Grenze: WELCHEN er hergibt. Bei einem steht es fest. */
  const [instead, setInstead] = useState('');
  const swapping = held.length > 0;
  const replaces = swapping ? (instead !== '' ? instead : held[0].claimId) : undefined;

  const take = (withCode?: string) => holder !== null && void onAct(swapping ? 'Zamienianie…' : 'Zapisywanie…', async () => {
    const done = await takeOffer(rules.resourceId, offer, holder, withCode, replaces);
    if (done.inviteCode !== null) onCode({ code: done.inviteCode, until: done.inviteUntil, kept: holder.key !== null });
  });

  const swapPick = swapping && held.length > 1 && (
    <select value={instead} onChange={(e) => setInstead(e.target.value)} aria-label="Zamiast którego terminu">
      {held.map((c) => <option key={c.claimId} value={c.claimId}>zamiast {span(c.startsAt, c.endsAt, rules)}</option>)}
    </select>
  );

  return (
    <li className="wk-row">
      <span>
        <strong>{span(offer.startsAt, offer.endsAt, rules)}</strong>
        <span className="wk-row-side">
          {' · '}{offer.taken} z {offer.capacity} · {WORD[offer.state]}
          {offer.state === 'inviteneeded' && offer.inviteUntil !== null && ` do ${moment(offer.inviteUntil)}`}
        </span>

        {holder !== null && offer.state === 'open' && (
          <div className="wk-actions">
            {swapPick}
            <button type="button" className="wk-btn" disabled={busy} onClick={() => take()}>
              {swapping ? 'Zamień na ten' : 'Biorę'}
            </button>
          </div>
        )}

        {/*
          JEMAND HÄLT IHN — zwei Wege hinein, und beide stehen da: sein Code,
          oder eine Bitte an ihn. Nur den Code anzubieten hiesse, dass nur
          hineinkommt, wer den Gastgeber schon kennt.
        */}
        {holder !== null && offer.state === 'inviteneeded' && (
          <div className="wk-actions">
            {swapPick}
            <input
              value={code} placeholder="kod od gospodarza" style={{ width: '9rem' }}
              onChange={(e) => setCode(e.target.value)}
            />
            <button type="button" className="wk-btn" disabled={busy || code.trim() === ''}
              onClick={() => take(code)}>
              {swapping ? 'Zamień z kodem' : 'Dołączam'}
            </button>
            {!swapping && (
              <button type="button" className="wk-link-btn" disabled={busy}
                onClick={() => void onAct('Wysyłanie prośby…', () => askToJoin(rules.resourceId, offer, holder))}>
                albo poproś
              </button>
            )}
          </div>
        )}

        {/* Der Gastgeber entscheidet über die, die bitten. */}
        {holder !== null && offer.hosting && offer.asks.length > 0 && (
          <div className="wk-panel">
            {offer.asks.map((ask) => (
              <p className="wk-hint" key={ask.claimId}>
                Prosi o dołączenie: <strong>{ask.name ?? 'ktoś bez nazwy'}</strong>
                {' '}
                <button type="button" className="wk-link-btn" disabled={busy}
                  onClick={() => void onAct('Przyjmowanie…', () => hostDecides(ask.claimId, true, holder))}>
                  Przyjmij
                </button>
                {' · '}
                <button type="button" className="wk-link-btn" disabled={busy}
                  onClick={() => void onAct('Odmawianie…', () => hostDecides(ask.claimId, false, holder))}>
                  Odmów
                </button>
              </p>
            ))}
          </div>
        )}
      </span>
    </li>
  );
}

/* -- Wer fragt, wählt die Zeit ---------------------------------------------- */

/**
 * Eine eigene Zeit erfragen — nach Nächten oder nach Stunden.
 *
 * <b>Was belegt ist, steht darüber</b>, ohne Namen: wer fragt, soll nicht
 * raten und dann eine Absage bekommen. Die Prüfung macht trotzdem der Dienst —
 * diese Liste ist eine Hilfe, keine Zusage.
 */
function OpenAsk({ busyTimes, rules, holder, atLimit, busy, onAct }: {
  busyTimes: readonly Busy[];
  rules: Rules;
  holder: Holder | null;
  atLimit: boolean;
  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
}) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [day, setDay] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  const span_ = (): { starts: Date; ends: Date } | null => {
    if (rules.byNight) {
      if (from === '' || to === '' || to <= from) return null;
      return nightsToSpan(from, to, rules);
    }

    if (day === '' || start === '' || end === '' || end <= start) return null;
    return { starts: new Date(`${day}T${start}:00`), ends: new Date(`${day}T${end}:00`) };
  };

  const chosen = span_();

  return (
    <>
      <h3 className="wk-h2">Zajęte</h3>

      {busyTimes.length === 0 ? (
        <p className="wk-empty">Nic nie jest zajęte w najbliższym czasie.</p>
      ) : (
        <ul className="wk-card-lines">
          {busyTimes.map((b, i) => (
            <li key={i}>
              {span(b.startsAt, b.endsAt, rules)}
              {b.tentative && <span className="wk-row-side"> · wstępnie</span>}
              {b.whole && <span className="wk-row-side"> · całość zajęta</span>}
            </li>
          ))}
        </ul>
      )}

      {holder !== null && !atLimit && (
        <div className="wk-form">
          <h3 className="wk-h2">Zapytaj o termin</h3>

          {rules.byNight ? (
            <>
              <label className="wk-field">
                <span>Przyjazd (od {minutesToTime(rules.checkInMin)})</span>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label className="wk-field">
                <span>Wyjazd (do {minutesToTime(rules.checkOutMin)})</span>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </label>
            </>
          ) : (
            <>
              <label className="wk-field">
                <span>Dzień</span>
                <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
              </label>
              <div className="wk-actions">
                <label className="wk-field"><span>Od</span>
                  <input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></label>
                <label className="wk-field"><span>Do</span>
                  <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
              </div>
            </>
          )}

          {(rules.bufferBefore > 0 || rules.bufferAfter > 0) && (
            <p className="wk-hint">
              Między grupami jest czas na przygotowanie — {rules.bufferBefore + rules.bufferAfter} min.
            </p>
          )}

          <div className="wk-actions">
            <button
              type="button" className="wk-btn" disabled={busy || chosen === null}
              onClick={() => chosen !== null && void onAct('Wysyłanie…',
                () => takeSpan(rules.resourceId, chosen.starts, chosen.ends, holder))}
            >
              {rules.approval === 'office' ? 'Zapytaj' : 'Rezerwuję'}
            </button>

            {rules.approval === 'office' && (
              <span className="wk-row-side">Kancelaria odpowie — zobaczysz to tutaj.</span>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* -- Kleinkram ------------------------------------------------------------- */

/** Ein Zeitpunkt, wie man ihn liest: „sob., 26 września, 19:00". */
function moment(at: string): string {
  const d = new Date(at);
  return `${d.toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'long' })}, ${
    d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`;
}

/** Wie eine Zeit gelesen wird — ein Tag mit Uhrzeit, oder von einer Nacht zur nächsten. */
function span(startsAt: string, endsAt: string, rules: Rules): string {
  const s = new Date(startsAt);
  const e = new Date(endsAt);

  const date = (d: Date) => d.toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'long' });
  const time = (d: Date) => d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

  if (rules.byNight) return `${date(s)} → ${date(e)}`;

  return s.toDateString() === e.toDateString()
    ? `${date(s)}, ${time(s)}–${time(e)}`
    : `${date(s)} ${time(s)} → ${date(e)} ${time(e)}`;
}

export default SlotCard;
