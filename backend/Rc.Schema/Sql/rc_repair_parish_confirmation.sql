/* ===========================================================================
   NAPRAWA — parafia i bierzmowanie (rc_0013 … rc_0016)

   CO TO JEST. Jeden skrypt, który doprowadza bazę do stanu, jaki dają migracje
   0013–0016 — i który można uruchomić RĘCZNIE, dowolną liczbę razy, bez ani
   jednego błędu. Każdy krok najpierw sprawdza, czy nie jest już zrobiony.

   PO CO. Uruchomienie zastosowanej już migracji drugi raz sypie ścianą
   komunikatów „already exists". Nic się wtedy nie psuje, ale nie widać, czy coś
   jednak nie zostało zrobione — a to jest właśnie pytanie, które się wtedy ma.

   CZEGO TEN SKRYPT NIE ROBI: nie dotyka dbo.rc_schema_version. Rejestr wersji
   należy do programu migracyjnego. Gdyby skrypt dopisywał tam wiersze, mówiłby,
   że plik został zastosowany — a suma kontrolna tego pliku byłaby inna niż tego,
   który naprawdę uruchomiono. Rejestr kłamałby dokładnie o tym, po co istnieje.

   PO URUCHOMIENIU sprawdź stan:
       dotnet run --project backend\Rc.Schema -- --verify

   BEZPIECZEŃSTWO: skrypt niczego nie usuwa i nie zmienia żadnych danych.
   Jedyne DROP dotyczy warunku ck_rc_parish_site_modules_list, który wymagał
   nawiasu kwadratowego i odrzucał dzisiejszy dokument — i tylko wtedy, gdy
   nowy warunek ma go zastąpić.
   =========================================================================== */

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
GO

PRINT '--- Naprawa: parafia i bierzmowanie ---------------------------------';
GO

/* == rc_0013 — strona parafii ============================================== */

IF OBJECT_ID('dbo.rc_parish_site', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.rc_parish_site
    (
        seq         bigint IDENTITY(1,1) NOT NULL,
        parish_id   uniqueidentifier     NOT NULL,
        theme       nvarchar(40)         NOT NULL
                    CONSTRAINT df_rc_parish_site_theme DEFAULT N'classic',
        modules     nvarchar(max)        NOT NULL,
        updated_at  datetimeoffset(7)    NOT NULL,

        CONSTRAINT pk_rc_parish_site PRIMARY KEY CLUSTERED (seq),
        CONSTRAINT uq_rc_parish_site_parish UNIQUE NONCLUSTERED (parish_id),
        CONSTRAINT fk_rc_parish_site_parish FOREIGN KEY (parish_id)
            REFERENCES dbo.rc_parish (id)
    );
    PRINT '  utworzono  dbo.rc_parish_site';
END
ELSE PRINT '  jest       dbo.rc_parish_site';
GO

/* == rc_0014 — strona jest DOKUMENTEM, nie listą =========================== */

/*
   Stary warunek wymagał nawiasu kwadratowego na zewnątrz i odrzucał
   { "modules": …, "menu": …, "content": … }. Zdejmowany jest tylko po to, żeby
   nowy mógł zadziałać — dwa warunki naraz są nie do spełnienia.

   ISJSON tu nie ma i nie będzie: funkcja istnieje dopiero od poziomu zgodności
   130, a ta baza działa poniżej. Warunek łapie przypadek, który naprawdę się
   zdarza (proza trafia do kolumny czytanej jako JSON), a nie ten, w którym ktoś
   celowo pisze zepsuty JSON — przed tym drugim chroni usługa, która sama składa
   wartość i sama ją sprawdza.
*/
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_rc_parish_site_modules_list')
BEGIN
    ALTER TABLE dbo.rc_parish_site DROP CONSTRAINT ck_rc_parish_site_modules_list;
    PRINT '  zdjeto     ck_rc_parish_site_modules_list (wymagal listy)';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_rc_parish_site_document')
BEGIN
    ALTER TABLE dbo.rc_parish_site
        ADD CONSTRAINT ck_rc_parish_site_document CHECK (
            (LEFT(LTRIM(modules), 1) = N'{' AND RIGHT(RTRIM(modules), 1) = N'}')
         OR (LEFT(LTRIM(modules), 1) = N'[' AND RIGHT(RTRIM(modules), 1) = N']')
        );
    PRINT '  dodano     ck_rc_parish_site_document';
END
ELSE PRINT '  jest       ck_rc_parish_site_document';
GO

/* == rc_0015 — zgloszenie kandydata z zewnatrz ============================= */

/* Grupa przyjmuje zgloszenia: para kluczy + przelacznik. */

IF COL_LENGTH('dbo.rc_confirmation_group', 'intake_public_key') IS NULL
BEGIN
    ALTER TABLE dbo.rc_confirmation_group ADD intake_public_key varbinary(1024) NULL;
    PRINT '  dodano     rc_confirmation_group.intake_public_key';
END
ELSE PRINT '  jest       rc_confirmation_group.intake_public_key';
GO

IF COL_LENGTH('dbo.rc_confirmation_group', 'intake_private_sealed') IS NULL
BEGIN
    ALTER TABLE dbo.rc_confirmation_group ADD intake_private_sealed varbinary(max) NULL;
    PRINT '  dodano     rc_confirmation_group.intake_private_sealed';
END
ELSE PRINT '  jest       rc_confirmation_group.intake_private_sealed';
GO

IF COL_LENGTH('dbo.rc_confirmation_group', 'intake_epoch') IS NULL
BEGIN
    ALTER TABLE dbo.rc_confirmation_group ADD intake_epoch int NULL;
    PRINT '  dodano     rc_confirmation_group.intake_epoch';
END
ELSE PRINT '  jest       rc_confirmation_group.intake_epoch';
GO

/* Wylaczone domyslnie: grupa, ktora przyjmuje zgloszenia od chwili powstania,
   przyjmuje je, zanim ktokolwiek o tym zdecydowal. */
IF COL_LENGTH('dbo.rc_confirmation_group', 'applications_open') IS NULL
BEGIN
    ALTER TABLE dbo.rc_confirmation_group
        ADD applications_open bit NOT NULL CONSTRAINT df_rc_conf_open DEFAULT 0;
    PRINT '  dodano     rc_confirmation_group.applications_open';
END
ELSE PRINT '  jest       rc_confirmation_group.applications_open';
GO

/* Kandydat: droga powrotna. */

IF COL_LENGTH('dbo.rc_candidate', 'portal_token_hash') IS NULL
BEGIN
    ALTER TABLE dbo.rc_candidate ADD portal_token_hash varbinary(32) NULL;
    PRINT '  dodano     rc_candidate.portal_token_hash';
END
ELSE PRINT '  jest       rc_candidate.portal_token_hash';
GO

IF COL_LENGTH('dbo.rc_candidate', 'applied_at') IS NULL
BEGIN
    ALTER TABLE dbo.rc_candidate ADD applied_at datetimeoffset(7) NULL;
    PRINT '  dodano     rc_candidate.applied_at';
END
ELSE PRINT '  jest       rc_candidate.applied_at';
GO

IF COL_LENGTH('dbo.rc_candidate', 'account_id') IS NULL
BEGIN
    ALTER TABLE dbo.rc_candidate ADD account_id uniqueidentifier NULL;
    PRINT '  dodano     rc_candidate.account_id';
END
ELSE PRINT '  jest       rc_candidate.account_id';
GO

/* Dwoch kandydatow z tym samym linkiem to dwoje ludzi za jednymi drzwiami. */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_rc_candidate_portal')
BEGIN
    CREATE UNIQUE INDEX uq_rc_candidate_portal
        ON dbo.rc_candidate (portal_token_hash)
        WHERE portal_token_hash IS NOT NULL;
    PRINT '  dodano     uq_rc_candidate_portal';
END
ELSE PRINT '  jest       uq_rc_candidate_portal';
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_rc_candidate_account')
BEGIN
    CREATE INDEX ix_rc_candidate_account
        ON dbo.rc_candidate (account_id)
        WHERE account_id IS NOT NULL;
    PRINT '  dodano     ix_rc_candidate_account';
END
ELSE PRINT '  jest       ix_rc_candidate_account';
GO

/* Klucz sesji zgloszenia, zapakowany kluczem publicznym grupy. */
IF OBJECT_ID('dbo.rc_candidate_intake', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.rc_candidate_intake (
        seq                 bigint IDENTITY(1,1) NOT NULL,
        candidate_id        uniqueidentifier     NOT NULL,
        session_key_wrapped varbinary(1024)      NOT NULL,
        intake_epoch        int                  NOT NULL,
        created_at          datetimeoffset(7)    NOT NULL,
        absorbed_at         datetimeoffset(7)    NULL,

        CONSTRAINT pk_rc_candidate_intake PRIMARY KEY CLUSTERED (seq),
        CONSTRAINT uq_rc_candidate_intake UNIQUE NONCLUSTERED (candidate_id),
        CONSTRAINT fk_rc_candidate_intake_cand FOREIGN KEY (candidate_id)
            REFERENCES dbo.rc_candidate (id)
    );
    PRINT '  utworzono  dbo.rc_candidate_intake';
END
ELSE PRINT '  jest       dbo.rc_candidate_intake';
GO

/* == rc_0016 — klucz w linku, link dla parafii, wylaczanie ================= */

/* Sekret portalu zapakowany kluczem publicznym grupy — zeby parafia mogla
   odtworzyc link i wyslac go SMS-em. Jawnie zapisany otwieralby kazdy portal
   jednym zajrzeniem do bazy. */
IF COL_LENGTH('dbo.rc_candidate', 'portal_token_wrapped') IS NULL
BEGIN
    ALTER TABLE dbo.rc_candidate ADD portal_token_wrapped varbinary(1024) NULL;
    PRINT '  dodano     rc_candidate.portal_token_wrapped';
END
ELSE PRINT '  jest       rc_candidate.portal_token_wrapped';
GO

IF COL_LENGTH('dbo.rc_candidate', 'portal_revoked_at') IS NULL
BEGIN
    ALTER TABLE dbo.rc_candidate ADD portal_revoked_at datetimeoffset(7) NULL;
    PRINT '  dodano     rc_candidate.portal_revoked_at';
END
ELSE PRINT '  jest       rc_candidate.portal_revoked_at';
GO

/* Wylaczyc link mozna dopiero po podlaczeniu konta. Bez tego warunku powstalby
   stan „bez konta i martwy link" — czyli nikt juz nie dociera do zgloszenia,
   takze sam kandydat. */
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_rc_candidate_portal_revoke')
BEGIN
    ALTER TABLE dbo.rc_candidate
        ADD CONSTRAINT ck_rc_candidate_portal_revoke CHECK (
            portal_revoked_at IS NULL OR account_id IS NOT NULL
        );
    PRINT '  dodano     ck_rc_candidate_portal_revoke';
END
ELSE PRINT '  jest       ck_rc_candidate_portal_revoke';
GO

/* == Co wyszlo ============================================================= */

DECLARE @brakuje int = 0;

IF COL_LENGTH('dbo.rc_confirmation_group', 'intake_public_key')     IS NULL SET @brakuje += 1;
IF COL_LENGTH('dbo.rc_confirmation_group', 'intake_private_sealed') IS NULL SET @brakuje += 1;
IF COL_LENGTH('dbo.rc_confirmation_group', 'intake_epoch')          IS NULL SET @brakuje += 1;
IF COL_LENGTH('dbo.rc_confirmation_group', 'applications_open')     IS NULL SET @brakuje += 1;
IF COL_LENGTH('dbo.rc_candidate', 'portal_token_hash')              IS NULL SET @brakuje += 1;
IF COL_LENGTH('dbo.rc_candidate', 'portal_token_wrapped')           IS NULL SET @brakuje += 1;
IF COL_LENGTH('dbo.rc_candidate', 'portal_revoked_at')              IS NULL SET @brakuje += 1;
IF COL_LENGTH('dbo.rc_candidate', 'applied_at')                     IS NULL SET @brakuje += 1;
IF COL_LENGTH('dbo.rc_candidate', 'account_id')                     IS NULL SET @brakuje += 1;
IF OBJECT_ID('dbo.rc_candidate_intake', 'U')                        IS NULL SET @brakuje += 1;
IF OBJECT_ID('dbo.rc_parish_site', 'U')                             IS NULL SET @brakuje += 1;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_rc_candidate_portal')          SET @brakuje += 1;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_rc_candidate_account')         SET @brakuje += 1;
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_rc_candidate_portal_revoke') SET @brakuje += 1;
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_rc_parish_site_document')     SET @brakuje += 1;

PRINT '---------------------------------------------------------------------';
IF @brakuje = 0
    PRINT 'Wszystko na miejscu.';
ELSE
    PRINT CONCAT('UWAGA: brakuje ', @brakuje, ' elementow — cos przerwalo skrypt.');
GO
