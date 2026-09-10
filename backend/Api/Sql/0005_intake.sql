/*
    Der Übergang — wie jemand von aussen nach innen kommt. Zwei Türen, weil die
    Menschen davor verschieden sind:

        Einladung  für jemanden MIT Konto. Der Link trägt einen
                   Rollenschlüssel; wer ihn einlöst, hängt die Rolle an seine.

        Zugang     für jemanden OHNE Konto. Der Link IST der Ausweis. Ein
                   Firmkandidat ist vierzehn und hat kein Konto.

    Der Altbestand konnte die zweite Tür nur bei Ereignissen; deshalb liess
    sich ein Firmjahrgang nicht als Gruppe führen, obwohl er einer ist. Hier
    hängt sie am Körper und steht allen offen.
*/

/*
    Die Annahme.

    Ein Formular sammelt von Fremden; die Antwort muss dort landen, wo nur das
    Amt sie öffnet. Dafür ein Schlüsselpaar: die öffentliche Hälfte steht offen
    am Formular, die private unter dem Amtsschlüssel.

    Im Altbestand lag sie zeitweise unter dem Epochenschlüssel des Bereichs —
    damit konnte jeder Helfer sämtliche Anmeldungen lesen, ohne dass ihm jemand
    etwas gegeben hätte. Es folgte aus der Mitgliedschaft.
*/
IF OBJECT_ID('app.intake', 'U') IS NULL
BEGIN
    CREATE TABLE app.intake
    (
        body_id            uniqueidentifier NOT NULL,

        public_key         varbinary(max) NOT NULL,

        -- Unter dem Schlüssel des Amtes, nicht unter einer Epoche: ein Schnitt
        -- macht sie deshalb nicht unbrauchbar.
        private_key_sealed varbinary(max) NOT NULL,
        sealed_for_role_id uniqueidentifier NOT NULL,

        created_at         datetimeoffset NOT NULL,

        CONSTRAINT pk_intake PRIMARY KEY (body_id),
        CONSTRAINT fk_intake_body FOREIGN KEY (body_id) REFERENCES app.body (id),
        CONSTRAINT fk_intake_role FOREIGN KEY (sealed_for_role_id) REFERENCES app.role (id)
    );
END
GO

/*
    Die Einladung. Der Schlüssel reist mit dem LINK, nicht mit der Datenbank:
    `sealed_role_key` liegt unter einer Ableitung aus dem Linkgeheimnis, und
    das steht nirgends — nur sein SHA-256.

    Wer diese Tabelle besitzt, kann die Einladung nicht einlösen. Der Preis
    gehört dazu: ein verlorener Link lässt sich nicht wiederherstellen.
*/
IF OBJECT_ID('app.invitation', 'U') IS NULL
BEGIN
    CREATE TABLE app.invitation
    (
        id                 uniqueidentifier NOT NULL,
        role_id            uniqueidentifier NOT NULL,

        token_sha256       varbinary(32)  NOT NULL,
        sealed_role_key    varbinary(max) NOT NULL,

        label              nvarchar(200) NULL,
        max_uses           int NOT NULL CONSTRAINT df_invitation_uses DEFAULT (1),
        used_count         int NOT NULL CONSTRAINT df_invitation_used DEFAULT (0),

        created_by_role_id uniqueidentifier NOT NULL,
        created_at         datetimeoffset NOT NULL,
        expires_at         datetimeoffset NOT NULL,
        revoked_at         datetimeoffset NULL,

        CONSTRAINT pk_invitation PRIMARY KEY (id),
        CONSTRAINT fk_invitation_role FOREIGN KEY (role_id) REFERENCES app.role (id),
        CONSTRAINT ck_invitation_uses CHECK (max_uses >= 1 AND used_count >= 0)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_invitation_token')
    CREATE UNIQUE INDEX ux_invitation_token ON app.invitation (token_sha256);
GO

/*
    Wer eingelöst hat — nicht nur ein Zähler. Bei einem Link, der mehrfach
    gilt, ist „wer ist dadurch hereingekommen" die einzige Frage, die zählt.
*/
IF OBJECT_ID('app.invitation_redemption', 'U') IS NULL
BEGIN
    CREATE TABLE app.invitation_redemption
    (
        invitation_id uniqueidentifier NOT NULL,
        role_id       uniqueidentifier NOT NULL,
        redeemed_at   datetimeoffset   NOT NULL,

        CONSTRAINT pk_invitation_redemption PRIMARY KEY (invitation_id, role_id),
        CONSTRAINT fk_redemption_invitation FOREIGN KEY (invitation_id) REFERENCES app.invitation (id),
        CONSTRAINT fk_redemption_role       FOREIGN KEY (role_id)       REFERENCES app.role (id)
    );
END
GO

/*
    Der persönliche Zugang — ohne Konto. Der Link ist der Ausweis.

    Eine bewusste Abweichung von der Regel, dass Geheimnisse nicht in Adressen
    stehen: so ein Link wird per SMS verschickt, und eines, das man abtippen
    müsste, wird stattdessen kopiert. Der Preis: wer den Link hat, kommt
    hinein. Deshalb gilt er begrenzt und lässt sich zurücknehmen.

    `epoch_key_sealed` — ohne Konto gibt es keine Rolle, an die man zuteilen
    könnte; der Link selbst trägt den Schlüssel.
*/
IF OBJECT_ID('app.access', 'U') IS NULL
BEGIN
    CREATE TABLE app.access
    (
        id                   uniqueidentifier NOT NULL,
        body_id              uniqueidentifier NOT NULL,

        token_sha256         varbinary(32)  NOT NULL,
        epoch_key_sealed     varbinary(max) NOT NULL,
        epoch                int NOT NULL,

        -- Offen, weil der Ausstellende ihn zuordnen muss, bevor er ihn schickt.
        recipient_name       nvarchar(200) NULL,

        personal_note_sealed varbinary(max) NULL,
        internal_note_sealed varbinary(max) NULL,

        status               nvarchar(16) NOT NULL CONSTRAINT df_access_status DEFAULT (N'active'),
        view_count           int NOT NULL CONSTRAINT df_access_views DEFAULT (0),

        created_at           datetimeoffset NOT NULL,
        expires_at           datetimeoffset NULL,
        revoked_at           datetimeoffset NULL,

        CONSTRAINT pk_access PRIMARY KEY (id),
        CONSTRAINT fk_access_body FOREIGN KEY (body_id) REFERENCES app.body (id),
        CONSTRAINT ck_access_status CHECK (status IN (N'active', N'revoked', N'spent'))
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_access_token')
    CREATE UNIQUE INDEX ux_access_token ON app.access (token_sha256);
GO

/*
    Welche Seiten dieser Zugang öffnet. Eine Zeile je Seite, und ihr Fehlen ist
    die Absage — die einfachste Regel, die es gibt, und deshalb die, bei der
    sich niemand verrechnet.
*/
IF OBJECT_ID('app.access_page', 'U') IS NULL
BEGIN
    CREATE TABLE app.access_page
    (
        access_id uniqueidentifier NOT NULL,
        page_id   uniqueidentifier NOT NULL,

        CONSTRAINT pk_access_page PRIMARY KEY (access_id, page_id),
        CONSTRAINT fk_access_page_access FOREIGN KEY (access_id) REFERENCES app.access (id),
        CONSTRAINT fk_access_page_page   FOREIGN KEY (page_id)   REFERENCES app.page (id)
    );
END
GO

/*
    Die Anmeldung. `claim_sha256` ist die Quittung: wer sich ohne Konto
    anmeldet, beweist damit später, dass sie seine ist — zum Zurückziehen oder
    Ändern. Gespeichert wird nur der Hash.
*/
IF OBJECT_ID('app.registration', 'U') IS NULL
BEGIN
    CREATE TABLE app.registration
    (
        id           uniqueidentifier NOT NULL,
        part_id      uniqueidentifier NOT NULL,

        access_id    uniqueidentifier NULL,
        role_id      uniqueidentifier NULL,
        claim_sha256 varbinary(32)    NULL,

        submitted_at datetimeoffset NOT NULL,
        withdrawn_at datetimeoffset NULL,
        is_hidden    bit NOT NULL CONSTRAINT df_registration_hidden DEFAULT (0),

        CONSTRAINT pk_registration PRIMARY KEY (id),
        CONSTRAINT fk_registration_part   FOREIGN KEY (part_id)   REFERENCES app.page_part (id),
        CONSTRAINT fk_registration_access FOREIGN KEY (access_id) REFERENCES app.access (id),

        -- Eine Anmeldung ohne jede Spur wäre eine, zu der niemand mehr gehört.
        CONSTRAINT ck_registration_who
            CHECK (access_id IS NOT NULL OR role_id IS NOT NULL OR claim_sha256 IS NOT NULL)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_registration_part')
    CREATE INDEX ix_registration_part ON app.registration (part_id, submitted_at);
GO

/*
    Die Werte in eigenen Zeilen, nicht als ein Klumpen: ein Klumpen liesse sich
    gegen den eines anderen tauschen, ohne dass etwas auffiele.

    Unter dem Annahmeschlüssel, nicht unter einer Epoche — jede Einsendung
    bringt ihren eigenen Sitzungsschlüssel mit, verpackt unter der öffentlichen
    Hälfte des Paares.
*/
IF OBJECT_ID('app.registration_value', 'U') IS NULL
BEGIN
    CREATE TABLE app.registration_value
    (
        registration_id uniqueidentifier NOT NULL,
        field_id        uniqueidentifier NOT NULL,

        value_sealed    varbinary(max) NOT NULL,
        wrapped_key     varbinary(max) NOT NULL,

        CONSTRAINT pk_registration_value PRIMARY KEY (registration_id, field_id),
        CONSTRAINT fk_registration_value_reg   FOREIGN KEY (registration_id) REFERENCES app.registration (id),
        CONSTRAINT fk_registration_value_field FOREIGN KEY (field_id)        REFERENCES app.page_field (id)
    );
END
GO

/*
    Die Angaben eines Menschen — das Einzige, was dem MENSCHEN gehört und
    keinem Körper.

    Einzeln versiegelt und einzeln freigebbar: wer eine Telefonnummer bekommen
    soll, bekommt genau die und nicht den Geburtstag dazu. Trügen zwei dasselbe
    Etikett in der Hülle, ginge der Geheimtext des einen am Platz des anderen
    auf, und eine Freigabe wäre nicht mehr die Freigabe einer Angabe.

    Daran hängt, dass jemand seine Daten zwischen Organisationen mitnimmt.
*/
IF OBJECT_ID('app.person_value', 'U') IS NULL
BEGIN
    CREATE TABLE app.person_value
    (
        role_id      uniqueidentifier NOT NULL,
        field        nvarchar(32)     NOT NULL,

        value_sealed varbinary(max) NOT NULL,
        updated_at   datetimeoffset NOT NULL,

        CONSTRAINT pk_person_value PRIMARY KEY (role_id, field),
        CONSTRAINT fk_person_value_role FOREIGN KEY (role_id) REFERENCES app.role (id),
        CONSTRAINT ck_person_value_field
            CHECK (field IN (N'given_name', N'surname', N'phone', N'born', N'address', N'email'))
    );
END
GO
