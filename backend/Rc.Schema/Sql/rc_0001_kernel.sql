/* ===========================================================================
   rc_0001_kernel — Kernel und Kette
   Anhang F 24.2 und 24.3, uebersetzt nach SQL Server.

   Anhang F ist in PostgreSQL notiert. Der Auftraggeber hat SQL Server
   entschieden; diese Datei ist die verbindliche Uebersetzung. Die
   Abweichungen sind unten einzeln begruendet, damit niemand sie spaeter fuer
   Nachlaessigkeit haelt.

   | Anhang F        | Hier                      | Grund                        |
   |-----------------|---------------------------|------------------------------|
   | uuid            | uniqueidentifier          | nativer Typ                  |
   | timestamptz     | datetimeoffset(7)         | naechste Entsprechung        |
   | bytea           | varbinary(...)            | gesized, wo die Laenge feststeht |
   | citext          | nvarchar + CI-Sortierung  | SQL Server kennt kein citext |
   | num_nonnulls()  | CHECK mit CASE            | Funktion fehlt               |
   | partieller Index| gefilterter Index         | gibt es, gleiche Wirkung     |

   ZUR SORTIERREIHENFOLGE (Befund 26): SQL Server vergleicht
   uniqueidentifier NICHT byteweise, sondern in einer eigenen Feldreihenfolge.
   Die zeitliche Sortierbarkeit von UUIDv7 (Anhang E 23.1) geht dabei verloren
   und mit ihr die Begruendung fuer einen dichten Index.

   Deshalb: gruppierter Index auf seq bigint IDENTITY, eindeutiger
   nichtgruppierter Index auf id. Der Index bleibt dicht, die ID bleibt eine
   echte UUIDv7, und die Sortierbarkeit wird nirgends fachlich benutzt (23.1).
   =========================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

/* Ohne diese beiden schlagen gefilterte Indizes und Ausloeser fehl: sqlcmd
   startet mit QUOTED_IDENTIFIER OFF, und der Wert wird beim Anlegen eines
   Ausloesers festgeschrieben. Gefunden beim ersten echten Lauf. */
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

/* --- Fassungsverzeichnis (15.4) ----------------------------------------------
   Ein massgeblicher Weg der Schema-Entwicklung. Gewaehlt: versionierter
   SQL-Lauf, nicht EF-Migrationen. Der Altbestand ist an drei nebeneinander
   laufenden Wegen gescheitert, und die Append-only-Auflage aus 7.6 ist
   ohnehin SQL-nah.                                                           */

IF OBJECT_ID('dbo.rc_schema_version', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.rc_schema_version (
        script_name   nvarchar(128)     NOT NULL PRIMARY KEY,
        applied_at    datetimeoffset(7) NOT NULL CONSTRAINT df_rc_schema_version_at DEFAULT SYSDATETIMEOFFSET(),
        checksum      varbinary(32)     NULL
    );
END
GO

/* Kein Waechter im Skript.

   Ein IF ... RETURN an dieser Stelle ist wirkungslos: RETURN verlaesst in
   T-SQL nur den eigenen Stapel, und GO teilt die Datei in Stapel. Alles
   Folgende liefe trotzdem, schluege mit "Objekt existiert bereits" fehl und
   meldete am Ende faelschlich Erfolg. Genau so ist es beim ersten echten
   Wiederholungslauf passiert.

   Wiedereintritt und Transaktion gehoeren deshalb dem Migrationslauf
   (Rc.Schema/Program.cs). Er sieht vorher im Fassungsverzeichnis nach,
   klammert das ganze Skript in eine Transaktion und traegt die Fassung erst
   nach Erfolg ein. */

/* Die Transaktion gehoert dem Migrationslauf, nicht dem Skript: GO teilt in
   Stapel, und nach einem Abbruch findet COMMIT sein BEGIN nicht mehr — dann
   meldet das Skript Erfolg, obwohl zurueckgerollt wurde. */

/* ===========================================================================
   1. Konto und Rolle
   =========================================================================== */

CREATE TABLE dbo.rc_account (
    seq                  bigint IDENTITY(1,1) NOT NULL,
    id                   uniqueidentifier     NOT NULL,

    /* citext-Ersatz: ausdrueckliche CI-Sortierung. Ohne sie waeren "Anna" und
       "anna" zwei Konten, und der Unterschied faellt erst auf, wenn sich
       jemand nicht anmelden kann.                                            */
    username             nvarchar(64) COLLATE Latin1_General_CI_AS NOT NULL,

    /* 21.8: Anmelde-Verifier aus EIGENER langsamer Ableitung mit EIGENEM Salz,
       getrennt von der Ableitung des PasswordKey. Mit demselben Salz waeren
       beide identisch, und der Server bekaeme mit dem Verifier den Schluessel
       geschenkt, mit dem der MasterKey verpackt ist.                          */
    login_verifier       varbinary(32)  NOT NULL,
    login_salt           varbinary(16)  NOT NULL,
    password_salt        varbinary(16)  NOT NULL,

    /* AlgId 0x01 unter PasswordKey, AAD kernel:account:<id>:masterkey:1.
       Beim Passwortwechsel wird GENAU DIESE eine Huelle neu versiegelt — der
       eigentliche Betriebsvorteil des Wurzelschluessels (E-269).              */
    master_key_sealed    varbinary(512) NOT NULL,

    /* 3.9: 0 = bequem (Oeffnungsstueck je Sitzung), 1 = sicher (je Anfrage).
       Die Wahl gehoert dem Menschen, dessen Schluessel es ist (E-240).        */
    cache_mode           tinyint        NOT NULL CONSTRAINT df_rc_account_cache_mode DEFAULT 0,

    /* 8.3: 0 bis 30 Tage, Vorgabe ein Tag. Der Hinweistext muss beide Enden
       ehrlich nennen — eine hohe Karenzzeit sperrt auch einen selbst aus.     */
    recovery_grace_days  smallint       NOT NULL CONSTRAINT df_rc_account_grace DEFAULT 1,

    /* 15.12: 500 MB. Reichlich fuer Texte und Bilder, knapp fuer Video —
       das ist die beabsichtigte Botschaft. Aenderbar nur direkt hier, weil
       niemand eine Kontenliste sieht (E-295).                                 */
    storage_quota_bytes  bigint         NOT NULL CONSTRAINT df_rc_account_quota DEFAULT 524288000,

    home_store           smallint       NOT NULL CONSTRAINT df_rc_account_home DEFAULT 0,
    created_at           datetimeoffset(7) NOT NULL,
    disabled_at          datetimeoffset(7) NULL,

    CONSTRAINT pk_rc_account PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_account_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT uq_rc_account_username UNIQUE NONCLUSTERED (username),
    CONSTRAINT ck_rc_account_cache_mode CHECK (cache_mode IN (0, 1)),
    CONSTRAINT ck_rc_account_grace CHECK (recovery_grace_days BETWEEN 0 AND 30)
);
GO

CREATE TABLE dbo.rc_role (
    seq                  bigint IDENTITY(1,1) NOT NULL,
    id                   uniqueidentifier     NOT NULL,
    tenant_id            uniqueidentifier     NOT NULL,

    /* 3.1: Bedeutung liegt im Modul. Der Kernel liest dieses Feld nie aus,
       um zu entscheiden, was erlaubt ist. Eine Fallunterscheidung nach kind
       im Kernel-Code ist ein Befund.                                          */
    kind                 nvarchar(64)   NOT NULL,

    /* 9.13.2: Der Anzeigename ist live und wirkt rueckwirkend. Er liegt beim
       Eigentuemer; andere haben Verweis plus Leseschluessel, keine Kopie.     */
    display_name_sealed  varbinary(512) NOT NULL,

    /* 21.6: ZWEI Schluesselpaare. Denselben RSA-Schluessel zum Signieren und
       zum Verpacken zu benutzen ist eine bekannte Schwaeche. Der Preis sind
       zwei Erzeugungen von je mehreren Sekunden — hinnehmbar, weil Rollen
       selten entstehen.                                                       */
    sign_public_key      varbinary(1024) NOT NULL,   -- SPKI DER, RSA-4096 PSS
    wrap_public_key      varbinary(1024) NOT NULL,   -- SPKI DER, RSA-4096 OAEP
    sign_private_sealed  varbinary(4096) NOT NULL,
    wrap_private_sealed  varbinary(4096) NOT NULL,

    key_fingerprint      varbinary(16)  NOT NULL,    -- 21.5, = SignerKeyFingerprint in 7.5
    key_version          int            NOT NULL CONSTRAINT df_rc_role_keyver DEFAULT 1,
    home_store           smallint       NOT NULL CONSTRAINT df_rc_role_home DEFAULT 0,
    created_at           datetimeoffset(7) NOT NULL,
    revoked_at           datetimeoffset(7) NULL,

    CONSTRAINT pk_rc_role PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_role_id UNIQUE NONCLUSTERED (id)
);
CREATE INDEX ix_rc_role_tenant ON dbo.rc_role (tenant_id) WHERE revoked_at IS NULL;
GO

/* 3.2: Kanten werden nie geaendert und nie geloescht. Eine Aenderung ist eine
   neue Kante, ein Widerruf eine Gegen-Kante. Die alte bleibt sichtbar.        */
CREATE TABLE dbo.rc_role_edge (
    seq              bigint IDENTITY(1,1) NOT NULL,
    id               uniqueidentifier     NOT NULL,
    from_role_id     uniqueidentifier     NULL,
    from_account_id  uniqueidentifier     NULL,
    to_role_id       uniqueidentifier     NOT NULL,

    /* holds | inherits | supervises — nur vom Modul interpretiert (3.1).
       supervises traegt Kapitel 4; der Kernel weiss davon nichts.             */
    edge_kind        nvarchar(32)      NOT NULL,
    created_at       datetimeoffset(7) NOT NULL,
    expires_at       datetimeoffset(7) NULL,
    signature        varbinary(1024)   NOT NULL,
    signer_role_id   uniqueidentifier  NOT NULL,
    revoked_at       datetimeoffset(7) NULL,
    revocation_entry_id uniqueidentifier NULL,

    CONSTRAINT pk_rc_role_edge PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_role_edge_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_role_edge_to  FOREIGN KEY (to_role_id) REFERENCES dbo.rc_role (id),

    /* Ersatz fuer num_nonnulls(from_role_id, from_account_id) = 1 */
    CONSTRAINT ck_rc_role_edge_from CHECK (
        (CASE WHEN from_role_id    IS NULL THEN 0 ELSE 1 END)
      + (CASE WHEN from_account_id IS NULL THEN 0 ELSE 1 END) = 1)
);

/* Gefilterter Index als Ersatz fuer den partiellen UNIQUE aus Anhang F. */
CREATE UNIQUE INDEX uq_rc_role_edge_active_role
    ON dbo.rc_role_edge (from_role_id, to_role_id, edge_kind)
    WHERE revoked_at IS NULL AND from_role_id IS NOT NULL;
CREATE UNIQUE INDEX uq_rc_role_edge_active_account
    ON dbo.rc_role_edge (from_account_id, to_role_id, edge_kind)
    WHERE revoked_at IS NULL AND from_account_id IS NOT NULL;

/* 3.14: Die Zyklenpruefung laeuft auf diesen Klartextfeldern — sie braucht
   keine Entschluesselung, weil der strukturelle Teil einer Kante offen liegt. */
CREATE INDEX ix_rc_role_edge_walk ON dbo.rc_role_edge (to_role_id, edge_kind) WHERE revoked_at IS NULL;
GO

/* 3.5: Rechte sind Zertifikate mit Lebenszeit, keine Booleans. Es gibt in
   diesem Schema keine einzige Spalte can_write oder is_admin.                 */
CREATE TABLE dbo.rc_certificate (
    seq                bigint IDENTITY(1,1) NOT NULL,
    id                 uniqueidentifier     NOT NULL,
    subject_role_id    uniqueidentifier     NOT NULL,
    scope_kind         nvarchar(16)         NOT NULL,   -- area | tenant | module
    scope_id           uniqueidentifier     NOT NULL,
    capability         nvarchar(16)         NOT NULL,   -- read | write | admin | certify
    issued_by_role_id  uniqueidentifier     NOT NULL,
    issued_at          datetimeoffset(7)    NOT NULL,
    expires_at         datetimeoffset(7)    NOT NULL,   -- Lebenszeit ist Pflicht (E-07)
    revoked_at         datetimeoffset(7)    NULL,
    signature          varbinary(1024)      NOT NULL,

    CONSTRAINT pk_rc_certificate PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_certificate_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_certificate_subject FOREIGN KEY (subject_role_id) REFERENCES dbo.rc_role (id),
    CONSTRAINT ck_rc_certificate_scope CHECK (scope_kind IN (N'area', N'tenant', N'module')),
    CONSTRAINT ck_rc_certificate_cap CHECK (capability IN (N'read', N'write', N'admin', N'certify')),
    CONSTRAINT ck_rc_certificate_life CHECK (expires_at > issued_at)
);

/* 24.5: Die Berechtigungs-Engine wertet in EINER Abfrage aus, nicht in zwanzig
   Einzelabfragen je Anzeige. Dafuer der zusammengesetzte Index.               */
CREATE INDEX ix_rc_certificate_lookup
    ON dbo.rc_certificate (subject_role_id, scope_kind, scope_id, capability)
    INCLUDE (expires_at) WHERE revoked_at IS NULL;
CREATE INDEX ix_rc_certificate_scope
    ON dbo.rc_certificate (scope_id, capability) WHERE revoked_at IS NULL;
GO

/* 24.5: Bereichsschluessel liegen AUSSCHLIESSLICH hier, gewrappt je Rolle —
   niemals in rc_area und niemals in rc_area_epoch. Das ist die Stelle, an der
   Schluesselvernichtung (12.3.2) und Wiederherstellung (8.3) ansetzen.        */
CREATE TABLE dbo.rc_role_key_grant (
    seq                bigint IDENTITY(1,1) NOT NULL,
    id                 uniqueidentifier     NOT NULL,
    role_id            uniqueidentifier     NOT NULL,
    key_kind           nvarchar(24)         NOT NULL,   -- epoch | shared_view | data_key | recovery
    key_ref            uniqueidentifier     NOT NULL,
    key_epoch          int                  NULL,       -- bei key_kind = epoch
    sealed_blob        varbinary(1024)      NOT NULL,   -- AlgId 0x02 unter wrap_public_key
    granted_by_role_id uniqueidentifier     NOT NULL,
    granted_at         datetimeoffset(7)    NOT NULL,

    /* 12.3.2 Weg (b): Loeschung durch Schluesselvernichtung. Es MUSS
       protokolliert werden, welcher Schluessel wann vernichtet wurde — sonst
       ist der Vollzug nicht nachweisbar.                                      */
    destroyed_at       datetimeoffset(7)    NULL,
    destroyed_reason   nvarchar(64)         NULL,

    CONSTRAINT pk_rc_role_key_grant PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_role_key_grant_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_role_key_grant_role FOREIGN KEY (role_id) REFERENCES dbo.rc_role (id),
    CONSTRAINT ck_rc_role_key_grant_kind CHECK (key_kind IN (N'epoch', N'shared_view', N'data_key', N'recovery'))
);
CREATE UNIQUE INDEX uq_rc_role_key_grant_live
    ON dbo.rc_role_key_grant (role_id, key_kind, key_ref, key_epoch)
    WHERE destroyed_at IS NULL;
GO

/* ===========================================================================
   2. Wiederherstellung (Kapitel 8)
   =========================================================================== */

CREATE TABLE dbo.rc_recovery_share (
    seq                bigint IDENTITY(1,1) NOT NULL,
    id                 uniqueidentifier     NOT NULL,
    account_id         uniqueidentifier     NOT NULL,
    guarantor_role_id  uniqueidentifier     NOT NULL,
    share_sealed       varbinary(1024)      NOT NULL,   -- Shamir-Anteil (8.2)
    threshold          smallint             NOT NULL,   -- z. B. 2 von 3
    total_shares       smallint             NOT NULL,
    created_at         datetimeoffset(7)    NOT NULL,
    revoked_at         datetimeoffset(7)    NULL,

    CONSTRAINT pk_rc_recovery_share PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_recovery_share_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_recovery_share_account FOREIGN KEY (account_id) REFERENCES dbo.rc_account (id),
    CONSTRAINT ck_rc_recovery_share_threshold CHECK (threshold >= 2 AND threshold <= total_shares)
);
GO

/* 8.6: Wer einen Wiederherstellungsschluessel haelt, kann oeffnen — aber
   NIEMALS unbemerkt. Deshalb ist ledger_entry_id NOT NULL.                    */
CREATE TABLE dbo.rc_recovery_request (
    seq                   bigint IDENTITY(1,1) NOT NULL,
    id                    uniqueidentifier     NOT NULL,
    target_role_id        uniqueidentifier     NOT NULL,
    requested_by_role_id  uniqueidentifier     NOT NULL,
    requested_at          datetimeoffset(7)    NOT NULL,
    effective_at          datetimeoffset(7)    NOT NULL,   -- requested_at + Karenzzeit
    objected_at           datetimeoffset(7)    NULL,
    completed_at          datetimeoffset(7)    NULL,
    ledger_entry_id       uniqueidentifier     NOT NULL,

    CONSTRAINT pk_rc_recovery_request PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_recovery_request_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_recovery_request_target FOREIGN KEY (target_role_id) REFERENCES dbo.rc_role (id),
    CONSTRAINT ck_rc_recovery_request_effective CHECK (effective_at >= requested_at)
);
GO

/* ===========================================================================
   3. Sitzungen (3.9)
   =========================================================================== */

/* Der verschluesselte Schluesselbund und das Oeffnungsstueck liegen NUR im
   Arbeitsspeicher (3.9). Diese Tabelle traegt ausschliesslich, was der
   Sitzungswiderruf braucht — und dieser wird an EINER Stelle geprueft.        */
CREATE TABLE dbo.rc_session (
    seq             bigint IDENTITY(1,1) NOT NULL,
    id              uniqueidentifier     NOT NULL,
    account_id      uniqueidentifier     NOT NULL,
    created_at      datetimeoffset(7)    NOT NULL,
    last_activity_at datetimeoffset(7)   NOT NULL,
    expires_at      datetimeoffset(7)    NOT NULL,
    revoked_at      datetimeoffset(7)    NULL,
    device_note     nvarchar(128)        NULL,

    CONSTRAINT pk_rc_session PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_session_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_session_account FOREIGN KEY (account_id) REFERENCES dbo.rc_account (id)
);
CREATE INDEX ix_rc_session_account ON dbo.rc_session (account_id) WHERE revoked_at IS NULL;
GO

/* ===========================================================================
   4. Kette (Kapitel 7, Anhang F 24.3)
   =========================================================================== */

/* 7.6 / 11.11: Serialisiertes Anhaengen ueber eine Zeilensperre je Kette.
   Das genuegt, WEIL genau ein Anwendungsprozess je Instanz laeuft — diese
   Annahme MUSS beim Start geprueft werden (Kapitel 16). Faellt sie je weg,
   faellt diese Vereinfachung mit ihr.                                         */
CREATE TABLE dbo.rc_ledger_head (
    ledger_id     uniqueidentifier NOT NULL,
    last_sequence bigint           NOT NULL,
    last_hash     varbinary(32)    NOT NULL,
    updated_at    datetimeoffset(7) NOT NULL,
    CONSTRAINT pk_rc_ledger_head PRIMARY KEY CLUSTERED (ledger_id)
);
GO

CREATE TABLE dbo.rc_ledger_entry (
    seq                 bigint IDENTITY(1,1) NOT NULL,
    id                  uniqueidentifier     NOT NULL,   -- = entryId
    ledger_id           uniqueidentifier     NOT NULL,
    sequence_no         bigint               NOT NULL,
    previous_hash       varbinary(32)        NOT NULL,   -- Genesis: 32 x 0x00 (22.6)
    entry_hash          varbinary(32)        NOT NULL,

    /* 24.3: Die kanonischen Bytes werden GESPEICHERT, nicht neu berechnet.
       Ein Pruefer soll die Bytes bekommen, ueber die tatsaechlich signiert
       wurde, und nicht das Ergebnis eines zweiten Serialisierungslaufs, der
       abweichen koennte.                                                      */
    payload_canonical   varbinary(max)       NOT NULL,

    subject_id          uniqueidentifier     NOT NULL,
    tenant_id           uniqueidentifier     NOT NULL,
    module_id           nvarchar(32)         NOT NULL,
    signer_key_fp       varbinary(16)        NOT NULL,
    key_version         int                  NOT NULL,
    transaction_id      uniqueidentifier     NOT NULL,

    /* 3.4: gesaltete Verpflichtung, niemals die Account-ID. Stuende sie hier,
       liefe sie ueber den Export (7.4) aus.                                   */
    account_commitment  varbinary(32)        NOT NULL,
    signature           varbinary(1024)      NOT NULL,

    /* 7.1 / E-265: Behauptung des Betreibers. Die Kette beweist Reihenfolge
       und Urheberschaft; den Zeitpunkt beweist erst der oeffentliche
       Kopfabruf gegenueber unabhaengigen Mitschreibern (7.4.1).               */
    server_timestamp    datetimeoffset(7)    NOT NULL,

    CONSTRAINT pk_rc_ledger_entry PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_ledger_entry_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT uq_rc_ledger_entry_seq UNIQUE NONCLUSTERED (ledger_id, sequence_no),
    CONSTRAINT uq_rc_ledger_entry_prev UNIQUE NONCLUSTERED (ledger_id, previous_hash)
);
CREATE INDEX ix_rc_ledger_entry_public ON dbo.rc_ledger_entry (ledger_id, sequence_no)
    INCLUDE (entry_hash, previous_hash, server_timestamp, signer_key_fp);
GO

/* 7.6: Append-only wird DATENBANKSEITIG erzwungen, nicht durch
   Anwendungsdisziplin. Ohne das beweist die Kette nichts gegen jemanden mit
   Datenbankzugriff — und genau gegen den soll sie schuetzen.                  */
CREATE TRIGGER dbo.tr_rc_ledger_entry_append_only
ON dbo.rc_ledger_entry
INSTEAD OF UPDATE, DELETE
AS
BEGIN
    RAISERROR (N'rc_ledger_entry ist append-only (Spezifikation 7.6). UPDATE und DELETE sind nicht zulaessig.', 16, 1);
    ROLLBACK TRANSACTION;
END
GO

/* 7.7: Transaktions-Outbox. Geschaeftszustand, Fachhistorie und Outbox-Eintrag
   entstehen in EINER SQL-Transaktion; erst danach projiziert ein
   Hintergrundarbeiter.                                                        */
CREATE TABLE dbo.rc_ledger_outbox (
    seq              bigint IDENTITY(1,1) NOT NULL,
    id               uniqueidentifier     NOT NULL,
    ledger_entry_id  uniqueidentifier     NOT NULL,
    idempotency_key  nvarchar(128)        NOT NULL,
    dispatched_at    datetimeoffset(7)    NULL,
    attempts         int                  NOT NULL CONSTRAINT df_rc_outbox_attempts DEFAULT 0,
    last_error       nvarchar(512)        NULL,

    CONSTRAINT pk_rc_ledger_outbox PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_ledger_outbox_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT uq_rc_ledger_outbox_idem UNIQUE NONCLUSTERED (idempotency_key)
);
CREATE INDEX ix_rc_ledger_outbox_pending ON dbo.rc_ledger_outbox (seq) WHERE dispatched_at IS NULL;
GO

/* ===========================================================================
   5. Baustein fuer besondere Kategorien (12.9)
   BEFUND 29: Anhang F kannte fuer Phase 0, Position 12 kein Schema — als
   einzige Position der Phase 0, und die rechtlich dringendste.
   =========================================================================== */

CREATE TABLE dbo.rc_data_item (
    seq             bigint IDENTITY(1,1) NOT NULL,
    id              uniqueidentifier     NOT NULL,
    owner_role_id   uniqueidentifier     NOT NULL,

    /* 12.9: public | operational | personal | special | secret | integration.
       Die Klasse entscheidet ueber Huelle, Rollenfreigabe und Protokollpflicht. */
    data_class      nvarchar(16)         NOT NULL,

    /* Der Feldname aus der festen Aufzaehlung in RcAad (3.13). Als Klartext,
       weil er Teil der AAD ist und dort ohnehin offen liegt.                  */
    aad_module      nvarchar(32)         NOT NULL,
    aad_object_type nvarchar(32)         NOT NULL,
    aad_field       nvarchar(32)         NOT NULL,
    aad_version     int                  NOT NULL CONSTRAINT df_rc_data_item_ver DEFAULT 1,

    value_sealed    varbinary(max)       NOT NULL,
    created_at      datetimeoffset(7)    NOT NULL,
    updated_at      datetimeoffset(7)    NOT NULL,

    /* 12.3.2 Weg (b) */
    destroyed_at    datetimeoffset(7)    NULL,

    CONSTRAINT pk_rc_data_item PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_data_item_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_data_item_owner FOREIGN KEY (owner_role_id) REFERENCES dbo.rc_role (id),
    CONSTRAINT ck_rc_data_item_class CHECK (data_class IN
        (N'public', N'operational', N'personal', N'special', N'secret', N'integration'))
);
CREATE INDEX ix_rc_data_item_owner ON dbo.rc_data_item (owner_role_id, data_class) WHERE destroyed_at IS NULL;
GO

/* 12.9: Bei besonderen Kategorien ist ein Zugriffsprotokoll ZWINGEND.
   Art.-9-Daten, die ohne Spur gelesen werden koennen, sind schwer zu
   verteidigen. Der Eintrag traegt bewusst KEINEN Inhalt.                      */
CREATE TABLE dbo.rc_data_access_log (
    seq            bigint IDENTITY(1,1) NOT NULL,
    data_item_id   uniqueidentifier     NOT NULL,
    reader_role_id uniqueidentifier     NOT NULL,
    accessed_at    datetimeoffset(7)    NOT NULL,
    purpose        nvarchar(64)         NULL,

    CONSTRAINT pk_rc_data_access_log PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT fk_rc_data_access_log_item FOREIGN KEY (data_item_id) REFERENCES dbo.rc_data_item (id)
);
CREATE INDEX ix_rc_data_access_log_item ON dbo.rc_data_access_log (data_item_id, accessed_at DESC);
GO

CREATE TRIGGER dbo.tr_rc_data_access_log_append_only
ON dbo.rc_data_access_log
INSTEAD OF UPDATE, DELETE
AS
BEGIN
    RAISERROR (N'rc_data_access_log ist append-only. Ein loeschbares Zugriffsprotokoll ist keines.', 16, 1);
    ROLLBACK TRANSACTION;
END
GO

/* ===========================================================================
   6. Einwilligungs-Versionsverzeichnis (12.10)
   Append-only mit denselben Mitteln wie die Kette: verschwindet Version 3,
   ist jeder Fingerabdruck, der auf sie zeigt, rueckwirkend wertlos — und zwar
   ohne dass es auffaellt.
   =========================================================================== */

CREATE TABLE dbo.rc_consent_text (
    seq          bigint IDENTITY(1,1) NOT NULL,
    id           uniqueidentifier     NOT NULL,
    consent_key  nvarchar(64)         NOT NULL,
    language     nvarchar(8)          NOT NULL,   -- 12.10: je Sprache ein eigener Text
    version      int                  NOT NULL,
    body         nvarchar(max)        NOT NULL,
    body_hash    varbinary(32)        NOT NULL,   -- ueber die kanonische Form
    published_at datetimeoffset(7)    NOT NULL,

    CONSTRAINT pk_rc_consent_text PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_consent_text_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT uq_rc_consent_text_ver UNIQUE NONCLUSTERED (consent_key, language, version)
);
GO

CREATE TRIGGER dbo.tr_rc_consent_text_append_only
ON dbo.rc_consent_text
INSTEAD OF UPDATE, DELETE
AS
BEGIN
    RAISERROR (N'rc_consent_text ist append-only (12.10). Auch ein Tippfehler erzeugt eine neue Version.', 16, 1);
    ROLLBACK TRANSACTION;
END
GO

/* Die Fassung wird vom Migrationslauf eingetragen, nach Erfolg und in
   derselben Transaktion — nicht hier. Ein Skript, das seinen eigenen Erfolg
   meldet, meldet ihn auch nach einem Rollback. */
