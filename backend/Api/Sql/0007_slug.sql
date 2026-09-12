/*
    Das zentrale Adressregister — wer `recreatio.pl/<pfad>` führt.

    <b>Eine Adresse wird nicht vergeben, sondern ÜBERNOMMEN.</b> Der Eintrag
    steht vorher da, mit einem Code, den bekommt, wer die Adresse führen soll.
    Wer ihn eintippt, setzt EINE seiner Rollen darauf — nicht sich selbst. Das
    ist der Unterschied, der später zählt: ein Mensch geht, das Amt bleibt, und
    die Adresse wandert mit dem Amt statt mit dem Konto.

    <b>Nur der Hash.</b> Der Klartext des Codes existiert genau einmal — in der
    Ausgabe von `slug add` — und wird nie gespeichert. Ein Datenbankabzug
    liefert damit keine offenen Adressen aus.

    <b>Der Pfad trägt die Hierarchie.</b> `schola/proby` liegt unter `schola`;
    wer `schola` führt, führt beides. Eine eigene Elternspalte wäre eine zweite
    Wahrheit neben dem Pfad, und zwei Wahrheiten laufen auseinander.

    <b>`workspace` ist kein Adressraum.</b> Dort steht der Arbeitsplatz selbst.
    Die Regel steht hier UND in der Oberfläche: eine Adresse, die der Dienst
    vergibt und der Browser nicht auflösen kann, ist eine tote Adresse.
*/

IF OBJECT_ID('app.slug', 'U') IS NULL
BEGIN
    CREATE TABLE app.slug
    (
        id                    uniqueidentifier NOT NULL,

        -- Klein geschrieben, Teile durch `/`. Klartext: er steht in der
        -- Adresszeile, bevor jemand angemeldet ist.
        path                  nvarchar(200)    NOT NULL,

        claim_code_sha256     varbinary(32)    NOT NULL,

        -- Wofür der Eintrag gedacht war. Für den, der ihn Monate später in
        -- `slug list` wiederfindet und nicht mehr weiss, warum er ihn anlegte.
        note                  nvarchar(200)    NULL,

        claimed_by_role_id    uniqueidentifier NULL,
        claimed_by_account_id uniqueidentifier NULL,
        claimed_at            datetimeoffset   NULL,

        created_at            datetimeoffset   NOT NULL,

        CONSTRAINT pk_slug PRIMARY KEY (id),

        CONSTRAINT fk_slug_role    FOREIGN KEY (claimed_by_role_id)    REFERENCES app.role (id),
        CONSTRAINT fk_slug_account FOREIGN KEY (claimed_by_account_id) REFERENCES app.account (id),

        -- Übernommen heisst: Rolle UND Zeitpunkt. Eine Adresse mit Rolle ohne
        -- Zeitpunkt wäre übernommen, ohne dass jemand sagen könnte, wann.
        CONSTRAINT ck_slug_claim
            CHECK ((claimed_by_role_id IS NULL     AND claimed_at IS NULL AND claimed_by_account_id IS NULL)
                OR (claimed_by_role_id IS NOT NULL AND claimed_at IS NOT NULL)),

        -- Die Form steht in der Datenbank, nicht nur im Dienst: was hier
        -- landet, steht später in einer Adresszeile.
        CONSTRAINT ck_slug_path
            CHECK (path = LOWER(path)
               AND LEN(path) > 0
               AND path NOT LIKE N'%[^a-z0-9/-]%'
               AND path NOT LIKE N'/%'
               AND path NOT LIKE N'%/'
               AND path NOT LIKE N'%//%'),

        CONSTRAINT ck_slug_reserved
            CHECK (path <> N'workspace' AND path NOT LIKE N'workspace/%')
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_slug_path')
    CREATE UNIQUE INDEX ux_slug_path ON app.slug (path);
GO

/*
    Die Frage des Arbeitsplatzes bei jedem Laden: welche Adressen führen MEINE
    Rollen? Ohne diesen Index ist das ein Durchlauf durch alles.
*/
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_slug_role')
    CREATE INDEX ix_slug_role ON app.slug (claimed_by_role_id)
        WHERE claimed_by_role_id IS NOT NULL;
GO
