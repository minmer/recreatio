/*
    0138 — EINE MCP-VERBINDUNG, DIE BEREICHE DAZUBEKOMMT (2026-11-05).

    Bis hierher WAR das Zugangstoken eines Assistenten die Liste der Dostęp-dla-AI-Links, die der
    Mensch bei der Anmeldung (0127) ankreuzte — fest für immer: ein Link, der später in einem anderen
    Bereich entstand, kam nie dazu, und wer einen Bereich dazunehmen wollte, musste sich neu anmelden
    (und dabei alle wieder ankreuzen). Jetzt bekommt der Assistent eine VERBINDUNG:

    ai_mcp_connection  wem sie gehört (wer zustimmte — nur er verwaltet sie), welcher Assistent, bis
                       wann; der Hash ihres Tokens; ein RSA-Schlüsselpaar: der öffentliche offen, der
                       private versiegelt unter einem Schlüssel aus dem Token (Kernel
                       InfoAiMcpConnection, AAD ai_mcp_connection). claimed_at: der Assistent hat
                       seinen Code eingelöst (vorher zählt sie nicht und ist nach einer Stunde fort).
    ai_mcp_link        je Bereich der Link, den sie liest: dessen Geheimnis RSA-verpackt an den
                       öffentlichen Schlüssel der Verbindung (AAD ai_mcp_link). So kann der Dienst
                       einen Link HINZUFÜGEN, ohne das Token zu kennen, und ihn erst öffnen, wenn
                       der Assistent mit dem Token fragt. Ein gelöschter Link verschwindet aus jeder
                       Verbindung (ON DELETE CASCADE).

    Alte Tokens (Liste der Geheimnisse) gelten weiter wie bisher. Keine Daten eines Benutzers werden
    verändert; noch einmal ausgeführt, ändert es nichts.
*/

IF OBJECT_ID('app.ai_mcp_connection', 'U') IS NULL
    CREATE TABLE app.ai_mcp_connection
    (
        id              uniqueidentifier  NOT NULL,
        account_id      uniqueidentifier  NOT NULL,
        client_id       varchar(512)      NOT NULL,
        client_name     nvarchar(200)     NOT NULL,
        token_sha256    varbinary(32)     NOT NULL,
        public_key      varbinary(1024)   NOT NULL,
        private_sealed  varbinary(max)    NOT NULL,
        created_at      datetimeoffset(7) NOT NULL,
        claimed_at      datetimeoffset(7) NULL,
        expires_at      datetimeoffset(7) NOT NULL,
        last_used_at    datetimeoffset(7) NULL,
        CONSTRAINT pk_ai_mcp_connection PRIMARY KEY (id),
        CONSTRAINT ck_ai_mcp_connection_token CHECK (DATALENGTH(token_sha256) = 32)
    );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_ai_mcp_connection_token')
    CREATE UNIQUE INDEX ux_ai_mcp_connection_token ON app.ai_mcp_connection (token_sha256);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_ai_mcp_connection_account')
    CREATE INDEX ix_ai_mcp_connection_account ON app.ai_mcp_connection (account_id, created_at);
GO

IF OBJECT_ID('app.ai_mcp_link', 'U') IS NULL
    CREATE TABLE app.ai_mcp_link
    (
        connection_id   uniqueidentifier  NOT NULL,
        access_id       uniqueidentifier  NOT NULL,
        secret_wrapped  varbinary(1024)   NOT NULL,
        added_at        datetimeoffset(7) NOT NULL,
        CONSTRAINT pk_ai_mcp_link PRIMARY KEY (connection_id, access_id),
        CONSTRAINT fk_ai_mcp_link_connection FOREIGN KEY (connection_id) REFERENCES app.ai_mcp_connection (id) ON DELETE CASCADE,
        CONSTRAINT fk_ai_mcp_link_access FOREIGN KEY (access_id) REFERENCES app.ai_access (id) ON DELETE CASCADE
    );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_ai_mcp_link_access')
    CREATE INDEX ix_ai_mcp_link_access ON app.ai_mcp_link (access_id);
GO
