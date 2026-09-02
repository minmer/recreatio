/* ===========================================================================
   Ein Lauf: die Plattform-Tabellen loeschen und neu anlegen.

   ERZEUGT, NICHT GESCHRIEBEN. Diese Datei ist aus den zwoelf Migrationsskripten
   zusammengesetzt (scratchpad/buildpatch.mjs). Wer etwas am Schema aendern will,
   aendert das jeweilige rc_00NN-Skript und erzeugt diese Datei neu — eine
   Aenderung hier waere beim naechsten Erzeugen wieder fort.

   ---------------------------------------------------------------------------
   WAS SIE TUT

     1. Alle Fremdschluessel auf Tabellen mit dem Praefix rc_ loesen.
     2. Alle Tabellen mit dem Praefix rc_ loeschen. Die zehn Ausloeser darauf
        gehen mit ihnen.
     3. Die zwoelf Skripte der Reihe nach anwenden.
     4. dbo.rc_schema_version mit genau den Pruefsummen fuellen, die der
        Migrationslauf selbst errechnen wuerde.

   Schritt 4 ist der, den man vergisst. Ohne ihn steht das Schema zwar da, aber
   das Fassungsverzeichnis ist leer — und der naechste Migrationslauf versucht
   alles noch einmal und bricht an der ersten schon vorhandenen Tabelle ab.
   Genau diese Sackgasse war der Anlass fuer diese Datei.

   ---------------------------------------------------------------------------
   WAS SIE LOESCHT

   <b>ALLE Daten der neuen Plattform.</b> Konten, Bereiche, Rollen, Zertifikate,
   Nachrichten, Kettenglieder — restlos. Der Altbestand ist nicht betroffen:
   keine seiner Tabellen traegt das Praefix rc_, und angefasst wird nur dieses.

   ---------------------------------------------------------------------------
   AUSFUEHREN

   In einem Werkzeug, das GO als Stapeltrenner versteht (SSMS, sqlcmd, Azure
   Data Studio). NICHT ueber eine einzelne SqlCommand-Ausfuehrung: die kennt GO
   nicht und bricht an der ersten Trennlinie ab.
   =========================================================================== */

SET NOCOUNT ON;
GO

/* --- 1 und 2: fort damit ------------------------------------------------- */

DECLARE @drop nvarchar(max) = N'';

SELECT @drop += N'ALTER TABLE dbo.' + QUOTENAME(t.name)
              + N' DROP CONSTRAINT ' + QUOTENAME(f.name) + N';' + CHAR(13) + CHAR(10)
FROM sys.foreign_keys f
JOIN sys.tables t ON t.object_id = f.parent_object_id
WHERE t.name LIKE 'rc[_]%' AND SCHEMA_NAME(t.schema_id) = 'dbo';

SELECT @drop += N'DROP TABLE dbo.' + QUOTENAME(name) + N';' + CHAR(13) + CHAR(10)
FROM sys.tables
WHERE name LIKE 'rc[_]%' AND SCHEMA_NAME(schema_id) = 'dbo';

EXEC sp_executesql @drop;
GO

PRINT '--- Alte rc_-Tabellen entfernt. Jetzt die zwoelf Skripte. ---';
GO

/* =========================================================================
   rc_0001_kernel
   ========================================================================= */
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

GO
PRINT '  OK   rc_0001_kernel';
GO

/* =========================================================================
   rc_0002_chat
   ========================================================================= */
/* ===========================================================================
   rc_0002_chat — Bereiche, Epochen, Nachrichten, Themen, Beschluesse
   Anhang F 24.4, uebersetzt nach SQL Server.

   Zwei Stellen weichen bewusst von Anhang F ab. Beide sind im Pruefbericht
   als Befund gemeldet und hier so umgesetzt, wie der Fliesstext es verlangt:

   BEFUND 27 — rc_poll_vote bekommt einen eigenen Schluessel und cast_at.
     Anhang F hatte PRIMARY KEY (poll_id, role_id). Damit kann es je Rolle
     genau eine Zeile geben, und eine geaenderte Stimme ueberschreibt die
     alte. 9.5 verlangt aber: "Die letzte gueltige Stimme je Rolle zaehlt;
     aeltere bleiben sichtbar (Grundsatz 5: nichts wird ueberschrieben)."

   BEFUND 28 — Ausblenden hat zwei Faelle, nicht einen.
     Anhang F kommentierte author_role_id mit "NULL nach Ausblenden" ohne
     Fallunterscheidung. 9.17 unterscheidet: beim Urheber verschwindet die
     Urheberangabe, beim Administrator BLEIBT sie — sonst waere die zugesagte
     Umkehrbarkeit nicht moeglich. Die Regel steht jetzt als CHECK in der
     Datenbank und nicht nur in der Prosa.
   =========================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

/* Ohne diese beiden schlagen gefilterte Indizes und Ausloeser fehl: sqlcmd
   startet mit QUOTED_IDENTIFIER OFF, und der Wert wird beim Anlegen eines
   Ausloesers festgeschrieben. Gefunden beim ersten echten Lauf. */
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

/* Kein Waechter im Skript — siehe die Begruendung in rc_0001_kernel.sql:
   RETURN verlaesst nur den eigenen Stapel. Wiedereintritt gehoert dem
   Migrationslauf. */

/* Die Transaktion gehoert dem Migrationslauf, nicht dem Skript: GO teilt in
   Stapel, und nach einem Abbruch findet COMMIT sein BEGIN nicht mehr — dann
   meldet das Skript Erfolg, obwohl zurueckgerollt wurde. */

/* ---------------------------------------------------------------------------
   Bereich: ein Schluessel, eine Kette (E-52).
   Sichtbarkeit ist kryptografisch, Thema ist organisatorisch. Die beiden
   Achsen werden nie vermischt (9.1).
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_area (
    seq            bigint IDENTITY(1,1) NOT NULL,
    id             uniqueidentifier     NOT NULL,
    tenant_id      uniqueidentifier     NOT NULL,
    title_sealed   varbinary(1024)      NOT NULL,
    ledger_id      uniqueidentifier     NOT NULL,
    current_epoch  int                  NOT NULL CONSTRAINT df_rc_area_epoch DEFAULT 1,

    /* 9.14.2: verlassen, archivieren und schliessen sind drei verschiedene
       Dinge. open | archived | closed                                         */
    lifecycle      nvarchar(16)         NOT NULL CONSTRAINT df_rc_area_life DEFAULT N'open',

    /* 9.14.4: DM = Gruppe mit zwei Mitgliedern. Genau ein kanonisches
       Gespraech je Personenpaar (E-126) — die Eindeutigkeit erzwingt
       dm_pair_key, gebildet aus den sortierten Rollen-IDs.                    */
    is_direct      bit                  NOT NULL CONSTRAINT df_rc_area_direct DEFAULT 0,
    dm_pair_key    nvarchar(80)         NULL,

    /* 9.14.5: Oeffentliche Boards entstehen als solche. Es gibt keine
       Umwandlung privat -> oeffentlich (E-129).                               */
    is_public      bit                  NOT NULL CONSTRAINT df_rc_area_public DEFAULT 0,

    /* 4.3: "Mitgliedschaft erfordert Aufsichts-Kante" (E-27).                 */
    requires_supervision bit            NOT NULL CONSTRAINT df_rc_area_sup DEFAULT 0,

    /* 9.9.1: Die Leitung kann Lesebestaetigungen fuer den Bereich abschalten —
       aber niemals erzwingen (E-278).                                         */
    receipts_enabled bit                NOT NULL CONSTRAINT df_rc_area_receipts DEFAULT 1,

    home_store     smallint             NOT NULL CONSTRAINT df_rc_area_home DEFAULT 0,
    created_at     datetimeoffset(7)    NOT NULL,

    CONSTRAINT pk_rc_area PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_area_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT ck_rc_area_life CHECK (lifecycle IN (N'open', N'archived', N'closed')),
    CONSTRAINT ck_rc_area_dm CHECK ((is_direct = 0 AND dm_pair_key IS NULL)
                                 OR (is_direct = 1 AND dm_pair_key IS NOT NULL))
);
CREATE UNIQUE INDEX uq_rc_area_dm ON dbo.rc_area (dm_pair_key) WHERE dm_pair_key IS NOT NULL;
CREATE INDEX ix_rc_area_tenant ON dbo.rc_area (tenant_id, lifecycle);
GO

/* 9.12.5: Beim Ausscheiden wird ein Epochenschnitt gelegt, die Historie NICHT
   neu verschluesselt. Wer ging, behaelt den alten Epochenschluessel und damit
   Zugang zu dem, was er ohnehin gelesen hat; alles Neue liegt unter der neuen
   Epoche und ist fuer ihn unlesbar.

   Der Schluessel selbst liegt NUR in rc_role_key_grant, nie hier (24.5).       */
CREATE TABLE dbo.rc_area_epoch (
    area_id     uniqueidentifier  NOT NULL,
    epoch       int               NOT NULL,
    created_at  datetimeoffset(7) NOT NULL,
    reason      nvarchar(24)      NOT NULL,   -- initial | member_left | member_added | rotation

    CONSTRAINT pk_rc_area_epoch PRIMARY KEY CLUSTERED (area_id, epoch),
    CONSTRAINT fk_rc_area_epoch_area FOREIGN KEY (area_id) REFERENCES dbo.rc_area (id),
    CONSTRAINT ck_rc_area_epoch_reason CHECK (reason IN
        (N'initial', N'member_left', N'member_added', N'rotation'))
);
GO

/* ---------------------------------------------------------------------------
   Nachrichten
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_message (
    seq                 bigint IDENTITY(1,1) NOT NULL,
    id                  uniqueidentifier     NOT NULL,
    area_id             uniqueidentifier     NOT NULL,
    epoch               int                  NOT NULL,

    /* 9.17 / BEFUND 28: NULL nur beim Ausblenden durch den Urheber. */
    author_role_id      uniqueidentifier     NULL,

    /* 3.3: Dual Authorship. Beide werden gespeichert, nur die Rolle wird
       angezeigt. Der Account bleibt fuer Stellvertretung und Zurechenbarkeit.
       BEFUND 07 aus dem ersten Bericht: die Kennung wird NICHT im normalen
       Lesepfad ausgeliefert (3.4) — deshalb liegt sie in einer eigenen
       Tabelle, die der Lesepfad nicht joint.                                  */

    body_sealed         varbinary(max)       NULL,
    version             int                  NOT NULL CONSTRAINT df_rc_message_ver DEFAULT 1,
    posted_at           datetimeoffset(7)    NOT NULL,
    edited_at           datetimeoffset(7)    NULL,

    /* 9.6.6 / E-270: Die Frist laeuft ab dem letzten Absenden, nicht ab
       Beginn des Schreibens. Jede Anfuegung verlaengert sie.                  */
    append_window_until datetimeoffset(7)    NULL,

    /* 9.6.7: Zitat verweist auf den Hash der zitierten Fassung. Sie wandert
       NICHT mit, wenn das Original spaeter bearbeitet wird — sonst koennte
       jemand eine Aussage nachtraeglich aendern und das Zitat mitveraendern.  */
    quote_message_id    uniqueidentifier     NULL,
    quote_body_hash     varbinary(32)        NULL,

    hidden_at           datetimeoffset(7)    NULL,
    hidden_kind         tinyint              NULL,   -- 1 = durch Urheber, 2 = nichtkonform
    hidden_by_role_id   uniqueidentifier     NULL,

    /* 7.8 / E-263: nullbar. Kettenpflicht wird JE BEITRAG entschieden, nicht
       je Bereich. Fehlt die Angabe, entsteht kein Eintrag — sichere
       Voreinstellung, und kein Sicherheitsverlust: der Beitrag ist trotzdem
       verschluesselt, zugeordnet und versioniert.                             */
    ledger_entry_id     uniqueidentifier     NULL,

    CONSTRAINT pk_rc_message PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_message_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_message_epoch FOREIGN KEY (area_id, epoch)
        REFERENCES dbo.rc_area_epoch (area_id, epoch),

    CONSTRAINT ck_rc_message_hidden_kind CHECK (hidden_kind IS NULL OR hidden_kind IN (1, 2)),
    CONSTRAINT ck_rc_message_hidden_pair CHECK (
        (hidden_at IS NULL AND hidden_kind IS NULL)
     OR (hidden_at IS NOT NULL AND hidden_kind IS NOT NULL)),

    /* BEFUND 28 — die eigentliche Regel, jetzt in der Datenbank:
       Ausblenden durch den Urheber (1): Text wird nicht mehr ausgeliefert UND
       die Urheberangabe verschwindet. Was bleibt, ist ein anonymer Grabstein.
       Ausblenden durch den Administrator (2): beides bleibt liegen, damit die
       Entscheidung umkehrbar ist.                                             */
    CONSTRAINT ck_rc_message_hide_semantics CHECK (
        hidden_kind IS NULL
     OR (hidden_kind = 1 AND author_role_id IS NULL AND body_sealed IS NULL)
     OR (hidden_kind = 2 AND author_role_id IS NOT NULL AND body_sealed IS NOT NULL)),

    /* Solange nicht ausgeblendet, muessen Urheber und Text vorhanden sein. */
    CONSTRAINT ck_rc_message_visible CHECK (
        hidden_at IS NOT NULL
     OR (author_role_id IS NOT NULL AND body_sealed IS NOT NULL))
);
CREATE INDEX ix_rc_message_feed ON dbo.rc_message (area_id, seq DESC);
CREATE INDEX ix_rc_message_author ON dbo.rc_message (author_role_id) WHERE author_role_id IS NOT NULL;
GO

/* 3.3 / 3.4: Die technische Herkunft liegt getrennt. Der normale Lesepfad
   joint diese Tabelle NICHT — waere die Kennung eine Spalte auf rc_message,
   muesste jeder kuenftige Endpunkt daran denken, sie zu entfernen. Genau so
   ist der heutige Zustand im Altsystem entstanden.                            */
CREATE TABLE dbo.rc_message_attribution (
    message_id  uniqueidentifier NOT NULL,
    account_id  uniqueidentifier NOT NULL,
    created_at  datetimeoffset(7) NOT NULL,
    CONSTRAINT pk_rc_message_attribution PRIMARY KEY CLUSTERED (message_id),
    CONSTRAINT fk_rc_message_attribution_msg FOREIGN KEY (message_id) REFERENCES dbo.rc_message (id)
);
GO

/* 9.6.5: Bearbeiten ist unbegrenzt, jede Version wird angehaengt, nichts wird
   ueberschrieben. Der Klient zeigt die neueste Fassung; auf Klick erscheint
   die Versionsliste mit Zeitpunkt, Signatur und markierten Aenderungen.       */
CREATE TABLE dbo.rc_message_version (
    seq          bigint IDENTITY(1,1) NOT NULL,
    id           uniqueidentifier     NOT NULL,
    message_id   uniqueidentifier     NOT NULL,
    version      int                  NOT NULL,
    body_sealed  varbinary(max)       NOT NULL,
    created_at   datetimeoffset(7)    NOT NULL,
    signature    varbinary(1024)      NOT NULL,

    CONSTRAINT pk_rc_message_version PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_message_version_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT uq_rc_message_version_no UNIQUE NONCLUSTERED (message_id, version),
    CONSTRAINT fk_rc_message_version_msg FOREIGN KEY (message_id) REFERENCES dbo.rc_message (id)
);
GO

/* 9.6.2: Entwuerfe sind die EINZIGE Ausnahme von Grundsatz 5 — sie duerfen
   ueberschrieben werden. Eigene schmale Tabelle ohne Kettenanhang und ohne
   Historie, weil sie alle paar Sekunden geschrieben wird.                     */
CREATE TABLE dbo.rc_draft (
    area_id     uniqueidentifier  NOT NULL,
    role_id     uniqueidentifier  NOT NULL,
    body_sealed varbinary(max)    NOT NULL,
    updated_at  datetimeoffset(7) NOT NULL,
    CONSTRAINT pk_rc_draft PRIMARY KEY CLUSTERED (area_id, role_id)
);
GO

/* ---------------------------------------------------------------------------
   Themen und Beschluesse
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_topic (
    seq             bigint IDENTITY(1,1) NOT NULL,
    id              uniqueidentifier     NOT NULL,
    area_id         uniqueidentifier     NOT NULL,
    title_sealed    varbinary(1024)      NOT NULL,   -- 9.3.9: getippt, nie abgeleitet
    parent_topic_id uniqueidentifier     NULL,       -- 9.3.1: verschachtelbar
    created_at      datetimeoffset(7)    NOT NULL,

    /* 9.3.2: genau zwei Zustaende. Alle Nuancen laufen ueber Labels — jeder
       zusaetzliche Zustand erzeugt Diskussionen darueber, was er bedeutet,
       und niemand pflegt ihn.                                                 */
    closed_at       datetimeoffset(7)    NULL,
    closed_by_role_id uniqueidentifier   NULL,

    /* 9.3.7: Duplikat ist nur ein beidseitiger Zeiger, kein Verschmelzen —
       die Nachrichten koennen in verschiedenen Bereichen liegen.              */
    duplicate_of_id uniqueidentifier     NULL,

    CONSTRAINT pk_rc_topic PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_topic_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_topic_area FOREIGN KEY (area_id) REFERENCES dbo.rc_area (id)
);
CREATE INDEX ix_rc_topic_area ON dbo.rc_topic (area_id, closed_at);
GO

/* 9.3.4: gespeichert wird nur die ID, nicht der Text. Die Suche funktioniert
   dadurch normal, weil die ID unverschluesselt sein kann, ohne Inhalt
   preiszugeben. Fester Katalog im Code, keine eigenen Labels in v1.           */
CREATE TABLE dbo.rc_topic_label (
    topic_id uniqueidentifier NOT NULL,
    label_id smallint         NOT NULL,
    CONSTRAINT pk_rc_topic_label PRIMARY KEY CLUSTERED (topic_id, label_id),
    CONSTRAINT fk_rc_topic_label_topic FOREIGN KEY (topic_id) REFERENCES dbo.rc_topic (id)
);
GO

/* 9.3.1: m:n. Eine Nachricht kann zu mehreren Themen gehoeren, nachtraeglich
   zugeordnet werden, und der ungefilterte Feed bleibt die Gesamtsicht.        */
CREATE TABLE dbo.rc_message_topic (
    message_id  uniqueidentifier  NOT NULL,
    topic_id    uniqueidentifier  NOT NULL,
    assigned_at datetimeoffset(7) NOT NULL,
    assigned_by_role_id uniqueidentifier NOT NULL,
    CONSTRAINT pk_rc_message_topic PRIMARY KEY CLUSTERED (message_id, topic_id),
    CONSTRAINT fk_rc_message_topic_msg FOREIGN KEY (message_id) REFERENCES dbo.rc_message (id),
    CONSTRAINT fk_rc_message_topic_topic FOREIGN KEY (topic_id) REFERENCES dbo.rc_topic (id)
);
CREATE INDEX ix_rc_message_topic_topic ON dbo.rc_message_topic (topic_id);
GO

/* 9.4: Eigenes Objekt, eigene Sichtbarkeit, GitHub-artige Zustandsmaschine.
   Der Schluessel haengt am Bereich, NIE am Beschluss (E-70) — sonst muessten
   bei einem Mitgliederwechsel Dutzende Beschlussschluessel rotieren.
   Ein angenommener Beschluss schliesst das Thema NICHT (E-69).                */
CREATE TABLE dbo.rc_decision (
    seq             bigint IDENTITY(1,1) NOT NULL,
    id              uniqueidentifier     NOT NULL,
    area_id         uniqueidentifier     NOT NULL,
    topic_id        uniqueidentifier     NULL,
    state           nvarchar(16)         NOT NULL,
    body_sealed     varbinary(max)       NOT NULL,   -- 9.4.4: bis 20.000 Zeichen
    ledger_entry_id uniqueidentifier     NOT NULL,   -- immer kettenpflichtig (7.8)
    created_at      datetimeoffset(7)    NOT NULL,

    CONSTRAINT pk_rc_decision PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_decision_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_decision_area FOREIGN KEY (area_id) REFERENCES dbo.rc_area (id),
    CONSTRAINT ck_rc_decision_state CHECK (state IN
        (N'proposed', N'open', N'accepted', N'rejected', N'reopened'))
);
GO

/* 9.4.2: Bei jedem Uebergang eine verlinkte Begruendung. Kein Uebergang ohne
   Text, volle Historie, jeder Uebergang kettenpflichtig.                      */
CREATE TABLE dbo.rc_decision_transition (
    seq             bigint IDENTITY(1,1) NOT NULL,
    id              uniqueidentifier     NOT NULL,
    decision_id     uniqueidentifier     NOT NULL,
    from_state      nvarchar(16)         NULL,
    to_state        nvarchar(16)         NOT NULL,
    reason_sealed   varbinary(max)       NOT NULL,
    by_role_id      uniqueidentifier     NOT NULL,
    at              datetimeoffset(7)    NOT NULL,
    ledger_entry_id uniqueidentifier     NOT NULL,

    CONSTRAINT pk_rc_decision_transition PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_decision_transition_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_decision_transition_dec FOREIGN KEY (decision_id) REFERENCES dbo.rc_decision (id)
);
GO

/* ---------------------------------------------------------------------------
   Umfragen (9.5)
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_poll (
    seq              bigint IDENTITY(1,1) NOT NULL,
    id               uniqueidentifier     NOT NULL,
    area_id          uniqueidentifier     NOT NULL,
    question_sealed  varbinary(max)       NOT NULL,
    mode             nvarchar(16)         NOT NULL,   -- single | multi | quiz
    reveal           nvarchar(16)         NOT NULL,   -- immediate | on_close
    created_at       datetimeoffset(7)    NOT NULL,
    closed_at        datetimeoffset(7)    NULL,

    CONSTRAINT pk_rc_poll PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_poll_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_poll_area FOREIGN KEY (area_id) REFERENCES dbo.rc_area (id),
    CONSTRAINT ck_rc_poll_mode CHECK (mode IN (N'single', N'multi', N'quiz')),
    CONSTRAINT ck_rc_poll_reveal CHECK (reveal IN (N'immediate', N'on_close'))
);
GO

/* BEFUND 27 — hier weicht die Umsetzung bewusst von Anhang F ab.

   Anhang F: PRIMARY KEY (poll_id, role_id). Damit gibt es je Rolle genau eine
   Zeile, eine geaenderte Stimme ueberschreibt die alte, und 9.5 waere nicht
   einhaltbar.

   Hier: eigener Schluessel plus cast_at. Der Klient zaehlt je Rolle die
   juengste signierte Stimme (E-282) und kann die aelteren zeigen, wie 9.5 es
   verlangt. Der Server kann nicht zaehlen — er sieht die Stimmen nicht.       */
CREATE TABLE dbo.rc_poll_vote (
    seq            bigint IDENTITY(1,1) NOT NULL,
    id             uniqueidentifier     NOT NULL,
    poll_id        uniqueidentifier     NOT NULL,
    role_id        uniqueidentifier     NOT NULL,
    choice_sealed  varbinary(1024)      NOT NULL,
    signature      varbinary(1024)      NOT NULL,   -- jede Stimme einzeln signiert
    cast_at        datetimeoffset(7)    NOT NULL,

    CONSTRAINT pk_rc_poll_vote PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_poll_vote_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_poll_vote_poll FOREIGN KEY (poll_id) REFERENCES dbo.rc_poll (id)
);
/* 9.5: Die Stimmen werden MIT der Umfrage geladen, nicht einzeln nachgeholt —
   bei sechzig Personen sind das sechzig Datensaetze je Anzeige.               */
CREATE INDEX ix_rc_poll_vote_tally ON dbo.rc_poll_vote (poll_id, role_id, cast_at DESC)
    INCLUDE (choice_sealed, signature);
GO

/* ---------------------------------------------------------------------------
   Lesezustand, Reaktionen, Anhaenge
   --------------------------------------------------------------------------- */

/* 9.9.3: "Gelesen" haengt an der Nachricht und gilt global — wer eine
   Nachricht in einem Thema liest, hat sie auch im ungefilterten Feed gelesen. */
CREATE TABLE dbo.rc_read_state (
    area_id           uniqueidentifier  NOT NULL,
    role_id           uniqueidentifier  NOT NULL,
    last_read_seq     bigint            NOT NULL,
    last_read_at      datetimeoffset(7) NOT NULL,

    /* 9.9.1: je Nutzer abschaltbar, mit Symmetrie — wer verbirgt, sieht auch
       nicht. AUSNAHME: Aufsichtsrollen (4.5). Sonst koennte der
       Aufsichtsfuehrende die Sichtbarkeit abschalten, weiterhin lesen und
       genau das aushebeln, was die Regel zusagt.                              */
    receipts_enabled  bit               NOT NULL CONSTRAINT df_rc_read_receipts DEFAULT 1,
    is_supervisor     bit               NOT NULL CONSTRAINT df_rc_read_sup DEFAULT 0,

    CONSTRAINT pk_rc_read_state PRIMARY KEY CLUSTERED (area_id, role_id),
    /* Aufsicht darf nicht verbergen. */
    CONSTRAINT ck_rc_read_state_sup CHECK (is_supervisor = 0 OR receipts_enabled = 1)
);
GO

/* 9.7: Genau drei. Keine Emoji-Palette — eine psychologische Entscheidung,
   keine technische Vereinfachung. 1 = Zustimmung, 2 = Ablehnung,
   3 = Diskussionsbedarf. Reaktionen sind KEINE Umfrage (E-85).                */
CREATE TABLE dbo.rc_reaction (
    message_id uniqueidentifier  NOT NULL,
    role_id    uniqueidentifier  NOT NULL,
    kind       tinyint           NOT NULL,
    at         datetimeoffset(7) NOT NULL,
    CONSTRAINT pk_rc_reaction PRIMARY KEY CLUSTERED (message_id, role_id),
    CONSTRAINT fk_rc_reaction_msg FOREIGN KEY (message_id) REFERENCES dbo.rc_message (id),
    CONSTRAINT ck_rc_reaction_kind CHECK (kind IN (1, 2, 3))
);
GO

/* 9.10: Verschluesselt im Dateisystem, in der Datenbank nur der Verweis.
   Kein CDN moeglich — das ist der Preis und er ist bewusst gezahlt (E-93).    */
CREATE TABLE dbo.rc_attachment (
    seq                 bigint IDENTITY(1,1) NOT NULL,
    id                  uniqueidentifier     NOT NULL,
    message_id          uniqueidentifier     NOT NULL,

    /* 15.12: Das Kontingent haengt am KONTO, nicht am Bereich — ein
       Bereichskontingent liesse sich durch Anlegen weiterer Bereiche
       umgehen (E-294).                                                        */
    owner_account_id    uniqueidentifier     NOT NULL,
    size_bytes          bigint               NOT NULL,
    content_sealed_path nvarchar(512)        NOT NULL,
    content_sha256      varbinary(32)        NOT NULL,
    file_name_sealed    varbinary(1024)      NOT NULL,
    created_at          datetimeoffset(7)    NOT NULL,

    CONSTRAINT pk_rc_attachment PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_attachment_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_attachment_msg FOREIGN KEY (message_id) REFERENCES dbo.rc_message (id),
    CONSTRAINT fk_rc_attachment_account FOREIGN KEY (owner_account_id) REFERENCES dbo.rc_account (id),
    CONSTRAINT ck_rc_attachment_size CHECK (size_bytes > 0 AND size_bytes <= 10485760)  -- 10 MB (E-94)
);
CREATE INDEX ix_rc_attachment_quota ON dbo.rc_attachment (owner_account_id) INCLUDE (size_bytes);
GO

/* Fassung wird vom Migrationslauf eingetragen, nach Erfolg. */

GO
PRINT '  OK   rc_0002_chat';
GO

/* =========================================================================
   rc_0003_invitation
   ========================================================================= */
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

/* ===========================================================================
   rc_0003_invitation — Einladungen in nicht oeffentliche Teile (3.12, 10.3)

   Anmelden kann sich jeder. Ein Zugangslink ist KEINE Anmeldung und ersetzt
   auch keine: er ist die Einladung in einen Teil der Plattform, der nicht
   oeffentlich ist, und er wird mit einem BESTEHENDEN Konto verbunden.

   Daraus folgt die ganze Gestalt dieser Tabelle:

     • Ein Token gehoert keinem Konto. Es gehoert einer ROLLE, in die es
       hineinfuehrt, und wird erst beim Einloesen mit einer Person verbunden.

     • Der Schluessel der Rolle reist MIT dem Token, nicht mit der Datenbank.
       sealed_role_key ist unter einem Schluessel versiegelt, der sich aus dem
       Token-Geheimnis ableitet — und das Geheimnis steht nirgends hier. Wer
       diese Tabelle vollstaendig besitzt, kann die Einladung nicht einloesen.
       Nur wer den Link hat, kann es.

     • Deshalb steht der Klartext des Geheimnisses nirgends, auch nicht
       gehasht-mit-Salz: gespeichert ist SHA-256 der Base64URL-Form (10.3).
   =========================================================================== */

IF OBJECT_ID('dbo.rc_token', 'U') IS NULL
CREATE TABLE dbo.rc_token (
    seq              bigint IDENTITY(1,1) NOT NULL,
    id               uniqueidentifier     NOT NULL,

    /* 10.3.1: EIN Baustein fuer alle Zwecke. Die Zeichenkette entspricht
       RcTokenPurpose; ein neuer Zweck verlangt einen Eintrag dort UND hier,
       damit die Frage nach Lebenszeit und Widerruf einmal gestellt wird.     */
    purpose          nvarchar(32)      NOT NULL,

    /* Wohin der Token fuehrt. Bei AreaInvitation die Rolle, in die er
       aufnimmt; bei anderen Zwecken das jeweilige Objekt.                    */
    subject_id       uniqueidentifier  NOT NULL,

    /* 10.3: NUR der Hash. Der Klartext verlaesst die Erzeugung genau einmal.  */
    token_hash       varbinary(32)     NOT NULL,

    /* Der Rollenschluessel, versiegelt unter einer Ableitung aus dem
       Token-Geheimnis. AlgId 0x01, AAD kernel:invitation:<id>:invite_key:1.
       NULL bei Zwecken, die keinen Schluessel weiterreichen.                  */
    sealed_role_key  varbinary(512)    NULL,

    created_by_role_id uniqueidentifier NOT NULL,
    created_at       datetimeoffset(7) NOT NULL,

    /* E-07: Lebenszeit ist Pflicht. 10.4: ueber SMS mindestens sieben Tage —
       das erzwingt der Kernel, weil die Regel dort ohnehin steht.            */
    expires_at       datetimeoffset(7) NOT NULL,
    revoked_at       datetimeoffset(7) NULL,

    /* NULL = beliebig oft. Eine Einladung an eine Person ist einmalig, eine
       an eine Gruppe nicht — und das ist eine Entscheidung des Einladenden,
       keine Eigenschaft des Verfahrens.                                      */
    max_uses         int               NULL,
    use_count        int               NOT NULL CONSTRAINT df_rc_token_uses DEFAULT 0,

    /* 15.5 im Audit: Das Feld heisst NICHT "verifiziert". Es belegt, dass der
       Link geoeffnet wurde, und sonst nichts.                                */
    first_opened_at  datetimeoffset(7) NULL,
    view_count       int               NOT NULL CONSTRAINT df_rc_token_views DEFAULT 0,

    label            nvarchar(128)     NULL,

    CONSTRAINT pk_rc_token PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_token_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT ck_rc_token_life CHECK (expires_at > created_at),
    CONSTRAINT ck_rc_token_uses CHECK (max_uses IS NULL OR max_uses > 0),
    CONSTRAINT ck_rc_token_count CHECK (use_count >= 0)
);
GO

/* Nachschlagen geschieht ueber den Hash und nur ueber ihn: der Klient legt
   das Geheimnis vor, der Dienst hasht und sucht. Es gibt keinen Weg von der
   Tabelle zum Geheimnis, also auch keinen Index darauf.                      */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_rc_token_hash')
    CREATE UNIQUE INDEX uq_rc_token_hash ON dbo.rc_token (token_hash);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_rc_token_subject')
    CREATE INDEX ix_rc_token_subject ON dbo.rc_token (subject_id, purpose) WHERE revoked_at IS NULL;
GO

/* Wer eine Einladung eingeloest hat. Getrennt vom Token gefuehrt, weil ein
   mehrfach nutzbarer Link mehrere Einloesungen hat — und weil "wer ist ueber
   welche Einladung hereingekommen" eine Frage ist, die man spaeter stellt.

   3.4: Hier steht die Rolle, NICHT das Konto. Die Trennung von Konto und
   Rolle darf nicht ueber die Einladungsliste wieder aufgehoben werden.       */
IF OBJECT_ID('dbo.rc_token_redemption', 'U') IS NULL
CREATE TABLE dbo.rc_token_redemption (
    seq              bigint IDENTITY(1,1) NOT NULL,
    id               uniqueidentifier     NOT NULL,
    token_id         uniqueidentifier     NOT NULL,
    redeemed_by_role_id uniqueidentifier  NOT NULL,
    redeemed_at      datetimeoffset(7)    NOT NULL,
    edge_id          uniqueidentifier     NULL,

    CONSTRAINT pk_rc_token_redemption PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_token_redemption_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_token_redemption_token FOREIGN KEY (token_id) REFERENCES dbo.rc_token (id),
    CONSTRAINT fk_rc_token_redemption_role  FOREIGN KEY (redeemed_by_role_id) REFERENCES dbo.rc_role (id),

    /* Dieselbe Person loest denselben Link nicht zweimal ein. Ohne das waere
       ein mehrfach nutzbarer Link von einer Person beliebig oft aufbrauchbar. */
    CONSTRAINT uq_rc_token_redemption_once UNIQUE (token_id, redeemed_by_role_id)
);
GO

/* Einloesungen sind Tatsachen, keine Zustaende: append-only wie das
   Zugriffsprotokoll (7.6). Wer nachtraeglich streichen koennte, wer wann
   hereingekommen ist, koennte die Einladungsliste zur Erzaehlung machen.     */
IF OBJECT_ID('dbo.tr_rc_token_redemption_append_only', 'TR') IS NULL
EXEC('
CREATE TRIGGER dbo.tr_rc_token_redemption_append_only
ON dbo.rc_token_redemption
INSTEAD OF UPDATE, DELETE
AS
BEGIN
    RAISERROR (''rc_token_redemption ist append-only (7.6).'', 16, 1);
    ROLLBACK TRANSACTION;
END');
GO

GO
PRINT '  OK   rc_0003_invitation';
GO

/* =========================================================================
   rc_0004_datakinds
   ========================================================================= */
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

/* ===========================================================================
   rc_0004_datakinds — 'role_key' als eigene Art der Schluesselzuteilung

   BEFUND 43. Beim Bau der Rollenschicht wurde 'data_key' fuer etwas benutzt,
   wofuer es nicht gedacht war: fuer die Zuteilung des Schluessels einer ROLLE
   an ihren Halter. Beim Bau von Kapitel 12 stellte sich heraus, dass
   'data_key' der Schluessel eines DATENELEMENTS ist (rc_data_item) — und dass
   die Loeschung durch Schluesselvernichtung (12.3.2 Weg b) genau diese
   Zuteilungen vernichtet.

   Beides in einer Art zu fuehren waere nicht bloss unsauber, sondern
   gefaehrlich: eine Loeschung, die "alle data_key-Zuteilungen dieser Rolle"
   vernichtet, haette die Rolle selbst mit ausgesperrt. Der Unterschied
   zwischen 'was diese Rolle IST' und 'was diese Rolle WEISS' muss in der
   Spalte stehen, nicht im Kopf dessen, der die Abfrage schreibt.

   Die Aufzaehlung wird deshalb um 'role_key' erweitert und die bestehenden
   Zeilen werden umgesetzt.
   =========================================================================== */

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_rc_role_key_grant_kind')
    ALTER TABLE dbo.rc_role_key_grant DROP CONSTRAINT ck_rc_role_key_grant_kind;
GO

/* Bestehende Rollenzuteilungen erkennt man daran, dass key_ref auf eine Rolle
   zeigt. Datenelemente gab es zu diesem Zeitpunkt noch keine — die Abfrage ist
   trotzdem so geschrieben, dass sie auch dann noch stimmt, wenn dieses Skript
   spaeter einmal auf einem gewachsenen Bestand laeuft.                        */
UPDATE g
SET key_kind = N'role_key'
FROM dbo.rc_role_key_grant g
WHERE g.key_kind = N'data_key'
  AND EXISTS (SELECT 1 FROM dbo.rc_role r WHERE r.id = g.key_ref);
GO

ALTER TABLE dbo.rc_role_key_grant ADD CONSTRAINT ck_rc_role_key_grant_kind
    CHECK (key_kind IN (N'epoch', N'shared_view', N'data_key', N'role_key', N'recovery'));
GO

GO
PRINT '  OK   rc_0004_datakinds';
GO

/* =========================================================================
   rc_0005_recovery_contribution
   ========================================================================= */
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

/* ===========================================================================
   rc_0005_recovery_contribution — die Beitraege der Buergen

   BEFUND 45. Der Schwellwert aus 8.2 verlangt, dass MEHRERE MENSCHEN
   zusammenkommen. Die erste Umsetzung verlangte statt dessen, dass EINE
   Anfrage alle noetigen Anteile oeffnen kann — und weil ein Anteil nur mit dem
   Schluessel seines Buergen aufgeht, haette das eine Person verlangt, die
   mehrere persoenliche Rollen haelt. Die gibt es nicht. Die Wiederherstellung
   waere also nie vollziehbar gewesen.

   Dieselbe Ueberlegung wie bei der Einladung loest es: jeder Buerge oeffnet
   SEINEN Anteil mit SEINEM Schluessel und verpackt ihn neu unter dem
   oeffentlichen Verpackungsschluessel des Antragstellers. Die Beitraege
   sammeln sich hier, bis der Schwellwert erreicht ist.

   Was dabei NICHT entsteht: ein Ort, an dem Klartext liegt. Ein Beitrag ist
   ein Anteil, verpackt fuer genau einen Empfaenger — der Betreiber sieht
   Huellen, die er nicht oeffnen kann, und ein einzelner Beitrag verraet
   ohnehin nichts (8.2).
   =========================================================================== */

IF OBJECT_ID('dbo.rc_recovery_contribution', 'U') IS NULL
CREATE TABLE dbo.rc_recovery_contribution (
    seq               bigint IDENTITY(1,1) NOT NULL,
    id                uniqueidentifier     NOT NULL,
    request_id        uniqueidentifier     NOT NULL,
    guarantor_role_id uniqueidentifier     NOT NULL,

    /* Der Anteil, neu verpackt unter wrap_public_key des Antragstellers.
       AlgId 0x02, AAD kernel:recovery_contribution:<id>:masterkey:1.          */
    share_resealed    varbinary(1024)      NOT NULL,
    contributed_at    datetimeoffset(7)    NOT NULL,

    CONSTRAINT pk_rc_recovery_contribution PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_recovery_contribution_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_recovery_contribution_request
        FOREIGN KEY (request_id) REFERENCES dbo.rc_recovery_request (id),
    CONSTRAINT fk_rc_recovery_contribution_role
        FOREIGN KEY (guarantor_role_id) REFERENCES dbo.rc_role (id),

    /* Ein Buerge zaehlt einmal. Ohne das koennte einer allein den Schwellwert
       erreichen, indem er denselben Anteil mehrfach einreicht — und die ganze
       Teilung waere eine Kopie mit Zwischenschritt.                           */
    CONSTRAINT uq_rc_recovery_contribution_once UNIQUE (request_id, guarantor_role_id)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_rc_recovery_contribution_request')
    CREATE INDEX ix_rc_recovery_contribution_request
        ON dbo.rc_recovery_contribution (request_id);
GO

/* Beitraege sind Tatsachen, keine Zustaende: wer beigetragen hat, hat
   beigetragen. Nachtraeglich zu streichen, wer dabei war, waere die bequemste
   Art, eine Wiederherstellung anders aussehen zu lassen, als sie war (7.6).   */
IF OBJECT_ID('dbo.tr_rc_recovery_contribution_append_only', 'TR') IS NULL
EXEC('
CREATE TRIGGER dbo.tr_rc_recovery_contribution_append_only
ON dbo.rc_recovery_contribution
INSTEAD OF UPDATE, DELETE
AS
BEGIN
    RAISERROR (''rc_recovery_contribution ist append-only (7.6).'', 16, 1);
    ROLLBACK TRANSACTION;
END');
GO

GO
PRINT '  OK   rc_0005_recovery_contribution';
GO

/* =========================================================================
   rc_0006_events
   ========================================================================= */
/* ===========================================================================
   rc_0006_events — Veranstaltungen: Seiten, Teile, Felder, Anmeldungen

   Das Teilesystem ist die beste Abstraktion des Altbestands (siehe
   _reference/README.md) und wird uebernommen. Eine Veranstaltung ist eine
   Folge von Seiten, eine Seite eine Folge von Teilen, und jeder Teil traegt
   eine Nutzlast, die nur sein eigenes Modul versteht.

   ---------------------------------------------------------------------------
   ZWEI ENTSCHEIDUNGEN TRAGEN DIESES SCHEMA. Beide sind Abweichungen vom
   Altbestand, und beide folgen aus dem, was hier ohnehin schon steht.

   ERSTENS: EINE VERANSTALTUNG HAENGT AN EINEM BEREICH.

   Sie bekommt KEINE eigenen Epochen, keine eigene Schluesselverwaltung, keine
   eigene Kette und keine eigenen Zertifikate. Sie zeigt auf einen Bereich, und
   der bringt das alles mit.

   Der erste Entwurf hatte all das doppelt: rc_event_epoch, rc_event_key, eine
   eigene ledger_id. Das waere eine ZWEITE Umsetzung des heikelsten Codes der
   Plattform gewesen — und die zweite ist immer die, die beim naechsten Befund
   vergessen wird.

   Es passt auch sachlich: wer eine Veranstaltung vorbereitet, ist eine Gruppe,
   die miteinander redet, Beschluesse fasst und Leute dazuholt. Genau das ist
   ein Bereich. Eine Veranstaltung ist ein Bereich mit Seiten daran.

   ZWEITENS: OEFFENTLICHER INHALT WIRD NICHT VERSCHLUESSELT.

   Der naheliegende Weg waere, alles zu versiegeln und fuer oeffentliche Seiten
   den Schluessel mitzuliefern. Das waere Theater: ein Schluessel, den jeder
   bekommt, ist kein Schluessel. Es saehe nach Schutz aus, wo keiner ist, und
   das ist schlimmer als sichtbar ungeschuetzt.

   Ein Teil ist deshalb ENTWEDER oeffentlich (Klartext, von jedem lesbar) ODER
   intern (versiegelt unter dem Epochenschluessel des Bereichs). Die Datenbank
   erzwingt, dass genau eines von beidem gilt — sonst entstuende irgendwann
   eine Zeile mit beidem, und niemand wuesste mehr, welche Fassung gilt.
   =========================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

/* ---------------------------------------------------------------------------
   Die Veranstaltung
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_event (
    seq            bigint IDENTITY(1,1) NOT NULL,
    id             uniqueidentifier     NOT NULL,

    /* Woher Schluessel, Mitglieder, Zertifikate und Kette kommen. */
    area_id        uniqueidentifier     NOT NULL,
    tenant_id      uniqueidentifier     NOT NULL,

    /* Die Adresse. Klartext, weil sie in der Adresszeile steht — sie zu
       versiegeln waere Theater: wer den Link hat, hat sie ohnehin.          */
    slug           nvarchar(80)         NOT NULL,

    /* Der Titel steht in der Adresszeile, im Reiter und in jedem geteilten
       Vorschaubild. Er ist bei einer oeffentlichen Veranstaltung ohnehin
       oeffentlich; bei einer internen liegt der Bereichstitel versiegelt
       daneben und traegt, was nicht heraus soll.                            */
    title          nvarchar(200)        NOT NULL,

    /* draft | published | archived. Ein Entwurf ist NICHT oeffentlich, auch
       wenn is_public steht: sonst waere jede halbfertige Seite im Netz.     */
    lifecycle      nvarchar(16)         NOT NULL CONSTRAINT df_rc_event_life DEFAULT N'draft',

    /* Oeffentlich heisst: ohne Konto lesbar. Es heisst NICHT, dass alles
       daran oeffentlich ist — jeder Teil entscheidet das fuer sich.         */
    is_public      bit                  NOT NULL CONSTRAINT df_rc_event_public DEFAULT 0,

    starts_at      datetimeoffset(7)    NULL,
    ends_at        datetimeoffset(7)    NULL,

    created_at     datetimeoffset(7)    NOT NULL,

    CONSTRAINT pk_rc_event PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_event_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT uq_rc_event_slug UNIQUE NONCLUSTERED (tenant_id, slug),
    CONSTRAINT fk_rc_event_area FOREIGN KEY (area_id) REFERENCES dbo.rc_area (id),
    CONSTRAINT ck_rc_event_life CHECK (lifecycle IN (N'draft', N'published', N'archived')),

    /* Ein Zeitraum, der rueckwaerts laeuft, ist keine Eingabe, sondern ein
       Fehler — und er faellt sonst erst bei der Anzeige auf.                */
    CONSTRAINT ck_rc_event_span CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at)
);
GO

CREATE INDEX ix_rc_event_tenant ON dbo.rc_event (tenant_id, lifecycle);
GO

/* Ein Bereich traegt hoechstens eine Veranstaltung. Zwei waeren zwei
   Oeffentlichkeiten hinter demselben Schluessel — und beim Entfernen eines
   Mitglieds wuesste niemand mehr, welche der beiden gemeint war. */
CREATE UNIQUE INDEX uq_rc_event_area ON dbo.rc_event (area_id);
GO

/* ---------------------------------------------------------------------------
   Seiten
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_event_page (
    seq         bigint IDENTITY(1,1) NOT NULL,
    id          uniqueidentifier     NOT NULL,
    event_id    uniqueidentifier     NOT NULL,
    sort_order  int                  NOT NULL,
    slug        nvarchar(80)         NOT NULL,
    title       nvarchar(200)        NOT NULL,
    is_visible  bit                  NOT NULL CONSTRAINT df_rc_event_page_vis DEFAULT 1,
    created_at  datetimeoffset(7)    NOT NULL,

    CONSTRAINT pk_rc_event_page PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_event_page_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT uq_rc_event_page_slug UNIQUE NONCLUSTERED (event_id, slug),
    CONSTRAINT fk_rc_event_page_event FOREIGN KEY (event_id) REFERENCES dbo.rc_event (id)
);
GO

/* ---------------------------------------------------------------------------
   Teile — das uebernommene Teilesystem
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_event_part (
    seq            bigint IDENTITY(1,1) NOT NULL,
    id             uniqueidentifier     NOT NULL,
    page_id        uniqueidentifier     NOT NULL,
    sort_order     int                  NOT NULL,

    /* Die ART bleibt immer Klartext, auch bei internen Teilen. Sie ist
       Struktur, kein Inhalt: ohne sie liesse sich nicht einmal entscheiden,
       WELCHES Modul den Schluessel ueberhaupt braeuchte. Sie verraet, DASS
       es eine Karte gibt — nicht, wo sie hinzeigt.                          */
    kind           nvarchar(20)         NOT NULL,

    /* Oeffentlich oder intern. Davon haengt ab, in welcher der beiden
       Spaltenfamilien der Inhalt steht.                                     */
    is_public      bit                  NOT NULL CONSTRAINT df_rc_event_part_pub DEFAULT 1,

    /* Bei internen Teilen: unter welcher Epoche des Bereichs versiegelt.
       NULL bei oeffentlichen — dort gibt es nichts zu entschluesseln.       */
    epoch          int                  NULL,

    menu_label     nvarchar(60)         NULL,

    /* Oeffentlich: Klartext. */
    title          nvarchar(200)        NULL,
    intro          nvarchar(600)        NULL,
    config_json    nvarchar(max)        NULL,
    layers_json    nvarchar(max)        NULL,

    /* Intern: versiegelt unter dem Epochenschluessel des Bereichs. */
    title_sealed   varbinary(1024)      NULL,
    intro_sealed   varbinary(2048)      NULL,
    config_sealed  varbinary(max)       NULL,
    layers_sealed  varbinary(max)       NULL,

    is_visible     bit                  NOT NULL CONSTRAINT df_rc_event_part_vis DEFAULT 1,
    created_at     datetimeoffset(7)    NOT NULL,
    updated_at     datetimeoffset(7)    NOT NULL,

    CONSTRAINT pk_rc_event_part PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_event_part_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_event_part_page FOREIGN KEY (page_id) REFERENCES dbo.rc_event_page (id),

    /* Die Aufzaehlung steht in der Datenbank und nicht nur im Klienten. Ein
       unbekannter Teil waere eine Seite, die niemand mehr darstellen kann —
       und er faellt sonst erst beim Lesen auf, lange nach dem Schreiben.    */
    CONSTRAINT ck_rc_event_part_kind CHECK (kind IN (
        N'title', N'shortinfos', N'text', N'plan', N'map', N'faq',
        N'form', N'costs', N'contact', N'gallery', N'files', N'people')),

    /* ENTWEDER oeffentlich ODER versiegelt — nie beides und nie keines. Ohne
       diese Bedingung entstuende irgendwann eine Zeile mit beidem, und
       niemand wuesste mehr, welche Fassung gilt.                            */
    CONSTRAINT ck_rc_event_part_form CHECK (
        (is_public = 1 AND epoch IS NULL
            AND title_sealed IS NULL AND intro_sealed IS NULL
            AND config_sealed IS NULL AND layers_sealed IS NULL)
     OR (is_public = 0 AND epoch IS NOT NULL
            AND title IS NULL AND intro IS NULL
            AND config_json IS NULL AND layers_json IS NULL))
);
GO

CREATE INDEX ix_rc_event_part_page ON dbo.rc_event_part (page_id, sort_order);
GO

/* ---------------------------------------------------------------------------
   Formularfelder

   Sie liegen relational und NICHT im ConfigJson — dieselbe Entscheidung wie
   im Altbestand, und sie war richtig: nur so lassen sich Antworten pruefen,
   auflisten und einer Person zuordnen.

   Die Beschriftung ist Klartext. Sie steht auf dem Formular, das jeder sieht,
   der es ausfuellen soll; sie zu versiegeln waere derselbe Selbstbetrug wie
   bei oeffentlichen Teilen. Die ANTWORTEN sind etwas anderes.
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_event_field (
    seq             bigint IDENTITY(1,1) NOT NULL,
    id              uniqueidentifier     NOT NULL,
    part_id         uniqueidentifier     NOT NULL,
    sort_order      int                  NOT NULL,

    kind            nvarchar(16)         NOT NULL,
    label           nvarchar(300)        NOT NULL,
    help_text       nvarchar(400)        NULL,
    options_json    nvarchar(max)        NULL,

    is_required     bit                  NOT NULL CONSTRAINT df_rc_event_field_req DEFAULT 0,
    is_half_width   bit                  NOT NULL CONSTRAINT df_rc_event_field_half DEFAULT 0,

    /* none | name | contact. Ein Feld als `name` zu kennzeichnen ist das,
       was aus einer anonymen Einsendung eine Person macht, der man Zugang
       geben kann. Deshalb steht es hier und nicht in einer Beschreibung.    */
    identity_role   nvarchar(12)         NOT NULL CONSTRAINT df_rc_event_field_ident DEFAULT N'none',

    /* 12.9 — Die Klasse gehoert an das FELD, nicht an eine Beschreibung.
       normal | sensitive | special | secret. Vorgabe ist `special`: bei
       Anmeldungen ist Ernaehrung, Unvertraeglichkeit oder Konfession der
       Normalfall, nicht die Ausnahme. Wer weniger will, sagt es ausdruecklich
       — und trifft damit eine Entscheidung, statt in sie hineinzurutschen.  */
    data_class      nvarchar(12)         NOT NULL CONSTRAINT df_rc_event_field_class DEFAULT N'special',

    CONSTRAINT pk_rc_event_field PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_event_field_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_event_field_part FOREIGN KEY (part_id) REFERENCES dbo.rc_event_part (id),
    CONSTRAINT ck_rc_event_field_kind CHECK (kind IN (
        N'text', N'textarea', N'select', N'multiselect', N'checkbox',
        N'number', N'date', N'email', N'phone')),
    CONSTRAINT ck_rc_event_field_ident CHECK (identity_role IN (N'none', N'name', N'contact')),
    CONSTRAINT ck_rc_event_field_class CHECK (data_class IN
        (N'normal', N'sensitive', N'special', N'secret')),

    /* Eine Auswahl ohne Auswahlmoeglichkeiten ist ein Feld, das niemand
       ausfuellen kann. Das faellt sonst erst dem ersten Anmelder auf.       */
    CONSTRAINT ck_rc_event_field_options CHECK (
        kind NOT IN (N'select', N'multiselect') OR options_json IS NOT NULL)
);
GO

CREATE INDEX ix_rc_event_field_part ON dbo.rc_event_field (part_id, sort_order);
GO

/* ---------------------------------------------------------------------------
   Anmeldungen

   Hier hoert das Oeffentliche auf. Ein Formular kann jeder sehen; was jemand
   hineingeschrieben hat, ist IMMER versiegelt — auch bei einer voellig
   oeffentlichen Veranstaltung.
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_event_registration (
    seq             bigint IDENTITY(1,1) NOT NULL,
    id              uniqueidentifier     NOT NULL,
    event_id        uniqueidentifier     NOT NULL,
    part_id         uniqueidentifier     NOT NULL,

    /* Unter welcher Epoche des Bereichs die Werte liegen. */
    epoch           int                  NOT NULL,

    /* NULL heisst: ohne Konto eingesandt. Das ist der Normalfall bei einer
       oeffentlichen Veranstaltung und kein Mangel.                          */
    submitter_role_id uniqueidentifier   NULL,

    /* Nachweis fuer den, der ohne Konto eingesandt hat: nur SHA-256 liegt
       hier. Wer die Tabelle hat, kann die Anmeldung nicht aufrufen — nur
       wer den Beleg hat, den er beim Absenden bekommen hat.                 */
    claim_hash      binary(32)           NULL,

    submitted_at    datetimeoffset(7)    NOT NULL,

    /* 12.10 — Unter welchem Einwilligungstext eingesandt wurde. Ohne diesen
       Verweis liesse sich spaeter nicht sagen, wozu jemand ja gesagt hat —
       und ein geaenderter Text wuerde rueckwirkend fuer alle gelten.        */
    consent_text_id uniqueidentifier     NULL,

    /* 12.3 — Ruecknahme ist keine Loeschung der Zeile, sondern die
       Vernichtung der Werte. Die Zeile bleibt, damit die Zahlen stimmen;
       was drinstand, ist weg.                                               */
    withdrawn_at    datetimeoffset(7)    NULL,

    CONSTRAINT pk_rc_event_registration PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_event_registration_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_event_reg_event FOREIGN KEY (event_id) REFERENCES dbo.rc_event (id),
    CONSTRAINT fk_rc_event_reg_part FOREIGN KEY (part_id) REFERENCES dbo.rc_event_part (id),

    /* Entweder ein Konto oder ein Beleg — eine Anmeldung, die keinem von
       beiden gehoert, koennte niemand mehr zurueckziehen.                   */
    CONSTRAINT ck_rc_event_reg_owner CHECK (
        submitter_role_id IS NOT NULL OR claim_hash IS NOT NULL)
);
GO

CREATE INDEX ix_rc_event_reg_part ON dbo.rc_event_registration (part_id, submitted_at);
GO

CREATE TABLE dbo.rc_event_registration_value (
    seq              bigint IDENTITY(1,1) NOT NULL,
    registration_id  uniqueidentifier     NOT NULL,
    field_id         uniqueidentifier     NOT NULL,

    /* NULL nach der Ruecknahme: der Wert ist vernichtet, die Zeile bleibt
       als Grabstein stehen (12.3).                                          */
    value_sealed     varbinary(max)       NULL,

    CONSTRAINT pk_rc_event_reg_value PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_event_reg_value UNIQUE NONCLUSTERED (registration_id, field_id),
    CONSTRAINT fk_rc_event_reg_value_reg FOREIGN KEY (registration_id)
        REFERENCES dbo.rc_event_registration (id),
    CONSTRAINT fk_rc_event_reg_value_field FOREIGN KEY (field_id)
        REFERENCES dbo.rc_event_field (id)
);
GO

/* ---------------------------------------------------------------------------
   Anfuegend, nicht ueberschreibend

   Teile, Seiten und Felder sind ausgenommen: sie WERDEN bearbeitet, das ist
   ihr Zweck. Anmeldungen nicht — was jemand eingesandt hat, verschwindet
   nicht spurlos, sondern wird zurueckgenommen.
   --------------------------------------------------------------------------- */

CREATE TRIGGER dbo.tr_rc_event_registration_append
ON dbo.rc_event_registration
INSTEAD OF DELETE
AS
BEGIN
    SET NOCOUNT ON;
    THROW 50006, N'rc_event_registration ist anfuegend: Ruecknahme vernichtet die Werte, sie loescht keine Zeilen.', 1;
END;
GO

CREATE TRIGGER dbo.tr_rc_event_reg_value_append
ON dbo.rc_event_registration_value
INSTEAD OF DELETE
AS
BEGIN
    SET NOCOUNT ON;
    THROW 50006, N'rc_event_registration_value ist anfuegend: der Wert wird auf NULL gesetzt, die Zeile bleibt.', 1;
END;
GO

GO
PRINT '  OK   rc_0006_events';
GO

/* =========================================================================
   rc_0007_event_intake
   ========================================================================= */
/* ===========================================================================
   rc_0007_event_intake — der Annahmeschluessel einer Veranstaltung

   DAS PROBLEM. Wer sich zu einem Pfarrfest anmeldet, legt sich dafuer kein
   Konto an. Er hat also keinen Schluessel — und die Antworten sollen trotzdem
   nur die Vorbereitenden lesen koennen, der Betreiber nicht.

   DER NAHELIEGENDE WEG WAERE FALSCH. Man koennte die Antworten im Klartext
   schicken und den Server versiegeln lassen. Dann liegt zwar nichts im
   Klartext auf der Platte — aber der Server SIEHT den Klartext, und genau das
   ist die Zusage, die diese Plattform nicht brechen will.

   DIE LOESUNG. Jede Veranstaltung bekommt ein eigenes RSA-Paar:

     intake_public_key      — oeffentlich, wird MIT dem Formular ausgeliefert
     intake_private_sealed  — versiegelt unter dem Epochenschluessel des
                              Bereichs, also nur fuer die Vorbereitenden

   Der Browser des Anmelders wuerfelt einen Sitzungsschluessel, versiegelt die
   Antworten damit und verpackt den Schluessel unter dem oeffentlichen
   Annahmeschluessel. Der Server bekommt beides und kann keines von beiden
   oeffnen: den Sitzungsschluessel nicht, weil ihm der private Teil fehlt, und
   die Antworten nicht, weil ihm der Sitzungsschluessel fehlt.

   Es ist derselbe Baustein, mit dem eine Rolle einer anderen einen Schluessel
   weitergibt (RcCrypto.WrapKey). Kein zweiter Weg, Geheimnisse zu verpacken.
   =========================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

ALTER TABLE dbo.rc_event ADD
    /* SPKI DER, RSA-4096 OAEP. Oeffentlich — er wird verschickt.            */
    intake_public_key     varbinary(1024) NULL,

    /* Der private Teil, versiegelt unter dem Epochenschluessel des Bereichs.
       Wer keinen Epochenschluessel hat, hat auch diesen nicht — und damit
       keine Anmeldung.                                                       */
    intake_private_sealed varbinary(max)  NULL,

    /* Unter WELCHER Epoche. Ohne diese Angabe muesste man raten, und beim
       Epochenschnitt waere der Annahmeschluessel still unbrauchbar geworden. */
    intake_epoch          int             NULL;
GO

/* Entweder alle drei oder keines. Eine Veranstaltung mit oeffentlichem
   Annahmeschluessel, deren privater Teil fehlt, saehe aus, als koenne sie
   Anmeldungen annehmen — und niemand koennte sie je lesen. */
ALTER TABLE dbo.rc_event ADD CONSTRAINT ck_rc_event_intake CHECK (
    (intake_public_key IS NULL AND intake_private_sealed IS NULL AND intake_epoch IS NULL)
 OR (intake_public_key IS NOT NULL AND intake_private_sealed IS NOT NULL AND intake_epoch IS NOT NULL));
GO

/* ---------------------------------------------------------------------------
   Der verpackte Sitzungsschluessel je Anmeldung.

   Er liegt an der ANMELDUNG und nicht an der Veranstaltung: jede Einsendung
   bringt ihren eigenen mit. Ein gemeinsamer Schluessel fuer alle Anmeldungen
   waere ein einziger Punkt, an dem alles auf einmal auffliegt.
   --------------------------------------------------------------------------- */

ALTER TABLE dbo.rc_event_registration ADD
    session_key_wrapped varbinary(1024) NULL;
GO

/* Entweder unter dem Epochenschluessel des Bereichs versiegelt (dann hat ein
   Mitglied eingesandt und braucht keinen Umweg), oder unter dem
   Annahmeschluessel verpackt (dann kam es von aussen). Nie beides, nie keines
   — sonst wuesste beim Lesen niemand, welchen Weg er nehmen soll. */
ALTER TABLE dbo.rc_event_registration ADD CONSTRAINT ck_rc_event_reg_key CHECK (
    (submitter_role_id IS NOT NULL AND session_key_wrapped IS NULL)
 OR (session_key_wrapped IS NOT NULL));
GO

GO
PRINT '  OK   rc_0007_event_intake';
GO

/* =========================================================================
   rc_0008_parish
   ========================================================================= */
/* ===========================================================================
   rc_0008_parish — Pfarrei: Messen, Intentionen, Gaben

   Dieselbe Bauweise wie bei den Veranstaltungen, und aus denselben Gruenden:

     * Eine Pfarrei haengt an einem BEREICH. Von dort kommen Schluessel,
       Mitglieder, Zertifikate und Kette. Kein zweites Epochenmodell.

     * Was oeffentlich ist, liegt im Klartext. Der Messplan haengt am
       Schaukasten — ihn zu verschluesseln und den Schluessel mitzuliefern
       waere Theater.

   ---------------------------------------------------------------------------
   DIE INTENTION IST DER INTERESSANTE FALL, und der Altbestand hatte ihn
   bereits richtig (siehe _reference/backend/parish/Data/ParishIntention.cs):
   EINE Zeile traegt beides.

     public_text        — was im Plan steht: "in einer bestimmten Absicht"
     internal_sealed    — was wirklich gemeint ist
     donor_ref_sealed   — von wem

   Das ist kein Zufall, sondern der Alltag: eine Intention wird oeffentlich
   angekuendigt, aber wofuer und von wem sie gestiftet wurde, geht die Gemeinde
   nichts an. Bei den Veranstaltungen trennt die Sichtbarkeit ganze Abschnitte,
   hier trennt sie FELDER derselben Zeile.

   Deshalb steht hier auch keine ck-Bedingung "entweder oder": beides gehoert
   zusammen und ist gleichzeitig gueltig.

   ---------------------------------------------------------------------------
   GABEN sind Geld. 12.9 — die Klasse steht fest und nicht zur Wahl: ein Betrag
   mit Namen daneben ist ueberall eine besondere Kategorie. Er liegt deshalb
   IMMER versiegelt, auch wenn jemand meint, das sei uebertrieben.
   =========================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

/* ---------------------------------------------------------------------------
   Die Pfarrei
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_parish (
    seq         bigint IDENTITY(1,1) NOT NULL,
    id          uniqueidentifier     NOT NULL,

    /* Woher Schluessel, Mitglieder, Zertifikate und Kette kommen. */
    area_id     uniqueidentifier     NOT NULL,
    tenant_id   uniqueidentifier     NOT NULL,

    slug        nvarchar(80)         NOT NULL,
    name        nvarchar(200)        NOT NULL,
    location    nvarchar(200)        NULL,

    created_at  datetimeoffset(7)    NOT NULL,

    CONSTRAINT pk_rc_parish PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_parish_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT uq_rc_parish_slug UNIQUE NONCLUSTERED (tenant_id, slug),
    CONSTRAINT fk_rc_parish_area FOREIGN KEY (area_id) REFERENCES dbo.rc_area (id)
);
GO

/* Ein Bereich traegt hoechstens eine Pfarrei — dieselbe Ueberlegung wie bei
   den Veranstaltungen: zwei waeren zwei Oeffentlichkeiten hinter demselben
   Schluessel. */
CREATE UNIQUE INDEX uq_rc_parish_area ON dbo.rc_parish (area_id);
GO

/* ---------------------------------------------------------------------------
   Messen — der Plan. Oeffentlich, im Klartext.
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_mass (
    seq          bigint IDENTITY(1,1) NOT NULL,
    id           uniqueidentifier     NOT NULL,
    parish_id    uniqueidentifier     NOT NULL,

    starts_at    datetimeoffset(7)    NOT NULL,
    church       nvarchar(128)        NOT NULL,
    title        nvarchar(256)        NULL,
    note         nvarchar(512)        NULL,

    /* Eine Sammelmesse traegt mehrere Intentionen. Der Unterschied ist nicht
       kosmetisch: bei einer Einzelmesse gehoert die Intention dieser Messe,
       bei einer Sammelmesse teilen sich mehrere den Termin.                  */
    is_collective bit                 NOT NULL CONSTRAINT df_rc_mass_coll DEFAULT 0,

    duration_min int                  NULL,
    kind         nvarchar(80)         NULL,

    created_at   datetimeoffset(7)    NOT NULL,
    updated_at   datetimeoffset(7)    NOT NULL,

    CONSTRAINT pk_rc_mass PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_mass_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_mass_parish FOREIGN KEY (parish_id) REFERENCES dbo.rc_parish (id),
    CONSTRAINT ck_rc_mass_duration CHECK (duration_min IS NULL OR duration_min BETWEEN 1 AND 600)
);
GO

CREATE INDEX ix_rc_mass_when ON dbo.rc_mass (parish_id, starts_at);
GO

/* ---------------------------------------------------------------------------
   Intentionen — EINE Zeile, zwei Sichtbarkeiten
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_intention (
    seq              bigint IDENTITY(1,1) NOT NULL,
    id               uniqueidentifier     NOT NULL,
    parish_id        uniqueidentifier     NOT NULL,

    /* NULL heisst: noch keinem Termin zugeordnet. Das ist der Normalfall am
       Anfang — jemand stiftet eine Intention, der Termin kommt spaeter.      */
    mass_id          uniqueidentifier     NULL,

    /* Unter welcher Epoche des Bereichs die versiegelten Felder liegen. */
    epoch            int                  NOT NULL,

    /* Was im Plan steht. Klartext, oeffentlich — dafuer ist es da.           */
    public_text      nvarchar(512)        NOT NULL,

    /* Was wirklich gemeint ist, und von wem. Versiegelt unter dem
       Epochenschluessel des Bereichs. NULL ist erlaubt: nicht jede Intention
       hat einen internen Text, und nicht jede einen genannten Stifter.       */
    internal_sealed  varbinary(max)       NULL,
    donor_ref_sealed varbinary(max)       NULL,

    /* active | fulfilled | cancelled */
    status           nvarchar(16)         NOT NULL CONSTRAINT df_rc_intention_status DEFAULT N'active',

    created_at       datetimeoffset(7)    NOT NULL,
    updated_at       datetimeoffset(7)    NOT NULL,

    CONSTRAINT pk_rc_intention PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_intention_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_intention_parish FOREIGN KEY (parish_id) REFERENCES dbo.rc_parish (id),
    CONSTRAINT fk_rc_intention_mass FOREIGN KEY (mass_id) REFERENCES dbo.rc_mass (id),
    CONSTRAINT ck_rc_intention_status CHECK (status IN (N'active', N'fulfilled', N'cancelled'))
);
GO

CREATE INDEX ix_rc_intention_mass ON dbo.rc_intention (mass_id) WHERE mass_id IS NOT NULL;
GO

/* ---------------------------------------------------------------------------
   Gaben — Geld

   12.9: die Klasse steht FEST. Ein Betrag mit einem Namen daneben ist ueberall
   eine besondere Kategorie, und es gibt keinen Schalter, der das aufweicht.
   Der Betrag liegt deshalb versiegelt — nicht als Zahl, ueber die sich
   summieren liesse, sondern als Geheimtext.

   Das kostet etwas: eine Summe ueber alle Gaben laesst sich nicht in SQL
   bilden. Das ist der Preis und er ist bekannt — wer summieren will, holt die
   Zeilen und rechnet mit dem Schluessel in der Hand.
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_offering (
    seq              bigint IDENTITY(1,1) NOT NULL,
    id               uniqueidentifier     NOT NULL,
    parish_id        uniqueidentifier     NOT NULL,
    intention_id     uniqueidentifier     NULL,

    epoch            int                  NOT NULL,

    amount_sealed    varbinary(max)       NOT NULL,

    /* Die Waehrung bleibt Klartext: sie ist keine Auskunft ueber die Person,
       und ohne sie liesse sich ein Betrag nicht einmal darstellen.           */
    currency         nvarchar(3)          NOT NULL CONSTRAINT df_rc_offering_ccy DEFAULT N'PLN',

    donor_ref_sealed varbinary(max)       NULL,
    received_on      date                 NOT NULL,

    created_at       datetimeoffset(7)    NOT NULL,

    CONSTRAINT pk_rc_offering PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_offering_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_offering_parish FOREIGN KEY (parish_id) REFERENCES dbo.rc_parish (id),
    CONSTRAINT fk_rc_offering_intention FOREIGN KEY (intention_id) REFERENCES dbo.rc_intention (id),

    /* ISO-4217 hat drei Buchstaben. Eine Waehrung, die anders aussieht, ist
       ein Tippfehler — und ein Tippfehler in einer Waehrung bedeutet, dass
       zwei Betraege spaeter nicht mehr vergleichbar sind.                    */
    CONSTRAINT ck_rc_offering_ccy CHECK (currency LIKE N'[A-Z][A-Z][A-Z]')
);
GO

CREATE INDEX ix_rc_offering_intention ON dbo.rc_offering (intention_id) WHERE intention_id IS NOT NULL;
GO

/* ---------------------------------------------------------------------------
   Anfuegend, nicht ueberschreibend

   Gaben werden nicht geloescht. Wer eine Buchung zuruecknehmen will, bucht
   dagegen — das ist die Regel in jeder Kasse, und sie steht hier in der
   Datenbank statt in einer Handreichung.
   --------------------------------------------------------------------------- */

CREATE TRIGGER dbo.tr_rc_offering_append
ON dbo.rc_offering
INSTEAD OF DELETE, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    THROW 50006, N'rc_offering ist anfuegend: eine Buchung wird gegengebucht, nicht geaendert.', 1;
END;
GO

GO
PRINT '  OK   rc_0008_parish';
GO

/* =========================================================================
   rc_0009_graph
   ========================================================================= */
/* ===========================================================================
   rc_0009_graph — Cogita: der Wissensgraph

   Die Einsicht, auf der alles steht (cogita-graph.md §0): **alles Wissen ist
   ein Graph.** Vokabellisten, Begriffskarten, Zeitleisten, Telefonbuecher —
   alle sind Knoten mit Kanten dazwischen. Die Plattform liefert die Mechanik,
   das Schema bestimmt der Benutzer.

   ---------------------------------------------------------------------------
   DIE SPANNUNG, DIE DIESE FASSUNG AUFLOESEN MUSS.

   §5.2 verlangt: "All indexed fields searched" — Volltextsuche ueber alle
   Felder. Das setzt Klartext voraus. Ein Server kann nicht durchsuchen, was er
   nicht lesen kann; jede Form von durchsuchbarer Verschluesselung verraet
   etwas (Gleichheit, Haeufigkeit, Zugriffsmuster), und wer das verschweigt,
   verkauft Schutz, den es nicht gibt.

   Aufgeloest wird das nicht durch einen Trick, sondern durch eine ENTSCHEIDUNG
   je Bibliothek:

     is_public = 1  Inhalte liegen im Klartext. Der Server durchsucht sie.
                    Fuer Vokabeln, Periodensysteme, Zeitleisten — Wissen, das
                    ohnehin in jedem Lehrbuch steht.

     is_public = 0  Inhalte liegen versiegelt unter dem Epochenschluessel des
                    Bereichs. Der Server sieht Geheimtext. Gesucht wird im
                    BROWSER, ueber das, was der Leser ohnehin geladen hat.

   Die zweite Form skaliert schlechter — das ist der Preis und er steht hier,
   damit ihn niemand spaeter fuer einen Fehler haelt. Eine dritte Form, die
   beides koennte, gibt es nicht.

   ---------------------------------------------------------------------------
   EINE TABELLE FUER ALLE KNOTEN.

   EntityKind, EdgeKind, Range, Text, Zahl, Datum und jede vom Benutzer
   erfundene Art sind ALLE Knoten (§1.2, §1.10). Sie in getrennte Tabellen zu
   legen hiesse, bei jeder neuen Art eine Migration zu schreiben — und der
   ganze Punkt ist, dass der Benutzer neue Arten erfindet, ohne dass jemand
   etwas baut.

   Was in der Datenbank steht, ist deshalb duenn: Kennung, Art, Bibliothek,
   Inhalt. Was eine Art BEDEUTET, steht in einem Knoten derselben Tabelle.
   =========================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

/* ---------------------------------------------------------------------------
   Die Bibliothek
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_library (
    seq         bigint IDENTITY(1,1) NOT NULL,
    id          uniqueidentifier     NOT NULL,

    area_id     uniqueidentifier     NOT NULL,
    tenant_id   uniqueidentifier     NOT NULL,

    slug        nvarchar(80)         NOT NULL,
    title       nvarchar(200)        NOT NULL,

    /* Die Entscheidung von oben. Sie faellt beim Anlegen und laesst sich NICHT
       umlegen: aus oeffentlich privat zu machen hiesse, alles nachtraeglich zu
       verschluesseln — und die Klartextfassung waere trotzdem in der Welt.
       Umgekehrt muesste jeder Knoten neu geschrieben werden.                 */
    is_public   bit                  NOT NULL CONSTRAINT df_rc_library_public DEFAULT 0,

    created_at  datetimeoffset(7)    NOT NULL,

    CONSTRAINT pk_rc_library PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_library_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT uq_rc_library_slug UNIQUE NONCLUSTERED (tenant_id, slug),
    CONSTRAINT fk_rc_library_area FOREIGN KEY (area_id) REFERENCES dbo.rc_area (id)
);
GO

CREATE INDEX ix_rc_library_area ON dbo.rc_library (area_id);
GO

/* ---------------------------------------------------------------------------
   Knoten
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_node (
    seq          bigint IDENTITY(1,1) NOT NULL,
    id           uniqueidentifier     NOT NULL,
    library_id   uniqueidentifier     NOT NULL,

    /* Die ART. IMMER Klartext, auch in einer privaten Bibliothek.
       Sie ist Struktur, kein Inhalt: ohne sie liesse sich der Graph nicht
       einmal zeichnen, und sie verraet nur, DASS es eine Person gibt — nicht,
       wer. Genau dieselbe Ueberlegung wie bei den Teilen einer Veranstaltung.

       Eingebaut sind: text, number, date, boolean, media (§1.1) sowie die
       Systemarten entity_kind, edge_kind, range, knowledge, topic.
       Alles andere ist eine vom Benutzer erfundene Art und steht als Verweis
       auf einen entity_kind-Knoten in kind_node_id.                          */
    kind         nvarchar(40)         NOT NULL,

    /* Bei einer benutzerdefinierten Art: welcher entity_kind sie beschreibt.
       Er ist selbst ein Knoten — dieselbe Tabelle, dieselben Regeln (§1.2).  */
    kind_node_id uniqueidentifier     NULL,

    /* Oeffentliche Bibliothek: Klartext, vom Server durchsuchbar. */
    value        nvarchar(max)        NULL,

    /* Private Bibliothek: versiegelt unter dem Epochenschluessel. */
    value_sealed varbinary(max)       NULL,
    epoch        int                  NULL,

    created_at   datetimeoffset(7)    NOT NULL,
    updated_at   datetimeoffset(7)    NOT NULL,

    CONSTRAINT pk_rc_node PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_node_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_node_library FOREIGN KEY (library_id) REFERENCES dbo.rc_library (id),
    CONSTRAINT fk_rc_node_kind FOREIGN KEY (kind_node_id) REFERENCES dbo.rc_node (id),

    /* Entweder Klartext ODER versiegelt — nie beides, nie keines von beiden,
       wenn ueberhaupt ein Wert da ist. Ein Knoten ohne Wert ist erlaubt: eine
       Entitaet ist ein reiner Verbindungspunkt (§1.3).                       */
    CONSTRAINT ck_rc_node_form CHECK (
        (value IS NULL AND value_sealed IS NULL AND epoch IS NULL)
     OR (value IS NOT NULL AND value_sealed IS NULL AND epoch IS NULL)
     OR (value IS NULL AND value_sealed IS NOT NULL AND epoch IS NOT NULL)),

    /* Eine benutzerdefinierte Art verweist auf ihre Beschreibung, eine
       eingebaute nicht. Ohne diese Bedingung entstuende ein `text`-Knoten mit
       einem entity_kind daneben, und niemand wuesste, was gilt.              */
    CONSTRAINT ck_rc_node_kind CHECK (
        (kind = N'entity' AND kind_node_id IS NOT NULL)
     OR (kind <> N'entity' AND kind_node_id IS NULL)),

    CONSTRAINT ck_rc_node_builtin CHECK (kind IN (
        N'text', N'number', N'date', N'boolean', N'media',
        N'entity', N'entity_kind', N'edge_kind', N'range',
        N'knowledge', N'topic', N'question'))
);
GO

CREATE INDEX ix_rc_node_library ON dbo.rc_node (library_id, kind);
GO

/* Die Volltextsuche greift nur bei oeffentlichen Bibliotheken — dort liegt
   der Wert im Klartext. Ein gefilterter Index sagt genau das, und er sagt es
   der Datenbank, nicht nur dem Leser dieser Datei. */
CREATE INDEX ix_rc_node_search ON dbo.rc_node (library_id) WHERE value IS NOT NULL;
GO

/* ---------------------------------------------------------------------------
   Kanten

   §1.6 — Jede Kante von einer Entitaet zu einem Wert traegt eine Huelle:
   Zustand, Quelle, Notiz. Der Zustand ist der eigentliche Gewinn dieses
   Modells: "unbekannt" und "umstritten" sind ANGABEN, keine fehlenden Daten.
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_edge (
    seq            bigint IDENTITY(1,1) NOT NULL,
    id             uniqueidentifier     NOT NULL,
    library_id     uniqueidentifier     NOT NULL,

    from_node_id   uniqueidentifier     NOT NULL,
    to_node_id     uniqueidentifier     NOT NULL,

    /* Die Art der Beziehung. Entweder eingebaut (owner_of, depends_on) oder
       ein Verweis auf einen edge_kind-Knoten (§1.10).                        */
    kind           nvarchar(40)         NOT NULL,
    kind_node_id   uniqueidentifier     NULL,

    /* §1.6 — Der Zustand. `unknown` ist eine Aussage und kein fehlender Wert:
       "wir wissen es nicht" zu sagen ist etwas anderes, als nichts zu sagen. */
    state          nvarchar(16)         NOT NULL CONSTRAINT df_rc_edge_state DEFAULT N'known',

    /* Quelle und Notiz. Die Notiz folgt der Bibliothek: oeffentlich im
       Klartext, privat versiegelt.                                           */
    source_node_id uniqueidentifier     NULL,
    note           nvarchar(max)        NULL,
    note_sealed    varbinary(max)       NULL,
    epoch          int                  NULL,

    /* §1.7 — Mehrwertige Felder: dieselbe Art mehrfach von demselben Knoten.
       Die Reihenfolge ist die der Eingabe und traegt Bedeutung (§1.2: das
       erste Feld ist die Beschriftung).                                      */
    sort_order     int                  NOT NULL CONSTRAINT df_rc_edge_sort DEFAULT 0,

    created_at     datetimeoffset(7)    NOT NULL,

    CONSTRAINT pk_rc_edge PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_edge_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_edge_library FOREIGN KEY (library_id) REFERENCES dbo.rc_library (id),
    CONSTRAINT fk_rc_edge_from FOREIGN KEY (from_node_id) REFERENCES dbo.rc_node (id),
    CONSTRAINT fk_rc_edge_to FOREIGN KEY (to_node_id) REFERENCES dbo.rc_node (id),

    CONSTRAINT ck_rc_edge_state CHECK (state IN (
        N'known', N'approximate', N'disputed', N'unknown', N'not_applicable', N'pending')),

    CONSTRAINT ck_rc_edge_note CHECK (
        (note IS NULL AND note_sealed IS NULL AND epoch IS NULL)
     OR (note IS NOT NULL AND note_sealed IS NULL AND epoch IS NULL)
     OR (note IS NULL AND note_sealed IS NOT NULL AND epoch IS NOT NULL)),

    /* Eine Kante von einem Knoten auf sich selbst ist in einem Wissensgraphen
       fast immer ein Fehler beim Verknuepfen — und wenn sie es einmal nicht
       ist, laesst sie sich ueber einen Zwischenknoten ausdruecken.           */
    CONSTRAINT ck_rc_edge_loop CHECK (from_node_id <> to_node_id)
);
GO

CREATE INDEX ix_rc_edge_from ON dbo.rc_edge (from_node_id, kind, sort_order);
CREATE INDEX ix_rc_edge_to ON dbo.rc_edge (to_node_id, kind);
GO

/* ---------------------------------------------------------------------------
   §1.6a — Bereiche (Range)

   Ein Koenig, der 992–1000 und wieder 1002–1025 regierte, hat EINE Regierung
   mit ZWEI Abschnitten. Sie in zwei Kanten zu zerlegen hiesse, zwei
   Regierungen zu behaupten.
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_range_segment (
    seq         bigint IDENTITY(1,1) NOT NULL,
    range_node_id uniqueidentifier   NOT NULL,
    sort_order  int                  NOT NULL,

    /* Alle Abschnitte eines Bereichs tragen denselben Grundtyp — sonst liesse
       sich nicht vergleichen, was verglichen werden soll.                    */
    value_type  nvarchar(16)         NOT NULL,

    from_value  nvarchar(200)        NOT NULL,
    to_value    nvarchar(200)        NULL,

    from_state  nvarchar(16)         NOT NULL CONSTRAINT df_rc_seg_from DEFAULT N'inclusive',
    to_state    nvarchar(16)         NOT NULL CONSTRAINT df_rc_seg_to DEFAULT N'inclusive',

    CONSTRAINT pk_rc_range_segment PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_range_segment UNIQUE NONCLUSTERED (range_node_id, sort_order),
    CONSTRAINT fk_rc_range_segment_node FOREIGN KEY (range_node_id) REFERENCES dbo.rc_node (id),
    CONSTRAINT ck_rc_seg_type CHECK (value_type IN (N'date', N'number', N'text')),
    CONSTRAINT ck_rc_seg_from CHECK (from_state IN
        (N'inclusive', N'exclusive', N'approximate', N'unknown')),
    CONSTRAINT ck_rc_seg_to CHECK (to_state IN
        (N'inclusive', N'exclusive', N'approximate', N'open'))
);
GO

GO
PRINT '  OK   rc_0009_graph';
GO

/* =========================================================================
   rc_0010_calendar
   ========================================================================= */
/* ===========================================================================
   rc_0010_calendar — Kalender: Termine, Aufgaben, Wiederholungen

   ---------------------------------------------------------------------------
   DIE ENTSCHEIDUNG, DIE DIESEN KALENDER TRAEGT: ZEIT IST NICHT INHALT.

   Bei den Veranstaltungen trennt die Sichtbarkeit ganze Abschnitte, bei einer
   Messintention Felder derselben Zeile. Hier trennt sie etwas Drittes, und es
   ist das Wichtigste am ganzen Modul:

     WANN jemand belegt ist, liegt im Klartext.
     WOMIT er belegt ist, liegt versiegelt.

   Der Altbestand hatte das bereits (TitlePublic neben einem geschuetzten
   Datenelement) und es war richtig. Ein Kalender, der die Zeiten mitverschluesselt,
   kann drei Dinge nicht mehr:

     * freie Zeiten finden, ohne alles herunterzuladen und zu entschluesseln,
     * Ueberschneidungen melden, bevor jemand doppelt zusagt,
     * eine Wiederholung ausrechnen, ohne den Schluessel zu haben.

   Das ist kein Verlust an Schutz, sondern eine ehrliche Grenze: dass jemand
   Dienstag um zehn belegt ist, verraet ungleich weniger als wobei. Wer auch
   das verbergen will, legt den Termin in einen Kalender, den nur er sieht —
   dann sieht niemand die Zeit, weil niemand den Kalender sieht.

   ---------------------------------------------------------------------------
   DER OEFFENTLICHE TITEL IST EIN EIGENES FELD, KEINE KOPIE.

   `title_public` ist NICHT der entschluesselte Titel. Es ist das, was andere
   sehen duerfen — oft nichts (dann steht dort NULL und die Oberflaeche sagt
   „belegt"), manchmal „Sitzung", nie „Gespraech mit Frau K. wegen der
   Kuendigung". Beides in einem Feld zu fuehren hiesse, dass jede Anzeige
   entscheiden muss, wie viel sie verraet — und irgendeine entscheidet falsch.
   =========================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

/* ---------------------------------------------------------------------------
   Der Kalender
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_calendar (
    seq         bigint IDENTITY(1,1) NOT NULL,
    id          uniqueidentifier     NOT NULL,

    area_id     uniqueidentifier     NOT NULL,
    tenant_id   uniqueidentifier     NOT NULL,

    title       nvarchar(200)        NOT NULL,

    /* Die Zeitzone, in der dieser Kalender gedacht ist. Wiederholungen werden
       DARIN gerechnet, nicht in UTC: „jeden Montag um 9" bleibt sonst ueber
       die Sommerzeit hinweg nicht um 9. Der Fehler faellt genau zweimal im
       Jahr auf und wird jedes Mal fuer einen Zufall gehalten.                */
    time_zone   nvarchar(64)         NOT NULL CONSTRAINT df_rc_calendar_tz DEFAULT N'Europe/Warsaw',

    created_at  datetimeoffset(7)    NOT NULL,

    CONSTRAINT pk_rc_calendar PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_calendar_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_calendar_area FOREIGN KEY (area_id) REFERENCES dbo.rc_area (id)
);
GO

CREATE INDEX ix_rc_calendar_area ON dbo.rc_calendar (area_id);
GO

/* ---------------------------------------------------------------------------
   Termine und Aufgaben

   Ein Kalender haelt beides. Der Unterschied ist nicht kosmetisch: ein Termin
   hat einen Anfang und ein Ende, eine Aufgabe hat eine Frist und einen
   Zustand. Sie in zwei Tabellen zu legen hiesse, jede Ansicht zweimal zu
   bauen — und die haeufigste Frage („was steht heute an") betrifft beide.
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_calendar_item (
    seq             bigint IDENTITY(1,1) NOT NULL,
    id              uniqueidentifier     NOT NULL,
    calendar_id     uniqueidentifier     NOT NULL,
    owner_role_id   uniqueidentifier     NOT NULL,

    /* appointment | task */
    item_type       nvarchar(16)         NOT NULL CONSTRAINT df_rc_item_type DEFAULT N'appointment',

    /* ---- Klartext: WANN ------------------------------------------------- */

    starts_at       datetimeoffset(7)    NOT NULL,
    ends_at         datetimeoffset(7)    NOT NULL,
    all_day         bit                  NOT NULL CONSTRAINT df_rc_item_allday DEFAULT 0,

    /* Was andere sehen duerfen. NULL heisst: nur „belegt". */
    title_public    nvarchar(200)        NULL,

    /* private | area | public
       private — nur der Eigentuemer sieht den Eintrag ueberhaupt.
       area    — die Mitglieder des Bereichs sehen ihn.
       public  — auch ohne Konto sichtbar (dann NUR title_public).           */
    visibility      nvarchar(16)         NOT NULL CONSTRAINT df_rc_item_vis DEFAULT N'private',

    /* planned | confirmed | cancelled | completed */
    status          nvarchar(16)         NOT NULL CONSTRAINT df_rc_item_status DEFAULT N'planned',

    /* ---- Versiegelt: WOMIT ---------------------------------------------- */

    epoch           int                  NULL,
    title_sealed    varbinary(1024)      NULL,
    location_sealed varbinary(1024)      NULL,
    notes_sealed    varbinary(max)       NULL,

    /* ---- Wiederholung ---------------------------------------------------- */
    /* none | daily | weekly | monthly | yearly */

    repeat_kind     nvarchar(16)         NOT NULL CONSTRAINT df_rc_item_repeat DEFAULT N'none',
    repeat_every    int                  NOT NULL CONSTRAINT df_rc_item_every DEFAULT 1,

    /* Bei `weekly`: welche Wochentage, als Bitmaske Mo=1 .. So=64. Eine
       Zeichenkette waere bequemer zu lesen und schwerer zu pruefen.          */
    repeat_weekdays tinyint              NULL,

    /* Ein Ende ist PFLICHT bei einer Wiederholung — entweder ein Datum oder
       eine Anzahl. Eine Reihe ohne Ende laesst sich nicht ausrechnen, nur
       abschneiden, und jede Ansicht schneidet woanders ab.                   */
    repeat_until    datetimeoffset(7)    NULL,
    repeat_count    int                  NULL,

    /* ---- Aufgaben --------------------------------------------------------- */

    task_state      nvarchar(16)         NULL,   -- todo | doing | done | cancelled
    completed_at    datetimeoffset(7)    NULL,

    created_at      datetimeoffset(7)    NOT NULL,
    updated_at      datetimeoffset(7)    NOT NULL,

    CONSTRAINT pk_rc_calendar_item PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_calendar_item_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_item_calendar FOREIGN KEY (calendar_id) REFERENCES dbo.rc_calendar (id),

    CONSTRAINT ck_rc_item_type CHECK (item_type IN (N'appointment', N'task')),
    CONSTRAINT ck_rc_item_vis CHECK (visibility IN (N'private', N'area', N'public')),
    CONSTRAINT ck_rc_item_status CHECK (status IN
        (N'planned', N'confirmed', N'cancelled', N'completed')),
    CONSTRAINT ck_rc_item_repeat CHECK (repeat_kind IN
        (N'none', N'daily', N'weekly', N'monthly', N'yearly')),

    /* Ein Termin, der vor seinem Anfang endet, ist keine Eingabe, sondern ein
       Fehler — und er faellt sonst erst in der Wochenansicht auf.            */
    CONSTRAINT ck_rc_item_span CHECK (ends_at >= starts_at),

    CONSTRAINT ck_rc_item_every CHECK (repeat_every BETWEEN 1 AND 366),

    /* Eine Wiederholung braucht ein Ende. Genau eines von beiden. */
    CONSTRAINT ck_rc_item_repeat_end CHECK (
        repeat_kind = N'none'
     OR (repeat_until IS NOT NULL AND repeat_count IS NULL)
     OR (repeat_until IS NULL AND repeat_count IS NOT NULL)),

    /* Wochentage gehoeren zu `weekly` und sonst nirgendwohin. */
    CONSTRAINT ck_rc_item_weekdays CHECK (
        (repeat_kind = N'weekly' AND repeat_weekdays IS NOT NULL AND repeat_weekdays BETWEEN 1 AND 127)
     OR (repeat_kind <> N'weekly' AND repeat_weekdays IS NULL)),

    /* Ein Zustand gehoert zu einer Aufgabe und sonst nirgendwohin. */
    CONSTRAINT ck_rc_item_task CHECK (
        (item_type = N'task' AND task_state IN (N'todo', N'doing', N'done', N'cancelled'))
     OR (item_type = N'appointment' AND task_state IS NULL)),

    /* Versiegeltes braucht eine Epoche, und eine Epoche braucht Versiegeltes. */
    CONSTRAINT ck_rc_item_sealed CHECK (
        (epoch IS NULL AND title_sealed IS NULL AND location_sealed IS NULL AND notes_sealed IS NULL)
     OR (epoch IS NOT NULL))
);
GO

/* Die haeufigste Frage ist „was steht in diesem Zeitraum an". Sie laeuft
   ueber Kalender und Zeit — und weil die Zeiten im Klartext liegen, kann die
   Datenbank sie beantworten, ohne irgendetwas zu entschluesseln. Genau das
   ist der Gewinn der Trennung oben. */
CREATE INDEX ix_rc_item_when ON dbo.rc_calendar_item (calendar_id, starts_at, ends_at);
GO

CREATE INDEX ix_rc_item_owner ON dbo.rc_calendar_item (owner_role_id, starts_at);
GO

/* ---------------------------------------------------------------------------
   Ausnahmen einer Reihe

   Eine Wiederholung, bei der ein einzelner Termin verschoben oder abgesagt
   wird, ist der Normalfall und kein Sonderfall. Die Reihe deswegen
   aufzuloesen — jeden Termin einzeln zu schreiben — hiesse, die Regel zu
   verlieren: „jeden Montag" waere danach nicht mehr aenderbar, nur noch
   fuenfzig einzelne Zeilen.
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_calendar_exception (
    seq            bigint IDENTITY(1,1) NOT NULL,
    item_id        uniqueidentifier     NOT NULL,

    /* Welches Vorkommen gemeint ist: der urspruengliche Anfang. */
    occurrence_at  datetimeoffset(7)    NOT NULL,

    /* cancelled | moved */
    kind           nvarchar(16)         NOT NULL,

    /* Bei `moved`: wohin. */
    new_starts_at  datetimeoffset(7)    NULL,
    new_ends_at    datetimeoffset(7)    NULL,

    created_at     datetimeoffset(7)    NOT NULL,

    CONSTRAINT pk_rc_calendar_exception PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_calendar_exception UNIQUE NONCLUSTERED (item_id, occurrence_at),
    CONSTRAINT fk_rc_exception_item FOREIGN KEY (item_id) REFERENCES dbo.rc_calendar_item (id),
    CONSTRAINT ck_rc_exception_kind CHECK (kind IN (N'cancelled', N'moved')),
    CONSTRAINT ck_rc_exception_moved CHECK (
        (kind = N'cancelled' AND new_starts_at IS NULL AND new_ends_at IS NULL)
     OR (kind = N'moved' AND new_starts_at IS NOT NULL AND new_ends_at IS NOT NULL
         AND new_ends_at >= new_starts_at))
);
GO

GO
PRINT '  OK   rc_0010_calendar';
GO

/* =========================================================================
   rc_0011_confirmation
   ========================================================================= */
/* ===========================================================================
   rc_0011_confirmation — Firmung: Jahrgang, Kandidaten, Treffen

   ---------------------------------------------------------------------------
   DIES IST DER EMPFINDLICHSTE TEIL DER GANZEN PLATTFORM.

   Firmkandidaten sind Minderjaehrige. Was hier steht — Name, Geburtsdatum,
   Eltern, Schule, Taufpfarrei, dazu Notizen des Katecheten — ist besondere
   Kategorie nach 12.9, und zwar ohne Abwaegung: Religionszugehoerigkeit ist
   es per Definition, und alles andere haengt daran.

   DREI DINGE AUS DEM ALTBESTAND WERDEN DABEI AUSDRUECKLICH NICHT UEBERNOMMEN.

   1. `ParishConfirmationNote.NoteText` lag im KLARTEXT in der Spalte, mit
      einem Schalter `IsPublic` daneben. Eine Notiz ueber ein Kind, unter
      seinem Namen, lesbar fuer jeden mit Datenbankzugriff. Hier liegt sie
      versiegelt — und der Schalter bleibt, weil die Unterscheidung richtig
      ist: was die Eltern sehen duerfen, ist etwas anderes als was der
      Katechet sich notiert.

   2. `HostInviteToken` und `VerificationToken` waren rohe Zeichenketten in
      der Zeile. Wer die Tabelle hatte, hatte die Token. Hier gibt es keinen
      zweiten Token-Baustein: rc_token traegt auch diese (10.3.1), und
      gespeichert wird nur der Abdruck.

   3. `PayloadEnc` war EIN verschluesselter Klumpen fuer alles. Das ist
      bequem und verliert die Feldnamen aus 3.13: wer Schreibzugriff hat,
      kann den Klumpen als Ganzes tauschen, und niemand merkt es. Hier
      traegt jedes Feld sein eigenes Etikett.

   ---------------------------------------------------------------------------
   WAS IM KLARTEXT BLEIBT, UND WARUM.

   Die Ablaufmerker (Einwilligung da, Papier da, Quiz bestanden) sind
   Klartext. Sie sind keine Auskunft ueber die Person, sondern ueber den
   Vorgang — und ohne sie liesse sich nicht einmal zaehlen, wie viele noch
   etwas abgeben muessen, ohne jeden Datensatz zu entschluesseln.

   Die ZEITEN der Treffen sind Klartext, aus demselben Grund wie im Kalender:
   freie Plaetze zaehlen, Ueberschneidungen sehen, Reihen ausrechnen.
   =========================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

/* ---------------------------------------------------------------------------
   Der Jahrgang
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_confirmation_group (
    seq         bigint IDENTITY(1,1) NOT NULL,
    id          uniqueidentifier     NOT NULL,

    parish_id   uniqueidentifier     NOT NULL,

    /* Woher Schluessel, Mitglieder und Zertifikate kommen. Ein EIGENER
       Bereich, nicht der der Pfarrei: wer den Messplan pflegt, hat damit
       nicht auch Zugriff auf die Akten der Kinder. Das ist der ganze Sinn
       davon, dass ein Bereich die Einheit der Sichtbarkeit ist.            */
    area_id     uniqueidentifier     NOT NULL,

    name        nvarchar(120)        NOT NULL,   -- "Firmung 2027"
    starts_on   date                 NULL,
    ends_on     date                 NULL,

    /* preparing | running | closed */
    lifecycle   nvarchar(16)         NOT NULL CONSTRAINT df_rc_conf_life DEFAULT N'preparing',

    created_at  datetimeoffset(7)    NOT NULL,

    CONSTRAINT pk_rc_confirmation_group PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_confirmation_group_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_conf_parish FOREIGN KEY (parish_id) REFERENCES dbo.rc_parish (id),
    CONSTRAINT fk_rc_conf_area FOREIGN KEY (area_id) REFERENCES dbo.rc_area (id),
    CONSTRAINT ck_rc_conf_life CHECK (lifecycle IN (N'preparing', N'running', N'closed')),
    CONSTRAINT ck_rc_conf_span CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on)
);
GO

CREATE UNIQUE INDEX uq_rc_conf_area ON dbo.rc_confirmation_group (area_id);
GO

/* ---------------------------------------------------------------------------
   Kandidaten

   Jedes Feld traegt sein eigenes Etikett (3.13). Der Altbestand hatte einen
   Klumpen; damit laesst sich der Klumpen eines Kindes gegen den eines anderen
   tauschen, ohne dass etwas auffaellt.
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_candidate (
    seq                bigint IDENTITY(1,1) NOT NULL,
    id                 uniqueidentifier     NOT NULL,
    group_id           uniqueidentifier     NOT NULL,

    epoch              int                  NOT NULL,

    /* Alles Personenbezogene liegt versiegelt, jedes Feld fuer sich. */
    name_sealed        varbinary(1024)      NOT NULL,
    born_sealed        varbinary(512)       NULL,
    contact_sealed     varbinary(2048)      NULL,   -- Telefon, E-Mail der Eltern
    school_sealed      varbinary(1024)      NULL,
    baptism_sealed     varbinary(1024)      NULL,   -- Taufpfarrei, Taufdatum

    /* ---- Ablaufmerker: Klartext, weil sie den VORGANG betreffen --------- */
    /*
       Ohne sie liesse sich nicht zaehlen, wer noch etwas abgeben muss, ohne
       jeden Datensatz zu entschluesseln. Sie sagen nichts ueber die Person —
       nur darueber, was noch fehlt.
    */
    consent_given      bit                  NOT NULL CONSTRAINT df_rc_cand_consent DEFAULT 0,
    paper_received     bit                  NOT NULL CONSTRAINT df_rc_cand_paper DEFAULT 0,
    quiz_passed        bit                  NOT NULL CONSTRAINT df_rc_cand_quiz DEFAULT 0,

    /* 12.10 — Unter welchem Einwilligungstext aufgenommen wurde. Ohne diesen
       Verweis liesse sich spaeter nicht sagen, wozu jemand ja gesagt hat.   */
    consent_text_id    uniqueidentifier     NULL,

    /* enrolled | withdrawn | confirmed */
    status             nvarchar(16)         NOT NULL CONSTRAINT df_rc_cand_status DEFAULT N'enrolled',

    /* 12.3 — Austritt vernichtet die Felder, laesst die Zeile stehen. Sonst
       stimmten die Zahlen des Jahrgangs nicht mehr.                        */
    withdrawn_at       datetimeoffset(7)    NULL,

    created_at         datetimeoffset(7)    NOT NULL,
    updated_at         datetimeoffset(7)    NOT NULL,

    CONSTRAINT pk_rc_candidate PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_candidate_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_candidate_group FOREIGN KEY (group_id) REFERENCES dbo.rc_confirmation_group (id),
    CONSTRAINT ck_rc_cand_status CHECK (status IN (N'enrolled', N'withdrawn', N'confirmed')),

    /* Ein ausgetretener Kandidat hat kein Datum? Dann ist er nicht
       ausgetreten. Der Merker und das Datum gehoeren zusammen.             */
    CONSTRAINT ck_rc_cand_withdrawn CHECK (
        (status = N'withdrawn' AND withdrawn_at IS NOT NULL)
     OR (status <> N'withdrawn' AND withdrawn_at IS NULL))
);
GO

CREATE INDEX ix_rc_candidate_group ON dbo.rc_candidate (group_id, status);
GO

/* ---------------------------------------------------------------------------
   Notizen

   Der Altbestand hatte sie im Klartext. Hier nicht — und die Unterscheidung
   oeffentlich/intern bleibt, weil sie richtig ist: was die Eltern sehen
   duerfen, ist etwas anderes als was der Katechet sich notiert.

   Beide liegen versiegelt. „Oeffentlich" heisst hier nicht „unverschluesselt",
   sondern „auch fuer die Familie sichtbar" — anders als beim Messplan, wo
   oeffentlich wirklich am Schaukasten haengt.
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_candidate_note (
    seq            bigint IDENTITY(1,1) NOT NULL,
    id             uniqueidentifier     NOT NULL,
    candidate_id   uniqueidentifier     NOT NULL,
    author_role_id uniqueidentifier     NOT NULL,

    epoch          int                  NOT NULL,
    text_sealed    varbinary(max)       NOT NULL,

    /* Sichtbar auch fuer die Familie? */
    for_family     bit                  NOT NULL CONSTRAINT df_rc_note_family DEFAULT 0,

    created_at     datetimeoffset(7)    NOT NULL,

    CONSTRAINT pk_rc_candidate_note PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_candidate_note_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_note_candidate FOREIGN KEY (candidate_id) REFERENCES dbo.rc_candidate (id)
);
GO

CREATE INDEX ix_rc_note_candidate ON dbo.rc_candidate_note (candidate_id, created_at);
GO

/* ---------------------------------------------------------------------------
   Treffen

   Die ZEIT ist Klartext, wie im Kalender: freie Plaetze zaehlen und
   Ueberschneidungen sehen geht sonst nicht ohne Schluessel. Was BESPROCHEN
   wird, ist etwas anderes und liegt versiegelt.
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_meeting_slot (
    seq          bigint IDENTITY(1,1) NOT NULL,
    id           uniqueidentifier     NOT NULL,
    group_id     uniqueidentifier     NOT NULL,

    starts_at    datetimeoffset(7)    NOT NULL,
    duration_min int                  NOT NULL CONSTRAINT df_rc_slot_dur DEFAULT 60,

    /* Wie viele Plaetze. Klartext — es ist eine Zahl ueber den Vorgang. */
    capacity     int                  NOT NULL CONSTRAINT df_rc_slot_cap DEFAULT 1,

    /* Was dransteht, wenn sich jemand eintraegt: "Gespraech", "Gruppe A".
       Klartext, weil es auf dem Aushang steht.                             */
    label        nvarchar(120)        NULL,

    /* In welchem Abschnitt der Vorbereitung. */
    stage        nvarchar(32)         NOT NULL CONSTRAINT df_rc_slot_stage DEFAULT N'year1',

    is_open      bit                  NOT NULL CONSTRAINT df_rc_slot_open DEFAULT 1,

    created_at   datetimeoffset(7)    NOT NULL,

    CONSTRAINT pk_rc_meeting_slot PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_meeting_slot_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_slot_group FOREIGN KEY (group_id) REFERENCES dbo.rc_confirmation_group (id),
    CONSTRAINT ck_rc_slot_cap CHECK (capacity BETWEEN 1 AND 500),
    CONSTRAINT ck_rc_slot_dur CHECK (duration_min BETWEEN 5 AND 600)
);
GO

CREATE INDEX ix_rc_slot_when ON dbo.rc_meeting_slot (group_id, starts_at);
GO

/* ---------------------------------------------------------------------------
   Anmeldungen zu einem Treffen

   Die Kapazitaet wird von der DATENBANK durchgesetzt, nicht vom Code: zwei
   gleichzeitige Anmeldungen auf den letzten Platz sind der Normalfall, und
   eine Pruefung im Code davor ist genau dann falsch, wenn es darauf ankommt.
   Der eindeutige Index verhindert die Doppelbuchung derselben Person; die
   Zaehlung laeuft in einer serialisierbaren Transaktion.
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_meeting_booking (
    seq          bigint IDENTITY(1,1) NOT NULL,
    id           uniqueidentifier     NOT NULL,
    slot_id      uniqueidentifier     NOT NULL,
    candidate_id uniqueidentifier     NOT NULL,

    booked_at    datetimeoffset(7)    NOT NULL,
    attended     bit                  NULL,       -- NULL = noch nicht gewesen

    CONSTRAINT pk_rc_meeting_booking PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_meeting_booking_id UNIQUE NONCLUSTERED (id),

    /* Ein Kandidat, ein Platz je Treffen. */
    CONSTRAINT uq_rc_booking_pair UNIQUE NONCLUSTERED (slot_id, candidate_id),

    CONSTRAINT fk_rc_booking_slot FOREIGN KEY (slot_id) REFERENCES dbo.rc_meeting_slot (id),
    CONSTRAINT fk_rc_booking_candidate FOREIGN KEY (candidate_id) REFERENCES dbo.rc_candidate (id)
);
GO

CREATE INDEX ix_rc_booking_slot ON dbo.rc_meeting_booking (slot_id);
GO

/* ---------------------------------------------------------------------------
   Anfuegend

   Notizen ueber ein Kind werden nicht still geloescht. Wer eine zurueckziehen
   will, schreibt eine neue — dieselbe Regel wie bei Nachrichten, und aus
   demselben Grund: eine Akte, aus der sich lautlos etwas entfernen laesst,
   ist keine Akte.
   --------------------------------------------------------------------------- */

CREATE TRIGGER dbo.tr_rc_candidate_note_append
ON dbo.rc_candidate_note
INSTEAD OF DELETE, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    THROW 50006, N'rc_candidate_note ist anfuegend: eine Notiz wird ergaenzt, nicht geaendert.', 1;
END;
GO

GO
PRINT '  OK   rc_0011_confirmation';
GO

/* =========================================================================
   rc_0012_resource
   ========================================================================= */
/* ===========================================================================
   rc_0012_resource — Belegung: Haus, Zimmer, Pfarrsaal

   ---------------------------------------------------------------------------
   WARUM DAS KEIN KALENDER IST.

   Ein Kalendereintrag beantwortet „wann ist dieser MENSCH belegt". Die
   Belegung beantwortet „ist diese SACHE frei". Der Eigentuemer ist ein anderer
   (eine Rolle gegen ein Zimmer), die Frage ist eine andere, und vor allem ist
   die oeffentliche Projektion eine andere: beim Kalender ist die Vorgabe
   privat, hier ist sie oeffentlich. Ein Haus, dessen freie Zeitraeume niemand
   sehen darf, laesst sich nicht vermieten.

   Geteilt wird die Rechnerei — Ueberschneidungen, Zeitzonen, Wiederholungen —,
   nicht das Modell. `RcRecurrence` bleibt der eine Ort, an dem eine Reihe
   ausgerechnet wird.

   ---------------------------------------------------------------------------
   DIE REGEL DES MODULS.

   Die ZEIT liegt im Klartext, alles andere nicht. Dieselbe Entscheidung wie im
   Kalender (`title_public` offen, `title_sealed` versiegelt), hier auf Raeume
   angewandt: wer fragt, erfaehrt, ob der Juli frei ist — nicht, wer im Juli
   kommt. Deshalb gibt es in `rc_resource_hold` KEINE Spalte fuer die Gruppe.
   Nicht leer gelassen, sondern nicht vorhanden: eine Spalte, die es gibt,
   wird irgendwann gefuellt, und dann steht der Name der Firmgruppe im
   oeffentlichen Belegungsplan.

   ---------------------------------------------------------------------------
   DREI ZUSTAENDE, UND DER MITTLERE IST DER WICHTIGE.

       frei  ->  vorgemerkt (laeuft ab)  ->  bestaetigt

   Ohne den vorgemerkten Zustand MIT Ablauf bekommen zwei Gruppen dieselbe
   Juliwoche als frei gemeldet. Der Ablauf steht in der Zeile und wird in der
   Abfrage durchgesetzt, nicht von einem Aufraeumlauf: ein Vormerk, der nur
   deshalb noch gilt, weil ein Dienst gerade nicht laeuft, ist kein Vormerk.

   „Frei" ist die ABWESENHEIT einer Zeile. Freie Tage zu speichern hiesse, fuer
   jedes Haus bis in alle Zukunft Zeilen anzulegen.
   =========================================================================== */

CREATE TABLE dbo.rc_resource
(
    id                    uniqueidentifier NOT NULL CONSTRAINT pk_rc_resource PRIMARY KEY,

    /* Wie jedes Modul haengt auch dieses an einem Bereich. Kein eigener
       Schluesselhaushalt, keine eigenen Epochen, keine eigene Kette. */
    area_id               uniqueidentifier NOT NULL,

    /* Der Teil der Adresse nach dem Modulnamen: /osrodek, spaeter
       /parafia/<slug>/sala. Klein geschrieben und ohne Leerzeichen. */
    slug                  nvarchar(64)     NOT NULL,
    title                 nvarchar(200)    NOT NULL,

    /* Die Zeitzone des HAUSES, nicht des Lesers. Ein Zeitraum wird nach
       Naechten belegt; welcher Tag gemeint ist, entscheidet der Ort. */
    time_zone             nvarchar(64)     NOT NULL CONSTRAINT df_rc_resource_tz DEFAULT N'Europe/Warsaw',

    capacity              int              NULL,

    /* Ob die Frei-belegt-Auskunft ohne Konto lesbar ist. Fuer das Haus ja;
       fuer einen Pfarrsaal kann die Antwort anders ausfallen. */
    is_public             bit              NOT NULL CONSTRAINT df_rc_resource_public DEFAULT 1,

    /* Der Annahmeschluessel — derselbe Bau wie bei den Veranstaltungen
       (rc_0007). Eine Gruppe, die anfragt, haelt keinen Epochenschluessel;
       sie verschluesselt gegen den oeffentlichen Teil, und nur wer den
       privaten haelt, liest die Anfrage. */
    intake_public_key     varbinary(1024)  NULL,
    intake_private_sealed varbinary(max)   NULL,
    intake_epoch          int              NULL,

    created_at            datetimeoffset(7) NOT NULL,

    CONSTRAINT uq_rc_resource_slug UNIQUE (slug),
    CONSTRAINT fk_rc_resource_area FOREIGN KEY (area_id) REFERENCES dbo.rc_area (id),

    CONSTRAINT ck_rc_resource_slug CHECK (
        LEN(slug) BETWEEN 2 AND 64 AND slug NOT LIKE '%[^a-z0-9-]%'),

    CONSTRAINT ck_rc_resource_capacity CHECK (capacity IS NULL OR capacity > 0),

    /* Entweder ganz oder gar nicht — ein oeffentlicher Schluessel ohne den
       privaten nimmt Anfragen entgegen, die niemand mehr oeffnet. */
    CONSTRAINT ck_rc_resource_intake CHECK (
        (intake_public_key IS NULL AND intake_private_sealed IS NULL AND intake_epoch IS NULL)
     OR (intake_public_key IS NOT NULL AND intake_private_sealed IS NOT NULL AND intake_epoch IS NOT NULL))
);
GO

CREATE INDEX ix_rc_resource_area ON dbo.rc_resource (area_id);
GO

/* ---------------------------------------------------------------------------
   Belegte Zeitraeume
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_resource_hold
(
    id          uniqueidentifier NOT NULL CONSTRAINT pk_rc_resource_hold PRIMARY KEY,
    resource_id uniqueidentifier NOT NULL,

    /* Tage, keine Zeitpunkte. Ein Haus wird nach Naechten belegt, und eine
       Uhrzeit waere eine Genauigkeit, die es nicht gibt. Beide Raender
       gehoeren dazu: „vom 10. bis 14." schliesst den 14. ein. */
    from_date   date             NOT NULL,
    to_date     date             NOT NULL,

    state       nvarchar(16)     NOT NULL,

    /* Nur fuer Vormerkungen. Ein bestaetigter Zeitraum laeuft nicht ab. */
    expires_at  datetimeoffset(7) NULL,

    /* Woher der Zeitraum kommt — eine Anfrage oder die Hand des Hausherrn.
       Bewusst NUR eine Kennung und kein Name: die Zeile wird oeffentlich
       projiziert, und was hier steht, kann irgendwann mitgezeigt werden. */
    enquiry_id  uniqueidentifier NULL,

    created_at  datetimeoffset(7) NOT NULL,
    updated_at  datetimeoffset(7) NOT NULL,

    CONSTRAINT fk_rc_hold_resource FOREIGN KEY (resource_id) REFERENCES dbo.rc_resource (id),

    CONSTRAINT ck_rc_hold_state CHECK (state IN (N'held', N'confirmed')),

    /* Rueckwaerts laufende Zeitraeume gibt es nicht. */
    CONSTRAINT ck_rc_hold_order CHECK (from_date <= to_date),

    /* Der Kern des Zustandsmodells, in einer Bedingung: eine Vormerkung OHNE
       Ablauf waere eine stille Dauerbelegung, und ein bestaetigter Zeitraum
       MIT Ablauf verschwaende ohne Vorwarnung. */
    CONSTRAINT ck_rc_hold_expiry CHECK (
        (state = N'held'      AND expires_at IS NOT NULL)
     OR (state = N'confirmed' AND expires_at IS NULL))
);
GO

CREATE INDEX ix_rc_hold_resource_span ON dbo.rc_resource_hold (resource_id, from_date, to_date);
GO

/* ---------------------------------------------------------------------------
   Anfragen

   Offen eingesandt, versiegelt abgelegt. Die Zeitangaben bleiben Klartext —
   ohne sie liesse sich eine Anfrage keinem Zeitraum zuordnen, und der
   Hausherr muesste jede einzelne oeffnen, um zu wissen, ob sie ihn angeht.
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_enquiry
(
    id                    uniqueidentifier NOT NULL CONSTRAINT pk_rc_enquiry PRIMARY KEY,
    resource_id           uniqueidentifier NOT NULL,

    from_date             date             NOT NULL,
    to_date               date             NOT NULL,
    people                int              NULL,

    /* Der Sitzungsschluessel, verpackt gegen den Annahmeschluessel. */
    session_key_wrapped   varbinary(max)   NOT NULL,

    /* Je Feld ein eigener Geheimtext mit eigenem Etikett (3.13). Ein einziger
       Klumpen liesse sich als Ganzes gegen den einer anderen Anfrage
       tauschen, ohne dass etwas auffaellt. */
    group_name_sealed     varbinary(max)   NOT NULL,
    contact_person_sealed varbinary(max)   NULL,
    contact_sealed        varbinary(max)   NOT NULL,
    group_kind_sealed     varbinary(max)   NULL,
    note_sealed           varbinary(max)   NULL,

    state                 nvarchar(16)     NOT NULL CONSTRAINT df_rc_enquiry_state DEFAULT N'new',
    received_at           datetimeoffset(7) NOT NULL,

    CONSTRAINT fk_rc_enquiry_resource FOREIGN KEY (resource_id) REFERENCES dbo.rc_resource (id),
    CONSTRAINT ck_rc_enquiry_state CHECK (state IN (N'new', N'answered', N'declined')),
    CONSTRAINT ck_rc_enquiry_order CHECK (from_date <= to_date),
    CONSTRAINT ck_rc_enquiry_people CHECK (people IS NULL OR people > 0)
);
GO

CREATE INDEX ix_rc_enquiry_resource ON dbo.rc_enquiry (resource_id, received_at DESC);
GO

ALTER TABLE dbo.rc_resource_hold
    ADD CONSTRAINT fk_rc_hold_enquiry FOREIGN KEY (enquiry_id) REFERENCES dbo.rc_enquiry (id);
GO

/* ---------------------------------------------------------------------------
   Anfuegend

   Der INHALT einer Anfrage wird nicht geaendert. Wer sie beantwortet, aendert
   ihren Zustand — was jemand geschrieben hat, bleibt stehen. Eine Anfrage, aus
   der sich nachtraeglich ein Satz entfernen laesst, ist kein Beleg mehr.

   Der Zustand ist ausdruecklich ausgenommen: er ist Bearbeitung, kein Inhalt.
   --------------------------------------------------------------------------- */

CREATE TRIGGER dbo.tr_rc_enquiry_append
ON dbo.rc_enquiry
INSTEAD OF DELETE, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM deleted)
        AND NOT EXISTS (SELECT 1 FROM inserted)
        THROW 50012, N'rc_enquiry ist anfuegend: eine Anfrage wird nicht geloescht.', 1;

    /* Nur der Zustand darf sich bewegen. Jede andere Spalte, die sich
       unterscheidet, bricht ab.

       INTERSECT und nicht eine Kette von `<>`: es vergleicht alle Spalten auf
       einmal, BYTEGENAU und mit NULL als vergleichbarem Wert. Der erste Anlauf
       verglich `DATALENGTH` der Geheimtexte — und liess damit genau das durch,
       was er verhindern sollte: ein Byte gegen ein anderes derselben Laenge zu
       tauschen. Die Probe hat es gefunden, das Auge nicht. */
    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN deleted d ON d.id = i.id
        WHERE NOT EXISTS (
            SELECT i.resource_id, i.from_date, i.to_date, i.people, i.received_at,
                   i.session_key_wrapped, i.group_name_sealed, i.contact_person_sealed,
                   i.contact_sealed, i.group_kind_sealed, i.note_sealed
            INTERSECT
            SELECT d.resource_id, d.from_date, d.to_date, d.people, d.received_at,
                   d.session_key_wrapped, d.group_name_sealed, d.contact_person_sealed,
                   d.contact_sealed, d.group_kind_sealed, d.note_sealed))
        THROW 50012, N'rc_enquiry ist anfuegend: nur der Zustand darf sich aendern.', 1;

    UPDATE e
       SET state = i.state
      FROM dbo.rc_enquiry e
      JOIN inserted i ON i.id = e.id;
END;
GO

GO
PRINT '  OK   rc_0012_resource';
GO

/* --- 4: das Fassungsverzeichnis ------------------------------------------

   Die Pruefsummen stammen aus denselben Dateien und sind mit demselben
   Verfahren gebildet wie im Migrationslauf (SHA-256 ueber den UTF-8-Text).
   Damit erkennt ein spaeterer Lauf die Skripte als angewendet und laesst sie
   in Ruhe — und meldet trotzdem, wenn sich eines seither aendert.          */

IF OBJECT_ID('dbo.rc_schema_version', 'U') IS NULL
    CREATE TABLE dbo.rc_schema_version (
        script_name nvarchar(128)     NOT NULL PRIMARY KEY,
        applied_at  datetimeoffset(7) NOT NULL CONSTRAINT df_rc_schema_version_at DEFAULT SYSDATETIMEOFFSET(),
        checksum    varbinary(32)     NULL);
GO

DELETE FROM dbo.rc_schema_version;
GO

INSERT INTO dbo.rc_schema_version (script_name, checksum) VALUES
    (N'rc_0001_kernel', 0x599DB547756978307F2643C9F4DDD671DC29A5B1196FFC6780F4605A2D66804D),
    (N'rc_0002_chat', 0x2709E7DCCEB558913710D55C50D1E709F084A0ABFCF7C139B7877F2330FD038F),
    (N'rc_0003_invitation', 0xDF2B2D80CDE0B95A94D22AEC20B81FE721BAD18ABFBF491E4C0C5063AD767B41),
    (N'rc_0004_datakinds', 0xF2B38858E3D55393E2083F956DE38B2F73AFC3646BCAE4925A6B39DFB296AA78),
    (N'rc_0005_recovery_contribution', 0xED7A46ED214BA61BEEA89D6F8E2F6933C92235F2A86BA59A94A4E683BBC932D6),
    (N'rc_0006_events', 0xE03FEF7FE19DAF9944FB632D6DB64AA6A200B40186DA9EC92F0D292001F4E9E9),
    (N'rc_0007_event_intake', 0xBAB3ECAA6F6F214321863464FE19CEEF4B4D9F648F83787CE0E76198E3CE757D),
    (N'rc_0008_parish', 0xD08454F4141742AF208AB5CCD15C447B2B31EEAB8A0D8FBFEC8BC59BD1AAD777),
    (N'rc_0009_graph', 0x83442DD8EFE38CBCA058783A678F8C177D62AAB5BA3555B990D8F655B8C3370F),
    (N'rc_0010_calendar', 0xECFF7D6FB6306F49EB3D27C7C29EF3F8C7132959BD4C43F1C66D052ADBCC7A05),
    (N'rc_0011_confirmation', 0x1C438945CD452B4D62A33909C645B482E430FD34F7EA7243F4F3889E064B027C),
    (N'rc_0012_resource', 0xABF884FEBA13230F5AF13549662531477172D2EBC409A7F93991901A029B37C1);
GO

/* PRINT nimmt nur skalare Ausdruecke — eine Unterabfrage darin ist ein
   Syntaxfehler (Msg 1046), und zwar erst zur Laufzeit der letzten Zeile.
   Also vorher in eine Variable. */
DECLARE @stand int = (SELECT COUNT(*) FROM dbo.rc_schema_version);
PRINT '--- Fertig. Fassungsverzeichnis: ' + CAST(@stand AS varchar(10)) + ' von 12 ---';
GO
