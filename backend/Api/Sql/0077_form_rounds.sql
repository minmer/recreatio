/*
    WIEDERKEHRENDE ERWEITERUNGEN und EINTRÄGE DER KANZLEI (0077).

    =========================================================================
    1. EINE ERWEITERUNG, DIE SICH WIEDERHOLT (module.repeat_kind, registration.round_key)
    =========================================================================

    Eine Erweiterung (0047) gab es je Mensch höchstens einmal. Vieles in einer
    Pfarrei ist aber dasselbe Blatt, immer wieder: die Kranken, die jeden Monat
    besucht werden (Komunia, Spowiedź, Namaszczenie), die Anwesenheit der
    Firmlinge bei jedem Treffen, die Beichte am ersten Freitag, der Dienst der
    Ministranten, der Beitrag. Dafür ein eigenes Werkzeug je Fall zu bauen
    hiesse, dasselbe fünfmal zu bauen.

    Also sagt eine Erweiterung, WIE OFT sie ausgefüllt wird:

        once    einmal je Mensch (wie bisher)
        day     je Tag
        week    je Woche (ISO: Montag bis Sonntag)
        month   je Monat
        year    je Jahr

    und jede ihrer Einsendungen trägt den ZEITRAUM, für den sie gilt:

        ''            once
        2026-10-02    day
        2026-W40      week
        2026-10       month
        2026          year

    Je Mensch, Erweiterung UND Zeitraum höchstens eine. Der Schlüssel steht
    offen — er ist ein Datum, kein Inhalt (wie `submitted_at`). Innerhalb einer
    Art ordnen sich die Schlüssel als Text so, wie die Zeit läuft; damit holt
    die Liste ein Jahr mit `BETWEEN`.

    Nur Erweiterungen wiederholen sich: ein gewöhnliches Formular ist die
    Liste der Menschen selbst.

    =========================================================================
    2. DIE KANZLEI TRÄGT JEMANDEN EIN (registration.by_office)
    =========================================================================

    Bisher konnte sich nur der Mensch selbst eintragen. Wer am Telefon zusagt
    oder auf einem Zettel steht — oder gar nicht selbst handelt, wie ein
    Kranker —, den trägt die Kanzlei ein: eine Einsendung ohne Platz, ohne
    Rolle, ohne Quittung. Dass sie trotzdem zu jemandem gehört, sagt dieses
    Feld; die Prüfbedingung nimmt es als fünften Weg auf.
*/

IF COL_LENGTH('app.module', 'repeat_kind') IS NULL
    ALTER TABLE app.module ADD repeat_kind nvarchar(10) NOT NULL
        CONSTRAINT df_module_repeat DEFAULT (N'once');
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_module_repeat')
    ALTER TABLE app.module ADD CONSTRAINT ck_module_repeat
        CHECK (repeat_kind IN (N'once', N'day', N'week', N'month', N'year')
               AND (repeat_kind = N'once' OR extends_id IS NOT NULL));
GO

IF COL_LENGTH('app.registration', 'round_key') IS NULL
    ALTER TABLE app.registration ADD round_key nvarchar(10) NOT NULL
        CONSTRAINT df_registration_round DEFAULT (N'');
GO

IF COL_LENGTH('app.registration', 'by_office') IS NULL
    ALTER TABLE app.registration ADD by_office bit NOT NULL
        CONSTRAINT df_registration_by_office DEFAULT (0);
GO

/* Je Mensch, Erweiterung und ZEITRAUM höchstens eine Einsendung — der alte Index kannte den Zeitraum nicht. */
IF EXISTS (SELECT 1 FROM sys.indexes i
            WHERE i.name = 'uq_registration_extension' AND i.object_id = OBJECT_ID('app.registration')
              AND NOT EXISTS (SELECT 1 FROM sys.index_columns ic
                               JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                              WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND c.name = 'round_key'))
    DROP INDEX uq_registration_extension ON app.registration;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_registration_extension' AND object_id = OBJECT_ID('app.registration'))
    CREATE UNIQUE INDEX uq_registration_extension
        ON app.registration (part_id, base_id, round_key) WHERE base_id IS NOT NULL;
GO

/* Ein Jahr (oder ein Monat) einer Erweiterung auf einmal. */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_registration_round' AND object_id = OBJECT_ID('app.registration'))
    CREATE INDEX ix_registration_round ON app.registration (part_id, round_key);
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_registration_who'
            AND definition NOT LIKE '%by_office%')
    ALTER TABLE app.registration DROP CONSTRAINT ck_registration_who;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_registration_who')
    ALTER TABLE app.registration ADD CONSTRAINT ck_registration_who
        CHECK (access_id IS NOT NULL OR role_id IS NOT NULL OR claim_sha256 IS NOT NULL
               OR base_id IS NOT NULL OR by_office = 1);
GO
