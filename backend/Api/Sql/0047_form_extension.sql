/*
    Formulare, die ein anderes ERWEITERN — und die Schritte eines Menschen.

    =========================================================================
    1. DIE ERWEITERUNG (module.extends_id, module.audience, registration.base_id)
    =========================================================================

    Die Anmeldung zur Firmung ist ein Formular. Danach kommt mehr: der
    Koordinator notiert je Kandidat, was nur er sehen soll („Zgoda
    dostarczona", „Rozmowa odbyta: …"), und später braucht die Pfarrei vom
    Kandidaten noch Angaben, die bei der Anmeldung nicht gefragt waren (der
    Pate, das Ziel, die Wahl des Index). Beides gehört zu DEMSELBEN Menschen
    — zu seiner ersten Einsendung —, und beides ist ein eigenes Formular mit
    eigenen Fragen.

    Also: ein Formular kann ein anderes ERWEITERN (`extends_id`), und es sagt,
    WER es ausfüllt (`audience`):

        public   ein gewöhnliches Formular — jeder, der es sieht (bisher alle)
        person   der Mensch selbst, über seinen Link; seine Antworten liest er
                 wieder, wie die der Anmeldung
        office   nur die Kanzlei; der Mensch sieht davon nichts — nicht die
                 Fragen, nicht die Antworten, nicht dass es sie gibt

    Eine Einsendung eines erweiternden Formulars zeigt auf die Einsendung, die
    sie erweitert (`registration.base_id`) — je Mensch und Erweiterung höchstens
    eine. Nur eine Ebene: eine Erweiterung erweitert keine Erweiterung.

    Eine Einsendung der Kanzlei hat weder Platz noch Rolle noch Quittung; sie
    gehört über `base_id` zu jemandem. Die Prüfbedingung, dass jede Einsendung
    zu irgendwem gehört, nimmt diesen vierten Weg auf.

    =========================================================================
    2. DIE SCHRITTE (form_step, step_mark)
    =========================================================================

    Was ein Mensch noch tun muss — und was die Kanzlei noch abhaken muss. Ein
    Teil davon ergibt sich VON SELBST und steht hier nicht: die Durchsicht der
    Angaben (0046) und je Erweiterung „Uzupełnij". Der andere Teil wird VON
    HAND angelegt: „Przynieś zgodę rodzica", „Quiz". Nur dieser steht hier.

    Die Beschriftung ist versiegelt wie eine Frage — unter dem Schlüssel des
    Formulars. Wer abhaken darf (`done_by`), steht offen: das prüft der Dienst,
    und ein Mensch hakt nie ab, was die Kanzlei abhaken soll.
*/

IF COL_LENGTH('app.module', 'extends_id') IS NULL
    ALTER TABLE app.module ADD extends_id uniqueidentifier NULL
        CONSTRAINT fk_module_extends FOREIGN KEY REFERENCES app.module (id);
GO

IF COL_LENGTH('app.module', 'audience') IS NULL
    ALTER TABLE app.module ADD audience nvarchar(10) NOT NULL
        CONSTRAINT df_module_audience DEFAULT (N'public');
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_module_audience')
    ALTER TABLE app.module ADD CONSTRAINT ck_module_audience
        CHECK (audience IN (N'public', N'person', N'office')
               AND (extends_id IS NULL OR audience <> N'public'));
GO

IF COL_LENGTH('app.registration', 'base_id') IS NULL
    ALTER TABLE app.registration ADD base_id uniqueidentifier NULL
        CONSTRAINT fk_registration_base FOREIGN KEY REFERENCES app.registration (id);
GO

/* Je Mensch und Erweiterung höchstens eine Einsendung. */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_registration_extension')
    CREATE UNIQUE INDEX uq_registration_extension
        ON app.registration (part_id, base_id) WHERE base_id IS NOT NULL;
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_registration_who'
            AND definition NOT LIKE '%base_id%')
    ALTER TABLE app.registration DROP CONSTRAINT ck_registration_who;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_registration_who')
    ALTER TABLE app.registration ADD CONSTRAINT ck_registration_who
        CHECK (access_id IS NOT NULL OR role_id IS NOT NULL OR claim_sha256 IS NOT NULL
               OR base_id IS NOT NULL);
GO

IF OBJECT_ID('app.form_step') IS NULL
    CREATE TABLE app.form_step
    (
        id                uniqueidentifier NOT NULL,
        module_id         uniqueidentifier NOT NULL,
        position          int              NOT NULL,

        /* Versiegelt unter dem Schlüssel des Formularbereichs, wie eine Frage. */
        area_id           uniqueidentifier NOT NULL,
        epoch             int              NOT NULL,
        label_sealed      varbinary(max)   NOT NULL,
        help_sealed       varbinary(max)   NULL,

        /* Wer abhakt: die Kanzlei, oder der Mensch selbst über seinen Link. */
        done_by           nvarchar(10)     NOT NULL,

        /* Sieht der Mensch diesen Schritt? Ein Schritt nur für die Kanzlei nicht. */
        visible_to_person bit              NOT NULL CONSTRAINT df_form_step_visible DEFAULT (1),

        due_at            datetimeoffset(7) NULL,
        created_at        datetimeoffset(7) NOT NULL,

        CONSTRAINT pk_form_step PRIMARY KEY (id),
        CONSTRAINT fk_form_step_module FOREIGN KEY (module_id) REFERENCES app.module (id),
        CONSTRAINT fk_form_step_area FOREIGN KEY (area_id) REFERENCES app.area (id),
        CONSTRAINT ck_form_step_done_by CHECK (done_by IN (N'office', N'person')),

        /* Was der Mensch abhaken soll, muss er auch sehen. */
        CONSTRAINT ck_form_step_person_sees CHECK (done_by = N'office' OR visible_to_person = 1)
    );
GO

IF OBJECT_ID('app.step_mark') IS NULL
    CREATE TABLE app.step_mark
    (
        step_id         uniqueidentifier NOT NULL,
        registration_id uniqueidentifier NOT NULL,
        done_at         datetimeoffset(7) NOT NULL,

        /* Wer: eine Rolle der Kanzlei — oder NULL, wenn der Mensch selbst. */
        by_role_id      uniqueidentifier NULL,
        by_person       bit              NOT NULL,

        CONSTRAINT pk_step_mark PRIMARY KEY (step_id, registration_id),
        CONSTRAINT fk_step_mark_step FOREIGN KEY (step_id) REFERENCES app.form_step (id),
        CONSTRAINT fk_step_mark_registration FOREIGN KEY (registration_id) REFERENCES app.registration (id)
    );
GO
