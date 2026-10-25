/*
    0129 — WER FÜR DIE DATEN GERADESTEHT, ALS DATENSATZ MIT GESCHICHTE (2026-10-25).

    Bisher stand der Administrator danych als eine Zeile je Bereich in
    app.area_controller (0022): überschrieben bei jeder Änderung, ohne Urheber,
    und jeder, der einen Bereich prowadzi, konnte jede Organisation eintragen.

    Jetzt:
      data_controller          eine Organisation, einmal gespeichert, mit ihrem
                               Heimatbereich (dessen Prowadzący sie ändern)
      data_controller_version  jede Änderung als Fassung (wer, wann) — die Werte
                               stehen nur hier
      controller_attachment    „dieser Bereich gilt unter diesem Datensatz":
                               erbeten (asked) oder angeboten (offered), gültig
                               (live) mit der UNTERSCHRIFT einer Rolle, die den
                               Heimatbereich prowadzi (Kernel:
                               ControllerAttachmentRecord), beendet (ended) mit
                               Datum und Grund — nie gelöscht
      controller_terms         wer die Bedingungen der Auftragsverarbeitung
                               (umowa powierzenia, art. 28 RODO) in welcher
                               Fassung angenommen hat
      area_parent_ended        wann eine Löschung des Kontos einen Bereich von
                               seinem Elternbereich abgeschnitten hat — damit
                               sich „wer stand am Tag X dafür gerade" auch
                               danach beantworten lässt
      slug.controller_area_id  welcher Bereich für eine Seite (und die Seiten
                               darunter) geradesteht

    Was gilt: für einen Bereich der gültige Anschluss des nächsten Bereichs in
    seiner Kette (er selbst, dann die Eltern, höchstens 16 Stufen).

    Bestehende Einträge wandern ohne Unterschrift: je Zeile von area_controller
    ein Datensatz mit diesem Bereich als Heimat, Fassung 1, gültig seit der
    letzten Änderung der Zeile. Organ und Bestätigung fehlen ihnen — die
    Einstellungen bitten darum. area_controller bleibt stehen (der alte Dienst
    liest es noch) und wird später entfernt; diese Migration gehört direkt vor
    das Ausrollen des neuen Dienstes.

    Noch einmal ausgeführt, ändert es nichts.
*/

IF OBJECT_ID('app.data_controller', 'U') IS NULL
BEGIN
    CREATE TABLE app.data_controller
    (
        id                 uniqueidentifier  NOT NULL,
        home_area_id       uniqueidentifier  NOT NULL,
        current_version    int               NOT NULL,
        created_at         datetimeoffset(7) NOT NULL,
        created_by_role_id uniqueidentifier  NULL,
        closed_at          datetimeoffset(7) NULL,
        closed_reason      nvarchar(16)      NULL,
        closed_by_role_id  uniqueidentifier  NULL,
        CONSTRAINT pk_data_controller PRIMARY KEY (id),
        CONSTRAINT ck_data_controller_version CHECK (current_version >= 1),
        CONSTRAINT ck_data_controller_closed CHECK (
            (closed_at IS NULL AND closed_reason IS NULL)
         OR (closed_at IS NOT NULL AND closed_reason IN (N'closed', N'home-deleted', N'merged')))
    );
    CREATE INDEX ix_data_controller_home ON app.data_controller (home_area_id);

    CREATE TABLE app.data_controller_version
    (
        controller_id          uniqueidentifier  NOT NULL,
        version                int               NOT NULL,
        name                   nvarchar(200)     NOT NULL,
        address                nvarchar(400)     NULL,
        email                  nvarchar(200)     NULL,
        phone                  nvarchar(40)      NULL,
        dpo_name               nvarchar(200)     NULL,
        dpo_contact            nvarchar(400)     NULL,
        authority              nvarchar(8)       NULL,
        written_at             datetimeoffset(7) NOT NULL,
        written_by_role_id     uniqueidentifier  NULL,
        authority_confirmed_at datetimeoffset(7) NULL,
        CONSTRAINT pk_data_controller_version PRIMARY KEY (controller_id, version),
        CONSTRAINT fk_data_controller_version FOREIGN KEY (controller_id) REFERENCES app.data_controller (id),
        CONSTRAINT ck_data_controller_version_name CHECK (LEN(LTRIM(RTRIM(name))) > 0),
        CONSTRAINT ck_data_controller_version_authority CHECK (authority IS NULL OR authority IN (N'uodo', N'kiod'))
    );

    CREATE TABLE app.controller_attachment
    (
        id                  uniqueidentifier  NOT NULL,
        area_id             uniqueidentifier  NOT NULL,
        controller_id       uniqueidentifier  NOT NULL,
        state               nvarchar(10)      NOT NULL,
        asked_by_role_id    uniqueidentifier  NULL,
        asked_at            datetimeoffset(7) NULL,
        signed_by_role_id   uniqueidentifier  NULL,
        signed_at           datetimeoffset(7) NULL,
        signature           varbinary(1024)   NULL,
        certificate_id      uniqueidentifier  NULL,
        accepted_by_role_id uniqueidentifier  NULL,
        accepted_at         datetimeoffset(7) NULL,
        decided_by_role_id  uniqueidentifier  NULL,
        decided_at          datetimeoffset(7) NULL,
        live_from           datetimeoffset(7) NULL,
        ended_at            datetimeoffset(7) NULL,
        ended_reason        nvarchar(16)      NULL,
        ended_by_role_id    uniqueidentifier  NULL,
        CONSTRAINT pk_controller_attachment PRIMARY KEY (id),
        CONSTRAINT fk_controller_attachment_controller FOREIGN KEY (controller_id) REFERENCES app.data_controller (id),
        CONSTRAINT ck_controller_attachment_state CHECK (state IN (N'asked', N'offered', N'live', N'refused', N'cancelled', N'ended')),
        CONSTRAINT ck_controller_attachment_live CHECK (state NOT IN (N'live', N'ended') OR live_from IS NOT NULL),
        CONSTRAINT ck_controller_attachment_ended CHECK (
            (state = N'ended' AND ended_at IS NOT NULL AND ended_reason IN
                (N'withdrawn', N'left', N'replaced', N'closed', N'home-deleted', N'area-deleted'))
         OR (state <> N'ended' AND ended_at IS NULL AND ended_reason IS NULL))
    );
    /* Ein Bereich gilt unter höchstens einem Datensatz zugleich; Bitten und Geschichte bleiben stehen. */
    CREATE UNIQUE INDEX uq_controller_attachment_live ON app.controller_attachment (area_id) WHERE state = N'live';
    CREATE INDEX ix_controller_attachment_area ON app.controller_attachment (area_id, state);
    CREATE INDEX ix_controller_attachment_controller ON app.controller_attachment (controller_id, state);

    CREATE TABLE app.controller_terms
    (
        controller_id       uniqueidentifier  NOT NULL,
        terms_version       nvarchar(16)      NOT NULL,
        accepted_by_role_id uniqueidentifier  NOT NULL,
        accepted_at         datetimeoffset(7) NOT NULL,
        CONSTRAINT pk_controller_terms PRIMARY KEY (controller_id, terms_version),
        CONSTRAINT fk_controller_terms FOREIGN KEY (controller_id) REFERENCES app.data_controller (id)
    );

    CREATE TABLE app.area_parent_ended
    (
        area_id        uniqueidentifier  NOT NULL,
        parent_area_id uniqueidentifier  NOT NULL,
        ended_at       datetimeoffset(7) NOT NULL,
        CONSTRAINT pk_area_parent_ended PRIMARY KEY (area_id, ended_at)
    );

    /* Die bisherigen Einträge: je Bereich ein Datensatz, Fassung 1, gültig seit seiner letzten Änderung. */
    DECLARE @moved TABLE (controller_id uniqueidentifier, area_id uniqueidentifier, name nvarchar(200),
                          address nvarchar(400), email nvarchar(200), updated_at datetimeoffset(7));

    INSERT INTO @moved (controller_id, area_id, name, address, email, updated_at)
    SELECT NEWID(), ac.area_id, ac.name, ac.address, ac.email, ac.updated_at
      FROM app.area_controller ac
      JOIN app.area a ON a.id = ac.area_id;

    INSERT INTO app.data_controller (id, home_area_id, current_version, created_at)
    SELECT controller_id, area_id, 1, updated_at FROM @moved;

    INSERT INTO app.data_controller_version (controller_id, version, name, address, email, written_at)
    SELECT controller_id, 1, name, address, email, updated_at FROM @moved;

    INSERT INTO app.controller_attachment (id, area_id, controller_id, state, live_from)
    SELECT NEWID(), area_id, controller_id, N'live', updated_at FROM @moved;
END
GO

IF COL_LENGTH('app.slug', 'controller_area_id') IS NULL
    ALTER TABLE app.slug ADD controller_area_id uniqueidentifier NULL;
GO
