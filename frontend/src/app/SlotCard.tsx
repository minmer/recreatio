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

import { usePerson } from './pagePerson';
import {
  askToJoin, hostDecides, loadOffers, minutesToTime, nightsToSpan, openInvite, releaseClaim,
  resignHost, takeOffer, takeSpan, type Busy, type Holder, type MyClaim, type Offer, type Offers,
  type Rules
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

type Act = (what: string, todo: () => Promise<unknown>) => Promise<void>;

/** Der Code, der eben entstand — für DIESEN Anspruch, damit er an seiner Karte steht. */
interface Fresh { readonly claimId: string; readonly code: string; readonly kept: boolean }

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
  const held = holder === null ? [] : data.mine.filter(live);
  const atLimit = rules.perPerson > 0 && held.length >= rules.perPerson;
  /* Am Zeitpunkt verglichen, nicht am Text: dieselbe Zeit kann mit anderem Versatz geschrieben stehen. */
  const offerOf = (c: MyClaim) => (data.offers ?? []).find((o) => o.itemId === c.itemId
    && c.occurrenceAt !== null && new Date(o.occurrenceAt).getTime() === new Date(c.occurrenceAt).getTime());

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

  const choosing = held.length === 0 || picking !== null;

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

      {declined.map((c) => (
        <p className="wk-note" key={c.claimId}>
          Prośba o termin {span(c.startsAt, c.endsAt, rules)} nie została przyjęta — wybierz inny.
        </p>
      ))}

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

/* -- Die Regeln, bevor man klickt ------------------------------------------ */

const people = (n: number) => `${n} ${n === 1 ? 'osoba' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'osoby' : 'osób'}`;

function RulesLine({ rules }: { rules: Rules }) {
  const parts = [
    `na termin: ${people(rules.capacity)}`,
    rules.perPerson === 0 ? null : `na osobę: ${rules.perPerson === 1 ? 'jeden termin' : `do ${rules.perPerson} terminów`}`,
    rules.inviteHours === 0 || rules.capacity < 2 ? null
      : `pierwszy zapisany przez ${rules.inviteHours} h sam dobiera pozostałych`
  ].filter((one): one is string => one !== null);

  return <p className="wk-row-side">{parts.join(' · ')}</p>;
}

/** Was die Farben heissen — einmal, über der Liste. */
function Legend({ rules }: { rules: Rules }) {
  return (
    <p className="wk-slot-legend">
      <span className="wk-slot-dot is-free" /> wolny
      {rules.inviteHours > 0 && rules.capacity > 1 && <><span className="wk-slot-dot is-hosted" /> z gospodarzem — kod albo zgoda</>}
      <span className="wk-slot-dot is-closed" /> pełny albo zamknięty
    </p>
  );
}

/* -- Mein Termin ------------------------------------------------------------ */

const WAITS: Record<string, string> = {
  office: 'czeka na potwierdzenie kancelarii',
  host: 'czeka na zgodę gospodarza'
};

/**
 * DER GEWÄHLTE TERMIN — und alles, was dazugehört, an einer Stelle.
 *
 * <b>Als Gastgeber steht da, was es heisst</b>: bis wann, sein Code, wer ihn
 * bittet — und der Satz für den, der niemanden mitbringen will: das Vorrecht
 * abgeben, dann gehören die freien Plätze sofort allen.
 */
export function MyTerm({ claim, offer, rules, holder, fresh, picking, busy, onAct, onPick }: {
  claim: MyClaim;
  offer: Offer | undefined;
  rules: Rules;
  holder: Holder;
  fresh: Fresh | null;
  picking: boolean;
  busy: boolean;
  onAct: Act;
  onPick: (replaces: string) => void;
}) {
  const [code, setCode] = useState<string | null | undefined>(fresh?.code);
  const [copied, setCopied] = useState(false);
  const [asking, setAsking] = useState<'leave' | 'unhost' | null>(null);

  useEffect(() => { if (fresh !== null) setCode(fresh.code); }, [fresh]);

  const minutes = Math.round((new Date(claim.endsAt).getTime() - new Date(claim.startsAt).getTime()) / 60000);
  const hostOpen = claim.hosting && claim.inviteUntil !== null && new Date(claim.inviteUntil).getTime() > Date.now();
  const left = offer === undefined ? null : Math.max(0, offer.capacity - offer.taken);

  const copy = async () => {
    if (code == null) return;
    try { await navigator.clipboard.writeText(code); setCopied(true); } catch { /* ohne Zwischenablage steht er ja da */ }
  };

  return (
    <article className={`wk-slot is-mine${claim.status === 'pending' ? ' is-waiting' : ''}`}>
      <p className="wk-slot-label">Twój termin</p>
      <p className="wk-slot-when">{span(claim.startsAt, claim.endsAt, rules)}</p>
      <p className="wk-slot-note">
        {!rules.byNight && `Czas: ${minutes} min`}
        {offer !== undefined && ` · Zajętość: ${offer.taken}/${offer.capacity}`}
        {' · '}
        <span className={claim.status === 'confirmed' ? 'wk-slot-ok' : 'wk-slot-wait'}>
          {claim.status === 'confirmed' ? 'potwierdzony' : WAITS[claim.awaits ?? 'office'] ?? 'czeka'}
        </span>
      </p>

      {/* -- Gastgeber ---------------------------------------------------- */}
      {hostOpen && (
        <div className="wk-slot-host">
          <p>
            <strong>Jesteś gospodarzem tego terminu</strong> do <strong>{moment(claim.inviteUntil!)}</strong>.
            {left !== null && left > 0
              ? ` Do tego czasu ${left === 1 ? 'wolne miejsce zajmie' : `${left} wolne miejsca zajmą`} tylko osoby z Twoim kodem albo te, które przyjmiesz. Potem otworzą się dla wszystkich.`
              : ' Termin jest już pełny.'}
          </p>

          {left !== null && left > 0 && (
            <div className="wk-slot-code">
              {code === undefined ? (
                <button type="button" className="wk-link-btn"
                  onClick={() => void openInvite(claim, holder).then(setCode)}>
                  Pokaż kod zaproszenia
                </button>
              ) : code === null ? (
                <span className="wk-row-side">Kod był widoczny tylko przy zapisie — nie da się go już odczytać.</span>
              ) : (
                <>
                  <span>Kod zaproszenia:</span>
                  <strong className="wk-code wk-code-inline">{code}</strong>
                  <button type="button" className="wk-link-btn" onClick={() => void copy()}>
                    {copied ? 'Skopiowano' : 'Kopiuj kod'}
                  </button>
                  {fresh !== null && !fresh.kept && (
                    <span className="wk-row-side">Zapisz go teraz — potem nie da się go już odczytać.</span>
                  )}
                </>
              )}
            </div>
          )}

          {/* Wer bittet — der Gastgeber entscheidet. */}
          {offer !== undefined && offer.asks.length > 0 && (
            <div className="wk-slot-asks">
              <strong>Prośby o dołączenie</strong>
              {offer.asks.map((ask) => (
                <p key={ask.claimId}>
                  {ask.name ?? 'ktoś bez nazwy'}
                  {' — '}
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

          {/* DER KLARE SATZ für den, der niemanden mitbringen will. */}
          {left !== null && left > 0 && (asking === 'unhost' ? (
            <p className="wk-slot-confirm">
              Wolne miejsca od razu będą dostępne dla wszystkich, a Twój kod przestanie działać.
              {offer !== undefined && offer.asks.length > 0 && ' Osoby, które prosiły o dołączenie, zostaną przyjęte po kolei, dopóki starczy miejsc.'}
              {' '}
              <button type="button" className="wk-btn" disabled={busy}
                onClick={() => void onAct('Rezygnowanie z uprawnień…', () => resignHost(claim.claimId, holder))}>
                Tak, rezygnuję z uprawnień gospodarza
              </button>
              {' '}
              <button type="button" className="wk-link-btn" onClick={() => setAsking(null)}>Nie</button>
            </p>
          ) : (
            <p className="wk-slot-resign">
              Nie chcesz nikogo zapraszać? Zrezygnuj z uprawnień gospodarza — wolne miejsca od razu
              otworzą się dla wszystkich.{' '}
              <button type="button" className="wk-link-btn" disabled={busy} onClick={() => setAsking('unhost')}>
                Zrezygnuj z uprawnień gospodarza
              </button>
            </p>
          ))}
        </div>
      )}

      {claim.hosting && !hostOpen && claim.inviteUntil !== null && (
        <p className="wk-slot-note">Czas gospodarza minął {moment(claim.inviteUntil)} — wolne miejsca są dostępne dla wszystkich.</p>
      )}

      {/* -- Ändern, zurückgeben ------------------------------------------ */}
      {asking === 'leave' ? (
        <p className="wk-slot-confirm">
          Na pewno zrezygnować z tego terminu? Miejsce zwolni się dla innych.{' '}
          <button type="button" className="wk-btn" disabled={busy}
            onClick={() => void onAct('Rezygnowanie…', () => releaseClaim(claim.claimId, holder))}>
            Tak, rezygnuję
          </button>
          {' '}
          <button type="button" className="wk-link-btn" onClick={() => setAsking(null)}>Nie</button>
        </p>
      ) : !picking && (
        <div className="wk-actions">
          <button type="button" className="wk-btn wk-btn-quiet" disabled={busy} onClick={() => onPick(claim.claimId)}>
            Zmień termin
          </button>
          <button type="button" className="wk-link-btn" disabled={busy} onClick={() => setAsking('leave')}>
            {claim.status === 'pending' ? 'Wycofaj prośbę' : 'Zrezygnuj z terminu'}
          </button>
        </div>
      )}
    </article>
  );
}

/* -- Die Termine zur Wahl --------------------------------------------------- */

const SHADE: Record<Offer['state'], string> = {
  open: 'is-free',
  inviteneeded: 'is-hosted',
  locked: 'is-closed',
  full: 'is-closed',
  mine: 'is-mine'
};

export function OfferList({ offers, rules, holder, replaces, busy, onAct, onTaken }: {
  offers: readonly Offer[];
  rules: Rules;
  holder: Holder | null;
  /** Wird getauscht? Dann gibt die Wahl den eigenen Termin in demselben Schritt her. */
  replaces: string | null;
  busy: boolean;
  onAct: Act;
  onTaken: (claimId: string, code: string | null, kept: boolean) => void;
}) {
  if (offers.length === 0) return <p className="wk-empty">Nie ma teraz żadnych terminów do wyboru.</p>;

  return (
    <div className="wk-slot-list">
      {offers.map((one) => (
        <OfferCard
          key={`${one.itemId}:${one.occurrenceAt}`}
          offer={one}
          rules={rules}
          holder={holder}
          replaces={replaces}
          busy={busy}
          onAct={onAct}
          onTaken={onTaken}
        />
      ))}
    </div>
  );
}

function OfferCard({ offer, rules, holder, replaces, busy, onAct, onTaken }: {
  offer: Offer;
  rules: Rules;
  holder: Holder | null;
  replaces: string | null;
  busy: boolean;
  onAct: Act;
  onTaken: (claimId: string, code: string | null, kept: boolean) => void;
}) {
  const [code, setCode] = useState('');
  const [open, setOpen] = useState(false);

  const minutes = Math.round((new Date(offer.endsAt).getTime() - new Date(offer.startsAt).getTime()) / 60000);
  const left = Math.max(0, offer.capacity - offer.taken);

  const take = (withCode?: string) => holder !== null && void onAct(replaces !== null ? 'Zamienianie…' : 'Zapisywanie…', async () => {
    const done = await takeOffer(rules.resourceId, offer, holder, withCode, replaces ?? undefined);
    onTaken(done.claimId, done.inviteCode, holder.key !== null);
  });

  const said =
    offer.state === 'open'
      ? offer.taken === 0 && rules.inviteHours > 0 && rules.capacity > 1
        ? `Wolny. Będziesz pierwszy — przez ${rules.inviteHours} h sam dobierzesz pozostałych.`
        : `Wolny — zostało miejsc: ${left}.`
    : offer.state === 'inviteneeded'
      ? `Pierwsza osoba, która wybrała ten termin, zaprasza teraz znajomych${offer.inviteUntil !== null
        ? ` — ma na to czas do ${moment(offer.inviteUntil)}` : ''}. Wolnych miejsc: ${left}.`
    : offer.state === 'full' ? 'Pełny.'
    : offer.state === 'locked' ? 'Zamknięty — grupa jest już skompletowana.'
    : 'Twój termin.';

  return (
    <article className={`wk-slot ${SHADE[offer.state]}`}>
      <p className="wk-slot-when">{span(offer.startsAt, offer.endsAt, rules)}</p>
      <p className="wk-slot-note">
        {!rules.byNight && `Czas: ${minutes} min · `}Zajętość: {offer.taken}/{offer.capacity}
      </p>
      <p className="wk-slot-say">{said}</p>

      {holder !== null && offer.state === 'open' && (
        <button type="button" className="wk-btn wk-slot-take" disabled={busy} onClick={() => take()}>
          {replaces !== null ? 'Zamień na ten termin' : 'Wybierz ten termin'}
        </button>
      )}

      {/*
        JEMAND HÄLT IHN — zwei Wege hinein, und beide stehen da: sein Code,
        oder eine Bitte an ihn. Zuerst zugeklappt, wie im Altbestand: wer
        durch die Liste scrollt, soll nicht bei jedem gelben Termin ein Feld
        vor sich haben.
      */}
      {holder !== null && offer.state === 'inviteneeded' && (
        open ? (
          <div className="wk-slot-join">
            {/*
              ERST DER SATZ, WARUM. Wer hier ankommt, sieht einen Termin mit
              freien Plätzen, den er nicht einfach nehmen kann — und muss
              verstehen, dass das eine Frist ist und keine Absage.
            */}
            <p className="wk-slot-explain">
              Pierwsza osoba, która wybrała ten termin, ma czas, żeby zaprosić znajomych
              {offer.inviteUntil !== null && <> — <strong>do {moment(offer.inviteUntil)}</strong></>}.
              {' '}Do tego czasu możesz dołączyć na jeden z dwóch sposobów:
            </p>

            <div className="wk-slot-ways">
              {/* 1. Ohne Code: die Bitte — der häufigere Fall, also zuerst und gross. */}
              {replaces === null && (
                <section className="wk-slot-way">
                  <strong>Nie masz kodu?</strong>
                  <p>
                    Poproś tę osobę o dołączenie. Zobaczy Twoją prośbę u siebie i może ją przyjąć —
                    odpowiedź pojawi się tutaj, przy Twoim terminie.
                  </p>
                  <button type="button" className="wk-btn" disabled={busy}
                    onClick={() => void onAct('Wysyłanie prośby…', () => askToJoin(rules.resourceId, offer, holder))}>
                    Poproś o dołączenie
                  </button>
                </section>
              )}

              {/* 2. Mit Code. */}
              <section className="wk-slot-way">
                <strong>Masz kod od tej osoby?</strong>
                <label className="wk-field">
                  <span>Kod zaproszenia (6 znaków)</span>
                  <input value={code} placeholder="np. A3K9Q2" maxLength={6}
                    onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    onKeyDown={(e) => { if (e.key === 'Enter' && code.length === 6 && !busy) take(code); }} />
                </label>
                {/*
                  ERST MIT DEM GANZEN CODE. Ein grauer Knopf neben einem leeren
                  Feld sah aus wie der Weg hinein und war es nicht.
                */}
                {code.length === 6 && (
                  <button type="button" className="wk-btn" disabled={busy} onClick={() => take(code)}>
                    {replaces !== null ? 'Zamień z kodem' : 'Dołącz z kodem'}
                  </button>
                )}
              </section>
            </div>

            {/*
              Was danach geschieht — genau die Regel des Dienstes: sitzt am Ende
              der Frist nur der Erste darauf, gehört der Termin wieder allen.
            */}
            <p className="wk-hint">
              {replaces !== null && 'Prośbę o dołączenie wyślesz, gdy nie będziesz mieć innego terminu. '}
              Jeśli do tego czasu nikt nie dołączy, termin otworzy się dla wszystkich i wybierzesz go bez kodu.
              {' '}
              <button type="button" className="wk-link-btn" onClick={() => setOpen(false)}>Ukryj</button>
            </p>
          </div>
        ) : (
          /* Ein richtiger Knopf, kein leiser: hier hinein geht es — nur anders als bei einem grünen. */
          <button type="button" className="wk-btn wk-slot-take" disabled={busy} onClick={() => setOpen(true)}>
            Chcę dołączyć do tego terminu
          </button>
        )
      )}
    </article>
  );
}

/* -- Wer fragt, wählt die Zeit: was er hält -------------------------------- */

const STATUS_WORD: Record<MyClaim['status'], string> = {
  pending: 'czeka na odpowiedź',
  confirmed: 'potwierdzone',
  declined: 'odrzucone',
  released: 'oddane'
};

function OpenMine({ claims, rules, holder, busy, onAct }: {
  claims: readonly MyClaim[];
  rules: Rules;
  holder: Holder;
  busy: boolean;
  onAct: Act;
}) {
  if (claims.length === 0) return null;

  return (
    <section className="wk-panel">
      <h3 className="wk-h2">Twoje rezerwacje</h3>

      <ul className="wk-people">
        {claims.map((c) => (
          <li className="wk-person" key={c.claimId}>
            <span className="wk-person-who"><strong>{span(c.startsAt, c.endsAt, rules)}</strong></span>
            <span className="wk-person-can">
              <span className={c.status === 'confirmed' ? 'wk-tag wk-tag-open' : 'wk-tag'}>
                {STATUS_WORD[c.status]}{c.awaits === 'office' && ' kancelarii'}
              </span>
            </span>
            {(c.status === 'pending' || c.status === 'confirmed') && (
              <button type="button" className="wk-link-btn" disabled={busy}
                onClick={() => void onAct('Oddawanie…', () => releaseClaim(c.claimId, holder))}>
                {c.status === 'pending' ? 'Wycofaj' : 'Oddaj'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
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
