/*
    Wer als Erster einen Termin nimmt, ENTSCHEIDET, ob er Gastgeber sein will.

    Bisher wurde er es einfach — und hielt die freien Plaetze fuer 48 Stunden,
    auch wenn er gar niemanden einladen wollte. Jetzt fragt die Seite gleich
    nach dem Nehmen: „Chcesz zaprosić znajomych?" Wer ja sagt, bekommt sein
    Fenster (resource.invite_hours) ab diesem Augenblick; wer nein sagt, gibt
    das Vorrecht ab (/resource/unhost). Wer nicht antwortet, verliert es nach
    15 Minuten: dann gehoeren die freien Plaetze allen.

    claim.host_confirmed_at   wann er ja gesagt hat. NULL bei einem Gastgeber
                              heisst: er hat sich noch nicht entschieden — sein
                              invite_until ist dann die Frist von 15 Minuten.

    Wer schon vorher Gastgeber war, hat nach der alten Regel nie gefragt
    werden koennen: fuer ihn gilt sein Ja als am Tag des Nehmens gegeben.
*/

IF COL_LENGTH('app.claim', 'host_confirmed_at') IS NULL
    ALTER TABLE app.claim ADD host_confirmed_at datetimeoffset(7) NULL;
GO

UPDATE app.claim
   SET host_confirmed_at = created_at
 WHERE invite_sha256 IS NOT NULL AND host_confirmed_at IS NULL;
GO
