/* ===========================================================================
   rc_0007_event_intake — der Annahmeschluessel einer Veranstaltung

   DAS PROBLEM. Wer sich zu einem Pfarrfest anmeldet, legt sich dafuer kein
   Konto an. Er hat also keinen Schluessel — und die Antworten sollen trotzdem
   nur die Vorbereitenden lesen koennen, der Betreiber nicht.

   DER NAHELIEGENDE WEG WAERE FALSCH. Man koennte die Antworten im Klartext
   schicken und den Server versiegeln lassen. Dann liegt zwar nichts im
   Klartext auf der Platte — aber der Server SIEHT den Klartext, und genau das
   ist die Zusage, die diese Plattform nicht brechen will.

   DIE LOESUNG. Jede Veranstaltung bekommt ein eigenes RSA-Paar:

     intake_public_key      — oeffentlich, wird MIT dem Formular ausgeliefert
     intake_private_sealed  — versiegelt unter dem Epochenschluessel des
                              Bereichs, also nur fuer die Vorbereitenden

   Der Browser des Anmelders wuerfelt einen Sitzungsschluessel, versiegelt die
   Antworten damit und verpackt den Schluessel unter dem oeffentlichen
   Annahmeschluessel. Der Server bekommt beides und kann keines von beiden
   oeffnen: den Sitzungsschluessel nicht, weil ihm der private Teil fehlt, und
   die Antworten nicht, weil ihm der Sitzungsschluessel fehlt.

   Es ist derselbe Baustein, mit dem eine Rolle einer anderen einen Schluessel
   weitergibt (RcCrypto.WrapKey). Kein zweiter Weg, Geheimnisse zu verpacken.
   =========================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

ALTER TABLE dbo.rc_event ADD
    /* SPKI DER, RSA-4096 OAEP. Oeffentlich — er wird verschickt.            */
    intake_public_key     varbinary(1024) NULL,

    /* Der private Teil, versiegelt unter dem Epochenschluessel des Bereichs.
       Wer keinen Epochenschluessel hat, hat auch diesen nicht — und damit
       keine Anmeldung.                                                       */
    intake_private_sealed varbinary(max)  NULL,

    /* Unter WELCHER Epoche. Ohne diese Angabe muesste man raten, und beim
       Epochenschnitt waere der Annahmeschluessel still unbrauchbar geworden. */
    intake_epoch          int             NULL;
GO

/* Entweder alle drei oder keines. Eine Veranstaltung mit oeffentlichem
   Annahmeschluessel, deren privater Teil fehlt, saehe aus, als koenne sie
   Anmeldungen annehmen — und niemand koennte sie je lesen. */
ALTER TABLE dbo.rc_event ADD CONSTRAINT ck_rc_event_intake CHECK (
    (intake_public_key IS NULL AND intake_private_sealed IS NULL AND intake_epoch IS NULL)
 OR (intake_public_key IS NOT NULL AND intake_private_sealed IS NOT NULL AND intake_epoch IS NOT NULL));
GO

/* ---------------------------------------------------------------------------
   Der verpackte Sitzungsschluessel je Anmeldung.

   Er liegt an der ANMELDUNG und nicht an der Veranstaltung: jede Einsendung
   bringt ihren eigenen mit. Ein gemeinsamer Schluessel fuer alle Anmeldungen
   waere ein einziger Punkt, an dem alles auf einmal auffliegt.
   --------------------------------------------------------------------------- */

ALTER TABLE dbo.rc_event_registration ADD
    session_key_wrapped varbinary(1024) NULL;
GO

/* Entweder unter dem Epochenschluessel des Bereichs versiegelt (dann hat ein
   Mitglied eingesandt und braucht keinen Umweg), oder unter dem
   Annahmeschluessel verpackt (dann kam es von aussen). Nie beides, nie keines
   — sonst wuesste beim Lesen niemand, welchen Weg er nehmen soll. */
ALTER TABLE dbo.rc_event_registration ADD CONSTRAINT ck_rc_event_reg_key CHECK (
    (submitter_role_id IS NOT NULL AND session_key_wrapped IS NULL)
 OR (session_key_wrapped IS NOT NULL));
GO
