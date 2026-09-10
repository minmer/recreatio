/*
    Identität und Schlüssel.

    Namensregeln: alles im Schema `app`, keine Präfixe, Einzahl, snake_case.
    `_sealed` heisst versiegelt, `_public` heisst absichtlich im Klartext — die
    Grenze ist am Spaltennamen ablesbar.

    Kein `tenant_id`. Im Altbestand entstand er pro Konto und war nie ein
    Mandant; wer mehrere Träger braucht, bekommt sie über `app.body`.
*/

IF SCHEMA_ID('app') IS NULL
    EXEC('CREATE SCHEMA app');
GO

/*
    Das Konto — ohne Passwort.

    Der Browser rechnet aus dem Passwort einen PasswordKey (Argon2id, 64 MiB)
    und schickt nur den; der Dienst leitet daraus mit `login_salt` den
    Vergleichswert ab. Wer diese Tabelle besitzt, hat weder Passwort noch
    Schlüssel: `login_verifier` öffnet nichts, `master_key_sealed` liegt unter
    dem PasswordKey.

    Der Hauptschlüssel ist zufällig, nicht abgeleitet — beim Passwortwechsel
    wird deshalb genau eine Hülle neu versiegelt statt alles darunter.
*/
IF OBJECT_ID('app.account', 'U') IS NULL
BEGIN
    CREATE TABLE app.account
    (
        id                uniqueidentifier NOT NULL,

        -- Klein gespeichert: „Anna" und „anna" sind dasselbe Konto.
        login_id          nvarchar(64)     NOT NULL,

        -- Für Argon2id im Browser; geht offen heraus, muss es auch.
        password_salt     varbinary(32)    NOT NULL,

        -- Für den Vergleichswert auf dem Server; verlässt die Datenbank nie.
        login_salt        varbinary(32)    NOT NULL,
        login_verifier    varbinary(64)    NOT NULL,

        master_key_sealed varbinary(max)   NOT NULL,

        created_at        datetimeoffset   NOT NULL,

        -- Gesperrt statt gelöscht: ein gelöschtes Konto nimmt alles mit.
        disabled_at       datetimeoffset   NULL,

        CONSTRAINT pk_account PRIMARY KEY (id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_account_login')
    CREATE UNIQUE INDEX ux_account_login ON app.account (login_id);
GO

/*
    Die Sitzung. Nur der SHA-256 des Geheimnisses — der Klartext existiert im
    Keks des Browsers und sonst nirgends.
*/
IF OBJECT_ID('app.session', 'U') IS NULL
BEGIN
    CREATE TABLE app.session
    (
        id           uniqueidentifier NOT NULL,
        account_id   uniqueidentifier NOT NULL,
        token_sha256 varbinary(32)    NOT NULL,

        created_at   datetimeoffset   NOT NULL,
        expires_at   datetimeoffset   NOT NULL,
        revoked_at   datetimeoffset   NULL,

        CONSTRAINT pk_session PRIMARY KEY (id),
        CONSTRAINT fk_session_account FOREIGN KEY (account_id) REFERENCES app.account (id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_session_token')
    CREATE UNIQUE INDEX ux_session_token ON app.session (token_sha256);
GO

/*
    Die Rolle: wofür jemand Schlüssel hält, nicht der Mensch.

        person   ein Konto in der Welt der Schlüssel
        office   eine Stelle — übergebbar, ohne ein Konto weiterzugeben
        member   Zugehörigkeit zu einem Körper

    Der Name ist versiegelt: wer die Tabelle liest, sieht Rollen und Kanten,
    keine Namensliste.
*/
IF OBJECT_ID('app.role', 'U') IS NULL
BEGIN
    CREATE TABLE app.role
    (
        id                  uniqueidentifier NOT NULL,
        kind                nvarchar(16)     NOT NULL,

        display_name_sealed varbinary(max)   NULL,

        -- Öffentliche Hälften: damit kann man geben, ohne etwas zu haben.
        wrap_public_key     varbinary(max)   NOT NULL,
        sign_public_key     varbinary(max)   NOT NULL,

        created_at          datetimeoffset   NOT NULL,
        revoked_at          datetimeoffset   NULL,

        CONSTRAINT pk_role PRIMARY KEY (id),
        CONSTRAINT ck_role_kind CHECK (kind IN (N'person', N'office', N'member'))
    );
END
GO

/*
    Wer hält wen. Ein Graph, keine Hierarchie — dieselbe Rolle kann von
    mehreren gehalten werden, und daran hängt die Übergabe.

    Unterschrieben, sonst könnte wer die Tabelle schreiben darf sich selbst
    überall hineinschreiben.
*/
IF OBJECT_ID('app.role_edge', 'U') IS NULL
BEGIN
    CREATE TABLE app.role_edge
    (
        id             uniqueidentifier NOT NULL,
        from_role_id   uniqueidentifier NOT NULL,
        to_role_id     uniqueidentifier NOT NULL,
        signer_role_id uniqueidentifier NOT NULL,
        signature      varbinary(max)   NOT NULL,

        created_at     datetimeoffset   NOT NULL,
        revoked_at     datetimeoffset   NULL,

        CONSTRAINT pk_role_edge PRIMARY KEY (id),
        CONSTRAINT fk_role_edge_from FOREIGN KEY (from_role_id) REFERENCES app.role (id),
        CONSTRAINT fk_role_edge_to   FOREIGN KEY (to_role_id)   REFERENCES app.role (id),
        CONSTRAINT ck_role_edge_loop CHECK (from_role_id <> to_role_id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_role_edge_pair')
    CREATE UNIQUE INDEX ux_role_edge_pair ON app.role_edge (from_role_id, to_role_id)
        WHERE revoked_at IS NULL;
GO

/*
    Der Bereich — die Einheit der Vertraulichkeit. Er hat keinen lesbaren
    Namen; was er ist, steht in `app.body`, das ihn besitzt.
*/
IF OBJECT_ID('app.area', 'U') IS NULL
BEGIN
    CREATE TABLE app.area
    (
        id            uniqueidentifier NOT NULL,
        current_epoch int              NOT NULL,
        created_at    datetimeoffset   NOT NULL,

        CONSTRAINT pk_area PRIMARY KEY (id),
        CONSTRAINT ck_area_epoch CHECK (current_epoch >= 1)
    );
END
GO

/*
    Epochen. Wer geht, soll Künftiges nicht mehr lesen — alles neu zu
    verschlüsseln wäre bei jedem Austritt eine Stunde Rechenzeit. Stattdessen
    wird geschnitten: ab hier gilt ein neuer Schlüssel.

    Was er schon gelesen hat, behält er. Das rückwirkend zu nehmen kann keine
    Software, und so zu tun als könnte sie es wäre die eigentliche Unehrlichkeit.
*/
IF OBJECT_ID('app.area_epoch', 'U') IS NULL
BEGIN
    CREATE TABLE app.area_epoch
    (
        area_id        uniqueidentifier NOT NULL,
        epoch          int              NOT NULL,
        reason         nvarchar(24)     NOT NULL,
        cut_by_role_id uniqueidentifier NULL,
        created_at     datetimeoffset   NOT NULL,

        CONSTRAINT pk_area_epoch PRIMARY KEY (area_id, epoch),
        CONSTRAINT fk_area_epoch_area FOREIGN KEY (area_id) REFERENCES app.area (id),
        CONSTRAINT ck_area_epoch_reason
            CHECK (reason IN (N'initial', N'member_added', N'member_left', N'rotation'))
    );
END
GO

/*
    Ein Schlüssel, verpackt für eine Rolle. Eine Tabelle für alle Arten:

        role         der Schlüssel einer Rolle, für ihren Halter
        epoch        ein Epochenschlüssel eines Bereichs
        shared_view  eine Lesefreigabe an eine fremde Rolle
        data         der Schlüssel eines einzelnen Elements

    `destroyed_at` statt DELETE: Löschung durch Schlüsselvernichtung ist ein
    Vorgang, der protokolliert gehört — eine verschwundene Zeile protokolliert
    nichts.
*/
IF OBJECT_ID('app.key_grant', 'U') IS NULL
BEGIN
    CREATE TABLE app.key_grant
    (
        id                 uniqueidentifier NOT NULL,
        role_id            uniqueidentifier NOT NULL,

        key_kind           nvarchar(16)     NOT NULL,
        key_ref            uniqueidentifier NOT NULL,
        key_epoch          int              NULL,

        sealed_blob        varbinary(max)   NOT NULL,

        granted_by_role_id uniqueidentifier NOT NULL,
        created_at         datetimeoffset   NOT NULL,
        destroyed_at       datetimeoffset   NULL,

        CONSTRAINT pk_key_grant PRIMARY KEY (id),
        CONSTRAINT fk_key_grant_role FOREIGN KEY (role_id) REFERENCES app.role (id),

        CONSTRAINT ck_key_grant_kind
            CHECK (key_kind IN (N'role', N'epoch', N'shared_view', N'data')),

        -- Ein Epochenschlüssel ohne Epoche wäre nicht auffindbar.
        CONSTRAINT ck_key_grant_epoch
            CHECK ((key_kind = N'epoch' AND key_epoch IS NOT NULL)
                OR (key_kind <> N'epoch' AND key_epoch IS NULL))
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_key_grant_one')
    CREATE UNIQUE INDEX ux_key_grant_one
        ON app.key_grant (role_id, key_kind, key_ref, key_epoch)
        WHERE destroyed_at IS NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_key_grant_role')
    CREATE INDEX ix_key_grant_role ON app.key_grant (role_id) WHERE destroyed_at IS NULL;
GO

/*
    Was eine Rolle DARF — getrennt von dem, was sie KANN.

    Ein Zertifikat ohne Schlüssel darf lesen und kann es nicht; ein Schlüssel
    ohne Zertifikat kann und darf nicht. Beides zusammenzulegen hiesse, eine
    der beiden Kontrollen aufzugeben.

    `expires_at` ist Pflicht: eine Berechtigung ohne Ende nimmt niemand zurück.
*/
IF OBJECT_ID('app.certificate', 'U') IS NULL
BEGIN
    CREATE TABLE app.certificate
    (
        id                uniqueidentifier NOT NULL,
        subject_role_id   uniqueidentifier NOT NULL,

        scope_kind        nvarchar(16)     NOT NULL,
        scope_id          uniqueidentifier NOT NULL,
        capability        nvarchar(16)     NOT NULL,

        issued_by_role_id uniqueidentifier NOT NULL,
        signature         varbinary(max)   NOT NULL,

        issued_at         datetimeoffset   NOT NULL,
        expires_at        datetimeoffset   NOT NULL,
        revoked_at        datetimeoffset   NULL,

        CONSTRAINT pk_certificate PRIMARY KEY (id),
        CONSTRAINT fk_certificate_subject FOREIGN KEY (subject_role_id) REFERENCES app.role (id),

        CONSTRAINT ck_certificate_scope CHECK (scope_kind IN (N'area', N'body')),
        CONSTRAINT ck_certificate_capability
            CHECK (capability IN (N'read', N'write', N'admin', N'certify'))
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_certificate_scope')
    CREATE INDEX ix_certificate_scope
        ON app.certificate (scope_kind, scope_id, subject_role_id)
        WHERE revoked_at IS NULL;
GO
