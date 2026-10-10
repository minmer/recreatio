/*
    ZUGANG ÜBER EINE ROLLE (0091) — für Links und für Formulare.

    Bisher gab ein Link mit Zugang Bereiche (die Linkrolle bekam Zertifikate
    in jedem gewählten Bereich), und ein Formular gab seinen Menschen den
    Bereich ihres Platzes und, je Rozmowa, was an ihr hing (0080). Jede
    Stelle zählte ihre Bereiche selbst auf — wer „die Gruppe" ändern wollte,
    musste jeden Link und jedes Formular einzeln anfassen.

    Jetzt sagt EINE ROLLE, wozu sie Zugang gibt (ihre Zertifikate, und was sie
    hält), und Link und Formular geben die Rolle:

      Link        die Linkrolle HÄLT die gewählten Rollen (eine Kante `holds`
                  und eine Zuteilung, wie bei jedem Halter). Wer den Link
                  einlöst oder im Browser hält, erreicht sie — für ein Konto
                  ohnehin (der Graph), ohne Konto über die Hülle des Links
                  (`/links/keys` gibt jetzt den ganzen Weg heraus).

      Formular    `module.member_role_id` — jeder, der es einsendet, gehört
                  dazu: `access_role` verbindet seinen PLATZ mit der Rolle.
                  Den Schlüssel der Rolle versiegelt der Browser eines
                  Mitglieds unter dem Platzschlüssel (`key_sealed`), sobald er
                  vorbeikommt; bis dahin wartet die Zeile. Der Dienst sieht
                  keinen Schlüssel.

    Eine Rolle je Mensch ohne Konto bleibt verworfen (0024: zwei RSA-Paare je
    Platz); der Platz hält die Rolle, er IST keine.

    `access_role_area`: welche Bereiche ein Platz über seine Rollen erreicht
    — die Rolle und alles, was sie hält (nur `holds`, wie beim Konto), mit
    ihren Zertifikaten. Über ein Formular nur, solange die Einsendung lebt
    (nicht zurückgezogen, nicht ausgeblendet). Danach fragen die Stellen, die
    bisher nur den Bereich des Platzes kannten (Odbiorcy, Kalender, Seiten,
    Rezerwacje).
*/

IF COL_LENGTH('app.module', 'member_role_id') IS NULL
    ALTER TABLE app.module ADD member_role_id uniqueidentifier NULL
        CONSTRAINT fk_module_member_role FOREIGN KEY REFERENCES app.role (id);
GO

IF OBJECT_ID('app.access_role') IS NULL
    CREATE TABLE app.access_role
    (
        access_id          uniqueidentifier  NOT NULL,
        role_id            uniqueidentifier  NOT NULL,

        /* Über welches Formular — NULL: von Hand gegeben. */
        module_id          uniqueidentifier  NULL,

        /* Der Rollenschlüssel unter dem PLATZSCHLÜSSEL; NULL: wartet auf ein Mitglied, das ihn weitergibt. */
        key_sealed         varbinary(max)    NULL,
        granted_at         datetimeoffset(7) NOT NULL,
        sealed_at          datetimeoffset(7) NULL,
        sealed_by_role_id  uniqueidentifier  NULL,

        CONSTRAINT pk_access_role PRIMARY KEY (access_id, role_id),
        CONSTRAINT fk_access_role_access FOREIGN KEY (access_id) REFERENCES app.access (id),
        CONSTRAINT fk_access_role_role   FOREIGN KEY (role_id)   REFERENCES app.role (id),
        CONSTRAINT fk_access_role_module FOREIGN KEY (module_id) REFERENCES app.module (id)
    );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_access_role_role')
    CREATE INDEX ix_access_role_role ON app.access_role (role_id) INCLUDE (key_sealed);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_access_role_module')
    CREATE INDEX ix_access_role_module ON app.access_role (module_id) WHERE module_id IS NOT NULL;
GO

/* Jedes Mal neu — die Sicht hält nichts, sie fragt nur. */
IF OBJECT_ID('app.access_role_area', 'V') IS NOT NULL
    DROP VIEW app.access_role_area;
GO

CREATE VIEW app.access_role_area
AS
WITH reach (access_id, role_id, depth) AS (
    SELECT ar.access_id, ar.role_id, 0
    FROM app.access_role ar
    JOIN app.role r ON r.id = ar.role_id AND r.revoked_at IS NULL
    WHERE ar.module_id IS NULL
       OR EXISTS (SELECT 1 FROM app.registration g
                   WHERE g.access_id = ar.access_id AND g.part_id = ar.module_id
                     AND g.withdrawn_at IS NULL AND g.is_hidden = 0)

    UNION ALL

    SELECT h.access_id, e.to_role_id, h.depth + 1
    FROM reach h
    JOIN app.role_edge e ON e.from_role_id = h.role_id AND e.revoked_at IS NULL AND e.edge_kind = N'holds'
    JOIN app.role r      ON r.id = e.to_role_id AND r.revoked_at IS NULL
    WHERE h.depth < 32
)
SELECT DISTINCT h.access_id, c.scope_id AS area_id, c.capability
FROM reach h
JOIN app.certificate c ON c.subject_role_id = h.role_id
WHERE c.scope_kind = N'area' AND c.revoked_at IS NULL AND c.expires_at > SYSDATETIMEOFFSET()
  AND c.capability IN (N'read', N'write', N'admin');
GO
