/**
 * Ein Platz OHNE Seite — `#/seat/<token>` — so, wie sein Link ihn öffnet.
 *
 * <b>Ein Platz, der zu einer Seite gehört, landet nicht mehr hier.</b> Sein
 * Link öffnet die Seite selbst (`seatKeep.pageLink`, auch alte Links der Form
 * `…/portal/<token>/<key>`), und die persönlichen Bausteine dort zeigen, was
 * ihm gehört. Diese Ansicht bleibt für Plätze, die die Kanzlei ohne Seite
 * ausgestellt hat — sie sollen trotzdem etwas zeigen.
 *
 * <b>Es steht hier, was da ist — und sonst nichts.</b> Jeder Abschnitt
 * erscheint nur gefüllt (`PersonalSections`); ein leerer Kasten ist keine
 * Auskunft.
 *
 * <b>Der Schlüssel steht nie in der Adresse, sobald sie aufgeräumt ist</b>
 * (`seatKeep`). Er geht nie an den Dienst: der bekommt das Token und gibt dafür
 * eine Hülle heraus, aufgemacht wird sie hier.
 */

import { useMemo } from 'react';

import { pagePath } from '../routes';
import { BindSeat, MyLink, PersonalSections } from './SeatBar';
import { FirstOpen } from './FirstOpen';
import { SeatContext } from './seatContext';
import { useSeat } from './seatView';
import { ReviewSubmissions } from '../forms/Submission';
import { rich, useT } from '../core/i18n';

export function SeatPortal({ token, keyText, under }: {
  token: string;
  keyText: string | null;
  /** Die Seite, unter der dieser Platz hängt — nur noch bei Adressen, die nicht aufgeräumt wurden. */
  under: string | null;
}) {
  const { portal, failed, seat, challenge, reload } = useSeat(token, keyText);
  const seatKey = seat?.seatKey ?? null;
  const t = useT();

  /* Hier gilt GENAU dieser Platz: wer seinen Link öffnet, meint ihn. */
  const seatList = useMemo(() => (seat === null ? [] : [seat]), [seat]);

  /* ERST BESTÄTIGEN (0046) — solange nichts aufgeschlossen ist, gibt es nichts anderes zu zeigen. */
  if (challenge !== null) {
    return <FirstOpen token={token} challenge={challenge} onPassed={reload} />;
  }

  if (portal === undefined) return <p className="wk-lede">{t('seats.page.opening')}</p>;

  if (portal === null) {
    return (
      <>
        <h1 className="wk-h1">{t('seats.page.noPlace')}</h1>
        <p className="wk-lede">{t('seats.page.noPlaceText')} {failed}</p>
      </>
    );
  }

  return (
    <SeatContext.Provider value={seatList}>
      {under !== null && under !== '' && (
        <p className="wk-row-side">
          <a className="wk-link" href={pagePath(under)}>← {under}</a>
        </p>
      )}

      <h1 className="wk-h1">
        {/* 0097 — der Name aus seiner eigenen, versiegelten Kopie (`useSeat` öffnet sie mit seinem Schlüssel). */}
        {seat?.recipientName ?? t('seats.page.yourPlace')}
      </h1>

      <p className="wk-lede">{t('seats.page.isKey')}</p>

      {keyText === null && seatKey === null && (
        <p className="wk-error">{t('seats.page.noKey')}</p>
      )}

      {keyText !== null && seatKey === null && (
        <p className="wk-error">{t('seats.bar.locked')}</p>
      )}

      {failed !== null && <p className="wk-error">{failed}</p>}

      {seat !== null && <ReviewSubmissions seat={seat} who={null} />}

      {seat !== null && (
        <>
          <PersonalSections seat={seat} />

          <p className="wk-note">{rich(t('seats.page.yourPage'), { b: (s, key) => <strong key={key}>{s}</strong> })}</p>
        </>
      )}

      {portal.expiresAt !== null && (
        <p className="wk-hint">
          {t('seats.bar.worksUntil', { date: new Date(portal.expiresAt).toLocaleDateString(t.locale,
            { day: 'numeric', month: 'long', year: 'numeric' }) })}
        </p>
      )}

      <MyLink token={token} under={under} />
      {seat !== null && <BindSeat seat={seat} />}
    </SeatContext.Provider>
  );
}

export default SeatPortal;
