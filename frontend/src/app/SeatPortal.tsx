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

import { pagePath } from './routes';
import { PageParts } from './PageParts';
import { toDraft } from './page';
import { BindSeat, MyLink, PersonalSections } from './SeatBar';
import { FirstOpen } from './FirstOpen';
import { SeatContext } from './seatContext';
import { useSeat } from './seatView';
import { ReviewSubmissions } from './Submission';

export function SeatPortal({ token, keyText, under }: {
  token: string;
  keyText: string | null;
  /** Die Seite, unter der dieser Platz hängt — nur noch bei Adressen, die nicht aufgeräumt wurden. */
  under: string | null;
}) {
  const { portal, failed, seat, challenge, reload } = useSeat(token, keyText);
  const seatKey = seat?.seatKey ?? null;

  /* Hier gilt GENAU dieser Platz: wer seinen Link öffnet, meint ihn. */
  const seatList = useMemo(() => (seat === null ? [] : [seat]), [seat]);

  /* ERST BESTÄTIGEN (0046) — solange nichts aufgeschlossen ist, gibt es nichts anderes zu zeigen. */
  if (challenge !== null) {
    return <FirstOpen token={token} challenge={challenge} onPassed={reload} />;
  }

  if (portal === undefined) return <p className="wk-lede">Otwieranie…</p>;

  if (portal === null) {
    return (
      <>
        <h1 className="wk-h1">Tego miejsca nie ma</h1>
        <p className="wk-lede">Link mógł zostać wycofany albo stracić ważność. {failed}</p>
      </>
    );
  }

  /*
   * WAS DIESE SEITE ZEIGT, BESTIMMT DIE KANZLEI (0028) — über die
   * Portalvorlage des Bereichs, wenn es eine gibt. Sonst die eingebauten
   * Abschnitte.
   */
  const template = portal.template;

  return (
    <SeatContext.Provider value={seatList}>
      {under !== null && under !== '' && (
        <p className="wk-row-side">
          <a className="wk-link" href={pagePath(under)}>← {under}</a>
        </p>
      )}

      <h1 className="wk-h1">
        {template?.title ?? (portal.recipientName === null ? 'Twoje miejsce' : portal.recipientName)}
      </h1>

      <p className="wk-lede">
        {template?.lead ?? 'Ten link jest kluczem, nie legitymacją: kto go ma, widzi tę stronę. Nie przekazuj go dalej.'}
      </p>

      {keyText === null && seatKey === null && (
        <p className="wk-error">
          W adresie brakuje klucza — widać, że miejsce istnieje, ale nie jego
          treść. Otwórz pełny link, ten z drugą częścią po ukośniku.
        </p>
      )}

      {keyText !== null && seatKey === null && (
        <p className="wk-error">
          Klucz z adresu nie pasuje do tego miejsca. Sprawdź, czy link nie
          urwał się przy kopiowaniu.
        </p>
      )}

      {failed !== null && <p className="wk-error">{failed}</p>}

      {seat !== null && <ReviewSubmissions seat={seat} who={null} />}

      {template !== null && <PageParts parts={template.parts.map(toDraft)} />}

      {template !== null && template.parts.length === 0 && (
        <p className="wk-note">
          Ta strona jeszcze nic nie pokazuje — kancelaria dopiero układa jej
          moduły. Wróć tu za jakiś czas; adres się nie zmieni.
        </p>
      )}

      {template === null && seat !== null && (
        <>
          <PersonalSections seat={seat} />

          <p className="wk-note">
            <strong>To jest Twoja strona.</strong> Z czasem wszystko będzie się
            działo tutaj: terminy i spotkania, wiadomości od kancelarii, zgoda na
            to, co udostępniasz. Wracaj pod ten sam adres — on się nie zmieni.
          </p>
        </>
      )}

      {portal.expiresAt !== null && (
        <p className="wk-hint">
          Link działa do {new Date(portal.expiresAt).toLocaleDateString('pl-PL',
            { day: 'numeric', month: 'long', year: 'numeric' })}.
        </p>
      )}

      <MyLink token={token} under={under} />
      {seat !== null && <BindSeat seat={seat} />}
    </SeatContext.Provider>
  );
}

export default SeatPortal;
