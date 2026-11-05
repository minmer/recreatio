/**
 * REZERWACJE AM TERMIN (0057) — was an einem angebotenen Termin hängt, und
 * was die Kanzlei dort entscheidet, ohne erst unter „Rezerwacje" das Ding und
 * darin den Tag zu suchen.
 *
 * <code>
 *   angebotener Termin   wie viel frei ist, wer darauf sitzt, wer wartet —
 *                        potwierdzić, odrzucić, dopisać, wypisać, zamknąć
 *   frei gewählte Zeit   wer das Haus hält, und ob es auf ein Ja wartet
 *   „Do potwierdzenia"   alles, was auf ein Ja wartet, über alle Dinge
 * </code>
 *
 * <b>Wer nur liest</b>, sieht dasselbe ohne Knöpfe — der Dienst ließe ihn
 * ohnehin nicht entscheiden (\`mayDecide\` kommt von dort).
 */

import { useState } from 'react';

import {
  claimWord, holderName, waitsForOffice, type AgendaBookings, type AgendaOffer, type BookingResource, type HeldClaim
} from '../calendar/calendarBookings';
import type { CalEvent } from '../calendar/calendarModel';
import { longDate } from '../core/dayMath';
import { fmtDate, useT } from '../core/i18n';
import { Modal } from '../ui/Modal';
import { officeAdd, officeClose, officeDecides, officeRemove } from './resource';
import { viewPath } from '../routes';
import { WorkspaceError } from '../core/session';
import { askText } from '../ui/dialogs';

const time = (at: Date) => fmtDate(at, { hour: '2-digit', minute: '2-digit' });

/** „sobota, 3 października, 9:40–10:20" — oder über mehrere Tage mit beiden Daten. */
export function span(start: Date, end: Date): string {
  const sameDay = start.toDateString() === new Date(end.getTime() - 1).toDateString();
  return sameDay
    ? `${longDate(start)}, ${time(start)}–${time(end)}`
    : `${longDate(start)} ${time(start)} – ${longDate(end)} ${time(end)}`;
}

/** Eine Handlung, danach neu laden — mit dem Fehler an Ort und Stelle. */
function useAct(onChanged: () => void) {
  const t = useT();
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const act = async (key: string, todo: () => Promise<unknown>) => {
    setBusy(key);
    setFailed(null);
    try {
      await todo();
      onChanged();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : t('common.failed'));
    } finally {
      setBusy(null);
    }
  };

  return { busy, failed, act };
}

/** Eine Zeile: wer, in welchem Stand — und was die Kanzlei damit tun kann. */
function ClaimLine({ claim, mayDecide, busy, act }: {
  claim: HeldClaim;
  mayDecide: boolean;
  busy: string | null;
  act: (key: string, todo: () => Promise<unknown>) => Promise<void>;
}) {
  const t = useT();
  const waiting = waitsForOffice(claim);

  return (
    <li className={`wk-res-claim${waiting ? ' is-waiting' : ''}`}>
      <span className="wk-res-who">
        <strong>{holderName(claim)}</strong>
        <span className="wk-res-state">{claimWord(claim)}</span>
      </span>
      {mayDecide && (
        <span className="wk-res-tools">
          {waiting ? (
            <>
              <button type="button" className="wk-btn wk-btn-small" disabled={busy !== null}
                onClick={() => void act(`y:${claim.claimId}`, () => officeDecides(claim.claimId, true))}>
                {busy === `y:${claim.claimId}` ? '…' : t('bookings.dialog.confirm')}
              </button>
              <button type="button" className="wk-btn wk-btn-quiet wk-btn-small" disabled={busy !== null}
                onClick={() => void act(`n:${claim.claimId}`, () => officeDecides(claim.claimId, false))}>
                {t('bookings.dialog.reject')}
              </button>
            </>
          ) : (
            <button type="button" className="wk-link-btn wk-danger" disabled={busy !== null}
              onClick={async () => {
                if (!(await askText(t('bookings.dialog.removeAsk', { name: holderName(claim) })))) return;
                void act(`x:${claim.claimId}`, () => officeRemove(claim.claimId));
              }}>
              {t('bookings.dialog.remove')}
            </button>
          )}
        </span>
      )}
    </li>
  );
}

/** Ein angebotener Termin — oder eine frei gewählte Zeit — mit allem, was daran hängt. */
export function ReservationDialog({ event, onClose, onChanged, onEdit }: {
  event: CalEvent;
  onClose: () => void;
  onChanged: () => void;
  /** Den Termin selbst ändern (Zeit, Wiederholung) — nur, wenn man in seiner Gruppe schreibt. */
  onEdit?: () => void;
}) {
  const resource = event.resource;
  if (resource === undefined) return null;

  return event.offer !== undefined
    ? <OfferView event={event} offer={event.offer} resource={resource} onClose={onClose} onChanged={onChanged} onEdit={onEdit} />
    : event.booking !== undefined
      ? <BookingView event={event} claim={event.booking} resource={resource} onClose={onClose} onChanged={onChanged} />
      : null;
}

function OfferView({ event, offer, resource, onClose, onChanged, onEdit }: {
  event: CalEvent;
  offer: AgendaOffer;
  resource: BookingResource;
  onClose: () => void;
  onChanged: () => void;
  onEdit?: () => void;
}) {
  const t = useT();
  const { busy, failed, act } = useAct(onChanged);
  const [name, setName] = useState('');

  const waiting = offer.claims.filter(waitsForOffice);
  const others = offer.claims.filter((c) => !waitsForOffice(c));
  const free = Math.max(0, offer.capacity - offer.taken);
  const term = { itemId: offer.itemId, occurrenceAt: offer.occurrenceAt };

  return (
    <Modal title={event.title} onClose={onClose} wide>
      <p className="wk-ev-when">{span(event.start, event.end)}</p>

      <div className="wk-res-sum">
        <span className="wk-res-seats" aria-label={t('bookings.dialog.takenLabel', { taken: offer.taken, capacity: offer.capacity })}>
          {Array.from({ length: Math.min(offer.capacity, 12) }, (_, i) => (
            <span key={i} className={`wk-res-seat${i < offer.taken ? ' is-taken' : ''}`} aria-hidden="true" />
          ))}
        </span>
        <span>
          <strong>{t('bookings.dialog.takenOf', { taken: offer.taken, capacity: offer.capacity })}</strong>{' '}
          {free > 0 ? `· ${t('bookings.dialog.free', { count: free })}` : `· ${t('bookings.dialog.complete')}`}
          {waiting.length > 0 && <span className="wk-res-waitnote"> · {t('bookings.dialog.waitingCount', { count: waiting.length })}</span>}
        </span>
        {offer.closedBy !== null && (
          <span className="wk-tag">{offer.closedBy === 'host' ? t('bookings.dialog.closedByHost') : t('bookings.dialog.closed')}</span>
        )}
      </div>

      {waiting.length > 0 && (
        <section className="wk-res-block">
          <h3 className="wk-res-h">{t('bookings.dialog.waiting')}</h3>
          <ul className="wk-res-list">
            {waiting.map((c) => <ClaimLine key={c.claimId} claim={c} mayDecide={resource.mayDecide} busy={busy} act={act} />)}
          </ul>
        </section>
      )}

      <section className="wk-res-block">
        <h3 className="wk-res-h">{t('bookings.dialog.signedUp')}</h3>
        {others.length === 0
          ? <p className="wk-hint">{t('bookings.dialog.nobody')}</p>
          : (
            <ul className="wk-res-list">
              {others.map((c) => <ClaimLine key={c.claimId} claim={c} mayDecide={resource.mayDecide} busy={busy} act={act} />)}
            </ul>
          )}
      </section>

      {resource.mayDecide && (
        <form className="wk-res-add" onSubmit={(e) => {
          e.preventDefault();
          const who = name.trim();
          if (who === '') return;
          void act('add', async () => { await officeAdd(resource, term, { name: who }); setName(''); });
        }}>
          <label className="wk-field">
            <span>{t('bookings.dialog.addPerson')}</span>
            <input value={name} maxLength={200} placeholder={t('bookings.dialog.namePlaceholder')} onChange={(e) => setName(e.target.value)} />
          </label>
          <button type="submit" className="wk-btn wk-btn-quiet" disabled={busy !== null || name.trim() === ''}>{t('bookings.dialog.add')}</button>
        </form>
      )}

      {failed !== null && <p className="wk-error">{failed}</p>}

      <div className="wk-actions">
        {resource.mayDecide && (
          <button type="button" className="wk-btn wk-btn-quiet" disabled={busy !== null}
            onClick={() => void act('close', () => officeClose(resource.resourceId, term, offer.closedBy === null))}>
            {offer.closedBy === null ? t('bookings.dialog.closeSignups') : t('bookings.dialog.openSignups')}
          </button>
        )}
        {onEdit !== undefined && (
          <button type="button" className="wk-btn wk-btn-quiet" onClick={onEdit}>{t('bookings.myTerm.change')}</button>
        )}
        <a className="wk-link" href={viewPath('bookings', resource.resourceId)}>{t('bookings.dialog.allSlots', { name: resource.name })}</a>
      </div>
    </Modal>
  );
}

function BookingView({ event, claim, resource, onClose, onChanged }: {
  event: CalEvent;
  claim: HeldClaim;
  resource: BookingResource;
  onClose: () => void;
  onChanged: () => void;
}) {
  const t = useT();
  const { busy, failed, act } = useAct(onChanged);

  return (
    <Modal title={event.title} onClose={onClose}>
      <p className="wk-ev-when">{span(event.start, event.end)}</p>
      <ul className="wk-res-list">
        <ClaimLine claim={claim} mayDecide={resource.mayDecide} busy={busy} act={act} />
      </ul>
      {waitsForOffice(claim) && resource.mayDecide && (
        <p className="wk-hint">{t('bookings.dialog.confirmWhole')}</p>
      )}
      {failed !== null && <p className="wk-error">{failed}</p>}
      <div className="wk-actions">
        <a className="wk-link" href={viewPath('bookings', resource.resourceId)}>{t('bookings.dialog.reservationsOf', { name: resource.name })}</a>
      </div>
    </Modal>
  );
}

/**
 * „DO POTWIERDZENIA" — alles, was auf ein Ja der Kanzlei wartet, über alle
 * Dinge, nach der Zeit. Von hier aus entscheiden, oder zum Tag springen.
 */
export function WaitingDialog({ reservations, onClose, onChanged, onShow }: {
  reservations: AgendaBookings;
  onClose: () => void;
  onChanged: () => void;
  onShow: (at: Date) => void;
}) {
  const t = useT();
  const { busy, failed, act } = useAct(onChanged);
  const resources = new Map(reservations.resources.map((r) => [r.resourceId, r]));
  const list = [...reservations.waiting].sort((a, b) => a.claim.startsAt.localeCompare(b.claim.startsAt));

  return (
    <Modal title={t('bookings.dialog.toConfirm')} onClose={onClose} wide>
      {list.length === 0 && <p className="wk-empty">{t('bookings.dialog.nothingWaits')}</p>}
      <ul className="wk-res-list">
        {list.map(({ resourceId, claim }) => {
          const resource = resources.get(resourceId);
          const start = new Date(claim.startsAt);
          return (
            <li key={claim.claimId} className="wk-res-claim is-waiting">
              <span className="wk-res-who">
                <strong>{holderName(claim)}</strong>
                <span className="wk-res-state">{resource?.name ?? t('bookings.dialog.reservation')} · {span(start, new Date(claim.endsAt))}</span>
              </span>
              <span className="wk-res-tools">
                <button type="button" className="wk-btn wk-btn-small" disabled={busy !== null}
                  onClick={() => void act(`y:${claim.claimId}`, () => officeDecides(claim.claimId, true))}>
                  {busy === `y:${claim.claimId}` ? '…' : t('bookings.dialog.confirm')}
                </button>
                <button type="button" className="wk-btn wk-btn-quiet wk-btn-small" disabled={busy !== null}
                  onClick={() => void act(`n:${claim.claimId}`, () => officeDecides(claim.claimId, false))}>
                  {t('bookings.dialog.reject')}
                </button>
                <button type="button" className="wk-link-btn" onClick={() => onShow(start)}>{t('bookings.dialog.show')}</button>
              </span>
            </li>
          );
        })}
      </ul>
      {failed !== null && <p className="wk-error">{failed}</p>}
    </Modal>
  );
}

export default ReservationDialog;
