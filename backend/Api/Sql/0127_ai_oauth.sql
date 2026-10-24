/*
    0127 — RECREATIO ALS MCP-SERVER, ANGEMELDET ÜBER OAUTH (2026-10-24).

    Ein Assistent (ChatGPT) verbindet sich mit https://api.recreatio.pl/mcp. Er
    bekommt dabei nichts Neues: sein Zugangstoken IST die Liste der Dostęp-dla-AI-
    Links (0126), die der Mensch im Browser freigibt — dieselben Behälter, dieselbe
    Gültigkeit, gelöscht ist gelöscht. Diese Tabellen halten nur den Weg dorthin.

    ai_oauth_client   ein Assistent, der sich selbst angemeldet hat (Dynamic Client
                      Registration, RFC 7591): seine Kennung, sein Name, seine
                      Rücksprungadressen. Ohne Geheimnis (öffentlicher Client, PKCE).
    ai_oauth_grant    eine laufende Anmeldung: was der Assistent verlangte (Client,
                      Rücksprung, PKCE, state, resource), wer im Browser zustimmte,
                      und danach der Hash des Codes und die freigegebenen Geheimnisse,
                      versiegelt unter einem Schlüssel aus dem Code (Kernel
                      InfoAiOAuthCode) — der Dienst kann sie erst öffnen, wenn der
                      Assistent den Code bringt. Eingelöst, abgelehnt oder abgelaufen
                      ist die Zeile fort.

    Keine Daten eines Benutzers werden verändert; noch einmal ausgeführt, ändert es nichts.
*/

IF OBJECT_ID('app.ai_oauth_client', 'U') IS NULL
    CREATE TABLE app.ai_oauth_client
    (
        client_id      varchar(64)       NOT NULL,
        name           nvarchar(200)     NOT NULL,
        redirect_uris  nvarchar(4000)    NOT NULL,
        created_at     datetimeoffset(7) NOT NULL,
        last_used_at   datetimeoffset(7) NULL,
        CONSTRAINT pk_ai_oauth_client PRIMARY KEY (client_id)
    );
GO

IF OBJECT_ID('app.ai_oauth_grant', 'U') IS NULL
    CREATE TABLE app.ai_oauth_grant
    (
        id              uniqueidentifier  NOT NULL,
        client_id       varchar(512)      NOT NULL,
        client_name     nvarchar(200)     NOT NULL,
        issuer          nvarchar(400)     NOT NULL,
        redirect_uri    nvarchar(2000)    NOT NULL,
        code_challenge  varchar(128)      NOT NULL,
        state           nvarchar(1000)    NULL,
        resource        nvarchar(2000)    NULL,
        scope           nvarchar(200)     NULL,
        created_at      datetimeoffset(7) NOT NULL,
        expires_at      datetimeoffset(7) NOT NULL,
        account_id      uniqueidentifier  NULL,
        approved_at     datetimeoffset(7) NULL,
        code_sha256     varbinary(32)     NULL,
        secrets_sealed  varbinary(4000)   NULL,
        links           int               NULL,
        CONSTRAINT pk_ai_oauth_grant PRIMARY KEY (id),
        CONSTRAINT ck_ai_oauth_grant_code CHECK (
            (code_sha256 IS NULL AND secrets_sealed IS NULL AND approved_at IS NULL)
         OR (DATALENGTH(code_sha256) = 32 AND secrets_sealed IS NOT NULL AND approved_at IS NOT NULL AND account_id IS NOT NULL))
    );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_ai_oauth_grant_code')
    CREATE UNIQUE INDEX ux_ai_oauth_grant_code ON app.ai_oauth_grant (code_sha256) WHERE code_sha256 IS NOT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_ai_oauth_grant_expires')
    CREATE INDEX ix_ai_oauth_grant_expires ON app.ai_oauth_grant (expires_at);
GO
