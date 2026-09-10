/*
    Der verpackte Sitzungsschluessel der Teilnehmerkarte.

    -------------------------------------------------------------------------
    WARUM DIE SPALTE FEHLTE
    -------------------------------------------------------------------------

    rc_0028 legte die Karte an in der Annahme, der Dienst wuerde sie versiegeln.
    Das war falsch, und zwar an der Stelle, an der es am meisten kostet: die
    Karte traegt oft besondere Kategorien — Ernaehrung, Unvertraeglichkeit,
    Medikamente. Haette der Dienst sie versiegelt, stuende ihr Inhalt fuer die
    Dauer einer Anfrage im Klartext auf einem Rechner, den der Teilnehmer nicht
    kennt.

    Versiegelt wird deshalb im Browser, genau wie bei einer Anmeldung: er
    wuerfelt einen Sitzungsschluessel, verschliesst damit die Karte und verpackt
    den Schluessel mit dem oeffentlichen Annahmeschluessel der Veranstaltung.

    Der verpackte Schluessel muss dabeiliegen — ohne ihn ist die Karte fuer
    IMMER zu, auch fuer die, die sie oeffnen duerfen.
*/

IF COL_LENGTH('dbo.rc_event_card', 'session_key_wrapped') IS NULL
BEGIN
    ALTER TABLE dbo.rc_event_card ADD session_key_wrapped varbinary(max) NULL;
END
GO
