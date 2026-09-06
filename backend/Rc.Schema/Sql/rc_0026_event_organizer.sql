/*
    Kto organizuje wydarzenie — i kto odpowiada za dane.

    -------------------------------------------------------------------------
    DLACZEGO TO MUSI STAĆ PRZY WYDARZENIU
    -------------------------------------------------------------------------

    Wydarzenie zbiera zgłoszenia. Każdy formularz, który zbiera dane osobowe,
    musi powiedzieć, KTO jest administratorem tych danych i pod jakim adresem —
    inaczej klauzula RODO jest niepełna i zgoda zebrana pod nią też.

    Do tej pory arkusz zgody przy bierzmowaniu brał te dane ze strony parafii
    (`contact.address`). Przy wydarzeniu nie ma na czym się oprzeć: organizatorem
    bywa parafia, bywa wspólnota, bywa jedna osoba — i to nie zawsze ta sama, co
    założyła wydarzenie w systemie.

    -------------------------------------------------------------------------
    DLACZEGO JAWNE
    -------------------------------------------------------------------------

    Klauzula informacyjna jest z definicji do przeczytania: wisi pod formularzem,
    zanim ktokolwiek cokolwiek wpisze. Zaszyfrowanie jej znaczyłoby, że nie da
    się jej pokazać temu, komu ma służyć.

    To ta sama granica co przy mszy: `title_public` jawne, `title_sealed` nie.

    -------------------------------------------------------------------------
    ROLA ORGANIZATORA
    -------------------------------------------------------------------------

    `organizer_role_id` wskazuje rolę — osoby, parafii albo wspólnoty; rodzaj
    niesie sama rola (`rc_role.kind`), więc nie powtarza się go tutaj. Nazwa i
    adres stoją osobno, bo nazwa roli jest ZAPIECZĘTOWANA i publiczna klauzula
    nie mogłaby jej otworzyć.
*/

IF COL_LENGTH('dbo.rc_event', 'organizer_role_id') IS NULL
BEGIN
    ALTER TABLE dbo.rc_event ADD
        organizer_role_id uniqueidentifier NULL,

        /* Jak organizator nazywa się w klauzuli — „Parafia św. Kazimierza". */
        organizer_name    nvarchar(200) NULL,

        /* Adres administratora danych. Bez niego klauzula jest niepełna. */
        organizer_address nvarchar(400) NULL,

        /* Kontakt dla praw z RODO: wgląd, sprostowanie, usunięcie. */
        organizer_email   nvarchar(200) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_rc_event_organizer')
BEGIN
    ALTER TABLE dbo.rc_event
        ADD CONSTRAINT fk_rc_event_organizer
        FOREIGN KEY (organizer_role_id) REFERENCES dbo.rc_role (id);
END
GO

/*
    „Czyje są wydarzenia tej roli" — pytanie parafii albo wspólnoty o własną
    listę. Bez indeksu przechodzi przez wszystkie wydarzenia platformy.
*/
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_rc_event_organizer')
BEGIN
    CREATE INDEX ix_rc_event_organizer ON dbo.rc_event (organizer_role_id)
        WHERE organizer_role_id IS NOT NULL;
END
GO
