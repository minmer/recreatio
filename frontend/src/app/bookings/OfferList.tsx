/**
 * Die freien Termine, die man nehmen kann.
 */

import { useState } from 'react';

import { WorkspaceError } from '../core/session';
import { type Holder, type Offer, type Rules, askToJoin, takeOffer } from './resource';
import { type Act, moment, span } from './slotText';

/* -- Die Termine zur Wahl --------------------------------------------------- */

/**
 * Was gesagt wird, wenn ein grün gezeigter Termin beim Klick nicht mehr frei
 * war — je nach dem Grund, den der Dienst nennt. Die Liste ist danach neu.
 */
const MEANTIME: Record<string, string> = {
  inviteneeded: 'W międzyczasie ktoś inny wybrał ten termin — nie jest już wolny. Teraz ta osoba decyduje, kto dołączy; możesz poprosić o dołączenie.',
  full: 'W międzyczasie ktoś zajął ostatnie wolne miejsce — ten termin nie jest już wolny.',
  locked: 'W międzyczasie ten termin został zajęty przez grupę — nie jest już wolny.',
  closed: 'W międzyczasie ten termin został zamknięty — nie jest już wolny.'
};

const SHADE: Record<Offer['state'], string> = {
  open: 'is-free',
  inviteneeded: 'is-hosted',
  locked: 'is-closed',
  full: 'is-closed',
  mine: 'is-mine',
  closed: 'is-closed'
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
    try {
      const done = await takeOffer(rules, offer, holder, withCode, replaces ?? undefined);
      onTaken(done.claimId, done.inviteCode, holder.key !== null);
    } catch (e) {
      /*
       * W MIĘDZYCZASIE — die Karte war grün, aber jemand war schneller. Das
       * sagt ein eigener Satz; der des Dienstes allein („potrzebny jest kod")
       * klang, als hätte man etwas falsch gemacht.
       */
      const meantime = offer.state === 'open' && withCode === undefined && e instanceof WorkspaceError
        ? MEANTIME[e.verdict ?? ''] : undefined;
      throw meantime === undefined ? e : new WorkspaceError(meantime, e instanceof WorkspaceError ? e.verdict : null);
    }
  });

  const said =
    offer.state === 'open'
      ? offer.taken === 0 && rules.inviteHours > 0 && rules.capacity > 1
        ? `Wolny. Będziesz pierwszy — zdecydujesz, czy chcesz sam zaprosić pozostałych (wtedy przez ${rules.inviteHours} h tylko Ty decydujesz, kto dołączy).`
        : `Wolny — zostało miejsc: ${left}.`
    : offer.state === 'inviteneeded'
      ? offer.hostPending === true
        ? `Nie można go teraz wybrać. Osoba, która wybrała go jako pierwsza, decyduje właśnie${offer.inviteUntil !== null
          ? ` (najpóźniej do ${moment(offer.inviteUntil)})` : ''}, czy zaprosi znajomych. Jeśli nie — termin otworzy się dla wszystkich. Wolnych miejsc: ${left}.`
        : `Nie można go wybrać bezpośrednio. Pierwsza osoba, która go wybrała, ${offer.inviteUntil !== null
          ? `do ${moment(offer.inviteUntil)} ` : ''}sama decyduje, kto dołączy — możesz tylko poprosić o dołączenie albo użyć jej kodu. Wolnych miejsc: ${left}.`
    : offer.state === 'full' ? 'Pełny.'
    : offer.state === 'locked' ? 'Zamknięty — grupa jest już skompletowana.'
    : offer.state === 'closed'
      ? offer.closedBy === 'office' ? 'Zamknięty przez kancelarię.' : 'Zamknięty — grupa jest już skompletowana.'
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
              <strong>Tego terminu nie wybierzesz sam.</strong> O tym, kto dołączy, decyduje osoba, która
              wybrała go jako pierwsza
              {offer.inviteUntil !== null && <> — <strong>do {moment(offer.inviteUntil)}</strong></>}.
              {' '}Do tego czasu możesz dołączyć na jeden z dwóch sposobów:
            </p>

            <div className="wk-slot-ways">
              {/* 1. Ohne Code: die Bitte — der häufigere Fall, also zuerst und gross. */}
              {replaces === null && (
                <section className="wk-slot-way">
                  <strong>Nie masz kodu?</strong>
                  <p>
                    Poproś tę osobę o dołączenie. To tylko prośba — <strong>nie masz pewności, że zostanie
                    przyjęta</strong>: ta osoba może się zgodzić albo odmówić. Dopóki się nie zgodzi, termin
                    nie jest Twój. Odpowiedź pojawi się tutaj.
                  </p>
                  <button type="button" className="wk-btn" disabled={busy}
                    onClick={() => void onAct('Wysyłanie prośby…', () => askToJoin(rules, offer, holder))}>
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
              Jeśli do tego czasu nikt więcej nie dołączy, termin otworzy się dla wszystkich i wybierzesz go bez kodu.
              {' '}
              <button type="button" className="wk-link-btn" onClick={() => setOpen(false)}>Ukryj</button>
            </p>
          </div>
        ) : (
          /* Ein richtiger Knopf, kein leiser: hier hinein geht es — nur anders als bei einem grünen. */
          <button type="button" className="wk-btn wk-slot-take" disabled={busy} onClick={() => setOpen(true)}>
            Poproś o dołączenie albo wpisz kod
          </button>
        )
      )}
    </article>
  );
}
