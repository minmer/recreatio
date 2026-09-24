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
 * <b>Ohne Platz nur ansehen.</b> Genommen wird mit dem Platz, den der Link
 * bringt — der Firmling hat seinen seit dem Formular, die Gruppe für Hortus
 * Dei bekommt ihren genauso: aus dem Formular „Zapytanie o pobyt". Auf einer
 * gewöhnlichen Seite ohne Link sagt der Baustein, wozu er da ist.
 */

import { useCallback, useEffect, useState } from 'react';

import {
  askToJoin, hostDecides, loadOffers, minutesToTime, nightsToSpan, releaseClaim,
  takeOffer, takeSpan, type Busy, type MyClaim, type Offer, type Offers, type Rules
} from './resource';
import { seatName, useSeats } from './seatContext';
import { WorkspaceError } from './session';

export function SlotCard({ title, resource }: {
  title: string;

  /** Das Ding. Leer, solange die Kanzlei keines gewählt hat. */
  resource: string;
}) {
  /*
   * WESSEN TERMIN. Wer mehrere Links geöffnet hat, hält mehrere Plätze —
   * und ein Termin gehört genau einem davon. Also wird gefragt, und zwar
   * nur dann, wenn es etwas zu wählen gibt.
   */
  const seats = useSeats();
  const [pick, setPick] = useState<string | null>(null);
  const seat = seats.find((one) => one.token === pick) ?? seats[0] ?? null;
  const token = seat?.token ?? null;

  const [data, setData] = useState<Offers | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  /** Der Code des zuletzt genommenen Termins — einmal, dann nie wieder. */
  const [fresh, setFresh] = useState<{ code: string; until: string | null } | null>(null);

  const named = resource !== '';

  const look = useCallback(async () => {
    if (!named) return;

    try {
      setData(await loadOffers(resource, token));
      setFailed(null);
    } catch (e) {
      setData(null);
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać terminów.');
    }
  }, [named, resource, token]);

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

  return (
    <>
      {heading}

      {seats.length > 1 && (
        <div className="wk-seat-pick">
          <span className="wk-hint">Za kogo:</span>
          <div className="wk-seg" role="group" aria-label="Za kogo">
            {seats.map((one, at) => (
              <button
                key={one.token}
                type="button"
                aria-pressed={one.token === token}
                className={one.token === token ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'}
                disabled={busy !== null || one.token === token}
                onClick={() => { setPick(one.token); setFresh(null); }}
              >
                {seatName(one, at)}
              </button>
            ))}
          </div>
        </div>
      )}

      {token === null && (
        <p className="wk-card-muted">
          {rules.mode === 'offered'
            ? 'Tu osoba wybierze swój termin — po otwarciu swojego linku.'
            : 'Tu można zapytać o termin — po wysłaniu formularza, z własnego linku.'}
        </p>
      )}

      {failed !== null && <p className="wk-error">{failed}</p>}
      {busy !== null && <p className="wk-working">{busy}</p>}

      {fresh !== null && (
        <div className="wk-note">
          <p>
            <strong>Masz termin.</strong> Przez {rules.inviteHours} godzin możesz dobrać do
            niego kogoś jeszcze — podaj mu ten kod:
          </p>
          <p className="wk-code">{fresh.code}</p>
          <p className="wk-hint">
            <strong>Widzisz go tylko teraz</strong> — zapisany jest wyłącznie jego odcisk.
            {fresh.until !== null && <> Po {new Date(fresh.until).toLocaleString('pl-PL')} termin
            otworzy się dla wszystkich, jeśli zostanie na nim wolne miejsce.</>}
          </p>
          <button type="button" className="wk-link-btn" onClick={() => setFresh(null)}>Ukryj</button>
        </div>
      )}

      <Mine claims={data.mine} rules={rules} token={token} busy={busy !== null} onAct={act} />

      {rules.mode === 'offered' ? (
        <OfferList
          offers={data.offers ?? []}
          rules={rules}
          token={token}
          busy={busy !== null}
          onAct={act}
          onCode={(code, until) => setFresh({ code, until })}
        />
      ) : (
        <OpenAsk
          busyTimes={data.busy ?? []}
          rules={rules}
          token={token}
          busy={busy !== null}
          onAct={act}
        />
      )}
    </>
  );
}

/* -- Was ich halte -------------------------------------------------------- */

const STATUS_WORD: Record<MyClaim['status'], string> = {
  pending: 'czeka na odpowiedź',
  confirmed: 'potwierdzone',
  declined: 'odrzucone',
  released: 'oddane'
};

/**
 * Was dieser Platz hält — ZUERST, vor allem anderen.
 *
 * <b>Darum kommt man zurück.</b> Wer seinen Link ein zweites Mal öffnet, will
 * wissen, ob die Kanzlei ja gesagt hat — nicht noch einmal die Liste aller
 * Termine sehen.
 */
function Mine({ claims, rules, token, busy, onAct }: {
  claims: readonly MyClaim[];
  rules: Rules;
  token: string | null;
  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
}) {
  if (claims.length === 0 || token === null) return null;

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
                onClick={() => void onAct('Oddawanie…', () => releaseClaim(c.claimId, token))}
              >
                {c.status === 'pending' ? 'Wycofaj' : 'Oddaj'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/* -- Die Kanzlei gibt die Zeiten vor ---------------------------------------- */

const WORD: Record<Offer['state'], string> = {
  open: 'wolne',
  inviteneeded: 'trzyma je ktoś inny',
  locked: 'zamknięte',
  full: 'pełne',
  mine: 'Twój termin'
};

function OfferList({ offers, rules, token, busy, onAct, onCode }: {
  offers: readonly Offer[];
  rules: Rules;
  token: string | null;
  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
  onCode: (code: string, until: string | null) => void;
}) {
  if (offers.length === 0) return <p className="wk-empty">Nie ma teraz żadnych terminów do wyboru.</p>;

  return (
    <ul className="wk-list">
      {offers.map((one) => (
        <OfferRow
          key={`${one.itemId}:${one.occurrenceAt}`}
          offer={one}
          rules={rules}
          token={token}
          busy={busy}
          onAct={onAct}
          onCode={onCode}
        />
      ))}
    </ul>
  );
}

function OfferRow({ offer, rules, token, busy, onAct, onCode }: {
  offer: Offer;
  rules: Rules;
  token: string | null;
  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
  onCode: (code: string, until: string | null) => void;
}) {
  const [code, setCode] = useState('');

  const take = (withCode?: string) => token !== null && void onAct('Zapisywanie…', async () => {
    const done = await takeOffer(rules.resourceId, offer, token, withCode);
    if (done.inviteCode !== null) onCode(done.inviteCode, done.inviteUntil);
  });

  return (
    <li className="wk-row">
      <span>
        <strong>{span(offer.startsAt, offer.endsAt, rules)}</strong>
        <span className="wk-row-side"> · {offer.taken} z {offer.capacity} · {WORD[offer.state]}</span>

        {token !== null && offer.state === 'open' && (
          <div className="wk-actions">
            <button type="button" className="wk-btn" disabled={busy} onClick={() => take()}>Biorę</button>
          </div>
        )}

        {/*
          JEMAND HÄLT IHN — zwei Wege hinein, und beide stehen da: sein Code,
          oder eine Bitte an ihn. Nur den Code anzubieten hiesse, dass nur
          hineinkommt, wer den Gastgeber schon kennt.
        */}
        {token !== null && offer.state === 'inviteneeded' && (
          <div className="wk-actions">
            <input
              value={code} placeholder="kod od gospodarza" style={{ width: '9rem' }}
              onChange={(e) => setCode(e.target.value)}
            />
            <button type="button" className="wk-btn" disabled={busy || code.trim() === ''}
              onClick={() => take(code)}>
              Dołączam
            </button>
            <button type="button" className="wk-link-btn" disabled={busy}
              onClick={() => void onAct('Wysyłanie prośby…', () => askToJoin(rules.resourceId, offer, token))}>
              albo poproś
            </button>
          </div>
        )}

        {/* Der Gastgeber entscheidet über die, die bitten. */}
        {token !== null && offer.hosting && offer.asks.length > 0 && (
          <div className="wk-panel">
            {offer.asks.map((ask) => (
              <p className="wk-hint" key={ask.claimId}>
                Prosi o dołączenie: <strong>{ask.name ?? 'ktoś bez nazwy'}</strong>
                {' '}
                <button type="button" className="wk-link-btn" disabled={busy}
                  onClick={() => void onAct('Przyjmowanie…', () => hostDecides(ask.claimId, true, token))}>
                  Przyjmij
                </button>
                {' · '}
                <button type="button" className="wk-link-btn" disabled={busy}
                  onClick={() => void onAct('Odmawianie…', () => hostDecides(ask.claimId, false, token))}>
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
function OpenAsk({ busyTimes, rules, token, busy, onAct }: {
  busyTimes: readonly Busy[];
  rules: Rules;
  token: string | null;
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

      {token !== null && (
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
                () => takeSpan(rules.resourceId, chosen.starts, chosen.ends, token))}
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
