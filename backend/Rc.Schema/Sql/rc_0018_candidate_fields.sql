/* ===========================================================================
   rc_0018 — Vorname, Nachname und Adresse je für sich

   BISHER trug `name_sealed` beides und `contact_sealed` Telefon UND Adresse in
   einem Feld. Damit liess sich nichts davon einzeln behandeln: keine Liste nach
   Nachnamen, keine Adresse auf einen Brief, kein Anruf ohne den Rest zu lesen.

   Es widersprach auch 3.13, wonach jedes Feld sein eigenes Etikett traegt: zwei
   Angaben unter einem Etikett sind eine Angabe, und die Trennung ist danach
   Auslegungssache des Lesers.

   `name_sealed` WIRD NULLABLE. Wer von innen eintraegt, schreibt weiter dorthin;
   wer sich selbst anmeldet, fuellt Vor- und Nachnamen. Der Dienst setzt den
   Anzeigenamen aus dem zusammen, was da ist.

   TELEFONNUMMERN: mehrere, in EINEM Feld, eine je Zeile. Sie gehoeren derselben
   Person, werden zusammen gelesen und zusammen weitergegeben — sie zu trennen
   brauchte es erst, wenn jemand eine davon einzeln freigeben wollte, und das
   gibt es hier nicht.

   BESTEHENDE ZEILEN: keine. Es wird nichts gewandelt.
   =========================================================================== */

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

IF COL_LENGTH('dbo.rc_candidate', 'given_sealed') IS NULL
    ALTER TABLE dbo.rc_candidate ADD given_sealed varbinary(1024) NULL;
GO

IF COL_LENGTH('dbo.rc_candidate', 'surname_sealed') IS NULL
    ALTER TABLE dbo.rc_candidate ADD surname_sealed varbinary(1024) NULL;
GO

IF COL_LENGTH('dbo.rc_candidate', 'address_sealed') IS NULL
    ALTER TABLE dbo.rc_candidate ADD address_sealed varbinary(2048) NULL;
GO

/* `name_sealed` war Pflicht, solange es der einzige Namensspeicher war. Jetzt
   gibt es zwei Wege dorthin, und einer von beiden laesst es leer. */
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.rc_candidate')
      AND name = 'name_sealed' AND is_nullable = 0)
    ALTER TABLE dbo.rc_candidate ALTER COLUMN name_sealed varbinary(1024) NULL;
GO

/*
   Ein Kandidat ohne jeden Namen ist keiner.

   Die Bedingung nennt beide Wege: entweder der zusammengesetzte Name (von
   innen eingetragen) oder wenigstens einer der beiden Teile (selbst angemeldet).
   Ohne sie koennte eine Zeile entstehen, die niemanden benennt — und in einer
   Liste von Firmkandidaten als leere Zeile stuende.
*/
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_rc_candidate_has_name')
    ALTER TABLE dbo.rc_candidate
        ADD CONSTRAINT ck_rc_candidate_has_name CHECK (
            name_sealed IS NOT NULL
         OR given_sealed IS NOT NULL
         OR surname_sealed IS NOT NULL
        );
GO
