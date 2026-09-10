/*
    Kto dyżuruje — przy spowiedzi, przy mszy, przy objeździe chorych.

    -------------------------------------------------------------------------
    DLACZEGO NAZWISKO, A NIE ROLA
    -------------------------------------------------------------------------

    Pierwsza myśl: wskazać rolę kapłana i mieć wszystko powiązane. Nie da się —
    i to nie jest niedoróbka, tylko skutek szyfrowania.

    Nazwa roli leży zapieczętowana (`rc_role.display_name_sealed`) i otwiera ją
    KLUCZ TEJ ROLI (`RcRoles.OpenDisplayName`). Kancelaria trzyma swoje role, nie
    cudze. Lista „wybierz kapłana z parafii" byłaby więc listą identyfikatorów
    bez nazwisk — nie do użycia.

    Grafik dyżurów i tak powstaje przez wpisanie nazwisk: ktoś w kancelarii pisze
    „ks. Jan" na kartce. Więc `name` jest wpisywane, a `role_id` dopisuje się
    wtedy, gdy ktoś naprawdę powiąże dyżur z rolą — i dopiero wtedy da się
    kiedyś pokazać kapłanowi „moje dyżury".

    -------------------------------------------------------------------------
    DLACZEGO NAZWISKO JEST JAWNE
    -------------------------------------------------------------------------

    Kto spowiada, bywa ogłaszane w kościele i wywieszane w gablocie. To bliżej
    afisza niż danych osobowych — jak `title_public` przy mszy.

    `is_public` rozstrzyga, czy trafia na stronę: domyślnie nie, bo grafik
    wewnętrzny to jeszcze nie ogłoszenie. Parafia, która chce mieć na stronie
    „spowiedź: ks. Jan", zaznacza to świadomie.

    -------------------------------------------------------------------------
    STAŁY GRAFIK I WYJĄTEK
    -------------------------------------------------------------------------

    `occurrence_at IS NULL` znaczy: tak jest zawsze w tej serii — „w soboty
    spowiada ks. Jan". Wiersz z datą dotyczy JEDNEGO wystąpienia.

    Wystąpienie z własnymi wierszami ZASTĘPUJE stały grafik, a nie uzupełnia go.
    Dopisywanie byłoby niebezpieczne: kto wpisuje zastępstwo na 24 grudnia,
    chce, żeby stały dyżurny tego dnia zniknął — a nie żeby stał obok kogoś,
    kogo tam nie będzie.

    To ta sama zasada, co przy wyjątkach kalendarza: reguła plus odstępstwo.
*/

IF OBJECT_ID('dbo.rc_calendar_duty', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.rc_calendar_duty (
        id            uniqueidentifier NOT NULL
                      CONSTRAINT pk_rc_calendar_duty PRIMARY KEY,

        item_id       uniqueidentifier NOT NULL,

        /* NULL = stały grafik serii; data = jedno wystąpienie. */
        occurrence_at datetimeoffset(7) NULL,

        /*
            Kto. Wpisane, bo nazwy ról są zapieczętowane i kancelaria ich nie
            otworzy — patrz nagłówek.
        */
        name          nvarchar(200) NOT NULL,

        /* Powiązanie z rolą, jeśli ktoś je zrobi. Nie jest wymagane. */
        role_id       uniqueidentifier NULL,

        /*
            Kolejność na liście — przy kilku spowiadających naraz mówi, kto
            gdzie: pierwszy konfesjonał, drugi, trzeci.
        */
        sort_order    int NOT NULL CONSTRAINT df_rc_calendar_duty_ord DEFAULT (0),

        /* Krótka uwaga: „konfesjonał przy chrzcielnicy", „do 17:30". */
        note          nvarchar(200) NULL,

        /* Czy trafia do gabloty. Domyślnie nie: grafik to jeszcze nie afisz. */
        is_public     bit NOT NULL CONSTRAINT df_rc_calendar_duty_public DEFAULT (0),

        created_at    datetimeoffset(7) NOT NULL,
        updated_at    datetimeoffset(7) NOT NULL,

        CONSTRAINT fk_rc_calendar_duty_item
            FOREIGN KEY (item_id) REFERENCES dbo.rc_calendar_item (id),

        CONSTRAINT ck_rc_calendar_duty_name
            CHECK (LEN(LTRIM(RTRIM(name))) > 0)
    );
END
GO

/*
    Ten sam człowiek nie stoi dwa razy w tym samym dyżurze.

    Dwa kliknięcia dałyby dwa wiersze, a lista pokazywałaby „ks. Jan, ks. Jan" —
    co wygląda jak dwóch kapłanów.
*/
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_rc_calendar_duty_once')
BEGIN
    CREATE UNIQUE INDEX uq_rc_calendar_duty_once
        ON dbo.rc_calendar_duty (item_id, occurrence_at, name)
        WHERE occurrence_at IS NOT NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_rc_calendar_duty_standing')
BEGIN
    CREATE UNIQUE INDEX uq_rc_calendar_duty_standing
        ON dbo.rc_calendar_duty (item_id, name)
        WHERE occurrence_at IS NULL;
END
GO

/* Pytanie brzmi zawsze „kto przy tym wpisie" — czasem dla jednego dnia. */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_rc_calendar_duty_at')
BEGIN
    CREATE INDEX ix_rc_calendar_duty_at
        ON dbo.rc_calendar_duty (item_id, occurrence_at, sort_order);
END
GO
