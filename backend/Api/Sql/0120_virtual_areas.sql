/*
    FORMULARE: ROLLEN UND VIRTUELLE BEREICHE (0120, 2026-10-21).

    =========================================================================
    1. WAS EINE EINSENDUNG WIRD
    =========================================================================

    Ein Formular sagt, welche ROLLE oder welche ROLLEN jede Einsendung hält.
    Eine Rolle gibt Zugang zu Bereichen AUSSERHALB der Einsendung — zur
    Gruppe, zur Pfarrei. 0091 hatte genau eine (`module.member_role_id`);
    jetzt stehen sie als Zeilen in `module_role`, und `member_role_id` wird
    nicht mehr gelesen. Gehalten wird wie bisher über `access_role`.

    =========================================================================
    2. DER VIRTUELLE BEREICH
    =========================================================================

    Er beschreibt einen Bereich, den JEDE Einsendung für sich bekommt — ihren
    Kleinbereich —, und entscheidet, wie andere mit diesem Teil ihrer Daten
    umgehen:

        der Einsender selbst      none / read / write   (`submitter_level`)
        Rollen                    ihre Zertifikate am virtuellen Bereich:
                                  wer eine davon hält, erreicht diesen
                                  Kleinbereich JEDER Einsendung

    Ein Formular kann mehrere haben: was der Einsender mit den Leitern teilt,
    was nur die Leiter über jeden führen, was mit einer anderen Rolle geteilt
    wird. Der virtuelle Bereich ist eine gewöhnliche Zeile in `app.area`
    (Vater: der Bereich des Formulars) mit eigenem Schlüssel für das, was in
    ihm selbst angelegt wird.

    =========================================================================
    3. DER KLEINBEREICH — die Regel, angewandt im Browser eines Leiters
    =========================================================================

    Je Einsendung und virtuellem Bereich eine Zeile in `app.area` (Vater: der
    virtuelle Bereich) und eine in `area_instance`. Er ist ein gewöhnlicher
    Bereich mit eigenen Zertifikaten: der Browser eines Leiters (admin oder
    certify am virtuellen Bereich) schreibt sie GENAU nach den Zertifikaten des
    virtuellen Bereichs, und trägt nach, wenn dort eine Rolle dazukommt; geht
    eine, nimmt der Dienst sie in jedem Kleinbereich zurück. So gilt für den
    Kleinbereich alles, was für Bereiche gilt — Rozmowa, Kalender, Aufgaben,
    Glocke —, ohne dass eine Stelle von virtuellen Bereichen wissen muss. 0035
    bleibt für alle Bereiche: die Verschachtelung ist eine Voraussetzung, keine
    Vererbung.

    Seinen Schlüssel macht derselbe Browser und verpackt ihn für die
    öffentlichen Schlüssel der Rollen der Regel (`key_grant`) und — wenn der
    Einsender ihn erreicht — unter dem Platzschlüssel (`access_grant`, 0024).
    Keine Schlüsselerzeugung je Mensch, nur Verpacken.

    Der Klartextname eines Kleinbereichs ist der seines virtuellen Bereichs,
    nie der Name eines Menschen (0097).

    =========================================================================
    ES WIRD NICHTS GELÖSCHT
    =========================================================================

    Neue Tabellen, und `module_role` übernimmt, was in `member_role_id` steht.
    Die Spalte bleibt stehen, bis eine eigene Migration sie entfernt.
*/

/* -- 1. Die Rollen eines Formulars ---------------------------------------------------- */

IF OBJECT_ID('app.module_role') IS NULL
    CREATE TABLE app.module_role
    (
        module_id      uniqueidentifier  NOT NULL,
        role_id        uniqueidentifier  NOT NULL,
        position       int               NOT NULL,
        set_by_role_id uniqueidentifier  NULL,
        created_at     datetimeoffset(7) NOT NULL,

        CONSTRAINT pk_module_role PRIMARY KEY (module_id, role_id),
        CONSTRAINT fk_module_role_module FOREIGN KEY (module_id) REFERENCES app.module (id),
        CONSTRAINT fk_module_role_role   FOREIGN KEY (role_id)   REFERENCES app.role (id)
    );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_module_role_role')
    CREATE INDEX ix_module_role_role ON app.module_role (role_id);
GO

INSERT INTO app.module_role (module_id, role_id, position, set_by_role_id, created_at)
SELECT m.id, m.member_role_id, 0, NULL, SYSDATETIMEOFFSET()
  FROM app.module m
 WHERE m.member_role_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM app.module_role r
                    WHERE r.module_id = m.id AND r.role_id = m.member_role_id);
GO

/* -- 2. Virtuelle Bereiche ------------------------------------------------------------ */

IF OBJECT_ID('app.virtual_area') IS NULL
    CREATE TABLE app.virtual_area
    (
        area_id            uniqueidentifier  NOT NULL,
        module_id          uniqueidentifier  NOT NULL,
        submitter_level    nvarchar(8)       NOT NULL CONSTRAINT df_virtual_area_submitter DEFAULT (N'write'),
        position           int               NOT NULL,
        created_by_role_id uniqueidentifier  NOT NULL,
        created_at         datetimeoffset(7) NOT NULL,

        CONSTRAINT pk_virtual_area PRIMARY KEY (area_id),
        CONSTRAINT fk_virtual_area_area   FOREIGN KEY (area_id)   REFERENCES app.area (id),
        CONSTRAINT fk_virtual_area_module FOREIGN KEY (module_id) REFERENCES app.module (id),
        CONSTRAINT fk_virtual_area_role   FOREIGN KEY (created_by_role_id) REFERENCES app.role (id),
        CONSTRAINT ck_virtual_area_submitter CHECK (submitter_level IN (N'none', N'read', N'write'))
    );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_virtual_area_module')
    CREATE INDEX ix_virtual_area_module ON app.virtual_area (module_id, position);
GO

/* -- 3. Kleinbereiche ----------------------------------------------------------------- */

IF OBJECT_ID('app.area_instance') IS NULL
    CREATE TABLE app.area_instance
    (
        area_id            uniqueidentifier  NOT NULL,
        virtual_area_id    uniqueidentifier  NOT NULL,

        /* Die Einsendung — die erste, nicht eine Ergänzung (base_id IS NULL). */
        registration_id    uniqueidentifier  NOT NULL,

        created_by_role_id uniqueidentifier  NULL,
        created_at         datetimeoffset(7) NOT NULL,

        CONSTRAINT pk_area_instance PRIMARY KEY (area_id),
        CONSTRAINT fk_area_instance_area         FOREIGN KEY (area_id)         REFERENCES app.area (id),
        CONSTRAINT fk_area_instance_virtual      FOREIGN KEY (virtual_area_id) REFERENCES app.virtual_area (area_id),
        CONSTRAINT fk_area_instance_registration FOREIGN KEY (registration_id) REFERENCES app.registration (id),
        CONSTRAINT ck_area_instance_not_virtual  CHECK (area_id <> virtual_area_id)
    );
GO

/* Je Einsendung und virtuellem Bereich genau einer. */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_area_instance')
    CREATE UNIQUE INDEX uq_area_instance ON app.area_instance (virtual_area_id, registration_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_area_instance_registration')
    CREATE INDEX ix_area_instance_registration ON app.area_instance (registration_id);
GO
