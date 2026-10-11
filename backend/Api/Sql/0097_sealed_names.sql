/*
    NAMEN LIEGEN NIE OFFEN (0097) — der Name eines Formulars und der Name eines
    Menschen stehen nur noch versiegelt in der Datenbank.

    Bisher standen beide im Klartext: `module.name` (0036, „gebraucht, bevor
    jemand einen Schlüssel hat") und `access.recipient_name` (0022, „damit die
    Kanzlei ihn zuordnen kann"), dazu `claim.holder_name` (0045). Wer die
    Tabellen las, sah „Jan Kowalski → Zapisy do bierzmowania → Parafia …" —
    die Antworten waren zu, die Zuordnung nicht. Jetzt:

        Formular      module.name_sealed / name_epoch
                      unter dem Schlüssel SEINES Bereichs (dort liegen seine
                      Fragen): lesen kann den Namen, wer die Fragen lesen kann.
                      Ein öffentliches Formular hat einen offenen Bereich — sein
                      Name ist so öffentlich wie es selbst.
        Gruppe        form_group.area_id / name_sealed / name_epoch (0096)
        Mensch        access.name_sealed / name_epoch — unter dem Schlüssel des
                      Bereichs des Platzes (Kanzlei, Mitglieder);
                      access.own_name_sealed — unter dem Platzschlüssel (er selbst)
        Termin        claim.holder_name_sealed — unter dem Bereichsschlüssel
                      (holder_name_epoch) ODER mit einem Wegwerfschlüssel, der für
                      die Annahme des Bereichs verpackt ist (holder_name_wrapped);
                      claim.ask_name_sealed — für den Gastgeber (P-256, ECIES),
                      dessen Paar am Anspruch: host_wrap_public und
                      host_wrap_private_sealed (unter dem Schlüssel des Halters).

    Versiegelt wird im Browser; der Dienst sieht keinen Namen mehr, auch nicht im
    Vorbeigehen. Die Glocke bekommt die Hüllen und öffnet sie auf dem Gerät — wie
    eine Rozmowa.

    WAS SCHON OFFEN DASTEHT, kann der Dienst nicht versiegeln: er hat keinen
    Schlüssel. Das tut der Browser dessen, der ihn hat, beim nächsten Öffnen des
    Warsztat (`POST /workspace/names/seal`) — und in derselben Anweisung wird der
    Klartext gelöscht. Bis dahin bleiben die alten Spalten stehen, danach sind sie
    leer.
*/

/* -- Formulare ------------------------------------------------------------------ */

IF COL_LENGTH('app.module', 'name_sealed') IS NULL
    ALTER TABLE app.module ADD name_sealed varbinary(1024) NULL, name_epoch int NULL;
GO

/* Ein Formular hat keinen Klartextnamen mehr; andere Bausteine (Text, Kalender) behalten ihren. */
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('app.module') AND name = 'name' AND is_nullable = 0)
    ALTER TABLE app.module ALTER COLUMN name nvarchar(200) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_module_name_sealed' AND parent_object_id = OBJECT_ID('app.module'))
    ALTER TABLE app.module ADD CONSTRAINT ck_module_name_sealed
        CHECK ((name_sealed IS NULL AND name_epoch IS NULL) OR (name_sealed IS NOT NULL AND name_epoch IS NOT NULL));
GO

/* -- Gruppen von Formularen (0096) ---------------------------------------------- */

IF COL_LENGTH('app.form_group', 'area_id') IS NULL
    ALTER TABLE app.form_group ADD area_id uniqueidentifier NULL
        CONSTRAINT fk_form_group_area FOREIGN KEY REFERENCES app.area (id);
GO

IF COL_LENGTH('app.form_group', 'name_sealed') IS NULL
    ALTER TABLE app.form_group ADD name_sealed varbinary(1024) NULL, name_epoch int NULL;
GO

/* Der Klartext: weg, solange niemand einen hineingeschrieben hat (0096 wurde nie ausgeliefert). */
IF COL_LENGTH('app.form_group', 'name') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM app.form_group)
    EXEC (N'ALTER TABLE app.form_group DROP COLUMN name;');
GO

IF COL_LENGTH('app.form_group', 'name') IS NOT NULL
    EXEC (N'ALTER TABLE app.form_group ALTER COLUMN name nvarchar(200) NULL;');
GO

/* -- Plätze ----------------------------------------------------------------------- */

IF COL_LENGTH('app.access', 'name_sealed') IS NULL
    ALTER TABLE app.access ADD name_sealed varbinary(1024) NULL, name_epoch int NULL;
GO

IF COL_LENGTH('app.access', 'own_name_sealed') IS NULL
    ALTER TABLE app.access ADD own_name_sealed varbinary(1024) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_access_name_sealed' AND parent_object_id = OBJECT_ID('app.access'))
    ALTER TABLE app.access ADD CONSTRAINT ck_access_name_sealed
        CHECK ((name_sealed IS NULL AND name_epoch IS NULL) OR (name_sealed IS NOT NULL AND name_epoch IS NOT NULL));
GO

/* -- Termine ------------------------------------------------------------------------ */

IF COL_LENGTH('app.claim', 'holder_name_sealed') IS NULL
    ALTER TABLE app.claim ADD
        holder_name_sealed       varbinary(1024) NULL,
        holder_name_epoch        int             NULL,
        holder_name_wrapped      varbinary(1024) NULL,
        ask_name_sealed          varbinary(1024) NULL,
        host_wrap_public         varbinary(256)  NULL,
        host_wrap_private_sealed varbinary(512)  NULL;
GO

/* Unter dem Bereichsschlüssel ODER für die Annahme — eines von beiden, nie beides. */
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_claim_holder_name' AND parent_object_id = OBJECT_ID('app.claim'))
    ALTER TABLE app.claim ADD CONSTRAINT ck_claim_holder_name
        CHECK (holder_name_sealed IS NULL
               OR (holder_name_epoch IS NOT NULL AND holder_name_wrapped IS NULL)
               OR (holder_name_epoch IS NULL AND holder_name_wrapped IS NOT NULL));
GO

/* Wen die Kanzlei ohne Link einträgt, der steht mit seinem Namen da (0049) — jetzt mit dem versiegelten. */
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_claim_who'
            AND OBJECT_NAME(parent_object_id) = 'claim' AND definition NOT LIKE '%holder_name_sealed%')
    ALTER TABLE app.claim DROP CONSTRAINT ck_claim_who;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_claim_who'
                AND OBJECT_NAME(parent_object_id) = 'claim')
    ALTER TABLE app.claim ADD CONSTRAINT ck_claim_who
        CHECK (access_id IS NOT NULL OR role_id IS NOT NULL
               OR (by_office = 1 AND (holder_name IS NOT NULL OR holder_name_sealed IS NOT NULL)));
GO
