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
