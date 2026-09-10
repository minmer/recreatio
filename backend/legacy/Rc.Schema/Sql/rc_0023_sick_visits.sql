/*
    Odwiedziny chorych — trasy, osoby, wizyty.

    -------------------------------------------------------------------------
    CO TO JEST
    -------------------------------------------------------------------------

    Parafia odwiedza chorych w domach: komunia, spowiedź, czasem namaszczenie.
    Zwykle wszystkich jednego dnia, a listy są półtrwałe — ktoś dochodzi, ktoś
    wyzdrowieje, ktoś umrze.

    Trzy rzeczy, a nie jedna, bo pytania są trzy:

      GRUPA  — czyja trasa i jakiego rodzaju. Parafia ma ich kilka: po jednej
               na kapłana, osobno stałe i osobno jednorazowe.

      OSOBA  — kto na tej trasie stoi, w jakiej KOLEJNOŚCI i w jakim stanie.

      WIZYTA — co się wydarzyło danego dnia u danej osoby.

    -------------------------------------------------------------------------
    DLACZEGO DANE OSÓB SĄ ZAPIECZĘTOWANE
    -------------------------------------------------------------------------

    Że ktoś jest odwiedzany w domu, znaczy, że nie wychodzi — a to informacja o
    zdrowiu i o tym, że pod tym adresem mieszka ktoś bezbronny. Nazwisko i adres
    leżą więc zaszyfrowane pod kluczem epoki obszaru, tak jak wewnętrzne dane
    kandydatów.

    <b>Ten moduł nie ma i nie będzie miał drogi publicznej.</b> Przy mszach
    rozdział szedł inaczej — intencję czyta się na głos, więc jej treść jest
    jawna. Tutaj nie ma nic, co byłoby czytane na głos.

    Jawna zostaje sama KOLEJNOŚĆ i stan — bez nich nie da się ułożyć trasy ani
    policzyć, ilu jest chorych, a jedno i drugie robi się bez otwierania nazwisk.

    -------------------------------------------------------------------------
    DLACZEGO ZMARŁY ZOSTAJE
    -------------------------------------------------------------------------

    „Usuń" przy człowieku, który umarł, jest złą odpowiedzią na to, co się
    stało. Parafia pamięta, że go odwiedzała, i pamięta ostatnią wizytę — bywa,
    że to ona była ostatnim sakramentem. Dlatego stan, nie usunięcie.

    -------------------------------------------------------------------------
    DLACZEGO WIZYTA WISI PRZY WYSTĄPIENIU
    -------------------------------------------------------------------------

    Trasa jest wpisem kalendarza; jej powtórzenia to poszczególne objazdy.
    Wizyta należy do JEDNEGO objazdu — u tej samej osoby w marcu było co innego
    niż w kwietniu. Adres jest ten sam, pod którym kalendarz trzyma swoje
    wyjątki, a msza swoje intencje: (item_id, occurrence_at).
*/

/* -------------------------------------------------------------------------
   1. Wpis kalendarza może być objazdem chorych
   ------------------------------------------------------------------------- */

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_rc_item_type')
BEGIN
    ALTER TABLE dbo.rc_calendar_item DROP CONSTRAINT ck_rc_item_type;
END
GO

ALTER TABLE dbo.rc_calendar_item ADD CONSTRAINT ck_rc_item_type
    CHECK (item_type IN (N'appointment', N'task', N'mass', N'sick_round'));
GO

/* -------------------------------------------------------------------------
   2. Trasy
   ------------------------------------------------------------------------- */

IF OBJECT_ID('dbo.rc_sick_group', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.rc_sick_group (
        id            uniqueidentifier NOT NULL
                      CONSTRAINT pk_rc_sick_group PRIMARY KEY,

        area_id       uniqueidentifier NOT NULL,

        /*
            Nazwa trasy — „Trasa ks. Michała", „Odwiedziny jednorazowe". To
            etykieta organizacyjna, nie dana osobowa: nie mówi o żadnym chorym.
            Zapieczętowanie jej znaczyłoby, że nie da się wybrać trasy bez
            otwierania kluczy.
        */
        name          nvarchar(200) NOT NULL,

        /*
            'regular' — stały objazd, ta sama lista co miesiąc
            'single'  — odwiedziny jednorazowe: ktoś zachorował, ktoś prosi

            Rozróżnienie nie jest opisowe. Przy stałej liście pytanie brzmi
            „kogo dziś opuszczamy", przy jednorazowej „kto doszedł" — i to są
            dwa różne ekrany.
        */
        kind          nvarchar(20) NOT NULL
                      CONSTRAINT df_rc_sick_group_kind DEFAULT (N'regular'),

        /*
            Czyja to trasa. NULL znaczy: jeszcze nierozdzielona — a nie „niczyja
            na zawsze". Parafia z trzema kapłanami ma trzy trasy i to jest
            zwykły przypadek, nie wyjątek.
        */
        priest_role_id uniqueidentifier NULL,

        /*
            Wpis kalendarza, który niesie termin objazdu. NULL, dopóki nikt go
            nie ustalił — lista chorych istnieje przed terminem i po nim.
        */
        item_id       uniqueidentifier NULL,

        /* Zakończona trasa zostaje; patrz nagłówek o zmarłych. */
        ended_at      datetimeoffset(7) NULL,

        created_at    datetimeoffset(7) NOT NULL,
        updated_at    datetimeoffset(7) NOT NULL,

        CONSTRAINT fk_rc_sick_group_area
            FOREIGN KEY (area_id) REFERENCES dbo.rc_area (id),

        CONSTRAINT fk_rc_sick_group_item
            FOREIGN KEY (item_id) REFERENCES dbo.rc_calendar_item (id),

        CONSTRAINT ck_rc_sick_group_kind
            CHECK (kind IN (N'regular', N'single')),

        CONSTRAINT ck_rc_sick_group_name
            CHECK (LEN(LTRIM(RTRIM(name))) > 0)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_rc_sick_group_area')
BEGIN
    CREATE INDEX ix_rc_sick_group_area ON dbo.rc_sick_group (area_id, kind);
END
GO

/* Czyja trasa — pytanie, które kapłan zadaje o siebie, i to codziennie. */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_rc_sick_group_priest')
BEGIN
    CREATE INDEX ix_rc_sick_group_priest ON dbo.rc_sick_group (priest_role_id)
        WHERE priest_role_id IS NOT NULL;
END
GO

/* -------------------------------------------------------------------------
   3. Osoby na trasie
   ------------------------------------------------------------------------- */

IF OBJECT_ID('dbo.rc_sick_person', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.rc_sick_person (
        id            uniqueidentifier NOT NULL
                      CONSTRAINT pk_rc_sick_person PRIMARY KEY,

        group_id      uniqueidentifier NOT NULL,

        /*
            KOLEJNOŚĆ ODWIEDZIN — jawna i osobna.

            Trasa to trasa: jedzie się od ulicy do ulicy, a nie alfabetycznie.
            Kolejność musi dać się ułożyć i odczytać bez otwierania nazwisk,
            inaczej nie da się jej zaplanować na ekranie bez pokazywania
            wszystkich chorych naraz.
        */
        ordinal       int NOT NULL CONSTRAINT df_rc_sick_person_ord DEFAULT (0),

        /* Kto to jest — zapieczętowane pod kluczem epoki obszaru. */
        epoch         int NULL,
        name_sealed   varbinary(1024) NULL,
        address_sealed varbinary(2048) NULL,
        phone_sealed  varbinary(1024) NULL,

        /* Uwagi: „dzwonić przed przyjściem", „pies", „córka otwiera". */
        note_sealed   varbinary(4096) NULL,

        /*
            'active'   — odwiedzany
            'paused'   — chwilowo nie (szpital, wyjazd)
            'deceased' — zmarł
            'ended'    — wyzdrowiał, przeprowadził się, zrezygnował

            Zmarły ZOSTAJE. Patrz nagłówek: bywa, że ostatnia wizyta była
            ostatnim sakramentem, i to nie jest wiersz do skasowania.
        */
        status        nvarchar(20) NOT NULL
                      CONSTRAINT df_rc_sick_person_status DEFAULT (N'active'),

        created_at    datetimeoffset(7) NOT NULL,
        updated_at    datetimeoffset(7) NOT NULL,

        CONSTRAINT fk_rc_sick_person_group
            FOREIGN KEY (group_id) REFERENCES dbo.rc_sick_group (id),

        CONSTRAINT ck_rc_sick_person_status
            CHECK (status IN (N'active', N'paused', N'deceased', N'ended')),

        /*
            Zapieczętowane bez epoki nigdy się nie otworzy, a epoka bez
            zapieczętowanego to pusta deklaracja. Albo oboje, albo żadne.
        */
        CONSTRAINT ck_rc_sick_person_epoch
            CHECK ((epoch IS NULL
                    AND name_sealed IS NULL AND address_sealed IS NULL
                    AND phone_sealed IS NULL AND note_sealed IS NULL)
                OR (epoch IS NOT NULL))
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_rc_sick_person_route')
BEGIN
    CREATE INDEX ix_rc_sick_person_route
        ON dbo.rc_sick_person (group_id, ordinal, id);
END
GO

/* -------------------------------------------------------------------------
   4. Wizyty
   ------------------------------------------------------------------------- */

IF OBJECT_ID('dbo.rc_sick_visit', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.rc_sick_visit (
        id            uniqueidentifier NOT NULL
                      CONSTRAINT pk_rc_sick_visit PRIMARY KEY,

        person_id     uniqueidentifier NOT NULL,

        /* Który objazd — wpis kalendarza i jego wystąpienie. */
        item_id       uniqueidentifier NOT NULL,
        occurrence_at datetimeoffset(7) NOT NULL,

        /*
            CO SIĘ WYDARZYŁO — trzy rzeczy, trzy pola.

            Zwykle idą razem, ale nie zawsze: bywa spowiedź bez komunii, bywa
            sama komunia. Jedno pole „co dano" z wartościami „komunia" /
            „komunia i spowiedź" / „wszystko" wyglądałoby prościej i nie
            uniosłoby czwartego przypadku — a namaszczenie jest sakramentem,
            przy którym „mniej więcej tak było" nie wystarcza.
        */
        communion     bit NOT NULL CONSTRAINT df_rc_sick_visit_com DEFAULT (0),
        confession    bit NOT NULL CONSTRAINT df_rc_sick_visit_conf DEFAULT (0),
        anointing     bit NOT NULL CONSTRAINT df_rc_sick_visit_anoint DEFAULT (0),

        /*
            'done'   — odwiedzony
            'missed' — nie zastano
            'moved'  — przełożone

            „Nie zastano" to nie brak wiersza. Brak wiersza znaczy „jeszcze nie
            wiadomo", a to co innego niż „byliśmy, nie otworzył".
        */
        state         nvarchar(20) NOT NULL
                      CONSTRAINT df_rc_sick_visit_state DEFAULT (N'done'),

        epoch         int NULL,
        note_sealed   varbinary(4096) NULL,

        created_at    datetimeoffset(7) NOT NULL,
        updated_at    datetimeoffset(7) NOT NULL,

        CONSTRAINT fk_rc_sick_visit_person
            FOREIGN KEY (person_id) REFERENCES dbo.rc_sick_person (id),

        CONSTRAINT fk_rc_sick_visit_item
            FOREIGN KEY (item_id) REFERENCES dbo.rc_calendar_item (id),

        CONSTRAINT ck_rc_sick_visit_state
            CHECK (state IN (N'done', N'missed', N'moved')),

        CONSTRAINT ck_rc_sick_visit_epoch
            CHECK ((epoch IS NULL AND note_sealed IS NULL) OR (epoch IS NOT NULL))
    );
END
GO

/*
    Jedna wizyta u jednej osoby w jednym objeździe.

    Bez tego dwa kliknięcia dawałyby dwie wizyty tego samego dnia, a lista
    „co dano" pokazywałaby raz jedno, raz drugie — zależnie od sortowania.
*/
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_rc_sick_visit_once')
BEGIN
    CREATE UNIQUE INDEX uq_rc_sick_visit_once
        ON dbo.rc_sick_visit (person_id, item_id, occurrence_at);
END
GO

/* Pytanie objazdu: „co u kogo dziś" — czyli po wystąpieniu. */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_rc_sick_visit_round')
BEGIN
    CREATE INDEX ix_rc_sick_visit_round
        ON dbo.rc_sick_visit (item_id, occurrence_at);
END
GO
