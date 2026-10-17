/*
    0112 — WAS DIE RÜCKWÄRTSVERTRÄGLICHKEIT NOCH ERRATEN MUSSTE, STEHT AB HIER
    IN DEN DATEN. Am Verhalten ändert sich nichts, und es braucht keinen
    Schlüssel — deshalb hier und nicht im Browser. Läuft VOR dem Dienst ohne
    Rückwärtsverträglichkeit (documentation/TRANSFER.md, Schritt 3).

    Wiederholbar: jeder Teil trifft nur, was noch so dasteht.

    -- 1. Die Zasada einer Rozmowa ----------------------------------------------

    `legacy` hiess: in der Rozmowa eines Bereichs und der mit einem Menschen
    schreiben alle darin; in den eigenen (Gruppe, zu zweit, Notatki) schreibt,
    wer das Schreibrecht hat — und das bekam dort jeder, der dazukam. In allen
    Arten heisst es also `members`: wer in der Rozmowa ist, schreibt.

    Die Übertragung im Konto (Schritt 2) hatte die eigenen Rozmowy als
    `writers` ausgeschrieben. Das rechnet dieselben Sprecher, aber der Browser
    liest `writers` als Kanał: er nennt die Rozmowa „kanał", und wer neu
    dazukommt, liest nur. Das wird hier zurückgenommen — für Notatki immer
    (ihre Zasada stellt niemand um), für Gruppen und zu zweit nur, wo niemand
    bloss liest (ein Kanał hat Lesende).
*/

UPDATE app.chat SET posting_policy = N'members' WHERE posting_policy = N'legacy';

UPDATE app.chat SET posting_policy = N'members' WHERE kind = N'self' AND posting_policy = N'writers';

UPDATE c SET posting_policy = N'members'
  FROM app.chat c
 WHERE c.kind IN (N'group', N'direct') AND c.posting_policy = N'writers'
   AND NOT EXISTS (
       SELECT 1 FROM app.certificate r
        WHERE r.scope_kind = N'area' AND r.scope_id = c.area_id AND r.capability = N'read'
          AND r.revoked_at IS NULL AND r.expires_at > SYSDATETIMEOFFSET()
          AND NOT EXISTS (
              SELECT 1 FROM app.certificate w
               WHERE w.scope_kind = N'area' AND w.scope_id = c.area_id AND w.subject_role_id = r.subject_role_id
                 AND w.capability IN (N'write', N'admin') AND w.revoked_at IS NULL AND w.expires_at > SYSDATETIMEOFFSET()));
GO

/*
    -- 2. Der Gastgeber, der ja gesagt hat (0050) -----------------------------------

    Vor 0050 gab es keine Bedenkzeit: der Erste bekam gleich das ganze Fenster,
    und der Dienst erkannte sein Ja daran, dass das Fenster länger war als die
    Bedenkzeit (15 Minuten und ein Rand von 5). Das steht jetzt als Zeitpunkt da
    — dann fragt der Dienst nur noch `host_confirmed_at` (Bookings.SaidYes).
*/

UPDATE app.claim
   SET host_confirmed_at = created_at
 WHERE host_confirmed_at IS NULL AND invite_until IS NOT NULL
   AND DATEDIFF(second, created_at, invite_until) > 20 * 60;
GO
