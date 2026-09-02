/* ===========================================================================
   rc_verify_constraints — Prüfreihe für das Schema

   Ein Schema, dessen Bedingungen nie ausgelöst wurden, ist eine Behauptung.
   Diese Reihe versucht genau das, was die Spezifikation verbietet, und besteht
   nur dann, wenn die Datenbank es ablehnt.

   Läuft gegen eine frisch angewendete Datenbank:
     sqlcmd -S "(localdb)\MSSQLLocalDB" -d Recreatio_Rc -i rc_verify_constraints.sql
   =========================================================================== */

SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

DECLARE @ok int = 0, @fail int = 0;

/* --- 15.4: Fassungsverzeichnis -------------------------------------------

   Geprueft wird, dass jedes erwartete Skript NAMENTLICH eingetragen ist — nicht
   ihre Anzahl. Eine Zahl hier war ein Fehler: sie schlug beim dritten Skript
   fehl, obwohl nichts kaputt war, und haette dazu verfuehrt, die Pruefung
   hochzuzaehlen statt hinzusehen. Ein Test, den man beim Erweitern routinemaessig
   nachzieht, prueft bald nichts mehr.

   Und genau das ist dieser Liste dann doch passiert: sie blieb bei fuenf
   stehen, waehrend zwoelf Skripte entstanden. Sieben davon hat sie nie
   geprueft — bestanden hat sie trotzdem, und das ist die schlechteste Art zu
   bestehen. Wer ein Skript hinzufuegt, traegt es HIER ein; ohne den Eintrag
   prueft die Reihe es nicht.

   Sie sagt jetzt auch, WELCHES fehlt. „Ein erwartetes Skript fehlt" liess den
   Betreiber vor zwoelf Namen raten, von denen die Reihe genau einen meinte.   */
DECLARE @missing nvarchar(max);

SELECT @missing = STRING_AGG(s.name, N', ') WITHIN GROUP (ORDER BY s.name)
FROM (VALUES (N'rc_0001_kernel'), (N'rc_0002_chat'), (N'rc_0003_invitation'),
             (N'rc_0004_datakinds'), (N'rc_0005_recovery_contribution'),
             (N'rc_0006_events'), (N'rc_0007_event_intake'), (N'rc_0008_parish'),
             (N'rc_0009_graph'), (N'rc_0010_calendar'), (N'rc_0011_confirmation'),
             (N'rc_0012_resource')) AS s(name)
WHERE NOT EXISTS (SELECT 1 FROM dbo.rc_schema_version v WHERE v.script_name = s.name);

IF @missing IS NULL
    BEGIN SET @ok += 1; PRINT '  OK   15.4   Fassungsverzeichnis fuehrt jedes erwartete Skript'; END
ELSE
    BEGIN SET @fail += 1; PRINT '  FAIL 15.4   Fassungsverzeichnis, es fehlen: ' + @missing; END

/* Vorbereitung */
DECLARE @area uniqueidentifier = NEWID();
DECLARE @ledger uniqueidentifier = NEWID();

INSERT dbo.rc_area (id, tenant_id, title_sealed, ledger_id, created_at)
VALUES (@area, NEWID(), 0x00, @ledger, SYSDATETIMEOFFSET());

INSERT dbo.rc_area_epoch (area_id, epoch, created_at, reason)
VALUES (@area, 1, SYSDATETIMEOFFSET(), N'initial');

/* --- 9.17 / BEFUND 28: die beiden Ausblend-Faelle ------------------------- */

BEGIN TRY
    INSERT dbo.rc_message (id, area_id, epoch, author_role_id, body_sealed, posted_at, hidden_at, hidden_kind)
    VALUES (NEWID(), @area, 1, NEWID(), 0x01, SYSDATETIMEOFFSET(), SYSDATETIMEOFFSET(), 1);
    SET @fail += 1; PRINT '  FAIL 9.17    Urheber-Ausblenden ohne Entfernen wurde angenommen';
END TRY
BEGIN CATCH
    SET @ok += 1; PRINT '  OK   9.17    Urheber-Ausblenden MUSS Autor und Text entfernen';
END CATCH

BEGIN TRY
    INSERT dbo.rc_message (id, area_id, epoch, author_role_id, body_sealed, posted_at, hidden_at, hidden_kind)
    VALUES (NEWID(), @area, 1, NEWID(), 0x01, SYSDATETIMEOFFSET(), SYSDATETIMEOFFSET(), 2);
    SET @ok += 1; PRINT '  OK   9.17    Admin-Ausblenden behaelt Autor und Text (umkehrbar)';
END TRY
BEGIN CATCH
    SET @fail += 1; PRINT '  FAIL 9.17    Admin-Ausblenden: ' + ERROR_MESSAGE();
END CATCH

BEGIN TRY
    INSERT dbo.rc_message (id, area_id, epoch, body_sealed, posted_at)
    VALUES (NEWID(), @area, 1, 0x01, SYSDATETIMEOFFSET());
    SET @fail += 1; PRINT '  FAIL 9.17    Sichtbare Nachricht ohne Autor wurde angenommen';
END TRY
BEGIN CATCH
    SET @ok += 1; PRINT '  OK   9.17    Sichtbare Nachricht braucht Autor und Text';
END CATCH

/* --- 7.6: Kette ist append-only und forkfrei ------------------------------ */

DECLARE @le uniqueidentifier = NEWID();
DECLARE @zero binary(32) = 0x0000000000000000000000000000000000000000000000000000000000000000;

INSERT dbo.rc_ledger_entry (id, ledger_id, sequence_no, previous_hash, entry_hash, payload_canonical,
    subject_id, tenant_id, module_id, signer_key_fp, key_version, transaction_id,
    account_commitment, signature, server_timestamp)
VALUES (@le, @ledger, 1, @zero,
    0x1111111111111111111111111111111111111111111111111111111111111111, 0x7B7D,
    NEWID(), NEWID(), N'chat', 0x22222222222222222222222222222222, 1, NEWID(),
    0x3333333333333333333333333333333333333333333333333333333333333333, 0x44, SYSDATETIMEOFFSET());

BEGIN TRY
    UPDATE dbo.rc_ledger_entry SET module_id = N'geaendert' WHERE id = @le;
    SET @fail += 1; PRINT '  FAIL 7.6     UPDATE auf die Kette wurde angenommen';
END TRY
BEGIN CATCH
    SET @ok += 1; PRINT '  OK   7.6     UPDATE auf die Kette wird abgelehnt';
END CATCH

BEGIN TRY
    DELETE dbo.rc_ledger_entry WHERE id = @le;
    SET @fail += 1; PRINT '  FAIL 7.6     DELETE auf die Kette wurde angenommen';
END TRY
BEGIN CATCH
    SET @ok += 1; PRINT '  OK   7.6     DELETE auf die Kette wird abgelehnt';
END CATCH

/* Der Befund P0-5 des Audits: zwei Eintraege mit derselben Folgenummer waeren
   ein Fork. Die Eindeutigkeitsbedingung verhindert ihn in der Datenbank. */
BEGIN TRY
    INSERT dbo.rc_ledger_entry (id, ledger_id, sequence_no, previous_hash, entry_hash, payload_canonical,
        subject_id, tenant_id, module_id, signer_key_fp, key_version, transaction_id,
        account_commitment, signature, server_timestamp)
    VALUES (NEWID(), @ledger, 1, @zero,
        0x5555555555555555555555555555555555555555555555555555555555555555, 0x7B7D,
        NEWID(), NEWID(), N'chat', 0x22222222222222222222222222222222, 1, NEWID(),
        0x3333333333333333333333333333333333333333333333333333333333333333, 0x44, SYSDATETIMEOFFSET());
    SET @fail += 1; PRINT '  FAIL 7.6     Fork moeglich: zweite Folgenummer 1 angenommen';
END TRY
BEGIN CATCH
    SET @ok += 1; PRINT '  OK   7.6     Fork verhindert: Folgenummer je Kette eindeutig';
END CATCH

/* --- 12.9 / 12.10: Protokoll und Einwilligungen sind unveraenderlich ------ */

BEGIN TRY
    DELETE dbo.rc_data_access_log;
    SET @fail += 1; PRINT '  FAIL 12.9    Zugriffsprotokoll war loeschbar';
END TRY
BEGIN CATCH
    SET @ok += 1; PRINT '  OK   12.9    Zugriffsprotokoll ist nicht loeschbar';
END CATCH

BEGIN TRY
    UPDATE dbo.rc_consent_text SET body = N'x';
    SET @fail += 1; PRINT '  FAIL 12.10   Einwilligungstext war aenderbar';
END TRY
BEGIN CATCH
    SET @ok += 1; PRINT '  OK   12.10   Einwilligungstexte sind unveraenderlich';
END CATCH

/* --- 3.5: Zertifikate brauchen eine gueltige Lebenszeit ------------------- */

BEGIN TRY
    INSERT dbo.rc_certificate (id, subject_role_id, scope_kind, scope_id, capability,
        issued_by_role_id, issued_at, expires_at, signature)
    VALUES (NEWID(), NEWID(), N'area', @area, N'admin', NEWID(),
        SYSDATETIMEOFFSET(), DATEADD(day, -1, SYSDATETIMEOFFSET()), 0x00);
    SET @fail += 1; PRINT '  FAIL 3.5     Zertifikat mit Ablauf vor Ausstellung angenommen';
END TRY
BEGIN CATCH
    SET @ok += 1; PRINT '  OK   3.5     Zertifikat braucht gueltige Lebenszeit';
END CATCH

/* --- 9.14.4: genau ein kanonisches Gespraech je Personenpaar -------------- */

DECLARE @pair nvarchar(80) = N'aaa|bbb';
INSERT dbo.rc_area (id, tenant_id, title_sealed, ledger_id, created_at, is_direct, dm_pair_key)
VALUES (NEWID(), NEWID(), 0x00, NEWID(), SYSDATETIMEOFFSET(), 1, @pair);

BEGIN TRY
    INSERT dbo.rc_area (id, tenant_id, title_sealed, ledger_id, created_at, is_direct, dm_pair_key)
    VALUES (NEWID(), NEWID(), 0x00, NEWID(), SYSDATETIMEOFFSET(), 1, @pair);
    SET @fail += 1; PRINT '  FAIL 9.14.4  Zweites Gespraech fuer dasselbe Paar angenommen';
END TRY
BEGIN CATCH
    SET @ok += 1; PRINT '  OK   9.14.4  Genau ein kanonisches Gespraech je Paar';
END CATCH

/* --- 4.5: Aufsicht kann ihre Sichtbarkeit nicht abschalten ---------------- */

BEGIN TRY
    INSERT dbo.rc_read_state (area_id, role_id, last_read_seq, last_read_at, receipts_enabled, is_supervisor)
    VALUES (@area, NEWID(), 0, SYSDATETIMEOFFSET(), 0, 1);
    SET @fail += 1; PRINT '  FAIL 4.5     Aufsicht konnte Lesebestaetigung abschalten';
END TRY
BEGIN CATCH
    SET @ok += 1; PRINT '  OK   4.5     Aufsicht kann Sichtbarkeit nicht abschalten';
END CATCH

/* --- 9.10.2: 10 MB je Datei ---------------------------------------------- */

DECLARE @acct uniqueidentifier = NEWID();
INSERT dbo.rc_account (id, username, login_verifier, login_salt, password_salt, master_key_sealed, created_at)
VALUES (@acct, N'pruefkonto', 0x00, 0x00, 0x00, 0x00, SYSDATETIMEOFFSET());

DECLARE @msg uniqueidentifier = (SELECT TOP 1 id FROM dbo.rc_message);

BEGIN TRY
    INSERT dbo.rc_attachment (id, message_id, owner_account_id, size_bytes, content_sealed_path,
        content_sha256, file_name_sealed, created_at)
    VALUES (NEWID(), @msg, @acct, 10485761, N'/x', 0x00, 0x00, SYSDATETIMEOFFSET());
    SET @fail += 1; PRINT '  FAIL 9.10.2  Anhang ueber 10 MB angenommen';
END TRY
BEGIN CATCH
    SET @ok += 1; PRINT '  OK   9.10.2  Anhang ueber 10 MB wird abgelehnt';
END CATCH

/* --- 3.9: Betriebsart und Karenzzeit in gueltigen Grenzen ----------------- */

BEGIN TRY
    INSERT dbo.rc_account (id, username, login_verifier, login_salt, password_salt,
        master_key_sealed, created_at, recovery_grace_days)
    VALUES (NEWID(), N'pruefkonto2', 0x00, 0x00, 0x00, 0x00, SYSDATETIMEOFFSET(), 31);
    SET @fail += 1; PRINT '  FAIL 8.3     Karenzzeit ueber 30 Tage angenommen';
END TRY
BEGIN CATCH
    SET @ok += 1; PRINT '  OK   8.3     Karenzzeit bleibt zwischen 0 und 30 Tagen';
END CATCH

PRINT '';
PRINT '  ' + CAST(@ok AS nvarchar(10)) + ' bestanden, ' + CAST(@fail AS nvarchar(10)) + ' fehlgeschlagen';
GO
