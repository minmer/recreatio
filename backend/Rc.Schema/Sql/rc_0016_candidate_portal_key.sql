/* ===========================================================================
   rc_0016 — Der Schlüssel reist im Link, und die Pfarrei bekommt ihn auch

   ENTSCHEIDUNG: der Portallink traegt den Sitzungsschluessel des Kandidaten.
   Damit sieht der Anmeldende im Portal seine eigenen Daten — vorher konnte er
   das nicht, weil niemand ausser der Pfarrei einen Schluessel hatte.

   Der Schluessel steht HINTER DER RAUTE. Alles dort bleibt im Browser und geht
   nie an den Server; das ist derselbe Weg wie beim Einladungslink (3.12).

   WAS DAS KOSTET, und es ist kein kleiner Preis: wer den Link hat, hat die
   Daten. Er ist kein Ausweis, sondern ein Schluessel. Weitergegeben heisst
   weitergegeben, verloren heisst verloren.

   DIE PFARREI BEKOMMT DEN LINK AUCH — sie soll ihn per SMS schicken koennen.
   Dafuer wird das Geheimnis unter dem oeffentlichen Annahmeschluessel der
   Gruppe VERPACKT abgelegt: wer den Epochenschluessel hat, packt es aus; der
   Betreiber nicht. Im Klartext abzulegen hiesse, dass ein Blick in die
   Datenbank jedes Portal oeffnet — und dann waere die ganze Versiegelung
   der Kandidatenfelder umsonst.

   ABSCHALTEN: sobald ein Konto verbunden ist, kann der Link entwertet werden.
   Vorher nicht — sonst schnitte sich jemand von seiner eigenen Anmeldung ab.
   =========================================================================== */

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

ALTER TABLE dbo.rc_candidate ADD
    /* Das Portalgeheimnis, verpackt unter intake_public_key der Gruppe.
       NUR damit die Pfarrei den Link noch einmal herstellen kann, um ihn zu
       verschicken. Ohne den privaten Annahmeschluessel ist es wertlos.       */
    portal_token_wrapped varbinary(1024)   NULL,

    /* Wann der Link entwertet wurde. Danach oeffnet er nichts mehr — die
       Anmeldung bleibt, der Weg ueber den Link ist zu.

       Ein Zeitpunkt und kein Ja/Nein: „seit wann" ist die Frage, die danach
       gestellt wird, und ein Merker kann sie nicht beantworten.              */
    portal_revoked_at    datetimeoffset(7) NULL;
GO

/*
   Entwertet werden darf nur, was einem Konto gehoert.

   Ohne diese Bedingung koennte eine Zeile entstehen, in der der Link tot ist
   und niemand mehr an die Anmeldung kommt: kein Konto, kein Link. Die
   Datenbank laesst das gar nicht erst zu.
*/
ALTER TABLE dbo.rc_candidate
    ADD CONSTRAINT ck_rc_candidate_portal_revoke CHECK (
        portal_revoked_at IS NULL OR account_id IS NOT NULL
    );
GO
