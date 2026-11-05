/**
 * Die freien Termine, die man nehmen kann.
 */

import { useState } from 'react';

import { rich, useT } from '../core/i18n';
import { WorkspaceError } from '../core/session';
import { type Holder, type Offer, type Rules, askToJoin, takeOffer } from './resource';
import { type Act, moment, span } from './slotText';

/* -- Die Termine zur Wahl --------------------------------------------------- */

/**
 * Was gesagt wird, wenn ein grün gezeigter Termin beim Klick nicht mehr frei
 * war — je nach dem Grund, den der Dienst nennt. Die Liste ist danach neu.
 */
const MEANTIME: Record<string, string> = {
  inviteneeded: 'bookings.offer.meantime.inviteneeded',
  full: 'bookings.offer.meantime.full',
  locked: 'bookings.offer.meantime.locked',
  closed: 'bookings.offer.meantime.closed'
};

const STRONG = { b: (s: string, k: number) => <strong key={k}>{s}</strong> };

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
  const t = useT();
  if (offers.length === 0) return <p className="wk-empty">{t('bookings.offer.none')}</p>;

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
  const t = useT();
  const [code, setCode] = useState('');
  const [open, setOpen] = useState(false);

  const minutes = Math.round((new Date(offer.endsAt).getTime() - new Date(offer.startsAt).getTime()) / 60000);
  const left = Math.max(0, offer.capacity - offer.taken);

  const take = (withCode?: string) => holder !== null && void onAct(replaces !== null ? t('bookings.offer.swapping') : t('bookings.myTerm.saving'), async () => {
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
      throw meantime === undefined ? e : new WorkspaceError(t(meantime), e instanceof WorkspaceError ? e.verdict : null);
    }
  });

  const said =
    offer.state === 'open'
      ? offer.taken === 0 && rules.inviteHours > 0 && rules.capacity > 1
        ? t('bookings.offer.freeFirst', { hours: rules.inviteHours })
        : t('bookings.offer.free', { left })
    : offer.state === 'inviteneeded'
      ? offer.hostPending === true
        ? offer.inviteUntil !== null ? t('bookings.offer.decidingUntil', { until: moment(offer.inviteUntil, t.lang), left }) : t('bookings.offer.deciding', { left })
        : offer.inviteUntil !== null ? t('bookings.offer.hostedUntil', { until: moment(offer.inviteUntil, t.lang), left }) : t('bookings.offer.hosted', { left })
    : offer.state === 'full' ? t('bookings.offer.full')
    : offer.state === 'locked' ? t('bookings.offer.locked')
    : offer.state === 'closed'
      ? offer.closedBy === 'office' ? t('bookings.offer.closedByOffice') : t('bookings.offer.locked')
    : t('bookings.offer.mine');

  return (
    <article className={`wk-slot ${SHADE[offer.state]}`}>
      <p className="wk-slot-when">{span(offer.startsAt, offer.endsAt, rules, t.lang)}</p>
      <p className="wk-slot-note">
        {!rules.byNight && `${t('bookings.myTerm.duration', { minutes })} · `}{t('bookings.myTerm.taken', { taken: offer.taken, capacity: offer.capacity })}
      </p>
      <p className="wk-slot-say">{said}</p>

      {holder !== null && offer.state === 'open' && (
        <button type="button" className="wk-btn wk-slot-take" disabled={busy} onClick={() => take()}>
          {replaces !== null ? t('bookings.offer.swapTo') : t('bookings.offer.choose')}
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
              {offer.inviteUntil !== null ? rich(t('bookings.offer.explainUntil', { until: moment(offer.inviteUntil, t.lang) }), STRONG) : rich(t('bookings.offer.explain'), STRONG)}
            </p>

            <div className="wk-slot-ways">
              {/* 1. Ohne Code: die Bitte — der häufigere Fall, also zuerst und gross. */}
              {replaces === null && (
                <section className="wk-slot-way">
                  <strong>{t('bookings.offer.noCode')}</strong>
                  <p>
                    {rich(t('bookings.offer.askLead'), STRONG)}
                  </p>
                  <button type="button" className="wk-btn" disabled={busy}
                    onClick={() => void onAct(t('bookings.offer.asking'), () => askToJoin(rules, offer, holder))}>
                    {t('bookings.offer.ask')}
                  </button>
                </section>
              )}

              {/* 2. Mit Code. */}
              <section className="wk-slot-way">
                <strong>{t('bookings.offer.haveCode')}</strong>
                <label className="wk-field">
                  <span>{t('bookings.offer.codeLabel')}</span>
                  <input value={code} placeholder={t('bookings.offer.codePlaceholder')} maxLength={6}
                    onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    onKeyDown={(e) => { if (e.key === 'Enter' && code.length === 6 && !busy) take(code); }} />
                </label>
                {/*
                  ERST MIT DEM GANZEN CODE. Ein grauer Knopf neben einem leeren
                  Feld sah aus wie der Weg hinein und war es nicht.
                */}
                {code.length === 6 && (
                  <button type="button" className="wk-btn" disabled={busy} onClick={() => take(code)}>
                    {replaces !== null ? t('bookings.offer.swapWithCode') : t('bookings.offer.joinWithCode')}
                  </button>
                )}
              </section>
            </div>

            {/*
              Was danach geschieht — genau die Regel des Dienstes: sitzt am Ende
              der Frist nur der Erste darauf, gehört der Termin wieder allen.
            */}
            <p className="wk-hint">
              {replaces !== null && `${t('bookings.offer.askLater')} `}
              {t('bookings.offer.afterwards')}
              {' '}
              <button type="button" className="wk-link-btn" onClick={() => setOpen(false)}>{t('bookings.offer.hide')}</button>
            </p>
          </div>
        ) : (
          /* Ein richtiger Knopf, kein leiser: hier hinein geht es — nur anders als bei einem grünen. */
          <button type="button" className="wk-btn wk-slot-take" disabled={busy} onClick={() => setOpen(true)}>
            {t('bookings.offer.askOrCode')}
          </button>
        )
      )}
    </article>
  );
}
