/* ===========================================================================
   rc_0015 — Zgłoszenie kandydata z zewnątrz

   BISHER konnte ein Kandidat nur von innen angelegt werden: jemand mit dem
   Epochenschluessel des Bereichs tippt die Daten ein. Ein Jugendlicher, der
   sich selbst anmelden will, hat weder Konto noch Schluessel.

   DER WEG ist derselbe wie bei Veranstaltungen (rc_0007): die Gruppe bekommt
   ein eigenes RSA-Paar. Der oeffentliche Teil geht MIT dem Formular hinaus,
   der Browser des Anmeldenden wuerfelt einen Sitzungsschluessel, versiegelt
   damit die Felder und verpackt den Sitzungsschluessel unter dem oeffentlichen
   Annahmeschluessel. Der Server sieht nur Geheimtext.

   DER PORTALLINK ist das, was der Anmeldende zurueckbekommt — sein einziger
   Weg zurueck, solange er kein Konto hat.

   Er steht NICHT in rc_token. Jene Tabelle ist fuer Einladungen, die jemand
   AUSSTELLT: sie verlangt eine ausstellende Rolle, und bei einer
   Selbstanmeldung gibt es keine. Eine Rolle hineinzuschreiben, die es nicht
   gab, waere eine Behauptung in der Datenbank.

   GESPEICHERT WIRD DER ABDRUCK, nicht der Link. Wer die Datenbank liest, kann
   damit kein Portal oeffnen — er sieht nur, DASS es eines gibt. Dasselbe
   Verfahren wie bei rc_token, aus demselben Grund.
   =========================================================================== */

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

/* -- Die Gruppe nimmt von aussen an ---------------------------------------- */

ALTER TABLE dbo.rc_confirmation_group ADD
    /* SPKI DER, RSA-4096 OAEP. Oeffentlich — er wird mit dem Formular
       ausgeliefert und ist ohne den privaten Teil wertlos.                   */
    intake_public_key     varbinary(1024) NULL,

    /* Der private Teil, versiegelt unter dem Epochenschluessel des Bereichs.
       Wer keinen Epochenschluessel hat, hat auch diesen nicht — und liest
       damit keine Anmeldung.                                                 */
    intake_private_sealed varbinary(max)  NULL,

    /* Unter WELCHER Epoche. Ohne diese Angabe muesste man raten, und beim
       naechsten Epochenschnitt waere der Annahmeschluessel still unbrauchbar. */
    intake_epoch          int             NULL,

    /* Ob das Formular ueberhaupt offen ist.
       AUS als Vorgabe: eine Gruppe, die bei ihrer Entstehung Anmeldungen
       entgegennimmt, nimmt sie entgegen, bevor jemand entschieden hat, dass
       sie es soll. Das Oeffnen ist eine Handlung mit einem Zeitpunkt.        */
    applications_open     bit             NOT NULL
                          CONSTRAINT df_rc_conf_open DEFAULT 0;
GO

/* -- Der Kandidat hat einen Weg zurueck ------------------------------------ */

ALTER TABLE dbo.rc_candidate ADD
    /* SHA-256 des Portallinks. Der Link selbst steht nirgends — er existiert
       nur in der Adresszeile dessen, der ihn bekommen hat.                   */
    portal_token_hash varbinary(32)     NULL,

    /* Wann die Anmeldung von aussen kam. NULL heisst: von innen eingetragen.
       Der Unterschied zaehlt — bei einer Selbstanmeldung liegt die Zustimmung
       der Eltern noch auf Papier (paper_received).                           */
    applied_at        datetimeoffset(7) NULL,

    /* Spaeter mit einem Konto verbunden. Bis dahin ist der Link der einzige
       Weg zu den eigenen Daten.                                              */
    account_id        uniqueidentifier  NULL;
GO

/* Der Abdruck muss eindeutig sein: zwei Kandidaten mit demselben Portallink
   waeren zwei Menschen hinter einer Tuer. Gefiltert, weil die allermeisten
   Zeilen keinen Link haben.                                                  */
CREATE UNIQUE INDEX uq_rc_candidate_portal
    ON dbo.rc_candidate (portal_token_hash)
    WHERE portal_token_hash IS NOT NULL;
GO

/* Der Weg vom Konto zu den eigenen Anmeldungen. */
CREATE INDEX ix_rc_candidate_account
    ON dbo.rc_candidate (account_id)
    WHERE account_id IS NOT NULL;
GO

/* -- Was der Anmeldende geschickt hat -------------------------------------- */

/*
   Die Felder des Kandidaten liegen in rc_candidate und sind unter dem
   EPOCHENSCHLUESSEL versiegelt. Eine Anmeldung von aussen kann das nicht: der
   Browser hat diesen Schluessel nicht.

   Deshalb liegt der Sitzungsschluessel der Anmeldung hier — verpackt unter dem
   oeffentlichen Annahmeschluessel der Gruppe. Wer den privaten Teil hat, packt
   ihn aus und oeffnet damit die Felder.

   Er steht in einer EIGENEN Zeile und nicht in rc_candidate, weil er nach dem
   ersten Oeffnen durch die Gruppe entbehrlich wird: dann liegen die Felder
   unter der Epoche wie bei jedem anderen Kandidaten, und diese Zeile kann
   verschwinden.
*/
CREATE TABLE dbo.rc_candidate_intake (
    seq            bigint IDENTITY(1,1) NOT NULL,
    candidate_id   uniqueidentifier     NOT NULL,

    /* Der Sitzungsschluessel, verpackt unter intake_public_key der Gruppe. */
    session_key_wrapped varbinary(1024) NOT NULL,

    /* Unter welcher Fassung des Annahmeschluessels. Wechselt er, bleiben alte
       Anmeldungen lesbar, solange der alte private Teil noch da ist.        */
    intake_epoch   int                  NOT NULL,

    created_at     datetimeoffset(7)    NOT NULL,

    /* Wann die Gruppe die Felder unter ihre eigene Epoche gebracht hat.
       Danach ist diese Zeile nur noch Beleg.                               */
    absorbed_at    datetimeoffset(7)    NULL,

    CONSTRAINT pk_rc_candidate_intake PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_candidate_intake UNIQUE NONCLUSTERED (candidate_id),
    CONSTRAINT fk_rc_candidate_intake_cand FOREIGN KEY (candidate_id)
        REFERENCES dbo.rc_candidate (id)
);
GO
