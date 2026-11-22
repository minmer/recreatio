/*
    0143 — EIN GROSSER IMPORT IN STÜCKEN, GESCHRIEBEN IN EINEM ZUG (2026-11-22, A4).

    Ein Import einer Baza wiedzy geht ganz oder gar nicht (`Library.Batch.cs`, eine Transaktion). Bis hierher
    musste er dafür in EINE Anfrage passen: 5000 Einträge, und unter der Grenze des IIS (30 MB je Anfrage). Eine
    ganze Welt der Physik (~4500 Elemente, mit Löschungen mehr) stiess daran.

    Jetzt schickt der Browser die versiegelten Einträge in Stücken (je höchstens 2000 Einträge und ~16 MB):
    `POST …/entries/save/stage` legt jedes Stück hier ab, unter einem zufälligen Zeichen (`token`), für eine
    Bibliothek und ein Konto. Das letzte `POST …/entries/save` mit `"stage": "<token>"` liest alle Stücke und
    schreibt sie mit denselben Prüfungen wie bisher in EINER Transaktion — oder keines. Danach (und nach jedem
    Fehlschlag) sind die Stücke fort; was liegen bleibt (ein abgebrochener Import), räumt jedes neue Stück nach
    einer Stunde fort. Bis 20 000 Elemente je Import.

    Was hier liegt, sind dieselben versiegelten Hüllen, die danach in app.library_entry stehen — der Dienst liest
    nichts davon. Keine Fremdschlüssel: ein Stück ist Durchgangsware (eine Stunde), und Löschungen von Konten
    und Bibliotheken müssen nicht darauf warten.

    Noch einmal ausgeführt, ändert es nichts.
*/

IF OBJECT_ID('app.library_save_stage', 'U') IS NULL
    CREATE TABLE app.library_save_stage
    (
        token        uniqueidentifier  NOT NULL,
        part         int               NOT NULL,
        library_id   uniqueidentifier  NOT NULL,
        account_id   uniqueidentifier  NOT NULL,
        items        int               NOT NULL,
        bytes        bigint            NOT NULL,
        payload      varbinary(max)    NOT NULL,
        created_at   datetimeoffset(7) NOT NULL,
        CONSTRAINT pk_library_save_stage PRIMARY KEY (token, part),
        CONSTRAINT ck_library_save_stage_part CHECK (part BETWEEN 0 AND 999),
        CONSTRAINT ck_library_save_stage_items CHECK (items BETWEEN 1 AND 20000)
    );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_library_save_stage_created' AND object_id = OBJECT_ID('app.library_save_stage'))
    CREATE INDEX ix_library_save_stage_created ON app.library_save_stage (created_at);
GO
