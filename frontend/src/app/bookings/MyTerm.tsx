/**
 * Mein Termin: was ich genommen habe, worauf ich warte, und als Gastgeber das Schliessen.
 */

import { useEffect, useState } from 'react';

import { openAskNames } from '../core/holderNames';
import { type Holder, type MyClaim, type Offer, type Rules, confirmHost, hostClose, hostDecides, openInvite, releaseClaim, resignHost } from './resource';
import { type Act, type Fresh, moment, people, span } from './slotText';

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

  /* 0097 — die Namen derer, die bitten: versiegelt auf meinen Schlüssel als Gastgeber. */
  const [askNames, setAskNames] = useState<ReadonlyMap<string, string>>(new Map());
  const asks = offer?.asks;
  useEffect(() => {
    if (asks === undefined || asks.length === 0) return;
    let alive = true;
    void openAskNames(claim.claimId, claim.hostWrapPrivateSealed, holder.key, asks).then((found) => { if (alive) setAskNames(found); });
    return () => { alive = false; };
  }, [claim.claimId, claim.hostWrapPrivateSealed, holder.key, asks]);

  const minutes = Math.round((new Date(claim.endsAt).getTime() - new Date(claim.startsAt).getTime()) / 60000);
  const deciding = claim.hostPending === true;
  const hostOpen = claim.hosting && !deciding && claim.inviteUntil !== null && new Date(claim.inviteUntil).getTime() > Date.now();
  const asked = claim.status === 'pending' && claim.awaits === 'host';

  /*
   * DIE 15 MINUTEN LAUFEN AUCH OHNE KLICK AB. Danach gehört der Termin allen —
   * und die Frage soll dann nicht weiter dastehen, als ginge sie noch.
   */
  const until = claim.inviteUntil;
  useEffect(() => {
    if (!deciding || until === null) return;
    const wait = new Date(until).getTime() - Date.now() + 1500;
    const timer = window.setTimeout(() => void onAct('Odświeżanie…', async () => {}), Math.max(1000, wait));
    return () => window.clearTimeout(timer);
  }, [deciding, until]);
  const left = offer === undefined ? null : Math.max(0, offer.capacity - offer.taken);

  const copy = async () => {
    if (code == null) return;
    try { await navigator.clipboard.writeText(code); setCopied(true); } catch { /* ohne Zwischenablage steht er ja da */ }
  };

  return (
    <article className={`wk-slot is-mine${claim.status === 'pending' ? ' is-waiting' : ''}`}>
      <p className="wk-slot-label">{asked ? 'Twoja prośba o dołączenie' : 'Twój termin'}</p>
      <p className="wk-slot-when">{span(claim.startsAt, claim.endsAt, rules)}</p>
      <p className="wk-slot-note">
        {!rules.byNight && `Czas: ${minutes} min`}
        {offer !== undefined && ` · Zajętość: ${offer.taken}/${offer.capacity}`}
        {' · '}
        <span className={claim.status === 'confirmed' ? 'wk-slot-ok' : 'wk-slot-wait'}>
          {claim.status === 'confirmed' ? 'potwierdzony' : WAITS[claim.awaits ?? 'office'] ?? 'czeka'}
        </span>
      </p>

      {/*
        NUR EINE PROŚBA — und das steht da, klar. Der Termin ist nicht seiner,
        solange der Gastgeber nicht ja sagt; er kann auch nein sagen.
      */}
      {asked && (
        <p className="wk-slot-explain">
          <strong>To jeszcze nie jest Twój termin.</strong> Poprosiłeś o dołączenie — decyduje osoba,
          która wybrała ten termin jako pierwsza
          {offer?.inviteUntil != null && <>, najpóźniej do <strong>{moment(offer.inviteUntil)}</strong></>}.
          Może się zgodzić albo odmówić. Jeśli nie odpowie, a grupa nie będzie jeszcze pełna, zostaniesz
          dopisany po kolei, o ile starczy miejsc.
        </p>
      )}

      {/*
        DIE FRAGE AN DEN ERSTEN (0050) — gleich nach dem Wählen. Ja: er lädt
        ein, und seine Stunden beginnen. Nein, oder keine Antwort in 15
        Minuten: jeder kann sich dazuschreiben.
      */}
      {deciding && claim.status === 'confirmed' && (
        <div className="wk-slot-host wk-slot-decide">
          <p>
            <strong>Czy chcesz zaprosić znajomych na ten termin?</strong> Jesteś pierwszą osobą, która go
            wybrała.
          </p>
          <ul className="wk-slot-choices">
            <li>
              <strong>Tak</strong> — zostaniesz gospodarzem: przez {rules.inviteHours} h wolne miejsca zajmą
              tylko osoby z Twoim kodem albo te, które przyjmiesz.
            </li>
            <li><strong>Nie</strong> — każdy będzie mógł od razu dopisać się na wolne miejsca.</li>
          </ul>
          {until !== null && (
            <p className="wk-hint">
              Jeśli nie odpowiesz do <strong>{moment(until)}</strong>, termin otworzy się dla wszystkich.
            </p>
          )}
          <div className="wk-actions">
            <button type="button" className="wk-btn" disabled={busy}
              onClick={() => void onAct('Zapisywanie…', () => confirmHost(claim.claimId, holder))}>
              Tak, zapraszam znajomych
            </button>
            <button type="button" className="wk-btn wk-btn-quiet" disabled={busy}
              onClick={() => void onAct('Zapisywanie…', () => resignHost(claim.claimId, holder))}>
              Nie, niech każdy może się dopisać
            </button>
          </div>
        </div>
      )}

      {/* -- Gastgeber ---------------------------------------------------- */}
      {hostOpen && (
        <div className="wk-slot-host">
          <p>
            <strong>Jesteś gospodarzem tego terminu</strong> do <strong>{moment(claim.inviteUntil!)}</strong>.
            {left !== null && left > 0
              ? ` Do tego czasu ${left === 1 ? 'wolne miejsce zajmie' : `${left} wolne miejsca zajmą`} tylko osoby z Twoim kodem albo te, które przyjmiesz. Potem — jeśli będzie Was mniej niż ${rules.minPersons} — otworzą się dla wszystkich.`
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
                  {askNames.get(ask.claimId) ?? 'ktoś bez nazwy'}
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

      {claim.hosting && !deciding && !hostOpen && claim.inviteUntil !== null && (
        <p className="wk-slot-note">
          Czas gospodarza minął {moment(claim.inviteUntil)}
          {offer !== undefined && offer.taken >= rules.minPersons
            ? ' — Wasza grupa jest skompletowana, termin zostaje dla Was.'
            : ' — wolne miejsca są dostępne dla wszystkich.'}
        </p>
      )}

      {/*
        ZAMKNIĘCIE TERMINU (0049) — dla gospodarza, gdy grupa ma już minimum.
        Kto zamknie, ten może też otworzyć; co zamknęła kancelaria, otwiera
        tylko ona.
      */}
      {claim.hosting && !deciding && claim.status === 'confirmed' && offer !== undefined && (
        <HostClosing claim={claim} offer={offer} rules={rules} holder={holder} busy={busy} onAct={onAct} />
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

/** Der Gastgeber schliesst seinen Termin — oder öffnet ihn wieder (0049). */
function HostClosing({ claim, offer, rules, holder, busy, onAct }: {
  claim: MyClaim;
  offer: Offer;
  rules: Rules;
  holder: Holder;
  busy: boolean;
  onAct: Act;
}) {
  if (offer.closedBy === 'office') {
    return <p className="wk-slot-note">Ten termin zamknęła kancelaria — nikt więcej się nie dopisze.</p>;
  }

  if (offer.closedBy === 'host') {
    return (
      <p className="wk-slot-resign">
        <strong>Zamknąłeś ten termin</strong> — nikt więcej się nie dopisze i nie otworzy się on dla innych.{' '}
        <button type="button" className="wk-link-btn" disabled={busy}
          onClick={() => void onAct('Otwieranie terminu…', () => hostClose(claim.claimId, false, holder))}>
          Otwórz ponownie
        </button>
      </p>
    );
  }

  if (offer.taken >= rules.minPersons) {
    return (
      <p className="wk-slot-resign">
        Zapisanych jest {offer.taken} (minimum to {rules.minPersons}). Możesz zamknąć termin — nikt więcej
        się nie dopisze, a po Twoim czasie termin nie otworzy się dla innych.{' '}
        <button type="button" className="wk-btn wk-btn-quiet" disabled={busy}
          onClick={() => void onAct('Zamykanie terminu…', () => hostClose(claim.claimId, true, holder))}>
          Zamknij termin
        </button>
      </p>
    );
  }

  return (
    <p className="wk-row-side">
      Termin możesz zamknąć dla swojej grupy, gdy zapiszą się co najmniej {people(rules.minPersons)}
      {' '}(teraz: {offer.taken}).
    </p>
  );
}
