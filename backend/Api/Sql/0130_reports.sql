/*
    0130 — MELDUNGEN, UND WAS DER BETREIBER DARAUFHIN TUT (2026-10-25).

    Jeder kann eine Sache melden, die er lesen kann: eine Seite, einen Teil, eine
    Datei, ein Formular, eine Nachricht, einen Eintrag, einen Termin, eine Datei
    hinter einem Link, einen Link. Die Meldung geht an den Betreiber.

      report            die Meldung: WAS (Art und Kennung, offen — sonst liesse
                        sich nichts finden) und WARUM (versiegelt im Browser des
                        Meldenden, für den Schlüssel der Rolle des Betreibers:
                        Grund, Kontakt, angehängter Inhalt und das
                        Entscheidungsgeheimnis). Der Dienst behält vom Geheimnis
                        nur den Hash, von der Quittung des Meldenden nur den Hash.
      takedown          was gesperrt oder gelöscht ist — das lesen die Stellen,
                        die ausliefern
      takedown_ledger   die Kette: jeder Schritt des Betreibers (sperren,
                        wiederherstellen, löschen, ablehnen), im Browser des
                        Betreibers unterschrieben, am Hash des vorigen hängend
                        (Kernel: TakedownEntryRecord). Der Dienst nimmt einen
                        Schritt nur mit dem Geheimnis seiner Meldung an — ohne
                        Meldung keine Löschung.

    Nichts davon öffnet der Dienst. Noch einmal ausgeführt, ändert es nichts.
*/

IF OBJECT_ID('app.report', 'U') IS NULL
BEGIN
    CREATE TABLE app.report
    (
        id               uniqueidentifier  NOT NULL,
        item_kind        nvarchar(12)      NOT NULL,
        item_id          uniqueidentifier  NOT NULL,
        item_at          datetimeoffset(7) NULL,
        item_path        nvarchar(400)     NULL,
        area_id          uniqueidentifier  NULL,
        controller_id    uniqueidentifier  NULL,
        reason           nvarchar(8)       NOT NULL,
        state            nvarchar(10)      NOT NULL,
        operator_role_id uniqueidentifier  NOT NULL,
        sealed           varbinary(max)    NULL,
        sealed_key       varbinary(1024)   NULL,
        decision_sha256  binary(32)        NOT NULL,
        receipt_sha256   binary(32)        NOT NULL,
        received_at      datetimeoffset(7) NOT NULL,
        decided_at       datetimeoffset(7) NULL,
        objection        varbinary(max)    NULL,
        objection_key    varbinary(1024)   NULL,
        objected_at      datetimeoffset(7) NULL,
        CONSTRAINT pk_report PRIMARY KEY (id),
        CONSTRAINT ck_report_kind CHECK (item_kind IN
            (N'page', N'part', N'file', N'form', N'message', N'entry', N'item', N'share', N'link', N'event')),
        CONSTRAINT ck_report_reason CHECK (reason IN (N'data', N'illegal', N'other')),
        CONSTRAINT ck_report_state CHECK (state IN (N'received', N'blocked', N'objected', N'deleted', N'restored', N'rejected'))
    );
    CREATE INDEX ix_report_item ON app.report (item_kind, item_id);
    CREATE INDEX ix_report_state ON app.report (state, received_at);
    CREATE UNIQUE INDEX uq_report_receipt ON app.report (receipt_sha256);

    CREATE TABLE app.takedown
    (
        id             uniqueidentifier  NOT NULL,
        item_kind      nvarchar(12)      NOT NULL,
        item_id        uniqueidentifier  NOT NULL,
        item_at        datetimeoffset(7) NULL,
        state          nvarchar(8)       NOT NULL,
        report_id      uniqueidentifier  NOT NULL,
        reason_code    nvarchar(16)      NOT NULL,
        author_role_id uniqueidentifier  NULL,
        since          datetimeoffset(7) NOT NULL,
        CONSTRAINT pk_takedown PRIMARY KEY (id),
        CONSTRAINT fk_takedown_report FOREIGN KEY (report_id) REFERENCES app.report (id),
        CONSTRAINT ck_takedown_state CHECK (state IN (N'blocked', N'deleted')),
        CONSTRAINT ck_takedown_reason CHECK (reason_code IN (N'personal-data', N'illegal', N'rights', N'other'))
    );
    /* Eine Sache ist einmal gesperrt; ohne Zeitpunkt heisst: die ganze Sache, nicht ein Termin der Reihe. */
    CREATE UNIQUE INDEX uq_takedown_item ON app.takedown (item_kind, item_id, item_at);
    CREATE INDEX ix_takedown_author ON app.takedown (author_role_id) WHERE author_role_id IS NOT NULL;

    CREATE TABLE app.takedown_ledger
    (
        sequence       bigint            NOT NULL,
        entry_id       uniqueidentifier  NOT NULL,
        previous_hash  binary(32)        NOT NULL,
        entry_hash     binary(32)        NOT NULL,
        report_id      uniqueidentifier  NOT NULL,
        item_kind      nvarchar(12)      NOT NULL,
        item_id        uniqueidentifier  NOT NULL,
        item_at        datetimeoffset(7) NULL,
        action         nvarchar(12)      NOT NULL,
        signer_role_id uniqueidentifier  NOT NULL,
        signed_at      datetimeoffset(7) NOT NULL,
        signature      varbinary(1024)   NOT NULL,
        recorded_at    datetimeoffset(7) NOT NULL,
        CONSTRAINT pk_takedown_ledger PRIMARY KEY (sequence),
        CONSTRAINT uq_takedown_ledger_entry UNIQUE (entry_id),
        CONSTRAINT ck_takedown_ledger_sequence CHECK (sequence >= 1),
        CONSTRAINT ck_takedown_ledger_action CHECK (action IN (N'block', N'restore', N'delete', N'reject'))
    );
END
GO
