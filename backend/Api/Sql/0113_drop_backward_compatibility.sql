/*
    0113 — SCHRITT 3: DIE RÜCKWÄRTSVERTRÄGLICHKEIT GEHT AUCH AUS DER DATENBANK
    (documentation/TRANSFER.md).

    Nimmt weg, was der Dienst seit Schritt 3 nicht mehr liest. Deshalb läuft es
    NACH dem neuen Dienst:

        migrate --through 0112   →   Dienst und Seite ausrollen   →   migrate

    Vorher, unter dem alten Dienst, hiessen diese Spalten noch etwas.

    Verloren geht dabei nichts: jede Spalte ist leer, die Tabelle hat keine
    Zeile, die Rollen hält niemand und nichts verweist auf sie, die Schemata
    sind leer. Wo das zur Laufzeit nicht mehr stimmt, bricht der Lauf ab (die
    Transaktion nimmt alles zurück), statt etwas zu löschen.
*/

SET NOCOUNT ON;

/* Nichts davon darf Daten tragen — sonst hält der Lauf an. */
IF EXISTS (SELECT 1 FROM app.module WHERE controller_name IS NOT NULL OR controller_address IS NOT NULL OR controller_email IS NOT NULL)
    THROW 51130, N'app.module.controller_* trägt noch Werte — erst in den Obszar übertragen (Administrator danych).', 1;
IF EXISTS (SELECT 1 FROM app.access WHERE recipient_name IS NOT NULL OR personal_note_sealed IS NOT NULL OR internal_note_sealed IS NOT NULL)
    THROW 51131, N'app.access trägt noch offene Namen oder Notizen.', 1;
IF EXISTS (SELECT 1 FROM app.claim WHERE holder_name IS NOT NULL)
    THROW 51132, N'app.claim.holder_name trägt noch offene Namen.', 1;
IF EXISTS (SELECT 1 FROM app.slug WHERE internal_for_role_id IS NOT NULL)
    THROW 51133, N'app.slug.internal_for_role_id ist noch gesetzt — die Seite erst an Bereiche binden.', 1;
IF EXISTS (SELECT 1 FROM app.area_portal)
    THROW 51134, N'app.area_portal hat noch Zeilen.', 1;
IF EXISTS (SELECT 1 FROM app.slug_field WHERE identity_role IN (N'name', N'contact'))
    THROW 51135, N'app.slug_field trägt noch identity_role name/contact.', 1;
IF EXISTS (SELECT 1 FROM app.certificate WHERE scope_kind <> N'area')
    THROW 51136, N'app.certificate trägt noch Zertifikate auf Seiten (slug) oder Körper (body).', 1;
GO

/* -- Die Zasada einer Rozmowa: nur noch ausgeschrieben ---------------------------- */

/* Was der alte Dienst zwischen 0112 und dem neuen noch angelegt hat. */
UPDATE app.chat SET posting_policy = N'members' WHERE posting_policy = N'legacy';
GO

IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE parent_object_id = OBJECT_ID('app.chat') AND name = N'df_chat_policy')
    ALTER TABLE app.chat DROP CONSTRAINT df_chat_policy;
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('app.chat') AND name = N'ck_chat_policy')
    ALTER TABLE app.chat DROP CONSTRAINT ck_chat_policy;
GO

ALTER TABLE app.chat ADD CONSTRAINT ck_chat_policy CHECK (posting_policy IN (N'members', N'writers'));
GO

/* -- Der Administrator danych steht beim Obszar, nicht am Formular ------------------- */

ALTER TABLE app.module DROP COLUMN controller_name, controller_address, controller_email;
GO

/* -- Namen nie offen (0097), keine Notizen am Platz --------------------------------------- */

ALTER TABLE app.access DROP COLUMN recipient_name, personal_note_sealed, internal_note_sealed;
GO

ALTER TABLE app.claim DROP CONSTRAINT ck_claim_who;
GO

ALTER TABLE app.claim DROP COLUMN holder_name;
GO

/* Wer etwas hält: ein Platz, eine Rolle — oder, von der Kanzlei eingetragen, ein versiegelter Name. */
ALTER TABLE app.claim ADD CONSTRAINT ck_claim_who
    CHECK (access_id IS NOT NULL OR role_id IS NOT NULL OR (by_office = 1 AND holder_name_sealed IS NOT NULL));
GO

/* -- Zertifikate gelten Bereichen; eine Seite führt, wer sie hält, und mit Zugang hängt sie an Bereichen -- */

ALTER TABLE app.certificate DROP CONSTRAINT ck_certificate_scope;
GO

ALTER TABLE app.certificate ADD CONSTRAINT ck_certificate_scope CHECK (scope_kind = N'area');
GO

/* -- Seiten mit Zugang hängen an Bereichen (0051), nicht an einer Rolle --------------------- */

IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('app.slug') AND name = N'ix_slug_internal_role')
    DROP INDEX ix_slug_internal_role ON app.slug;
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID('app.slug') AND name = N'fk_slug_internal_role')
    ALTER TABLE app.slug DROP CONSTRAINT fk_slug_internal_role;
GO

ALTER TABLE app.slug DROP COLUMN internal_for_role_id;
GO

/* Die Vorlage des Portals (0028) — die Seite eines Platzes ist eine Seite mit seinen Bausteinen. */
DROP TABLE app.area_portal;
GO

/* -- Die Angaben einer Person: nur noch die genormten (0038) --------------------------------- */

ALTER TABLE app.slug_field DROP CONSTRAINT ck_slug_field_identity;
GO

ALTER TABLE app.slug_field ADD CONSTRAINT ck_slug_field_identity
    CHECK (identity_role IN (N'none', N'given_name', N'surname', N'phone', N'born', N'address', N'email', N'nickname'));
GO

/*
    -- Rollen, die niemand hält und auf die nichts verweist --------------------------------

    Am 2026-09-18 entstanden, nie gehalten, nie benannt, in der alten Form (ein
    Schlüssel für alles) — niemand kann sie öffnen. Gelöscht wird nur, worauf
    KEINE Spalte verweist, die eine Rolle meint (jede Spalte `…role_id`,
    `…person_id` oder `key_ref` im Schema `app`, ob mit Fremdschlüssel oder ohne).
*/

IF OBJECT_ID('tempdb..#orphan') IS NOT NULL DROP TABLE #orphan;

SELECT r.id INTO #orphan
  FROM app.role r
 WHERE r.kind <> N'account' AND r.created_at < '2026-10-01'
   AND NOT EXISTS (SELECT 1 FROM app.account a WHERE a.person_role_id = r.id);

DECLARE @sql nvarchar(max) = N'';
SELECT @sql = @sql + N'DELETE o FROM #orphan o WHERE EXISTS (SELECT 1 FROM app.' + QUOTENAME(t.name)
            + N' x WHERE x.' + QUOTENAME(c.name) + N' = o.id);' + NCHAR(10)
  FROM sys.columns c
  JOIN sys.tables t ON t.object_id = c.object_id
 WHERE t.schema_id = SCHEMA_ID('app') AND t.name <> N'role'
   AND TYPE_NAME(c.user_type_id) = N'uniqueidentifier'
   AND (c.name LIKE N'%role[_]id' OR c.name LIKE N'%person[_]id' OR c.name = N'key_ref');
EXEC sp_executesql @sql;

DELETE FROM app.role WHERE id IN (SELECT id FROM #orphan);

DROP TABLE #orphan;
GO

/*
    -- Die leeren Schemata des alten Systems ---------------------------------------------

    Ihre Tabellen sind fort (vor 0078); die Hüllen gehören `dbo`. Es bleiben
    `app`, die eingebauten (ihre Nummern liegen unter 5 oder über 16383) und
    jedes Schema, das noch etwas enthält oder das Standardschema eines
    Datenbankbenutzers ist — sonst könnte sich jemand nicht mehr anmelden.
*/

DECLARE @drop nvarchar(max) = N'';
SELECT @drop = @drop + N'DROP SCHEMA ' + QUOTENAME(s.name) + N';' + NCHAR(10)
  FROM sys.schemas s
 WHERE s.schema_id BETWEEN 5 AND 16383
   AND s.name <> N'app'
   AND s.name <> SCHEMA_NAME()
   AND NOT EXISTS (SELECT 1 FROM sys.objects o WHERE o.schema_id = s.schema_id)
   AND NOT EXISTS (SELECT 1 FROM sys.types y WHERE y.schema_id = s.schema_id)
   AND NOT EXISTS (SELECT 1 FROM sys.xml_schema_collections x WHERE x.schema_id = s.schema_id)
   AND NOT EXISTS (SELECT 1 FROM sys.database_principals p WHERE p.default_schema_name = s.name)
   AND NOT EXISTS (SELECT 1 FROM sys.database_principals p WHERE p.name = s.name);
EXEC sp_executesql @drop;
GO
