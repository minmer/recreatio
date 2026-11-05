/**
 * Mein Termin: was ich genommen habe, worauf ich warte, und als Gastgeber das Schliessen.
 */

import { useEffect, useState } from 'react';

import { rich, useT } from '../core/i18n';
import { openAskNames } from '../core/holderNames';
import { type Holder, type MyClaim, type Offer, type Rules, confirmHost, hostClose, hostDecides, openInvite, releaseClaim, resignHost } from './resource';
import { type Act, type Fresh, moment, people, span } from './slotText';

/* -- Mein Termin ------------------------------------------------------------ */

const WAITS: Record<string, string> = {
  office: 'bookings.myTerm.waits.office',
  host: 'bookings.myTerm.waits.host'
};

const STRONG = { b: (s: string, k: number) => <strong key={k}>{s}</strong> };

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
  const t = useT();
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
    const timer = window.setTimeout(() => void onAct(t('bookings.myTerm.refreshing'), async () => {}), Math.max(1000, wait));
    return () => window.clearTimeout(timer);
  }, [deciding, until]);
  const left = offer === undefined ? null : Math.max(0, offer.capacity - offer.taken);

  const copy = async () => {
    if (code == null) return;
    try { await navigator.clipboard.writeText(code); setCopied(true); } catch { /* ohne Zwischenablage steht er ja da */ }
  };

  return (
    <article className={`wk-slot is-mine${claim.status === 'pending' ? ' is-waiting' : ''}`}>
      <p className="wk-slot-label">{asked ? t('bookings.myTerm.yourRequest') : t('bookings.myTerm.yourTerm')}</p>
      <p className="wk-slot-when">{span(claim.startsAt, claim.endsAt, rules)}</p>
      <p className="wk-slot-note">
        {!rules.byNight && t('bookings.myTerm.duration', { minutes })}
        {offer !== undefined && ` · ${t('bookings.myTerm.taken', { taken: offer.taken, capacity: offer.capacity })}`}
        {' · '}
        <span className={claim.status === 'confirmed' ? 'wk-slot-ok' : 'wk-slot-wait'}>
          {claim.status === 'confirmed' ? t('bookings.myTerm.confirmed') : t(WAITS[claim.awaits ?? 'office'] ?? 'bookings.myTerm.waits.any')}
        </span>
      </p>

      {/*
        NUR EINE PROŚBA — und das steht da, klar. Der Termin ist nicht seiner,
        solange der Gastgeber nicht ja sagt; er kann auch nein sagen.
      */}
      {asked && (
        <p className="wk-slot-explain">
          {offer?.inviteUntil != null ? rich(t('bookings.myTerm.askedUntil', { until: moment(offer.inviteUntil, t.lang) }), STRONG) : rich(t('bookings.myTerm.asked'), STRONG)}
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
            {rich(t('bookings.myTerm.decide'), STRONG)}
          </p>
          <ul className="wk-slot-choices">
            <li>
              {rich(t('bookings.myTerm.yesHost', { hours: rules.inviteHours }), STRONG)}
            </li>
            <li>{rich(t('bookings.myTerm.noHost'), STRONG)}</li>
          </ul>
          {until !== null && (
            <p className="wk-hint">
              {rich(t('bookings.myTerm.deadline', { until: moment(until, t.lang) }), STRONG)}
            </p>
          )}
          <div className="wk-actions">
            <button type="button" className="wk-btn" disabled={busy}
              onClick={() => void onAct(t('bookings.myTerm.saving'), () => confirmHost(claim.claimId, holder))}>
              {t('bookings.myTerm.inviteYes')}
            </button>
            <button type="button" className="wk-btn wk-btn-quiet" disabled={busy}
              onClick={() => void onAct(t('bookings.myTerm.saving'), () => resignHost(claim.claimId, holder))}>
              {t('bookings.myTerm.inviteNo')}
            </button>
          </div>
        </div>
      )}

      {/* -- Gastgeber ---------------------------------------------------- */}
      {hostOpen && (
        <div className="wk-slot-host">
          <p>
            {rich(t('bookings.myTerm.hosting', { until: moment(claim.inviteUntil!, t.lang) }), STRONG)}
            {' '}
            {left !== null && left > 0
              ? t('bookings.myTerm.hostLeft', { count: left, min: rules.minPersons })
              : t('bookings.myTerm.full')}
          </p>

          {left !== null && left > 0 && (
            <div className="wk-slot-code">
              {code === undefined ? (
                <button type="button" className="wk-link-btn"
                  onClick={() => void openInvite(claim, holder).then(setCode)}>
                  {t('bookings.myTerm.showCode')}
                </button>
              ) : code === null ? (
                <span className="wk-row-side">{t('bookings.myTerm.codeGone')}</span>
              ) : (
                <>
                  <span>{t('bookings.myTerm.code')}</span>
                  <strong className="wk-code wk-code-inline">{code}</strong>
                  <button type="button" className="wk-link-btn" onClick={() => void copy()}>
                    {copied ? t('bookings.myTerm.copied') : t('bookings.myTerm.copyCode')}
                  </button>
                  {fresh !== null && !fresh.kept && (
                    <span className="wk-row-side">{t('bookings.myTerm.saveNow')}</span>
                  )}
                </>
              )}
            </div>
          )}

          {/* Wer bittet — der Gastgeber entscheidet. */}
          {offer !== undefined && offer.asks.length > 0 && (
            <div className="wk-slot-asks">
              <strong>{t('bookings.myTerm.asks')}</strong>
              {offer.asks.map((ask) => (
                <p key={ask.claimId}>
                  {askNames.get(ask.claimId) ?? t('bookings.myTerm.noName')}
                  {' — '}
                  <button type="button" className="wk-link-btn" disabled={busy}
                    onClick={() => void onAct(t('bookings.myTerm.accepting'), () => hostDecides(ask.claimId, true, holder))}>
                    {t('bookings.myTerm.accept')}
                  </button>
                  {' · '}
                  <button type="button" className="wk-link-btn" disabled={busy}
                    onClick={() => void onAct(t('bookings.myTerm.declining'), () => hostDecides(ask.claimId, false, holder))}>
                    {t('bookings.myTerm.decline')}
                  </button>
                </p>
              ))}
            </div>
          )}

          {/* DER KLARE SATZ für den, der niemanden mitbringen will. */}
          {left !== null && left > 0 && (asking === 'unhost' ? (
            <p className="wk-slot-confirm">
              {t('bookings.myTerm.unhostConfirm')}
              {offer !== undefined && offer.asks.length > 0 && ` ${t('bookings.myTerm.unhostAsks')}`}
              {' '}
              <button type="button" className="wk-btn" disabled={busy}
                onClick={() => void onAct(t('bookings.myTerm.resigning'), () => resignHost(claim.claimId, holder))}>
                {t('bookings.myTerm.unhostYes')}
              </button>
              {' '}
              <button type="button" className="wk-link-btn" onClick={() => setAsking(null)}>{t('common.no')}</button>
            </p>
          ) : (
            <p className="wk-slot-resign">
              {t('bookings.myTerm.resignLead')}{' '}
              <button type="button" className="wk-link-btn" disabled={busy} onClick={() => setAsking('unhost')}>
                {t('bookings.myTerm.resign')}
              </button>
            </p>
          ))}
        </div>
      )}

      {claim.hosting && !deciding && !hostOpen && claim.inviteUntil !== null && (
        <p className="wk-slot-note">
          {offer !== undefined && offer.taken >= rules.minPersons
            ? t('bookings.myTerm.hostOverKept', { at: moment(claim.inviteUntil, t.lang) })
            : t('bookings.myTerm.hostOverOpen', { at: moment(claim.inviteUntil, t.lang) })}
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
          {t('bookings.myTerm.leaveConfirm')}{' '}
          <button type="button" className="wk-btn" disabled={busy}
            onClick={() => void onAct(t('bookings.myTerm.leaving'), () => releaseClaim(claim.claimId, holder))}>
            {t('bookings.myTerm.leaveYes')}
          </button>
          {' '}
          <button type="button" className="wk-link-btn" onClick={() => setAsking(null)}>{t('common.no')}</button>
        </p>
      ) : !picking && (
        <div className="wk-actions">
          <button type="button" className="wk-btn wk-btn-quiet" disabled={busy} onClick={() => onPick(claim.claimId)}>
            {t('bookings.myTerm.change')}
          </button>
          <button type="button" className="wk-link-btn" disabled={busy} onClick={() => setAsking('leave')}>
            {claim.status === 'pending' ? t('bookings.myTerm.withdraw') : t('bookings.myTerm.leave')}
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
  const t = useT();
  if (offer.closedBy === 'office') {
    return <p className="wk-slot-note">{t('bookings.myTerm.closedByOffice')}</p>;
  }

  if (offer.closedBy === 'host') {
    return (
      <p className="wk-slot-resign">
        {rich(t('bookings.myTerm.closedByYou'), STRONG)}{' '}
        <button type="button" className="wk-link-btn" disabled={busy}
          onClick={() => void onAct(t('bookings.myTerm.reopening'), () => hostClose(claim.claimId, false, holder))}>
          {t('bookings.myTerm.reopen')}
        </button>
      </p>
    );
  }

  if (offer.taken >= rules.minPersons) {
    return (
      <p className="wk-slot-resign">
        {t('bookings.myTerm.canClose', { taken: offer.taken, min: rules.minPersons })}{' '}
        <button type="button" className="wk-btn wk-btn-quiet" disabled={busy}
          onClick={() => void onAct(t('bookings.myTerm.closing'), () => hostClose(claim.claimId, true, holder))}>
          {t('bookings.myTerm.close')}
        </button>
      </p>
    );
  }

  return (
    <p className="wk-row-side">
      {t('bookings.myTerm.closeWhen', { people: people(rules.minPersons, t.lang), taken: offer.taken })}
    </p>
  );
}
