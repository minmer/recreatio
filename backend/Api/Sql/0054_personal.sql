/*
    PERSOENLICH — die Plattform auch als eigener, privater Arbeitsplatz.

    Wunsch der Kanzlei (2026-09-29), in fuenf Teilen:

    =========================================================================
    1. DER EIGENE BEREICH
    =========================================================================

    Ein privater Termin braucht einen Schluessel, den nur ich habe. Das ist
    nichts Neues — ein Bereich mit genau einem Mitglied. Neu ist nur, dass er
    als DER EIGENE markiert ist (`personal_role_id`): die Oberflaeche nennt ihn
    „Tylko ja", legt ihn beim ersten privaten Termin selbst an und bietet ihn
    nirgends an, wo etwas geteilt wird. Je Person hoechstens einer.

    =========================================================================
    2. EIN TERMINARZ JE BEREICH
    =========================================================================

    Ein „Kalender" war bisher ein eigenes Ding, das man anlegen und benennen
    musste — fuer den Menschen aber ist es nur: die Termine, die dieselben
    Leute sehen. Also gibt es je Bereich genau einen, und er entsteht von
    selbst, sobald dort der erste Termin eingetragen wird. Heisst er in der
    Oberflaeche noch etwas, dann „Terminarz <Bereich>".

    Die bestehenden Daten haben schon je Bereich genau einen (geprueft
    2026-09-29); die Eindeutigkeit steht ab hier in der Datenbank.

    =========================================================================
    3. AUFGABEN
    =========================================================================

    Zwei Arten, und sie sind verschieden genug fuer eine Spalte:

        window   ein Zeitfenster, das wiederkehren kann — ein Gebet zwischen
                 21:00 und 21:15, jeden Tag. Erledigt wird ein VORKOMMEN.
        after    ein Abstand nach dem letzten Erledigen — Blumen giessen alle
                 drei Tage. Faellig ist sie, wenn der Abstand um ist; wer sie
                 erledigt, stellt die Uhr neu.

    Titel und Notiz liegen versiegelt unter dem Schluessel des Bereichs, wie
    alles andere. Die ZEIT bleibt im Klartext — aus demselben Grund wie im
    Kalender: sonst liesse sich nichts ausrechnen, ohne alles herunterzuladen.

    =========================================================================
    4. DER GEMERKTE STAND
    =========================================================================

    Was man zuletzt offen hatte, in welcher Reihenfolge man es benutzt — damit
    nach dem Neuladen nicht das alphabetisch Erste dasteht. Eine Huelle je
    Konto, versiegelt unter dem Schluessel des Kontos: der Dienst weiss nicht,
    was man zuletzt angesehen hat.

    =========================================================================
    5. DAS MENUE EINER SEITE
    =========================================================================

    Ein Baum aus Eintraegen, jeder mit einem Ziel: ein Pfad im Register
    (absolut), ein Pfad von der Seite des Menues aus (relativ), oder eine
    Adresse draussen. Offen gespeichert — es haengt oeffentlich an der Seite —
    und es gilt fuer die Seite und alle darunter, bis eine eigenes hat.
*/

/* -- 1. Der eigene Bereich ----------------------------------------------------- */

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID('app.area') AND name = 'personal_role_id')
    ALTER TABLE app.area ADD personal_role_id uniqueidentifier NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_area_personal_role')
    ALTER TABLE app.area ADD CONSTRAINT fk_area_personal_role
        FOREIGN KEY (personal_role_id) REFERENCES app.role (id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_area_personal')
    CREATE UNIQUE INDEX uq_area_personal ON app.area (personal_role_id) WHERE personal_role_id IS NOT NULL;
GO

/* -- 2. Ein Terminarz je Bereich ------------------------------------------------- */

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_calendar_area')
    CREATE UNIQUE INDEX uq_calendar_area ON app.calendar (area_id);
GO

/* -- 3. Aufgaben ------------------------------------------------------------------ */

IF OBJECT_ID('app.task') IS NULL
    CREATE TABLE app.task
    (
        id              uniqueidentifier  NOT NULL,

        /* Wer sie sieht — und unter wessen Schluessel sie versiegelt ist. */
        area_id         uniqueidentifier  NOT NULL,
        owner_role_id   uniqueidentifier  NOT NULL,

        kind            nvarchar(8)       NOT NULL,
        time_zone       nvarchar(64)      NOT NULL,

        /* window: Beginn des ersten Fensters. after: wann sie das erste Mal faellig ist. */
        starts_at       datetimeoffset(7) NOT NULL,

        /* window: wie lange das Fenster offen ist. after: ohne Bedeutung (0). */
        window_minutes  int               NOT NULL CONSTRAINT df_task_window DEFAULT (0),

        /* after: der Abstand nach dem letzten Erledigen. */
        every_minutes   int               NULL,

        repeat_kind     nvarchar(8)       NOT NULL CONSTRAINT df_task_repeat DEFAULT (N'none'),
        repeat_every    int               NOT NULL CONSTRAINT df_task_repeat_every DEFAULT (1),
        repeat_weekdays tinyint           NULL,
        repeat_until    datetimeoffset(7) NULL,
        repeat_count    int               NULL,

        epoch           int               NOT NULL,
        title_sealed    varbinary(4096)   NOT NULL,
        notes_sealed    varbinary(max)    NULL,

        created_at      datetimeoffset(7) NOT NULL,
        updated_at      datetimeoffset(7) NOT NULL,
        archived_at     datetimeoffset(7) NULL,

        CONSTRAINT pk_task PRIMARY KEY (id),
        CONSTRAINT fk_task_area FOREIGN KEY (area_id) REFERENCES app.area (id),
        CONSTRAINT fk_task_owner FOREIGN KEY (owner_role_id) REFERENCES app.role (id),
        CONSTRAINT ck_task_kind CHECK (kind IN (N'window', N'after')),
        CONSTRAINT ck_task_repeat CHECK (repeat_kind IN (N'none', N'daily', N'weekly', N'monthly', N'yearly')),
        CONSTRAINT ck_task_shape CHECK (
            (kind = N'window' AND every_minutes IS NULL)
         OR (kind = N'after' AND every_minutes IS NOT NULL AND every_minutes > 0 AND repeat_kind = N'none')),
        CONSTRAINT ck_task_window CHECK (window_minutes BETWEEN 0 AND 10080)
    );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_task_area')
    CREATE INDEX ix_task_area ON app.task (area_id, archived_at);
GO

/*
    Erledigt — je Vorkommen. Bei `window` der Beginn des Fensters (sein Name,
    wie bei den Intentionen), bei `after` der Augenblick des Erledigens selbst.
*/
IF OBJECT_ID('app.task_done') IS NULL
    CREATE TABLE app.task_done
    (
        task_id         uniqueidentifier  NOT NULL,
        occurrence_at   datetimeoffset(7) NOT NULL,
        done_at         datetimeoffset(7) NOT NULL,
        done_by_role_id uniqueidentifier  NOT NULL,

        CONSTRAINT pk_task_done PRIMARY KEY (task_id, occurrence_at),
        CONSTRAINT fk_task_done_task FOREIGN KEY (task_id) REFERENCES app.task (id),
        CONSTRAINT fk_task_done_role FOREIGN KEY (done_by_role_id) REFERENCES app.role (id)
    );
GO

/* -- 4. Der gemerkte Stand ---------------------------------------------------------- */

IF OBJECT_ID('app.account_state') IS NULL
    CREATE TABLE app.account_state
    (
        account_id   uniqueidentifier  NOT NULL,
        state_sealed varbinary(max)    NOT NULL,
        updated_at   datetimeoffset(7) NOT NULL,

        CONSTRAINT pk_account_state PRIMARY KEY (account_id),
        CONSTRAINT fk_account_state_account FOREIGN KEY (account_id) REFERENCES app.account (id)
    );
GO

/* -- 5. Das Menue einer Seite --------------------------------------------------------- */

IF OBJECT_ID('app.slug_menu') IS NULL
    CREATE TABLE app.slug_menu
    (
        slug_id    uniqueidentifier  NOT NULL,
        menu       nvarchar(max)     NOT NULL,
        updated_at datetimeoffset(7) NOT NULL,

        CONSTRAINT pk_slug_menu PRIMARY KEY (slug_id),
        CONSTRAINT fk_slug_menu_slug FOREIGN KEY (slug_id) REFERENCES app.slug (id)
    );
GO
